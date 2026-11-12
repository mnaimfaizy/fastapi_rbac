/**
 * Contract suite for plan validation: `manual-qa` runs a plan only when it
 * reads against ANATOMY.md with no problems, and refuses one that carries a
 * credential. Fixtures: `fixtures/plans/good.md`, `with-credentials.md`, and
 * broken variants of the good plan made here, one defect each.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BRIEF_LABELS,
  ANCHOR_LABELS,
  PLAN_SECTIONS,
  SCENARIO_LABELS,
  credentialProblems,
  main,
  validatePlan,
} from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(HERE, "fixtures", "plans", name), "utf8");
const GOOD = fixture("good.md");
const anatomy = readFileSync(join(HERE, "ANATOMY.md"), "utf8");

/** The good plan with one replacement; the replacement must apply. */
function broken(from, to) {
  assert.ok(GOOD.includes(from), `good.md has no ${JSON.stringify(from)}`);
  return GOOD.replace(from, to);
}
const problemsOf = (text) => validatePlan(text).problems;
/**
 * A made-up secret-looking value of `length` characters, built at run time:
 * written out in the source, a fixture value trips secret scanners.
 */
const value = (length) => "Qa9!".repeat(Math.ceil(length / 4)).slice(0, length);
const assertProblem = (text, pattern) => {
  const problems = problemsOf(text);
  assert.ok(
    problems.some((p) => pattern.test(p)),
    `expected a problem matching ${pattern}, got:\n${problems.join("\n")}`,
  );
};

// ── The format the validator reads is ANATOMY.md's ──────────────────────────

test("the validator's sections are ANATOMY.md's nine, in order", () => {
  const listed = [...anatomy.matchAll(/^\d+\. `## (.+)`$/gm)].map((m) => m[1]);
  assert.deepEqual([...PLAN_SECTIONS], listed);
});

test("every label the validator requires is one ANATOMY.md names", () => {
  for (const label of [...ANCHOR_LABELS, ...BRIEF_LABELS, ...SCENARIO_LABELS])
    assert.ok(anatomy.includes(`**${label}:**`), `ANATOMY.md does not name **${label}:**`);
});

// ── A good plan ─────────────────────────────────────────────────────────────

test("the good plan reads with no problems, and its parts are read out", () => {
  const { plan, problems } = validatePlan(GOOD);
  assert.deepEqual(problems, []);
  assert.equal(plan.format, 1);
  assert.equal(plan.subject, 42);
  assert.equal(plan.pr, 57);
  assert.equal(plan.title, "Members can be invited by email");
  assert.deepEqual(plan.anchors, {
    subjectIssue: 42,
    pullRequest: 57,
    mergeBase: "1".repeat(40),
    head: "2".repeat(40),
  });
  assert.deepEqual(plan.brief, {
    target: "stack",
    surface: "web",
    versionEndpoint: "/version",
    roles: ["admin", "member"],
  });
  assert.deepEqual(plan.scenarios, [
    {
      id: "S1",
      title: "An admin invites a new member",
      signsInAs: "admin",
      sessions: [{ name: null, id: "admin" }],
      creates: [],
    },
    {
      id: "S2",
      title: "A signed-out visitor cannot open the members page",
      signsInAs: "nobody",
      sessions: [{ name: null, id: "nobody" }],
      creates: [],
    },
  ]);
  assert.equal(plan.executed, false);
});

test("CRLF line endings and a byte-order mark read the same", () => {
  assert.deepEqual(problemsOf(`﻿${GOOD.replace(/\n/g, "\r\n")}`), []);
});

test("`None.` sections are accepted", () => {
  const text = broken(
    "- `test_flaky_clock` fails at the merge-base too; ignore it `[observed]`.",
    "None.",
  );
  assert.deepEqual(problemsOf(text), []);
});

test("a filled execution record is read as a plan already run", () => {
  const text = broken("_Not run yet._", "| S1 | PASS | evidence/s1.png | |");
  assert.equal(validatePlan(text).plan.executed, true);
  assert.deepEqual(problemsOf(text), []);
});

test("a heading inside a fenced block is not a section", () => {
  const text = broken("## Setup\n", "## Setup\n\n```text\n## Not a section\n```\n");
  assert.deepEqual(problemsOf(text), []);
});

// ── Broken plans: one defect each ───────────────────────────────────────────

test("something that is not a plan stops at the marker", () => {
  assert.deepEqual(problemsOf("# Notes\n\nNothing here.\n"), [
    "line 1: expected the marker `<!-- qa-plan format=1 subject=#<n> pr=#<n> -->`: this is not a QA Plan",
  ]);
});

