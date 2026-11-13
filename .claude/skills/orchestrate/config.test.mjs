/**
 * Contract suite for the orchestrate config reader. The claims under test:
 * the lookup order, each key's default, every documented spelling reads in
 * both dialects, and every key or shape outside CONFIG.md is a named problem
 * with its line, in YAML and in JSON, and a non-zero exit, never a silent
 * default.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CONFIG_FILES,
  DEFAULTS,
  TRIAGE_ROLES,
  effectiveConfig,
  jsonLines,
  main,
  mergeAnswers,
  parseConfig,
  readConfig,
  readiness,
} from "./config.mjs";

const yaml = (...lines) => parseConfig("orchestrate.config.yml", lines.join("\n"));
const json = (text) => parseConfig("orchestrate.config.json", text);
const reader = (files) => (path) => (Object.hasOwn(files, path) ? files[path] : null);

/** A fenced block of CONFIG.md, which ships beside this suite: the examples a reader copies. */
const CONFIG_MD = readFileSync(new URL("./CONFIG.md", import.meta.url), "utf8");
const configBlock = (lang, n = 0) => {
  const fence = "```";
  const blocks = CONFIG_MD.split(
    `
${fence}${lang}
`,
  ).slice(1);
  return blocks[n].split(`
${fence}`)[0];
};

const EXAMPLE = {
  run_dir: "tmp/orchestrate",
  read_first: ["AGENTS.md", "CONTRIBUTING.md", "GLOSSARY.md"],
  routes: {
    commit: "Conventional Commits, one logical change each: git commit",
    pull_request: "gh pr create --draft --fill, body ends with Closes #<n>",
    merge: "gh pr merge <n> --merge",
  },
  regate: ["uv run pytest", "npm test"],
  skills: { implement: "tdd", triage: "triage", review: "code-review" },
  triage_labels: "docs/agents/triage-labels.md",
  models: { analysis: "claude-sonnet-5-5", build: "claude-opus-5-5", review: "claude-opus-5-5" },
  limits: { building: "3", shared: ["database migrations", "port 5432"] },
  decisions: { to: "pull-request" },
  ready_to_merge: { review: "settled", qa: "report", qa_labels: ["ui"] },
  spec: { landing: "integration-branch", integration_branch: "orchestrate/spec-<n>" },
};

// ── Lookup order ────────────────────────────────────────────────────────────

test("the lookup order is yml, then yaml, then json", () => {
  assert.deepEqual(CONFIG_FILES, [
    "orchestrate.config.yml",
    "orchestrate.config.yaml",
    "orchestrate.config.json",
  ]);
});

test("the first file present wins, and the others are not read or merged", () => {
  const files = {
    "orchestrate.config.yaml": "run_dir: from-yaml\n",
    "orchestrate.config.json": '{"run_dir": "from-json", "regate": ["npm test"]}',
  };
  const read = readConfig(reader(files));
  assert.equal(read.path, "orchestrate.config.yaml");
  assert.deepEqual(read.config, { run_dir: "from-yaml" });
  assert.equal(effectiveConfig(read.config).regate, null);

  files["orchestrate.config.yml"] = "run_dir: from-yml\n";
  assert.equal(readConfig(reader(files)).path, "orchestrate.config.yml");
  delete files["orchestrate.config.yml"];
  delete files["orchestrate.config.yaml"];
  assert.equal(readConfig(reader(files)).path, "orchestrate.config.json");
});

test("no config file is not a problem: the run asks for what it needs", () => {
  const read = readConfig(reader({}));
  assert.deepEqual(read, { path: null, config: {}, problems: [], answers: null });
  const ready = readiness(read);
  assert.equal(ready.ready, false);
  assert.deepEqual(
    ready.needs.map((need) => need.split(":")[0]),
    ["read_first", "routes.commit", "routes.pull_request", "regate"],
  );
  assert.match(ready.notes[0], /^no orchestrate\.config\.yml/);
});

// ── Both dialects ───────────────────────────────────────────────────────────

test("CONFIG.md's example reads with no problems, the same in YAML and JSON", () => {
  const fromYaml = parseConfig("orchestrate.config.yml", configBlock("yaml"));
  assert.deepEqual(fromYaml.problems, []);
  assert.deepEqual(fromYaml.config, EXAMPLE);
  const fromJson = json(JSON.stringify(EXAMPLE, null, 2));
  assert.deepEqual(fromJson.problems, []);
  assert.deepEqual(effectiveConfig(fromJson.config), effectiveConfig(fromYaml.config));
});

test("a JSON number and a YAML string read the same for limits.building", () => {
  const fromJson = json('{"limits": {"building": 2}}');
  const fromYaml = yaml("limits:", "  building: 2");
  assert.deepEqual([fromJson.problems, fromYaml.problems], [[], []]);
  assert.equal(effectiveConfig(fromJson.config).limits.building, 2);
  assert.equal(effectiveConfig(fromYaml.config).limits.building, 2);
});

