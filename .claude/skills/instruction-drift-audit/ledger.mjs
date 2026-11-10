/**
 * The ledger: what one Upstream Brief run remembers from the last one
 * (DESIGN.md §11 and §12).
 *
 * Two kinds of memory live here, and they are the same kind of decision twice:
 *
 *   CARRY-FORWARD (item 11). The latest committed report for an Ecosystem is
 *   its ledger. A checked-and-clear Instruction Claim whose recorded range
 *   still covers the new Baseline, and whose quoted instruction text is
 *   unchanged at the current commit, is carried forward without new research.
 *   Everything else goes back on the research list. The brief then opens with
 *   a delta: findings that are new, findings the last run reported that are
 *   gone, and findings still present.
 *
 *   DECLINED OPPORTUNITIES (item 12). An Upstream Opportunity a human said no
 *   to is recorded in the adapter, and is suppressed while the Baseline stays
 *   in the range it was declined at and the upstream quote is unchanged. It
 *   resurfaces otherwise, because "no, not at 22" is not "no, forever".
 *
 * WHICH WAY EACH ONE FAILS, AND WHY THEY DIFFER
 *   A range this module cannot read fails **closed** for a carry-forward (the
 *   claim is researched again) and **open** for a decline (the Opportunity
 *   resurfaces). Those look opposite and are the same rule: when the ledger
 *   cannot say, the run does the work and the human sees the result. The
 *   expensive direction is the other one — a claim carried forward on a range
 *   nobody parsed, or an Opportunity silenced by an entry nobody could read.
 *
 * WHY THE RANGE GRAMMAR IS SMALL AND CLOSED
 *   `holdsFor` and a decline's Baseline range are compared against a version,
 *   so this module parses three forms and refuses everything else: an exact
 *   version (`16.2.6`), a wildcard tail (`22.x`, `0.80.x`), and a conjunction
 *   of comparators (`>=15.0.0 <17.0.0`). Caret and tilde are deliberately NOT
 *   accepted: `^0.2.3` means `>=0.2.3 <0.3.0` and `^1.2.3` means
 *   `>=1.2.3 <2.0.0`, and an Ecosystem on a 0.x line (React Native, for
 *   one) is exactly where that subtlety decides the answer. A range misread in that
 *   direction carries a claim forward that should have been re-researched,
 *   which is the one outcome the ledger exists to prevent — so an unrecognised
 *   spelling is refused by name rather than approximated.
 *
 * WHY THIS FILE IMPORTS ONLY ITS SIBLINGS
 *   The skill is portable (DESIGN.md, Boundary). Every reader is
 *   injected, exactly as in `report.mjs` and `baseline.mjs`, so this module
 *   touches no filesystem and a caller may drive it from a worktree, a git
 *   object, or a fixture map. `report.test.mjs` asserts that import-freedom
 *   over every module in this directory, this one included.
 *
 *   The three things it does import from `report.mjs` — whitespace collapsing,
 *   version comparison, and local-evidence verification — are imported rather
 *   than re-implemented because the ledger's answer must agree with the
 *   contract's. "The quoted instruction text is unchanged" has to mean the
 *   same thing here as `text-differs` means there, or a claim could be carried
 *   forward on a quote the validator would refuse.
 */

import { parseAdapterYaml } from "./adapter.mjs";
import {
  VERSION_NUMBER,
  collapseWhitespace,
  compareVersions,
  verifyLocalEvidence,
} from "./report.mjs";

// ── Version ranges ──────────────────────────────────────────────────────────

/** The comparators a conjunction may be built from, longest spelling first. */
const COMPARATORS = /** @type {const} */ ([">=", "<=", ">", "<", "="]);

/**
 * A version number, pre-release and build tails included: the same set
 * `compareVersions` orders, so a pre-release Baseline is compared against a
 * range rather than refused by it.
 */
const VERSION = VERSION_NUMBER;

/** `16.0.0-canary.3+sha` -> `16.0.0`: the numeric core. */
const coreOf = (version) => String(version).trim().replace(/^v/, "").split(/[-+]/)[0];

