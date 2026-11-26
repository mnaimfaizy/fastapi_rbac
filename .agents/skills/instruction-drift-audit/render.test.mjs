/**
 * Contract suite for the Upstream Brief renderer.
 *
 * The rule under test is the one two of the first three briefs broke by
 * inventing a section the template lacked: the brief emits **every** section,
 * always, in one fixed order, and an empty one says `_None._` rather than
 * disappearing. A section that vanishes when empty is indistinguishable from
 * a section nobody ran.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { fixtureReader, fixtureReport } from "./report.test.mjs";
import { normalizeUpstreamReport } from "./report.mjs";
import { BRIEF_SECTIONS, EMPTY_SECTION, renderUpstreamBrief } from "./render.mjs";

const normalize = (raw = fixtureReport()) =>
  normalizeUpstreamReport(raw, { readSource: fixtureReader });

const headings = (markdown) =>
  markdown
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3));

/** The body between one `##` heading and the next. */
const sectionBody = (markdown, title) => {
  const lines = markdown.split("\n");
  const start = lines.indexOf(`## ${title}`);
  assert.notEqual(start, -1, `no "## ${title}" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
};

test("every section is emitted, in the one fixed order", () => {
  assert.deepEqual(headings(renderUpstreamBrief(normalize())), [...BRIEF_SECTIONS]);
});

test("an empty report still emits every section, each saying _None._", () => {
  const raw = fixtureReport();
  delete raw.delta;
  raw.scanned = [];
  raw.failedHops = [];
  for (const eco of raw.ecosystems) {
    eco.findings = [];
    eco.checkedAndClear = [];
    eco.opportunities = [];
    eco.incidental = [];
  }
  // `scanned` is required to be an array, and an empty one is legal: a run
  // that read nothing is a fact worth rendering, not a report to reject.
  const markdown = renderUpstreamBrief(normalize(raw));

  assert.deepEqual(headings(markdown), [...BRIEF_SECTIONS]);
  for (const title of BRIEF_SECTIONS)
    assert.equal(sectionBody(markdown, title), EMPTY_SECTION, title);
});

test("the front matter records the commit every citation was checked against", () => {
  const markdown = renderUpstreamBrief(normalize());
  assert.match(markdown, /^# Upstream Brief: next, nx$/m);
  assert.match(markdown, /\*\*Date:\*\* 2026-09-17/);
  assert.match(markdown, /\*\*Commit:\*\* `0123456789abcdef0123456789abcdef01234567`/);
});

test("an Ecosystem renders its Baseline, its members, and whether it has a Horizon", () => {
  const markdown = renderUpstreamBrief(normalize());
  assert.match(
    markdown,
    /- `next` — Baseline `16\.2\.6`, Horizon `16\.3\.1`; members `next`, `eslint-config-next`/,
  );
  assert.match(markdown, /- `nx` — Baseline `22\.7\.7`, no Horizon/);
  assert.match(markdown, /- drift: TECH_STACK\.md records 16\.1\.0/);
});

test("BRIEF.md documents the section order the renderer actually emits", () => {
  // DESIGN.md, Principles: an artifact states no claim it does not assert. BRIEF.md tells a
  // reader what the brief looks like, so it names every section in order — and
  // a template restating an order nothing checks is exactly the drift the two
  // first briefs demonstrated by inventing a section the template lacked.
  const brief = readFileSync(fileURLToPath(new URL("./BRIEF.md", import.meta.url)), "utf8");
  const documented = [...brief.matchAll(/^\| \d+ +\| `([^`]+)`/gm)].map((m) => m[1]);
  assert.deepEqual(documented, [...BRIEF_SECTIONS]);
});

test("Upstream Findings are grouped by urgency, most urgent first", () => {
  const body = sectionBody(renderUpstreamBrief(normalize()), "Upstream Findings");
  const order = body
    .split("\n")
    .filter((line) => line.startsWith("### "))
    .map((line) => line.slice(4));
  // Urgency orders the plan (DESIGN.md §5), so it is the outer grouping.
  assert.deepEqual(order, ["Broken now", "Removal scheduled", "Deprecated"]);
});

