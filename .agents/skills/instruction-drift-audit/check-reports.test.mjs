/**
 * Contract suite for the gate, `check-reports.mjs`. Each of the three
 * assertions its header declares is proven to fail on the drift it claims to
 * catch, and the exit codes separate "fails" (1) from "could not run" (2).
 *
 * Driven over a file map, so the suite never depends on this clone's history.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_LABEL, checkReports } from "./check-reports.mjs";
import { normalizeUpstreamReport } from "./report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = join(HERE, "fixtures", "tree");
const ADAPTER = "instruction-drift-audit.config.yml";
const BRIEFS = "docs/research";
const REPORT = `${BRIEFS}/2026-01-01-upstream-brief-nx.json`;

const treeReader = (file) => {
  try {
    return readFileSync(join(TREE, file), "utf8");
  } catch {
    return null;
  }
};

const fixtureReport = () => JSON.parse(readFileSync(join(HERE, "fixtures", "report.json"), "utf8"));

/** The committed artifact: the validator's output, not the worker's input. */
const committed = (mutate, options = {}) => {
  const raw = fixtureReport();
  if (mutate) mutate(raw);
  return normalizeUpstreamReport(raw, { readSource: treeReader, ...options });
};

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const check = (files, { commits, source = treeReader, label } = {}) => {
  const commit = fixtureReport().commit;
  return checkReports({
    read: (path) => files[path] ?? null,
    list: (dir) =>
      dir === BRIEFS && Object.keys(files).some((p) => p.startsWith(`${BRIEFS}/`))
        ? Object.keys(files)
            .filter((p) => p.startsWith(`${BRIEFS}/`))
            .map((p) => p.slice(BRIEFS.length + 1))
        : null,
    hasCommit: (c) => (commits ?? [commit]).includes(c),
    source: () => source,
    label,
  });
};

// ── 1. The adapter reads cleanly ────────────────────────────────────────────

test("an adapter problem fails the gate, with the adapter path and line", () => {
  const result = check({ [ADAPTER]: "brief_dir: docs/research\nbriefs: x\n" });
  assert.equal(result.exitCode, 1);
  assert.match(
    result.lines.join("\n"),
    /instruction-drift-audit\.config\.yml: unknown key `briefs`/,
  );
});

test("entries hidden under `declined_opportunities: []` fail rather than vanish", () => {
  const result = check({
    [ADAPTER]: "declined_opportunities: []\n  - ecosystem: nx\n",
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join("\n"), /line 2: unexpected indentation/);
});

// ── 2. The committed reports ────────────────────────────────────────────────

test("a committed report that still holds passes", () => {
  const result = check({ [REPORT]: json(committed()) });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    result.reports.map((r) => r.ok),
    [true],
  );
});

test("a citation that no longer matches its commit fails", () => {
  const result = check(
    { [REPORT]: json(committed()) },
    { source: (file) => (treeReader(file) ?? "").replace(/./g, "x") },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join("\n"), /no longer holds/);
});

test("a recorded commit this clone does not have could not run (exit 2)", () => {
  const result = check({ [REPORT]: json(committed()) }, { commits: [] });
  assert.equal(result.exitCode, 2);
  assert.match(result.lines.join("\n"), /fetch-depth: 0/);
});

test("a report that is not JSON fails; one that records no commit fails", () => {
  assert.equal(check({ [REPORT]: "{" }).exitCode, 1);
  const noCommit = committed();
  delete noCommit.commit;
  assert.equal(check({ [REPORT]: json(noCommit) }).exitCode, 1);
});

test("no brief directory, or no report in it, passes and says so", () => {
  assert.match(check({}).lines[0], /does not exist/);
  assert.equal(check({}).exitCode, 0);
  const onlyMarkdown = check({ [`${BRIEFS}/old.md`]: "# brief" });
  assert.match(onlyMarkdown.lines.join("\n"), /nothing to re-validate/);
});

test("the adapter’s incidental_owners are the owners a recheck accepts", () => {
  const report = committed(
    (raw) => {
      raw.ecosystems[1].incidental[0].owner = "DepAudit";
    },
    { incidentalOwners: ["DepAudit"] },
  );
  const without = check({ [REPORT]: json(report) });
  assert.equal(without.exitCode, 1);
  const withOwners = check({
    [REPORT]: json(report),
    [ADAPTER]: "incidental_owners: [DepAudit]\n",
  });
  assert.equal(withOwners.exitCode, 0);
});

// ── 3. The declined Opportunities ───────────────────────────────────────────

const declined = (site) =>
  [
    "ecosystems:",
    "  - lead: nx",
    "declined_opportunities:",
    "  - ecosystem: nx",
    "    url: https://nx.dev/concepts/inferred-tasks",
    `    site: ${site}`,
    "    reason: later",
    "    baseline_range: '22.x'",
    "    quote: Inferred tasks keep configuration in step.",
  ].join("\n");

test("a declined entry whose site is gone fails; one that exists passes", () => {
  const gone = check({ [ADAPTER]: declined("tools/gone.ts") });
  assert.equal(gone.exitCode, 1);
  assert.match(gone.lines.join("\n"), /declined_opportunities\[0\].*site-not-found/);
  const present = check({
    [ADAPTER]: declined("tools/here.ts"),
    "tools/here.ts": "// here",
  });
  assert.equal(present.exitCode, 0);
  assert.match(present.lines.join("\n"), /1 declined Opportunity\(s\) still point/);
});

test("every line carries the label, and a host may choose its own", () => {
  assert.ok(check({}).lines.every((line) => line.startsWith(`${DEFAULT_LABEL}:`)));
  assert.ok(check({}, { label: "drift" }).lines.every((l) => l.startsWith("drift:")));
});
