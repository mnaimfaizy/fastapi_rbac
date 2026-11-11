#!/usr/bin/env node
// The gate: re-validates every committed structured report, and the adapter
// it is read with (DESIGN.md §10 and §12).
//
//   node "<skill>/check-reports.mjs" [--repo <dir>] [--print]
//
// A host wires this into whatever runs its checks: a CI step, a pre-commit
// hook, or a thin wrapper its own gate runner can discover. The logic lives
// here so every host checks the same thing.
//
// WHAT IT ASSERTS, AND IN WHICH DIRECTION
//   Three assertions about three artifacts, each one direction.
//
//   1. THE ADAPTER READS CLEANLY. Every problem `adapter.mjs` reports — an
//   unknown key, a line outside the documented YAML subset, a value of the
//   wrong shape — fails the check. A misread adapter checks the wrong brief
//   directory or silences nothing, and passes while doing it.
//
//   2. THE COMMITTED REPORTS, AT THE COMMIT THEY RECORD. For every structured
//   report in the brief directory, every entry that survived validation still
//   holds at the commit that report records: a local citation is `file` +
//   `line` + the literal text, read back with `git show <commit>:<file>`.
//   Because the commit is fixed, a frozen brief stays valid however far the
//   tree moves — and a citation that stops matching means the report and the
//   history disagree, which a frozen document cannot self-report.
//
//   Not asserted: that every Markdown brief has a report beside it. Briefs
//   written before the report contract are not migrated, so a brief directory
//   holding no structured report passes, and says so.
//
//   Not re-checked: a report's own `unverified` list. Those entries were
//   refused at write time and carry no surviving claim; re-checking them would
//   fail by construction and no brief could pass its own gate.
//
//   3. THE DECLINED OPPORTUNITIES, AT THE CURRENT TREE. An entry whose
//   Ecosystem is no longer declared, or whose site file is gone, silences
//   nothing and records a decision about something that is not there.
//
//   Not asserted: that a declined entry names an Opportunity some run actually
//   produced. Suppression is decided at run time (`ledger.mjs`), and a gate
//   demanding a live match would fail on exactly the entry doing its job.
//
// WHICH FILES ARE REPORTS
//   Every `*.json` directly in the brief directory, not a filename pattern: a
//   report that escapes the gate through a typo'd name is the failure the gate
//   exists to prevent. Non-recursive, so a JSON file in the brief directory
//   that is not a report belongs in a subdirectory of it.
//
// Exit 0 = the adapter reads cleanly, every committed report still holds (or
//          there are none), and every declined entry points at something real.
// Exit 1 = any of those three fails.
// Exit 2 = the check could not run: an unreadable report, or a recorded commit
//          this clone does not have (DESIGN.md, Principles: a shallow clone
//          must not read as fabricated citations).
import { readAdapter, readIncidentalOwners } from "./adapter.mjs";
import { isEntryPoint } from "./entry-point.mjs";
import { validateDeclinedOpportunities } from "./ledger.mjs";
import { recheckUpstreamReport } from "./report.mjs";
import { repoFromArgv, repoIo } from "./repo-io.mjs";
import { readBriefDir, readDeclaredLeads, readDeclinedOpportunities } from "./resolve-ledger.mjs";
import { gitHasCommit, gitSource } from "./validate-report.mjs";

/** The prefix every printed line carries. A host wrapper may pass its own. */
export const DEFAULT_LABEL = "upstream-briefs";

const errorMessage = (error) => (error instanceof Error ? error.message : String(error));

/**
 * Pure over its IO so the contract suite drives a file map, not a tree.
 *
 * @param {object} io
 * @param {(path: string) => string | null | undefined} io.read a repo file, or null
 * @param {(dir: string) => string[] | null} io.list directory entries, or null
 * @param {(commit: string) => boolean} io.hasCommit
 * @param {(commit: string) => (file: string) => string | null} io.source
 * @param {(path: string) => boolean} [io.exists] asked only of a declined
 *   entry's site; defaults to `read`, which is what a file map is. A real run
 *   passes `existsSync`, because a site that is a directory still exists.
 * @param {string} [io.label]
 * @returns {{exitCode: number, briefDir: string, reports: {path: string, commit: string, ok: boolean}[], lines: string[]}}
 */
