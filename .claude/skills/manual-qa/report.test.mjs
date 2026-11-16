/**
 * Contract suite for posting a QA Report (`report.mjs`): one PR comment,
 * found by its `<!-- qa-report -->` marker and updated on a re-run, never
 * duplicated; the tracker issue's boxes and Execution record; and the upload
 * rules, above all that a failed run's media is never uploaded.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HEADLINES,
  REPORT_MARKER,
  RESULTS,
  evidenceUpload,
  findComments,
  main,
  parseComments,
  reportPlanProblems,
  readReport,
  reportComment,
  staleComment,
  trackerBody,
} from "./report.mjs";
import { validatePlan } from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN = readFileSync(join(HERE, "fixtures", "plans", "good.md"), "utf8");
const HEAD = "2".repeat(40);

/**
 * The headline a report's rows imply, and its item lines, worked out here on
 * their own so a fixture never takes report.mjs's word for it: a regression or
 * a stopped run fails; any other result but PASS is an item; else it passed.
 */
const headlineOf = (rows) => {
  const results = rows.map((row) => row.split("|")[2]?.trim());
  if (results.includes("FAIL: regression") || /the run stopped at S\d+/i.test(rows.join("\n")))
    return ["**QA failed**"];
  const items = rows.filter((row, i) => results[i] !== "PASS" && /\|\s*S\d+/.test(row));
  // A report with Results `None.` has no rows, and nothing was shown to pass.
  if (!rows.length) return ["**QA passed, with items listed:**"];
  if (!items.length) return ["**QA passed**"];
  return [
    "**QA passed, with items listed:**",
    "",
    ...items.map((row) => `- ${/S\d+/.exec(row)[0]}: ${row.split("|")[2].trim()}`),
  ];
};

/** A QA Report for fixtures/plans/good.md (subject #42, pull request #57). */
const reportFor = (
  rows,
  record = "- S1: PASS\n- S2: PASS\n- Build: verified by `gh`",
  {
    headline = headlineOf(rows),
    run = "`stack`",
    header = [
      "| Scenario | Result | Evidence | Notes |",
      "| -------- | ------ | -------- | ----- |",
    ],
  } = {},
) =>
  [
    "# QA Report: Members can be invited by email",
    "",
    ...headline,
    "",
    `- **Plan:** \`tmp/qa/qa-plan-pr-57.md\`, subject #42, pull request #57, head \`${HEAD}\``,
    "- **Build check:** verified by `gh`",
    `- **Run:** ${run}, \`web\`, driven by the built-in browser, on 2026-11-10 10:00`,
    "- **Accounts:** admin",
    "- **Teardown:** `down` run; nothing else started",
    "",
    "## Results",
    "",
    ...header,
    ...rows,
    "",
    "## Follow-ups",
    "",
    "None.",
    "",
    "## Execution record",
    "",
    record,
    "",
  ].join("\n");

const PASSED = reportFor([
  "| S1: An admin invites a new member | PASS | `qa-report-pr-57/s1.png` | invite sent |",
  "| S2: A signed-out visitor cannot open the members page | PASS | `qa-report-pr-57/s2.log` | redirected |",
]);
const FAILED = reportFor([
  "| S1: An admin invites a new member | FAIL: regression | `qa-report-pr-57/s1.png` | no invite appeared |",
  "| S2: A signed-out visitor cannot open the members page | PASS | `qa-report-pr-57/s2.log` | redirected |",
]);
const STOPPED = reportFor([
  "| S1: An admin invites a new member | PASS | `qa-report-pr-57/s1.png` | invite sent |",
  "| S2: A signed-out visitor cannot open the members page | left for a person | none | _the run stopped at S1: data loss_ |",
]);
const everyFile = () => "GET /members 302\n";
const upload = (report, picks, more = {}) =>
  evidenceUpload({
    upload: "gh-release:qa-artifacts",
    report: readReport(report).report,
    picks,
    exists: () => true,
    read: everyFile,
    visibility: "PRIVATE",
    release: "missing",
    ...more,
  });

// S1 has a Storyboard, an MP4, the step still it was built from and a Before still;
// S2 has none (no Chromium): its plain stills, a Before still, a recording and a log.
const BOARD_ROWS = [
  "| S1: An admin invites a new member | PASS | `qa-report-pr-57/s1-storyboard.png` `qa-report-pr-57/s1.mp4` `qa-report-pr-57/s1-web/step-02-a.png` `qa-report-pr-57/s1-key-after.png` `qa-report-pr-57/s1-before-web/step-02-a.png` | invite sent |",
  "| S2: A signed-out visitor cannot open the members page | PASS | `qa-report-pr-57/s2-web/step-03-a.png` `qa-report-pr-57/s2-fail.png` `qa-report-pr-57/s2-before.png` `qa-report-pr-57/s2.webm` `qa-report-pr-57/s2.gif` `qa-report-pr-57/s2-http.log` | redirected; no Storyboard: no Playwright with Chromium in this repository |",
];
const BOARDS = reportFor(BOARD_ROWS);
const p57 = (name) => `qa-report-pr-57/${name}`;
const refusedWhy = (result) => Object.fromEntries(result.refused.map((r) => [r.file, r.why]));

// --- Reading a report ---

test("a report reads into its anchors and one result per scenario", () => {
  const { report, problems } = readReport(PASSED);
  assert.deepEqual(problems, []);
  assert.equal(report.subject, 42);
  assert.equal(report.pr, 57);
  assert.equal(report.head, HEAD);
  assert.deepEqual(
    report.results.map((row) => [row.id, row.result, row.evidence]),
    [
      ["S1", "PASS", ["qa-report-pr-57/s1.png"]],
      ["S2", "PASS", ["qa-report-pr-57/s2.log"]],
    ],
  );
  assert.equal(report.failed, false);
});

test("a FAIL, or a run stopped on a blocking outcome, is a failed run", () => {
  assert.equal(readReport(FAILED).report.failed, true);
  assert.equal(readReport(STOPPED).report.failed, true);
  assert.equal(readReport(STOPPED).report.stopped, true);
});

test("the head is the full SHA: a short one is a problem, SHA-256 reads", () => {
  assert.match(
    readReport(PASSED.replace(`head \`${HEAD}\``, "head `2222222`")).problems[0],
    /names no full head/,
  );
  const long = "a".repeat(64);
  assert.equal(readReport(PASSED.replace(HEAD, long)).report.head, long);
});

const DEVIATION = "ran `env | grep` from Setup before noticing; its output was not used";
/** A report with a **Run deviations:** line after **Teardown:**, as the template places it. */
const withDeviations = (text, deviations) => {
  const teardown = "- **Teardown:** `down` run; nothing else started\n";
  return text.replace(teardown, `${teardown}- **Run deviations:**${deviations}\n`);
};
const DEVIATED = withDeviations(PASSED, ` ${DEVIATION}`);

test("a **Run deviations:** line reads with no problem, its text kept", () => {
  assert.notEqual(DEVIATED, PASSED);
  const { report, problems } = readReport(DEVIATED);
  assert.deepEqual(problems, []);
  assert.equal(report.deviations, DEVIATION);
  // The line changes nothing else the reader returns.
  assert.deepEqual({ ...report, deviations: null }, readReport(PASSED).report);
  const cli = main(["read", "report.md", "--plan", "plan.md"], {
    readFile: (path) => (path === "plan.md" ? PLAN : DEVIATED),
  });
  assert.equal(cli.code, 0);
  assert.equal(JSON.parse(cli.out).report.deviations, DEVIATION);
});

test("a report without the **Run deviations:** line reads as before, deviations null", () => {
  const { report, problems } = readReport(PASSED);
  assert.deepEqual(problems, []);
  assert.equal(report.deviations, null);
  const cli = main(["read", "report.md", "--plan", "plan.md"], {
    readFile: (path) => (path === "plan.md" ? PLAN : PASSED),
  });
  assert.equal(cli.code, 0);
  assert.equal(JSON.parse(cli.out).report.deviations, null);
});

test("an empty **Run deviations:** line is a problem: list each one, or leave it out", () => {
  const empty = withDeviations(PASSED, "   ");
  assert.match(readReport(empty).problems.join("\n"), /Run deviations:\*\* line is empty/);
});