test("a byte-order mark is read past in both dialects", () => {
  assert.deepEqual(yaml("﻿run_dir: tmp/o").problems, []);
  assert.deepEqual(json('﻿{"run_dir": "tmp/o"}').problems, []);
});

// ── Defaults ────────────────────────────────────────────────────────────────

test("each key's default, with an empty config", () => {
  assert.deepEqual(effectiveConfig({}), {
    run_dir: "tmp/orchestrate",
    read_first: null,
    routes: { commit: null, pull_request: null, merge: null },
    regate: null,
    skills: { implement: null, triage: null, review: null },
    triage_labels: {
      from: "default",
      document: null,
      labels: Object.fromEntries(TRIAGE_ROLES.map((role) => [role, role])),
    },
    models: { analysis: null, build: null, review: null },
    limits: { building: 3, shared: [] },
    decisions: { to: "pull-request", marker: null },
    ready_to_merge: { review: "settled", qa: "none", qa_labels: [] },
    spec: { landing: "ask", integration_branch: "orchestrate/spec-<n>" },
  });
  assert.equal(DEFAULTS.run_dir, "tmp/orchestrate");
});

test("an empty mapping takes its section's defaults, and an empty list is a value", () => {
  const read = yaml("routes: {}", "limits: {}", "read_first: []", "regate: []");
  assert.deepEqual(read.problems, []);
  const effective = effectiveConfig(read.config);
  assert.deepEqual(effective.routes, { commit: null, pull_request: null, merge: null });
  assert.deepEqual(effective.limits, { building: 3, shared: [] });
  assert.deepEqual(effective.read_first, []);
  assert.deepEqual(effective.regate, []);
});

test("the five triage roles are the canonical ones, in order", () => {
  assert.deepEqual(TRIAGE_ROLES, [
    "needs-triage",
    "needs-info",
    "ready-for-agent",
    "ready-for-human",
    "wontfix",
  ]);
});

test("a partial triage mapping keeps each unnamed role's own name", () => {
  const read = yaml("triage_labels:", "  ready-for-agent: agent-ready", "  wontfix: declined");
  assert.deepEqual(read.problems, []);
  assert.deepEqual(effectiveConfig(read.config).triage_labels, {
    from: "config",
    document: null,
    labels: {
      "needs-triage": "needs-triage",
      "needs-info": "needs-info",
      "ready-for-agent": "agent-ready",
      "ready-for-human": "ready-for-human",
      wontfix: "declined",
    },
  });
});

test("a triage mapping document is named, not read by the reader", () => {
  const read = yaml("triage_labels: docs/agents/triage-labels.md");
  assert.deepEqual(effectiveConfig(read.config).triage_labels, {
    from: "document",
    document: "docs/agents/triage-labels.md",
    labels: null,
  });
});

// ── Readiness ───────────────────────────────────────────────────────────────

test("a complete config is ready, and says each unset optional key", () => {
  const read = readConfig(
    reader({
      "orchestrate.config.yml": [
        "read_first: []",
        "routes: { commit: git commit, pull_request: gh pr create }",
        "regate: []",
      ].join("\n"),
    }),
  );
  const ready = readiness(read);
  assert.deepEqual(ready.needs, []);
  assert.equal(ready.ready, true);
  for (const key of [
    "skills.implement",
    "skills.triage",
    "skills.review",
    "models.analysis",
    "models.build",
    "models.review",
    "triage_labels",
  ])
    assert.ok(
      ready.notes.some((note) => note.includes(`\`${key}\``)),
      `${key} is noted: ${ready.notes.join(" | ")}`,
    );
  assert.ok(ready.notes.some((note) => note.startsWith("no re-gate commands")));
});

test("a config with problems is never ready", () => {
  const read = readConfig(reader({ "orchestrate.config.yml": "routs: {}\n" }));
  assert.deepEqual(readiness(read), {
    ready: false,
    needs: ["a config with no problems: fix each one listed"],
    notes: [],
  });
});

test("the spec keys read the same in YAML and JSON, and either landing is a value", () => {
  for (const landing of ["ask", "integration-branch", "per-ticket"]) {
    const fromYaml = yaml("spec:", `  landing: ${landing}`, "  integration_branch: run/spec-<n>");
    const fromJson = json(
      JSON.stringify({ spec: { landing, integration_branch: "run/spec-<n>" } }, null, 2),
    );
    assert.deepEqual([fromYaml.problems, fromJson.problems], [[], []]);
    assert.deepEqual(effectiveConfig(fromYaml.config).spec, {
      landing,
      integration_branch: "run/spec-<n>",
    });
    assert.deepEqual(effectiveConfig(fromJson.config).spec, effectiveConfig(fromYaml.config).spec);
  }
});