/** Does a version carry a pre-release tail (`-canary.3`)? Build metadata does not count. */
const isPrerelease = (version) => coreOf(version) !== stripBuild(version);
const stripBuild = (version) => String(version).trim().replace(/^v/, "").split("+")[0];

/**
 * node-semver's pre-release rule (LEDGER.md, Version ranges): a pre-release
 * is covered only when the range names a pre-release of the same
 * `major.minor.patch`. Ordering alone would let `<17.0.0` cover
 * `17.0.0-canary.1`, and `>=15.0.0 <17.0.0` carry a claim forward onto a
 * pre-release of the next major, where breaking changes land. Not covering
 * one sends the claim back to research, the safe direction.
 */
const prereleaseAllowed = (version, bounds) =>
  !isPrerelease(version) ||
  bounds.some(
    (bound) => isPrerelease(bound) && compareVersions(coreOf(bound), coreOf(version)) === 0,
  );

/** A wildcard tail: `22.x`, `22.7.x`, `0.80.*`. */
const WILDCARD = /^v?(\d+(?:\.\d+)*)\.(?:x|\*)$/i;

/**
 * Why a range string could not be turned into a test. One reason, because a
 * range is readable or it is not — listing every way a malformed string is
 * malformed buries the claim it was attached to.
 */
export const UNREADABLE_RANGE = "unreadable-range";

/**
 * Parse a version range into something that can be asked about a version.
 *
 * @param {unknown} text a range as a report or an adapter records it
 * @returns {{ok: true, source: string, covers: (version: string) => boolean}
 *          | {ok: false, reason: string, detail: string}}
 */
export function parseVersionRange(text) {
  const source = typeof text === "string" ? text.trim() : "";
  const refuse = (detail) => ({ ok: false, reason: UNREADABLE_RANGE, detail });
  if (source === "") return refuse("the range is absent or empty");

  const wildcard = source.match(WILDCARD);
  if (wildcard) {
    const prefix = wildcard[1].split(".").map(Number);
    return {
      ok: true,
      source,
      covers(version) {
        // A wildcard names no pre-release, so it covers none (semver).
        if (!VERSION.test(String(version).trim()) || isPrerelease(version)) return false;
        const parts = coreOf(version).split(".");
        return prefix.every((segment, index) => Number(parts[index]) === segment);
      },
    };
  }

  if (VERSION.test(source)) {
    return {
      ok: true,
      source,
      covers: (version) =>
        VERSION.test(String(version).trim()) && compareVersions(version, source) === 0,
    };
  }

  /** @type {Array<{comparator: string, version: string}>} */
  const terms = [];
  for (const token of source.split(/\s+/)) {
    const comparator = COMPARATORS.find((c) => token.startsWith(c));
    if (!comparator)
      return refuse(
        `"${token}" is not an exact version, a wildcard tail, or a comparator — ` +
          `the readable forms are 16.2.6, 22.x, and >=15.0.0 <17.0.0`,
      );
    const version = token.slice(comparator.length);
    if (!VERSION.test(version))
      return refuse(`"${token}" names no version this module can compare`);
    terms.push({ comparator, version });
  }
  if (terms.length === 0) return refuse("the range names no version");

  return {
    ok: true,
    source,
    covers(version) {
      if (!VERSION.test(String(version).trim())) return false;
      if (
        !prereleaseAllowed(
          version,
          terms.map((term) => term.version),
        )
      )
        return false;
      return terms.every(({ comparator, version: bound }) => {
        const order = compareVersions(version, bound);
        switch (comparator) {
          case ">=":
            return order >= 0;
          case ">":
            return order > 0;
          case "<=":
            return order <= 0;
          case "<":
            return order < 0;
          default:
            return order === 0;
        }
      });
    },
  };
}

/**
 * Does `range` cover `version`? An unreadable range covers nothing — the two
 * callers here each decide for themselves what that means.
 */
export function rangeCovers(range, version) {
  const parsed = parseVersionRange(range);
  return parsed.ok && parsed.covers(version);
}

