/**
 * Contract suite for the config reader (ADAPTER.md). The claims under test:
 * the lookup order is `.yml`, `.yaml`, `.json`; a missing file or key takes
 * its default; and every spelling outside the documented subset or shape is a
 * named problem with its line, never a silent default.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_FILES,
  DEFAULTS,
  formatProblem,
  parseConfigJson,
  parseConfigYaml,
  readConfig,
} from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const yaml = (...lines) => parseConfigYaml(lines.join("\n"));
const only = (files) => (path) => files[path] ?? null;
/** The problems as `line N: message` strings, as the CLI prints them. */
const printed = ({ problems }) => problems.map(formatProblem);

// ── Lookup order and defaults ───────────────────────────────────────────────

test("the lookup order is .yml, then .yaml, then .json", () => {
  assert.deepEqual(ADAPTER_FILES, [
    "address-pr-review.config.yml",
    "address-pr-review.config.yaml",
    "address-pr-review.config.json",
  ]);
});

test("the first file present wins, and the search does not merge the others", () => {
  const all = {
    "address-pr-review.config.yml": "working_dir: from-yml",
    "address-pr-review.config.yaml": "working_dir: from-yaml",
    "address-pr-review.config.json": '{"working_dir": "from-json", "worktree": false}',
  };
  assert.equal(readConfig(only(all)).path, "address-pr-review.config.yml");
  assert.equal(readConfig(only(all)).config.working_dir, "from-yml");

  const { "address-pr-review.config.yml": _yml, ...yamlAndJson } = all;
  const found = readConfig(only(yamlAndJson));
  assert.equal(found.path, "address-pr-review.config.yaml");
  assert.equal(found.config.working_dir, "from-yaml");
  assert.equal(found.config.worktree, true, "the .json file's worktree: false is not merged in");

  const jsonOnly = readConfig(only({ "address-pr-review.config.json": all[ADAPTER_FILES[2]] }));
  assert.equal(jsonOnly.path, "address-pr-review.config.json");
  assert.equal(jsonOnly.config.worktree, false);
});

test("no config file is not an error: every key takes its default", () => {
  assert.deepEqual(
    readConfig(() => null),
    { path: null, config: DEFAULTS, problems: [] },
  );
  assert.deepEqual(DEFAULTS, {
    reviewer_logins: ["github-actions"],
    working_dir: "tmp/address-pr-review",
    worktree: true,
    commit_command: null,
    push_command: null,
  });
});

test("a missing key, a bare `key:` and an empty file each take the default", () => {
  const partial = readConfig(only({ [ADAPTER_FILES[0]]: "worktree: false\ncommit_command:\n" }));
  assert.deepEqual(partial.problems, []);
  assert.deepEqual(partial.config, { ...DEFAULTS, worktree: false });
  assert.deepEqual(readConfig(only({ [ADAPTER_FILES[0]]: "# nothing set\n" })).config, DEFAULTS);
  assert.deepEqual(readConfig(only({ [ADAPTER_FILES[2]]: "{}" })).config, DEFAULTS);
});

// ── What reads ──────────────────────────────────────────────────────────────

