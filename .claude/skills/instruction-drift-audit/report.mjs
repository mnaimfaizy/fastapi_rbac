/**
 * The structured Upstream Brief report contract (DESIGN.md §3 and item 10).
 *
 * A research worker writes a report matching `INPUT SHAPE` below. This module
 * turns it into a **normalized report**: the same envelope, with every entry
 * the contract could not accept moved into an `unverified` list carrying a
 * named reason, plus the counts a reader needs. That asymmetry is the whole
 * decision — a code review computes a verdict that one bad finding corrupts,
 * so it rejects the report whole; a brief has no verdict, and losing an
 * Ecosystem's good findings to one bad citation costs more than listing the
 * bad one (DESIGN.md §3).
 *
 * `unverified` and `counts` are computed, never written. A report arriving
 * with either is rejected, for the same reason the code-review contract
 * rejects a hand-written verdict: a derived field the author can forge is not
 * derived.
 *
 * WHY THIS FILE IS IN THE SKILL, AND NOT IN A HOST'S SCRIPT TREE
 *   The skill is portable (DESIGN.md, Boundary). A validator living in one
 *   host's script tree would make a brief checkable only in that host.
 *   So this module imports **nothing at all** — not a dependency, not even a
 *   Node built-in — and `validate-report.mjs` beside it is the only part that
 *   touches a filesystem or a git binary. `report.test.mjs`
 *   asserts that import-freedom, because "dependency-free" is the kind of
 *   claim that rots the first time somebody reaches for a helper.
 *
 * WHY LOCAL EVIDENCE IS CHECKED AT ALL
 *   The first three briefs cited `file:line` with no commit,
 *   inside a document frozen at its date, and carried two Correction blocks
 *   for three wrong claims. A quotation nothing compares to anything is a
 *   claim, not evidence (DESIGN.md, Principles). Every local citation here carries the
 *   file, the line, and the literal text at that line, and every one of them
 *   is read back out of the tree at the commit the report records — which is
 *   also what lets a frozen brief stay valid after the tree moves on.
 *
 *   The four failure reasons are the vocabulary a code-review pipeline uses
 *   for a quoted line that does not hold, and a host may already run one. If
 *   it does, this copy shares the **rule, not the code**: an import would tie
 *   the skill to that host and end its portability. The duplication is the
 *   price, written down so the next person does not "fix" it with an import.
 *
 * INPUT SHAPE
 *   report              schemaVersion, date, commit, ecosystems[], scanned[],
 *                       failedHops[], delta?
 *   ecosystem           lead, members[], baseline, horizon?, driftNotes[],
 *                       findings[], checkedAndClear[], opportunities[],
 *                       incidental[]
 *   upstreamFinding     type, urgency, claim, evidence, source{url, quote,
 *                       pageVersion}, local[{file,line,text}], executed?{command,
 *                       exitCode}, disposition
 *   checkedAndClear     claim, source{url, quote, pageVersion},
 *                       local[{file,line,text}], holdsFor
 *   upstreamOpportunity technique, source{url, pageVersion}, benefitQuote,
 *                       minVersion?, local[{file,line,text}]
 *   incidentalObservation summary, local[{file,line,text}], owner
 *
 *   An Opportunity spells its verbatim quote `benefitQuote` rather than
 *   `source.quote` because DESIGN.md §8 makes that quote the benefit
 *   itself — "its benefit is the upstream's quoted statement, never an
 *   estimate". It is checked exactly like any other source quote.
 *
 * WHAT THIS MODULE DOES NOT DO
 *   The ledger carry-forward (DESIGN.md §11 — a checked-and-clear claim
 *   whose recorded range still covers a new Baseline is carried forward
 *   without new research) lives in `ledger.mjs`: it reads the *previous*
 *   committed report against a *new* Baseline, and this module validates
 *   exactly one report in isolation. The `delta` this contract validates is
 *   the ledger's output, not its own work.
 *
 *   Everything else DESIGN.md states about one report's own entries is
 *   enforced here, in `validateEntry` and the per-Ecosystem pass in
 *   `normalizeUpstreamReport`: `absent` Evidence alone cannot support a
 *   `mismatch` (item 3), a `broken-now` claim without `executed` Evidence is
 *   downgraded rather than trusted at face value (item 5), an Ecosystem
 *   carries at most three Opportunities (item 8), an Opportunity whose
 *   `minVersion` sits above the Baseline is valid only when a Horizon covers
 *   it (item 8), and an Incidental Observation — never an Upstream Finding,
 *   never counted as one — cannot carry a plan disposition (item 7).
 */