// ── Carry-forward ───────────────────────────────────────────────────────────

/**
 * Why a checked-and-clear claim is researched again rather than carried
 * forward. Closed, because the run reports these back to the human and a
 * free-text reason is one nobody can count.
 *
 * Every call site below reaches this table rather than spelling the string
 * again, which is what makes "closed" a fact instead of a comment: a reason
 * nobody can write by hand is a reason that cannot drift out of the list.
 * `RESEARCH_REASONS` is the same vocabulary as a list, for a caller that wants
 * to check membership — the two cannot disagree, because one is derived.
 */
export const RESEARCH = /** @type {const} */ ({
  unreadableRange: UNREADABLE_RANGE,
  baselineOutsideRange: "baseline-outside-range",
  noLocalEvidence: "no-local-evidence",
  instructionChanged: "instruction-changed",
});

export const RESEARCH_REASONS = Object.values(RESEARCH);

/**
 * Decide, for one Ecosystem, which of the previous run's checked-and-clear
 * claims survive into this one.
 *
 * @param {{checkedAndClear?: unknown[]}} previousEcosystem the ledger's entry
 *   for this Ecosystem, straight out of the latest committed normalized report
 * @param {{lead: string, baseline: string}} current
 * @param {(file: string) => string|null|undefined} readCurrent file contents
 *   at the **current** commit — not at the commit the ledger records. The
 *   whole question is whether the instruction text moved since, so reading it
 *   back at the commit it was checked at would answer nothing.
 * @returns {{carriedForward: object[], toResearch: object[]}}
 */
function carryForwardOne(previousEcosystem, current, readCurrent) {
  const carriedForward = [];
  const toResearch = [];
  const claims = Array.isArray(previousEcosystem?.checkedAndClear)
    ? previousEcosystem.checkedAndClear
    : [];

  for (const entry of claims) {
    const claim =
      typeof entry?.claim === "string" && entry.claim.trim()
        ? entry.claim.trim()
        : "(no claim recorded)";
    const research = (reason, detail) =>
      toResearch.push({
        ecosystem: current.lead,
        claim,
        holdsFor: typeof entry?.holdsFor === "string" ? entry.holdsFor : "",
        reason,
        detail,
      });

    const range = parseVersionRange(entry?.holdsFor);
    if (!range.ok) {
      research(range.reason, range.detail);
      continue;
    }
    if (!range.covers(current.baseline)) {
      research(
        RESEARCH.baselineOutsideRange,
        `the claim was recorded as holding for ${range.source}, and the new ` +
          `Baseline is ${current.baseline}`,
      );
      continue;
    }

    // DESIGN.md §11 carries a claim forward on its *quoted instruction
    // text* being unchanged. A claim quoting no instruction text has nothing
    // that could be shown unchanged, so it is researched again rather than
    // carried on the range alone — the range says which versions the upstream
    // statement covers, never that this repo still says what it said.
    const local = Array.isArray(entry?.local) ? entry.local : [];
    if (local.length === 0) {
      research(
        RESEARCH.noLocalEvidence,
        "the claim quotes no instruction text, so nothing about this repo " +
          "can be shown unchanged",
      );
      continue;
    }

    const changed = local
      .map((citation) => ({
        citation,
        verdict: verifyLocalEvidence(citation, readCurrent),
      }))
      .find(({ verdict }) => !verdict.ok);
    if (changed) {
      research(
        RESEARCH.instructionChanged,
        `${changed.citation.file}:${changed.citation.line} — ` +
          `${changed.verdict.reason} at the current commit`,
      );
      continue;
    }

    carriedForward.push({ ecosystem: current.lead, ...entry });
  }

  return { carriedForward, toResearch };
}

