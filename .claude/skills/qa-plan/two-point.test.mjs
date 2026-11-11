/**
 * Contract suite for the two-point coverage runner. The claims under test:
 * JUnit XML is read test by test; each test is classed against the
 * merge-base exactly as SKILL.md step 4 and the runner's table say
 * (regression, red herring, new test); a suite with no JUnit, or a
 * merge-base that will not build, degrades to exit codes and says why; and
 * the merge-base worktree is removed on success and on failure.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareSuite,
  main,
  normalizeId,
  parseJUnit,
  renderReport,
  shellExec,
} from "./two-point.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(HERE, "fixtures", "junit", name), "utf8");

// ── JUnit XML ───────────────────────────────────────────────────────────────

test("a pytest report reads as pass, fail (failure or error) and skipped, with entities decoded", () => {
  const tests = parseJUnit(fixture("pytest.xml"));
  assert.deepEqual(Object.fromEntries(tests), {
    "tests.test_auth::test_login": "pass",
    "tests.test_auth::test_logout": "fail",
    "tests.test_auth::test_reset": "fail",
    "tests.test_auth::test_sso": "skipped",
    'tests.test_auth::test_quote[a&b <c> "d"]': "pass",
  });
});

test("markup inside CDATA is not read as test cases", () => {
  assert.equal(
    [...parseJUnit(fixture("pytest.xml")).keys()].some((id) => id.includes("not-a-test")),
    false,
  );
});

test("a case with no classname takes its innermost test suite's name", () => {
  assert.deepEqual(Object.fromEntries(parseJUnit(fixture("nested.xml"))), {
    "cart totals::adds tax": "pass",
    'cart totals::rounds "half up"': "pass",
    "cart::empties": "pass",
  });
});

test("a test id reported twice keeps its failure", () => {
  assert.deepEqual(Object.fromEntries(parseJUnit(fixture("single-suite.xml"))), {
    "src/cart.test.ts::adds": "fail",
  });
});

test("malformed or non-JUnit XML throws, naming what is wrong", () => {
  assert.throws(() => parseJUnit(fixture("unclosed.xml")), /unexpected <\/testsuite>/);
  assert.throws(() => parseJUnit(fixture("not-junit.xml")), /root element is <coverage>/);
  assert.throws(() => parseJUnit(""), /no XML elements/);
  assert.throws(() => parseJUnit("<testsuites><testsuite>"), /never closed/);
});

test("a tree's own path is taken out of a test id, in either slash direction", () => {
  assert.equal(
    normalizeId("C:\\work\\repo\\tests\\a.test.js::adds", "C:\\work\\repo"),
    "tests\\a.test.js::adds",
  );
  assert.equal(
    normalizeId("/tmp/qa/two-point-abc/src/a.ts::adds", "/tmp/qa/two-point-abc"),
    "src/a.ts::adds",
  );
});

// ── Comparison ──────────────────────────────────────────────────────────────

const junitRun = (tests, code = 0) => ({
  code,
  tests: new Map(Object.entries(tests)),
  junitProblem: null,
});
const exitRun = (code, junitProblem = "no `junit` configured") => ({
  code,
  tests: null,
  junitProblem,
});
const byTest = (result) =>
  Object.fromEntries(result.rows.map((row) => [row.test, `${row.result} ${row.tag}`]));

test("compared test by test, every class is named and [observed]", () => {
  const result = compareSuite(
    { name: "unit", junit: "r.xml" },
    junitRun({ a: "pass", b: "pass", c: "fail", d: "pass", e: "fail", f: "pass", g: "skipped" }, 1),
    junitRun({ a: "pass", b: "fail", c: "fail", e: "pass", f: "pass", h: "pass" }, 1),
  );
  assert.equal(result.observed, true);
  assert.equal(result.degraded, null);
  assert.deepEqual(byTest(result), {
    "2 tests": "covered [observed]", // a and f pass at both, summed
    b: "covered (fixed at head) [observed]",
    c: "expected red herring [observed]",
    d: "covered (new) [observed]",
    e: "regression [observed]",
    h: "removed at head [observed]",
    "1 tests": "skipped at head [observed]",
  });
});

test("a head that fails with no failing test in its JUnit is compared by exit code too", () => {
  // Tests the head never collected are missing from its report, not failed.
  const regression = compareSuite(
    { name: "u", junit: "r" },
    junitRun({ a: "pass" }, 1),
    junitRun({ a: "pass", b: "pass" }, 0),
  );
  assert.equal(regression.observed, true);
  assert.match(regression.degraded, /ended fail \(exit 1\) with no failing test/);
  assert.deepEqual(byTest(regression), {
    "1 tests": "covered [observed]",
    b: "removed at head [observed]",
    "(whole suite, by exit code)": "regression (suite exit) [reconstructed]",
  });
  const timedOut = compareSuite(
    { name: "u", junit: "r" },
    { ...junitRun({ a: "pass" }, null), timedOut: true },
    junitRun({ a: "pass" }, 1),
  );
  assert.equal(byTest(timedOut)["(whole suite, by exit code)"], "unknown [reconstructed]");
  // A failing test explains a failing exit: no extra row.
  const explained = compareSuite(
    { name: "u", junit: "r" },
    junitRun({ a: "fail" }, 1),
    junitRun({ a: "pass" }, 0),
  );
  assert.deepEqual(byTest(explained), { a: "regression [observed]" });
  assert.equal(explained.degraded, null);
});

test("a new test that fails is a regression", () => {
  assert.deepEqual(
    byTest(compareSuite({ name: "u", junit: "r" }, junitRun({ n: "fail" }), junitRun({}))),
    {
      n: "regression (new test fails) [observed]",
    },
  );
});

test("a test skipped at the merge-base counts as new", () => {
  assert.deepEqual(
    byTest(
      compareSuite(
        { name: "u", junit: "r" },
        junitRun({ p: "pass", f: "fail" }),
        junitRun({ p: "skipped", f: "skipped" }),
      ),
    ),
    {
      p: "covered (unskipped) [observed]",
      f: "regression (unskipped test fails) [observed]",
    },
  );
});

test("a head that wrote no JUnit and failed, against a merge-base whose tests ran, is a regression", () => {
  // The merge-base exits 1 too, for a failure it already had: that is not a red herring.
  const result = compareSuite(
    { name: "unit", junit: "r.xml" },
    exitRun(1, "no JUnit written at `r.xml`"),
    junitRun({ a: "pass", old: "fail" }, 1),
  );
  assert.deepEqual(byTest(result), { "(whole suite, by exit code)": "regression [reconstructed]" });
});

test("with no junit configured, the exit codes decide, [reconstructed]", () => {
  const suite = { name: "lint" };
  const cases = [
    [0, 0, "covered"],
    [1, 1, "expected red herring"],
    [1, 0, "regression"],
    [0, 1, "covered (fixed at head)"],
  ];
  for (const [head, base, expected] of cases) {
    const result = compareSuite(suite, exitRun(head), exitRun(base));
    assert.equal(result.observed, false);
    assert.match(result.degraded, /no `junit` configured; compared by exit code only/);
    assert.deepEqual(byTest(result), {
      "(whole suite, by exit code)": `${expected} [reconstructed]`,
    });
  }
});

test("a merge-base that wrote no JUnit and failed leaves a head failure unknown, not a red herring", () => {
  const result = compareSuite(
    { name: "e2e", junit: "r.xml" },
    junitRun({ x: "pass", y: "fail" }, 1),
    exitRun(1, "no JUnit written at `r.xml`"),
  );
  assert.match(
    result.degraded,
    /the merge-base did not build or run \(fail \(exit 1\), no JUnit written at `r.xml`\)/,
  );
  assert.deepEqual(byTest(result), {
    "1 tests": "covered [reconstructed]",
    y: "unknown [reconstructed]",
  });
});

test("a merge-base that passed without writing JUnit makes a head failure a regression", () => {
  const result = compareSuite(
    { name: "e2e", junit: "r.xml" },
    junitRun({ y: "fail" }, 1),
    exitRun(0, "no JUnit written at `r.xml`"),
  );
  assert.deepEqual(byTest(result), { y: "regression [reconstructed]" });
});

test("no JUnit at either point: a failing merge-base did not run, so a head failure is unknown", () => {
  const missing = "no JUnit written at `r.xml`";
  const result = compareSuite(
    { name: "e2e", junit: "r.xml" },
    exitRun(1, missing),
    exitRun(1, missing),
  );
  assert.match(result.degraded, /at the head, no JUnit written/);
  assert.deepEqual(byTest(result), { "(whole suite, by exit code)": "unknown [reconstructed]" });
});

test("the report escapes table cells and states the verdict", () => {
  const report = {
    head: "h".repeat(40),
    mergeBase: "b".repeat(40),
    suites: [
      {
        ...compareSuite(
          { name: "u", junit: "r" },
          junitRun({ "a|b": "fail" }),
          junitRun({ "a|b": "pass" }),
        ),
      },
    ],
    regression: true,
    unknown: false,
    notes: [],
  };
  const text = renderReport(report);
  assert.match(text, /\| u \| a\\\|b \| pass \| fail \| \*\*regression\*\* \| \[observed\] \|/);
  assert.match(text, /\*\*Regression\.\*\*.*Stop/);
  assert.match(text, /## Degraded suites\n\nNone/);
});

// ── Against a throwaway repository ──────────────────────────────────────────

const scratch = mkdtempSync(join(tmpdir(), "two-point-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const sh = (cwd, ...args) => {
  const result = spawnSync(
    "git",
    ["-c", "user.name=QA", "-c", "user.email=qa@example.test", ...args],
    {
      cwd,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  return result.stdout.trim();
};

// `node emit.mjs <suite>` reads `results.json` in its own tree: writes the
// suite's JUnit when it has tests and a path, then exits with its code.
const EMIT = `
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const spec = JSON.parse(readFileSync("results.json", "utf8"))[process.argv[2]];
if (spec.junit && spec.tests) {
  mkdirSync(dirname(spec.junit), { recursive: true });
  const cases = Object.entries(spec.tests).map(([name, status]) =>
    status === "pass" ? \`<testcase classname="t" name="\${name}"/>\`
      : \`<testcase classname="t" name="\${name}"><failure/></testcase>\`);
  writeFileSync(spec.junit, \`<testsuites><testsuite name="s">\${cases.join("")}</testsuite></testsuites>\`);
}
process.exit(spec.exit);
`;

/**
 * A repository with `main` at the merge-base and `feature` checked out at the
 * head, one commit on. `base` and `head` are `results.json` at each; `head`
 * may be null to leave out `emit.mjs`'s inputs entirely.
 */
