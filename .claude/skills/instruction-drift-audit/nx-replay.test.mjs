/**
 * Replay fixture: the Nx brief's three corrected claims (DESIGN.md, Lessons),
 * restated under the structured report contract and its domain rules.
 *
 * The first Nx brief this skill wrote, in the repository it came from, carried two Correction
 * blocks for three wrong claims, written as the first free-Markdown
 * rules with no validator to catch any of them before they were committed:
 *
 *   1. "Absence from the CLI reference" was read as "removed" — an earlier
 *      draft asserted `nx dep-graph` and `nx affected:graph` do not exist,
 *      citing their absence from the docs. Running them disproved that.
 *   2. "22 executor targets" was later found to be 54 — the first count
 *      covered `apps/` only, despite the sentence claiming `libs/**` too.
 *   3. The `eslint:lint` rename in `nx.json` was called "deliberate" — a
 *      claim about local git history with no upstream statement behind it,
 *      and `git log -S` showed it was not.
 *
 * This fixture restates each claim as an Upstream Brief report would author
 * it today and asserts how the validator classifies it:
 *
 *   1. Restated as the earlier draft actually wrote it — `type: mismatch`,
 *      `evidence: absent` — it is refused, not accepted as a mismatch
 *      (DESIGN.md §3, this slice's own rule). The corrected shape (a
 *      missed-improvement or a claim citing something the docs affirmatively
 *      say) is a different finding this fixture does not need to restate to
 *      make the point.
 *   2. Restated with the corrected count and real local citations, it is a
 *      valid future-risk finding. The contract does not re-derive "54" —
 *      it checks that each cited line says what the claim says it says,
 *      which is the whole of what a citation check can prove.
 *   3. Restated as what it always was — a claim about local git history no
 *      upstream statement grounds — it is an Incidental Observation, not an
 *      Upstream Finding, and (this slice's own rule) cannot carry the `plan`
 *      disposition the original brief gave it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeUpstreamReport } from "./report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures", "nx-replay-report.json");
const TREE = join(HERE, "fixtures", "nx-replay-tree");

const treeReader = (file) => {
  try {
    return readFileSync(join(TREE, file), "utf8");
  } catch {
    return null;
  }
};

const fixtureReport = () => JSON.parse(readFileSync(FIXTURE, "utf8"));
// The replayed run's host routed Incidental Observations to its own audit
// owner, declared in that host's adapter as `incidental_owners`.
const normalize = (raw = fixtureReport()) =>
  normalizeUpstreamReport(raw, {
    readSource: treeReader,
    incidentalOwners: ["Audit"],
  });

test('claim 1 — "absent from the CLI reference, therefore removed" is not accepted as a mismatch', () => {
  const report = normalize();

  const rejected = report.unverified.find((u) => u.where === "ecosystems[0].findings[0]");
  assert.ok(rejected, "the absence-read-as-removal claim should be Unverified");
  assert.equal(rejected.reason, "absent-evidence-mismatch");
  assert.match(rejected.label, /absent from the Nx CLI reference/);

  // It did not silently disappear — the Ecosystem's other, valid finding
  // still stands (DESIGN.md §3: one bad entry does not sink the rest).
  assert.equal(report.counts.findings, 1);
});

test("claim 2 — the corrected executor-target count, cited to a real line, is a valid finding", () => {
  const report = normalize();

  const survivor = report.ecosystems[0].findings.find((f) =>
    f.claim.includes("54 explicit executor targets"),
  );
  assert.ok(survivor, "the corrected future-risk finding should survive");
  assert.equal(survivor.type, "future-risk");
  assert.equal(survivor.evidence, "cited");
  assert.equal(survivor.urgency, "removal-scheduled");
  // Not downgraded: the downgrade rule is specific to broken-now.
  assert.equal("downgradedFrom" in survivor, false);
});

test('claim 3 — the rename "called deliberate" is an Incidental Observation, not a Finding', () => {
  const report = normalize();

  assert.equal(report.ecosystems[0].incidental.length, 1);
  const incidental = report.ecosystems[0].incidental[0];
  assert.match(incidental.summary, /no upstream statement grounds/);
  assert.equal(incidental.owner, "Audit");
  // Never in the findings list, and never counted as one (DESIGN.md §7).
  assert.equal(
    report.ecosystems[0].findings.some((f) => f.claim.includes("deliberate")),
    false,
  );
  assert.equal(report.counts.incidental, 1);
});

test("claim 3, mis-classified as the original brief actually disposed it: refused, not silently accepted", () => {
  // The original brief's disposition for this claim was "plan (instruction
  // wording) + follow-on" — a plan disposition on a claim that, correctly
  // classified, is not even a Finding. Simulate that mistake directly on the
  // Incidental Observation and confirm the validator now catches it.
  const raw = fixtureReport();
  raw.ecosystems[0].incidental[0].disposition = "plan";

  const report = normalize(raw);

  assert.equal(report.ecosystems[0].incidental.length, 0);
  const rejected = report.unverified.find((u) => u.kind === "incidentalObservation");
  assert.ok(rejected);
  assert.equal(rejected.reason, "malformed");
  assert.match(rejected.detail, /cannot carry a disposition/);
});