/**
 * Which checked-and-clear claims this run may skip, and which it must do
 * again. Runs **before** the research hops — that is the point of it.
 *
 * An Ecosystem the ledger has never seen contributes nothing to either list:
 * it has no memory, so it carries nothing forward and there is nothing
 * remembered to re-check. Everything about it is researched by default.
 *
 * @param {object} input
 * @param {object|null} input.previous the latest committed normalized report
 *   for these Ecosystems, or null on the first run
 * @param {Array<{lead: string, baseline: string}>} input.ecosystems this run's
 *   resolved Ecosystems, each with its **new** Baseline
 * @param {(file: string) => string|null|undefined} input.readCurrent
 * @returns {{carriedForward: object[], toResearch: object[], ledgerFor: string[]}}
 *   `ledgerFor` names the Ecosystems that had a ledger at all, so a caller can
 *   tell "nothing carried forward" from "nothing to carry forward from".
 */
export function carryForwardCheckedAndClear({ previous, ecosystems, readCurrent }) {
  if (typeof readCurrent !== "function")
    throw new TypeError(
      "carryForwardCheckedAndClear needs a readCurrent(file) reader for the current commit",
    );

  const carriedForward = [];
  const toResearch = [];
  const ledgerFor = [];

  for (const eco of ecosystems ?? []) {
    const previousEcosystem = findEcosystem(previous, eco.lead);
    if (!previousEcosystem) continue;
    ledgerFor.push(eco.lead);
    const result = carryForwardOne(previousEcosystem, eco, readCurrent);
    carriedForward.push(...result.carriedForward);
    toResearch.push(...result.toResearch);
  }

  return { carriedForward, toResearch, ledgerFor };
}

/** The ledger's entry for one lead, or null when it has never seen it. */
function findEcosystem(report, lead) {
  const ecosystems = Array.isArray(report?.ecosystems) ? report.ecosystems : [];
  return ecosystems.find((eco) => eco?.lead === lead) ?? null;
}

// ── Finding classification ──────────────────────────────────────────────────

/**
 * What makes two Upstream Findings the same finding across two runs: its
 * type, the upstream page it cites, and its claim with whitespace collapsed
 * and case folded.
 *
 * There is no finding id in the contract to match on, and inventing one a
 * worker writes would make "is this the same finding?" a thing a worker
 * decides. This key is conservative in the direction that matters: a re-worded
 * claim reads as one resolved plus one new, which over-reports movement, where
 * a looser key (the URL alone) would quietly merge two different findings
 * about one page and report neither.
 */
export function findingKey(finding) {
  return [
    String(finding?.type ?? ""),
    String(finding?.source?.url ?? ""),
    collapseWhitespace(finding?.claim ?? "").toLowerCase(),
  ].join(" | ");
}

/** How a finding reads in the brief's delta section. */
const deltaLine = (lead, finding) =>
  `\`${lead}\` — ${finding?.type ?? "finding"}: ${collapseWhitespace(finding?.claim ?? "(no claim recorded)")}`;

/**
 * Classify this run's findings against the ledger's: new, resolved, or still
 * present. Runs **after** the research hops.
 *
 * Returns the `{newFindings, resolved, stillPresent}` shape the report
 * contract validates and the renderer's Delta section prints, each an array of
 * strings, or `null` when no named Ecosystem had a ledger — a first run has no
 * delta to open with, which is exactly what an absent `delta` key means
 * (DESIGN.md §11).
 *
 * An Ecosystem with no ledger is left out of all three lists rather than
 * having its findings called new: "new" is a claim about what changed since
 * last time, and there was no last time.
 *
 * @param {object} input
 * @param {object|null} input.previous the latest committed normalized report
 * @param {Array<{lead: string, findings?: object[]}>} input.ecosystems
 * @returns {{newFindings: string[], resolved: string[], stillPresent: string[]}|null}
 */