export function checkReports({
  read,
  list,
  hasCommit,
  source,
  exists = (path) => {
    const contents = read(path);
    return contents !== null && contents !== undefined;
  },
  label = DEFAULT_LABEL,
}) {
  const adapter = readAdapter(read);
  const briefDir = readBriefDir(read);
  const incidentalOwners = readIncidentalOwners(read);
  const lines = [];
  const reports = [];
  let exitCode = 0;
  const worst = (code) => {
    exitCode = Math.max(exitCode, code);
  };

  // 1. The adapter.
  for (const problem of adapter.problems) {
    lines.push(`${label}: ${adapter.path}: ${problem}`);
    worst(1);
  }

  // 2. The committed reports.
  const entries = list(briefDir);
  const paths =
    entries === null
      ? []
      : entries
          .filter((name) => name.endsWith(".json"))
          .sort()
          .map((name) => `${briefDir}/${name}`);

  // Said out loud, not inferred from silence: a green run that checked
  // nothing must not read like one that checked everything.
  if (entries === null)
    lines.push(`${label}: ${briefDir} does not exist — no structured report to check`);
  else if (paths.length === 0)
    lines.push(`${label}: no structured report in ${briefDir} — nothing to re-validate`);

  for (const path of paths) {
    const text = read(path);
    if (text === null || text === undefined) {
      lines.push(`${label}: ${path} could not be read`);
      worst(2);
      continue;
    }
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      lines.push(`${label}: ${path} is not valid JSON: ${errorMessage(error)}`);
      worst(1);
      continue;
    }
    const commit = typeof raw?.commit === "string" ? raw.commit : "";
    if (!commit) {
      lines.push(
        `${label}: ${path} records no commit, so no local citation could be ` +
          "compared to anything",
      );
      worst(1);
      continue;
    }
    if (!hasCommit(commit)) {
      lines.push(
        `${label}: ${path} records commit ${commit}, which is not in this ` +
          "clone. Deepen the checkout (fetch-depth: 0) and run again.",
      );
      worst(2);
      continue;
    }

    const verdict = recheckUpstreamReport(raw, {
      readSource: source(commit),
      incidentalOwners,
    });
    reports.push({ path, commit, ok: verdict.ok });
    if (verdict.ok) {
      lines.push(`${label}: ${path} holds at ${commit}`);
      continue;
    }
    lines.push(`${label}: ${path} no longer holds at ${commit}`);
    for (const problem of verdict.problems) lines.push(`  ${problem}`);
    worst(1);
  }

  // 3. The declined Opportunities.
  const declined = readDeclinedOpportunities(read);
  if (declined.length === 0)
    lines.push(`${label}: no declined Opportunity recorded in the adapter`);
  else {
    const { problems } = validateDeclinedOpportunities(declined, {
      knownEcosystems: readDeclaredLeads(read),
      exists,
    });
    if (problems.length === 0)
      lines.push(
        `${label}: ${declined.length} declined Opportunity(s) still point at a ` +
          "declared Ecosystem and a file in the tree",
      );
    for (const problem of problems) {
      const entry = problem.entry ?? {};
      lines.push(
        `${label}: declined_opportunities[${problem.index}] ` +
          `(${entry.ecosystem || "(no ecosystem)"} → ` +
          `${entry.site || "(no site)"}) — ${problem.reason}: ${problem.detail}`,
      );
      worst(1);
    }
  }

  return { exitCode, briefDir, reports, lines };
}

/**
 * The real run over a repository on disk.
 *
 * @param {{repo?: string, label?: string}} [options]
 */
export function checkReportsIn({ repo = process.cwd(), label } = {}) {
  const { read, list, exists } = repoIo(repo);
  return checkReports({
    read,
    list,
    exists,
    hasCommit: (commit) => gitHasCommit(commit, repo),
    source: (commit) => gitSource(commit, repo),
    label,
  });
}

/** Print a result the way every caller of this gate prints it, and exit. */
export function printAndExit(result, { print = false, label = DEFAULT_LABEL } = {}) {
  if (print) console.log(`${label}: brief directory is ${result.briefDir}`);
  const write = result.exitCode === 0 ? console.log : console.error;
  for (const line of result.lines) write(line);
  process.exit(result.exitCode);
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  printAndExit(checkReportsIn({ repo: repoFromArgv(argv) }), {
    print: argv.includes("--print"),
  });
}
