// The two-point coverage runner: what each configured suite proves, observed
// by running it at the head and at the merge-base and comparing (SKILL.md
// step 4, DESIGN.md "Observed and reconstructed").
//
// WHAT IT DOES
//   1. Runs each `plan.suites` command in the checkout, at the head.
//   2. Creates a detached worktree at the merge-base under `working_dir`,
//      runs each command again there, and removes the worktree, on success
//      and on failure alike. The head runs come first so that no suite run in
//      the checkout collects the worktree's copy of the tests.
//   3. Parses each suite's JUnit XML (the only parsed format) and compares the
//      two runs test by test:
//        passes at both            covered                  [observed]
//        new, and passes           covered, named           [observed]
//        fails at both             expected red herring     [observed]
//        passes at base, fails     REGRESSION: qa-plan stops [observed]
//        new, and fails            REGRESSION               [observed]
//      A test skipped at the merge-base counts as new: `covered (unskipped)`
//      when it passes, a regression when it fails.
//   4. A suite with no `junit`, no JUnit written, or JUnit that will not
//      parse, is compared by exit code only, and a merge-base that will not
//      build or run tells nothing about a test failing at the head. Those
//      claims are tagged `[reconstructed]`, and the output says which suites
//      degraded and why.
//
//   Before each run the suite's JUnit file is deleted, so a report left by an
//   earlier run is never read as this one's.
//
// CLI (run from the repository root; `--repo <dir>` points elsewhere)
//   node two-point.mjs [--base <ref>] [--suite <name>]… [--timeout <seconds>] [--json]
//
//   `--base` defaults to the config's `plan.base_ref`; the merge-base is
//   `git merge-base <base> HEAD`. `--suite` runs only the named suites.
//   `--timeout` bounds each suite run (default 1800 seconds).
//
//   Exit 0: no regression. Exit 1: a regression; the plan is not worth
//   writing until it is fixed. Exit 2: usage, config or git trouble, or the
//   run was interrupted; nothing was compared.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { effectiveConfig, readQaConfig } from "./adapter.mjs";

export const DEFAULT_TIMEOUT_SECONDS = 1800;

/** What went wrong before anything could be compared: exit 2. */
export class TwoPointError extends Error {}

// ── JUnit XML ───────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, ref) => {
    if (ref.startsWith("#x")) return String.fromCodePoint(parseInt(ref.slice(2), 16));
    if (ref.startsWith("#")) return String.fromCodePoint(parseInt(ref.slice(1), 10));
    return ENTITIES[ref] ?? whole;
  });
}

/** The index of the `>` closing the tag that opens at `start`, skipping quoted values. */
function tagEnd(text, start) {
  let quote = "";
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}

const ATTRIBUTE = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Status precedence when one test id appears more than once: a failure wins. */
const RANK = { fail: 2, pass: 1, skipped: 0 };

/**
 * The test cases in one JUnit XML report, as `id → status`. The id is the
 * test's `classname` (or, without one, its innermost `testsuite`'s name),
 * `::`, and its `name`. A `failure` or `error` child fails a case; a
 * `skipped` child skips it; otherwise it passed. Throws on anything that is
 * not well-formed JUnit.
 *
 * @param {string} text
 * @returns {Map<string, "pass" | "fail" | "skipped">}
 */