export function classifyFindings({ previous, ecosystems }) {
  const newFindings = [];
  const resolved = [];
  const stillPresent = [];
  let sawLedger = false;

  for (const eco of ecosystems ?? []) {
    const previousEcosystem = findEcosystem(previous, eco.lead);
    if (!previousEcosystem) continue;
    sawLedger = true;

    const before = new Map(
      (Array.isArray(previousEcosystem.findings) ? previousEcosystem.findings : []).map(
        (finding) => [findingKey(finding), finding],
      ),
    );
    const seen = new Set();

    for (const finding of eco.findings ?? []) {
      const key = findingKey(finding);
      seen.add(key);
      (before.has(key) ? stillPresent : newFindings).push(deltaLine(eco.lead, finding));
    }
    for (const [key, finding] of before)
      if (!seen.has(key)) resolved.push(deltaLine(eco.lead, finding));
  }

  return sawLedger ? { newFindings, resolved, stillPresent } : null;
}

/**
 * The whole ledger read in one call, for a caller that already holds this
 * run's findings: what was carried forward, what must be researched again,
 * and the delta to put on the report.
 *
 * `delta` is `null` on a first run and is otherwise ready to assign to the
 * report's `delta` key — the contract validates that shape and the renderer
 * prints it.
 */
export function computeLedgerDelta({ previous, ecosystems, readCurrent }) {
  const { carriedForward, toResearch, ledgerFor } = carryForwardCheckedAndClear({
    previous,
    ecosystems,
    readCurrent,
  });
  return {
    delta: classifyFindings({ previous, ecosystems }),
    carriedForward,
    toResearch,
    ledgerFor,
  };
}

/**
 * The ledger itself: the latest committed report that carries this Ecosystem.
 *
 * Latest by the report's own recorded date, ties broken by path (by code
 * point, not locale) so two reports written on one day resolve the same way
 * on every machine. The tie-break is deterministic, not chronological: a
 * report records a date, not a time, so two runs naming the same Ecosystem on
 * one day cannot be ordered by when they ran. A report that
 * does not name this lead is not this Ecosystem's ledger however recent it is.
 *
 * @param {Array<{path: string, report: object}>} reports
 * @param {string} lead
 * @returns {{path: string, report: object, ecosystem: object}|null}
 */
/** Locale-independent order: `localeCompare` differs between machines. */
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function selectLatestLedgerReport(reports, lead) {
  const candidates = (reports ?? [])
    .filter(({ report }) => findEcosystem(report, lead))
    .sort((a, b) => {
      const byDate = byCodePoint(String(a.report?.date ?? ""), String(b.report?.date ?? ""));
      return byDate !== 0 ? byDate : byCodePoint(String(a.path), String(b.path));
    });
  const latest = candidates[candidates.length - 1];
  return latest
    ? {
        path: latest.path,
        report: latest.report,
        ecosystem: findEcosystem(latest.report, lead),
      }
    : null;
}

// ── Declined Upstream Opportunities ─────────────────────────────────────────

/**
 * The adapter keys one declined entry carries (DESIGN.md §12), and the
 * field each becomes. Identity is the first three: the Ecosystem, the upstream
 * page, and the local site. `reason` is the one-line why, `baseline_range` is
 * what it was declined at, and `quote` is the upstream statement at the time.
 */
export const DECLINED_ADAPTER_KEYS = {
  ecosystem: "ecosystem",
  url: "url",
  site: "site",
  reason: "reason",
  baseline_range: "baselineRange",
  quote: "quote",
};

/**
 * Every field a declined entry must carry, which is every field it has: each
 * one of them is either half of its identity, the decision itself, or one of
 * the two axes that lift the suppression. Derived from the adapter table above
 * rather than written out again, so a key added there cannot become a field
 * nothing checks.
 */
export const DECLINED_REQUIRED_FIELDS = Object.values(DECLINED_ADAPTER_KEYS);

/**
 * Why a declined entry is not a declined entry. Closed, and each one fails.
 * Reached from the call sites, for the reason written on `RESEARCH` above.
 */
export const DECLINED_PROBLEM = /** @type {const} */ ({
  malformed: "malformed",
  unreadableRange: UNREADABLE_RANGE,
  unknownEcosystem: "unknown-ecosystem",
  siteNotFound: "site-not-found",
});

export const DECLINED_PROBLEM_REASONS = Object.values(DECLINED_PROBLEM);

