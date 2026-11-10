/**
 * Contract suite for the ledger command (DESIGN.md §11 and §12).
 *
 * The judgment is `ledger.mjs`'s and is proved in `ledger.test.mjs`. What is
 * proved here is the wiring: which committed report is read as an Ecosystem's
 * ledger, that an Ecosystem with none says so rather than reading as a run
 * that carried nothing, that the declined entries reach the same validator the
 * gate uses, and that the adapter reading matches what ADAPTER.md documents.
 *
 * Every input is injected, so nothing here reads this repository.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeUpstreamReport } from "./report.mjs";
import {
  DEFAULT_BRIEF_DIR,
  ledgerStatus,
  readBriefDir,
  readCommittedReports,
  readDeclaredLeads,
  readDeclinedOpportunities,
} from "./resolve-ledger.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = join(HERE, "fixtures", "tree");

const treeFile = (file) => {
  try {
    return readFileSync(join(TREE, file), "utf8");
  } catch {
    return null;
  }
};

const committedReport = () =>
  normalizeUpstreamReport(JSON.parse(readFileSync(join(HERE, "fixtures", "report.json"), "utf8")), {
    readSource: treeFile,
  });

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** A repository made of a file map, falling back to the fixture tree. */
const status = (files, { dirs = {}, resolved = [] } = {}) =>
  ledgerStatus({
    read: (path) => files[path] ?? treeFile(path),
    list: (dir) => dirs[dir] ?? null,
    resolved,
  });

const NX = { lead: "nx", ok: true, baseline: "22.7.7" };
const NEXT = { lead: "next", ok: true, baseline: "16.2.6" };

const withLedger = (extraFiles = {}) => ({
  files: {
    "docs/research/2026-09-17-brief.json": json(committedReport()),
    ...extraFiles,
  },
  dirs: { "docs/research": ["2026-09-17-brief.json"] },
});

// ── Where things are ────────────────────────────────────────────────────────

test("the brief directory comes from the adapter, or the documented default", () => {
  assert.equal(
    readBriefDir((p) =>
      p === "instruction-drift-audit.config.yml" ? "brief_dir: docs/upstream\n" : null,
    ),
    "docs/upstream",
  );
  assert.equal(
    readBriefDir(() => null),
    DEFAULT_BRIEF_DIR,
  );
});

test("the first config file present is the adapter, and a key it omits takes the default", () => {
  // ADAPTER.md's lookup order is over files: the `.yml` present here is the
  // adapter, so a key it does not carry falls to the documented default rather
  // than sending the search on to a `.json` file the repo also did not choose.
  // All three readers walk the same way, which is why they share one walker.
  const files = {
    "instruction-drift-audit.config.yml": "ecosystems:\n  - lead: nx\n",
    "instruction-drift-audit.config.json": json({
      brief_dir: "docs/never-read",
      ecosystems: [{ lead: "never-read" }],
    }),
  };
  const read = (p) => files[p] ?? null;
  assert.equal(readBriefDir(read), DEFAULT_BRIEF_DIR);
  assert.deepEqual(readDeclaredLeads(read), ["nx"]);
  assert.deepEqual(readDeclinedOpportunities(read), []);
});

test("every JSON file in the brief directory is read as a report, and nothing else is", () => {
  const { files, dirs } = withLedger();
  const reports = readCommittedReports(
    (p) => files[p] ?? null,
    (d) => [...(dirs[d] ?? []), "notes.md"],
    "docs/research",
  );
  assert.equal(reports.length, 1);
  assert.equal(reports[0].path, "docs/research/2026-09-17-brief.json");
});

test("a report that is not JSON is skipped here and left to the gate", () => {
  const reports = readCommittedReports(
    () => "{ nope",
    () => ["broken.json"],
    "docs/research",
  );
  assert.deepEqual(reports, []);
});