test("an empty spec mapping takes each spec default, and a pattern may repeat `<n>`", () => {
  assert.deepEqual(effectiveConfig(yaml("spec: {}").config).spec, {
    landing: "ask",
    integration_branch: "orchestrate/spec-<n>",
  });
  assert.deepEqual(
    [DEFAULTS.landing, DEFAULTS.integration_branch],
    ["ask", "orchestrate/spec-<n>"],
  );
  assert.deepEqual(yaml("spec: { integration_branch: spec-<n>/integration-<n> }").problems, []);
});

test("the spec keys add nothing the readiness check asks for", () => {
  const read = readConfig(
    reader({
      "orchestrate.config.yml": [
        "read_first: []",
        "routes: { commit: git commit, pull_request: gh pr create }",
        "regate: []",
      ].join("\n"),
    }),
  );
  assert.equal(readiness(read).ready, true);
  assert.ok(!readiness(read).notes.some((note) => note.includes("spec")));
});

// ── Problems, YAML ──────────────────────────────────────────────────────────

/** Each case: the YAML lines, and the one problem they must raise. */
const YAML_PROBLEMS = [
  ["an unknown top-level key", ["run_dir: tmp/o", "routs: {}"], /^line 2: `routs`: unknown key/],
  [
    "an unknown nested key",
    ["routes:", "  commit: x", "  push: y"],
    /^line 3: `routes\.push`: unknown key \(CONFIG\.md documents: commit, pull_request, merge\)/,
  ],
  ["a key with no value", ["regate:"], /^line 1: `regate`: no value/],
  ["a nested key with no value", ["routes:", "  commit:"], /^line 2: `routes\.commit`: no value/],
  [
    "run_dir outside the repository",
    ["run_dir: ../elsewhere"],
    /^line 1: `run_dir`: expected a relative path/,
  ],
  ["an absolute run_dir", ["run_dir: /tmp/o"], /^line 1: `run_dir`: expected a relative path/],
  ["read_first not a list", ["read_first: AGENTS.md"], /^line 1: `read_first`: expected a list/],
  [
    "a read_first path leaving the repository",
    ["read_first:", "  - AGENTS.md", "  - ../notes.md"],
    /^line 3: `read_first\[1\]`: expected a relative path inside the repository/,
  ],
  [
    "a read_first path listed twice",
    ["read_first:", "  - AGENTS.md", "  - AGENTS.md"],
    /^line 3: `read_first\[1\]`: `AGENTS\.md` is listed twice/,
  ],
  ["routes not a mapping", ["routes: git commit"], /^line 1: `routes`: expected a mapping/],
  [
    "an empty route",
    ["routes:", '  commit: ""'],
    /^line 2: `routes\.commit`: expected a non-empty string/,
  ],
  [
    "a route that is a list",
    ["routes:", "  pull_request: [gh, pr]"],
    /^line 2: `routes\.pull_request`: expected a non-empty string/,
  ],
  ["regate not a list", ["regate: npm test"], /^line 1: `regate`: expected a list of commands/],
  [
    "a regate entry that is not a command",
    ["regate:", "  - { run: npm test }"],
    /^line 2: `regate\[0\]`: expected a command/,
  ],
  [
    "a regate command listed twice",
    ["regate: [npm test, npm test]"],
    /^line 1: `regate\[1\]`: `npm test` is listed twice/,
  ],
  ["an unknown skill kind", ["skills:", "  plan: x"], /^line 2: `skills\.plan`: unknown key/],
  [
    "triage_labels neither a path nor a mapping",
    ["triage_labels: [a, b]"],
    /^line 1: `triage_labels`: expected the path of the repository's own mapping/,
  ],
  [
    "triage_labels as a path outside the repository",
    ["triage_labels: /etc/labels.md"],
    /^line 1: `triage_labels`: expected a relative path/,
  ],
  [
    "a triage role that is not one of the five",
    ["triage_labels:", "  blocked: on-hold"],
    /^line 2: `triage_labels\.blocked`: unknown key \(CONFIG\.md documents: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix\)/,
  ],
  [
    "two triage roles sharing a label",
    ["triage_labels:", "  needs-triage: triage", "  needs-info: triage"],
    /^line 3: `triage_labels\.needs-info`: `triage` is also the label for `needs-triage`/,
  ],
  [
    "a triage role with an empty label",
    ["triage_labels:", '  wontfix: ""'],
    /^line 2: `triage_labels\.wontfix`: expected a label name/,
  ],
  ["an unknown model kind", ["models:", "  qa: x"], /^line 2: `models\.qa`: unknown key/],
  ["models not a mapping", ["models: opus"], /^line 1: `models`: expected a mapping/],
  ["limits not a mapping", ["limits: 3"], /^line 1: `limits`: expected a mapping/],
  [
    "a zero building limit",
    ["limits:", "  building: 0"],
    /^line 2: `limits\.building`: expected a whole number/,
  ],
  [
    "a fractional building limit",
    ["limits:", "  building: 1.5"],
    /^line 2: `limits\.building`: expected a whole number/,
  ],
  [
    "a word for the building limit",
    ["limits:", "  building: three"],
    /^line 2: `limits\.building`: expected a whole number/,
  ],
  ["an unknown limit", ["limits:", "  reviewing: 2"], /^line 2: `limits\.reviewing`: unknown key/],
  [
    "shared not a list",
    ["limits:", "  shared: database"],
    /^line 2: `limits\.shared`: expected a list of resource names/,
  ],
  [
    "a shared resource listed twice",
    ["limits:", "  shared: [db, db]"],
    /^line 2: `limits\.shared\[1\]`: `db` is listed twice/,
  ],
  [
    "an unknown decision target",
    ["decisions:", "  to: wiki"],
    /^line 2: `decisions\.to`: expected one of: pull-request, issue-comment/,
  ],
  [
    "an empty decision marker",
    ["decisions:", '  marker: ""'],
    /^line 2: `decisions\.marker`: expected a non-empty string/,
  ],
  [
    "decisions not a mapping",
    ["decisions: pull-request"],
    /^line 1: `decisions`: expected a mapping/,
  ],
  [
    "an unknown review rule",
    ["ready_to_merge:", "  review: lgtm"],
    /^line 2: `ready_to_merge\.review`: expected one of: settled, approved/,
  ],
  [
    "an unknown QA rule",
    ["ready_to_merge:", "  qa: always"],
    /^line 2: `ready_to_merge\.qa`: expected one of: none, report/,
  ],
  [
    "qa_labels without qa: report",
    ["ready_to_merge:", "  qa_labels: [ui]"],
    /^line 2: `ready_to_merge\.qa_labels`: only `qa: report` is limited to labels/,
  ],
  [
    "qa_labels not a list",
    ["ready_to_merge:", "  qa: report", "  qa_labels: ui"],
    /^line 3: `ready_to_merge\.qa_labels`: expected a list of label names/,
  ],
  [
    "an unknown Ready to Merge key",
    ["ready_to_merge:", "  ci: green"],
    /^line 2: `ready_to_merge\.ci`: unknown key/,
  ],
  // The YAML subset's own limits.
  ["a tab", ["routes:", "\tcommit: x"], /^line 2: indented with a tab/],
  ["a duplicate key", ["run_dir: a", "run_dir: b"], /^line 2: duplicate key `run_dir`/],
  [
    "an anchor",
    ["run_dir: &dir tmp/o"],
    /^line 1: `&` \(anchor or alias\) is outside the YAML subset CONFIG\.md documents/,
  ],
  [
    "a multi-line scalar",
    ["routes:", "  commit: |"],
    /^line 2: multi-line scalars are outside the YAML subset/,
  ],
  [
    "an escape inside double quotes",
    ['run_dir: "tmp\\\\o"'],
    /^line 1: escapes inside "…" are outside the YAML subset/,
  ],
  [
    "a flow list that spans lines",
    ["regate: [npm test,", "  uv run pytest]"],
    /^line 1: a flow list must close on the same line/,
  ],
  ["a list at the top", ["- run_dir: tmp/o"], /^line 1: the config must be a mapping, not a list/],
  [
    "a `: ` inside an unquoted value",
    ["routes:", "  commit: Conventional Commits: git commit"],
    /^line 2: a `: ` inside an unquoted value is outside the YAML subset/,
  ],
  [
    "a `: ` inside an unquoted value in a flow mapping",
    ["skills: { implement: tdd: x }"],
    /^line 1: a `: ` inside an unquoted value is outside the YAML subset/,
  ],
  [
    "a `: ` inside an unquoted item in a flow list",
    ["regate: [npm run lint: fix]"],
    /^line 1: a `: ` inside an unquoted value is outside the YAML subset/,
  ],
  [
    "a list item that is only a comment",
    ["regate:", "  - # npm test (disabled)"],
    /^line 2: `regate\[0\]`: expected a command/,
  ],
  [
    "a comment inside a flow mapping",
    ["skills: { implement: tdd # note }"],
    /^line 1: a `#` comment inside a flow collection is outside the YAML subset/,
  ],
  ["an alias", ["run_dir: *dir"], /^line 1: `\*` \(anchor or alias\) is outside the YAML subset/],
  ["an unterminated quote", ["run_dir: 'tmp/o"], /^line 1: unterminated ' quote/],
  [
    "text after a quoted value",
    ['run_dir: "tmp/o" extra'],
    /^line 1: unexpected text after the value: extra/,
  ],
  [
    "an empty item in a flow list",
    ["regate: [npm test, , x]"],
    /^line 1: an empty value inside a flow collection/,
  ],
  [
    "a first key not at column 1",
    ["  run_dir: tmp/o"],
    /^line 1: the first key must start at column 1/,
  ],
  [
    "a flow mapping that spans lines",
    ["routes: { commit: x,", "  merge: y }"],
    /^line 1: a flow mapping must close on the same line/,
  ],
  [
    "run_dir as the repository root",
    ["run_dir: ."],
    /^line 1: `run_dir`: expected a relative path/,
  ],
  ["a drive-relative run_dir", ["run_dir: C:runs"], /^line 1: `run_dir`: expected a relative path/],
  [
    "a building limit too large to be a count",
    ["limits:", "  building: 99999999999999999999999"],
    /^line 2: `limits\.building`: expected a whole number/,
  ],
  [
    "a `__proto__` key at the top",
    ["__proto__:", "  run_dir: /etc"],
    /^line 1: `__proto__`: unknown key/,
  ],
  [
    "a `__proto__` key in a block mapping",
    ["routes:", "  __proto__: x"],
    /^line 2: `routes\.__proto__`: unknown key/,
  ],
  [
    "a `__proto__` key in a flow mapping",
    ["routes: { __proto__: x, commit: y }"],
    /^line 1: `routes\.__proto__`: unknown key/,
  ],
  ["spec not a mapping", ["spec: per-ticket"], /^line 1: `spec`: expected a mapping/],
  [
    "an unknown landing",
    ["spec:", "  landing: squash"],
    /^line 2: `spec\.landing`: expected one of: ask, integration-branch, per-ticket/,
  ],
  ["a landing with no value", ["spec:", "  landing:"], /^line 2: `spec\.landing`: no value/],
  [
    "an unknown spec key",
    ["spec:", "  base: main"],
    /^line 2: `spec\.base`: unknown key \(CONFIG\.md documents: landing, integration_branch\)/,
  ],
  [
    "an integration branch with no `<n>`",
    ["spec:", "  integration_branch: orchestrate/spec"],
    /^line 2: `spec\.integration_branch`: expected `<n>` in it/,
  ],
  [
    "an integration branch with another placeholder",
    ["spec: { integration_branch: spec/<spec>-<n> }"],
    /^line 1: `spec\.integration_branch`: `<n>` is the only placeholder/,
  ],
  ...[
    "spec <n>",
    "-spec-<n>",
    "spec/<n>.lock",
    "spec//<n>",
    "spec/.<n>",
    "spec..<n>",
    "spec/<n>/",
    "spec/<n>.",
    "spec@{<n>",
    "spec~<n>",
    "spec:<n>",
    "'spec\\<n>'",
  ].map((branch) => [
    `the integration branch ${branch}`,
    ["spec:", `  integration_branch: ${branch}`],
    /^line 2: `spec\.integration_branch`: expected a valid git branch name/,
  ]),
];

for (const [name, lines, expected] of YAML_PROBLEMS)
  test(`YAML: ${name} is a problem, with its line`, () => {
    const { problems } = yaml(...lines);
    assert.ok(
      problems.some((problem) => expected.test(problem)),
      `expected ${expected} in:\n${problems.join("\n")}`,
    );
  });

// ── Problems, JSON ──────────────────────────────────────────────────────────

test("JSON: each problem is named with its line, like YAML's", () => {
  const text = [
    "{",
    '  "run_dir": "tmp/orchestrate",',
    '  "routs": {},',
    '  "routes": {',
    '    "commit": 3,',
    '    "push": "x"',
    "  },",
    '  "read_first": [',
    '    "AGENTS.md",',
    '    "../notes.md"',
    "  ],",
    '  "limits": { "building": 0, "shared": ["db", "db"] },',
    '  "decisions": null,',
    '  "triage_labels": { "blocked": "on-hold" },',
    '  "ready_to_merge": { "qa_labels": ["ui"] }',
    "}",
  ].join("\n");
  assert.deepEqual(json(text).problems, [
    "line 3: `routs`: unknown key (CONFIG.md documents: run_dir, read_first, routes, regate, skills, triage_labels, models, limits, decisions, ready_to_merge, spec)",
    "line 10: `read_first[1]`: expected a relative path inside the repository",
    "line 6: `routes.push`: unknown key (CONFIG.md documents: commit, pull_request, merge)",
    "line 5: `routes.commit`: expected a non-empty string",
    "line 14: `triage_labels.blocked`: unknown key (CONFIG.md documents: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix)",
    "line 12: `limits.building`: expected a whole number of 1 or more",
    "line 12: `limits.shared[1]`: `db` is listed twice",
    "line 13: `decisions`: no value: give one, or delete the key",
    "line 15: `ready_to_merge.qa_labels`: only `qa: report` is limited to labels; set it, or delete this key",
  ]);
});

/**
 * Each shape problem, in JSON: the config object, the key path, and the
 * problem it must raise at the line that key path starts on.
 */
const JSON_PROBLEMS = [
  ["spec not a mapping", { spec: "per-ticket" }, "spec", /expected a mapping/],
  [
    "an unknown landing",
    { spec: { landing: "squash" } },
    "spec.landing",
    /expected one of: ask, integration-branch, per-ticket/,
  ],
  [
    "an integration branch with no `<n>`",
    { spec: { integration_branch: "orchestrate/spec" } },
    "spec.integration_branch",
    /expected `<n>` in it/,
  ],
  [
    "an integration branch that is not a valid branch name",
    { spec: { integration_branch: "spec <n>" } },
    "spec.integration_branch",
    /expected a valid git branch name/,
  ],
  [
    "an integration branch that is not a string",
    { spec: { integration_branch: 3 } },
    "spec.integration_branch",
    /expected a branch name pattern/,
  ],
  ["an unknown spec key", { spec: { base: "main" } }, "spec.base", /unknown key/],
  ["an unknown top-level key", { routs: {} }, "routs", /unknown key/],
  ["an unknown nested key", { routes: { push: "y" } }, "routes.push", /unknown key/],
  ["a key with no value", { regate: null }, "regate", /no value/],
  ["a nested key with no value", { routes: { commit: null } }, "routes.commit", /no value/],
  ["an absolute run_dir", { run_dir: "/tmp/o" }, "run_dir", /expected a relative path/],
  ["run_dir as the repository root", { run_dir: "./" }, "run_dir", /expected a relative path/],
  ["read_first not a list", { read_first: "AGENTS.md" }, "read_first", /expected a list/],
  [
    "a read_first path leaving the repository",
    { read_first: ["a.md", "../b.md"] },
    "read_first[1]",
    /expected a relative path/,
  ],
  [
    "a read_first path listed twice",
    { read_first: ["a.md", "a.md"] },
    "read_first[1]",
    /listed twice/,
  ],
  ["routes not a mapping", { routes: "git commit" }, "routes", /expected a mapping/],
  [
    "a route that is a number",
    { routes: { commit: 3 } },
    "routes.commit",
    /expected a non-empty string/,
  ],
  ["regate not a list", { regate: "npm test" }, "regate", /expected a list of commands/],
  [
    "a regate entry that is not a command",
    { regate: [{ run: "x" }] },
    "regate[0]",
    /expected a command/,
  ],
  ["a regate command listed twice", { regate: ["x", "x"] }, "regate[1]", /listed twice/],
  ["an unknown skill kind", { skills: { plan: "x" } }, "skills.plan", /unknown key/],
  [
    "a skill that is not a string",
    { skills: { review: true } },
    "skills.review",
    /expected a non-empty string/,
  ],
  [
    "triage_labels neither a path nor a mapping",
    { triage_labels: ["a"] },
    "triage_labels",
    /expected the path/,
  ],
  [
    "a triage role that is not one of the five",
    { triage_labels: { blocked: "x" } },
    "triage_labels.blocked",
    /unknown key/,
  ],
  [
    "two triage roles sharing a label",
    { triage_labels: { "needs-triage": "t", "needs-info": "t" } },
    "triage_labels.needs-info",
    /also the label for `needs-triage`/,
  ],
  [
    "a triage role with an empty label",
    { triage_labels: { wontfix: "" } },
    "triage_labels.wontfix",
    /expected a label name/,
  ],
  ["an unknown model kind", { models: { qa: "x" } }, "models.qa", /unknown key/],
  ["models not a mapping", { models: "opus" }, "models", /expected a mapping/],
  ["limits not a mapping", { limits: 3 }, "limits", /expected a mapping/],
  [
    "a zero building limit",
    { limits: { building: 0 } },
    "limits.building",
    /expected a whole number/,
  ],
  [
    "a fractional building limit",
    { limits: { building: 1.5 } },
    "limits.building",
    /expected a whole number/,
  ],
  [
    "a building limit as a word",
    { limits: { building: "three" } },
    "limits.building",
    /expected a whole number/,
  ],
  [
    "a building limit too large to be a count",
    { limits: { building: 1e23 } },
    "limits.building",
    /expected a whole number/,
  ],
  ["an unknown limit", { limits: { reviewing: 2 } }, "limits.reviewing", /unknown key/],
  [
    "shared not a list",
    { limits: { shared: "db" } },
    "limits.shared",
    /expected a list of resource names/,
  ],
  [
    "a shared resource listed twice",
    { limits: { shared: ["db", "db"] } },
    "limits.shared[1]",
    /listed twice/,
  ],
  ["decisions not a mapping", { decisions: "pull-request" }, "decisions", /expected a mapping/],
  [
    "an unknown decision target",
    { decisions: { to: "wiki" } },
    "decisions.to",
    /expected one of: pull-request, issue-comment/,
  ],
  [
    "an empty decision marker",
    { decisions: { marker: "" } },
    "decisions.marker",
    /expected a non-empty string/,
  ],
  [
    "an unknown review rule",
    { ready_to_merge: { review: "lgtm" } },
    "ready_to_merge.review",
    /expected one of: settled, approved/,
  ],
  [
    "an unknown QA rule",
    { ready_to_merge: { qa: "always" } },
    "ready_to_merge.qa",
    /expected one of: none, report/,
  ],
  [
    "qa_labels without qa: report",
    { ready_to_merge: { qa_labels: ["ui"] } },
    "ready_to_merge.qa_labels",
    /only `qa: report`/,
  ],
  [
    "qa_labels not a list",
    { ready_to_merge: { qa: "report", qa_labels: "ui" } },
    "ready_to_merge.qa_labels",
    /expected a list of label names/,
  ],
  [
    "an unknown Ready to Merge key",
    { ready_to_merge: { ci: "green" } },
    "ready_to_merge.ci",
    /unknown key/,
  ],
  [
    "a `__proto__` key",
    JSON.parse('{"__proto__": {"run_dir": "/etc"}}'),
    "__proto__",
    /unknown key/,
  ],
];

for (const [name, config, path, expected] of JSON_PROBLEMS)
  test(`JSON: ${name} is a problem, with its line`, () => {
    // Pretty-printed, so each key path starts on a line of its own.
    const text = JSON.stringify({ run_dir: "tmp/o", ...config }, null, 2);
    const line = jsonLines(text).lines.get(path);
    assert.ok(line > 1, `${path} has a line of its own`);
    const { problems } = json(text);
    const found = problems.find((problem) => problem.startsWith(`line ${line}: \`${path}\`: `));
    assert.ok(
      found && expected.test(found),
      `expected line ${line} \`${path}\` ${expected} in:\n${problems.join("\n")}`,
    );
  });

test("JSON: a duplicate key is a problem, not the last value silently kept", () => {
  assert.deepEqual(json('{\n  "run_dir": "a",\n  "run_dir": "b"\n}').problems, [
    "line 3: `run_dir`: duplicate key",
  ]);
});

test("JSON: a file that does not parse, or is not an object, is a problem", () => {
  assert.match(json("{ run_dir: x }").problems[0], /^not valid JSON: /);
  assert.deepEqual(json("[]").problems, ["the config must be a JSON object"]);
  assert.deepEqual(json('"tmp"').problems, ["the config must be a JSON object"]);
});

test("JSON: lines are found past strings holding brackets, commas and escapes", () => {
  const { lines, problems } = jsonLines(
    '{\n  "a": "x, ] } \\" [",\n  "b": [\n    1,\n    { "c": true }\n  ]\n}',
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(Object.fromEntries(lines), { a: 2, b: 3, "b[0]": 4, "b[1]": 5, "b[1].c": 5 });
});

// ── Paths that must be there ────────────────────────────────────────────────

test("a read_first document or a triage mapping document that is not there is a problem", () => {
  const files = {
    "orchestrate.config.yml": [
      "read_first:",
      "  - AGENTS.md",
      "  - docs/missing.md",
      "triage_labels: docs/labels.md",
    ].join("\n"),
  };
  const read = readConfig(reader(files), { exists: (path) => path === "AGENTS.md" });
  assert.deepEqual(read.problems, [
    "line 3: `read_first[1]`: `docs/missing.md` is not in the repository",
    "line 4: `triage_labels`: `docs/labels.md` is not in the repository",
  ]);
});

// ── Answers given in chat ───────────────────────────────────────────────────

test("answers are laid over the config, a mapping key by key", () => {
  assert.deepEqual(
    mergeAnswers(
      { routes: { commit: "a", merge: "m" }, regate: ["x"] },
      { routes: { commit: "b", pull_request: "p" }, regate: [] },
    ),
    { routes: { commit: "b", merge: "m", pull_request: "p" }, regate: [] },
  );
});

test("an answer's problem is named in the answers file, at its line", () => {
  const files = {
    "orchestrate.config.yml": "routes:\n  commit: git commit\n  merge: x\n",
  };
  const answers = {
    path: "tmp/orchestrate/answers.json",
    text: '{\n  "routes": {\n    "merge": 3\n  }\n}',
  };
  const read = readConfig(reader(files), { answers });
  assert.deepEqual(read.problems, [
    "tmp/orchestrate/answers.json line 3: `routes.merge`: expected a non-empty string",
  ]);
  assert.equal(read.answers, "tmp/orchestrate/answers.json");
});

test("CONFIG.md's triage mapping and answers examples read with no problems", () => {
  const mapping = parseConfig("orchestrate.config.yml", configBlock("yaml", 1));
  assert.deepEqual(mapping.problems, []);
  assert.equal(
    effectiveConfig(mapping.config).triage_labels.labels["ready-for-agent"],
    "agent-ready",
  );
  const answers = { path: "tmp/orchestrate/r/answers.json", text: configBlock("json") };
  const read = readConfig(reader({}), { answers });
  assert.deepEqual(read.problems, []);
  assert.equal(readiness(read).ready, true);
});

test("a problem in a config value no answer touched keeps the config's line", () => {
  const files = {
    "orchestrate.config.yml":
      "read_first: []\nregate: []\nroutes: { commit: x, pull_request: '' }\n",
  };
  const answers = {
    path: "tmp/orchestrate/answers.json",
    text: '{\n  "routes": {\n    "commit": "y"\n  }\n}',
  };
  assert.deepEqual(readConfig(reader(files), { answers }).problems, [
    "line 3: `routes.pull_request`: expected a non-empty string",
  ]);
});

test("an answers file that is not an object says so, and a `__proto__` answer is a problem", () => {
  const notObject = readConfig(reader({}), { answers: { path: "a.json", text: "[]" } });
  assert.deepEqual(notObject.problems, ["a.json: the answers must be a JSON object"]);
  const proto = readConfig(reader({}), {
    answers: { path: "a.json", text: '{\n  "__proto__": { "run_dir": "/abs" }\n}' },
  });
  assert.equal(proto.problems.length, 1);
  assert.match(proto.problems[0], /^a\.json line 2: `__proto__`: unknown key/);
});

// ── CLI ─────────────────────────────────────────────────────────────────────

const run = (argv, files, exists = () => true) =>
  main(argv, { read: reader(files), exists, cwd: "/repo" });

test("check exits 0 and prints the effective values and readiness", () => {
  const { code, out } = run(["check"], {
    "orchestrate.config.yml":
      "read_first: []\nroutes: { commit: c, pull_request: p }\nregate: []\n",
  });
  assert.equal(code, 0);
  const result = JSON.parse(out);
  assert.equal(result.path, "orchestrate.config.yml");
  assert.deepEqual(result.problems, []);
  assert.equal(result.effective.routes.commit, "c");
  assert.equal(result.readiness.ready, true);
});

test("check exits 1 on any problem, in either dialect, and prints no effective values", () => {
  for (const files of [
    { "orchestrate.config.yml": "routes:\n  comit: x\n" },
    { "orchestrate.config.json": '{\n  "routes": {\n    "comit": "x"\n  }\n}' },
  ]) {
    const { code, out } = run(["check"], files);
    assert.equal(code, 1);
    const result = JSON.parse(out);
    assert.equal(result.effective, null);
    assert.match(result.problems[0], /^line \d: `routes\.comit`: unknown key/);
  }
});

test("check exits 0 with no config file, and readiness asks", () => {
  const { code, out } = run(["check"], {});
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).readiness.ready, false);
});