test("another format version is a problem", () => {
  assertProblem(broken("format=1", "format=2"), /^line 1: format=2: this copy/);
});

test("a missing title is a problem", () => {
  assertProblem(broken("# QA Plan: Members", "# Members"), /expected the title `# QA Plan:/);
});

test("a missing, extra, repeated or misplaced section is a problem", () => {
  assertProblem(
    broken("## Expected red herrings", "## Red herrings"),
    /no `## Expected red herrings` section/,
  );
  assertProblem(
    broken("## Setup\n", "## Notes\n\nA thing.\n\n## Setup\n"),
    /`## Notes` is not a QA Plan section/,
  );
  assertProblem(
    broken("## Setup\n", "## Anchors\n\nAgain.\n\n## Setup\n"),
    /a second `## Anchors`/,
  );
  const swapped = GOOD.replace("## Setup", "## TMP")
    .replace("## Run brief", "## Setup")
    .replace("## TMP", "## Run brief");
  assertProblem(swapped, /the sections are out of order/);
});

test("an empty section is a problem: it says `None.`", () => {
  assertProblem(
    broken("- A member can reach the invite dialog.\n", ""),
    /`## Stop and do not merge if` is empty/,
  );
});

test("each anchor is required, and must agree with the marker", () => {
  assertProblem(
    broken("- **Head:** 2222222222222222222222222222222222222222\n", ""),
    /Anchors lacks \*\*Head:\*\*/,
  );
  assertProblem(
    broken("- **Head:** 2222222222222222222222222222222222222222", "- **Head:** 2222222"),
    /\*\*Head:\*\* expected the full commit SHA/,
  );
  assertProblem(
    broken("- **Pull request:** #57", "- **Pull request:** #58"),
    /#58 differs from the marker's pr=#57/,
  );
  assertProblem(
    broken("- **Subject issue:** #42", "- **Subject issue:** 42"),
    /\*\*Subject issue:\*\* expected `#<n>`/,
  );
});

test("a claim with no tag, or two, is a problem", () => {
  assertProblem(
    broken(", by the `backend` suite `[observed]`.", ", by the `backend` suite."),
    /exactly one tag/,
  );
  assertProblem(
    broken("`[observed]`.\n- The invitation", "`[observed]` `[reconstructed]`.\n- The invitation"),
    /exactly one tag/,
  );
});

test("each Run brief field is required, and target and surface are checked", () => {
  for (const label of BRIEF_LABELS) {
    const line = GOOD.split("\n").find((l) => l.startsWith(`- **${label}:**`));
    assertProblem(broken(`${line}\n`, ""), new RegExp(`Run brief lacks \\*\\*${label}:\\*\\*`));
  }
  assertProblem(
    broken("- **Target:** `stack`", "- **Target:** `local`"),
    /\*\*Target:\*\* expected one of: stack, url/,
  );
  assertProblem(
    broken("- **Surface:** `web`", "- **Surface:** `tv`"),
    /\*\*Surface:\*\* expected one of: web/,
  );
  assertProblem(
    broken(
      "- **Build:** 2222222222222222222222222222222222222222",
      "- **Build:** the latest build",
    ),
    /\*\*Build:\*\* expected the head SHA/,
  );
});

test("a version endpoint on another host is a problem", () => {
  for (const endpoint of ["//prod.example.com/version", "/\\prod.example.com/version"])
    assertProblem(
      broken("version endpoint `/version`", `version endpoint \`${endpoint}\``),
      /\*\*Build:\*\* the version endpoint must be a path on the build's own host/,
    );
});

test("roles must be named as `id`: purpose", () => {
  const text = GOOD.replace(
    /- \*\*Roles:\*\*\n(?: {2}- .*\n)+/,
    "- **Roles:** admins and members\n",
  );
  assertProblem(text, /\*\*Roles:\*\* name each role/);
});

