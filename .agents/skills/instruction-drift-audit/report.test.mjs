/**
 * Contract suite for the structured Upstream Brief report (DESIGN.md §3).
 *
 * What it proves, in the order the ADR states the rules:
 *   - a well-formed report validates and yields a normalized report;
 *   - a finding missing its URL, verbatim quote, or page version moves to
 *     Unverified with a named reason, and the rest of the report stands;
 *   - local evidence is checked through the injected reader, with the four
 *     reasons the review pipeline uses;
 *   - the envelope, unlike an entry, rejects the report whole;
 *   - the validator imports nothing beyond Node built-ins.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BROKEN_NOW_DOWNGRADE_URGENCY,
  CITATION_FAILURE_REASONS,
  ENTRY_KINDS,
  ENTRY_LIST_FIELDS,
  MAX_OPPORTUNITIES_PER_ECOSYSTEM,
  UNVERIFIED_REASONS,
  UPSTREAM_REPORT_SCHEMA_VERSION,
  UPSTREAM_URGENCIES,
  URGENCY_TITLES,
  UpstreamReportRejected,
  compareVersions,
  normalizeUpstreamReport,
  recheckUpstreamReport,
  verifyLocalEvidence,
} from "./report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures", "report.json");
const TREE = join(HERE, "fixtures", "tree");

/** The fixture tree, read as the recorded commit would be read. */
export const fixtureReader = (file) => {
  try {
    return readFileSync(join(TREE, file), "utf8");
  } catch {
    return null;
  }
};

/** A fresh copy every time, so one test's mutation cannot reach another. */
export const fixtureReport = () => JSON.parse(readFileSync(FIXTURE, "utf8"));

const normalize = (raw = fixtureReport(), readSource = fixtureReader) =>
  normalizeUpstreamReport(raw, { readSource });

// ── The happy path ──────────────────────────────────────────────────────────

test("a well-formed fixture report validates and yields a normalized report", () => {
  const report = normalize();

  assert.equal(report.schemaVersion, UPSTREAM_REPORT_SCHEMA_VERSION);
  assert.equal(report.date, "2026-09-17");
  assert.deepEqual(report.unverified, []);
  assert.deepEqual(report.counts, {
    findings: 4,
    checkedAndClear: 1,
    opportunities: 2,
    incidental: 1,
    unverified: 0,
  });
  assert.equal(report.ecosystems.length, 2);
  assert.equal(report.ecosystems[0].horizon, "16.3.1");
  // An Ecosystem without a Horizon carries no key rather than an empty one:
  // "no Horizon" is a statement the brief makes, and `horizon: ""` would
  // render as a Horizon nobody named.
  assert.equal("horizon" in report.ecosystems[1], false);
  assert.deepEqual(report.failedHops, [
    {
      ecosystem: "react-native",
      reason:
        "the upstream release-notes page returned 503 three times; no Baseline document could be read",
    },
  ]);
});

test("the normalized report is a copy, not a view of the input", () => {
  const raw = fixtureReport();
  const report = normalize(raw);
  report.scanned.push("mutated");
  report.ecosystems[0].members.push("mutated");
  assert.deepEqual(raw.scanned, ["instructions.md", "hygiene.mjs"]);
  assert.deepEqual(raw.ecosystems[0].members, ["next", "eslint-config-next"]);
});

// ── Unverified: the three facts every upstream citation carries ─────────────

for (const [field, reason] of [
  ["url", "missing-source-url"],
  ["quote", "missing-source-quote"],
  ["pageVersion", "missing-page-version"],
]) {
  test(`a finding missing source.${field} moves to Unverified as ${reason}, and the rest stands`, () => {
    const raw = fixtureReport();
    delete raw.ecosystems[0].findings[0].source[field];

    const report = normalize(raw);

    assert.equal(report.unverified.length, 1);
    assert.equal(report.unverified[0].reason, reason);
    assert.equal(report.unverified[0].kind, "upstreamFinding");
    assert.equal(report.unverified[0].ecosystem, "next");
    assert.equal(report.unverified[0].where, "ecosystems[0].findings[0]");
    assert.match(report.unverified[0].label, /^The instruction file teaches/);
    // The whole point of the demotion: the other two findings in this
    // Ecosystem, and every finding in the other one, are untouched.
    assert.equal(report.counts.findings, 3);
    assert.equal(report.counts.checkedAndClear, 1);
    assert.equal(report.ecosystems[1].findings.length, 1);
  });
}