test("the documented YAML example reads with no problems", () => {
  const { config, problems } = yaml(
    "# address-pr-review.config.yml",
    "reviewer_logins:",
    "  - github-actions",
    "  - 'coderabbitai' # a third-party review bot",
    "working_dir: tmp/review # gitignored",
    "worktree: true",
    'commit_command: "npm run commit -- --file {message_file}"',
    "push_command: git push origin HEAD:{branch}",
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(config, {
    reviewer_logins: ["github-actions", "coderabbitai"],
    working_dir: "tmp/review",
    worktree: true,
    commit_command: "npm run commit -- --file {message_file}",
    push_command: "git push origin HEAD:{branch}",
  });
});

test("a flow list, a sequence at its key's own indent, and CRLF line ends all read", () => {
  assert.deepEqual(yaml("reviewer_logins: [github-actions, 'my-bot']").config.reviewer_logins, [
    "github-actions",
    "my-bot",
  ]);
  assert.deepEqual(yaml("reviewer_logins:", "- a-bot", "- b-bot").config.reviewer_logins, [
    "a-bot",
    "b-bot",
  ]);
  assert.deepEqual(parseConfigYaml("worktree: false\r\nworking_dir: x\r\n").config, {
    worktree: false,
    working_dir: "x",
  });
});

test("a JSON config reads whole, with real booleans", () => {
  const { config, problems } = parseConfigJson(
    JSON.stringify({ reviewer_logins: ["github-actions"], worktree: false }),
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(config, { reviewer_logins: ["github-actions"], worktree: false });
});

// ── Each problem class, with its line ──────────────────────────────────────

test("YAML syntax outside the subset is a problem with its line", () => {
  const cases = [
    [["worktree: true", "\tworking_dir: x"], /^line 2: indented with a tab/],
    [["  worktree: true"], /^line 1: the first key must start at column 1/],
    [["worktree: true", "  working_dir: x"], /^line 2: unexpected indentation/],
    [["worktree: true", "just text"], /^line 2: expected `key: value`/],
    [["working_dir: a", "working_dir: b"], /^line 2: duplicate key `working_dir`/],
    [["", "working_dir: 'tmp"], /^line 2: unterminated ' quote/],
    [["working_dir: 'tmp' extra"], /^line 1: unexpected text after the closing quote/],
    [["working_dir: {a: b}"], /^line 1: .*flow mapping.*JSON instead/],
    [["working_dir: &anchor x"], /^line 1: .*anchor/],
    [["working_dir: *alias"], /^line 1: .*alias/],
    [["working_dir: |"], /^line 1: multi-line scalars/],
    [["reviewer_logins: [a, b"], /^line 1: a flow list must close/],
    [["reviewer_logins:", "  - a", "  -"], /^line 3: an empty list item/],
    [["reviewer_logins:", "  name: x"], /^line 2: nested mappings are outside/],
    [["reviewer_logins:", "  - name: x"], /^line 2: nested mappings are outside/],
  ];
  for (const [lines, expected] of cases)
    assert.match(printed(yaml(...lines)).join("\n"), expected, lines.join(" ⏎ "));
});

test("an unknown key is a problem with its line, naming the documented keys", () => {
  const [problem] = printed(yaml("worktree: true", "reviewers: [x]"));
  assert.match(problem, /^line 2: unknown key `reviewers`/);
  assert.match(problem, /reviewer_logins, working_dir, worktree, commit_command, push_command/);
});

test("a value of the wrong shape is a problem with its key's line", () => {
  const cases = [
    [["reviewer_logins: github-actions"], /^line 1: `reviewer_logins`: expected a list/],
    [["reviewer_logins: []"], /^line 1: `reviewer_logins`: expected a non-empty list/],
    [["reviewer_logins: ['has space']"], /^line 1: `reviewer_logins`: .*login/],
    [["working_dir: [a]"], /^line 1: `working_dir`: expected a path/],
    [["working_dir: /abs/path"], /^line 1: `working_dir`: .*relative/],
    [["working_dir: ../outside"], /^line 1: `working_dir`: .*inside the repository/],
    [["worktree: yes"], /^line 1: `worktree`: expected true or false/],
    [["commit_command: [git, commit]"], /^line 1: `commit_command`: expected a string/],
    [["commit_command: git commit"], /^line 1: `commit_command`: .*\{message_file\}/],
    [["push_command: git push"], /^line 1: `push_command`: .*\{branch\}/],
    [["", "", "push_command: git push --force origin HEAD:{branch}"], /^line 3: .*force/],
    [["push_command: git push -f origin HEAD:{branch}"], /^line 1: .*force/],
  ];
  for (const [lines, expected] of cases)
    assert.match(printed(yaml(...lines)).join("\n"), expected, lines.join(" ⏎ "));
});

test("JSON problems carry their line too", () => {
  const broken = printed(parseConfigJson('{\n  "worktree": true,\n}'));
  assert.match(broken[0], /^line 3: not valid JSON/);
  assert.match(printed(parseConfigJson("[1]"))[0], /^line 1: the config must be a JSON object/);
  const text = '{\n  "worktree": "no",\n  "reviewer": ["x"]\n}';
  assert.deepEqual(
    printed(parseConfigJson(text)).map((p) => p.slice(0, 7)),
    ["line 2:", "line 3:"],
  );
  assert.match(printed(parseConfigJson(text))[0], /`worktree`: expected true or false/);
  assert.match(printed(parseConfigJson(text))[1], /unknown key `reviewer`/);
});

test("a config with problems keeps the defaults for the keys it got wrong", () => {
  const found = readConfig(only({ [ADAPTER_FILES[0]]: "worktree: maybe\nworking_dir: x" }));
  assert.equal(found.problems.length, 1);
  assert.equal(found.config.worktree, DEFAULTS.worktree);
  assert.equal(found.config.working_dir, "x");
});

// ── The command ─────────────────────────────────────────────────────────────

const repos = [];
after(() => repos.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function repoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), "address-pr-review-adapter-"));
  repos.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const check = (repo) =>
  spawnSync(process.execPath, [join(HERE, "adapter.mjs"), "check", "--repo", repo], {
    encoding: "utf8",
  });

test("`adapter.mjs check` prints the effective config, or each problem and exit 1", () => {
  const none = check(repoWith({}));
  assert.equal(none.status, 0, none.stderr);
  assert.deepEqual(JSON.parse(none.stdout), { path: null, config: DEFAULTS });

  const bad = check(repoWith({ "address-pr-review.config.yml": "worktree: true\nworktre: x\n" }));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /address-pr-review\.config\.yml line 2: unknown key `worktre`/);

  const usage = spawnSync(process.execPath, [join(HERE, "adapter.mjs")], { encoding: "utf8" });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /usage: adapter\.mjs check/);
});

