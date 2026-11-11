#!/usr/bin/env node
// Suggests a new brief for each Ecosystem whose Baseline has left the range
// its latest committed report recorded (DESIGN.md §14).
//
//   node "<skill>/suggest-run.mjs" [--repo <dir>]
//
// Meant for a host's dependency-change hook: after an install, upgrade, or
// removal, print one line per Ecosystem worth a new run. It prints and exits
// 0, always. It never invokes the skill — the run is the human's call.
//
// For each declared Ecosystem with a committed report:
//   1. resolve the installed Baseline (the package resolver);
//   2. find the latest committed report that carries it (the ledger);
//   3. if any checked-and-clear claim's `holdsFor` range no longer covers the
//      Baseline, the Ecosystem has moved and needs a new brief.
// A missing adapter, missing reports, an uninstalled lead, or an unreadable
// range all mean "no suggestion". A suggestion is cheap to ignore and an
// error in a hook is not.
//
// Range parsing and the ledger lookup are `ledger.mjs`'s, imported rather than
// re-implemented: a range this treats as covering is a range a run would carry
// forward.
import { join } from "node:path";

import { readAdapter } from "./adapter.mjs";
import { isEntryPoint } from "./entry-point.mjs";
import { RESEARCH, carryForwardCheckedAndClear, selectLatestLedgerReport } from "./ledger.mjs";
import { resolverFor } from "./npm-resolver.mjs";
import { repoFromArgv, repoIo } from "./repo-io.mjs";
import {
  DEFAULT_BRIEF_DIR,
  readBriefDir,
  readCommittedReports,
  readDeclaredLeads,
} from "./resolve-ledger.mjs";

/** The command a suggestion names: this skill's own invocation. */
export const SKILL_COMMAND = "/instruction-drift-audit";

/** Reads absolute paths as given; used for a brief directory already joined to the repo. */
const absoluteIo = () => repoIo("");

/** The installed version of one package, or null (the lead only, not companions). */
export const resolveInstalledVersion = (packageName, repoDir = process.cwd()) =>
  resolverFor(repoDir).installedVersion(packageName);

/**
 * The adapter, as far as a suggestion needs it. Null when the repo has no
 * adapter, so a first-time clone does not look like an empty Ecosystem list.
 *
 * @returns {{ecosystems: {lead: string}[], brief_dir: string} | null}
 */
export function loadConfig(repoDir = process.cwd()) {
  const { read } = repoIo(repoDir);
  if (readAdapter(read).path === null) return null;
  return {
    ecosystems: readDeclaredLeads(read)
      .filter(Boolean)
      .map((lead) => ({ lead })),
    brief_dir: readBriefDir(read) ?? DEFAULT_BRIEF_DIR,
  };
}

/**
 * The latest committed report that carries this Ecosystem, or null.
 *
 * @param {string} ecosystemLead
 * @param {string} briefDir an absolute path, or one relative to the working directory
 * @returns {{ecosystems: any[], reportFile: string, [key: string]: unknown} | null}
 */
export function findLatestReport(ecosystemLead, briefDir) {
  const { read, list } = absoluteIo();
  const found = selectLatestLedgerReport(readCommittedReports(read, list, briefDir), ecosystemLead);
  if (!found) return null;
  return { ...found.report, reportFile: found.path };
}

/**
 * The lead, when its Baseline has left the range its latest report recorded;
 * otherwise null.
 */
export function checkEcosystemBaseline(ecosystemLead, briefDir, repoDir = process.cwd()) {
  const currentBaseline = resolveInstalledVersion(ecosystemLead, repoDir);
  if (!currentBaseline) return null;

  const report = findLatestReport(ecosystemLead, briefDir);
  if (!report) return null;

  const ecosystems = Array.isArray(report.ecosystems) ? report.ecosystems : [];
  const ecosystem = ecosystems.find((e) => e?.lead === ecosystemLead);
  if (!ecosystem) return null;
  if (ecosystem.baseline === currentBaseline) return null;

  const checkedAndClear = Array.isArray(ecosystem.checkedAndClear) ? ecosystem.checkedAndClear : [];
  if (checkedAndClear.length === 0) return ecosystemLead;

  const { toResearch } = carryForwardCheckedAndClear({
    previous: report,
    ecosystems: [{ lead: ecosystemLead, baseline: currentBaseline }],
    readCurrent: repoIo(repoDir).read,
  });
  return toResearch.some((item) => item?.reason === RESEARCH.baselineOutsideRange)
    ? ecosystemLead
    : null;
}

/**
 * Every declared Ecosystem that needs a new brief.
 *
 * @returns {string[]} the leads
 */
export function suggestRuns(repoDir = process.cwd()) {
  const config = loadConfig(repoDir);
  if (!config) return [];
  const briefDirPath = join(repoDir, config.brief_dir || DEFAULT_BRIEF_DIR);
  return config.ecosystems
    .map(({ lead }) => checkEcosystemBaseline(lead, briefDirPath, repoDir))
    .filter(Boolean);
}

/** The line a hook prints for one suggestion. */
export const suggestionLine = (lead) => `Run ${SKILL_COMMAND} ${lead} — its Baseline has moved.`;

if (isEntryPoint(import.meta.url))
  for (const lead of suggestRuns(repoFromArgv(process.argv.slice(2))))
    console.log(suggestionLine(lead));
