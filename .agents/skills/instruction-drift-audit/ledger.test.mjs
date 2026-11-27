/**
 * Contract suite for the ledger (DESIGN.md §11 and §12).
 *
 * What it proves, one acceptance criterion at a time:
 *   - a checked-and-clear claim whose range covers the new Baseline and whose
 *     quoted instruction text is unchanged is carried forward;
 *   - a claim whose text moved, or whose range no longer covers the Baseline,
 *     is listed for new research — and so is one on a range nobody can read,
 *     or one quoting no instruction text at all;
 *   - prior Upstream Findings come back classified new, resolved, or still
 *     present, in the shape the renderer's Delta section prints;
 *   - with no previous report the delta is absent and nothing is carried;
 *   - a declined Opportunity is suppressed while its Baseline range holds and
 *     its upstream quote is unchanged, and resurfaces on either moving;
 *   - the validator fails a declined entry whose Ecosystem or site is gone.
 *
 * The fixture tree is the same one `report.test.mjs` uses, so "unchanged
 * instruction text" here means what `text-differs` means there.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DECLINED_PROBLEM_REASONS,
  DECLINED_RESURFACE_REASONS,
  RESEARCH_REASONS,
  applyDeclinedOpportunities,
  carryForwardCheckedAndClear,
  classifyFindings,
  computeLedgerDelta,
  findingKey,
  normalizeDeclinedEntry,
  parseDeclinedOpportunitiesFromConfig,
  parseVersionRange,
  rangeCovers,
  selectLatestLedgerReport,
  validateDeclinedOpportunities,
} from "./ledger.mjs";
import { BRIEF_SECTIONS, renderUpstreamBrief } from "./render.mjs";
import { normalizeUpstreamReport } from "./report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = join(HERE, "fixtures", "tree");

/** The tree as the current commit, read the way the skill's CLI reads it. */
const currentTree = (file) => {
  try {
    return readFileSync(join(TREE, file), "utf8");
  } catch {
    return null;
  }
};

const fixtureReport = () => JSON.parse(readFileSync(join(HERE, "fixtures", "report.json"), "utf8"));

/** The ledger as it is committed: the validator's output, not the input. */
const ledger = () => normalizeUpstreamReport(fixtureReport(), { readSource: currentTree });

/** The `next` Ecosystem, whose one checked-and-clear claim holds >=15 <17. */
const NEXT = { lead: "next", baseline: "16.2.6" };

// ── Version ranges ──────────────────────────────────────────────────────────

test("an exact version covers itself and nothing else", () => {
  assert.equal(rangeCovers("16.2.6", "16.2.6"), true);
  assert.equal(rangeCovers("16.2.6", "16.2.7"), false);
});

test("a comparator conjunction covers the versions between its bounds", () => {
  assert.equal(rangeCovers(">=15.0.0 <17.0.0", "16.2.6"), true);
  assert.equal(rangeCovers(">=15.0.0 <17.0.0", "17.0.0"), false);
  assert.equal(rangeCovers(">=15.0.0 <17.0.0", "14.9.9"), false);
});

test("a wildcard tail covers its own line, including the 0.x line", () => {
  assert.equal(rangeCovers("22.x", "22.7.7"), true);
  assert.equal(rangeCovers("22.x", "23.0.0"), false);
  assert.equal(rangeCovers("0.80.x", "0.80.3"), true);
  assert.equal(rangeCovers("0.80.*", "0.81.0"), false);
});

test("caret and tilde are refused by name rather than approximated", () => {
  // `^0.2.3` is `>=0.2.3 <0.3.0` and `^1.2.3` is `>=1.2.3 <2.0.0`. This repo's
  // React Native Ecosystem lives on the 0.x line where that difference decides
  // the answer, and a range read too wide carries a claim forward that should
  // have been researched again.
  for (const range of ["^22.0.0", "~22.7.0", "22 - 23", "latest"]) {
    const parsed = parseVersionRange(range);
    assert.equal(parsed.ok, false, `${range} must not parse`);
    assert.equal(parsed.reason, "unreadable-range");
  }
});

// ── The closed vocabularies ─────────────────────────────────────────────────