export function parseJUnit(text) {
  /** @type {Map<string, "pass" | "fail" | "skipped">} */
  const tests = new Map();
  /** @type {{name: string, attrs: Record<string, string>}[]} */
  const stack = [];
  let current = null;
  let root = null;
  let i = 0;
  const skipTo = (from, marker, what) => {
    const end = text.indexOf(marker, from);
    if (end === -1) throw new Error(`unterminated ${what}`);
    return end + marker.length;
  };
  const finish = () => {
    const previous = tests.get(current.id);
    if (!previous || RANK[current.status] > RANK[previous]) tests.set(current.id, current.status);
    current = null;
  };
  for (;;) {
    const lt = text.indexOf("<", i);
    if (lt === -1) break;
    if (text.startsWith("<!--", lt)) i = skipTo(lt + 4, "-->", "comment");
    else if (text.startsWith("<![CDATA[", lt)) i = skipTo(lt + 9, "]]>", "CDATA section");
    else if (text.startsWith("<?", lt)) i = skipTo(lt + 2, "?>", "processing instruction");
    else if (text.startsWith("<!", lt)) i = skipTo(lt + 2, ">", "declaration");
    else {
      const end = tagEnd(text, lt);
      if (end === -1) throw new Error("unterminated tag");
      i = end + 1;
      const raw = text.slice(lt + 1, end).trim();
      if (raw.startsWith("/")) {
        const name = raw.slice(1).trim();
        const open = stack.pop();
        if (!open || open.name !== name) throw new Error(`unexpected </${name}>`);
        if (name === "testcase" && current) finish();
        continue;
      }
      const selfClosing = raw.endsWith("/");
      const body = selfClosing ? raw.slice(0, -1) : raw;
      const name = body.split(/\s/, 1)[0];
      if (!name) throw new Error("a tag with no name");
      /** @type {Record<string, string>} */
      const attrs = {};
      for (const [, key, double, single] of body.slice(name.length).matchAll(ATTRIBUTE))
        attrs[key] = decode(double ?? single);
      if (!root) {
        root = name;
        if (name !== "testsuites" && name !== "testsuite")
          throw new Error(`the root element is <${name}>, not <testsuites> or <testsuite>`);
      }
      if (name === "testcase") {
        if (current) throw new Error("a <testcase> inside a <testcase>");
        const suite = [...stack].reverse().find((open) => open.name === "testsuite");
        const group = attrs.classname || suite?.attrs.name || "";
        current = { id: `${group}::${attrs.name ?? ""}`, status: "pass" };
      } else if (current && (name === "failure" || name === "error")) current.status = "fail";
      else if (current && name === "skipped" && current.status === "pass")
        current.status = "skipped";
      if (selfClosing) {
        if (name === "testcase") finish();
      } else stack.push({ name, attrs });
    }
  }
  if (!root) throw new Error("no XML elements");
  if (stack.length) throw new Error(`<${stack[stack.length - 1].name}> is never closed`);
  return tests;
}

/** A test id with the tree's own path taken out, so the same test matches in both trees. */
export function normalizeId(id, root) {
  const forms = new Set([root, root.replaceAll("\\", "/"), root.replaceAll("/", "\\")]);
  let out = id;
  for (const form of forms) if (form) out = out.split(form).join("");
  return out.replace(/^[\\/.]+/, "");
}

// ── Comparison ──────────────────────────────────────────────────────────────

/**
 * @typedef {{code: number | null, timedOut?: boolean, tests: Map<string, string> | null, junitProblem: string | null}} SuiteRun
 * @typedef {{suite: string, test: string, base: string, head: string, result: string, tag: "[observed]" | "[reconstructed]"}} Row
 */

const exitText = (run) =>
  run.timedOut ? "timed out" : run.code === 0 ? "pass" : `fail (exit ${run.code ?? "none"})`;

/** A test passing at the head, by what it was at the merge-base (passing at both is summed). */
const PASSING_AT_HEAD = {
  new: "covered (new)",
  fail: "covered (fixed at head)",
  skipped: "covered (unskipped)",
};
/** A test failing at the head, by what it was at the merge-base (failing at both is a red herring). */
const FAILING_AT_HEAD = {
  new: "regression (new test fails)",
  pass: "regression",
  skipped: "regression (unskipped test fails)",
};

/**
 * Compares one suite's run at the head with its run at the merge-base.
 *
 * Results: `covered`, `covered (new)`, `covered (fixed at head)`,
 * `expected red herring`, `regression`, `skipped at head`, `removed at head`,
 * and `unknown`: failing at the head while the merge-base did not build or
 * run, so a red herring cannot be told from a regression.
 *
 * @param {{name: string, junit?: string}} suite
 * @param {SuiteRun} head
 * @param {SuiteRun} base
 * @returns {{name: string, observed: boolean, degraded: string | null, rows: Row[]}}
 */