/** Why a declined Opportunity came back. Closed, and each one is reported. */
export const DECLINED_RESURFACE = /** @type {const} */ ({
  baselineLeftRange: "baseline-left-range",
  quoteChanged: "quote-changed",
});

export const DECLINED_RESURFACE_REASONS = Object.values(DECLINED_RESURFACE);

const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : "");

/**
 * One entry, from either adapter dialect: a `.json` adapter's snake_case keys
 * or the camelCase a caller already holding objects would write. Unknown keys
 * are dropped rather than carried, so a typo'd key reads as an absent field
 * and is refused by name instead of travelling as data nobody checks.
 */
export function normalizeDeclinedEntry(raw) {
  const entry = {};
  for (const [adapterKey, field] of Object.entries(DECLINED_ADAPTER_KEYS))
    entry[field] = text(raw?.[adapterKey] ?? raw?.[field]);
  return entry;
}

/**
 * `declined_opportunities:` out of a YAML adapter, read by the one adapter
 * reader (`adapter.mjs`). Inside this key a value runs to the end of its line:
 * a URL carries colons and a reason carries prose, so a `#` is part of the
 * value (a URL fragment is not a comment). Surrounding quotes are stripped.
 *
 *   declined_opportunities:
 *     - ecosystem: nx
 *       url: https://nx.dev/concepts/inferred-tasks
 *       site: tools/check-hygiene.ts
 *       reason: tracked for next quarter, not this one
 *       baseline_range: '>=22.0.0 <23.0.0'
 *       quote: 'Inferred tasks keep project configuration in step ...'
 */
export function parseDeclinedOpportunitiesFromConfig(configText) {
  const { config } = parseAdapterYaml(String(configText));
  return Array.isArray(config.declined_opportunities)
    ? config.declined_opportunities.map(normalizeDeclinedEntry)
    : [];
}

/**
 * Check every declined entry against the repository it is recorded in
 * (DESIGN.md §12: "The validator fails an entry whose Ecosystem or path no
 * longer exists").
 *
 * A decline is a standing instruction to stay quiet about one place. When that
 * place is gone — the Ecosystem is no longer declared, the file was deleted or
 * moved — the entry silences nothing and records a decision about something
 * that is not there. That is not a finding about the code; it is a fact about
 * the adapter, which is what makes it gateable.
 *
 * @param {object[]} entries normalized declined entries
 * @param {object} io
 * @param {string[]} io.knownEcosystems the leads the adapter declares
 * @param {(path: string) => boolean} io.exists does this repo still carry that path
 * @returns {{ok: boolean, problems: Array<{index: number, entry: object, reason: string, detail: string}>}}
 */
export function validateDeclinedOpportunities(entries, { knownEcosystems = [], exists } = {}) {
  if (typeof exists !== "function")
    throw new TypeError("validateDeclinedOpportunities needs an exists(path) for the current tree");

  const problems = [];
  const leads = new Set(knownEcosystems);

  (entries ?? []).forEach((entry, index) => {
    const fail = (reason, detail) => problems.push({ index, entry, reason, detail });

    const missing = DECLINED_REQUIRED_FIELDS.filter((field) => !text(entry?.[field]));
    if (missing.length) {
      fail(
        DECLINED_PROBLEM.malformed,
        `absent or empty: ${missing.join(", ")}. An entry records identity ` +
          "(ecosystem, url, site), a one-line reason, the Baseline range it " +
          "was declined at, and the upstream quote at the time — without the " +
          "quote nothing can ever lift the suppression on the axis DESIGN.md " +
          "item 12 names second",
      );
      return;
    }

    const range = parseVersionRange(entry.baselineRange);
    if (!range.ok)
      fail(range.reason, `baseline_range ${JSON.stringify(entry.baselineRange)}: ${range.detail}`);
    if (!leads.has(entry.ecosystem))
      fail(
        DECLINED_PROBLEM.unknownEcosystem,
        `"${entry.ecosystem}" is not a declared Ecosystem, so this entry ` +
          "silences an Opportunity no run can produce",
      );
    if (!exists(entry.site))
      fail(
        DECLINED_PROBLEM.siteNotFound,
        `"${entry.site}" is not in the tree, so this entry declines a ` +
          "technique at a place that is no longer there",
      );
  });

  return { ok: problems.length === 0, problems };
}

