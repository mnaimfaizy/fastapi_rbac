/**
 * Contract suite for the Upstream Brief validator CLI.
 *
 * Exit codes are the surface here, so they are what is asserted: 0 for a
 * report that is a report (Unverified entries and all), 1 for one that is
 * not, 2 for a run that could not happen. The separation of 1 from 2 is the
 * expensive half — a shallow clone reporting every citation as
 * `file-not-found` would accuse a worker that did nothing wrong.
 *
 * The CLI is driven in-process with an injected reader and commit resolver
 * rather than spawned, so the suite never depends on this clone's history.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { fixtureReader, fixtureReport } from "./report.test.mjs";
import { BRIEF_SECTIONS } from "./render.mjs";
import { gitSource, main, parseArgs } from "./validate-report.mjs";

const workspace = () => mkdtempSync(join(tmpdir(), "instruction-drift-audit-"));

const writeReport = (dir, report = fixtureReport(), name = "report.json") => {
  const path = join(dir, name);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
};

/** Runs the CLI, capturing the exit code instead of ending the process. */
const run = (argv, { hasCommit = () => true } = {}) => {
  const exit = process.exit;
  const log = console.log;
  const error = console.error;
  const out = [];
  let code = 0;
  process.exit = (value) => {
    code = value;
    throw new Error("__exit__");
  };
  console.log = (...args) => out.push(args.join(" "));
  console.error = (...args) => out.push(args.join(" "));
  try {
    main(argv, { source: () => fixtureReader, hasCommit });
  } catch (err) {
    if (err.message !== "__exit__") throw err;
  } finally {
    process.exit = exit;
    console.log = log;
    console.error = error;
  }
  return { code, output: out.join("\n") };
};

test("parseArgs takes the first bare token as the report and the rest as flags", () => {
  assert.deepEqual(parseArgs(["r.json", "--out", "n.json", "--repo", "/tmp"]), {
    positional: ["r.json"],
    flags: { out: "n.json", repo: "/tmp" },
  });
});

test("a flag given no value is an empty string, not the next flag", () => {
  assert.deepEqual(parseArgs(["r.json", "--out", "--render", "b.md"]).flags, {
    out: "",
    render: "b.md",
  });
});

test("exit 0: the fixture report validates, and the summary counts what survived", () => {
  const dir = workspace();
  const { code, output } = run([writeReport(dir)]);
  assert.equal(code, 0);
  assert.match(output, /4 finding\(s\)/);
  // Printed even at zero: a line that disappears when the count is zero reads
  // as a run that verified everything.
  assert.match(output, /0 unverified/);
});

test("exit 0: a report carrying an Unverified entry still passes, and says which", () => {
  const dir = workspace();
  const raw = fixtureReport();
  delete raw.ecosystems[0].findings[0].source.quote;

  const { code, output } = run([writeReport(dir, raw)]);

  assert.equal(code, 0);
  assert.match(output, /1 unverified/);
  assert.match(output, /ecosystems\[0\]\.findings\[0\] \(missing-source-quote\)/);
});

test("--out writes the normalized report, and --render writes the brief", () => {
  const dir = workspace();
  const out = join(dir, "normalized.json");
  const brief = join(dir, "brief.md");

  const { code } = run([writeReport(dir), "--out", out, "--render", brief]);

  assert.equal(code, 0);
  const normalized = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(normalized.counts.findings, 4);
  assert.deepEqual(normalized.unverified, []);
  const markdown = readFileSync(brief, "utf8");
  for (const section of BRIEF_SECTIONS) assert.ok(markdown.includes(`## ${section}`), section);
});

test("exit 1: a file that is not JSON is an unparseable report, not a failed run", () => {
  const dir = workspace();
  const path = join(dir, "report.json");
  writeFileSync(path, "{ not json");
  const { code, output } = run([path]);
  assert.equal(code, 1);
  assert.match(output, /is not valid JSON/);
});

test("exit 1: an invalid envelope is rejected whole, with every problem named", () => {
  const dir = workspace();
  const raw = fixtureReport();
  raw.schemaVersion = 99;
  delete raw.scanned;
  const { code, output } = run([writeReport(dir, raw)]);
  assert.equal(code, 1);
  assert.match(output, /schemaVersion/);
  assert.match(output, /scanned/);
});

test("exit 1: a report recording no commit is invalid, not unrunnable", () => {
  const dir = workspace();
  const raw = fixtureReport();
  delete raw.commit;
  const { code, output } = run([writeReport(dir, raw)]);
  assert.equal(code, 1);
  assert.match(output, /records no commit/);
});

test("exit 2: a recorded commit this clone does not have stops the run", () => {
  const dir = workspace();
  const { code, output } = run([writeReport(dir)], { hasCommit: () => false });
  assert.equal(code, 2);
  assert.match(output, /not in this clone/);
  assert.match(output, /fetch-depth: 0/);
});

test("exit 2: no report path, or one that cannot be read", () => {
  assert.equal(run([]).code, 2);
  assert.equal(run([join(workspace(), "absent.json")]).code, 2);
});

test("exit 2: a flag that needs a path and was given none", () => {
  const dir = workspace();
  const { code, output } = run([writeReport(dir), "--out"]);
  assert.equal(code, 2);
  assert.match(output, /--out needs a path/);
});

test("gitSource reads a citation relative to --repo, not to the git root", () => {
  const root = workspace();
  const sub = join(root, "packages", "web");
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(root, "package.json"), "root\n");
  writeFileSync(join(sub, "package.json"), "web\n");
  const git = (...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  git("init", "--quiet");
  git("add", ".");
  git("commit", "--quiet", "--no-verify", "-m", "fixture");
  const commit = git("rev-parse", "HEAD");
  assert.equal(gitSource(commit, sub)("package.json"), "web\n");
  assert.equal(gitSource(commit, root)("package.json"), "root\n");
  assert.equal(gitSource(commit, sub)("missing.json"), null);
});