export function compareSuite(suite, head, base) {
  const name = suite.name;
  /** @type {Row[]} */
  const rows = [];
  const row = (test, b, h, result, tag) =>
    rows.push({ suite: name, test, base: b, head: h, result, tag });

  if (head.tests && base.tests) {
    let both = 0;
    let skipped = 0;
    for (const [id, h] of head.tests) {
      const b = base.tests.get(id);
      if (h === "skipped") skipped++;
      else if (h === "pass" && b === "pass") both++;
      else if (h === "pass") row(id, b ?? "—", h, PASSING_AT_HEAD[b ?? "new"], "[observed]");
      else if (b === "fail") row(id, b, h, "expected red herring", "[observed]");
      else row(id, b ?? "—", h, FAILING_AT_HEAD[b ?? "new"], "[observed]");
    }
    for (const [id, b] of base.tests)
      if (!head.tests.has(id)) row(id, b, "—", "removed at head", "[observed]");
    if (both)
      rows.unshift({
        suite: name,
        test: `${both} tests`,
        base: "pass",
        head: "pass",
        result: "covered",
        tag: "[observed]",
      });
    if (skipped) row(`${skipped} tests`, "—", "skipped", "skipped at head", "[observed]");
    // A head that failed or timed out with no failing test in its report left
    // tests out of it (an import error, a run killed part way): its exit code
    // is the only sign, so it is compared too.
    let degraded = null;
    const headUnexplained =
      head.timedOut || (head.code !== 0 && ![...head.tests.values()].includes("fail"));
    if (headUnexplained) {
      degraded = `at the head the suite ended ${exitText(head)} with no failing test in its JUnit`;
      row(
        "(whole suite, by exit code)",
        exitText(base),
        exitText(head),
        base.code === 0 && !base.timedOut ? "regression (suite exit)" : "unknown",
        "[reconstructed]",
      );
    }
    return { name, observed: true, degraded, rows };
  }

  const baseBroken = base.code !== 0;
  let degraded;
  if (!suite.junit) degraded = "no `junit` configured; compared by exit code only";
  else if (!head.tests) degraded = `at the head, ${head.junitProblem}; compared by exit code only`;
  else
    degraded = baseBroken
      ? `the merge-base did not build or run (${exitText(base)}, ${base.junitProblem}); ` +
        "a failure at the head cannot be told from a red herring. The worktree holds tracked " +
        "files only, so a suite command must install what it needs (ADAPTER.md)"
      : `at the merge-base, ${base.junitProblem}; compared with the merge-base's exit code`;

  if (head.tests) {
    // The head's own results, against nothing but the merge-base's exit code.
    let passing = 0;
    let skipped = 0;
    for (const [id, h] of head.tests) {
      if (h === "pass") passing++;
      else if (h === "skipped") skipped++;
      else row(id, exitText(base), h, baseBroken ? "unknown" : "regression", "[reconstructed]");
    }
    if (passing)
      rows.unshift({
        suite: name,
        test: `${passing} tests`,
        base: exitText(base),
        head: "pass",
        result: "covered",
        tag: "[reconstructed]",
      });
    if (skipped) row(`${skipped} tests`, "—", "skipped", "skipped at head", "[reconstructed]");
    return { name, observed: false, degraded, rows };
  }

  // Exit codes only. A failing exit is a red herring only when nothing says
  // the two failures differ: with `junit` configured, a head that wrote no
  // JUnit did not build or run. Against a merge-base whose tests ran, that is
  // a regression; against one that did not run either, it is unknown.
  const h = exitText(head);
  const b = exitText(base);
  let result;
  if (head.code === 0) result = baseBroken ? "covered (fixed at head)" : "covered";
  else if (!baseBroken || (suite.junit && base.tests)) result = "regression";
  else if (suite.junit) result = "unknown";
  else result = "expected red herring";
  row("(whole suite, by exit code)", b, h, result, "[reconstructed]");
  return { name, observed: false, degraded, rows };
}

// ── Running ─────────────────────────────────────────────────────────────────