/**
 * Does this declined entry name this Opportunity? Identity is the Ecosystem,
 * the upstream URL, and a local site — an Opportunity naming several sites is
 * the declined one when any of them matches, because the decline was about
 * that place and an Opportunity that has grown a second site is the same
 * suggestion about the first.
 */
const declines = (entry, opportunity, lead) =>
  entry.ecosystem === lead &&
  entry.url === text(opportunity?.source?.url) &&
  (Array.isArray(opportunity?.local) ? opportunity.local : []).some(
    (citation) => text(citation?.file) === entry.site,
  );

/**
 * Apply the adapter's declined entries to the Opportunities one Ecosystem's
 * run produced (DESIGN.md §12).
 *
 * Suppressed while **both** hold: the Baseline is still inside the range the
 * decline was made at, and the upstream quote still says what it said. Either
 * one moving brings the Opportunity back, because the human declined a
 * specific suggestion at a specific version, not the Ecosystem forever.
 *
 * An entry whose range this module cannot read suppresses nothing — see the
 * header: an unreadable decline must not be able to silence an Opportunity,
 * and the same string is a hard failure in `validateDeclinedOpportunities`, so
 * it cannot sit in an adapter unnoticed either.
 *
 * @param {object[]} opportunities this run's Opportunities for one Ecosystem
 * @param {object[]} entries the adapter's declined entries (all Ecosystems)
 * @param {{lead: string, baseline: string}} ecosystem
 * @returns {{kept: object[], suppressed: object[], resurfaced: object[]}}
 *   `kept` is what the run may still propose — every Opportunity that is not
 *   suppressed, resurfaced ones included. `resurfaced` is the subset of `kept`
 *   that a decline used to cover, each with the reason it came back.
 */
export function applyDeclinedOpportunities(opportunities, entries, { lead, baseline }) {
  const kept = [];
  const suppressed = [];
  const resurfaced = [];

  for (const opportunity of opportunities ?? []) {
    const matching = (entries ?? []).filter((candidate) => declines(candidate, opportunity, lead));
    if (!matching.length) {
      kept.push(opportunity);
      continue;
    }

    const holds = (candidate) => {
      const range = parseVersionRange(candidate.baselineRange);
      return (
        range.ok &&
        range.covers(baseline) &&
        collapseWhitespace(candidate.quote ?? "") ===
          collapseWhitespace(opportunity?.benefitQuote ?? "")
      );
    };
    // A human may decline the same Opportunity again at a later Baseline by
    // appending an entry: any entry that still holds suppresses it. Only when
    // none does is it resurfaced, with the reason the first one gives.
    const holding = matching.find(holds);
    if (holding) {
      suppressed.push({ opportunity, entry: holding });
      continue;
    }
    const entry = matching[0];
    const range = parseVersionRange(entry.baselineRange);
    const inRange = range.ok && range.covers(baseline);
    kept.push(opportunity);
    resurfaced.push({
      opportunity,
      entry,
      reason: inRange ? DECLINED_RESURFACE.quoteChanged : DECLINED_RESURFACE.baselineLeftRange,
      detail: inRange
        ? `the upstream page now states ${JSON.stringify(
            opportunity?.benefitQuote ?? "",
          )}, and this was declined against ${JSON.stringify(entry.quote)}`
        : range.ok
          ? `Baseline ${baseline} is outside the range it was declined at ` +
            `(${entry.baselineRange})`
          : // Unreadable, so it covers no Baseline. The gate refuses this
            // string outright; saying which of the two it is keeps the run's
            // own log from reading as a version that moved.
            `the recorded range ${JSON.stringify(entry.baselineRange)} ` +
            `covers no Baseline: ${range.detail}`,
    });
  }

  return { kept, suppressed, resurfaced };
}