test("check --answers merges a file from inside the run folder", () => {
  const files = {
    "tmp/orchestrate/answers.json": JSON.stringify({
      read_first: [],
      routes: { commit: "c", pull_request: "p" },
      regate: ["npm test"],
    }),
  };
  const { code, out } = run(["check", "--answers", "tmp/orchestrate/answers.json"], files);
  assert.equal(code, 0);
  const result = JSON.parse(out);
  assert.equal(result.answers, "tmp/orchestrate/answers.json");
  assert.deepEqual(result.effective.regate, ["npm test"]);
  assert.equal(result.readiness.ready, true);
});

test("check --answers refuses a file outside the run folder, or no file", () => {
  const outside = run(["check", "--answers", "answers.json"], { "answers.json": "{}" });
  assert.equal(outside.code, 2);
  assert.match(outside.out, /must be inside the run folder `tmp\/orchestrate`/);
  const missing = run(["check", "--answers", "tmp/orchestrate/a.json"], {});
  assert.equal(missing.code, 2);
  assert.match(missing.out, /no answers file/);
});

test("an answer that moves the run folder moves where the answers file must be", () => {
  const files = { "runs/answers.json": '{"run_dir": "runs"}' };
  assert.equal(run(["check", "--answers", "runs/answers.json"], files).code, 0);
});

test("a config file that is there but cannot be read is a problem, not a missing file", () => {
  const read = (path) => {
    if (path === "orchestrate.config.yml")
      throw Object.assign(new Error("is a directory"), { code: "EISDIR" });
    return path === "orchestrate.config.json" ? '{"run_dir": "elsewhere"}' : null;
  };
  const loaded = readConfig(read);
  assert.equal(loaded.path, "orchestrate.config.yml");
  assert.deepEqual(loaded.problems, ["orchestrate.config.yml cannot be read (EISDIR)"]);
  assert.equal(main(["check"], { read, exists: () => true, cwd: "/repo" }).code, 1);
});

test("an answers file whose name starts with `..` is inside the run folder", () => {
  const files = { "tmp/orchestrate/..answers.json": "{}" };
  assert.equal(run(["check", "--answers", "tmp/orchestrate/..answers.json"], files).code, 0);
});

test("bad usage exits 2", () => {
  for (const argv of [
    [],
    ["status"],
    ["check", "--answers"],
    ["check", "--bogus", "x"],
    ["check", "--repo", "a", "--repo", "b"],
  ])
    assert.equal(run(argv, {}).code, 2, argv.join(" "));
});