// ── Vocabularies ────────────────────────────────────────────────────────────
// Every one of these is closed. A value outside its list moves the entry that
// carried it to Unverified rather than being passed through as prose, because
// the renderer groups on them and a stray value would render as a heading
// nobody declared.

export const UPSTREAM_REPORT_SCHEMA_VERSION = 1;

/** The three finding types (BRIEF.md, Finding types). */
export const UPSTREAM_FINDING_TYPES = /** @type {const} */ ([
  "future-risk",
  "mismatch",
  "missed-improvement",
]);

/** DESIGN.md §5. Ordered most urgent first: this list orders the plan. */
export const UPSTREAM_URGENCIES = /** @type {const} */ ([
  "broken-now",
  "removal-scheduled",
  "deprecated",
  "advisory",
]);

/**
 * DESIGN.md §3. `absent` is the kind this brief adds to the review
 * pipeline's three: the documents matching the Baseline were read and do not
 * say it, which on its own never proves the repo wrong.
 */
export const UPSTREAM_EVIDENCE_KINDS = /** @type {const} */ ([
  "executed",
  "cited",
  "inferred",
  "absent",
]);

/** DESIGN.md §7 and item 9: the plan touches instructions; the rest is follow-on. */
export const UPSTREAM_DISPOSITIONS = /** @type {const} */ (["plan", "follow-on"]);

/** DESIGN.md §8: "at most three Upstream Opportunities per Ecosystem." */
export const MAX_OPPORTUNITIES_PER_ECOSYSTEM = 3;

/**
 * DESIGN.md §5: a `broken-now` claim without `executed` Evidence is
 * downgraded rather than rejected — the claim itself may still be true, only
 * the strongest urgency is not something citation or reasoning alone can
 * support. `advisory` is the floor of `UPSTREAM_URGENCIES` on purpose: absent
 * a runtime check, nothing here licenses picking a specific timeline
 * (`deprecated`, `removal-scheduled`) the finding never claimed either.
 */
export const BROKEN_NOW_DOWNGRADE_URGENCY = "advisory";

/**
 * Who an Incidental Observation may route to when the adapter names nobody
 * (DESIGN.md §7). A host lists its own owners under `incidental_owners` and
 * the validator takes that list; this default only says "file an issue".
 */
export const DEFAULT_INCIDENTAL_OWNERS = /** @type {const} */ (["ad-hoc-issue"]);

/**
 * Why a local citation did not hold. Same four names a review pipeline
 * uses, by the rule above — one vocabulary, two implementations.
 */
export const CITATION_FAILURE_REASONS = /** @type {const} */ ([
  "file-not-found",
  "line-out-of-range",
  "text-differs",
  "quotes-nothing",
]);

/**
 * Why an entry is Unverified. The first three are DESIGN.md §3's own list —
 * a URL, a verbatim quote, and the version the page states — `malformed`
 * covers everything the shape itself refuses (including the domain rules
 * that are shape-shaped: an Incidental Observation carrying a disposition),
 * and the last three are this file's own domain rules: `absent` Evidence
 * cannot support a `mismatch` (item 3), an Ecosystem's fourth-and-later
 * Opportunity (item 8), and an Opportunity above the Baseline with no
 * Horizon that reaches it (item 8).
 */
export const UNVERIFIED_REASONS = /** @type {const} */ ([
  "missing-source-url",
  "missing-source-quote",
  "missing-page-version",
  "malformed",
  ...CITATION_FAILURE_REASONS,
  "absent-evidence-mismatch",
  "too-many-opportunities",
  "opportunity-beyond-horizon",
]);

/** The four entry kinds an Ecosystem carries, and the field each hangs off. */
export const ENTRY_KINDS = /** @type {const} */ ([
  "upstreamFinding",
  "checkedAndClear",
  "upstreamOpportunity",
  "incidentalObservation",
]);

/**
 * Pinned tables. Each covers every member of its enum and is asserted at
 * module load, so a new urgency or entry kind cannot reach a reader as
 * `undefined` (AGENTS.md: a fan-out over a domain enum reaches a pinned
 * table). `enum:fanout:check` parses TypeScript and never sees this file,
 * which is exactly why the assertion is written out by hand.
 */
export const URGENCY_TITLES = {
  "broken-now": "Broken now",
  "removal-scheduled": "Removal scheduled",
  deprecated: "Deprecated",
  advisory: "Advisory",
};

export const ENTRY_LIST_FIELDS = {
  upstreamFinding: "findings",
  checkedAndClear: "checkedAndClear",
  upstreamOpportunity: "opportunities",
  incidentalObservation: "incidental",
};

