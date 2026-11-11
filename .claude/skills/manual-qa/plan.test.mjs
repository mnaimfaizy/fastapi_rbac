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
    { id: "S1", title: "An admin invites a new member", signsInAs: "admin" },
    { id: "S2", title: "A signed-out visitor cannot open the members page", signsInAs: "nobody" },
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
    /S1 signs in as `owner`, which the Run brief/,
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