function makeRepo(name, suites, base, head, { baseEmit = EMIT } = {}) {
  const repo = join(scratch, name);
  mkdirSync(repo);
  sh(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, ".gitignore"), "tmp/\nreports/\n");
  writeFileSync(
    join(repo, "qa.config.json"),
    JSON.stringify({ working_dir: "tmp/qa", plan: { base_ref: "main", suites } }),
  );
  writeFileSync(join(repo, "emit.mjs"), baseEmit);
  writeFileSync(join(repo, "results.json"), JSON.stringify(base));
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "-m", "base");
  sh(repo, "checkout", "-q", "-b", "feature");
  writeFileSync(join(repo, "emit.mjs"), EMIT);
  writeFileSync(join(repo, "results.json"), JSON.stringify(head));
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "--allow-empty", "-m", "head");
  return repo;
}

/** Only the checkout itself is a worktree, and nothing is left under `working_dir`. */
function assertNoWorktreeLeft(repo) {
  const trees = sh(repo, "worktree", "list", "--porcelain")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "));
  assert.equal(trees.length, 1, trees.join("\n"));
  const parent = join(repo, "tmp", "qa");
  assert.deepEqual(existsSync(parent) ? readdirSync(parent) : [], []);
}

const run = (repo, ...argv) => main(["--repo", repo, "--json", ...argv]);
const rowsOf = (out) =>
  Object.fromEntries(
    JSON.parse(out).suites.flatMap((suite) =>
      suite.rows.map((row) => [`${row.suite} ${row.test}`, `${row.result} ${row.tag}`]),
    ),
  );