test("a source that is an empty string is as absent as one that is missing", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].findings[0].source.quote = "   ";
  assert.equal(normalize(raw).unverified[0].reason, "missing-source-quote");
});

test("an Opportunity's verbatim quote is benefitQuote, and it is required", () => {
  const raw = fixtureReport();
  delete raw.ecosystems[0].opportunities[0].benefitQuote;
  const report = normalize(raw);
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].kind, "upstreamOpportunity");
  assert.equal(report.unverified[0].reason, "missing-source-quote");
  assert.match(report.unverified[0].detail, /benefitQuote/);
});

test("an Opportunity naming no local site is refused (DESIGN.md §8)", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].opportunities[0].local = [];
  const report = normalize(raw);
  assert.equal(report.unverified[0].reason, "malformed");
  assert.match(report.unverified[0].detail, /at least one local site/);
});

test("a finding naming no local site is fine — absence is a legal Evidence kind", () => {
  // `missed-improvement` with `absent` Evidence is the shape DESIGN.md §3
  // names: the matching documents were read and do not say it. Requiring a
  // local citation there would make the kind unusable.
  const report = normalize();
  assert.equal(report.ecosystems[0].findings[2].local.length, 0);
  assert.deepEqual(report.unverified, []);
});

test("an unknown value in a closed vocabulary demotes rather than passing through", () => {
  for (const [field, value] of [
    ["type", "refactor"],
    ["urgency", "urgent"],
    ["evidence", "vibes"],
    ["disposition", "maybe"],
  ]) {
    const raw = fixtureReport();
    raw.ecosystems[0].findings[0][field] = value;
    const report = normalize(raw);
    assert.equal(report.unverified.length, 1, field);
    assert.equal(report.unverified[0].reason, "malformed", field);
    assert.match(report.unverified[0].detail, new RegExp(`^${field} is`), field);
  }
});

test("an Incidental Observation routes to an owner the adapter declares", () => {
  const raw = fixtureReport();
  raw.ecosystems[1].incidental[0].owner = "somebody";
  const report = normalize(raw);
  assert.equal(report.unverified[0].kind, "incidentalObservation");
  assert.equal(report.unverified[0].reason, "malformed");
});

test("an executed record that is not {command, exitCode} demotes the finding", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].findings[0].executed = { command: "yarn lint" };
  const report = normalize(raw);
  assert.equal(report.unverified[0].reason, "malformed");
  assert.match(report.unverified[0].detail, /executed must be/);
});

test("a checked-and-clear claim with no holdsFor cannot be carried forward, so it is refused", () => {
  const raw = fixtureReport();
  delete raw.ecosystems[0].checkedAndClear[0].holdsFor;
  const report = normalize(raw);
  assert.equal(report.unverified[0].kind, "checkedAndClear");
  assert.match(report.unverified[0].detail, /holdsFor/);
});

// ── Domain rules (DESIGN.md §3, §5, §7, §8) ────────────────────────────────

test("a mismatch whose only Evidence is absent is refused, not accepted (DESIGN.md §3)", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].findings[0].type = "mismatch";
  raw.ecosystems[0].findings[0].evidence = "absent";
  const report = normalize(raw);
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].kind, "upstreamFinding");
  assert.equal(report.unverified[0].reason, "absent-evidence-mismatch");
  assert.equal(report.counts.findings, 3);
});

test("absent Evidence is fine for a future-risk or missed-improvement finding", () => {
  // Only `mismatch` is refused: `absent` naming what upstream does not say is
  // exactly the shape a missed-improvement or future-risk finding is for.
  const report = normalize();
  const absentButNotMismatch = report.ecosystems[0].findings.find((f) => f.evidence === "absent");
  assert.equal(absentButNotMismatch.type, "missed-improvement");
  assert.deepEqual(report.unverified, []);
});

