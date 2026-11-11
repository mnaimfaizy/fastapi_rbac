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
