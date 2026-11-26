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
    "Surface:",
    "Observes:",
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

test("a scenario's **Observes:** takes values from a fixed list, after its **Surface:**", () => {
  const flat = section("Scenarios").replace(/\s+/g, " ");
  assert.match(
    flat,
    /\*\*Observes:\*\* .*`headers`, `cookies`, `httponly-cookies`, `status`, `body`, `screen`, `local-file`/,
  );
  assert.match(
    flat,
    /Right after the scenario's \*\*Surface:\*\*, or after its sign-in field .* when it has none/,
  );
  assert.match(flat, /The plan check refuses any other value, naming it/);
  assert.match(
    flat,
    /Whether a driver can see a value is checked at run time, .* not by the plan check/,
  );
  assert.match(
    flat,
    /`manual-qa` leaves the scenario for a person when no one driver here observes all of them/,
  );
});

test("the execution record is empty after compose", () => {
  assert.match(section("Execution record"), /exactly the line `_Not run yet\._`/);
});

test("the marker line names the format, the subject and the pull request", () => {
  assert.match(anatomy, /<!-- qa-plan format=3 subject=#\d+ pr=#\d+ -->/);
  assert.doesNotMatch(anatomy, /<!-- qa-plan format=[12] subject=/);
});

test("ANATOMY.md says which formats a copy reads, and which fields each format carries", () => {
  const shape = section("Shape");
  assert.match(shape, /The composer writes `format=3`/);
  assert.match(shape, /reads `format=1`, `format=2` and `format=3`/);
  assert.match(shape, /A `format=1` plan carries no per-scenario field/);
  assert.match(shape, /A `format=2` plan carries no \*\*Capture:\*\* or \*\*Expected before:\*\*/);
  assert.match(shape, /naming the field and the format it needs/);
  assert.match(shape, /refuses any other `format`/);
});

test("a scenario may carry its own Surface, after its sign-in fields and before Steps", () => {
  const scenarios = section("Scenarios");
  const labels = [...scenarios.matchAll(/^- \*\*([^*]+):\*\*/gm)].map((m) => m[1]);
  const at = (label) => labels.indexOf(label);
  assert.ok(at("Surface") > at("Creates") && at("Surface") < at("Steps"), labels.join(" · "));
  assert.match(
    scenarios,
    /\*\*Surface:\*\* when this scenario drives another surface than the Run brief's \*\*Surface:\*\* \(one that repeats the Run brief's is accepted and changes nothing\)/,
  );
  assert.match(scenarios, /\[first-word value\]\(#first-word-values\)/);
  assert.match(scenarios, /`format=2` or later/);
  const brief = section("Run brief");
  assert.match(brief, /the plan's default/);
  assert.match(brief, /a scenario's own \*\*Surface:\*\* overrides it/);
  assert.match(section("Shape"), /\*\*Surface:\*\* \(the Run brief's, and a scenario's\)/);
});

test("SKILL.md writes plans in this format and delivers by the same marker", () => {
  assert.match(skill, /\[ANATOMY\.md\]\(ANATOMY\.md\)/);
  assert.match(skill, /`_Not run yet\._`/);
  assert.match(skill, /the marker on line 1 with `format=3`/);
  // A revision still finds the plan it replaces when that plan was written in an older format.
  assert.match(
    skill,
    /`<!-- qa-plan format=1 subject=#<n> `, `<!-- qa-plan format=2 subject=#<n> ` or `<!-- qa-plan format=3 subject=#<n> `/,
  );
  assert.match(skill, /the same marker with `format=1` or `format=2`/);
});

test("SKILL.md step 6 picks each scenario's surface from what its expected result observes", () => {
  const flat = skill.replace(/\s+/g, " ");
  assert.match(
    flat,
    /Pick each scenario's surface from what its \*\*Expected result:\*\* must observe/,
  );
  assert.match(
    flat,
    /Response headers, cookies \(including `HttpOnly`\), status codes and response bodies are seen on `api`/,
  );
  assert.match(flat, /Rendered copy, flows and layout are seen on `web`/);
  assert.match(flat, /The app itself is seen on `desktop` or `mobile`/);
  assert.match(flat, /The Run brief's \*\*Surface:\*\* is the one most scenarios use/);
  assert.match(flat, /`run\.surface` in the config is only the starting default/);
  assert.match(flat, /\[ANATOMY\.md\]\(ANATOMY\.md#scenarios\)/);
});

test("SKILL.md step 6 writes **Observes:** when not every driver of the surface can see the result", () => {
  const flat = skill.replace(/\s+/g, " ");
  assert.match(
    flat,
    /Give a scenario \*\*Observes:\*\* whenever its \*\*Expected result:\*\* needs something not every driver of its surface can see/,
  );
  assert.match(flat, /in practice response headers, `HttpOnly` cookies or a local file/);
  assert.match(
    flat,
    /`headers`, `cookies`, `httponly-cookies`, `status`, `body`, `screen`, `local-file`/,
  );
  assert.match(flat, /Use the same list to choose the surface/);
  assert.match(
    flat,
    /`local-file` on a surface whose driver can open a `file:\/\/` address, as `manual-qa`'s step 4 table gives it/,
  );
});

test("SKILL.md composes a multi-session scenario when a promise needs two people at once", () => {
  assert.match(
    skill,
    /When a promise needs two people signed in at once, compose a multi-session scenario/,
  );
  assert.match(skill, /\[ANATOMY\.md\]\(ANATOMY\.md#sessions\)/);
  assert.match(skill, /Never fold the second person into a step's prose/);
});

test("Setup and Steps carry product actions only, and say what to do with a command-only promise (#199)", () => {
  const promise =
    /A promise that only a command can observe \(a setting, a cache entry, internal state\) is either observable through the product surface, or it is not Residue/;
  const setup = section("Setup");
  assert.match(setup, /Each line is a product action, never a shell command/);
  assert.match(setup, /`manual-qa` runs no command from a plan/);
  assert.match(setup, /fenced code block/);
  assert.match(setup, promise);
  const scenarios = section("Scenarios");
  assert.match(
    scenarios,
    /A step is a product action, never a shell command, and the plan check reports one as it does in \[Setup\]\(#setup\)/,
  );
  assert.match(
    scenarios,
    /a promise that only a command can observe is either observable through the product surface, or it is not Residue/,
  );
  const compose = skill.split(/^### /m).find((part) => part.startsWith("6. Compose the Residue"));
  assert.ok(compose, "SKILL.md has no step 6, Compose the Residue");
  assert.match(compose, promise);
  assert.match(compose, /the plan check reports one that reads as a shell command/);
});

test("step 4 asks whether a configured suite's test could prove each promise left for the Residue (#206)", () => {
  const parts = skill.split(/^### /m);
  const establish = parts.find((part) =>
    part.startsWith("4. Establish what automation already proves"),
  );
  assert.ok(establish, "SKILL.md has no step 4, Establish what automation already proves");
  assert.match(establish, /\*\*Could a test prove it\?\*\*/);
  assert.match(
    establish,
    /for each promise left for the Residue, check whether a test in a configured suite could prove it; this check is yours, and the person is asked only where the answer is yes/,
  );
  assert.match(
    establish,
    /A suite whose `services` names the real services counts as real infrastructure/,
  );
  assert.match(
    establish,
    /a real deployment, real infrastructure no configured suite starts, or a real browser/,
  );
  assert.match(
    establish,
    /For a promise left for the Residue because only doubles covered it, only a suite whose `services` names each service its path reaches could prove it; with none, it stays for the Residue/,
  );
  assert.match(establish, /stop before step 6/);
  assert.match(establish, /which suite, and what the test would assert/);
  assert.match(establish, /\*\*Add the test\.\*\*/);
  assert.match(establish, /\*\*Keep it as a scenario\.\*\*/);
  assert.match(establish, /The head moves/);
  assert.match(establish, /run step 4 again on the new head/);
  assert.match(establish, /compute step 3's merge-base again/);
  assert.match(establish, /Never write the test for them/);
  assert.match(
    establish,
    /A promise the person already chose to keep as a scenario is not asked about again on the new head; their choice stands, unless the new run covers it, in which case it is a claim/,
  );
  const done = establish.split("**Done when:**")[1];
  assert.ok(done, "step 4 has no **Done when:**");
  assert.match(
    done,
    /every promise left for the Residue has been checked once for a test that could prove it/,
  );
  assert.match(done, /the person's choice/);
  const compose = parts.find((part) => part.startsWith("6. Compose the Residue"));
  assert.ok(compose, "SKILL.md has no step 6, Compose the Residue");
  assert.match(
    compose,
    /Each promise step 4 left for the Residue, including each one the person chose to keep as a scenario, becomes a scenario/,
  );
  assert.match(compose, /The plan carries no test recommendations/);
  assert.match(
    compose,
    /\*\*Done when:\*\* every promise step 4 left for the Residue is a scenario/,
  );
});

test("Why only a human can prove it says why no configured suite could reach the promise (#206)", () => {
  assert.match(
    section("Scenarios"),
    /- \*\*Why only a human can prove it:\*\* why no configured suite could reach the promise, not only that none covers it/,
  );
});

test("DESIGN.md says why a test is asked for before a scenario (#206)", () => {
  const design = readFileSync(join(HERE, "DESIGN.md"), "utf8");
  assert.match(design, /a manual scenario costs a run every time; a test costs once/);
});

test("Expected result compares product outputs, never a default read from source (#200)", () => {
  const scenarios = section("Scenarios");
  const bullet = scenarios.split("\n").find((line) => line.startsWith("- **Expected result:**"));
  assert.ok(bullet, "Scenarios has no **Expected result:** bullet");
  assert.match(bullet, /what the tester sees when it works, in the product's own words/);
  assert.match(
    bullet,
    /a comparison between product outputs, or a value the product itself shows during the run/,
  );
  assert.match(
    bullet,
    /never a number or default read from source or a config file, since the stack the plan runs on may set it differently/,
  );
  assert.match(
    bullet,
    /For example: the session lifetime on \*\*Settings\*\* equals the one on \*\*Profile\*\*, not: the session lifetime is `144000` minutes/,
  );
  const compose = skill.split(/^### /m).find((part) => part.startsWith("6. Compose the Residue"));
  assert.ok(compose, "SKILL.md has no step 6, Compose the Residue");
  assert.match(compose, /\[ANATOMY\.md\]\(ANATOMY\.md#scenarios\)/);
  assert.match(
    compose,
    /Write each expected result as \[ANATOMY\.md\]\(ANATOMY\.md#scenarios\) says/,
  );
  assert.doesNotMatch(
    compose,
    /read from source|config file/,
    "step 6 repeats the rule instead of pointing to it",
  );
});

test("a promise only reading can check is a `Review:` box, never a scenario (#205)", () => {
  const signOff = section("Sign-off checklist").replace(/\s+/g, " ");
  assert.match(signOff, /`- \[ \] Review: <what to read, and what it must say>`/);
  assert.match(signOff, /`- \[ \] Review: docs\/x\.html says the token lasts 30 days`/);
  assert.match(signOff, /A `Review:` box is no scenario's box: each scenario still needs its own/);
  assert.match(signOff, /`manual-qa` runs nothing for one/);
  assert.match(signOff, /never a Results row or a PASS/);
  assert.match(signOff, /\*\*Follow-ups\*\* lists each open one for a person/);
  assert.match(signOff, /No check reads the text it names/);
  const scenarios = section("Scenarios").replace(/\s+/g, " ");
  assert.match(
    scenarios,
    /A plan with no scenarios and no `Review:` box \(\[Sign-off checklist\]\(#sign-off-checklist\)\) is not written/,
  );
  assert.match(scenarios, /A plan whose Residue is only review boxes is still a plan/);
  assert.match(scenarios, /its Scenarios section says `None\.`/);

  const step = (n) => skill.split(/^### /m).find((part) => part.startsWith(`${n}. `)) ?? "";
  const compose = step(6).replace(/\s+/g, " ");
  assert.match(
    compose,
    /A promise only reading can check \(the copy of a doc, a static file the app does not serve, a code comment\)/,
  );
  assert.match(compose, /becomes a `- \[ \] Review: <what to read, and what it must say>` box/);
  assert.match(compose, /\[ANATOMY\.md\]\(ANATOMY\.md#sign-off-checklist\)/);
  assert.match(compose, /never dropped/);
  const draft = step(7).replace(/\s+/g, " ");
  assert.match(draft, /name each `Review:` box to the person/);
});

test("a scenario may say what its run captures, after Observes and before Steps (format=3)", () => {
  const scenarios = section("Scenarios");
  const labels = [...scenarios.matchAll(/^- \*\*([^*]+):\*\*/gm)].map((m) => m[1]);
  const at = (label) => labels.indexOf(label);
  assert.ok(at("Capture") > at("Observes") && at("Capture") < at("Steps"), labels.join(" · "));
  const capture = scenarios.split("\n").find((line) => line.startsWith("- **Capture:**"));
  assert.match(capture, /`screenshot`, `video`, `transcript` or `none`/);
  assert.match(capture, /`transcript` is for a scenario whose surface .* is `api`/);
  assert.match(capture, /`screenshot` and `video` are for one with a screen, never `api`/);
  assert.match(
    capture,
    /Missing, it means `screenshot` on a screen surface and `transcript` on `api`/,
  );
  assert.match(capture, /wherever \*\*Observes:\*\* would sit/);
  assert.match(capture, /once at most/);
  assert.match(capture, /`format=3` or later/);
  assert.match(section("Shape"), /\*\*Capture:\*\* and \*\*Signs in as:\*\*/);
});

test("a fix scenario carries Expected before, right after Expected result (format=3)", () => {
  const scenarios = section("Scenarios");
  const labels = [...scenarios.matchAll(/^- \*\*([^*]+):\*\*/gm)].map((m) => m[1]);
  assert.equal(
    labels[labels.indexOf("Expected result") + 1],
    "Expected before",
    labels.join(" · "),
  );
  const before = scenarios.split("\n").find((line) => line.startsWith("- **Expected before:**"));
  assert.match(before, /what the tester sees at the merge-base, where the change is not yet made/);
  assert.match(before, /under the same rules as \*\*Expected result:\*\*/);
  assert.match(before, /Right after \*\*Expected result:\*\*, once at most/);
  assert.match(before, /`format=3` or later/);
  assert.match(scenarios, /^### Fix scenarios$/m);
  assert.match(scenarios, /It is the scenario that carries \*\*Expected before:\*\*/);
  assert.match(scenarios, /A scenario without one runs at the head only/);
  assert.match(
    scenarios,
    /from the issue's reproduction, or from what the merge-base does, never invented/,
  );
  // The example shows both fields, in their places.
  const example = /### Fix scenarios[\s\S]*?```markdown\n([\s\S]*?)```/.exec(scenarios)[1];
  const shown = [...example.matchAll(/^- \*\*([^*]+):\*\*/gm)].map((m) => m[1]);
  assert.deepEqual(shown, [
    "Why only a human can prove it",
    "Signs in as",
    "Capture",
    "Steps",
    "Expected result",
    "Expected before",
    "A failure means",
  ]);
});

test("SKILL.md step 6 writes **Expected before:** for a fix and **Capture:** by what the result needs", () => {
  const flat = skill.replace(/\s+/g, " ");
  assert.match(
    flat,
    /Give a scenario \*\*Expected before:\*\* when it proves a defect is fixed: the subject issue or a child issue is a bug, or the promise reads as a fix/,
  );
  assert.match(
    flat,
    /drawn from the issue's reproduction or the merge-base's behaviour, never invented/,
  );
  assert.match(
    flat,
    /`video` for a multi-session or timing-dependent scenario with a screen, `transcript` on `api`, `none` where an image would show nothing the written result does not, and otherwise `screenshot`, or leave it out/,
  );
  assert.match(flat, /\[ANATOMY\.md\]\(ANATOMY\.md#fix-scenarios\)/);
});
