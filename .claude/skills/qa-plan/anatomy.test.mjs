/**
 * Contract suite for the plan format. ANATOMY.md is the only thing `qa-plan`
 * and `manual-qa` share, so it must name every part of a QA Plan the spec
 * lists: the nine sections in order, the Run brief's fields, each scenario's
 * fields, and the no-credentials rule. SKILL.md must point at it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const anatomy = readFileSync(join(HERE, "ANATOMY.md"), "utf8");
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");

/** The plan's sections, in the order a plan carries them. */
const SECTIONS = [
  "Anchors",
  "What automation already proves",
  "Expected red herrings",
  "Run brief",
  "Setup",
  "Scenarios",
  "Sign-off checklist",
  "Stop and do not merge if",
  "Execution record",
];

/** The text under one `## ` heading of ANATOMY.md. */
function section(title) {
  const parts = `\n${anatomy}`.split(/\n## /);
  const body = parts.find((part) => part.split("\n")[0].trim() === title);
  assert.ok(body, `ANATOMY.md has no \`## ${title}\` section`);
  return body;
}

test("the shape lists the nine sections, in order, as exact headings", () => {
  const shape = section("Shape");
  const listed = [...shape.matchAll(/^\d+\. `## (.+)`$/gm)].map((m) => m[1]);
  assert.deepEqual(listed, SECTIONS);
});

test("each section has its own heading, in the same order", () => {
  const headings = [...anatomy.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(
    headings.filter((h) => SECTIONS.includes(h)),
    SECTIONS,
  );
});

test("the anchors are subject issue, pull request, merge-base and head", () => {
  const anchors = section("Anchors");
  for (const label of ["Subject issue:", "Pull request:", "Merge-base:", "Head:"])
    assert.ok(anchors.includes(`**${label}**`), `Anchors lacks **${label}**`);
});

test("coverage claims are tagged observed or reconstructed", () => {
  const proves = section("What automation already proves");
  assert.ok(proves.includes("`[observed]`") && proves.includes("`[reconstructed]`"));
});

test("the Run brief names target, surface, build, roles, credentials and capture rules", () => {
  const brief = section("Run brief");
  for (const label of ["Target:", "Surface:", "Build:", "Roles:", "Credentials:", "Capture rules:"])
    assert.ok(brief.includes(`**${label}**`), `Run brief lacks **${label}**`);
  for (const value of ["`stack`", "`url`", "`web`", "`desktop`", "`mobile`", "`api`"])
    assert.ok(brief.includes(value), `Run brief lacks ${value}`);
  assert.match(brief, /head SHA/);
  assert.match(brief, /version endpoint/);
  assert.match(brief, /test-environment label/);
  assert.match(brief, /accounts\.print/);
});

test("ANATOMY.md states how the checker reads Target, Surface and Signs in as", () => {
  const shape = section("Shape");
  assert.match(shape, /### First-word values/);
  for (const label of ["Target:", "Surface:", "Signs in as:"])
    assert.ok(shape.includes(`**${label}**`), `First-word values does not name **${label}**`);
  assert.match(shape, /Backticks are dropped/);
  assert.match(shape, /`\*` and `_` at either end of the word are dropped/);
  assert.match(shape, /`team_admin` is read as `team_admin`/);
  assert.match(shape, /space, comma, semicolon, colon or parenthesis/);
  assert.match(shape, /Nothing else is stripped/);
  assert.match(shape, /reads as `web\.` and fails/);
  const brief = section("Run brief");
  assert.match(
    brief,
    /\*\*Surface:\*\* exactly one of .*\[first-word value\]\(#first-word-values\)/,
  );
  const scenarios = section("Scenarios");
  assert.match(
    scenarios,
    /\*\*Signs in as:\*\* a \[first-word value\]\(#first-word-values\): a role id the Run brief's \*\*Roles:\*\* names, or `nobody`/,
  );
  assert.match(scenarios, /first word `the`/);
  assert.match(scenarios, /first word `manager\.`/);
});

test("a Scenario account is defined, with how a later scenario names it", () => {
  const scenarios = section("Scenarios");
  assert.match(scenarios, /### Scenario accounts/);
  assert.match(
    scenarios,
    /or the id of a \[Scenario account\]\(#scenario-accounts\) an earlier scenario creates/,
  );
  assert.match(
    scenarios,
    /Each id is created by one scenario only, and is neither a Run brief role nor `nobody`/,
  );
  assert.match(scenarios, /`` `temp-user` \(created in S1\) ``/);
  assert.match(scenarios, /Only a scenario after its creator may/);
  assert.match(scenarios, /never the values/);
  assert.match(scenarios, /`manual-qa` leaves S2 for a person when S1 does not pass/);
  assert.match(
    section("Shape"),
    /each \[Scenario account\]\(#scenario-accounts\) an earlier scenario creates/,
  );
});

test("Sessions are defined, with an example, as the alternative to Signs in as", () => {
  const scenarios = section("Scenarios");
  assert.match(scenarios, /### Sessions/);
  assert.match(
    scenarios,
    /A \*\*Session\*\* is one signed-in identity, with cookies and storage no other session shares/,
  );
  assert.match(
    scenarios,
    /A scenario carries \*\*Signs in as:\*\* or \*\*Sessions:\*\*, never both and never neither/,
  );
  assert.match(scenarios, /The name is a single capital letter/);
  assert.match(scenarios, /Every numbered step starts `In session <name>,` \(or `In <name>,`\)/);
  assert.match(scenarios, /Tabs in one browser profile share cookies/);
  assert.match(scenarios, /- \*\*Sessions:\*\* A = `user`, B = `admin`/);
  assert.match(section("Shape"), /and each id in \*\*Sessions:\*\*/);
});

test("no credentials travel with a plan", () => {
  const brief = section("Run brief");
  assert.match(brief, /### No credentials travel with a plan/);
  assert.match(brief, /Not even a public QA Account's values/);
  assert.match(brief, /refuses a plan that carries one/);
});

test("each scenario carries its fields, in order, numbered from S1", () => {
  const scenarios = section("Scenarios");
  assert.match(scenarios, /`### S1: <what is verified>`/);
  const labels = [
    "Why only a human can prove it:",
    "Signs in as:",
    "Creates:",
    "Steps:",
    "Expected result:",
    "A failure means:",
    "If this fails, first rule out:",
  ];
  const positions = labels.map((label) => scenarios.indexOf(`**${label}**`));
  for (const [n, at] of positions.entries())
    assert.ok(at !== -1, `Scenarios lacks **${labels[n]}**`);
  assert.deepEqual(
    [...positions].sort((a, b) => a - b),
    positions,
    "scenario fields out of order",
  );
  assert.match(scenarios, /Hazard pack/);
  assert.match(scenarios, /Residue/);
});

test("the execution record is empty after compose", () => {
  assert.match(section("Execution record"), /exactly the line `_Not run yet\._`/);
});

test("the marker line names the format, the subject and the pull request", () => {
  assert.match(anatomy, /<!-- qa-plan format=1 subject=#\d+ pr=#\d+ -->/);
});

test("SKILL.md writes plans in this format and delivers by the same marker", () => {
  assert.match(skill, /\[ANATOMY\.md\]\(ANATOMY\.md\)/);
  assert.match(skill, /`_Not run yet\._`/);
  assert.match(skill, /qa-plan format=1 subject=#<n>/);
});

test("SKILL.md composes a multi-session scenario when a promise needs two people at once", () => {
  assert.match(
    skill,
    /When a promise needs two people signed in at once, compose a multi-session scenario/,
  );
  assert.match(skill, /\[ANATOMY\.md\]\(ANATOMY\.md#sessions\)/);
  assert.match(skill, /Never fold the second person into a step's prose/);
});