test("scenarios are numbered from S1 with no gaps, with a proper heading", () => {
  assertProblem(broken("### S2:", "### S3:"), /expected S2 here/);
  assertProblem(
    broken("### S2: A signed-out", "### A signed-out"),
    /expected `### S<n>: <what is verified>`/,
  );
  assertProblem(
    GOOD.replace(/### S1[\s\S]*?(?=## Sign-off)/, ""),
    /no `### S1: …` scenario|`## Scenarios` is empty/,
  );
});

test("each scenario field is required, in order", () => {
  for (const label of SCENARIO_LABELS) {
    const at = GOOD.indexOf("### S2");
    const line = GOOD.slice(at)
      .split("\n")
      .find((l) => l.startsWith(`- **${label}:**`));
    const text = GOOD.slice(0, at) + GOOD.slice(at).replace(`${line}\n`, "");
    assertProblem(
      text,
      new RegExp(`S2 lacks \\*\\*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\*\\*`),
    );
  }
  const swapped = broken(
    "- **Expected result:** the sign-in page, with the heading **Sign in to continue**.\n- **A failure means:** the members page is reachable without signing in.",
    "- **A failure means:** the members page is reachable without signing in.\n- **Expected result:** the sign-in page, with the heading **Sign in to continue**.",
  );
  assertProblem(swapped, /S2: its fields are out of order/);
});

test("steps are a numbered list", () => {
  assertProblem(
    broken("  1. Open `/members` while signed out.", "  - Open `/members` while signed out."),
    /S2: \*\*Steps:\*\* expected a numbered list/,
  );
});

test("a scenario signs in only as a role the Run brief names, or nobody", () => {
  assertProblem(
    broken("- **Signs in as:** `admin`", "- **Signs in as:** `owner`"),
    /S1 signs in as `owner`, which is neither a role the Run brief's \*\*Roles:\*\* names nor a Scenario account/,
  );
});

test("first-word values are read as ANATOMY.md states: marks dropped, nothing else stripped", () => {
  // The three draft lines the #124 pilot wrote, which ANATOMY.md now rules out.
  assertProblem(
    broken("- **Surface:** `web`", "- **Surface:** `web`."),
    /\*\*Surface:\*\* expected one of: web, desktop, mobile, api/,
  );
  assertProblem(
    broken("- **Signs in as:** `admin`", "- **Signs in as:** the new user from S1, then `admin`."),
    /S1 signs in as `the`, which is neither a role the Run brief's \*\*Roles:\*\* names nor a Scenario account an earlier scenario creates/,
  );
  assertProblem(
    broken("- **Signs in as:** `admin`", "- **Signs in as:** `admin`."),
    /S1 signs in as `admin\.`, which is neither a role the Run brief's \*\*Roles:\*\* names nor a Scenario account an earlier scenario creates/,
  );
  assertProblem(
    broken("- **Target:** `stack`", "- **Target:** `stack`."),
    /\*\*Target:\*\* expected one of: stack, url/,
  );
  // The forms ANATOMY.md allows: bare, in backticks or emphasis, prose after a space or comma.
  for (const [from, to] of [
    ["- **Target:** `stack`", "- **Target:** stack, on a laptop"],
    ["- **Surface:** `web`", "- **Surface:** **web**"],
    ["- **Surface:** `web`", "- **Surface:** web"],
    ["- **Surface:** `web`", "- **Surface:** web, in Chrome"],
    ["- **Signs in as:** `admin`", "- **Signs in as:** admin"],
    ["- **Signs in as:** `admin`", "- **Signs in as:** `admin`, after S1 creates the new user"],
    ["- **Signs in as:** nobody", "- **Signs in as:** `nobody` (signed out)"],
  ]) {
    const { plan, problems } = validatePlan(broken(from, to));
    assert.deepEqual(problems, [], `${to} should read cleanly`);
    assert.equal(plan.brief.surface, "web");
    assert.deepEqual(
      plan.scenarios.map((s) => s.signsInAs),
      ["admin", "nobody"],
    );
    assert.equal(plan.brief.target, "stack");
  }
  // `_` inside a role id is part of it; only `*` and `_` around the word are dropped.
  const underscored = broken(
    "  - `admin`: manages members",
    "  - `team_admin`: manages members",
  ).replace("- **Signs in as:** `admin`", "- **Signs in as:** _`team_admin`_, after setup");
  const { plan, problems } = validatePlan(underscored);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    plan.scenarios.map((s) => s.signsInAs),
    ["team_admin", "nobody"],
  );
});

// ── Scenario accounts ───────────────────────────────────────────────────────