test("the template's **Run deviations:** placeholder, copied as it stands, is a problem", () => {
  for (const placeholder of [
    " <each departure, and what was done about it> ← only when there was one (step 8)",
    " <each departure, and what was done about it>",
    " ran a command ← only when there was one (step 8)",
  ]) {
    const { problems } = readReport(withDeviations(PASSED, placeholder));
    assert.match(problems.join("\n"), /still carries the template's placeholder/, placeholder);
  }
});

test("more than one **Run deviations:** header line is a problem: one line holds them all", () => {
  const twice = withDeviations(
    withDeviations(PASSED, " skipped S2's second step"),
    ` ${DEVIATION}`,
  );
  assert.equal(twice.split("- **Run deviations:**").length, 3);
  assert.match(readReport(twice).problems.join("\n"), /header has 2 \*\*Run deviations:\*\* lines/);
  assert.deepEqual(readReport(DEVIATED).problems, []);
});

test("a `## ` line inside a fenced block in the header does not end the header", () => {
  const fenced = withDeviations(PASSED, ` ${DEVIATION}`).replace(
    "- **Teardown:**",
    "```text\n## not a heading\n```\n- **Teardown:**",
  );
  assert.ok(fenced.includes("## not a heading"));
  const { report, problems } = readReport(fenced);
  assert.deepEqual(problems, []);
  assert.equal(report.deviations, DEVIATION);
});

test("a **Run deviations:** line inside a fenced block in the header is not the header's", () => {
  const quoted = PASSED.replace(
    "- **Teardown:**",
    `\`\`\`text\n- **Run deviations:** ${DEVIATION}\n\`\`\`\n- **Teardown:**`,
  );
  assert.ok(quoted.includes(`- **Run deviations:** ${DEVIATION}`));
  const { report, problems } = readReport(quoted);
  assert.deepEqual(problems, []);
  assert.equal(report.deviations, null);
  // Beside a real line, the fenced one is not a second.
  const both = withDeviations(quoted, ` ${DEVIATION}`);
  assert.deepEqual(readReport(both).problems, []);
  assert.equal(readReport(both).report.deviations, DEVIATION);
});

test("a repeated first heading does not move the header's end past the first section", () => {
  const repeated = PASSED.replace(
    "## Results\n",
    `## Results\n\n- **Run deviations:** ${DEVIATION}\n\n## Results\n`,
  );
  assert.equal(repeated.split("## Results").length, 3);
  assert.equal(readReport(repeated).report.deviations, null);
});

test("a **Run deviations:** line under a later section is not the header's", () => {
  const prose = PASSED.replace("None.", `None.\n\n- **Run deviations:** ${DEVIATION}`);
  assert.notEqual(prose, PASSED);
  const { report, problems } = readReport(prose);
  assert.deepEqual(problems, []);
  assert.equal(report.deviations, null);
});

test("a result other than the three is a problem", () => {
  const { problems } = readReport(reportFor(["| S1: x | passed-ish | none | |"]));
  assert.match(problems[0], /S1's result is `passed-ish`/);
});

// --- Five results, three headlines, and Before (#234) ---

/** fixtures/plans/good-format-3.md: S1 is a fix scenario (it has **Expected before:**); S2 and S3 are not. */
const PLAN3 = readFileSync(join(HERE, "fixtures", "plans", "good-format-3.md"), "utf8");
const BEFORE_HEADER = [
  "| Scenario | Result | Before | Evidence | Notes |",
  "| -------- | ------ | ------ | -------- | ----- |",
];
const S1_BEFORE = "matched: the dialog closed, and the list did not show `new@example.test`";
const row3 = (id, result, before, note = "ok") =>
  `| ${id}: scenario ${id} | ${result} | ${before} | \`qa-report-pr-57/${id.toLowerCase()}.png\` | ${note} |`;
/** A report for PLAN3, its headline worked out from its rows unless one is given. */
const graded = (rows, options = {}) =>
  reportFor(rows, "- S1: PASS\n- S2: PASS\n- S3: PASS", { header: BEFORE_HEADER, ...options });
const ALL_PASS = [row3("S1", "PASS", S1_BEFORE), row3("S2", "PASS", ""), row3("S3", "PASS", "")];
const gradeAgainst = (report, plan = PLAN3) =>
  main(["read", "report.md", "--plan", "plan.md"], {
    readFile: (path) => ({ "report.md": report, "plan.md": plan })[path] ?? null,
  });
const problemsOf = (report, plan = PLAN3) => JSON.parse(gradeAgainst(report, plan).out).problems;

test("PASS: After matched; the run passes, and the tracker ticks the box", () => {
  const report = graded(ALL_PASS);
  assert.equal(gradeAgainst(report).code, 0, gradeAgainst(report).out);
  const read = readReport(report).report;
  assert.equal(read.headline, "QA passed");
  assert.equal(read.failed, false);
  assert.equal(read.results[0].before, S1_BEFORE);
  assert.equal(read.results[1].before, "");
  assert.match(trackerBody(PLAN3, report).body, /^- \[x\] S1:/m);
});

test("FAIL: regression: the run fails, uploads key on it, and the box is cleared", () => {
  for (const before of [S1_BEFORE, "not observed: the Before stack did not start: `up` failed"]) {
    const report = graded([
      row3("S1", "FAIL: regression", before, "no badge"),
      ...ALL_PASS.slice(1),
    ]);
    assert.equal(gradeAgainst(report).code, 0, gradeAgainst(report).out);
    const read = readReport(report).report;
    assert.equal(read.headline, "QA failed");
    assert.equal(read.failed, true);
    assert.match(trackerBody(PLAN3, report).body, /^- \[ \] S1:/m);
    assert.equal(upload(report, ["qa-report-pr-57/s1.png"]).accepted.length, 0);
  }
  // A scenario with no Expected before fails as a regression too, with no evidence needed.
  const s2 = graded([ALL_PASS[0], row3("S2", "FAIL: regression", "", "no redirect"), ALL_PASS[2]]);
  assert.equal(gradeAgainst(s2).code, 0, gradeAgainst(s2).out);
});

test("FAIL: pre-existing: only with merge-base evidence, and it still fails the run for uploads", () => {
  const note =
    "merge-base evidence: the two-point run shows `members_redirect` failing at the merge-base";
  const report = graded([ALL_PASS[0], row3("S2", "FAIL: pre-existing", "", note), ALL_PASS[2]]);
  assert.equal(gradeAgainst(report).code, 0, gradeAgainst(report).out);
  const read = readReport(report).report;
  assert.equal(read.headline, "QA passed, with items listed");
  assert.deepEqual(read.items, ["S2"]);
  assert.equal(read.failed, true);
  assert.match(trackerBody(PLAN3, report).body, /^- \[ \] S2:/m);
  assert.equal(upload(report, ["qa-report-pr-57/s2.png"]).accepted.length, 0);
  // Without the evidence, it is a regression.
  const bare = graded([
    ALL_PASS[0],
    row3("S2", "FAIL: pre-existing", "", "fails at both"),
    ALL_PASS[2],
  ]);
  assert.match(
    problemsOf(bare).join("\n"),
    /S2 is a FAIL: pre-existing with no merge-base evidence: .* or it is a FAIL: regression/,
  );
  // A fix scenario that fails is a regression, whatever the merge-base showed.
  const fix = graded([row3("S1", "FAIL: pre-existing", "", note), ...ALL_PASS.slice(1)]);
  assert.match(
    problemsOf(fix).join("\n"),
    /S1 is a fix scenario, so a failure at the head is a FAIL: regression/,
  );
  const withBefore = graded([
    row3("S1", "FAIL: pre-existing", S1_BEFORE, note),
    ...ALL_PASS.slice(1),
  ]);
  assert.match(problemsOf(withBefore).join("\n"), /S1 is a FAIL: pre-existing with a Before cell/);
});

test("Not proven: a fix scenario whose Before already showed the expected result", () => {
  const before = "showed the expected result: the list showed `new@example.test` with **Invited**";
  const report = graded([row3("S1", "Not proven", before), ...ALL_PASS.slice(1)]);
  assert.equal(gradeAgainst(report).code, 0, gradeAgainst(report).out);
  const read = readReport(report).report;
  assert.equal(read.headline, "QA passed, with items listed");
  assert.deepEqual(read.items, ["S1"]);
  assert.equal(read.failed, false);
  assert.match(trackerBody(PLAN3, report).body, /^- \[ \] S1:/m);
  // A PASS whose Before already showed the expected result is Not proven.
  const passed = graded([row3("S1", "PASS", before), ...ALL_PASS.slice(1)]);
  assert.match(
    problemsOf(passed).join("\n"),
    /S1's Before already showed the expected result.*Not proven/,
  );
  // Not proven needs that Before.
  const matched = graded([row3("S1", "Not proven", S1_BEFORE), ...ALL_PASS.slice(1)]);
  assert.match(
    problemsOf(matched).join("\n"),
    /S1 is Not proven, which is only for a fix scenario/,
  );
});

test("Not proven, or a Before cell, on a scenario the plan gives no Expected before is refused", () => {
  const before = "showed the expected result: the sign-in page";
  const notProven = graded([ALL_PASS[0], row3("S2", "Not proven", before), ALL_PASS[2]]);
  assert.equal(readReport(notProven).problems.length, 0, "the report alone cannot tell");
  assert.deepEqual(problemsOf(notProven), [
    "S2 is Not proven, but the plan gives it no **Expected before:**: Not proven is only for a " +
      "fix scenario whose Before showed the expected result",
  ]);
  const cell = graded([ALL_PASS[0], row3("S2", "PASS", "matched: the members page"), ALL_PASS[2]]);
  assert.match(
    problemsOf(cell)[0],
    /^S2 has a Before cell, but the plan gives it no \*\*Expected before:\*\*/,
  );
  // A fix scenario's row shows its Before.
  const empty = graded([row3("S1", "PASS", ""), ...ALL_PASS.slice(1)]);
  assert.match(problemsOf(empty)[0], /^S1 is a fix scenario .* but its Before cell is empty/);
});

test("left for a person: an item under the headline, never ticked; a fix scenario's Before may be not run", () => {
  const report = graded([
    row3("S1", "left for a person", "not run: no tool here can drive a `web` surface").replace(
      "`qa-report-pr-57/s1.png`",
      "none",
    ),
    ...ALL_PASS.slice(1),
  ]);
  assert.equal(gradeAgainst(report).code, 0, gradeAgainst(report).out);
  const read = readReport(report).report;
  assert.equal(read.headline, "QA passed, with items listed");
  assert.equal(read.failed, false);
  assert.match(trackerBody(PLAN3, report).body, /^- \[ \] S1:/m);
});

test("a Before cell says what the merge-base showed, or why it shows nothing", () => {
  for (const before of [
    S1_BEFORE,
    "did not match: an error page",
    "not observed: step 2's **Send invite** is not on the merge-base's screen",
    "not run: the run stopped before Before",
  ])
    assert.deepEqual(
      readReport(graded([row3("S1", "PASS", before), ...ALL_PASS.slice(1)])).problems,
      [],
      before,
    );
  assert.match(
    readReport(graded([row3("S1", "PASS", "it worked"), ...ALL_PASS.slice(1)])).problems[0],
    /S1's Before is `it worked`: it starts with one of `matched: …`/,
  );
});

test("a `\\|` in a cell is a pipe in its text, never a column break", () => {
  const before = "matched: the badge read Status \\| Pending";
  const { report, problems } = readReport(
    graded([row3("S1", "PASS", before), ...ALL_PASS.slice(1)]),
  );
  assert.deepEqual(problems, []);
  assert.equal(report.results[0].before, "matched: the badge read Status | Pending");
  assert.deepEqual(report.results[0].evidence, ["qa-report-pr-57/s1.png"]);
  const note = readReport(graded([row3("S1", "PASS", S1_BEFORE, "a \\| b"), ...ALL_PASS.slice(1)]));
  assert.equal(note.report.results[0].notes, "a | b");
});

test("the three headlines: each is the one the rows imply, and a headline that disagrees is refused", () => {
  const regression = [row3("S1", "FAIL: regression", S1_BEFORE, "no badge"), ...ALL_PASS.slice(1)];
  const item = [
    row3("S1", "Not proven", "showed the expected result: the badge"),
    ...ALL_PASS.slice(1),
  ];
  const cases = [
    [ALL_PASS, "QA passed"],
    [item, "QA passed, with items listed"],
    [regression, "QA failed"],
  ];
  const lines = {
    "QA passed": ["**QA passed**"],
    "QA passed, with items listed": [
      "**QA passed, with items listed:**",
      "",
      "- S1: Not proven, the badge was there before",
    ],
    "QA failed": ["**QA failed**"],
  };
  for (const [rows, implied] of cases)
    for (const [name, headline] of Object.entries(lines)) {
      const { problems, report } = readReport(graded(rows, { headline }));
      if (name === implied) assert.deepEqual(problems, [], name);
      else {
        assert.equal(report.headline, name);
        assert.match(
          problems.join("\n"),
          new RegExp(`the headline is _${name}_, but the rows make it _${implied}_`),
        );
      }
    }
  // A run stopped on a blocking outcome fails, with no FAIL row.
  const stopped = readReport(
    graded(
      [
        ALL_PASS[0],
        ALL_PASS[1],
        "| S3: scenario S3 | left for a person |  | none | _the run stopped at S2: data loss_ |",
      ],
      { headline: ["**QA passed, with items listed:**", "", "- S3: left for a person"] },
    ),
  );
  assert.match(
    stopped.problems.join("\n"),
    /the headline is _QA passed, with items listed_, but the rows make it _QA failed_/,
  );
});

test("a report with no headline is refused, naming the three; so is an item missing under its headline", () => {
  const none = readReport(graded(ALL_PASS, { headline: [] }));
  assert.match(
    none.problems[0],
    /no headline: the first line after its title is one of `\*\*QA failed\*\*`, `\*\*QA passed, with items listed:\*\*`, `\*\*QA passed\*\*`/,
  );
  const unlisted = readReport(
    graded(
      [row3("S1", "Not proven", "showed the expected result: the badge"), ...ALL_PASS.slice(1)],
      {
        headline: ["**QA passed, with items listed:**"],
      },
    ),
  );
  assert.match(unlisted.problems[0], /S1 is Not proven but is not listed under the headline/);
});

test("a stray word after the title is no headline, and an anchor problem does not hide a wrong headline", () => {
  for (const word of ["constructor", "toString", "QA passed"])
    assert.match(
      readReport(graded(ALL_PASS, { headline: [word] })).problems[0],
      /no headline/,
      word,
    );
  const noHead = graded(ALL_PASS, { headline: ["**QA failed**"] }).replace(
    `head \`${HEAD}\``,
    "head `2`",
  );
  const { problems } = readReport(noHead);
  assert.match(problems.join("\n"), /names no full head/);
  assert.match(
    problems.join("\n"),
    /the headline is _QA failed_, but the rows make it _QA passed_/,
  );
});

test("an old report's bare `FAIL` is refused, naming the new words; PASS and left for a person still read", () => {
  const old = reportFor(["| S1: x | FAIL | `qa-report-pr-57/s1.png` | no invite |"], undefined, {
    headline: ["**QA failed**"],
  });
  assert.match(
    readReport(old).problems[0],
    /S1's result is `FAIL`, a word QA Reports no longer use: write `FAIL: regression`, or `FAIL: pre-existing` .*PASS, FAIL: regression, FAIL: pre-existing, Not proven or left for a person/,
  );
  // An old report that opens with no headline is refused for that alone.
  const unheaded = PASSED.replace(/\n\*\*QA passed\*\*\n/, "");
  assert.notEqual(unheaded, PASSED);
  assert.match(readReport(unheaded).problems.join("\n"), /no headline/);
});

test("a `url` run never runs Before, and its fix scenarios say why", () => {
  const hosted = "not run: the target is hosted";
  const url = graded([row3("S1", "PASS", hosted), ...ALL_PASS.slice(1)], {
    run: "`url` at `qa.example.com`",
  });
  assert.equal(gradeAgainst(url).code, 0, gradeAgainst(url).out);
  assert.equal(readReport(url).report.target, "url");
  const ran = graded([row3("S1", "PASS", S1_BEFORE), ...ALL_PASS.slice(1)], {
    run: "`url` at `qa.example.com`",
  });
  assert.match(
    readReport(ran).problems[0],
    /S1's Before says `matched` on a `url` run: .*`not run: the target is hosted`/,
  );
});

test("the docs that name the results name the five, and the headlines the three", () => {
  const read = (...path) => readFileSync(join(HERE, ...path), "utf8").replace(/\s+/g, " ");
  const docs = {
    "SKILL.md": read("SKILL.md"),
    "DESIGN.md": read("DESIGN.md"),
    "ANATOMY.md": read("ANATOMY.md"),
  };
  // Agent-kit's own guide, when this copy sits in Agent-kit: a copied skill has no docs/.
  const guide = join(HERE, "..", "..", "..", "docs", "qa.md");
  if (existsSync(guide)) docs["docs/qa.md"] = read("..", "..", "..", "docs", "qa.md");
  for (const [name, text] of Object.entries(docs)) {
    for (const result of RESULTS)
      assert.ok(text.toLowerCase().includes(result.toLowerCase()), `${name} names ${result}`);
    assert.doesNotMatch(
      text,
      /PASS, FAIL or _?left for a person/,
      `${name} still names three results`,
    );
  }
  for (const name of ["SKILL.md", "DESIGN.md", "docs/qa.md"].filter((name) => name in docs))
    for (const headline of Object.values(HEADLINES))
      assert.ok(docs[name].includes(headline), `${name} names the headline ${headline}`);
});

// --- Evidence: captured by default, `none` only with a reason ---

const S2_LEFT =
  "| S2: A signed-out visitor cannot open the members page | left for a person | none | no driver here can drive a `web` surface |";
const readCli = (report) => main(["read", "r.md"], { readFile: () => report });

test("`read` exits 1 for a PASS or FAIL row with a bare `none`, an empty `none:` or no path", () => {
  for (const result of ["PASS", "FAIL: regression"])
    for (const evidence of ["none", "none:", "none:   ", "", "see the notes", "None: x"]) {
      const report = reportFor([
        `| S1: An admin invites a new member | ${result} | ${evidence} | invite sent |`,
        S2_LEFT,
      ]);
      const { code, out } = readCli(report);
      const at = report.split("\n").findIndex((line) => line.startsWith("| S1:")) + 1;
      assert.equal(code, 1, `${result} with \`${evidence}\``);
      assert.deepEqual(JSON.parse(out).problems, [
        `line ${at}: S1 is ${result}, with no evidence path: link its QA Artifact in backticks, ` +
          "or write `none: <reason>`",
      ]);
    }
});

test("`read` exits 0 for `none: <reason>`, a backticked path, and a bare `none` left for a person", () => {
  for (const evidence of [
    "none: api surface, the redacted response body is in the notes",
    "none: driver cannot save images",
    "`qa-report-pr-57/s1.png`",
  ])
    for (const result of ["PASS", "FAIL: regression"]) {
      const report = reportFor([
        `| S1: An admin invites a new member | ${result} | ${evidence} | invite sent |`,
        S2_LEFT,
      ]);
      assert.equal(readCli(report).code, 0, `${result} with \`${evidence}\``);
    }
  // A reason does not become an evidence path: what upload reads is unchanged.
  const reason = readReport(
    reportFor([S1_ROW("PASS", "invite sent"), S2_ROW("left for a person", "not run")]),
  );
  assert.deepEqual(reason.problems, []);
  assert.deepEqual(
    reason.report.results.map((row) => row.evidence),
    [[], []],
  );
  // A reason that quotes an endpoint or a role, or a cell wrapped whole in
  // backticks, is still a reason: nothing in it becomes a pickable file.
  for (const evidence of [
    "none: the response for `GET /members` is in the notes, signed in as `admin`",
    "`none: driver cannot save images`",
  ]) {
    const read = readReport(
      reportFor([
        `| S1: An admin invites a new member | PASS | ${evidence} | invite sent |`,
        S2_LEFT,
      ]),
    );
    assert.deepEqual(read.problems, [], evidence);
    assert.deepEqual(read.report.results[0].evidence, [], evidence);
  }
});

test("a Storyboard is the row's main evidence: linked first, and for its own scenario (#235)", () => {
  const row = (evidence) =>
    reportFor([
      `| S1: An admin invites a new member | PASS | ${evidence} | invite sent |`,
      S2_LEFT,
    ]);
  const good = readReport(
    row("`qa-report-pr-57/s1-storyboard.png` `qa-report-pr-57/s1-web/step-02-a.png`"),
  );
  assert.deepEqual(good.problems, []);
  assert.deepEqual(good.report.results[0].evidence, [
    "qa-report-pr-57/s1-storyboard.png",
    "qa-report-pr-57/s1-web/step-02-a.png",
  ]);
  const second = readReport(
    row("`qa-report-pr-57/s1-web/step-02-a.png` `qa-report-pr-57/s1-storyboard.png`"),
  );
  assert.equal(second.problems.length, 1);
  assert.match(second.problems[0], /S1's Storyboard is its main evidence: link it first/);
  const other = readReport(row("`qa-report-pr-57/s2-storyboard.png`"));
  assert.equal(other.problems.length, 1);
  assert.match(
    other.problems[0],
    /S1 links `qa-report-pr-57\/s2-storyboard.png`, another scenario's Storyboard/,
  );
  // Without Chromium the row keeps its plain stills, and its note says why.
  const plain = readReport(
    reportFor([
      "| S1: An admin invites a new member | PASS | `qa-report-pr-57/s1-web/step-02-a.png` | invite sent; no Storyboard: no Playwright with Chromium in this repository |",
      S2_LEFT,
    ]),
  );
  assert.deepEqual(plain.problems, []);
});

test("an MP4 sits right after its own Storyboard, and a raw web.mjs recording is never evidence (#236)", () => {
  const row = (evidence) =>
    readReport(
      reportFor([
        `| S1: An admin invites a new member | PASS | ${evidence} | invite sent |`,
        S2_LEFT,
      ]),
    );
  const good = row(
    "`qa-report-pr-57/s1-storyboard.png` `qa-report-pr-57/s1.mp4` `qa-report-pr-57/s1-web/step-02-a.png`",
  );
  assert.deepEqual(good.problems, []);
  assert.deepEqual(good.report.results[0].evidence[1], "qa-report-pr-57/s1.mp4");
  const after = row(
    "`qa-report-pr-57/s1-storyboard.png` `qa-report-pr-57/s1-web/step-02-a.png` `qa-report-pr-57/s1.mp4`",
  );
  assert.equal(after.problems.length, 1);
  assert.match(
    after.problems[0],
    /S1's MP4 sits beside its Storyboard: link it right after the Storyboard/,
  );
  const other = row("`qa-report-pr-57/s1-storyboard.png` `qa-report-pr-57/s2.mp4`");
  assert.equal(other.problems.length, 1);
  assert.match(other.problems[0], /S1 links `qa-report-pr-57\/s2\.mp4`, another scenario's MP4/);
  for (const raw of [
    "qa-report-pr-57/s1-web/video-a.webm",
    "qa-report-pr-57/s1-before-web/video-b.webm",
  ]) {
    const read = row(`\`qa-report-pr-57/s1-storyboard.png\` \`${raw}\``);
    assert.equal(read.problems.length, 1, raw);
    assert.match(read.problems[0], /a raw recording of web\.mjs: it is never evidence/);
  }
  // Without a Storyboard (no Chromium) there is no MP4 either; the row keeps its stills.
  const plain = row("`qa-report-pr-57/s1-web/step-02-a.png`");
  assert.deepEqual(plain.problems, []);
});

test("a report that links local media per session, and a recording, reads against its plan", () => {
  // S2 becomes a two-session scenario: an admin signs a member out while the member watches.
  const plan = PLAN.replace(
    "- **Signs in as:** nobody\n- **Steps:**\n  1. Open `/members` while signed out.",
    "- **Sessions:** A = `member`, B = `admin`\n- **Steps:**\n  1. In session A, open **Members**.\n  2. In session B, click **Sign out everywhere** for the member.\n  3. In session A, reload **Members**.",
  );
  assert.deepEqual(validatePlan(plan).problems, []);
  const media = [
    "qa-report-pr-57/s2-a.png",
    "qa-report-pr-57/s2-b.png",
    "qa-report-pr-57/s2-a-before.png",
    "qa-report-pr-57/s2.gif",
  ];
  const report = reportFor([
    "| S1: An admin invites a new member | PASS | `qa-report-pr-57/s1.png` | invite sent |",
    `| S2: A signed-out visitor cannot open the members page | PASS | ${media
      .map((file) => `\`${file}\``)
      .join(" ")} | A (\`member\`) was sent to **Sign in**; B (\`admin\`) stayed on **Members** |`,
  ]);
  const files = { "report.md": report, "plan.md": plan };
  const { code, out } = main(["read", "report.md", "--plan", "plan.md"], {
    readFile: (path) => files[path] ?? null,
  });
  assert.equal(code, 0, out);
  assert.deepEqual(JSON.parse(out).report.results[1].evidence, media);
});

// --- The report against its plan: Scenario accounts ---

/** good.md with S1 creating `temp-user` and S2 signing in as it. */
const ACCOUNT_PLAN = PLAN.replace(
  "- **Signs in as:** `admin`\n",
  "- **Signs in as:** `admin`\n- **Creates:** `temp-user` (its values chosen when S1 creates it)\n",
).replace("- **Signs in as:** nobody\n", "- **Signs in as:** `temp-user` (created in S1)\n");
/** A row with no QA Artifact: a reason when it ran, a bare `none` when it was left. */
const noEvidence = (result) =>
  result === "left for a person" ? "none" : "none: api surface, the response is in the notes";
const S1_ROW = (result, note) =>
  `| S1: An admin invites a new member | ${result} | ${noEvidence(result)} | ${note} |`;
const S2_ROW = (result, note) =>
  `| S2: A signed-out visitor cannot open the members page | ${result} | ${noEvidence(result)} | ${note} |`;
const LEFT_NOTE = "signs in as `temp-user`, which S1 creates, and S1 did not pass";
const againstPlan = (rows, plan = ACCOUNT_PLAN) =>
  reportPlanProblems(readReport(reportFor(rows)).report, plan);

test("a scenario whose Scenario account's creator did not pass is left for a person, saying why", () => {
  assert.deepEqual(validatePlan(ACCOUNT_PLAN).problems, []);
  // The creator failed, or was itself left for a person: the dependent is left, with the reason.
  for (const creator of ["FAIL: regression", "left for a person"])
    assert.deepEqual(
      againstPlan([S1_ROW(creator, "no invite appeared"), S2_ROW("left for a person", LEFT_NOTE)]),
      [],
    );
  // A run stopped on a blocking outcome may give the dependent its stop note instead.
  assert.deepEqual(
    againstPlan([
      S1_ROW("FAIL: regression", "data loss"),
      S2_ROW("left for a person", "_the run stopped at S1: data loss_"),
    ]),
    [],
  );
  // The creator passed: the dependent ran.
  assert.deepEqual(againstPlan([S1_ROW("PASS", "invite sent"), S2_ROW("PASS", "signed in")]), []);
});

test("a dependent run or failed after its creator did not pass is a problem", () => {
  const want = `S2 ${LEFT_NOTE}: its result is _left for a person_, with the note _${LEFT_NOTE}_`;
  for (const rows of [
    [S1_ROW("FAIL: regression", "no invite appeared"), S2_ROW("PASS", "signed in")],
    [
      S1_ROW("FAIL: regression", "no invite appeared"),
      S2_ROW("FAIL: regression", "could not sign in"),
    ],
    // Left for a person, but without saying why.
    [
      S1_ROW("FAIL: regression", "no invite appeared"),
      S2_ROW("left for a person", "could not sign in"),
    ],
  ])
    assert.deepEqual(againstPlan(rows), [want]);
  // The plain plan has no Scenario account: nothing depends on S1.
  assert.deepEqual(
    againstPlan([S1_ROW("FAIL: regression", "no invite"), S2_ROW("PASS", "redirected")], PLAN),
    [],
  );
});

test("a stop note counts only on a dependent after the stop", () => {
  const want = `S2 ${LEFT_NOTE}: its result is _left for a person_, with the note _${LEFT_NOTE}_`;
  // The run stopped at S2 itself, or at a later S4: S2 was reached, so it owes the creator reason.
  for (const stop of ["S2", "S4"])
    assert.deepEqual(
      againstPlan([
        S1_ROW("FAIL: regression", "no invite appeared"),
        S2_ROW("left for a person", `_the run stopped at ${stop}: data loss_`),
      ]),
      [want],
    );
});

test("the rule carries down a chain of Scenario accounts", () => {
  const S3 = [
    "### S3: The invitee signs in",
    "",
    "- **Why only a human can prove it:** the invite link is not driven by a suite.",
    "- **Signs in as:** `invitee` (created in S2)",
    "- **Steps:**",
    "  1. Open **Members**.",
    "- **Expected result:** the page shows **Welcome**.",
    "- **A failure means:** the invite does not grant access.",
    "",
    "## Sign-off checklist",
  ].join("\n");
  const chain = ACCOUNT_PLAN.replace(
    "- **Signs in as:** `temp-user` (created in S1)\n",
    "- **Signs in as:** `temp-user` (created in S1)\n- **Creates:** `invitee`\n",
  )
    .replace("## Sign-off checklist", S3)
    .replace(
      "- [ ] S2: A signed-out visitor cannot open the members page",
      "- [ ] S2: A signed-out visitor cannot open the members page\n- [ ] S3: The invitee signs in",
    );
  assert.deepEqual(validatePlan(chain).problems, []);
  const S3_ROW = (result, note) =>
    `| S3: The invitee signs in | ${result} | ${noEvidence(result)} | ${note} |`;
  const S3_NOTE = "signs in as `invitee`, which S2 creates, and S2 did not pass";
  // S1 failed, so S2 is left for a person, so S3 is left too.
  assert.deepEqual(
    againstPlan(
      [
        S1_ROW("FAIL: regression", "no invite appeared"),
        S2_ROW("left for a person", LEFT_NOTE),
        S3_ROW("left for a person", S3_NOTE),
      ],
      chain,
    ),
    [],
  );
  assert.deepEqual(
    againstPlan(
      [
        S1_ROW("FAIL: regression", "no invite appeared"),
        S2_ROW("left for a person", LEFT_NOTE),
        S3_ROW("PASS", "signed in"),
      ],
      chain,
    ),
    [`S3 ${S3_NOTE}: its result is _left for a person_, with the note _${S3_NOTE}_`],
  );
});

test("a multi-session scenario with a session whose account's creator did not pass is left for a person", () => {
  // S2's session A signs in as `temp-user`, which S1 creates; session B is `admin`.
  const sessions = ACCOUNT_PLAN.replace(
    "- **Signs in as:** `temp-user` (created in S1)\n- **Steps:**\n  1. Open `/members` while signed out.",
    "- **Sessions:** A = `temp-user`, B = admin (`temp-user` created in S1)\n- **Steps:**\n  1. In session A, open `/members`.\n  2. In session B, reset the password of `temp-user`.",
  );
  assert.deepEqual(validatePlan(sessions).problems, []);
  const note = "session A signs in as `temp-user`, which S1 creates, and S1 did not pass";
  assert.deepEqual(
    againstPlan(
      [S1_ROW("FAIL: regression", "no invite appeared"), S2_ROW("left for a person", note)],
      sessions,
    ),
    [],
  );
  assert.deepEqual(
    againstPlan(
      [S1_ROW("FAIL: regression", "no invite appeared"), S2_ROW("PASS", "A was signed out")],
      sessions,
    ),
    [`S2 ${note}: its result is _left for a person_, with the note _${note}_`],
  );
  assert.deepEqual(
    againstPlan([S1_ROW("PASS", "invite sent"), S2_ROW("PASS", "A was signed out")], sessions),
    [],
  );
});

test("a note naming any blocked session is the reason", () => {
  // S1 creates `temp-user`, S2 creates `other-user`, and S3's sessions sign in as both.
  const S3 = [
    "### S3: Each new user sees the other's change",
    "",
    "- **Why only a human can prove it:** no suite holds two signed-in browsers at once.",
    "- **Sessions:** A = `temp-user`, B = `other-user`",
    "- **Steps:**",
    "  1. In session A, open **Members**.",
    "  2. In session B, open **Members**.",
    "- **Expected result:** both sessions show **Members**.",
    "- **A failure means:** a new user cannot open the members page.",
    "",
    "## Sign-off checklist",
  ].join("\n");
  const plan = ACCOUNT_PLAN.replace(
    "- **Signs in as:** `temp-user` (created in S1)\n",
    "- **Signs in as:** `temp-user` (created in S1)\n- **Creates:** `other-user`\n",
  )
    .replace("## Sign-off checklist", S3)
    .replace(
      "- [ ] S2: A signed-out visitor cannot open the members page",
      "- [ ] S2: A signed-out visitor cannot open the members page\n- [ ] S3: Each new user sees the other's change",
    );
  assert.deepEqual(validatePlan(plan).problems, []);
  const S3_ROW = (result, note) =>
    `| S3: Each new user sees the other's change | ${result} | ${noEvidence(result)} | ${note} |`;
  const rows = (note) => [
    S1_ROW("FAIL: regression", "no invite appeared"),
    S2_ROW("left for a person", LEFT_NOTE),
    S3_ROW("left for a person", note),
  ];
  // Either blocked session's reason is enough.
  for (const note of [
    "session A signs in as `temp-user`, which S1 creates, and S1 did not pass",
    "session B signs in as `other-user`, which S2 creates, and S2 did not pass",
  ])
    assert.deepEqual(againstPlan(rows(note), plan), [], note);
  // With neither, the first blocked session's reason is asked for.
  const want = "session A signs in as `temp-user`, which S1 creates, and S1 did not pass";
  assert.deepEqual(againstPlan(rows("could not sign in"), plan), [
    `S3 ${want}: its result is _left for a person_, with the note _${want}_`,
  ]);
});

test("a report checked against a plan it did not run is a problem", () => {
  assert.match(
    againstPlan([S1_ROW("PASS", "ok")])[0],
    /the plan's scenarios are S1 S2; the report's results are S1/,
  );
  assert.match(
    againstPlan(
      [S1_ROW("PASS", "ok"), S2_ROW("PASS", "ok")],
      ACCOUNT_PLAN.replaceAll("2".repeat(40), "3".repeat(40)),
    )[0],
    /the plan is for subject #42, pull request #57, head 3{40}; the report is for .* head 2{40}/,
  );
  assert.match(againstPlan([S1_ROW("PASS", "ok")], "not a plan")[0], /does not read cleanly/);
});

test("`read --plan` checks the report against its plan, and exits 1 on a problem", () => {
  const files = {
    "plan.md": ACCOUNT_PLAN,
    "good.md": reportFor([
      S1_ROW("FAIL: regression", "no invite"),
      S2_ROW("left for a person", LEFT_NOTE),
    ]),
    "bad.md": reportFor([S1_ROW("FAIL: regression", "no invite"), S2_ROW("PASS", "signed in")]),
  };
  const io = { readFile: (path) => files[path] ?? null };
  assert.equal(main(["read", "good.md", "--plan", "plan.md"], io).code, 0);
  const bad = main(["read", "bad.md", "--plan", "plan.md"], io);
  assert.equal(bad.code, 1);
  assert.match(JSON.parse(bad.out).problems[0], /^S2 signs in as `temp-user`, which S1 creates/);
  // `--plan` with no file is a usage error, never a skipped check.
  assert.equal(main(["read", "bad.md", "--plan"], io).code, 2);
  assert.equal(main(["read", "bad.md", "--plan", "--repo", "."], io).code, 2);
  // Without --plan, `read` checks the report's own shape only.
  assert.equal(main(["read", "bad.md"], io).code, 0);
  assert.match(
    JSON.parse(main(["read", "good.md", "--plan", "nowhere.md"], io).out).problems[0],
    /nowhere\.md: no such file/,
  );
});

// --- The PR comment: one, updated, never duplicated ---

test("the comment starts with the marker and carries the report", () => {
  const { body, problems } = reportComment(PASSED);
  assert.deepEqual(problems, []);
  assert.equal(body.split("\n")[0], REPORT_MARKER);
  assert.ok(body.includes("# QA Report: Members can be invited by email"));
});

test("the comment keeps a **Run deviations:** line word for word, and adds none without it", () => {
  const line = `- **Run deviations:** ${DEVIATION}`;
  const kept = reportComment(DEVIATED);
  assert.deepEqual(kept.problems, []);
  assert.ok(kept.body.split("\n").includes(line));
  const cli = main(["comment", "report.md"], { readFile: () => DEVIATED });
  assert.equal(cli.code, 0);
  assert.ok(cli.out.split("\n").includes(line));
  const without = reportComment(PASSED);
  assert.deepEqual(without.problems, []);
  assert.ok(!without.body.includes("Run deviations"));
});

const ME = "qa-person";

test("with no report comment yet, one is created", () => {
  const comments = [
    { id: 1, body: "Looks good to me.", user: ME },
    { id: 2, body: "<!-- qa-plan format=1 subject=#42 pr=#57 -->\n# QA Plan: …", user: ME },
    { id: 3, body: `Quoting it: ${REPORT_MARKER} is not on the first line`, user: ME },
  ];
  assert.deepEqual(findComments(comments, ME).report, { action: "create" });
});

test("a re-run updates the report comment, never adds a second", () => {
  const first = reportComment(FAILED).body;
  const comments = [
    { id: 10, body: "Please run QA.", user: "developer" },
    { id: 11, body: first, user: { login: ME } },
  ];
  assert.deepEqual(findComments(comments, ME).report, {
    action: "update",
    id: 11,
    duplicates: [],
    head: HEAD,
  });
  // The re-run's body replaces it whole.
  const second = reportComment(PASSED).body;
  assert.notEqual(second, first);
  assert.equal(second.split("\n")[0], REPORT_MARKER);
});

test("with two report comments, the oldest is updated and the other named, not deleted", () => {
  const comments = [
    { id: 21, body: `${REPORT_MARKER}\r\n\r\nold`, user: ME },
    { id: 22, body: `${REPORT_MARKER}\n\nolder duplicate`, user: ME },
  ];
  assert.deepEqual(findComments(comments, ME).report, {
    action: "update",
    id: 21,
    duplicates: [22],
    head: null,
  });
});

test("a report comment someone else wrote is never updated, only named", () => {
  const comments = [
    { id: 30, body: `${REPORT_MARKER}\n\nall PASS, trust me`, user: "outsider" },
    { id: 31, body: `${REPORT_MARKER}\n\nno author` },
  ];
  assert.deepEqual(findComments(comments, ME), {
    report: { action: "create" },
    others: [30, 31],
    planIssue: null,
  });
  assert.deepEqual(findComments(comments, "").report, { action: "create" });
});

test("the plan's link comment names the tracker issue, whoever posted it", () => {
  const comments = [{ id: 5, body: "<!-- qa-plan-link -->\nQA Plan: #99", user: "developer" }];
  assert.equal(findComments(comments, ME).planIssue, 99);
  assert.equal(findComments([], ME).planIssue, null);
});

// --- A report comment for an older head, after qa-plan revised the plan ---

const NEW_HEAD = "3".repeat(40);
const STALE = `**Stale:** the plan was revised for head ${NEW_HEAD}; this report is for ${HEAD}.`;

test("the report comment's head is the one its **Plan:** line carries", () => {
  const comments = [{ id: 40, body: reportComment(PASSED).body, user: ME }];
  assert.equal(findComments(comments, ME).report.head, HEAD);
});

test("with the plan's head, a report comment for an older head is stale; one for the same head is not", () => {
  const comments = [{ id: 41, body: reportComment(PASSED).body, user: ME }];
  assert.equal(findComments(comments, ME, { head: NEW_HEAD }).report.stale, true);
  assert.equal(findComments(comments, ME, { head: HEAD }).report.stale, false);
  // A comment whose **Plan:** line names no full head is unknown, not "same".
  const unread = [{ id: 42, body: `${REPORT_MARKER}\n\nno plan line`, user: ME }];
  assert.equal(findComments(unread, ME, { head: NEW_HEAD }).report.stale, null);
  // A head that is not a full lowercase SHA is refused alike: unknown in `findComments`,
  // no full head to `stale` and to `find --head`.
  const upper = "A".repeat(40);
  const lower = [
    { id: 43, body: reportComment(PASSED).body.replace(HEAD, "a".repeat(40)), user: ME },
  ];
  assert.equal(findComments(lower, ME, { head: upper }).report.stale, null);
  assert.equal(findComments(lower, ME, { head: "3333333" }).report.stale, null);
  assert.match(staleComment(lower[0].body, upper).problems[0], /full head/);
  assert.equal(main(["find", "--login", ME, "--head", upper], { stdin: () => "" }).code, 1);
  // Without the plan's head, nothing is compared.
  assert.equal(findComments(comments, ME).report.stale, undefined);
  // With no report comment, there is nothing to warn about.
  assert.deepEqual(findComments([], ME, { head: NEW_HEAD }).report, { action: "create" });
});

test("the Stale line goes at the start of the report, after the marker", () => {
  const { body, problems } = staleComment(reportComment(PASSED).body, NEW_HEAD);
  assert.deepEqual(problems, []);
  const lines = body.split("\n");
  assert.equal(lines[0], REPORT_MARKER);
  assert.equal(lines[1], "");
  assert.equal(lines[2], STALE);
  assert.equal(lines[3], "");
  assert.equal(lines[4], "# QA Report: Members can be invited by email");
  // Marking it twice keeps one line, for the newest head.
  const newer = "4".repeat(40);
  const again = staleComment(body, newer).body;
  assert.equal(again.match(/\*\*Stale:\*\*/g).length, 1);
  assert.ok(again.includes(`revised for head ${newer}; this report is for ${HEAD}.`));
});

test("a same-head report comment, or a body that is no report comment, is not marked", () => {
  const body = reportComment(PASSED).body;
  assert.match(staleComment(body, HEAD).problems[0], /same head/);
  assert.equal(staleComment(body, HEAD).body, null);
  assert.match(staleComment("Looks good.", NEW_HEAD).problems[0], /first line/);
  assert.match(staleComment(`${REPORT_MARKER}\n\nno plan line`, NEW_HEAD).problems[0], /head/);
  assert.match(staleComment(body, "abc").problems[0], /full head/);
});

test("a report comment carrying the Stale line is still found, read, and replaced whole", () => {
  const stale = staleComment(reportComment(FAILED).body, NEW_HEAD).body;
  const comments = [{ id: 50, body: stale, user: ME }];
  // Found as the comment to update; for a later revision it is stale again.
  const later = "4".repeat(40);
  assert.deepEqual(findComments(comments, ME, { head: later }).report, {
    action: "update",
    id: 50,
    duplicates: [],
    head: HEAD,
    stale: true,
  });
  // `read` takes the body as it takes the report it carries.
  const read = readReport(stale);
  assert.deepEqual(read.problems, []);
  assert.deepEqual(read, readReport(FAILED));
  // The next run's comment replaces it whole, Stale line and all.
  const next = reportComment(PASSED).body;
  assert.ok(!next.includes("**Stale:**"));
  assert.equal(next.split("\n")[0], REPORT_MARKER);
});

test("a comment already marked stale for the plan's head draws no second warning", () => {
  const marked = staleComment(reportComment(PASSED).body, NEW_HEAD).body;
  const comments = [{ id: 60, body: marked, user: ME }];
  assert.equal(findComments(comments, ME, { head: NEW_HEAD }).report.stale, false);
  // A further revision, for another head, is stale again.
  assert.equal(findComments(comments, ME, { head: "4".repeat(40) }).report.stale, true);
});

test("the CLI marks a report comment stale from its body on stdin, and finds with --head", () => {
  const body = reportComment(PASSED).body;
  const marked = main(["stale", "--head", NEW_HEAD], { stdin: () => body });
  assert.equal(marked.code, 0);
  assert.ok(marked.out.startsWith(`${REPORT_MARKER}\n\n${STALE}\n`));
  assert.equal(main(["stale", "--head", HEAD], { stdin: () => body }).code, 1);
  assert.equal(main(["stale"], { stdin: () => body }).code, 2);
  const lines = JSON.stringify({ id: 7, body: marked.out, user: ME });
  const found = JSON.parse(
    main(["find", "--login", ME, "--head", "4".repeat(40)], { stdin: () => lines }).out,
  );
  assert.equal(found.report.stale, true);
  assert.equal(found.report.head, HEAD);
  assert.equal(main(["find", "--login", ME, "--head"], { stdin: () => lines }).code, 2);
  // A short head is refused, so a same-head comment never draws a warning by mistake.
  assert.equal(main(["find", "--login", ME, "--head", "3333333"], { stdin: () => lines }).code, 1);
});

test("comments read from every shape gh prints", () => {
  const one = { id: 1, body: "a" };
  const two = { id: 2, body: "b" };
  assert.deepEqual(parseComments(JSON.stringify([one, two])), [one, two]);
  assert.deepEqual(parseComments(JSON.stringify([[one], [two]])), [one, two]);
  assert.deepEqual(parseComments(`${JSON.stringify(one)}\n${JSON.stringify(two)}\n`), [one, two]);
  assert.deepEqual(parseComments(""), []);
});

test("uploaded evidence is linked; the rest stays a local path", () => {
  const url = "https://github.com/o/r/releases/download/qa-artifacts/pr-57-s1.png";
  const { body } = reportComment(PASSED, { links: { "qa-report-pr-57/s1.png": url } });
  assert.ok(body.includes(`[\`qa-report-pr-57/s1.png\`](${url})`));
  assert.ok(body.includes("| `qa-report-pr-57/s2.log` |"));
});

test("an uploaded Storyboard shows as an image, and an uploaded MP4 as a link (#237)", () => {
  const base = "https://github.com/o/r/releases/download/qa-artifacts/";
  const board = `${base}pr-57-s1-storyboard.png`;
  const video = `${base}pr-57-s1.mp4`;
  const links = { [p57("s1-storyboard.png")]: board, [p57("s1.mp4")]: video };
  const { body, problems } = reportComment(BOARDS, { links });
  assert.deepEqual(problems, []);
  assert.ok(body.includes(`[![${p57("s1-storyboard.png")}](${board})](${board})`), body);
  assert.ok(body.includes(`[\`${p57("s1.mp4")}\`](${video})`));
  // A still that was not uploaded stays a local path.
  assert.ok(body.includes(`\`${p57("s1-web/step-02-a.png")}\` `));
  // A Storyboard written with backslashes shows as an image too.
  const slashedBoard = "qa-report-pr-57\\s1-storyboard.png";
  const slashed = reportComment(BOARDS.replace(p57("s1-storyboard.png"), slashedBoard), {
    links: { [slashedBoard]: board },
  });
  assert.deepEqual(slashed.problems, []);
  assert.ok(slashed.body.includes(`[![${slashedBoard}](${board})](${board})`), slashed.body);
});

test("a report that carries a sign-in value is not posted", () => {
  // Built at run time: no credential-looking literal is ever committed.
  const value = ["Zq", "8v", "Lw", "3n", "Rt", "7k"].join("");
  const leaky = PASSED.replace(
    "- **Accounts:** admin",
    `- **Accounts:** admin, password: ${value}`,
  );
  const { body, problems } = reportComment(leaky);
  assert.equal(body, null);
  assert.match(problems[0], /looks like a credential value; remove it before posting/);
  assert.ok(!problems.join("\n").includes(value));
});

// --- The tracker issue ---

test("on the tracker issue, PASS boxes are ticked and the Execution record replaced", () => {
  const { body, problems } = trackerBody(PLAN, FAILED);
  assert.deepEqual(problems, []);
  assert.match(body, /^- \[ \] S1: An admin invites a new member$/m);
  assert.match(body, /^- \[x\] S2: A signed-out visitor cannot open the members page$/m);
  // A Setup box is a person's to tick.
  assert.match(body, /^- \[ \] Setup 1:/m);
  assert.ok(!body.includes("_Not run yet._"));
  assert.match(body, /## Execution record\n\n- S1: PASS/);
  assert.equal(body.split("\n")[0], PLAN.split(/\r?\n/)[0]);
});

test("a re-run on the tracker issue clears a box its scenario no longer passes", () => {
  const passed = trackerBody(PLAN, PASSED).body;
  assert.match(passed, /^- \[x\] S1:/m);
  const rerun = trackerBody(passed, FAILED);
  assert.deepEqual(rerun.problems, []);
  assert.match(rerun.body, /^- \[ \] S1:/m);
  assert.equal(rerun.body.match(/## Execution record/g).length, 1);
});

test("a tracker issue for another pull request or a revised head is not touched", () => {
  const other = trackerBody(PLAN, PASSED.replace("pull request #57", "pull request #58"));
  assert.equal(other.body, null);
  assert.match(other.problems[0], /pull request #57; the report is for .*pull request #58/);
  const revised = trackerBody(PLAN.replaceAll(HEAD, "3".repeat(40)), PASSED);
  assert.equal(revised.body, null);
  assert.match(revised.problems[0], /the plan was revised since this run/);
});

test("a tracker issue whose report misses a plan scenario is not touched", () => {
  const partial = reportFor([S1_ROW("PASS", "invite sent")]);
  const { body, problems } = trackerBody(trackerBody(PLAN, PASSED).body, partial);
  assert.equal(body, null);
  assert.match(problems[0], /the plan's scenarios are S1 S2; the report's results are S1/);
});

test("the tracker's sections and boxes are read as validatePlan reads them", () => {
  const closed = PLAN.replace("## Sign-off checklist", "## Sign-off checklist ##");
  assert.match(trackerBody(closed, PASSED).body, /^- \[x\] S1:/m);
  // A fenced `## Execution record` is no heading: the real one is replaced. Not under
  // Setup or Steps, where a fence is a shell command (#199).
  const fenced = PLAN.replace(
    "## Execution record",
    "```text\n## Execution record\n```\n\n## Execution record",
  );
  const { body, problems } = trackerBody(fenced, PASSED);
  assert.deepEqual(problems, []);
  assert.ok(body.includes("```text\n## Execution record\n```"));
  assert.ok(!body.includes("_Not run yet._"));
  // A box spaced more loosely is still the scenario's: its stale tick is cleared.
  const loose = PLAN.replace("- [ ] S1:", "-  [x]\tS1:");
  assert.match(trackerBody(loose, FAILED).body, /^- {2}\[ \]\tS1:/m);
});

// --- Review boxes: read by a person, never a result (#205) ---

const REVIEW = "- [ ] Review: docs/x.html says the token lasts 30 days";
/** The good plan with a `Review:` box in its Sign-off checklist. */
const PLAN_WITH_REVIEW = PLAN.replace(
  "- [ ] Setup 1: the `admin` account was restored",
  `- [ ] Setup 1: the \`admin\` account was restored\n${REVIEW}`,
);
/** A plan whose Residue is only a review box: no scenarios, so no Setup box either. */
const REVIEW_ONLY = PLAN.replace(
  /(## Scenarios\n\n)[\s\S]*?(?=## Sign-off checklist)/,
  "$1None.\n\n",
).replace(/(## Sign-off checklist\n\n)[\s\S]*?(?=\n## Stop)/, `$1${REVIEW}\n`);
/** The report for REVIEW_ONLY: nothing ran, and the box is a person's, under Follow-ups. */
const REVIEWED = reportFor(
  [],
  "- No scenarios; one review box for a person.\n- Build: verified by `gh`",
)
  .replace(/(## Results\n\n)[\s\S]*?(?=\n## Follow-ups)/, "$1None.\n")
  .replace(
    "## Follow-ups\n\nNone.",
    "## Follow-ups\n\n- Review, for a person: docs/x.html says the token lasts 30 days",
  );

test("a plan of review boxes only gets a report with Results `None.`, and the box under Follow-ups", () => {
  assert.deepEqual(validatePlan(REVIEW_ONLY).problems, []);
  const { report, problems } = readReport(REVIEWED);
  assert.deepEqual(problems, []);
  assert.deepEqual(report.results, []);
  assert.equal(report.failed, false);
  assert.deepEqual(reportPlanProblems(report, REVIEW_ONLY), []);
  const out = main(["read", "reviewed.md", "--plan", "plan.md"], {
    readFile: (path) => ({ "reviewed.md": REVIEWED, "plan.md": REVIEW_ONLY })[path] ?? null,
  });
  assert.equal(out.code, 0, out.out);
});

test("Results `None.` is only for a plan with no scenarios; an empty table is still a problem", () => {
  const { report } = readReport(REVIEWED);
  assert.match(
    reportPlanProblems(report, PLAN).join("\n"),
    /the plan's scenarios are S1 S2; the report's results are none/,
  );
  const empty = reportFor([]);
  assert.match(readReport(empty).problems.join("\n"), /the Results table has no scenario rows/);
});

test("Results `None.` reads only with a review box under Follow-ups, so a report alone cannot hide its scenarios", () => {
  // Without the plan (`report.mjs comment`), `None.` and no review box is refused.
  const bare = REVIEWED.replace(/## Follow-ups\n\n[^\n]*/, "## Follow-ups\n\nNone.");
  assert.match(
    readReport(bare).problems.join("\n"),
    /Results is `None\.` but \*\*Follow-ups\*\* has no `- Review, for a person: …` line/,
  );
  const comment = main(["comment", "bare.md"], { readFile: () => bare });
  assert.equal(comment.code, 1);
  assert.equal(main(["comment", "reviewed.md"], { readFile: () => REVIEWED }).code, 0);
});

test("a `Review:` box is never a Results row", () => {
  const row = reportFor([
    S1_ROW("PASS", "invite sent"),
    "| S2: A signed-out visitor cannot open the members page | PASS | `qa-report-pr-57/s2.log` | redirected |",
    "| Review: docs/x.html says the token lasts 30 days | PASS | none: read | says 30 days |",
  ]);
  assert.match(readReport(row).problems.join("\n"), /a result row names no scenario `S<n>`/);
  const { report } = readReport(
    REVIEWED.replace(
      "## Results\n\nNone.",
      [
        "## Results",
        "",
        "| Scenario | Result | Evidence | Notes |",
        "| -------- | ------ | -------- | ----- |",
        "| Review: docs/x.html says the token lasts 30 days | PASS | none: read | ok |",
      ].join("\n"),
    ),
  );
  assert.deepEqual(report.results, []);
});

test("on the tracker issue a `Review:` box stays a person's to tick", () => {
  const { body, problems } = trackerBody(PLAN_WITH_REVIEW, PASSED);
  assert.deepEqual(problems, []);
  assert.match(body, /^- \[x\] S1:/m);
  assert.match(body, /^- \[ \] Review: docs\/x\.html says the token lasts 30 days$/m);
  // A person's tick survives a re-run.
  const ticked = PLAN_WITH_REVIEW.replace("- [ ] Review:", "- [x] Review:");
  assert.match(trackerBody(ticked, FAILED).body, /^- \[x\] Review:/m);
  // A plan of review boxes only: the record is posted, the box left as it is.
  const only = trackerBody(REVIEW_ONLY, REVIEWED);
  assert.deepEqual(only.problems, []);
  assert.match(only.body, /^- \[ \] Review: docs\/x\.html/m);
  assert.match(only.body, /## Execution record\n\n- No scenarios; one review box for a person\./);
});

// --- Each open review box is under Follow-ups (#222) ---

/** The text of REVIEW's box, and of a second open box. */
const BOX_TEXT = REVIEW.slice("- [ ] Review: ".length);
const SECOND_BOX = "README.md names the new flag";
/** REVIEW_ONLY with a second open box. */
const TWO_BOXES = REVIEW_ONLY.replace(REVIEW, `${REVIEW}\n- [ ] Review: ${SECOND_BOX}`);
/** `report` with its Follow-ups listing `texts`, one review line each. */
const withReviewLines = (report, texts) =>
  report.replace(
    /## Follow-ups\n\n[\s\S]*?(?=\n## Execution record)/,
    `## Follow-ups\n\n${texts.map((text) => `- Review, for a person: ${text}`).join("\n")}\n`,
  );
const readAgainst = (report, plan) =>
  main(["read", "report.md", "--plan", "plan.md"], {
    readFile: (path) => ({ "report.md": report, "plan.md": plan })[path] ?? null,
  });

test("a report that drops an open review box from Follow-ups fails `read --plan`, naming the box", () => {
  assert.deepEqual(validatePlan(TWO_BOXES).problems, []);
  const { report, problems } = readReport(REVIEWED);
  assert.deepEqual(problems, []);
  assert.deepEqual(report.reviews, [BOX_TEXT]);
  const found = reportPlanProblems(report, TWO_BOXES);
  assert.equal(found.length, 1);
  assert.match(found[0], /README\.md names the new flag/);
  assert.match(found[0], /is not under \*\*Follow-ups\*\*, which must list it/);
  assert.doesNotMatch(found[0], /30 days/);
  const out = readAgainst(REVIEWED, TWO_BOXES);
  assert.equal(out.code, 1);
  assert.match(out.out, /README\.md names the new flag/);
});

test("a report listing every open review box passes, and so does a plan with no review boxes", () => {
  const both = withReviewLines(REVIEWED, [BOX_TEXT, SECOND_BOX]);
  assert.deepEqual(readReport(both).report.reviews, [BOX_TEXT, SECOND_BOX]);
  assert.equal(readAgainst(both, TWO_BOXES).code, 0);
  // Order, and a `*` list marker, do not matter.
  const reordered = withReviewLines(REVIEWED, [SECOND_BOX, BOX_TEXT]).replace(
    "- Review, for a person: docs/",
    "* Review, for a person: docs/",
  );
  assert.equal(readAgainst(reordered, TWO_BOXES).code, 0);
  assert.deepEqual(readReport(PASSED).report.reviews, []);
  assert.deepEqual(reportPlanProblems(readReport(PASSED).report, PLAN), []);
});

test("two open review boxes with the same text need one Follow-ups line, and give one problem", () => {
  const twice = REVIEW_ONLY.replace(REVIEW, `${REVIEW}\n${REVIEW}`);
  assert.deepEqual(validatePlan(twice).problems, []);
  assert.deepEqual(reportPlanProblems(readReport(REVIEWED).report, twice), []);
  const missing = reportPlanProblems(
    readReport(PASSED).report,
    PLAN_WITH_REVIEW.replace(REVIEW, `${REVIEW}\n${REVIEW}`),
  );
  assert.equal(missing.length, 1);
});

test("a review box ticked in the plan needs no Follow-ups line", () => {
  const ticked = TWO_BOXES.replace(`- [ ] Review: ${SECOND_BOX}`, `- [x] Review: ${SECOND_BOX}`);
  assert.deepEqual(validatePlan(ticked).problems, []);
  assert.deepEqual(reportPlanProblems(readReport(REVIEWED).report, ticked), []);
});

test("a plan with scenarios and an open review box is checked the same way", () => {
  assert.match(
    reportPlanProblems(readReport(PASSED).report, PLAN_WITH_REVIEW).join("\n"),
    /docs\/x\.html says the token lasts 30 days/,
  );
  assert.equal(readAgainst(PASSED, PLAN_WITH_REVIEW).code, 1);
  assert.equal(readAgainst(withReviewLines(PASSED, [BOX_TEXT]), PLAN_WITH_REVIEW).code, 0);
});

test("a review line in a fenced block, or with other text, does not list the box", () => {
  const fenced = PASSED.replace(
    "## Follow-ups\n\nNone.",
    `## Follow-ups\n\n\`\`\`\n- Review, for a person: ${BOX_TEXT}\n\`\`\``,
  );
  assert.deepEqual(readReport(fenced).report.reviews, []);
  assert.equal(readAgainst(fenced, PLAN_WITH_REVIEW).code, 1);
  const other = withReviewLines(PASSED, ["docs/x.html says the token lasts 31 days"]);
  assert.equal(readAgainst(other, PLAN_WITH_REVIEW).code, 1);
});

// --- QA Artifacts ---

test("a failed run's media is refused, whatever the person picks", () => {
  const result = upload(FAILED, ["qa-report-pr-57/s1.png", "qa-report-pr-57/s2.log"]);
  assert.deepEqual(
    result.refused.map((r) => r.file),
    ["qa-report-pr-57/s1.png"],
  );
  assert.match(result.refused[0].why, /media from a failed run is never uploaded/);
  assert.deepEqual(
    result.accepted.map((a) => a.asset),
    ["pr-57-s2.log"],
  );
  // A stopped run is a failed run too.
  assert.equal(upload(STOPPED, ["qa-report-pr-57/s1.png"]).accepted.length, 0);
});

test("a passed run's picked media is accepted under a per-PR asset name", () => {
  const result = upload(PASSED, ["qa-report-pr-57/s1.png"], { github: "o/r" });
  assert.deepEqual(result.refused, []);
  assert.equal(result.tag, "qa-artifacts");
  assert.equal(result.release, "create");
  assert.deepEqual(result.accepted, [
    {
      file: "qa-report-pr-57/s1.png",
      asset: "pr-57-s1.png",
      url: "https://github.com/o/r/releases/download/qa-artifacts/pr-57-s1.png",
    },
  ]);
});

test("a passed run's Storyboard and MP4 are accepted (#237)", () => {
  const result = upload(BOARDS, [p57("s1-storyboard.png"), p57("s1.mp4")], { github: "o/r" });
  assert.deepEqual(result.refused, []);
  assert.deepEqual(
    result.accepted.map((a) => a.asset),
    ["pr-57-s1-storyboard.png", "pr-57-s1.mp4"],
  );
});

test("a Before still, a step still behind a Storyboard, or a recording is refused, naming the rule (#237)", () => {
  const result = upload(BOARDS, [
    p57("s1-before-web/step-02-a.png"),
    p57("s2-before.png"),
    p57("s1-web/step-02-a.png"),
    p57("s1-key-after.png"),
    p57("s2.webm"),
    p57("s2.gif"),
  ]);
  assert.deepEqual(result.accepted, []);
  const why = refusedWhy(result);
  assert.match(why[p57("s1-before-web/step-02-a.png")], /^a lone Before still is never uploaded/);
  assert.match(why[p57("s2-before.png")], /^a lone Before still is never uploaded/);
  assert.match(
    why[p57("s1-web/step-02-a.png")],
    /^a still behind a Storyboard is never uploaded: a row with a Storyboard uploads `qa-report-pr-57\/s1-storyboard\.png`/,
  );
  // A still beside the step stills is refused too: the row's Storyboard is its main evidence.
  assert.match(why[p57("s1-key-after.png")], /^a still behind a Storyboard is never uploaded/);
  for (const raw of ["s2.webm", "s2.gif"])
    assert.match(why[p57(raw)], /^a raw recording is never uploaded: only a scenario's MP4/, raw);
  // A web.mjs recording never reads as evidence (#236); even handed in, it is refused.
  const report = readReport(BOARDS).report;
  report.results[0].evidence.push(p57("s1-web/video-a.webm"));
  const raw = evidenceUpload({
    upload: "gh-release:qa-artifacts",
    report,
    picks: [p57("s1-web/video-a.webm")],
    exists: () => true,
    read: everyFile,
    visibility: "PRIVATE",
  });
  assert.match(raw.refused[0].why, /^a raw recording is never uploaded/);
  // A Storyboard written with backslashes still puts its step stills behind it.
  const slashed = reportFor([
    "| S1: An admin invites a new member | PASS | `qa-report-pr-57\\s1-storyboard.png` `qa-report-pr-57\\s1-web\\step-02-a.png` | invite sent |",
    BOARD_ROWS[1],
  ]);
  assert.match(
    upload(slashed, ["qa-report-pr-57\\s1-web\\step-02-a.png"]).refused[0].why,
    /^a still behind a Storyboard is never uploaded/,
  );
  // A step's key-before still is no Before still.
  const key = PASSED.replace("`qa-report-pr-57/s1.png`", "`qa-report-pr-57/s1-key-before.png`");
  assert.deepEqual(upload(key, [p57("s1-key-before.png")]).refused, []);
});

test("a scenario with no Storyboard still offers its plain stills, and an api log goes as today (#237)", () => {
  const result = upload(BOARDS, [
    p57("s2-web/step-03-a.png"),
    p57("s2-fail.png"),
    p57("s2-http.log"),
  ]);
  assert.deepEqual(result.refused, []);
  assert.deepEqual(
    result.accepted.map((a) => a.asset),
    ["pr-57-s2-web-step-03-a.png", "pr-57-s2-fail.png", "pr-57-s2-http.log"],
  );
});

test("a run with only FAIL: pre-existing, or one stopped, refuses all media, Storyboard and MP4 too (#237)", () => {
  const note =
    "merge-base evidence: the two-point run shows `members_redirect` failing at the merge-base";
  const preExisting = reportFor([
    BOARD_ROWS[0],
    BOARD_ROWS[1]
      .replace("| PASS |", "| FAIL: pre-existing |")
      .replace(/\| redirected;[^|]*\|$/, `| ${note} |`),
  ]);
  const stopped = reportFor([
    BOARD_ROWS[0].replace("| invite sent |", "| invite sent; the run stopped at S1: data loss |"),
    BOARD_ROWS[1],
  ]);
  const media = [p57("s1-storyboard.png"), p57("s1.mp4"), p57("s2-web/step-03-a.png")];
  for (const report of [preExisting, stopped]) {
    assert.deepEqual(readReport(report).problems, []);
    assert.equal(readReport(report).report.failed, true);
    const result = upload(report, [...media, p57("s2-http.log")]);
    assert.deepEqual(
      result.refused.map((r) => r.file),
      media,
    );
    for (const refused of result.refused)
      assert.match(refused.why, /^media from a failed run is never uploaded/);
    assert.deepEqual(
      result.accepted.map((a) => a.file),
      [p57("s2-http.log")],
    );
  }
});

test("the CLI refuses a step still behind a Storyboard with exit 1, naming the rule (#237)", () => {
  const io = {
    readFile: (p) => (p === "report.md" ? BOARDS : null),
    read: (p) =>
      p === "qa.config.yml" ? "run:\n  evidence: { upload: gh-release:qa-artifacts }\n" : null,
    exists: () => true,
    readEvidence: everyFile,
  };
  const picks = (...files) => ["evidence", "report.md", ...files.flatMap((f) => ["--pick", f])];
  const bad = main(picks(p57("s1-storyboard.png"), p57("s1-web/step-02-a.png")), io);
  assert.equal(bad.code, 1);
  const refused = JSON.parse(bad.out).refused;
  assert.equal(refused.length, 1);
  assert.match(refused[0].why, /^a still behind a Storyboard is never uploaded/);
  assert.equal(main(picks(p57("s1-storyboard.png"), p57("s1.mp4")), io).code, 0);
});

test("only the files picked, and only ones the report lists, are uploaded", () => {
  assert.deepEqual(upload(PASSED, []).accepted, []);
  const result = upload(PASSED, [
    "qa-report-pr-57/stack-pids.txt",
    ".env",
    "qa-report-pr-57/s1.png",
    "qa-report-pr-57/s1.png",
  ]);
  assert.deepEqual(
    result.refused.map((r) => [r.file, r.why.slice(0, 22)]),
    [
      ["qa-report-pr-57/stack-pids.txt", "the report lists no su"],
      [".env", "the report lists no su"],
      ["qa-report-pr-57/s1.png", "picked twice (asset `p"],
    ],
  );
  const missing = upload(PASSED, ["qa-report-pr-57/s1.png"], { exists: () => false });
  assert.match(missing.refused[0].why, /no such file/);
});

test("a picked text file that carries a sign-in value is refused, without echoing it", () => {
  // Built at run time: no credential-looking literal is ever committed.
  const value = ["Zq", "8v", "Lw", "3n", "Rt", "7k"].join("");
  const result = upload(PASSED, ["qa-report-pr-57/s2.log"], {
    read: () => `POST /login\npassword: ${value}\n`,
  });
  assert.deepEqual(result.accepted, []);
  assert.match(result.refused[0].why, /^line 2: looks like a credential value: a sign-in value/);
  assert.ok(!result.refused[0].why.includes(value));
});

test("media is never read; a text file that cannot be read is refused, not a crash", () => {
  const unread = () => {
    throw Object.assign(new Error("too long"), { code: "ERR_STRING_TOO_LONG" });
  };
  assert.deepEqual(upload(PASSED, ["qa-report-pr-57/s1.png"], { read: unread }).refused, []);
  const log = upload(PASSED, ["qa-report-pr-57/s2.log"], { read: unread });
  assert.match(log.refused[0].why, /could not be read to check it \(ERR_STRING_TOO_LONG\)/);
});

test("evidence that is neither media nor plain text is refused, from any run", () => {
  const files = ["trace.zip", "s1.pdf", "s2.har.gz"].map((name) => `qa-report-pr-57/${name}`);
  const report = reportFor([
    `| S1: An admin invites a new member | PASS | ${files.map((f) => `\`${f}\``).join(" ")} | ok |`,
    "| S2: A signed-out visitor cannot open the members page | PASS | none | ok |",
  ]);
  const result = upload(report, files);
  assert.deepEqual(result.accepted, []);
  for (const refused of result.refused)
    assert.match(refused.why, /only media and plain-text evidence is uploaded/);
});

test("an asset name keeps only the characters GitHub keeps", () => {
  const report = PASSED.replace("`qa-report-pr-57/s1.png`", "`qa-report-pr-57/run 1/s1 (a).png`");
  const result = upload(report, ["qa-report-pr-57/run 1/s1 (a).png"], { github: "o/r" });
  assert.equal(result.accepted[0].asset, "pr-57-run-1-s1--a-.png");
  assert.match(result.accepted[0].url, /\/pr-57-run-1-s1--a-\.png$/);
});

test("with `evidence.upload: none` nothing is uploaded", () => {
  const result = upload(PASSED, ["qa-report-pr-57/s1.png"], { upload: "none" });
  assert.equal(result.tag, null);
  assert.deepEqual(result.accepted, []);
  assert.match(result.refused[0].why, /`run.evidence.upload` is `none`/);
});

test("an existing release that is not a prerelease takes nothing; a prerelease is reused", () => {
  const full = upload(PASSED, ["qa-report-pr-57/s1.png"], { release: "release" });
  assert.deepEqual(full.accepted, []);
  assert.match(full.refused[0].why, /not a prerelease/);
  assert.equal(upload(PASSED, [], { release: "prerelease" }).release, "use");
});

test("a public repository, or one of unknown visibility, gets the QA Account warning", () => {
  assert.deepEqual(upload(PASSED, []).warnings, []);
  for (const visibility of ["PUBLIC", null])
    assert.match(
      upload(PASSED, [], { visibility }).warnings[0],
      /only files that show QA Account data/,
    );
});

// --- CLI ---

test("the CLI refuses a failed run's media with exit 1", () => {
  const files = {
    "report.md": FAILED,
  };
  const { code, out } = main(["evidence", "report.md", "--pick", "qa-report-pr-57/s1.png"], {
    readFile: (p) => files[p] ?? null,
    read: (p) =>
      p === "qa.config.yml" ? "run:\n  evidence: { upload: gh-release:qa-artifacts }\n" : null,
    exists: () => true,
    readEvidence: everyFile,
  });
  assert.equal(code, 1);
  const result = JSON.parse(out);
  assert.equal(result.working_dir, "tmp/qa");
  assert.match(result.refused[0].why, /media from a failed run/);
});

test("the CLI finds the comment to update from gh's JSON lines, and needs the login", () => {
  const lines = [
    JSON.stringify({ id: 1, body: "hi", user: "qa-person" }),
    JSON.stringify({ id: 2, body: `${REPORT_MARKER}\n\n# QA Report: x`, user: "qa-person" }),
  ].join("\n");
  const { code, out } = main(["find", "--login", "qa-person"], { stdin: () => lines });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out).report, {
    action: "update",
    id: 2,
    duplicates: [],
    head: null,
  });
  assert.equal(main(["find"], { stdin: () => lines }).code, 2);
});

test("the CLI prints the comment body, and names an unknown command as usage", () => {
  const { code, out } = main(["comment", "r.md"], { readFile: () => PASSED });
  assert.equal(code, 0);
  assert.ok(out.startsWith(`${REPORT_MARKER}\n`));
  assert.equal(main(["post", "r.md"]).code, 2);
});

test("the CLI answers `none` when the config has no `run:` section, or there is none", () => {
  for (const config of ["working_dir: tmp/qa\n", null]) {
    const { code, out } = main(["evidence", "r.md", "--pick", "qa-report-pr-57/s1.png"], {
      readFile: () => PASSED,
      read: (p) => (p === "qa.config.yml" ? config : null),
      exists: () => true,
      readEvidence: everyFile,
    });
    assert.equal(code, 1);
    assert.match(JSON.parse(out).refused[0].why, /`run.evidence.upload` is `none`/);
  }
});
