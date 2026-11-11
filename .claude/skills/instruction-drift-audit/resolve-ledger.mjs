#!/usr/bin/env node
// Prints what an Upstream Brief run would remember (DESIGN.md §11 and §12),
// so a human can see the carry-forward before any research hop spends a token.
//
//   node "<skill>/resolve-ledger.mjs" [--repo <dir>]
//
// For every Ecosystem the adapter declares, it resolves the new Baseline the
// same way `resolve-baseline.mjs` does, finds that Ecosystem's ledger — the
// latest committed structured report in the brief directory that carries it —
// and reports which checked-and-clear claims survive into this run, which go
// back on the research list and why, and which declined Upstream
// Opportunities are still suppressed at the new Baseline.
//
// WHICH TREE THE INSTRUCTION TEXT IS READ FROM
//   The working tree, which is the tree a run about to be made is about. A
//   frozen report is a different question — its citations are compared to the
//   commit it records, and `check-reports.mjs` is what does that.
//
// NOT A GATE. It asserts nothing about the ledger and exits 0, like
// `resolve-baseline.mjs`: a declined entry pointing at a deleted file is a
// failure, and the command that fails on it is `check-reports.mjs`. This one
// reports the same condition so a developer meets it before CI does. It exits
// 1 only when the adapter itself cannot be read.
import { isEntryPoint } from "./entry-point.mjs";
import { DEFAULT_BRIEF_DIR, readAdapter } from "./adapter.mjs";
import {
  applyDeclinedOpportunities,
  carryForwardCheckedAndClear,
  normalizeDeclinedEntry,
  selectLatestLedgerReport,
  validateDeclinedOpportunities,
} from "./ledger.mjs";
import { repoFromArgv, repoIo } from "./repo-io.mjs";
import { adapterProblemLines, resolveDeclaredEcosystems } from "./resolve-baseline.mjs";

const LABEL = "upstream-ledger";
export { DEFAULT_BRIEF_DIR };

/**
 * The adapter's declined entries, keyed off `DECLINED_ADAPTER_KEYS` through
 * `normalizeDeclinedEntry` — the one table of what a declined entry is made of.
 */
export const readDeclinedOpportunities = (read) => {
  const { config } = readAdapter(read);
  return Array.isArray(config.declined_opportunities)
    ? config.declined_opportunities.map(normalizeDeclinedEntry)
    : [];
};

/**
 * The leads the adapter declares, which is what "this Ecosystem still exists"
 * means when a declined entry names one (DESIGN.md §12).
 */
export const readDeclaredLeads = (read) => {
  const { config } = readAdapter(read);
  return Array.isArray(config.ecosystems)
    ? config.ecosystems.map((eco) => String(eco?.lead ?? "").trim())
    : [];
};

/** `brief_dir`, or the default when the adapter does not say. */
export const readBriefDir = (read) => {
  const { config } = readAdapter(read);
  return typeof config.brief_dir === "string" && config.brief_dir.trim()
    ? config.brief_dir.trim()
    : DEFAULT_BRIEF_DIR;
};

/** Every structured report committed in the brief directory, newest last. */
export function readCommittedReports(read, list, briefDir) {
  const names = list(briefDir);
  if (names === null || names === undefined) return [];
  const reports = [];
  for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
    const path = `${briefDir}/${name}`;
    const text = read(path);
    if (text === null || text === undefined) continue;
    try {
      reports.push({ path, report: JSON.parse(text) });
    } catch {
      // A report that is not JSON is the gate's business, not this command's.
    }
  }
  return reports;
}

/**
 * Pure over its inputs, so the contract suite drives fixtures rather than the
 * repository.
 *
 * @param {object} io
 * @param {(path: string) => string|null} io.read a repo file, or null
 * @param {(dir: string) => string[]|null} io.list directory entries, or null
 * @param {(path: string) => boolean} [io.exists] does the current tree carry
 *   that path — asked only of a declined entry's local site, and the same
 *   question the gate asks. It is a seam rather than `read(path) !== null`
 *   because the two must agree: a site that is a directory, or a file this
 *   process cannot read, exists for the gate and would read as
 *   `site-not-found` here, and this command's whole claim is that it reports
 *   the condition `check-reports.mjs` fails on.
 * @param {Array<{lead: string, ok: boolean, baseline?: string, reason?: string}>} io.resolved
 *   the Baseline resolution for every declared Ecosystem
 * @returns {{lines: string[], briefDir: string}}
 */