const S1_SIGNS = "- **Signs in as:** `admin`\n";
const S2_SIGNS = "- **Signs in as:** nobody\n";
/** The good plan with S1 creating `temp-user` and S2 signing in as it, then any edits. */
function withAccount(...edits) {
  let text = broken(
    S1_SIGNS,
    `${S1_SIGNS}- **Creates:** \`temp-user\` (its values chosen when S1 creates it)\n`,
  ).replace(S2_SIGNS, "- **Signs in as:** `temp-user` (created in S1)\n");
  for (const [from, to] of edits) {
    assert.ok(text.includes(from), `the plan has no ${JSON.stringify(from)}`);
    text = text.replace(from, to);
  }
  return text;
}
/** The 1-based line of the first line of `text` that starts with `start`. */
const lineOf = (text, start) => text.split("\n").findIndex((l) => l.startsWith(start)) + 1;

test("a later scenario signs in as the Scenario account an earlier one creates", () => {
  const { plan, problems } = validatePlan(withAccount());
  assert.deepEqual(problems, []);
  assert.deepEqual(plan.scenarios[0].creates, ["temp-user"]);
  assert.equal(plan.scenarios[1].signsInAs, "temp-user");
  assert.deepEqual(plan.scenarios[1].creates, []);
  // Not a Run brief role: run readiness asks only for those.
  assert.deepEqual(plan.brief.roles, ["admin", "member"]);
  // A list, read as first-word values; prose follows a space, colon, semicolon or parenthesis.
  for (const line of [
    "- **Creates:** temp-user, **other-user**: both chosen in the dialog",
    "- **Creates:** `temp-user`,`other-user`; chosen in the dialog",
    "- **Creates:** _temp-user_ , other-user (chosen in the dialog)",
  ]) {
    const read = validatePlan(
      withAccount(["- **Creates:** `temp-user` (its values chosen when S1 creates it)", line]),
    );
    assert.deepEqual(read.problems, [], line);
    assert.deepEqual(read.plan.scenarios[0].creates, ["temp-user", "other-user"], line);
  }
});

test("a chain: a scenario signs in as one Scenario account and creates the next", () => {
  const text = withAccount(
    [
      "- **Signs in as:** `temp-user` (created in S1)\n",
      "- **Signs in as:** `temp-user` (created in S1)\n- **Creates:** `invitee`\n",
    ],
    [
      "## Sign-off checklist",
      [
        "### S3: The invitee signs in",
        "",
        "- **Why only a human can prove it:** the invite email link is not driven by a suite.",
        "- **Signs in as:** `invitee`, created in S2",
        "- **Steps:**",
        "  1. Open **Members**.",
        "- **Expected result:** the page shows **Welcome**.",
        "- **A failure means:** the invite does not grant access.",
        "",
        "## Sign-off checklist",
      ].join("\n"),
    ],
    [
      "- [ ] S2: A signed-out visitor cannot open the members page",
      "- [ ] S2: A signed-out visitor cannot open the members page\n- [ ] S3: The invitee signs in",
    ],
  );
  const { plan, problems } = validatePlan(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    plan.scenarios.map((s) => [s.signsInAs, s.creates]),
    [
      ["admin", ["temp-user"]],
      ["temp-user", ["invitee"]],
      ["invitee", []],
    ],
  );
});

test("a sign-in as an account no scenario creates is a problem on its line", () => {
  const text = withAccount([
    "- **Signs in as:** `temp-user` (created in S1)",
    "- **Signs in as:** `ghost` (created in S1)",
  ]);
  assert.deepEqual(problemsOf(text), [
    `line ${lineOf(text, "- **Signs in as:** `ghost`")}: S2 signs in as \`ghost\`, which is neither a role the Run brief's **Roles:** names nor a Scenario account an earlier scenario creates`,
  ]);
});

test("only a scenario after its creator may sign in as a Scenario account", () => {
  // S1 signs in as what S2 creates.
  const forward = broken(S1_SIGNS, "- **Signs in as:** `temp-user`\n").replace(
    S2_SIGNS,
    `${S2_SIGNS}- **Creates:** \`temp-user\`\n`,
  );
  assert.deepEqual(problemsOf(forward), [
    `line ${lineOf(forward, "- **Signs in as:** `temp-user`")}: S1 signs in as \`temp-user\`, which S2 creates later: only a scenario after its creator may sign in as it`,
  ]);
  // A scenario signs in as what it creates itself.
  const itself = broken(S2_SIGNS, "- **Signs in as:** `temp-user`\n- **Creates:** `temp-user`\n");
  assert.deepEqual(problemsOf(itself), [
    `line ${lineOf(itself, "- **Signs in as:** `temp-user`")}: S2 signs in as \`temp-user\`, which it creates itself: only a later scenario may sign in as it`,
  ]);
});