test("ADAPTER.md's YAML and JSON examples read with no problems, and agree", () => {
  const page = readFileSync(join(HERE, "ADAPTER.md"), "utf8").replace(/\r\n/g, "\n");
  const block = (lang) => new RegExp("```" + lang + "\\n([\\s\\S]*?)```").exec(page)[1];
  const fromYaml = parseConfigYaml(block("yaml"));
  const fromJson = parseConfigJson(block("json"));
  assert.deepEqual(fromYaml.problems, []);
  assert.deepEqual(fromJson.problems, []);
  assert.deepEqual(fromYaml.config, fromJson.config);
  assert.deepEqual(Object.keys(fromJson.config), Object.keys(DEFAULTS));
});

test("push_command may not force-push, delete or mirror, however it is spelled", () => {
  const refused = [
    "git push -vf origin HEAD:{branch}",
    "git push --force-w origin HEAD:{branch}",
    "git push --force-with-lease=x origin HEAD:{branch}",
    'git push origin "+HEAD:refs/heads/{branch}"',
    "git push origin '+HEAD:{branch}'",
    "git push origin :refs/heads/{branch}",
    "git push --delete origin {branch}",
    "git push --del origin {branch}",
    "git push -d origin {branch}",
    "git push --mirror origin # {branch}",
    "git push --prune origin HEAD:{branch}",
  ];
  for (const command of refused)
    assert.match(
      printed(parseConfigJson(JSON.stringify({ push_command: command }))).join("\n"),
      /`push_command`: must never force-push, delete or mirror/,
      command,
    );
  for (const command of [
    "git push origin HEAD:refs/heads/{branch}",
    "git push --follow-tags -v origin HEAD:{branch}",
    "npm run push -- --branch {branch}",
  ])
    assert.deepEqual(
      parseConfigJson(JSON.stringify({ push_command: command })).problems,
      [],
      command,
    );
});

test("a flow list reports an empty item, and keeps a quoted comma inside its item", () => {
  assert.match(printed(yaml("reviewer_logins: [a, , b]"))[0], /^line 1: an empty list item/);
  assert.match(printed(yaml("reviewer_logins: [a, b,]"))[0], /^line 1: an empty list item/);
  assert.deepEqual(yaml("reviewer_logins: []").problems, [
    { line: 1, message: "`reviewer_logins`: expected a non-empty list of logins" },
  ]);
  const quoted = yaml("reviewer_logins: ['a, b', c]");
  assert.deepEqual(quoted.config.reviewer_logins, ["a, b", "c"]);
  assert.match(printed(quoted)[0], /`a, b` is not a GitHub login/);
});

test("a JSON problem is on the line of its key, not of an earlier value that names it", () => {
  const text = '{\n  "working_dir": "worktree",\n  "worktree": "no"\n}';
  assert.match(printed(parseConfigJson(text))[0], /^line 3: `worktree`: expected true or false/);
});