export function ledgerStatus({
  read,
  list,
  resolved,
  exists = (path) => read(path) !== null && read(path) !== undefined,
}) {
  const briefDir = readBriefDir(read);
  const reports = readCommittedReports(read, list, briefDir);
  const declined = readDeclinedOpportunities(read);
  const lines = [];

  if (resolved.length === 0) lines.push(`${LABEL}: no Ecosystem declared — nothing to remember`);

  for (const ecosystem of resolved) {
    if (!ecosystem.ok) {
      lines.push(`${LABEL}: ${ecosystem.lead} — FAILED: ${ecosystem.reason}`);
      continue;
    }
    const current = { lead: ecosystem.lead, baseline: ecosystem.baseline };
    const found = selectLatestLedgerReport(reports, ecosystem.lead);
    if (!found) {
      // Said out loud: a first run has no ledger and researches everything,
      // which must not read like a run that carried nothing forward.
      lines.push(
        `${LABEL}: ${ecosystem.lead} — no committed report in ${briefDir} ` +
          `carries this Ecosystem; the first run at Baseline ${ecosystem.baseline} ` +
          "researches everything",
      );
      continue;
    }

    const { carriedForward, toResearch } = carryForwardCheckedAndClear({
      previous: found.report,
      ecosystems: [current],
      readCurrent: read,
    });
    lines.push(
      `${LABEL}: ${ecosystem.lead} — ledger ${found.path} (${found.report.date}); ` +
        `at Baseline ${ecosystem.baseline}, ${carriedForward.length} claim(s) ` +
        `carried forward, ${toResearch.length} researched again`,
    );
    for (const claim of carriedForward)
      lines.push(`  carried: ${claim.claim} (holds for ${claim.holdsFor})`);
    for (const claim of toResearch)
      lines.push(`  research: ${claim.claim} — ${claim.reason}: ${claim.detail}`);

    const opportunities = Array.isArray(found.ecosystem?.opportunities)
      ? found.ecosystem.opportunities
      : [];
    const { suppressed, resurfaced } = applyDeclinedOpportunities(opportunities, declined, current);
    for (const { opportunity, entry } of suppressed)
      lines.push(
        `  declined: ${opportunity.technique} — suppressed at ${ecosystem.baseline} ` +
          `(${entry.baselineRange}): ${entry.reason}`,
      );
    for (const item of resurfaced)
      lines.push(`  resurfaced: ${item.opportunity.technique} — ${item.reason}: ${item.detail}`);
  }

  const problems = validateDeclinedOpportunities(declined, {
    knownEcosystems: resolved.map((eco) => eco.lead),
    exists,
  }).problems;
  if (declined.length === 0)
    lines.push(`${LABEL}: no declined Opportunity recorded in the adapter`);
  for (const problem of problems)
    lines.push(
      `${LABEL}: declined_opportunities[${problem.index}] (${problem.entry.ecosystem} ` +
        `→ ${problem.entry.site}) — ${problem.reason}: ${problem.detail}. ` +
        "`check-reports.mjs` fails on this.",
    );

  return { lines, briefDir };
}

function main(argv) {
  const repo = repoFromArgv(argv);
  const { read, list, exists } = repoIo(repo);
  const { results, adapterPath, problems } = resolveDeclaredEcosystems({
    repo,
  });
  for (const line of adapterProblemLines(LABEL, adapterPath, problems)) console.error(line);
  for (const line of ledgerStatus({ read, list, exists, resolved: results }).lines)
    console.log(line);
  if (problems.length) process.exitCode = 1;
}

if (isEntryPoint(import.meta.url)) main(process.argv.slice(2));