test("a Scenario account id is well formed, has one creator, and is no role or `nobody`", () => {
  const S1_CREATES = "- **Creates:** `temp-user` (its values chosen when S1 creates it)";
  const cases = [
    [
      "- **Creates:** `admin`",
      /S1: \*\*Creates:\*\* `admin` is a role the Run brief's \*\*Roles:\*\* names/,
    ],
    ["- **Creates:** `member`, `temp-user`", /S1: \*\*Creates:\*\* `member` is a role/],
    [
      "- **Creates:** nobody, `temp-user`",
      /S1: \*\*Creates:\*\* `nobody`: `nobody` means signed out/,
    ],
    ["- **Creates:** `temp.user`, `temp-user`", /S1: \*\*Creates:\*\* `temp\.user` is not an id/],
    ["- **Creates:** `temp-user`, temp-user", /S1: \*\*Creates:\*\* `temp-user` is named twice/],
    ["- **Creates:** (chosen when S1 creates it)", /S1: \*\*Creates:\*\* expected the id of each/],
  ];
  for (const [line, pattern] of cases) {
    const text = withAccount([S1_CREATES, line]);
    const problems = problemsOf(text);
    assert.ok(
      problems.some(
        (p) => p.startsWith(`line ${lineOf(text, "- **Creates:**")}: `) && pattern.test(p),
      ),
      `${line}: expected ${pattern}, got:\n${problems.join("\n")}`,
    );
  }
  // Two scenarios create the same id: the second is named.
  const twice = withAccount([
    "- **Signs in as:** `temp-user` (created in S1)\n",
    "- **Signs in as:** `temp-user` (created in S1)\n- **Creates:** `temp-user`\n",
  ]);
  const second = twice.split("\n").findLastIndex((l) => l.startsWith("- **Creates:**")) + 1;
  assert.deepEqual(problemsOf(twice), [
    `line ${second}: S2: **Creates:** \`temp-user\` is already created by S1: each Scenario account has one creator`,
  ]);
});

test("a comma with no id after it is refused on the **Creates:** line", () => {
  for (const line of [
    "- **Creates:** `temp-user`,, `other-user`",
    "- **Creates:** `temp-user`, (chosen)",
  ]) {
    const text = withAccount([
      "- **Creates:** `temp-user` (its values chosen when S1 creates it)",
      line,
    ]);
    const { plan, problems } = validatePlan(text);
    assert.deepEqual(
      problems,
      [
        `line ${lineOf(text, "- **Creates:**")}: S1: **Creates:** has an empty id: a comma with no id after it`,
      ],
      line,
    );
    assert.ok(plan.scenarios[0].creates.includes("temp-user"));
    assert.ok(!plan.scenarios[0].creates.includes(""));
  }
  // The ids after a double comma are still read.
  const after = validatePlan(
    withAccount([
      "- **Creates:** `temp-user` (its values chosen when S1 creates it)",
      "- **Creates:** `temp-user`,, `other-user`",
    ]),
  );
  assert.deepEqual(after.plan.scenarios[0].creates, ["temp-user", "other-user"]);
});

test("**Creates:** comes right after **Signs in as:**", () => {
  const text = withAccount(
    ["- **Creates:** `temp-user` (its values chosen when S1 creates it)\n", ""],
    [
      "- **Why only a human can prove it:** no suite drives",
      "- **Creates:** `temp-user`\n- **Why only a human can prove it:** no suite drives",
    ],
  );
  assertProblem(text, /S1: its fields are out of order/);
});

test("a credential on a **Creates:** line is refused like any other", () => {
  assertProblem(
    withAccount(["(its values chosen when S1 creates it)", `(password: ${value(16)})`]),
    /looks like a credential/,
  );
});

test("each scenario has a box on the sign-off checklist", () => {
  assertProblem(
    broken("- [ ] S2: A signed-out visitor cannot open the members page\n", ""),
    /no `- \[ \] S2: …` box for S2/,
  );
});

// ── Credentials ─────────────────────────────────────────────────────────────

test("a plan that carries a credential is refused, without echoing the value", () => {
  const problems = problemsOf(fixture("with-credentials.md"));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^line 28: looks like a credential value; a plan carries role ids/);
  assert.ok(!problems[0].includes("Adm1n-QA!"), "the problem must not repeat the secret");
});