test("every reason the ledger emits is one of the reasons it publishes", () => {
  // The three lists call themselves closed. What makes that true is that the
  // call sites reach the table rather than spelling a string again — so this
  // asserts the other half: nothing leaves this module carrying a reason the
  // vocabulary does not name.
  const reasons = (list) => new Set(list);

  const research = reasons(RESEARCH_REASONS);
  const previous = ledger();
  previous.ecosystems[0].checkedAndClear = [
    { ...previous.ecosystems[0].checkedAndClear[0], holdsFor: "^15.0.0" },
    { ...previous.ecosystems[0].checkedAndClear[0], holdsFor: "99.0.0" },
    { ...previous.ecosystems[0].checkedAndClear[0], local: [] },
    {
      ...previous.ecosystems[0].checkedAndClear[0],
      local: [{ file: "gone.md", line: 1, text: "x" }],
    },
  ];
  const carried = carryForwardCheckedAndClear({
    previous,
    ecosystems: [NEXT],
    readCurrent: currentTree,
  });
  assert.equal(carried.toResearch.length, 4);
  for (const entry of carried.toResearch)
    assert.ok(research.has(entry.reason), `unpublished reason ${entry.reason}`);

  const problems = reasons(DECLINED_PROBLEM_REASONS);
  const declined = validateDeclinedOpportunities(
    [
      { ...DECLINED[0], quote: "" },
      { ...DECLINED[0], baselineRange: "^22.0.0" },
      { ...DECLINED[0], ecosystem: "unheard-of" },
      { ...DECLINED[0], site: "tools/scripts/gone.mjs" },
    ],
    { knownEcosystems: ["nx"], exists: (path) => currentTree(path) !== null },
  );
  assert.ok(declined.problems.length >= 4);
  for (const problem of declined.problems)
    assert.ok(problems.has(problem.reason), `unpublished ${problem.reason}`);

  const resurface = reasons(DECLINED_RESURFACE_REASONS);
  const [opportunity] = nxOpportunities();
  for (const [entries, baseline] of [
    [DECLINED, "23.0.1"],
    [[{ ...DECLINED[0], quote: "something else entirely" }], "22.7.7"],
  ]) {
    const applied = applyDeclinedOpportunities([opportunity], entries, {
      lead: "nx",
      baseline,
    });
    assert.equal(applied.resurfaced.length, 1);
    assert.ok(resurface.has(applied.resurfaced[0].reason));
  }
});

// ── Carry-forward ───────────────────────────────────────────────────────────

const carry = (ecosystems, { previous = ledger(), read = currentTree } = {}) =>
  carryForwardCheckedAndClear({ previous, ecosystems, readCurrent: read });