/**
 * Stops `child` and everything it started. `shell: true` puts a shell between
 * us and the suite, and a suite often starts more processes (`npm ci && npm
 * test`, test workers); killing the shell alone leaves them running, holding
 * the output pipes open and working in a worktree about to be removed.
 */
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else
    try {
      process.kill(-child.pid, "SIGKILL"); // the process group `detached` made
    } catch {
      child.kill("SIGKILL");
    }
}

/**
 * Runs `command` through the shell in `cwd`. Resolves with its exit code; a
 * run past `timeoutMs` is killed, with every process it started, and reported
 * as timed out. On `signal` the same happens, and the promise rejects.
 *
 * @returns {Promise<{code: number | null, timedOut: boolean, output: string}>}
 */
export function shellExec(command, cwd, { timeoutMs, signal } = {}) {
  return new Promise((done, fail) => {
    if (signal?.aborted) return fail(new TwoPointError("interrupted"));
    // On POSIX, a process group of its own, so the whole tree can be killed.
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let output = "";
    let timedOut = false;
    let settled = false;
    const keep = (chunk) => {
      output = (output + chunk).slice(-4000);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const stop = () => killTree(child);
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          stop();
        }, timeoutMs)
      : null;
    signal?.addEventListener("abort", stop, { once: true });
    const settle = (code, extra = "") => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      child.stdout.destroy();
      child.stderr.destroy();
      if (signal?.aborted) fail(new TwoPointError("interrupted"));
      else done({ code: timedOut ? null : code, timedOut, output: `${output}${extra}` });
    };
    child.on("error", (error) => settle(null, error.message));
    // A killed run settles on its exit: a process that escaped the kill may
    // still hold the pipes, and must not hold the run.
    child.on("exit", (code) => {
      if (timedOut || signal?.aborted) settle(code);
    });
    child.on("close", (code) => settle(code));
  });
}

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.error) throw new TwoPointError(`git could not run: ${result.error.message}`);
  if (result.status !== 0)
    throw new TwoPointError(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
  return result.stdout.trim();
}

/** The `two-point-*` worktrees git lists directly under `parent`. */
export function leftoverWorktrees(repo, parent) {
  spawnSync("git", ["-C", repo, "worktree", "prune"], { encoding: "utf8" });
  const listed = spawnSync("git", ["-C", repo, "worktree", "list", "--porcelain"], {
    encoding: "utf8",
  });
  // Compared as real paths: git prints them resolved (`/private/var` on macOS
  // for a `/var` temp folder), and Windows paths ignore case.
  const key = (path) => {
    let full = resolve(path);
    try {
      full = realpathSync.native(full);
    } catch {
      // gone already: compare as given
    }
    return process.platform === "win32" ? full.toLowerCase() : full;
  };
  const home = key(parent);
  return (listed.stdout ?? "")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length)))
    .filter((path) => key(dirname(path)) === home && basename(path).startsWith("two-point-"));
}

/** Removes the worktree at `path`, by git if it can and by hand if it cannot. */
export function removeWorktree(repo, path) {
  spawnSync("git", ["-C", repo, "worktree", "remove", "--force", path], { encoding: "utf8" });
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  spawnSync("git", ["-C", repo, "worktree", "prune"], { encoding: "utf8" });
}

/** One suite run in `root`: its exit code and its JUnit results, or why there are none. */
async function runSuite(suite, root, exec, options) {
  const junitPath = suite.junit ? join(root, suite.junit) : null;
  if (junitPath) rmSync(junitPath, { force: true });
  const ran = await exec(suite.command, root, options);
  /** @type {SuiteRun & {output: string}} */
  const run = {
    code: ran.code,
    timedOut: ran.timedOut,
    output: ran.output ?? "",
    tests: null,
    junitProblem: null,
  };
  if (!junitPath) run.junitProblem = "no `junit` configured";
  else if (!existsSync(junitPath)) run.junitProblem = `no JUnit written at \`${suite.junit}\``;
  else
    try {
      const tests = new Map();
      for (const [id, status] of parseJUnit(readFileSync(junitPath, "utf8")))
        tests.set(normalizeId(id, root), status);
      run.tests = tests;
    } catch (error) {
      run.junitProblem = `the JUnit at \`${suite.junit}\` does not parse (${error.message})`;
    }
  return run;
}