test("broken-now with executed Evidence is accepted at full urgency", () => {
  // The fixture's own broken-now finding carries `evidence: executed` plus a
  // command and exit code — it must survive untouched.
  const report = normalize();
  const brokenNow = report.ecosystems[0].findings.find((f) =>
    f.claim.startsWith("The instruction file teaches `await cookies()`"),
  );
  assert.equal(brokenNow.urgency, "broken-now");
  assert.equal("downgradedFrom" in brokenNow, false);
});

for (const [name, mutate] of [
  [
    "evidence is cited, not executed",
    (f) => {
      f.evidence = "cited";
    },
  ],
  [
    "no executed record at all",
    (f) => {
      delete f.executed;
      f.evidence = "cited";
    },
  ],
]) {
  test(`broken-now without executed Evidence is downgraded, not rejected — ${name} (DESIGN.md §5)`, () => {
    const raw = fixtureReport();
    mutate(raw.ecosystems[0].findings[0]);
    const report = normalize(raw);

    assert.deepEqual(report.unverified, []);
    assert.equal(report.counts.findings, 4);
    const downgraded = report.ecosystems[0].findings[0];
    assert.equal(downgraded.urgency, BROKEN_NOW_DOWNGRADE_URGENCY);
    assert.equal(downgraded.downgradedFrom, "broken-now");
    assert.match(downgraded.downgradeReason, /executed Evidence/);
  });
}

test("an Ecosystem carries at most three Upstream Opportunities (DESIGN.md §8)", () => {
  const raw = fixtureReport();
  const template = raw.ecosystems[0].opportunities[0];
  raw.ecosystems[0].opportunities = Array.from({ length: 5 }, (_, i) => ({
    ...template,
    technique: `${template.technique} (#${i})`,
  }));

  const report = normalize(raw);

  // The fixture's other Ecosystem (nx) carries one Opportunity of its own,
  // untouched — the cap is per-Ecosystem, not a total across the report.
  assert.equal(report.counts.opportunities, MAX_OPPORTUNITIES_PER_ECOSYSTEM + 1);
  assert.equal(report.ecosystems[0].opportunities.length, 3);
  const overflow = report.unverified.filter((u) => u.reason === "too-many-opportunities");
  assert.equal(overflow.length, 2);
  assert.match(overflow[0].label, /\(#3\)/);
  assert.match(overflow[1].label, /\(#4\)/);
});

test("a fourth Opportunity that fails its own citation does not spend a slot — the count is of what survives", () => {
  const raw = fixtureReport();
  const template = raw.ecosystems[0].opportunities[0];
  raw.ecosystems[0].opportunities = [
    { ...template, technique: "ok-1" },
    { ...template, technique: "ok-2" },
    { ...template, technique: "broken", local: [] }, // refused: no local site
    { ...template, technique: "ok-3" },
  ];

  const report = normalize(raw);

  // Plus the fixture's untouched nx-Ecosystem Opportunity.
  assert.equal(report.counts.opportunities, 4);
  assert.deepEqual(
    report.ecosystems[0].opportunities.map((o) => o.technique),
    ["ok-1", "ok-2", "ok-3"],
  );
  assert.equal(report.unverified.filter((u) => u.reason === "malformed").length, 1);
  assert.equal(report.unverified.filter((u) => u.reason === "too-many-opportunities").length, 0);
});

test("an Opportunity above the Baseline is valid when the Horizon covers it", () => {
  // The fixture: baseline 16.2.6, horizon 16.3.1, minVersion 16.3.0.
  const report = normalize();
  assert.deepEqual(report.unverified, []);
  assert.equal(report.ecosystems[0].opportunities[0].minVersion, "16.3.0");
});

test("an Opportunity above the Baseline with no Horizon is refused (DESIGN.md §8)", () => {
  const raw = fixtureReport();
  delete raw.ecosystems[0].horizon;
  const report = normalize(raw);
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].kind, "upstreamOpportunity");
  assert.equal(report.unverified[0].reason, "opportunity-beyond-horizon");
  assert.match(report.unverified[0].detail, /names no Horizon/);
});

test("an Opportunity above the Baseline with a Horizon that does not reach it is refused", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].horizon = "16.2.9";
  const report = normalize(raw);
  assert.equal(report.unverified[0].reason, "opportunity-beyond-horizon");
  assert.match(report.unverified[0].detail, /above the Horizon 16\.2\.9/);
});