test("declined entries are read from either adapter dialect", () => {
  const yaml =
    "declined_opportunities:\n" +
    "  - ecosystem: nx\n" +
    "    url: https://nx.dev/concepts/inferred-tasks\n" +
    "    site: hygiene.mjs\n" +
    "    reason: not this quarter\n" +
    "    baseline_range: '22.x'\n" +
    "    quote: Inferred tasks keep project configuration in step.\n";
  assert.equal(
    readDeclinedOpportunities((p) => (p === "instruction-drift-audit.config.yml" ? yaml : null))[0]
      .baselineRange,
    "22.x",
  );

  assert.deepEqual(
    readDeclinedOpportunities((p) =>
      p === "instruction-drift-audit.config.json"
        ? json({
            declined_opportunities: [
              {
                ecosystem: "nx",
                url: "https://nx.dev/x",
                site: "hygiene.mjs",
                reason: "no",
                baseline_range: "22.x",
                quote: "q",
              },
            ],
          })
        : null,
    ),
    [
      {
        ecosystem: "nx",
        url: "https://nx.dev/x",
        site: "hygiene.mjs",
        reason: "no",
        baselineRange: "22.x",
        quote: "q",
      },
    ],
  );
});

// ── What it reports ─────────────────────────────────────────────────────────

test("an Ecosystem with no committed report says the first run researches everything", () => {
  const output = status({}, { resolved: [NX] }).lines.join("\n");
  assert.match(output, /nx — no committed report in docs\/research/);
  assert.match(output, /researches everything/);
});

test("an Ecosystem with a ledger reports what it carries forward", () => {
  const { files, dirs } = withLedger();
  const output = status(files, { dirs, resolved: [NEXT] }).lines.join("\n");
  assert.match(output, /next — ledger docs\/research\/2026-09-17-brief\.json/);
  assert.match(output, /1 claim\(s\) carried forward, 0 researched again/);
  assert.match(output, /carried: The instruction file's rule/);
});

test("a Baseline that has left a claim’s range is reported as research, with the reason", () => {
  const { files, dirs } = withLedger();
  const output = status(files, {
    dirs,
    resolved: [{ ...NEXT, baseline: "17.1.0" }],
  }).lines.join("\n");
  assert.match(output, /0 claim\(s\) carried forward, 1 researched again/);
  assert.match(output, /research: .* — baseline-outside-range/);
});

test("an Ecosystem whose lead is not installed is reported failed, and the rest still resolve", () => {
  const { files, dirs } = withLedger();
  const output = status(files, {
    dirs,
    resolved: [{ lead: "gone", ok: false, reason: "not installed" }, NEXT],
  }).lines.join("\n");
  assert.match(output, /gone — FAILED: not installed/);
  assert.match(output, /next — ledger/);
});

test("no Ecosystem declared says so rather than printing nothing", () => {
  assert.match(status({}).lines.join("\n"), /nothing to remember/);
});

// ── Declined Opportunities ──────────────────────────────────────────────────

const declinedAdapter = (site, range = ">=22.0.0 <23.0.0") =>
  "declined_opportunities:\n" +
  "  - ecosystem: nx\n" +
  "    url: https://nx.dev/concepts/inferred-tasks\n" +
  `    site: ${site}\n` +
  "    reason: the migration is tracked and is not this quarter\n" +
  `    baseline_range: '${range}'\n` +
  "    quote: Inferred tasks keep project configuration in step with the tools actually installed.\n";

test("a declined Opportunity still in range is reported suppressed", () => {
  const { files, dirs } = withLedger({
    "instruction-drift-audit.config.yml": declinedAdapter("hygiene.mjs"),
  });
  const output = status(files, { dirs, resolved: [NX] }).lines.join("\n");
  assert.match(output, /declined: Let Nx infer the hygiene script's target/);
  assert.match(output, /suppressed at 22\.7\.7/);
});

test("a declined Opportunity whose Baseline left the range is reported resurfaced", () => {
  const { files, dirs } = withLedger({
    "instruction-drift-audit.config.yml": declinedAdapter("hygiene.mjs"),
  });
  const output = status(files, {
    dirs,
    resolved: [{ ...NX, baseline: "23.1.0" }],
  }).lines.join("\n");
  assert.match(output, /resurfaced: .* — baseline-left-range/);
});

test("a declined entry pointing at a file that is gone is reported, and names the gate that fails", () => {
  const { files, dirs } = withLedger({
    "instruction-drift-audit.config.yml": declinedAdapter("tools/scripts/gone.mjs"),
  });
  const output = status(files, { dirs, resolved: [NX] }).lines.join("\n");
  assert.match(output, /declined_opportunities\[0\] .* site-not-found/);
  assert.match(output, /check-reports\.mjs/);
});

test("an adapter with no declined entry says so", () => {
  assert.match(
    status({}, { resolved: [NX] }).lines.join("\n"),
    /no declined Opportunity recorded in the adapter/,
  );
});