/**
 * The whole two-point run.
 *
 * @param {{
 *   repo: string, base: string, suites: {name: string, command: string, junit?: string}[],
 *   workingDir: string, timeoutMs?: number, signal?: AbortSignal,
 *   exec?: typeof shellExec,
 * }} options
 */
export async function runTwoPoint({
  repo,
  base,
  suites,
  workingDir,
  timeoutMs,
  signal,
  exec = shellExec,
}) {
  const head = git(repo, ["rev-parse", "HEAD"]);
  const mergeBase = git(repo, ["merge-base", base, "HEAD"]);
  const notes = [];
  if (git(repo, ["status", "--porcelain", "--untracked-files=no"]))
    notes.push(
      "the checkout has uncommitted changes to tracked files: the head runs saw them, not the head commit alone",
    );
  const options = { timeoutMs, signal };
  const check = () => {
    if (signal?.aborted) throw new TwoPointError("interrupted");
  };

  // Every worktree an earlier, killed run left behind, at this merge-base or
  // another, goes before the head runs, so no suite in the checkout collects
  // its copy of the tests. Only what git lists as a worktree is removed: a
  // file or folder that merely shares the name is the person's own.
  const parent = resolve(repo, workingDir);
  const tree = join(parent, `two-point-${mergeBase.slice(0, 12)}`);
  for (const path of leftoverWorktrees(repo, parent)) removeWorktree(repo, path);

  const headRuns = [];
  for (const suite of suites) {
    check();
    headRuns.push(await runSuite(suite, repo, exec, options));
  }

  const baseRuns = [];
  mkdirSync(parent, { recursive: true });
  // Removed only once this run has made it: a folder already at that path
  // makes `worktree add` fail, and stays.
  let created = false;
  try {
    check();
    git(repo, ["worktree", "add", "--detach", tree, mergeBase]);
    created = true;
    for (const suite of suites) {
      check();
      baseRuns.push(await runSuite(suite, tree, exec, options));
    }
  } finally {
    if (created) removeWorktree(repo, tree);
  }

  const compared = suites.map((suite, n) => ({
    ...compareSuite(suite, headRuns[n], baseRuns[n]),
    head: {
      code: headRuns[n].code,
      timedOut: headRuns[n].timedOut,
      junit: headRuns[n].junitProblem ?? "parsed",
      output: headRuns[n].output,
    },
    base: {
      code: baseRuns[n].code,
      timedOut: baseRuns[n].timedOut,
      junit: baseRuns[n].junitProblem ?? "parsed",
      output: baseRuns[n].output,
    },
  }));
  const rows = compared.flatMap((suite) => suite.rows);
  return {
    head,
    mergeBase,
    suites: compared,
    regression: rows.some((row) => row.result.startsWith("regression")),
    unknown: rows.some((row) => row.result === "unknown"),
    notes,
  };
}

// ── Output ──────────────────────────────────────────────────────────────────

const cell = (text) => String(text).replace(/\r?\n/g, " ").replaceAll("|", "\\|");