test("an Opportunity at or below the Baseline needs no Horizon", () => {
  const raw = fixtureReport();
  delete raw.ecosystems[0].horizon;
  raw.ecosystems[0].opportunities[0].minVersion = "16.2.6";
  const report = normalize(raw);
  assert.deepEqual(report.unverified, []);
});

test("an Incidental Observation cannot carry a disposition (DESIGN.md §7)", () => {
  const raw = fixtureReport();
  raw.ecosystems[1].incidental[0].disposition = "plan";
  const report = normalize(raw);
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].kind, "incidentalObservation");
  assert.equal(report.unverified[0].reason, "malformed");
  assert.match(report.unverified[0].detail, /cannot carry a disposition/);
});

test("every domain-rule reason is one of the closed UNVERIFIED_REASONS", () => {
  for (const reason of [
    "absent-evidence-mismatch",
    "too-many-opportunities",
    "opportunity-beyond-horizon",
  ])
    assert.ok(UNVERIFIED_REASONS.includes(reason), reason);
});

// ── Local evidence ──────────────────────────────────────────────────────────

test("verifyLocalEvidence accepts a quotation that matches the recorded commit", () => {
  assert.deepEqual(
    verifyLocalEvidence(
      {
        file: "instructions.md",
        line: 3,
        text: "Run `npx nx affected -t test` before pushing.",
      },
      fixtureReader,
    ),
    { ok: true },
  );
});

test("whitespace is presentation: a re-indented quote is the same quote", () => {
  const verdict = verifyLocalEvidence(
    {
      file: "instructions.md",
      line: 3,
      text: "   Run  `npx nx affected -t test`   before pushing.  ",
    },
    fixtureReader,
  );
  assert.deepEqual(verdict, { ok: true });
});

test("a quotation of nothing but whitespace never matches a blank line", () => {
  // Line 2 of the fixture tree IS blank, so without this rule `text: " "`
  // would be the cheapest way to satisfy a citation without reading anything.
  const verdict = verifyLocalEvidence(
    { file: "instructions.md", line: 2, text: "   " },
    fixtureReader,
  );
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "quotes-nothing");
});

test("a file that is not in the tree at the recorded commit is file-not-found", () => {
  const verdict = verifyLocalEvidence(
    { file: "nope.md", line: 1, text: "anything" },
    fixtureReader,
  );
  assert.equal(verdict.reason, "file-not-found");
});

test("a line past the end of the file reports the real line count", () => {
  // The fixture file ends in a newline. A naive split would call that eight
  // lines and let a citation to line 8 resolve as in range.
  const verdict = verifyLocalEvidence(
    { file: "instructions.md", line: 8, text: "anything" },
    fixtureReader,
  );
  assert.equal(verdict.reason, "line-out-of-range");
  assert.equal(verdict.lineCount, 7);
});

test("a quotation of the wrong line is text-differs, and says what is there", () => {
  const verdict = verifyLocalEvidence(
    { file: "instructions.md", line: 1, text: "Something else entirely" },
    fixtureReader,
  );
  assert.equal(verdict.reason, "text-differs");
  assert.equal(verdict.actual, "# Example instruction file");
});

test("every citation failure reason is one of the four named ones", () => {
  for (const reason of CITATION_FAILURE_REASONS)
    assert.ok(UNVERIFIED_REASONS.includes(reason), reason);
});

for (const [name, mutate, reason] of [
  [
    "file-not-found",
    (c) => {
      c.file = "gone.md";
    },
    "file-not-found",
  ],
  [
    "line-out-of-range",
    (c) => {
      c.line = 99;
    },
    "line-out-of-range",
  ],
  [
    "text-differs",
    (c) => {
      c.text = "Never `await cookies()` in a Server Component.";
    },
    "text-differs",
  ],
  [
    "quotes-nothing",
    (c) => {
      c.text = " ";
    },
    "quotes-nothing",
  ],
]) {
  test(`a finding whose local evidence fails as ${name} moves to Unverified`, () => {
    const raw = fixtureReport();
    mutate(raw.ecosystems[0].findings[0].local[0]);
    const report = normalize(raw);
    assert.equal(report.unverified.length, 1);
    assert.equal(report.unverified[0].reason, reason);
    assert.equal(report.counts.findings, 3);
  });
}