test("each way a credential travels is caught", () => {
  const leaks = [
    "Password: `hunter2`",
    "- **Password:** Adm1n-2024",
    'api_key = "abc123"',
    "the token is `tok-123`",
    "use password `S3cret!` for admin",
    "Type `S3cret!` into the **Password** field.",
    "Session cookie: `sid=abc`",
    "One-time code: 123456",
    `Paste ghp_${"a".repeat(36)} into the box.`,
    `Authorization: Bearer ${"x".repeat(24)}`,
    `jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.${"s".repeat(20)}`,
    `Open http://admin:${value(4)}@localhost:3000/`,
    "-----BEGIN RSA PRIVATE KEY-----",
    `key sk-ant-${"z".repeat(30)}`,
    `DB_PASSWORD=${value(10)}`,
    `ADMIN_PASSWORD: "${value(8)}"`,
    `SECRET_KEY_BASE=${value(12)}`,
    `adminPassword: "${value(9)}"`,
    `admin.password = \`${value(9)}\``,
    `Password: n/a; API token: "${value(16)}"`,
    `authorization: bearer ${"y".repeat(24)}`,
    `Authorization: Basic ${Buffer.from(`qa:${value(8)}`).toString("base64")}`,
    `Connect to redis://:${value(4)}@localhost:6379`,
    `Password: \`/${value(9)}\``,
    `api_key = "/${value(10)}"`,
  ];
  for (const leak of leaks)
    assert.equal(credentialProblems([leak]).length, 1, `not caught: ${leak}`);
});

test("a credential in a table column named for one is caught", () => {
  const table = [
    "| Role | Email | Password |",
    "| --- | --- | --- |",
    "| admin | admin@x.test | `Qa-1!` |",
  ];
  assert.deepEqual(
    credentialProblems(table).map((p) => p.slice(0, 7)),
    ["line 3:"],
  );
  const placeholders = [
    "| Role | Password |",
    "|---|---|",
    "| admin | `<from accounts.print>` |",
    "| user | *** |",
  ];
  assert.deepEqual(credentialProblems(placeholders), []);
});

test("talking about credentials is not carrying one", () => {
  const prose = [
    "- **Credentials:** with the repository, the config's `accounts.print` command; without it, ask the developer.",
    "Never capture the password field, or a screen showing a one-time code.",
    "Type the admin's password into **Password** and click **Sign in**.",
    "Password: ask the developer",
    "- **Password:** `<from accounts.print>`",
    "Type `admin@example.test` into **Email**.",
    "- `admin`: manages members (admin@example.test)",
    "Click **Reset password**.",
    "The token expires after 10 minutes.",
    "- **Pin:** none",
    "Follow the Basic configuration steps.",
    "- **Password reset page:** `/account/reset`",
    "The SECRET_KEY_BASE comes from the environment.",
    "Open https://localhost:3000/@admin",
    "Covers the basic read/write/admin roles.",
    "Basic configuration lives in `/etc/app`.",
    "The session cookie is `HttpOnly`.",
    "The reset token is single-use.",
    'Response has `token_type: "Bearer"`',
    "otp-length: `6`",
    "- **Password reset page:** `/account/reset`",
    "password_reset_path: `/account/reset`",
  ];
  assert.deepEqual(credentialProblems(prose), []);
});

test("ANATOMY.md itself carries no credential", () => {
  assert.deepEqual(credentialProblems(anatomy.split(/\r?\n/)), []);
});

// ── Sessions ────────────────────────────────────────────────────────────────

const S1_SINGLE =
  "- **Signs in as:** `admin`\n- **Steps:**\n  1. Open **Members**.\n  2. Click **Invite member**";
/** The good plan with S1 using two Sessions, its steps naming them, then any edits. */
function withSessions(sessions = "A = member, B = `admin` (each in its own browser)", ...edits) {
  let text = broken(
    S1_SINGLE,
    `- **Sessions:** ${sessions}\n- **Steps:**\n  1. In session A, open **Members**.\n  2. In B, click **Invite member**`,
  );
  for (const [from, to] of edits) {
    assert.ok(text.includes(from), `the plan has no ${JSON.stringify(from)}`);
    text = text.replace(from, to);
  }
  return text;
}
const sessionsLine = (text) => lineOf(text, "- **Sessions:**");