const UNIT = { name: "unit", command: "node emit.mjs unit", junit: "reports/unit.xml" };

test("a regression, a red herring and a new test, observed across a real merge-base", async () => {
  const repo = makeRepo(
    "observed",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 1, tests: { a: "pass", b: "pass", c: "fail" } } },
    {
      unit: {
        junit: "reports/unit.xml",
        exit: 1,
        tests: { a: "pass", b: "fail", c: "fail", d: "pass" },
      },
    },
  );
  const { code, out } = await run(repo);
  assert.equal(code, 1, out);
  const report = JSON.parse(out);
  assert.equal(report.mergeBase, sh(repo, "rev-parse", "main"));
  assert.equal(report.head, sh(repo, "rev-parse", "HEAD"));
  assert.deepEqual(rowsOf(out), {
    "unit 1 tests": "covered [observed]",
    "unit t::b": "regression [observed]",
    "unit t::c": "expected red herring [observed]",
    "unit t::d": "covered (new) [observed]",
  });
  assertNoWorktreeLeft(repo);
});

test("no regression exits 0, and the Markdown names the table and the verdict", async () => {
  const repo = makeRepo(
    "green",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass", n: "pass" } } },
  );
  const { code, out } = await main(["--repo", repo]);
  assert.equal(code, 0, out);
  assert.match(out, /\| unit \| t::n \| — \| pass \| covered \(new\) \| \[observed\] \|/);
  assert.match(out, /## Verdict\n\nNo regression\./);
  assertNoWorktreeLeft(repo);
});

test("a suite with no JUnit falls back to its exit code and says so", async () => {
  const repo = makeRepo(
    "no-junit",
    [{ name: "lint", command: "node emit.mjs lint" }, UNIT],
    { lint: { exit: 0 }, unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { lint: { exit: 0 }, unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
  );
  const { code, out } = await run(repo);
  assert.equal(code, 0, out);
  const lint = JSON.parse(out).suites.find((suite) => suite.name === "lint");
  assert.equal(lint.observed, false);
  assert.match(lint.degraded, /no `junit` configured/);
  assert.deepEqual(rowsOf(out), {
    "lint (whole suite, by exit code)": "covered [reconstructed]",
    "unit 1 tests": "covered [observed]",
  });
  assertNoWorktreeLeft(repo);
});

test("a merge-base that will not build degrades the suite, and its failures are unknown", async () => {
  // At the merge-base the suite's entry point does not exist yet.
  const repo = makeRepo(
    "unbuildable",
    [UNIT],
    {},
    { unit: { junit: "reports/unit.xml", exit: 1, tests: { a: "pass", y: "fail" } } },
    { baseEmit: 'throw new Error("does not build");\n' },
  );
  const { code, out } = await run(repo);
  assert.equal(code, 0, out);
  const report = JSON.parse(out);
  assert.equal(report.unknown, true);
  assert.match(report.suites[0].degraded, /the merge-base did not build or run/);
  assert.deepEqual(rowsOf(out), {
    "unit 1 tests": "covered [reconstructed]",
    "unit t::y": "unknown [reconstructed]",
  });
  assertNoWorktreeLeft(repo);
});

test("a JUnit file left by an earlier run is never read as this run's", async () => {
  const repo = makeRepo(
    "stale",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { unit: { exit: 1 } }, // the head writes nothing
  );
  mkdirSync(join(repo, "reports"));
  writeFileSync(
    join(repo, "reports", "unit.xml"),
    '<testsuite><testcase classname="t" name="a"/></testsuite>',
  );
  const { code, out } = await run(repo);
  assert.equal(code, 1, out);
  assert.deepEqual(rowsOf(out), {
    "unit (whole suite, by exit code)": "regression [reconstructed]",
  });
});

test("the worktree is removed when a run fails part way", async () => {
  const repo = makeRepo(
    "throws",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
  );
  let calls = 0;
  const exec = async (command, cwd, options) => {
    if (++calls === 2) {
      assert.ok(
        existsSync(join(cwd, "emit.mjs")),
        "the merge-base worktree exists while its suite runs",
      );
      throw new Error("the runner broke");
    }
    return shellExec(command, cwd, options);
  };
  await assert.rejects(main(["--repo", repo], { exec }), /the runner broke/);
  assertNoWorktreeLeft(repo);
});

test("an interrupted run exits 2 and removes the worktree", async () => {
  const repo = makeRepo(
    "interrupted",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
  );
  const controller = new AbortController();
  let calls = 0;
  const exec = async (command, cwd, options) => {
    if (++calls === 2) controller.abort();
    return shellExec(command, cwd, options);
  };
  const { code, out } = await main(["--repo", repo], { exec, signal: controller.signal });
  assert.equal(code, 2);
  assert.match(out, /interrupted/);
  assertNoWorktreeLeft(repo);
});

test("every worktree an earlier run left behind is removed before the head runs", async () => {
  const repo = makeRepo(
    "leftover",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
  );
  const base = sh(repo, "rev-parse", "main");
  // One at this merge-base, and one from a run against an older merge-base.
  for (const name of [base.slice(0, 12), "000000000000"])
    sh(
      repo,
      "worktree",
      "add",
      "-q",
      "--detach",
      join(repo, "tmp", "qa", `two-point-${name}`),
      base,
    );
  // The person's own files that merely share the prefix stay.
  writeFileSync(join(repo, "tmp", "qa", "two-point-notes.md"), "mine\n");
  mkdirSync(join(repo, "tmp", "qa", "two-point-scratch"));
  writeFileSync(join(repo, "tmp", "qa", "two-point-scratch", "keep.txt"), "mine\n");
  let headRunSaw = null;
  const exec = async (command, cwd, options) => {
    headRunSaw ??= readdirSync(join(repo, "tmp", "qa")).sort();
    return shellExec(command, cwd, options);
  };
  const { code, out } = await main(["--repo", repo], { exec });
  assert.equal(code, 0, out);
  assert.deepEqual(headRunSaw, ["two-point-notes.md", "two-point-scratch"]);
  assert.deepEqual(readdirSync(join(repo, "tmp", "qa")).sort(), [
    "two-point-notes.md",
    "two-point-scratch",
  ]);
  assert.ok(existsSync(join(repo, "tmp", "qa", "two-point-scratch", "keep.txt")));
});

test("a folder already at the worktree's path is left alone, and the run exits 2", async () => {
  const repo = makeRepo(
    "occupied",
    [UNIT],
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
    { unit: { junit: "reports/unit.xml", exit: 0, tests: { a: "pass" } } },
  );
  const occupied = join(
    repo,
    "tmp",
    "qa",
    `two-point-${sh(repo, "rev-parse", "main").slice(0, 12)}`,
  );
  mkdirSync(occupied, { recursive: true });
  writeFileSync(join(occupied, "keep.txt"), "mine\n");
  const { code, out } = await main(["--repo", repo]);
  assert.equal(code, 2, out);
  assert.match(out, /worktree add/);
  assert.ok(existsSync(join(occupied, "keep.txt")));
});

test("value flags need a value", async () => {
  const repo = makeRepo("flags", [UNIT], {}, {});
  for (const argv of [["--base", "--json"], ["--suite", "--json"], ["--base"], ["--timeout"]]) {
    const result = await main(["--repo", repo, ...argv]);
    assert.equal(result.code, 2, argv.join(" "));
    assert.match(result.out, /^usage:/, argv.join(" "));
  }
  assertNoWorktreeLeft(repo);
});

// A shell that starts a grandchild which outlives it and holds the output
// pipes, as `npm ci && npm test` or a test runner's workers do.
const GRANDCHILD = `node -e "require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'inherit' }); setTimeout(() => {}, 60000)"`;

test("a timeout kills every process the suite started, not just the shell", async () => {
  const started = Date.now();
  const result = await shellExec(GRANDCHILD, scratch, { timeoutMs: 500 });
  assert.equal(result.timedOut, true);
  assert.equal(result.code, null);
  assert.ok(Date.now() - started < 20000, `settled after ${Date.now() - started} ms`);
});

test("an abort kills every process the suite started, and rejects", async () => {
  const controller = new AbortController();
  const started = Date.now();
  setTimeout(() => controller.abort(), 500);
  await assert.rejects(
    shellExec(GRANDCHILD, scratch, { signal: controller.signal }),
    /interrupted/,
  );
  assert.ok(Date.now() - started < 20000, `settled after ${Date.now() - started} ms`);
});

test("usage, config and git trouble exit 2 and compare nothing", async () => {
  const repo = makeRepo("errors", [UNIT], {}, {});
  assert.equal((await main(["--repo", repo, "--bogus"])).code, 2);
  assert.match((await main(["--repo", repo, "--suite", "nope"])).out, /no suite named `nope`/);
  assert.match(
    (await main(["--repo", repo, "--base", "no-such-ref"])).out,
    /git merge-base no-such-ref HEAD failed/,
  );
  assert.match((await main(["--repo", repo, "--timeout", "0"])).out, /usage/);
  writeFileSync(
    join(repo, "qa.config.json"),
    JSON.stringify({ plan: { suites: [UNIT], colour: "blue" } }),
  );
  const bad = await main(["--repo", repo]);
  assert.equal(bad.code, 2);
  assert.match(bad.out, /has problems/);
  writeFileSync(join(repo, "qa.config.json"), JSON.stringify({ plan: { suites: [UNIT] } }));
  assert.match((await main(["--repo", repo])).out, /no base ref/);
  assertNoWorktreeLeft(repo);
});