for (const [members, table, name] of [
  [UPSTREAM_URGENCIES, URGENCY_TITLES, "URGENCY_TITLES"],
  [ENTRY_KINDS, ENTRY_LIST_FIELDS, "ENTRY_LIST_FIELDS"],
]) {
  for (const member of members) {
    if (!(member in table)) throw new Error(`${name} is missing "${member}"`);
  }
}

/** A git SHA as a report records it: abbreviated is fine, invented is not. */
const SHA = /^[0-9a-f]{7,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Thrown when the report itself cannot be read as a report — a bad envelope,
 * a missing ecosystem list, a derived field written by hand. The CLI turns
 * this into exit 1. Nothing at entry level throws: an entry that fails goes
 * to Unverified and the rest of the report stands.
 */
export class UpstreamReportRejected extends Error {
  constructor(problems) {
    super(`upstream report rejected:\n  ${problems.join("\n  ")}`);
    this.name = "UpstreamReportRejected";
    this.problems = problems;
  }
}

// ── Small predicates ────────────────────────────────────────────────────────

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";
const isTextArray = (v) => Array.isArray(v) && v.every(isText);

/**
 * Whitespace is presentation. A line a worker copied out of a file carries
 * whatever indentation it had, so comparing on collapsed whitespace means a
 * re-indented quote is the same quote and a different quote is not.
 *
 * Exported for `ledger.mjs`, which asks the same question across two runs
 * ("is this the same claim?", "did the upstream quote change?"). Two spellings
 * of "the same text" in one skill is two answers to one question.
 */
export const collapseWhitespace = (s) => String(s).replace(/\s+/g, " ").trim();
const collapse = collapseWhitespace;

/**
 * Compare two "x.y.z"-shaped version strings segment by segment. A Baseline
 * comes from an installed manifest, which can be a pre-release, so semver's
 * pre-release rule applies: `16.0.0-canary.3` sorts below `16.0.0`, and two
 * pre-releases of one version compare identifier by identifier (numeric ones
 * as numbers, and below alphanumeric ones). Build metadata (`+…`) is ignored.
 *
 * Exported for `ledger.mjs`, whose range comparisons (a `holdsFor` range
 * against a new Baseline, a decline's range against the same) must order
 * versions exactly as the Opportunity check here does.
 *
 * @returns {number} negative if `a` < `b`, positive if `a` > `b`, 0 if equal
 */
export function compareVersions(a, b) {
  const split = (v) => {
    const [core, ...pre] = String(v).trim().replace(/^v/, "").split("+")[0].split("-");
    return {
      core: core.split(".").map((segment) => parseInt(segment, 10) || 0),
      pre: pre.length ? pre.join("-").split(".") : [],
    };
  };
  const va = split(a);
  const vb = split(b);
  const length = Math.max(va.core.length, vb.core.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (va.core[i] ?? 0) - (vb.core[i] ?? 0);
    if (diff !== 0) return diff;
  }
  // A release outranks its own pre-releases.
  if (!va.pre.length || !vb.pre.length) return vb.pre.length - va.pre.length;
  const numeric = /^\d+$/;
  for (let i = 0; i < Math.max(va.pre.length, vb.pre.length); i += 1) {
    const x = va.pre[i];
    const y = vb.pre[i];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    const xn = numeric.test(x);
    const yn = numeric.test(y);
    if (xn && yn) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** What `compareVersions` can order: `22`, `22.1`, `16.0.0-canary.3`, `v1.2.3+build`. */
export const VERSION_NUMBER = /^v?\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * The lines of a file a `file:line` citation can name. A file ending in a
 * newline splits to a trailing empty element that is not a line anybody can
 * cite; dropping it keeps the reported line count honest. CRLF is normalized
 * first so a line number means the same thing on every platform.
 */
const citableLines = (content) => {
  const lines = String(content).replace(/\r\n/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
};

// ── Local evidence ──────────────────────────────────────────────────────────

/**
 * Compare one local citation against the tree at the report's recorded commit.
 *
 * @param {{file: string, line: number, text: string}} citation
 * @param {(file: string) => string|null|undefined} readSource
 *   file contents at the recorded commit, or null when the file is not there.
 *   Injected rather than imported: this module reads nothing, and a caller
 *   that wants to check a brief against a worktree, a tarball, or a fixture
 *   map is doing the same job as one that shells out to `git show`.
 * @returns {{ok: true} | {ok: false, reason: string, actual?: string, lineCount?: number}}
 */
export function verifyLocalEvidence(citation, readSource) {
  // A quotation with no content in it is not a quotation. Whitespace is
  // presentation everywhere else in this comparison, which is what makes
  // `text: " "` the cheapest possible forgery: it would otherwise match every
  // blank line in the tree without the writer having read anything.
  if (collapse(citation.text) === "") return { ok: false, reason: "quotes-nothing" };
  const source = readSource(citation.file);
  if (source === null || source === undefined) return { ok: false, reason: "file-not-found" };
  const lines = citableLines(source);
  if (!Number.isInteger(citation.line) || citation.line < 1 || citation.line > lines.length)
    return { ok: false, reason: "line-out-of-range", lineCount: lines.length };
  const actual = lines[citation.line - 1];
  if (collapse(actual) !== collapse(citation.text))
    return {
      ok: false,
      reason: "text-differs",
      actual: actual.trim().slice(0, MAX_QUOTED_SOURCE),
    };
  return { ok: true };
}

/** How much of a mismatching line is quoted back in the failure message. */
export const MAX_QUOTED_SOURCE = 200;

// ── Entry validation ────────────────────────────────────────────────────────

/**
 * One rejection. `where` is the JSON path into the input, so a reader can find
 * the entry without counting brackets; `label` is the entry's own sentence,
 * so the rendered Unverified list says what was dropped rather than only
 * where it was.
 */
const reject = (kind, ecosystem, where, reason, detail, label) => ({
  kind,
  ecosystem,
  where,
  reason,
  detail,
  label,
});

/**
 * The three facts DESIGN.md §3 requires of any upstream citation: a URL, a
 * verbatim quote, and the version the page states. Each missing one has its
 * own reason, because "this finding is unverified" without saying which of
 * the three is absent is the kind of note a next run cannot act on.
 *
 * `quoteField` names where the verbatim text lives, which differs by entry
 * kind: an Opportunity's is `benefitQuote`, hoisted out of `source` because
 * it *is* the benefit (DESIGN.md §8).
 */
function sourceProblems(entry, { quoteField = "quote", quoteIn = "source" } = {}) {
  const problems = [];
  const source = entry?.source;
  if (!isObject(source)) {
    problems.push(["missing-source-url", "the entry carries no source object"]);
    return problems;
  }
  if (!isText(source.url)) problems.push(["missing-source-url", "source.url is absent or empty"]);
  const quote = quoteIn === "source" ? source[quoteField] : entry[quoteField];
  const quotePath = quoteIn === "source" ? `source.${quoteField}` : quoteField;
  if (!isText(quote))
    problems.push([
      "missing-source-quote",
      `${quotePath} is absent or empty — a paraphrase is not a citation`,
    ]);
  if (!isText(source.pageVersion))
    problems.push([
      "missing-page-version",
      "source.pageVersion is absent or empty — a page that does not say which " +
        "version it describes cannot be matched to a Baseline",
    ]);
  return problems;
}

/**
 * Every local citation on an entry, checked. Returns the first failure only:
 * an entry is Unverified or it is not, and listing four broken quotations for
 * one dropped finding buries the other findings' reasons.
 */
function localProblem(entry, readSource, { required }) {
  const local = entry?.local;
  if (!Array.isArray(local)) return ["malformed", "local must be an array of {file, line, text}"];
  if (required && local.length === 0)
    return ["malformed", "local is empty — this entry must name at least one local site"];
  for (const [index, citation] of local.entries()) {
    if (
      !isObject(citation) ||
      !isText(citation.file) ||
      typeof citation.line !== "number" ||
      typeof citation.text !== "string"
    )
      return ["malformed", `local[${index}] is not a {file, line, text} citation`];
    const verdict = verifyLocalEvidence(citation, readSource);
    if (verdict.ok) continue;
    const at = `${citation.file}:${citation.line}`;
    switch (verdict.reason) {
      case "quotes-nothing":
        return [verdict.reason, `local[${index}] cites ${at} and quotes nothing but whitespace`];
      case "file-not-found":
        return [
          verdict.reason,
          `local[${index}] cites ${citation.file}, which is not in the tree at the recorded commit`,
        ];
      case "line-out-of-range":
        return [
          verdict.reason,
          `local[${index}] cites ${at}, and that file has ${verdict.lineCount} line(s) at the recorded commit`,
        ];
      default:
        return [
          verdict.reason,
          `local[${index}] quotes ${JSON.stringify(citation.text)} at ${at}, ` +
            `where the recorded commit has ${JSON.stringify(verdict.actual)}`,
        ];
    }
  }
  return null;
}

const enumProblem = (value, members, field) =>
  members.includes(value)
    ? null
    : ["malformed", `${field} is ${JSON.stringify(value)}; expected one of ${members.join(", ")}`];

/**
 * Validate one entry of a given kind. Returns `{ok: true, entry}` or
 * `{ok: false, reason, detail, label}`. Never throws: an entry failure is a
 * demotion, not a rejection.
 *
 * `entry` on a success is not always `raw` unchanged: a `broken-now` finding
 * that survives every other check but lacks `executed` Evidence is still
 * accepted, with its urgency downgraded and the downgrade recorded on the
 * returned copy (DESIGN.md §5) — see the bottom of this function.
 *
 * @param {{baseline?: string, horizon?: string}} context an Opportunity's
 *   Ecosystem, for the Baseline/Horizon check (item 8). Unused by every other
 *   kind; passed uniformly so the call site does not need to know which kind
 *   cares.
 */
function validateEntry(kind, raw, readSource, context = {}) {
  const label = entryLabel(kind, raw);
  const fail = (reason, detail) => ({ ok: false, reason, detail, label });

  if (!isObject(raw)) return fail("malformed", "entry is not an object");

  /** @type {[string, string]|null} */
  let problem = null;

  if (kind === "upstreamFinding") {
    problem =
      enumProblem(raw.type, UPSTREAM_FINDING_TYPES, "type") ??
      enumProblem(raw.urgency, UPSTREAM_URGENCIES, "urgency") ??
      enumProblem(raw.evidence, UPSTREAM_EVIDENCE_KINDS, "evidence") ??
      enumProblem(raw.disposition, UPSTREAM_DISPOSITIONS, "disposition");
    if (!problem && !isText(raw.claim)) problem = ["malformed", "claim is absent or empty"];
    if (!problem && raw.executed !== undefined) {
      // DESIGN.md §5: the brief records each command and its exit code.
      // The rule that such a command must write no tracked file and install
      // nothing is stated, not mechanically enforced — recording the command
      // is what makes the reader able to judge it.
      if (
        !isObject(raw.executed) ||
        !isText(raw.executed.command) ||
        !Number.isInteger(raw.executed.exitCode)
      )
        problem = ["malformed", "executed must be {command, exitCode}"];
    }
    // DESIGN.md §3: `absent` means the matching documents were read and do
    // not say it, which on its own never proves the repo wrong — so it can
    // name a missed improvement or a future risk worth watching, but it
    // cannot itself be the evidence for "this contradicts upstream".
    if (!problem && raw.type === "mismatch" && raw.evidence === "absent")
      problem = [
        "absent-evidence-mismatch",
        "evidence is `absent` — the matching documents were read and say " +
          "nothing, which on its own never proves the repo wrong, so this " +
          "cannot be a mismatch (DESIGN.md §3)",
      ];
    if (!problem) problem = sourceProblems(raw)[0] ?? null;
    if (!problem) problem = localProblem(raw, readSource, { required: false });
  } else if (kind === "checkedAndClear") {
    if (!isText(raw.claim)) problem = ["malformed", "claim is absent or empty"];
    // DESIGN.md §11 reads this range back on the next run to decide whether
    // the claim can be carried forward without new research. A claim that does
    // not say what it holds for cannot be carried forward by anything.
    if (!problem && !isText(raw.holdsFor)) problem = ["malformed", "holdsFor is absent or empty"];
    if (!problem) problem = sourceProblems(raw)[0] ?? null;
    if (!problem) problem = localProblem(raw, readSource, { required: false });
  } else if (kind === "upstreamOpportunity") {
    if (!isText(raw.technique)) problem = ["malformed", "technique is absent or empty"];
    if (!problem && raw.minVersion !== undefined && !isText(raw.minVersion))
      problem = ["malformed", "minVersion, when present, is a version string"];
    if (!problem && isText(raw.minVersion) && !VERSION_NUMBER.test(raw.minVersion.trim()))
      problem = [
        "malformed",
        `minVersion ${JSON.stringify(raw.minVersion)} is not a version number such as 22.1.0`,
      ];
    if (!problem)
      problem =
        sourceProblems(raw, {
          quoteField: "benefitQuote",
          quoteIn: "entry",
        })[0] ?? null;
    // DESIGN.md §8: an Opportunity "must name at least one local site,
    // checked like any local evidence". Unlike a finding, zero sites is not a
    // legal Opportunity — it would be a suggestion about nowhere.
    if (!problem) problem = localProblem(raw, readSource, { required: true });
    // DESIGN.md §8: "adoptable at the Baseline, or by the Horizon with its
    // minimum version stated". A minVersion the Baseline already satisfies
    // needs nothing further; one above it is only legal when a Horizon was
    // named and reaches at least that far.
    if (!problem && isText(raw.minVersion) && isText(context.baseline)) {
      if (compareVersions(raw.minVersion, context.baseline) > 0) {
        const horizonCovers =
          isText(context.horizon) && compareVersions(context.horizon, raw.minVersion) >= 0;
        if (!horizonCovers)
          problem = [
            "opportunity-beyond-horizon",
            `minVersion ${raw.minVersion} is above the Baseline ` +
              `${context.baseline}` +
              (context.horizon
                ? ` and above the Horizon ${context.horizon}`
                : ", and this Ecosystem names no Horizon") +
              " (DESIGN.md §8)",
          ];
      }
    }
  } else {
    problem = enumProblem(
      raw.owner,
      context.incidentalOwners ?? DEFAULT_INCIDENTAL_OWNERS,
      "owner",
    );
    if (!problem && !isText(raw.summary)) problem = ["malformed", "summary is absent or empty"];
    // DESIGN.md §7: an Incidental Observation is "not a finding ... and
    // never enters the brief's proposed plan". `disposition` is an Upstream
    // Finding field; carrying one here would let an incidental slip into the
    // plan the same way a Finding does.
    if (!problem && raw.disposition !== undefined)
      problem = [
        "malformed",
        "an Incidental Observation cannot carry a disposition — it is not " +
          "an Upstream Finding and never enters the brief's plan (DESIGN.md §7)",
      ];
    if (!problem) problem = localProblem(raw, readSource, { required: false });
  }

  if (problem) return fail(problem[0], problem[1]);

  // DESIGN.md §5, applied only once everything else about the finding
  // already holds: `broken-now` without `executed` Evidence is downgraded,
  // not rejected — the claim may still be right, only the strongest urgency
  // needs proof citation or reasoning alone cannot supply.
  if (kind === "upstreamFinding" && raw.urgency === "broken-now") {
    const hasExecutedEvidence =
      raw.evidence === "executed" &&
      isObject(raw.executed) &&
      isText(raw.executed.command) &&
      Number.isInteger(raw.executed.exitCode);
    if (!hasExecutedEvidence)
      return {
        ok: true,
        entry: {
          ...raw,
          urgency: BROKEN_NOW_DOWNGRADE_URGENCY,
          downgradedFrom: "broken-now",
          downgradeReason:
            "broken-now requires executed Evidence (a command and its exit " +
            "code); without it the finding is downgraded rather than trusted " +
            "at face value (DESIGN.md §5)",
        },
      };
  }

  return { ok: true, entry: raw };
}

/** The entry's own sentence, for the Unverified list. */
function entryLabel(kind, raw) {
  if (!isObject(raw)) return "(unreadable entry)";
  const candidate =
    kind === "upstreamOpportunity"
      ? raw.technique
      : kind === "incidentalObservation"
        ? raw.summary
        : raw.claim;
  return isText(candidate) ? String(candidate).trim() : "(no claim recorded)";
}

// ── Envelope ────────────────────────────────────────────────────────────────

/**
 * Envelope problems reject the whole report. The line between these and an
 * entry demotion is "could a reader still get value out of what is left": a
 * finding with a bad quote leaves every other finding standing, while a
 * report with no commit leaves nothing checkable at all.
 */
function envelopeProblems(raw) {
  const problems = [];
  if (!isObject(raw)) return ["the report is not an object"];

  if (raw.schemaVersion !== UPSTREAM_REPORT_SCHEMA_VERSION)
    problems.push(
      `schemaVersion: expected ${UPSTREAM_REPORT_SCHEMA_VERSION}, found ${JSON.stringify(raw.schemaVersion)}`,
    );
  if (typeof raw.date !== "string" || !ISO_DATE.test(raw.date))
    problems.push(`date: expected YYYY-MM-DD, found ${JSON.stringify(raw.date)}`);
  if (typeof raw.commit !== "string" || !SHA.test(raw.commit))
    problems.push(
      `commit: expected a git SHA, found ${JSON.stringify(raw.commit)}. ` +
        "Local evidence is checked at this commit, so a report without one is " +
        "a set of claims nothing can compare to anything (DESIGN.md §3).",
    );
  if (!isTextArray(raw.scanned))
    problems.push(
      "scanned: expected an array of the paths or globs this run read. " +
        '"none in scanned files" named no scanned files in every brief written ' +
        "in the early briefs, which is what made coverage unauditable.",
    );
  if (!Array.isArray(raw.failedHops)) problems.push("failedHops: expected an array");
  else
    raw.failedHops.forEach((hop, index) => {
      if (!isObject(hop) || !isText(hop.ecosystem) || !isText(hop.reason))
        problems.push(`failedHops[${index}]: expected {ecosystem, reason}`);
    });

  // Computed, never written. Same principle as the code-review contract's
  // rejection of a hand-written verdict: a derived field the author can forge
  // is not derived.
  for (const derived of ["unverified", "counts"])
    if (derived in raw)
      problems.push(`${derived} is computed by the validator and must not appear in a report`);

  if (raw.delta !== undefined) {
    const d = raw.delta;
    if (
      !isObject(d) ||
      !isTextArray(d.newFindings) ||
      !isTextArray(d.resolved) ||
      !isTextArray(d.stillPresent)
    )
      problems.push(
        "delta, when present, is {newFindings, resolved, stillPresent}, each an array of strings",
      );
  }

  if (!Array.isArray(raw.ecosystems) || raw.ecosystems.length === 0)
    problems.push("ecosystems: expected a non-empty array");
  else
    raw.ecosystems.forEach((eco, index) => {
      const at = `ecosystems[${index}]`;
      if (!isObject(eco)) {
        problems.push(`${at}: not an object`);
        return;
      }
      if (!isText(eco.lead)) problems.push(`${at}.lead: absent or empty`);
      if (!isTextArray(eco.members) || eco.members.length === 0)
        problems.push(`${at}.members: expected a non-empty array of package names`);
      // DESIGN.md §1. The Baseline is the version actually installed; a
      // report that cannot say what it was anchored to is anchored to nothing.
      if (!isText(eco.baseline)) problems.push(`${at}.baseline: absent or empty`);
      if (eco.horizon !== undefined && !isText(eco.horizon))
        problems.push(`${at}.horizon, when present, is a version string`);
      if (!isTextArray(eco.driftNotes))
        problems.push(`${at}.driftNotes: expected an array of strings`);
      for (const kind of ENTRY_KINDS) {
        const field = ENTRY_LIST_FIELDS[kind];
        if (!Array.isArray(eco[field])) problems.push(`${at}.${field}: expected an array`);
      }
    });

  return problems;
}

// ── The two entry points ────────────────────────────────────────────────────

/**
 * Validate a report as a worker wrote it and return the normalized report.
 *
 * @param {unknown} raw the input report
 * @param {{readSource: (file: string) => string|null|undefined, incidentalOwners?: readonly string[]}} options
 *   `readSource` returns a file's contents at the report's recorded commit.
 *   `incidentalOwners` is the adapter's `incidental_owners`; absent, the
 *   default applies. `readSource` is required rather than defaulted: a default that returned `null`
 *   would report every citation as `file-not-found`, which reads as the
 *   worker inventing files when in fact nobody supplied a reader.
 * @throws {UpstreamReportRejected} when the envelope is not a report
 * @returns the normalized report: envelope, surviving entries, `unverified`,
 *   and `counts`
 */
export function normalizeUpstreamReport(raw, { readSource, incidentalOwners } = {}) {
  if (typeof readSource !== "function")
    throw new TypeError(
      "normalizeUpstreamReport needs a readSource(file) reader for the recorded commit",
    );

  const problems = envelopeProblems(raw);
  if (problems.length) throw new UpstreamReportRejected(problems);

  const unverified = [];
  // Keyed off the one pinned table rather than a second hand-written list of
  // the same four kinds. A count is a fan-out over ENTRY_KINDS like any other,
  // and a duplicate map is the shape that table exists to prevent: it would have gone on
  // compiling while silently counting three of four (DESIGN.md, Principles).
  const counts = Object.fromEntries(ENTRY_KINDS.map((kind) => [ENTRY_LIST_FIELDS[kind], 0]));

  const ecosystems = raw.ecosystems.map((eco, ecoIndex) => {
    const kept = {};
    const context = {
      baseline: eco.baseline,
      horizon: eco.horizon,
      incidentalOwners,
    };
    for (const kind of ENTRY_KINDS) {
      const field = ENTRY_LIST_FIELDS[kind];
      kept[field] = [];
      // DESIGN.md §8: "at most three Upstream Opportunities per
      // Ecosystem." Counted against what actually survives, in the order the
      // worker wrote them — an Opportunity a citation already refused does
      // not spend one of the three slots, and a report naming five where two
      // fail still keeps the first three that hold.
      let acceptedOpportunities = 0;
      eco[field].forEach((entry, entryIndex) => {
        const verdict = validateEntry(kind, entry, readSource, context);
        const at = `ecosystems[${ecoIndex}].${field}[${entryIndex}]`;
        if (verdict.ok) {
          if (kind === "upstreamOpportunity") {
            acceptedOpportunities += 1;
            if (acceptedOpportunities > MAX_OPPORTUNITIES_PER_ECOSYSTEM) {
              unverified.push(
                reject(
                  kind,
                  eco.lead,
                  at,
                  "too-many-opportunities",
                  `an Ecosystem carries at most ${MAX_OPPORTUNITIES_PER_ECOSYSTEM} ` +
                    `Upstream Opportunities (DESIGN.md §8); this is the ` +
                    `${acceptedOpportunities}th that otherwise holds`,
                  entryLabel(kind, verdict.entry),
                ),
              );
              return;
            }
          }
          kept[field].push(verdict.entry);
          counts[field] += 1;
          return;
        }
        unverified.push(reject(kind, eco.lead, at, verdict.reason, verdict.detail, verdict.label));
      });
    }
    return {
      lead: eco.lead,
      members: [...eco.members],
      ...(eco.horizon === undefined ? {} : { horizon: eco.horizon }),
      baseline: eco.baseline,
      driftNotes: [...eco.driftNotes],
      ...kept,
    };
  });

  return {
    schemaVersion: raw.schemaVersion,
    date: raw.date,
    commit: raw.commit,
    ...(raw.delta === undefined ? {} : { delta: raw.delta }),
    ecosystems,
    scanned: [...raw.scanned],
    failedHops: raw.failedHops.map((hop) => ({
      ecosystem: hop.ecosystem,
      reason: hop.reason,
    })),
    unverified,
    counts: { ...counts, unverified: unverified.length },
  };
}

/**
 * Re-check a **normalized** report that is already committed (DESIGN.md §10).
 *
 * The committed artifact is the validator's output, not the worker's input:
 * it carries the write-time `unverified` list, which is a record of what was
 * dropped and is never re-checked — those entries hold no surviving claims,
 * so re-checking them would fail forever by construction.
 *
 * What is re-checked is everything that survived. Every one of those entries
 * passed its citation check at the recorded commit when the brief was
 * written, and that commit does not change. So a fresh failure is not a
 * worker's mistake — it is the report and the history disagreeing, which is
 * exactly the drift a Wired Gate exists to catch.
 *
 * @param {unknown} normalized a report read back off disk
 * @param {{readSource: (file: string) => string|null|undefined, incidentalOwners?: readonly string[]}} options
 *   the same options `normalizeUpstreamReport` takes
 * @returns {{ok: boolean, problems: string[], report?: object}}
 */
export function recheckUpstreamReport(normalized, { readSource, incidentalOwners } = {}) {
  if (!isObject(normalized)) return { ok: false, problems: ["the report is not an object"] };
  if (!Array.isArray(normalized.unverified) || !isObject(normalized.counts))
    return {
      ok: false,
      problems: [
        "not a normalized report: `unverified` and `counts` are written by " +
          "`validate-report.mjs --out`, and a report committed without them " +
          "was never validated",
      ],
    };

  const { unverified, counts, ...input } = normalized;

  let fresh;
  try {
    fresh = normalizeUpstreamReport(input, { readSource, incidentalOwners });
  } catch (error) {
    if (!(error instanceof UpstreamReportRejected)) throw error;
    return { ok: false, problems: error.problems };
  }

  const problems = fresh.unverified.map(
    (u) =>
      `${u.where} (${u.kind} in ${u.ecosystem}) no longer holds at commit ` +
      `${normalized.commit}: ${u.reason} — ${u.detail}`,
  );

  // Same pinned table as the counter itself: a fifth entry kind must not be
  // able to arrive uncompared, which is precisely what a hand-written list of
  // four here would have allowed.
  for (const kind of ENTRY_KINDS) {
    const field = ENTRY_LIST_FIELDS[kind];
    if (counts[field] !== fresh.counts[field])
      problems.push(
        `counts.${field} records ${counts[field]} but the report carries ${fresh.counts[field]}`,
      );
  }
  if (counts.unverified !== unverified.length)
    problems.push(
      `counts.unverified records ${counts.unverified} but the unverified list has ${unverified.length}`,
    );

  return { ok: problems.length === 0, problems, report: fresh };
}