test("a scenario with two Sessions reads, and lists both", () => {
  const { plan, problems } = validatePlan(withSessions());
  assert.deepEqual(problems, []);
  assert.deepEqual(plan.scenarios[0].sessions, [
    { name: "A", id: "member" },
    { name: "B", id: "admin" },
  ]);
  assert.equal(plan.scenarios[0].signsInAs, null);
  // The single-session scenario is unchanged.
  assert.equal(plan.scenarios[1].signsInAs, "nobody");
  // The forms ANATOMY.md allows: ids as first-word values, spaces around `=` and commas, prose after.
  for (const sessions of [
    "A=member,B=admin",
    "**A** = **member** , B = _admin_: each in its own browser",
    "A = member, B = admin; C = nobody is prose after the semicolon",
  ]) {
    const read = validatePlan(withSessions(sessions));
    assert.deepEqual(read.problems, [], sessions);
    assert.deepEqual(
      read.plan.scenarios[0].sessions.map((s) => `${s.name}=${s.id}`),
      ["A=member", "B=admin"],
      sessions,
    );
  }
  // Three sessions, one signed out; `In session C,` names the third.
  const three = withSessions("A = member, B = admin, C = nobody", [
    "  2. In B, click",
    "  2. In session C, open `/members`.\n  3. In B, click",
  ]);
  assert.deepEqual(problemsOf(three), []);
  assert.deepEqual(
    validatePlan(three).plan.scenarios[0].sessions.map((s) => s.id),
    ["member", "admin", "nobody"],
  );
  // Only top-level steps name a session; a nested list under a step is prose.
  const nested = withSessions(undefined, [
    "  1. In session A, open **Members**.",
    "  1. In session A, open **Members**.\n     1. Wait for the list.",
  ]);
  assert.deepEqual(problemsOf(nested), []);
  // A sibling step shifted by up to 3 spaces is still top-level, so it must name a session.
  const shifted = withSessions(undefined, ["  2. In B, click", "   2. Click"]);
  assert.deepEqual(problemsOf(shifted), [
    `line ${lineOf(shifted, "   2. Click")}: S1: step 2 names no session: in a multi-session scenario, each step starts \`In session <name>,\``,
  ]);
});

test("both **Signs in as:** and **Sessions:**, or neither, is a problem", () => {
  const both = withSessions(undefined, [
    "- **Sessions:**",
    "- **Signs in as:** `admin`\n- **Sessions:**",
  ]);
  assert.deepEqual(problemsOf(both), [
    `line ${sessionsLine(both)}: S1 has both **Signs in as:** and **Sessions:**: a scenario has one or the other`,
  ]);
  const neither = broken("- **Signs in as:** `admin`\n", "");
  assert.deepEqual(problemsOf(neither), [
    `line ${lineOf(neither, "### S1:")}: S1 lacks **Signs in as:**`,
  ]);
  const empty = withSessions("");
  assert.ok(problemsOf(empty).includes(`line ${sessionsLine(empty)}: S1: **Sessions:** is empty`));
});

test("a malformed, lowercase, duplicate or lone session is a problem on its line", () => {
  const cases = [
    [
      "a = member, B = admin",
      "S1: **Sessions:** `a` is not a session name: a single capital letter",
    ],
    [
      "AB = member, B = admin",
      "S1: **Sessions:** `AB` is not a session name: a single capital letter",
    ],
    ["A = member, A = admin", "S1: **Sessions:** session A is named twice"],
    [
      "= member, B = admin",
      "S1: **Sessions:** an entry has no name before `=`: a single capital letter",
    ],
    [
      "A = member, = admin",
      "S1: **Sessions:** an entry has no name before `=`: a single capital letter",
    ],
    ["A = member, B = admin,", "S1: **Sessions:** a comma with no session after it"],
    [
      "(each in its own browser)",
      "S1: **Sessions:** expected `<name> = <id>` for each session, joined by commas",
    ],
    [
      "A = member, B = admin, (each in its own browser)",
      "S1: **Sessions:** a comma with no session after it",
    ],
    ["A = , B = admin", "S1: **Sessions:** session A has no id after `=`"],
    [
      "A member, B = admin",
      "S1: **Sessions:** expected `<name> = <id>` for each session, joined by commas, at `A`",
    ],
    [
      "A = member, admin",
      "S1: **Sessions:** expected `<name> = <id>` for each session, joined by commas, at `admin`",
    ],
    [
      "A = admin",
      "S1: **Sessions:** names one session: a scenario with one session uses **Signs in as:**",
    ],
  ];
  for (const [sessions, message] of cases) {
    const text = withSessions(sessions);
    const problems = problemsOf(text);
    assert.ok(
      problems.includes(`line ${sessionsLine(text)}: ${message}`),
      `${sessions}: expected ${message}, got:\n${problems.join("\n")}`,
    );
  }
});