/** The Markdown the skill reads: the table, the degraded suites and the verdict. */
export function renderReport(report) {
  const lines = [
    "# Two-point coverage",
    "",
    `Merge-base: \`${report.mergeBase}\`  `,
    `Head: \`${report.head}\``,
    "",
    "| Suite | Test | Merge-base | Head | Result | Tag |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const suite of report.suites)
    for (const row of suite.rows)
      lines.push(
        `| ${[row.suite, row.test, row.base, row.head, row.result.startsWith("regression") ? `**${row.result}**` : row.result, row.tag].map(cell).join(" | ")} |`,
      );
  const degraded = report.suites.filter((suite) => suite.degraded);
  lines.push("", "## Degraded suites", "");
  if (degraded.length)
    for (const suite of degraded) lines.push(`- \`${suite.name}\`: ${suite.degraded}.`);
  else lines.push("None: every suite was compared test by test.");
  if (report.notes.length) {
    lines.push("", "## Notes", "");
    for (const note of report.notes) lines.push(`- ${note}.`);
  }
  lines.push("", "## Verdict", "");
  if (report.regression)
    lines.push(
      "**Regression.** A test that passes at the merge-base, or a new test, fails at the head. Stop: fix it before a plan is worth writing.",
    );
  else if (report.unknown)
    lines.push(
      "No regression observed, but some failures at the head could not be compared (`unknown`): the person decides whether each is a red herring before compose goes on.",
    );
  else lines.push("No regression.");
  return `${lines.join("\n")}\n`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function option(argv, name) {
  const values = [];
  argv.forEach((arg, n) => {
    if (arg === name && argv[n + 1] !== undefined) values.push(argv[n + 1]);
  });
  return values;
}

const USAGE =
  "usage: node two-point.mjs [--base <ref>] [--suite <name>]… [--timeout <seconds>] [--json] [--repo <dir>]\n";

/**
 * @param {string[]} argv the arguments after the script
 * @param {{signal?: AbortSignal, exec?: typeof shellExec}} [io]
 * @returns {Promise<{code: number, out: string}>}
 */
export async function main(argv, io = {}) {
  const known = new Set(["--base", "--suite", "--timeout", "--repo", "--json"]);
  for (let n = 0; n < argv.length; n++) {
    if (!known.has(argv[n])) return { code: 2, out: USAGE };
    if (argv[n] === "--json") continue;
    n++;
    if (argv[n] === undefined || argv[n].startsWith("--")) return { code: 2, out: USAGE };
  }
  const repo = resolve(option(argv, "--repo")[0] ?? process.cwd());
  const read = (path) => {
    const absolute = join(repo, path);
    return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
  };
  const loaded = readQaConfig(read);
  if (loaded.problems.length)
    return {
      code: 2,
      out: `${loaded.path} has problems; fix each one first:\n${loaded.problems.map((p) => `- ${p}`).join("\n")}\n`,
    };
  const config = effectiveConfig(loaded.config);
  const base = option(argv, "--base")[0] ?? config.plan.base_ref;
  if (!base)
    return {
      code: 2,
      out: "no base ref: pass --base <ref>, or set `plan.base_ref` in the config\n",
    };
  const wanted = option(argv, "--suite");
  const unknownSuites = wanted.filter(
    (name) => !config.plan.suites.some((suite) => suite.name === name),
  );
  if (unknownSuites.length)
    return {
      code: 2,
      out: `no suite named ${unknownSuites.map((s) => `\`${s}\``).join(", ")} in \`plan.suites\`\n`,
    };
  const suites = config.plan.suites.filter(
    (suite) => !wanted.length || wanted.includes(suite.name),
  );
  if (!suites.length)
    return { code: 2, out: "no suites: add `plan.suites` to the config (ADAPTER.md)\n" };
  const seconds = Number(option(argv, "--timeout")[0] ?? DEFAULT_TIMEOUT_SECONDS);
  if (!Number.isFinite(seconds) || seconds <= 0) return { code: 2, out: USAGE };
  if (isAbsolute(config.working_dir) || config.working_dir.split(/[\\/]/).includes(".."))
    return { code: 2, out: "`working_dir` must be a relative path inside the repository\n" };

  try {
    const report = await runTwoPoint({
      repo,
      base,
      suites,
      workingDir: config.working_dir,
      timeoutMs: seconds * 1000,
      signal: io.signal,
      exec: io.exec,
    });
    return {
      code: report.regression ? 1 : 0,
      out: argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : renderReport(report),
    };
  } catch (error) {
    if (error instanceof TwoPointError) return { code: 2, out: `two-point: ${error.message}\n` };
    throw error;
  }
}

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

// Compared as real paths: `file://${argv[1]}` never matches on Windows, and a
// symlinked skills directory must still count as running this file.
if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) {
  // Ctrl-C stops the running suite and still removes the worktree.
  const controller = new AbortController();
  // The suite runs in its own process group (shellExec), so the terminal's
  // signals reach only this process: each one it can catch stops the suite.
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(sig, () => controller.abort());
  const { code, out } = await main(process.argv.slice(2), { signal: controller.signal });
  process.stdout.write(out);
  process.exitCode = code;
}