test("a finding renders its source, its Evidence kind, and any executed command", () => {
  const body = sectionBody(renderUpstreamBrief(normalize()), "Upstream Findings");
  assert.match(body, /page version `16\.2\.6`/);
  assert.match(body, /cookies is an asynchronous function/);
  assert.match(body, /\*\*Evidence:\*\* `executed`/);
  assert.match(body, /\*\*Executed:\*\* `node --input-type=module.*` → exit 0/);
  assert.ok(body.includes("`instructions.md:5`"));
  assert.ok(body.includes("Always `await cookies()` in a Server Component."));
});

test("a downgraded broken-now finding renders why, not just its new urgency", () => {
  const raw = fixtureReport();
  raw.ecosystems[0].findings[0].evidence = "cited";
  const markdown = renderUpstreamBrief(normalize(raw));
  const body = sectionBody(markdown, "Upstream Findings");
  assert.match(
    body,
    /\*\*Downgraded from:\*\* `broken-now` — broken-now requires executed Evidence/,
  );
  // It renders under its downgraded urgency's heading, not under "Broken now".
  const order = body
    .split("\n")
    .filter((line) => line.startsWith("### "))
    .map((line) => line.slice(4));
  assert.deepEqual(order, ["Removal scheduled", "Deprecated", "Advisory"]);
});

test("a follow-on finding is in Follow-on and not in Upstream Findings", () => {
  const markdown = renderUpstreamBrief(normalize());
  const claim = "Application code still reaches for the older data-fetching form";
  assert.ok(sectionBody(markdown, "Follow-on").includes(claim));
  assert.ok(!sectionBody(markdown, "Upstream Findings").includes(claim));
});

test("an Opportunity renders the upstream's own benefit statement and its minimum version", () => {
  const body = sectionBody(renderUpstreamBrief(normalize()), "Upstream Opportunities");
  assert.match(body, /Streaming metadata lets the page shell render/);
  assert.match(body, /\*\*Adoptable from:\*\* `16\.3\.0`/);
  // The nx Opportunity names no minVersion, so no line claims one for it.
  assert.match(body, /Let Nx infer the hygiene script's target/);
});

test("an Incidental Observation renders its owner and is never in the plan", () => {
  const markdown = renderUpstreamBrief(normalize());
  const body = sectionBody(markdown, "Incidental Observations");
  assert.match(body, /\*\*Owner:\*\* `ad-hoc-issue`/);
  assert.ok(!sectionBody(markdown, "Upstream Findings").includes("contract suite"));
});

test("Unverified names the entry, the reason, and the claim that was dropped", () => {
  const raw = fixtureReport();
  delete raw.ecosystems[0].findings[0].source.url;
  const body = sectionBody(renderUpstreamBrief(normalize(raw)), "Unverified");
  assert.match(body, /`ecosystems\[0\]\.findings\[0\]`/);
  assert.match(body, /\*\*missing-source-url\*\*/);
  assert.match(body, /Claim: The instruction file teaches/);
});

test("a failed hop is recorded rather than allowed to sink the run", () => {
  const body = sectionBody(renderUpstreamBrief(normalize()), "Failed hops");
  assert.match(body, /`react-native` — the upstream release-notes page returned 503/);
});

test("Scanned lists what the run actually read", () => {
  const body = sectionBody(renderUpstreamBrief(normalize()), "Scanned");
  assert.deepEqual(body.split("\n"), ["- `instructions.md`", "- `hygiene.mjs`"]);
});

test("Delta opens the brief with what changed since the last run", () => {
  const markdown = renderUpstreamBrief(normalize());
  assert.equal(headings(markdown)[0], "Delta");
  const body = sectionBody(markdown, "Delta");
  assert.match(body, /\*\*New:\*\* `next` — the instruction file still teaches/);
  assert.match(body, /\*\*Resolved:\*\* `nx` —/);
  assert.match(body, /\*\*Still present:\*\* `nx` —/);
});

test("a quoted line containing backticks renders as one code span, not three", () => {
  // The lines this repo's instruction files are made of are full of
  // backticks. Wrapped in a single one, "Always `await cookies()` in a Server
  // Component." renders as three broken spans, which is a citation a reader
  // cannot compare to the source.
  const body = sectionBody(renderUpstreamBrief(normalize()), "Upstream Findings");
  assert.ok(body.includes("``Always `await cookies()` in a Server Component.``"), body);
});

test("the brief ends with exactly one newline and no blank-line runs", () => {
  const markdown = renderUpstreamBrief(normalize());
  assert.ok(markdown.endsWith("\n"));
  assert.ok(!markdown.endsWith("\n\n"));
  assert.ok(!markdown.includes("\n\n\n"));
});