test("a claim whose range covers the new Baseline and whose quote is unchanged is carried forward", () => {
  const result = carry([NEXT]);
  assert.equal(result.toResearch.length, 0);
  assert.equal(result.carriedForward.length, 1);
  assert.equal(result.carriedForward[0].ecosystem, "next");
  assert.match(result.carriedForward[0].claim, /cookies\(\)` is awaited/);
  assert.deepEqual(result.ledgerFor, ["next"]);
});

test("a claim whose quoted instruction text changed is researched again", () => {
  const edited = (file) =>
    file === "instructions.md"
      ? currentTree(file).replace(
          "Always `await cookies()` in a Server Component.",
          "Call `cookies()` however you like.",
        )
      : currentTree(file);

  const result = carry([NEXT], { read: edited });
  assert.equal(result.carriedForward.length, 0);
  assert.equal(result.toResearch.length, 1);
  assert.equal(result.toResearch[0].reason, "instruction-changed");
  assert.match(result.toResearch[0].detail, /instructions\.md:5 — text-differs/);
});

test("a claim whose instruction file is gone is researched again", () => {
  const deleted = (file) => (file === "instructions.md" ? null : currentTree(file));
  const result = carry([NEXT], { read: deleted });
  assert.equal(result.carriedForward.length, 0);
  assert.equal(result.toResearch[0].reason, "instruction-changed");
  assert.match(result.toResearch[0].detail, /file-not-found/);
});

test("a claim whose range no longer covers the Baseline is researched again", () => {
  const result = carry([{ lead: "next", baseline: "17.0.0" }]);
  assert.equal(result.carriedForward.length, 0);
  assert.equal(result.toResearch[0].reason, "baseline-outside-range");
  assert.match(result.toResearch[0].detail, />=15\.0\.0 <17\.0\.0/);
  assert.match(result.toResearch[0].detail, /17\.0\.0/);
});

test("a claim recorded against a range nothing can read is researched again", () => {
  const previous = ledger();
  previous.ecosystems[0].checkedAndClear[0].holdsFor = "^15.0.0";
  const result = carry([NEXT], { previous });
  assert.equal(result.carriedForward.length, 0);
  assert.equal(result.toResearch[0].reason, "unreadable-range");
});

test("a claim quoting no instruction text is researched again, not carried on its range alone", () => {
  // The range says which versions the upstream statement covers. It never says
  // this repo still states what it stated, which is the other half of item 11.
  const previous = ledger();
  previous.ecosystems[0].checkedAndClear[0].local = [];
  const result = carry([NEXT], { previous });
  assert.equal(result.carriedForward.length, 0);
  assert.equal(result.toResearch[0].reason, "no-local-evidence");
});

test("an Ecosystem the ledger has never seen carries nothing and re-researches nothing", () => {
  const result = carry([{ lead: "react-native", baseline: "0.80.3" }]);
  assert.deepEqual(result.carriedForward, []);
  assert.deepEqual(result.toResearch, []);
  assert.deepEqual(result.ledgerFor, []);
});

test("carry-forward refuses to run without a reader for the current commit", () => {
  assert.throws(
    () => carryForwardCheckedAndClear({ previous: ledger(), ecosystems: [] }),
    /readCurrent/,
  );
});

// ── Finding classification ──────────────────────────────────────────────────

const nextFindings = () => ledger().ecosystems.find((eco) => eco.lead === "next").findings;

test("a finding the ledger already carried is still present, not new", () => {
  const delta = classifyFindings({
    previous: ledger(),
    ecosystems: [{ ...NEXT, findings: nextFindings() }],
  });
  assert.equal(delta.newFindings.length, 0);
  assert.equal(delta.resolved.length, 0);
  assert.equal(delta.stillPresent.length, nextFindings().length);
  assert.match(delta.stillPresent[0], /^`next` — mismatch: /);
});

test("a finding the ledger carried that this run did not produce is resolved", () => {
  const delta = classifyFindings({
    previous: ledger(),
    ecosystems: [{ ...NEXT, findings: [] }],
  });
  assert.equal(delta.resolved.length, nextFindings().length);
  assert.equal(delta.stillPresent.length, 0);
});

test("a finding this run produced that the ledger never carried is new", () => {
  const fresh = {
    type: "future-risk",
    urgency: "advisory",
    claim: "The instruction file names a flag the Horizon removes.",
    source: {
      url: "https://nextjs.org/blog/next-17",
      quote: "q",
      pageVersion: "17.0.0",
    },
  };
  const delta = classifyFindings({
    previous: ledger(),
    ecosystems: [{ ...NEXT, findings: [...nextFindings(), fresh] }],
  });
  assert.equal(delta.newFindings.length, 1);
  assert.match(delta.newFindings[0], /names a flag the Horizon removes/);
  assert.equal(delta.stillPresent.length, nextFindings().length);
});

test("a re-indented claim is the same finding, and a re-worded one is not", () => {
  const [first] = nextFindings();
  assert.equal(
    findingKey({ ...first, claim: `  ${first.claim.replace(/ /g, "  ")} ` }),
    findingKey(first),
  );
  assert.notEqual(
    findingKey({ ...first, claim: `${first.claim} And another thing.` }),
    findingKey(first),
  );
});

test("a finding of the same claim on a different page is a different finding", () => {
  const [first] = nextFindings();
  assert.notEqual(
    findingKey({ ...first, source: { ...first.source, url: "https://x" } }),
    findingKey(first),
  );
});

// ── No previous report ──────────────────────────────────────────────────────

test("with no previous report the delta is absent and everything is researched", () => {
  const result = computeLedgerDelta({
    previous: null,
    ecosystems: [{ ...NEXT, findings: nextFindings() }],
    readCurrent: currentTree,
  });
  assert.equal(result.delta, null);
  assert.deepEqual(result.carriedForward, []);
  assert.deepEqual(result.toResearch, []);
  assert.deepEqual(result.ledgerFor, []);
});

test("the delta the ledger computes is the delta the report contract accepts", () => {
  const result = computeLedgerDelta({
    previous: ledger(),
    ecosystems: [{ ...NEXT, findings: [] }],
    readCurrent: currentTree,
  });
  const raw = fixtureReport();
  raw.delta = result.delta;
  const normalized = normalizeUpstreamReport(raw, { readSource: currentTree });
  assert.deepEqual(normalized.delta, result.delta);

  // ...and the renderer prints it under the section DESIGN.md §11 opens with.
  const brief = renderUpstreamBrief(normalized);
  assert.equal(BRIEF_SECTIONS[0], "Delta");
  const section = brief.slice(brief.indexOf("## Delta"), brief.indexOf("## Upstream Findings"));
  assert.match(section, /- \*\*Resolved:\*\* `next` — mismatch: /);
});

// ── Which report is the ledger ──────────────────────────────────────────────

test("the ledger is the latest committed report that carries the Ecosystem", () => {
  const report = (date, lead) => ({ date, ecosystems: [{ lead }] });
  const reports = [
    { path: "docs/research/a.json", report: report("2026-08-01", "next") },
    { path: "docs/research/c.json", report: report("2026-09-01", "nx") },
    { path: "docs/research/b.json", report: report("2026-08-20", "next") },
  ];
  assert.equal(selectLatestLedgerReport(reports, "next").path, "docs/research/b.json");
  assert.equal(selectLatestLedgerReport(reports, "nx").path, "docs/research/c.json");
  assert.equal(selectLatestLedgerReport(reports, "react-native"), null);
});

test("two reports on one date resolve by path, not by filesystem order", () => {
  const report = { date: "2026-09-17", ecosystems: [{ lead: "nx" }] };
  const forward = [
    { path: "docs/research/a.json", report },
    { path: "docs/research/b.json", report },
  ];
  assert.equal(selectLatestLedgerReport(forward, "nx").path, "docs/research/b.json");
  assert.equal(selectLatestLedgerReport([...forward].reverse(), "nx").path, "docs/research/b.json");
});

// ── Declined Opportunities: the adapter shape ───────────────────────────────

const DECLINED_YAML = `
brief_dir: docs/research

declined_opportunities:
  - ecosystem: nx
    url: https://nx.dev/concepts/inferred-tasks
    site: hygiene.mjs
    reason: tracked for next quarter, not this one
    baseline_range: '>=22.0.0 <23.0.0'
    quote: 'Inferred tasks keep project configuration in step with the tools actually installed.'
  - ecosystem: next
    url: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
    site: instructions.md
    reason: the dashboard routes are being rewritten
    baseline_range: 16.x
    quote: Streaming metadata lets the page shell render before metadata resolves.

instruction_globs:
  - AGENTS.md
`;

test("declined entries are read out of the adapter, values running to end of line", () => {
  const entries = parseDeclinedOpportunitiesFromConfig(DECLINED_YAML);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], {
    ecosystem: "nx",
    url: "https://nx.dev/concepts/inferred-tasks",
    site: "hygiene.mjs",
    reason: "tracked for next quarter, not this one",
    baselineRange: ">=22.0.0 <23.0.0",
    quote: "Inferred tasks keep project configuration in step with the tools actually installed.",
  });
  // A URL keeps its colons, and the block stops at the next top-level key.
  assert.equal(entries[1].baselineRange, "16.x");
});

test("an adapter declaring no declined Opportunities parses to none", () => {
  assert.deepEqual(parseDeclinedOpportunitiesFromConfig("brief_dir: docs/research\n"), []);
});

test("a JSON adapter entry normalizes to the same fields", () => {
  assert.deepEqual(
    normalizeDeclinedEntry({
      ecosystem: "nx",
      url: "https://nx.dev/x",
      site: "hygiene.mjs",
      reason: "no",
      baseline_range: "22.x",
      quote: "q",
      unknown_key: "dropped",
    }),
    {
      ecosystem: "nx",
      url: "https://nx.dev/x",
      site: "hygiene.mjs",
      reason: "no",
      baselineRange: "22.x",
      quote: "q",
    },
  );
});

// ── Declined Opportunities: validation ──────────────────────────────────────

const DECLINED = parseDeclinedOpportunitiesFromConfig(DECLINED_YAML);

const validate = (entries, { leads = ["nx", "next"], tree = currentTree } = {}) =>
  validateDeclinedOpportunities(entries, {
    knownEcosystems: leads,
    exists: (path) => tree(path) !== null,
  });

test("declined entries pointing at a declared Ecosystem and a real file hold", () => {
  const result = validate(DECLINED);
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
});

test("a declined entry whose Ecosystem is no longer declared fails", () => {
  const result = validate(DECLINED, { leads: ["next"] });
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].reason, "unknown-ecosystem");
  assert.match(result.problems[0].detail, /"nx" is not a declared Ecosystem/);
});

test("a declined entry whose local site path is gone fails", () => {
  const result = validate([{ ...DECLINED[0], site: "tools/scripts/gone.mjs" }]);
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].reason, "site-not-found");
});

test("a declined entry missing identity, a reason, a range, or the quote fails", () => {
  for (const field of ["ecosystem", "url", "site", "reason", "baselineRange", "quote"]) {
    const result = validate([{ ...DECLINED[0], [field]: "" }]);
    assert.equal(result.ok, false, `${field} must be required`);
    assert.equal(result.problems[0].reason, "malformed");
    assert.match(
      result.problems[0].detail,
      new RegExp(field === "baselineRange" ? "baselineRange" : field),
    );
  }
});

test("a declined entry recorded against an unreadable range fails", () => {
  const result = validate([{ ...DECLINED[0], baselineRange: "^22.0.0" }]);
  assert.equal(result.ok, false);
  assert.equal(result.problems[0].reason, "unreadable-range");
});

test("validation refuses to run without a reader for the current tree", () => {
  assert.throws(() => validateDeclinedOpportunities(DECLINED, { knownEcosystems: [] }), /exists/);
});

// ── Declined Opportunities: suppression ─────────────────────────────────────

const nxOpportunities = () => ledger().ecosystems.find((eco) => eco.lead === "nx").opportunities;

test("a declined Opportunity is suppressed while the Baseline holds and the quote is unchanged", () => {
  const result = applyDeclinedOpportunities(nxOpportunities(), DECLINED, {
    lead: "nx",
    baseline: "22.7.7",
  });
  assert.deepEqual(result.kept, []);
  assert.equal(result.suppressed.length, 1);
  assert.deepEqual(result.resurfaced, []);
});

test("a declined Opportunity resurfaces once the Baseline leaves the range", () => {
  const result = applyDeclinedOpportunities(nxOpportunities(), DECLINED, {
    lead: "nx",
    baseline: "23.0.1",
  });
  assert.equal(result.kept.length, 1);
  assert.equal(result.suppressed.length, 0);
  assert.equal(result.resurfaced[0].reason, "baseline-left-range");
  assert.ok(DECLINED_RESURFACE_REASONS.includes(result.resurfaced[0].reason));
});

test("a declined Opportunity resurfaces when the upstream quote changes", () => {
  const [opportunity] = nxOpportunities();
  const result = applyDeclinedOpportunities(
    [{ ...opportunity, benefitQuote: "Inferred tasks now also run in CI." }],
    DECLINED,
    { lead: "nx", baseline: "22.7.7" },
  );
  assert.equal(result.kept.length, 1);
  assert.equal(result.resurfaced[0].reason, "quote-changed");
});

test("a re-indented upstream quote is the same quote and stays suppressed", () => {
  const [opportunity] = nxOpportunities();
  const result = applyDeclinedOpportunities(
    [{ ...opportunity, benefitQuote: `  ${opportunity.benefitQuote}\n` }],
    DECLINED,
    { lead: "nx", baseline: "22.7.7" },
  );
  assert.equal(result.suppressed.length, 1);
});

test("identity is the Ecosystem, the URL, and the site — any one differing keeps the Opportunity", () => {
  const [opportunity] = nxOpportunities();
  const at = (baseline) => ({ lead: "nx", baseline });

  const otherEcosystem = applyDeclinedOpportunities([opportunity], DECLINED, at("22.7.7"));
  assert.equal(otherEcosystem.suppressed.length, 1, "the matching case");

  for (const mutate of [
    (o) => ({ ...o, source: { ...o.source, url: "https://nx.dev/other" } }),
    (o) => ({ ...o, local: [{ ...o.local[0], file: "instructions.md" }] }),
  ])
    assert.equal(
      applyDeclinedOpportunities([mutate(opportunity)], DECLINED, at("22.7.7")).kept.length,
      1,
    );

  assert.equal(
    applyDeclinedOpportunities([opportunity], DECLINED, {
      lead: "next",
      baseline: "16.2.6",
    }).kept.length,
    1,
  );
});

test("an unreadable declined range suppresses nothing", () => {
  // The other direction from carry-forward, and the same rule: when the ledger
  // cannot say, the human sees the Opportunity. The gate refuses the entry
  // outright, so this is the belt to that braces.
  const result = applyDeclinedOpportunities(
    nxOpportunities(),
    [{ ...DECLINED[0], baselineRange: "^22.0.0" }],
    { lead: "nx", baseline: "22.7.7" },
  );
  assert.equal(result.kept.length, 1);
  assert.match(result.resurfaced[0].detail, /covers no Baseline/);
});

test("a decline appended at a later Baseline suppresses even when an earlier one no longer holds", () => {
  const stale = { ...DECLINED[0], baselineRange: "21.x" };
  const result = applyDeclinedOpportunities(nxOpportunities(), [stale, DECLINED[0]], {
    lead: "nx",
    baseline: "22.7.7",
  });
  assert.deepEqual(result.kept, []);
  assert.equal(result.suppressed.length, 1);
  assert.equal(result.suppressed[0].entry.baselineRange, DECLINED[0].baselineRange);
  assert.deepEqual(result.resurfaced, []);
});

test("same-day ledger reports tie-break by code point, not locale", () => {
  const day = (path) => ({ path, report: { date: "2026-01-01", ecosystems: [{ lead: "nx" }] } });
  const reports = [
    day("b/2026-01-01-upstream-brief-nx.json"),
    day("b/2026-01-01-upstream-brief-nx-next.json"),
  ];
  // "." (0x2E) sorts after "-" (0x2D) whatever the machine's locale.
  for (const order of [reports, [...reports].reverse()])
    assert.equal(selectLatestLedgerReport(order, "nx").path, "b/2026-01-01-upstream-brief-nx.json");
});

test("a pre-release Baseline is covered only by a range naming a pre-release of its version (semver)", () => {
  const covers = (range, version) => parseVersionRange(range).covers(version);
  // Named on the same major.minor.patch: covered, and still bounded.
  assert.equal(covers(">=16.0.0-canary.1 <17.0.0", "16.0.0-canary.3"), true);
  assert.equal(covers(">=16.0.0-canary.5 <17.0.0", "16.0.0-canary.3"), false);
  assert.equal(covers("16.0.0-canary.3", "16.0.0-canary.3"), true);
  assert.equal(covers("16.0.0-canary.3", "16.0.0-canary.3+sha.1"), true);
  // Not named: never covered, inside the bounds or at the next major.
  assert.equal(covers(">=15.0.0 <17.0.0", "16.0.0-canary.3"), false);
  assert.equal(covers(">=15.0.0 <17.0.0", "17.0.0-canary.1"), false);
  assert.equal(covers("<=17.0.0", "17.0.0-rc.1"), false);
  assert.equal(covers("16.x", "16.0.0-canary.3"), false);
  assert.equal(covers("16.0.0", "16.0.0-canary.3"), false);
  // Releases and build metadata are unaffected.
  assert.equal(covers(">=15.0.0 <17.0.0", "16.2.6"), true);
  assert.equal(covers("16.x", "16.2.6+sha.1"), true);
  assert.equal(covers("22.x", "not-a-version"), false);

  // A decline at the release line resurfaces at the next major's release candidate.
  const declined = { ...DECLINED[0], baselineRange: ">=22.0.0 <23.0.0" };
  const result = applyDeclinedOpportunities(nxOpportunities(), [declined], {
    lead: "nx",
    baseline: "23.0.0-rc.1",
  });
  assert.equal(result.suppressed.length, 0);
  assert.equal(result.resurfaced[0].reason, "baseline-left-range");
});
