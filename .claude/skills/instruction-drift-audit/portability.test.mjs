/**
 * The skill is portable (DESIGN.md, Boundary): this folder, copied alone into
 * any repository, is the whole skill. This suite proves it, and it is the
 * suite that fails first when a change ties the skill to the repository it
 * happens to live in.
 *
 *   1. STATIC. No shipped file (fixtures and tests aside) names a host's
 *      decision log, script tree, or package scripts. That no script imports,
 *      and no document links, anything outside this folder is checked for
 *      every User-scope skill by Agent-kit's skill-portability contract test.
 *   2. COPIED. The folder is copied, alone, into an empty temporary
 *      repository at `.agents/skills/instruction-drift-audit/` — a different layout
 *      from the one it lives in here — and its own suites run there.
 *   3. SMOKE. Every command runs in that repository, with a minimal adapter
 *      and install tree, and prints what it should.
 *   4. OUTSIDE. The folder is copied into a skills directory outside every
 *      repository, as a User-scope install puts it, and the commands (step
 *      8's delta snippet, read from SKILL.md, among them) run from the
 *      repository's root with `<skill>` the folder's absolute path.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = "portability.test.mjs";

const shipped = readdirSync(HERE, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
const read = (name) => readFileSync(join(HERE, name), "utf8");

// ── 1. Static ───────────────────────────────────────────────────────────────

/** What only the repository this folder came from would understand. */
const HOST_ONLY = [
  [/\bADR \d{4}\b/, "a host's decision record (cite DESIGN.md instead)"],
  [/docs\/adr\//, "a host's decision-record directory"],
  [/tools\/scripts\//, "a host's script tree"],
  [/\byarn [a-z]+:[a-z:]+/, "a host's package script"],
];

test("no shipped file names something only its current host has", () => {
  for (const name of shipped) {
    if (name.endsWith(".test.mjs")) continue;
    const text = read(name);
    for (const [pattern, what] of HOST_ONLY)
      assert.doesNotMatch(text, pattern, `${name} names ${what}`);
  }
});

// ── 2 and 3. Copied, and run ────────────────────────────────────────────────

let repo;
let skill;

before(() => {
  repo = mkdtempSync(join(tmpdir(), "instruction-drift-audit-portable-"));
  skill = join(repo, ".agents", "skills", "instruction-drift-audit");
  mkdirSync(dirname(skill), { recursive: true });
  cpSync(HERE, skill, { recursive: true });

  writeFileSync(
    join(repo, "instruction-drift-audit.config.yml"),
    ["ecosystems:", "  - lead: nx", "brief_dir: docs/briefs", ""].join("\n"),
  );
  writeFileSync(join(repo, "package.json"), JSON.stringify({ devDependencies: { nx: "22.7.7" } }));
  for (const [name, version] of [
    ["nx", "22.7.7"],
    ["@nx/js", "22.7.7"],
  ]) {
    const dir = join(repo, "node_modules", ...name.split("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version }));
  }
  spawnSync("git", ["init", "--quiet"], { cwd: repo });
});

after(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

const run = (file, args = []) =>
  spawnSync(process.execPath, [join(skill, file), ...args], {
    cwd: repo,
    encoding: "utf8",
  });

test("the copied folder passes its own suites", () => {
  const suites = readdirSync(skill).filter((name) => name.endsWith(".test.mjs") && name !== SELF);
  const result = spawnSync(
    process.execPath,
    ["--test", ...suites.map((name) => join(skill, name))],
    // Under a test runner, an inherited NODE_TEST_CONTEXT makes the child report to
    // its parent and exit 0 even when its tests fail.
    { cwd: repo, encoding: "utf8", env: { ...process.env, NODE_TEST_CONTEXT: undefined } },
  );
  assert.equal(result.status, 0, result.stdout.slice(-2000) + result.stderr);
});

test("resolve-baseline reads the adapter and the install tree of its new home", () => {
  const result = run("resolve-baseline.mjs");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /nx — Baseline 22\.7\.7, 2 member\(s\): @nx\/js, nx/);
});

test("resolve-ledger, check-reports, and suggest-run run with no brief yet", () => {
  const ledger = run("resolve-ledger.mjs");
  assert.equal(ledger.status, 0, ledger.stderr);
  assert.match(ledger.stdout, /first run at Baseline 22\.7\.7 researches everything/);

  const gate = run("check-reports.mjs", ["--print"]);
  assert.equal(gate.status, 0, gate.stderr);
  assert.match(gate.stdout, /brief directory is docs\/briefs/);
  assert.match(gate.stdout, /docs\/briefs does not exist/);

  const suggest = run("suggest-run.mjs");
  assert.equal(suggest.status, 0, suggest.stderr);
  assert.equal(suggest.stdout, "");
});

// ── 4. Installed outside the repository ─────────────────────────────────────
//
// A User-scope install (`npx skills add … -g`) puts the folder in the user's
// own skills directory, outside every repository. The commands still run from
// the audited repository's root, with `<skill>` the folder's absolute path.

let home;
let outsideSkill;

before(() => {
  home = mkdtempSync(join(tmpdir(), "instruction-drift-audit-user-"));
  // A space in the path, as in many home directories: the commands must quote `<skill>`.
  outsideSkill = join(home, "my skills", "instruction-drift-audit");
  mkdirSync(dirname(outsideSkill), { recursive: true });
  cpSync(HERE, outsideSkill, { recursive: true });
});

after(() => {
  if (home) rmSync(home, { recursive: true, force: true });
});

/** A ```bash block of SKILL.md, by a line it contains, with `<skill>` replaced. */
function skillCommand(marker, skillPath) {
  const blocks = [...read("SKILL.md").matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
  const block = blocks.find((text) => text.includes(marker));
  assert.ok(block, `SKILL.md has no bash block containing ${marker}`);
  return block.replaceAll("<skill>", skillPath.replaceAll("\\", "/"));
}

test("resolve-baseline runs from the repository with the skill installed outside it", () => {
  const result = spawnSync(process.execPath, [join(outsideSkill, "resolve-baseline.mjs")], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /nx — Baseline 22\.7\.7, 2 member\(s\): @nx\/js, nx/);
});

// SKILL.md's commands are bash. This case is skipped, not failed, on a machine with no bash on
// PATH, or with one that cannot see this folder by its forward-slash path (WSL's bash on Windows).
const NO_BASH =
  spawnSync("bash", ["-c", 'test -d "$1"', "_", HERE.replaceAll("\\", "/")]).status !== 0 &&
  "no bash on PATH that sees this folder's path";

test(
  "step 8's delta command imports the ledger from the skill's own folder",
  { skip: NO_BASH },
  () => {
    const report = join(HERE, "fixtures", "report.json");
    const command = skillCommand("classifyFindings", outsideSkill)
      .replace("<draft-report.json>", JSON.stringify(report))
      .replace("<the ledger report step 4 named>", JSON.stringify(report));
    const result = spawnSync("bash", ["-c", command], { cwd: repo, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const delta = JSON.parse(result.stdout);
    assert.ok(delta.stillPresent.length > 0, result.stdout);
  },
);

test("validate-report runs, and refuses no input with its usage", () => {
  const result = run("validate-report.mjs");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage: validate-report\.mjs/);
});
