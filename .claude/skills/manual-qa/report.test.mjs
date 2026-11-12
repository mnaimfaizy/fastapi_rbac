/**
 * Contract suite for posting a QA Report (`report.mjs`): one PR comment,
 * found by its `<!-- qa-report -->` marker and updated on a re-run, never
 * duplicated; the tracker issue's boxes and Execution record; and the upload
 * rules, above all that a failed run's media is never uploaded.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REPORT_MARKER,
  evidenceUpload,
  findComments,
  main,
  parseComments,
  reportPlanProblems,
  readReport,
  reportComment,
  trackerBody,
} from "./report.mjs";
import { validatePlan } from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN = readFileSync(join(HERE, "fixtures", "plans", "good.md"), "utf8");
const HEAD = "2".repeat(40);

/** A QA Report for fixtures/plans/good.md (subject #42, pull request #57). */
const reportFor = (rows, record = "- S1: PASS\n- S2: PASS\n- Build: verified by `gh`") =>
  [
    "# QA Report: Members can be invited by email",
    "",
    `- **Plan:** \`tmp/qa/qa-plan-pr-57.md\`, subject #42, pull request #57, head \`${HEAD}\``,
    "- **Build check:** verified by `gh`",
    "- **Run:** `stack`, `web`, driven by the built-in browser, on 2026-11-10 10:00",
    "- **Accounts:** admin",
    "- **Teardown:** `down` run; nothing else started",
    "",
    "## Results",
    "",
    "| Scenario | Result | Evidence | Notes |",
    "| -------- | ------ | -------- | ----- |",
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
  "| S1: An admin invites a new member | FAIL | `qa-report-pr-57/s1.png` | no invite appeared |",
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

test("a result other than the three is a problem", () => {
  const { problems } = readReport(reportFor(["| S1: x | passed-ish | none | |"]));
  assert.match(problems[0], /S1's result is `passed-ish`/);
});

// --- The report against its plan: Scenario accounts ---

/** good.md with S1 creating `temp-user` and S2 signing in as it. */
const ACCOUNT_PLAN = PLAN.replace(
  "- **Signs in as:** `admin`\n",
  "- **Signs in as:** `admin`\n- **Creates:** `temp-user` (its values chosen when S1 creates it)\n",
).replace("- **Signs in as:** nobody\n", "- **Signs in as:** `temp-user` (created in S1)\n");
const S1_ROW = (result, note) =>
  `| S1: An admin invites a new member | ${result} | none | ${note} |`;
const S2_ROW = (result, note) =>
  `| S2: A signed-out visitor cannot open the members page | ${result} | none | ${note} |`;
const LEFT_NOTE = "signs in as `temp-user`, which S1 creates, and S1 did not pass";
const againstPlan = (rows, plan = ACCOUNT_PLAN) =>
  reportPlanProblems(readReport(reportFor(rows)).report, plan);

test("a scenario whose Scenario account's creator did not pass is left for a person, saying why", () => {
  assert.deepEqual(validatePlan(ACCOUNT_PLAN).problems, []);
  // The creator failed, or was itself left for a person: the dependent is left, with the reason.
  for (const creator of ["FAIL", "left for a person"])
    assert.deepEqual(
      againstPlan([S1_ROW(creator, "no invite appeared"), S2_ROW("left for a person", LEFT_NOTE)]),
      [],
    );
  // A run stopped on a blocking outcome may give the dependent its stop note instead.
  assert.deepEqual(
    againstPlan([
      S1_ROW("FAIL", "data loss"),
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
    [S1_ROW("FAIL", "no invite appeared"), S2_ROW("PASS", "signed in")],
    [S1_ROW("FAIL", "no invite appeared"), S2_ROW("FAIL", "could not sign in")],
    // Left for a person, but without saying why.
    [S1_ROW("FAIL", "no invite appeared"), S2_ROW("left for a person", "could not sign in")],
  ])
    assert.deepEqual(againstPlan(rows), [want]);
  // The plain plan has no Scenario account: nothing depends on S1.
  assert.deepEqual(
    againstPlan([S1_ROW("FAIL", "no invite"), S2_ROW("PASS", "redirected")], PLAN),
    [],
  );
});

test("a stop note counts only on a dependent after the stop", () => {
  const want = `S2 ${LEFT_NOTE}: its result is _left for a person_, with the note _${LEFT_NOTE}_`;
  // The run stopped at S2 itself, or at a later S4: S2 was reached, so it owes the creator reason.
  for (const stop of ["S2", "S4"])
    assert.deepEqual(
      againstPlan([
        S1_ROW("FAIL", "no invite appeared"),
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
  const S3_ROW = (result, note) => `| S3: The invitee signs in | ${result} | none | ${note} |`;
  const S3_NOTE = "signs in as `invitee`, which S2 creates, and S2 did not pass";
  // S1 failed, so S2 is left for a person, so S3 is left too.
  assert.deepEqual(
    againstPlan(
      [
        S1_ROW("FAIL", "no invite appeared"),
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
        S1_ROW("FAIL", "no invite appeared"),
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
      [S1_ROW("FAIL", "no invite appeared"), S2_ROW("left for a person", note)],
      sessions,
    ),
    [],
  );
  assert.deepEqual(
    againstPlan(
      [S1_ROW("FAIL", "no invite appeared"), S2_ROW("PASS", "A was signed out")],
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
    `| S3: Each new user sees the other's change | ${result} | none | ${note} |`;
  const rows = (note) => [
    S1_ROW("FAIL", "no invite appeared"),
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
    "good.md": reportFor([S1_ROW("FAIL", "no invite"), S2_ROW("left for a person", LEFT_NOTE)]),
    "bad.md": reportFor([S1_ROW("FAIL", "no invite"), S2_ROW("PASS", "signed in")]),
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
  const partial = reportFor(["| S1: An admin invites a new member | PASS | none | invite sent |"]);
  const { body, problems } = trackerBody(trackerBody(PLAN, PASSED).body, partial);
  assert.equal(body, null);
  assert.match(problems[0], /the plan's scenarios are S1 S2; the report's results are S1/);
});

test("the tracker's sections and boxes are read as validatePlan reads them", () => {
  const closed = PLAN.replace("## Sign-off checklist", "## Sign-off checklist ##");
  assert.match(trackerBody(closed, PASSED).body, /^- \[x\] S1:/m);
  // A fenced `## Execution record` in Setup is no heading: the real one is replaced.
  const fenced = PLAN.replace("## Scenarios", "```text\n## Execution record\n```\n\n## Scenarios");
  const { body, problems } = trackerBody(fenced, PASSED);
  assert.deepEqual(problems, []);
  assert.ok(body.includes("```text\n## Execution record\n```"));
  assert.ok(!body.includes("_Not run yet._"));
  // A box spaced more loosely is still the scenario's: its stale tick is cleared.
  const loose = PLAN.replace("- [ ] S1:", "-  [x]\tS1:");
  assert.match(trackerBody(loose, FAILED).body, /^- {2}\[ \]\tS1:/m);
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
  assert.deepEqual(JSON.parse(out).report, { action: "update", id: 2, duplicates: [] });
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