test("a session id follows the **Signs in as:** rule, on the Sessions line", () => {
  const ghost = withSessions("A = member, B = ghost");
  assert.deepEqual(problemsOf(ghost), [
    `line ${sessionsLine(ghost)}: S1's session B signs in as \`ghost\`, which is neither a role the Run brief's **Roles:** names nor a Scenario account an earlier scenario creates`,
  ]);
  // A Scenario account created later, or by the scenario itself.
  const later = withSessions("A = member, B = temp-user", [
    "- **Signs in as:** nobody\n",
    "- **Signs in as:** nobody\n- **Creates:** `temp-user`\n",
  ]);
  assert.deepEqual(problemsOf(later), [
    `line ${sessionsLine(later)}: S1's session B signs in as \`temp-user\`, which S2 creates later: only a scenario after its creator may sign in as it`,
  ]);
  const itself = withSessions("A = member, B = temp-user", [
    "- **Steps:**\n  1. In session A",
    "- **Creates:** `temp-user`\n- **Steps:**\n  1. In session A",
  ]);
  assert.deepEqual(problemsOf(itself), [
    `line ${sessionsLine(itself)}: S1's session B signs in as \`temp-user\`, which S1 creates itself: only a later scenario may sign in as it`,
  ]);
});

test("a session signs in as a Scenario account an earlier scenario creates", () => {
  const text = withAccount([
    "- **Signs in as:** `temp-user` (created in S1)\n- **Steps:**\n  1. Open `/members` while signed out.",
    "- **Sessions:** A = `temp-user`, B = admin (`temp-user` created in S1)\n- **Steps:**\n  1. In session A, open `/members`.\n  2. In session B, reset the password of `temp-user`.",
  ]);
  const { plan, problems } = validatePlan(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(plan.scenarios[1].sessions, [
    { name: "A", id: "temp-user" },
    { name: "B", id: "admin" },
  ]);
});

test("in a multi-session scenario, a step that names no session, or an undeclared one, is a problem", () => {
  const none = withSessions(undefined, ["  2. In B, click", "  2. Click"]);
  assert.deepEqual(problemsOf(none), [
    `line ${lineOf(none, "  2. Click")}: S1: step 2 names no session: in a multi-session scenario, each step starts \`In session <name>,\``,
  ]);
  const undeclared = withSessions(undefined, ["  2. In B, click", "  2. In session C, click"]);
  assert.deepEqual(problemsOf(undeclared), [
    `line ${lineOf(undeclared, "  2. In session C")}: S1: step 2 is in session C, which **Sessions:** does not declare`,
  ]);
  // A single-session scenario's steps need no session.
  assert.deepEqual(problemsOf(GOOD), []);
});

test("**Sessions:** sits where **Signs in as:** does", () => {
  const text = withSessions(undefined, [
    "- **Sessions:** A = member, B = `admin` (each in its own browser)\n- **Steps:**",
    "- **Steps:**",
  ]).replace(
    "- **Expected result:** the list shows",
    "- **Sessions:** A = member, B = admin\n- **Expected result:** the list shows",
  );
  assertProblem(text, /S1: its fields are out of order/);
});

test("`plan` prints each scenario's sessions", () => {
  const io = { read: () => null, stdin: () => withSessions() };
  const result = main(["plan"], io);
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.out).plan.scenarios[0].sessions, [
    { name: "A", id: "member" },
    { name: "B", id: "admin" },
  ]);
});

// ── CLI ─────────────────────────────────────────────────────────────────────

test("`plan <file>` prints the plan and exits 0; a broken plan exits 1", () => {
  const files = { "good.md": GOOD, "leak.md": fixture("with-credentials.md") };
  const io = { readFile: (p) => files[p] ?? null, read: () => null };
  const good = main(["plan", "good.md"], io);
  assert.equal(good.code, 0);
  assert.equal(JSON.parse(good.out).plan.pr, 57);
  assert.equal(main(["plan", "leak.md"], io).code, 1);
  const missing = main(["plan", "nope.md"], io);
  assert.equal(missing.code, 1);
  assert.deepEqual(JSON.parse(missing.out).problems, ["nope.md: no such file"]);
});

test("`plan` with no file reads the plan from stdin", () => {
  const result = main(["plan"], { read: () => null, stdin: () => GOOD });
  assert.equal(result.code, 0);
});

test("`plan` works with no config, and over a config with problems", () => {
  const io = { read: (p) => (p === "qa.config.yml" ? "nope: 1\n" : null), stdin: () => GOOD };
  assert.equal(main(["plan"], io).code, 0);
});