test("a local citation that is not {file, line, text} is malformed, not a false match", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].findings[0].local[0] = { file: "instructions.md", line: 5 };
  const report = normalize(raw);
  assert.equal(report.unverified[0].reason, "malformed");
  assert.match(report.unverified[0].detail, /local\[0\]/);
});

test("the reader is injected, and its absence is a programming error, not a citation failure", () => {
  // A defaulted reader returning null would report every citation in the
  // brief as file-not-found, which reads as the worker inventing files.
  assert.throws(() => normalizeUpstreamReport(fixtureReport()), TypeError);
});

// ── The envelope rejects the report whole ───────────────────────────────────

const rejects = (mutate, pattern) => {
  const raw = fixtureReport();
  mutate(raw);
  assert.throws(
    () => normalize(raw),
    (error) => {
      assert.ok(error instanceof UpstreamReportRejected);
      assert.ok(
        error.problems.some((p) => pattern.test(p)),
        `no problem matched ${pattern}: ${error.problems.join(" | ")}`,
      );
      return true;
    },
  );
};

test("a report of the wrong schema version is rejected whole", () => {
  rejects((r) => {
    r.schemaVersion = 99;
  }, /schemaVersion/);
});

test("a report with no recorded commit is rejected whole", () => {
  rejects((r) => {
    delete r.commit;
  }, /commit/);
  rejects((r) => {
    r.commit = "HEAD";
  }, /commit/);
});

test("a report with no ISO date is rejected whole", () => {
  rejects((r) => {
    r.date = "17 September 2026";
  }, /date/);
});

test("a report that names no scanned paths is rejected whole", () => {
  rejects((r) => {
    delete r.scanned;
  }, /scanned/);
});

test("a report with no Ecosystems is rejected whole", () => {
  rejects((r) => {
    r.ecosystems = [];
  }, /ecosystems/);
});

test("an Ecosystem with no Baseline is rejected whole — it is anchored to nothing", () => {
  rejects((r) => {
    delete r.ecosystems[0].baseline;
  }, /baseline/);
});

test("an Ecosystem missing one of the four entry lists is rejected whole", () => {
  for (const kind of ENTRY_KINDS)
    rejects((r) => {
      delete r.ecosystems[0][ENTRY_LIST_FIELDS[kind]];
    }, new RegExp(ENTRY_LIST_FIELDS[kind]));
});

test("a failed hop without a reason is rejected whole", () => {
  rejects((r) => {
    r.failedHops = [{ ecosystem: "react-native" }];
  }, /failedHops\[0\]/);
});

test("a delta of the wrong shape is rejected whole", () => {
  rejects((r) => {
    r.delta = { newFindings: ["a"] };
  }, /delta/);
});

for (const derived of ["unverified", "counts"])
  test(`a hand-written ${derived} is rejected: a derived field the author can forge is not derived`, () => {
    rejects((r) => {
      r[derived] = derived === "counts" ? {} : [];
    }, new RegExp(derived));
  });

// ── Re-checking a committed report ──────────────────────────────────────────

test("a normalized report re-checks clean against the same tree", () => {
  const verdict = recheckUpstreamReport(normalize(), {
    readSource: fixtureReader,
  });
  assert.deepEqual(verdict.problems, []);
  assert.equal(verdict.ok, true);
});

test("a committed report whose local evidence no longer matches its commit fails", () => {
  const committed = normalize();
  const drifted = (file) =>
    file === "instructions.md"
      ? "# Example instruction file\n\nsomething else entirely\n"
      : fixtureReader(file);

  const verdict = recheckUpstreamReport(committed, { readSource: drifted });

  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.length >= 1);
  assert.match(verdict.problems[0], /no longer holds at commit/);
  assert.match(verdict.problems.join("\n"), /line-out-of-range|text-differs/);
});

test("a committed report's write-time Unverified list is carried, never re-checked", () => {
  // Those entries hold no surviving claim, so re-checking them would fail
  // forever by construction and no brief could ever pass its own gate.
  const raw = fixtureReport();
  delete raw.ecosystems[0].findings[0].source.url;
  const committed = normalize(raw);
  assert.equal(committed.unverified.length, 1);

  const verdict = recheckUpstreamReport(committed, {
    readSource: fixtureReader,
  });
  assert.deepEqual(verdict.problems, []);
});

test("counts that disagree with the entries they count fail the re-check", () => {
  const committed = normalize();
  committed.counts.findings += 1;
  const verdict = recheckUpstreamReport(committed, {
    readSource: fixtureReader,
  });
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems[0], /counts\.findings/);
});

test("a report committed without being validated is refused as not normalized", () => {
  const verdict = recheckUpstreamReport(fixtureReport(), {
    readSource: fixtureReader,
  });
  assert.equal(verdict.ok, false);
  assert.match(verdict.problems[0], /not a normalized report/);
});

test("a re-check of something that is not a report at all is refused, not thrown", () => {
  assert.equal(recheckUpstreamReport(null, { readSource: fixtureReader }).ok, false);
});

// ── Portability ─────────────────────────────────────────────────────────────

test("the validator imports nothing beyond Node built-ins and its own siblings", () => {
  // DESIGN.md, Boundary: the skill is portable. A dependency here
  // would make an Upstream Brief checkable only in a repo that installs it,
  // and "dependency-free" is exactly the kind of claim that rots quietly.
  const files = readdirSync(HERE).filter(
    (name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs"),
  );
  assert.ok(files.length >= 3, `expected the skill's modules, found ${files}`);

  for (const name of files) {
    const source = readFileSync(join(HERE, name), "utf8");
    const specifiers = [
      ...source.matchAll(/(?:^|\n)\s*import\s[^'"]*from\s+['"]([^'"]+)['"]/g),
      ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((match) => match[1]);

    for (const specifier of specifiers) {
      const ok = specifier.startsWith("node:") || specifier.startsWith("./");
      assert.ok(ok, `${name} imports "${specifier}" — the skill must stay dependency-free`);
      if (specifier.startsWith("./"))
        assert.ok(
          !specifier.includes(".."),
          `${name} imports "${specifier}", which leaves the skill directory`,
        );
    }
  }
});

test("every urgency has a display title, so no heading can render as undefined", () => {
  for (const urgency of UPSTREAM_URGENCIES) assert.equal(typeof URGENCY_TITLES[urgency], "string");
});

test("incidentalOwners replaces the default owner list", () => {
  const raw = fixtureReport();
  raw.ecosystems[1].incidental[0].owner = "DepAudit";
  assert.equal(normalize(raw).unverified[0]?.reason, "malformed");
  const report = normalizeUpstreamReport(raw, {
    readSource: fixtureReader,
    incidentalOwners: ["DepAudit"],
  });
  assert.equal(report.unverified.length, 0);
  assert.equal(report.ecosystems[1].incidental[0].owner, "DepAudit");
});

test("compareVersions ranks a pre-release below its release (semver)", () => {
  assert.ok(compareVersions("16.0.0-canary.3", "16.0.0") < 0);
  assert.ok(compareVersions("16.0.0", "16.0.0-canary.3") > 0);
  assert.ok(compareVersions("16.0.0-canary.3", "16.0.0-canary.10") < 0);
  assert.ok(compareVersions("16.0.0-alpha", "16.0.0-beta") < 0);
  assert.ok(compareVersions("16.0.0-1", "16.0.0-alpha") < 0);
  assert.ok(compareVersions("16.0.0-canary.3", "15.9.9") > 0);
  assert.equal(compareVersions("v1.2.3+build.7", "1.2.3"), 0);
  assert.equal(compareVersions("22", "22.0.0"), 0);
});

test("an Opportunity whose minVersion is the release of a pre-release Baseline needs a Horizon", () => {
  const raw = fixtureReport();
  delete raw.ecosystems[0].horizon;
  raw.ecosystems[0].baseline = "16.3.0-canary.3";
  raw.ecosystems[0].opportunities[0].minVersion = "16.3.0";
  const report = normalize(raw);
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].reason, "opportunity-beyond-horizon");
});

test("a minVersion that is not a version number is malformed, not silently ordered", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].opportunities[0].minVersion = "Nx 22.1";
  const report = normalize(raw);
  assert.equal(report.unverified.length, 1);
  assert.equal(report.unverified[0].reason, "malformed");
  assert.match(report.unverified[0].detail, /not a version number/);
});
