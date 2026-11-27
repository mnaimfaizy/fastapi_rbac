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
  COMMAND_WORDS,
  COMMAND_MARKS,
  FORMAT,
  FORMATS,
  COPY_WORDS,
  SCRIPT_EXTENSIONS,
  PLAN_SECTIONS,
  SCENARIO_LABELS,
  credentialProblems,
  main,
  validatePlan,
} from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(HERE, "fixtures", "plans", name), "utf8");
const GOOD = fixture("good.md");
const GOOD3 = fixture("good-format-3.md");
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
  assert.equal(plan.format, 2);
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
      surface: "web",
      observes: [],
      service: null,
      capture: "screenshot",
      captureGiven: false,
      expectedBefore: null,
      story: [],
    },
    {
      id: "S2",
      title: "A signed-out visitor cannot open the members page",
      signsInAs: "nobody",
      sessions: [{ name: null, id: "nobody" }],
      creates: [],
      surface: "web",
      observes: [],
      service: null,
      capture: "screenshot",
      captureGiven: false,
      expectedBefore: null,
      story: [],
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
  // Not under Setup or Steps, where a fence is a shell command (#199).
  const text = broken(
    "## Stop and do not merge if\n",
    "## Stop and do not merge if\n\n```text\n## Not a section\n```\n",
  );
  assert.deepEqual(problemsOf(text), []);
});

// ── Broken plans: one defect each ───────────────────────────────────────────

test("something that is not a plan stops at the marker", () => {
  assert.deepEqual(problemsOf("# Notes\n\nNothing here.\n"), [
    "line 1: expected the marker `<!-- qa-plan format=4 subject=#<n> pr=#<n> -->`: this is not a QA Plan",
  ]);
});

test("a format=1 plan with no per-scenario fields still reads; a format=5 plan is refused", () => {
  const old = validatePlan(broken("format=2", "format=1"));
  assert.deepEqual(old.problems, []);
  assert.equal(old.plan.format, 1);
  assert.deepEqual(
    old.plan.scenarios.map((s) => s.surface),
    ["web", "web"],
  );
  assert.deepEqual(problemsOf(broken("format=2", "format=5")), [
    "line 1: format=5: this copy of ANATOMY.md reads format=1, format=2, format=3 and format=4 only",
  ]);
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

// ── Shell commands in Setup and Steps (#199) ────────────────────────────────

/** The 1-based number of the line of `text` that holds `needle`. */
const lineHolding = (text, needle) =>
  text.split("\n").findIndex((line) => line.includes(needle)) + 1;
const SHELL =
  /a plan carries product actions only, and `manual-qa` will not run it|a plan gives product actions, and any data to enter, as prose/;
/** The problems that report a shell command. */
const shellProblems = (text) => problemsOf(text).filter((p) => SHELL.test(p));

test("ANATOMY.md's Setup names every command word the check reads", () => {
  const setup = anatomy.split(/^## /m).find((part) => part.startsWith("Setup\n"));
  for (const word of COMMAND_WORDS)
    assert.ok(setup.includes(`\`${word}\``), `ANATOMY.md's Setup does not name \`${word}\``);
  const copy = /`export`, `node`, `env`, `python` and `sh` also name things in a product/;
  assert.match(setup, copy);
  assert.deepEqual([...COPY_WORDS], ["export", "node", "env", "python", "sh"]);
  const rule = setup.split("also name things in a product")[1].split("\n")[0];
  for (const mark of COMMAND_MARKS)
    assert.ok(
      rule.includes(`\`${mark}\``),
      `ANATOMY.md's copy-word rule does not name \`${mark}\``,
    );
  for (const extension of SCRIPT_EXTENSIONS)
    assert.ok(
      rule.includes(`\`.${extension}\``),
      `ANATOMY.md's copy-word rule does not name \`.${extension}\``,
    );
  for (const start of ["`/`", "`./`", "`../`", "`~/`"])
    assert.ok(rule.includes(start), `ANATOMY.md's copy-word rule does not name ${start}`);
  assert.match(
    setup,
    /Give data to type or paste as prose, in a backticked span, not in a code block/,
  );
});

test("a Setup line holding a backticked shell command fails, with its line number", () => {
  const command = '1. Run `docker exec api python -c "print(settings.INVITES)"`.';
  const text = broken("1. Restore the `admin` account with `accounts.restore`.", command);
  const problems = shellProblems(text);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], new RegExp(`^line ${lineHolding(text, command)}: Setup: `));
  assert.match(problems[0], /`docker`/);
});

test("a Setup line that is itself a command, or a `$ ` prompt, fails", () => {
  for (const line of [
    "- env | grep -c INVITE",
    "$ redis-cli FLUSHALL",
    "1. curl -s localhost/version",
  ]) {
    const text = broken("1. Restore the `admin` account with `accounts.restore`.", line);
    const problems = shellProblems(text);
    assert.equal(problems.length, 1, `${line}\n${problems.join("\n")}`);
    assert.match(problems[0], new RegExp(`^line ${lineHolding(text, line)}: Setup: `));
  }
});

test("a scenario step running a command, in a span or after a `$ ` prompt, fails", () => {
  const span = "  1. Run `redis-cli HGETALL session:1`.";
  const text = broken("  1. Open **Members**.", span);
  const problems = shellProblems(text);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], new RegExp(`^line ${lineHolding(text, span)}: S1: step 1 `));
  assert.match(problems[0], /`redis-cli`/);

  for (const step of [
    "  1. $ psql -c 'select 1'",
    "  1. Type `$ kubectl get pods` into the shell.",
  ]) {
    const prompted = broken("  1. Open `/members` while signed out.", step);
    const found = shellProblems(prompted);
    assert.equal(found.length, 1, `${step}\n${found.join("\n")}`);
    assert.match(found[0], new RegExp(`^line ${lineHolding(prompted, step)}: S2: step 1 `));
  }
});

test("a fenced code block under Setup or Steps fails, once, at its opening fence", () => {
  const setup = broken(
    "1. Restore the `admin` account with `accounts.restore`.",
    "1. Restore the `admin` account with `accounts.restore`.\n\n```\nmake seed\nmake flags\n```",
  );
  const atSetup = shellProblems(setup);
  assert.equal(atSetup.length, 1, atSetup.join("\n"));
  assert.match(
    atSetup[0],
    new RegExp(`^line ${lineHolding(setup, "```")}: Setup: a fenced code block`),
  );

  const steps = broken(
    "  1. Open **Members**.",
    "  1. Open **Members**.\n\n     ```sh\n     whoami\n     ```",
  );
  const atSteps = shellProblems(steps);
  assert.equal(atSteps.length, 1, atSteps.join("\n"));
  assert.match(
    atSteps[0],
    new RegExp(`^line ${lineHolding(steps, "```sh")}: S1: a fenced code block`),
  );
});

test("product labels, copy, paths and role ids in Setup and Steps are not commands", () => {
  assert.deepEqual(shellProblems(GOOD), []);
  const text = broken(
    "  1. Open **Members**.",
    [
      "  1. Click **Save changes**, then open `/version` and `/members/new`.",
      "  2. Pick the role `admin`, then `member`, and type `node-1` into **Name**.",
      "  3. Export the CSV from **Reports**, and check the **Env** badge reads `env: staging`.",
      "     export is the menu's last item, after `Node` and `Python`.",
    ].join("\n"),
  );
  assert.deepEqual(shellProblems(text), []);
});

test("lowercase product copy that starts with a command word is not a command (#214 review)", () => {
  const text = broken(
    "  1. Open **Members**.",
    [
      "  1. Click `export` in the toolbar.",
      "  2. Pick `python` from **Language**, then `python 3.12`, and pick the `node` filter.",
      "  3. Check the toast reads `export started`, and the badge reads `env staging`.",
      "  4. Open `sh` under **Shells**, and `docker` under **Integrations**.",
      "  5. Pick `export to CSV/PDF`, check `env staging/eu` and the footer `node v20.x`.",
      "  6. The toast reads `export started - 3 files`, the badge `env staging - eu`.",
    ].join("\n"),
  );
  assert.deepEqual(shellProblems(text), []);
});

test("a word that is also product copy is a command before a flag, a path, a script file or a shell mark", () => {
  for (const step of [
    "  1. Run `export INVITES_ENABLED=1`.",
    "  1. Run `node scripts/seed.js`.",
    "  1. Run `python manage.py shell`.",
    "  1. Run `env | grep INVITE`.",
    "  1. Run `sh -c whoami`.",
    "  1. Run `kubectl get pods`.",
    "  1. Run `node ./seed`.",
    "  1. Run `python ~/x`.",
    "  1. Run `sh ../go`.",
    "  1. Run `env > out`.",
    "  1. Run `export A; b`.",
    "  1. Run `node x & y`.",
    "  1. Run `python < in`.",
    "  1. Run `node --inspect app`.",
  ]) {
    const text = broken("  1. Open **Members**.", step);
    assert.equal(shellProblems(text).length, 1, `${step}\n${problemsOf(text).join("\n")}`);
  }
});

test("a fenced block message says data goes in prose, not that it is a shell command", () => {
  const text = broken(
    "  1. Open **Members**.",
    '  1. Open **Import** and paste:\n\n     ```json\n     {"name": "Ada"}\n     ```',
  );
  const [problem, ...rest] = shellProblems(text);
  assert.deepEqual(rest, []);
  assert.match(
    problem,
    /S1: a fenced code block; a plan gives product actions, and any data to enter, as prose/,
  );
  assert.doesNotMatch(problem, /shell command/);
});

test("an indented fence line inside an ordinary block neither closes it nor hides Setup", () => {
  const text = broken(
    "## Expected red herrings\n",
    "## Expected red herrings\n\n```markdown\n1. step\n     ```sh\n     whoami\n     ```\n```\n",
  );
  const command = "1. Run `docker compose up -d`.";
  const withSetup = text.replace(
    "1. Restore the `admin` account with `accounts.restore`.",
    command,
  );
  const problems = shellProblems(withSetup);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], new RegExp(`^line ${lineHolding(withSetup, command)}: Setup: a line`));
});

test("a fence left open in an earlier section does not switch the check off for Setup", () => {
  // CommonMark closes this fence (indent counts from the list item); the nested reader may not.
  const text = broken(
    "- The invite endpoint rejects a malformed email, by the `backend` suite `[observed]`.",
    "- The invite endpoint rejects a malformed email, by the `backend` suite `[observed]`:\n\n    ```\n    npm test\n     ```",
  );
  const command = '1. Run `docker exec api python -c "print(1)"`.';
  const withSetup = text.replace(
    "1. Restore the `admin` account with `accounts.restore`.",
    command,
  );
  assert.deepEqual(problemsOf(text), []);
  const problems = shellProblems(withSetup);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(problems[0], new RegExp(`^line ${lineHolding(withSetup, command)}: Setup: a line`));
});

test("an unclosed fence in one scenario's steps is named once, not again in a later one", () => {
  const text = broken("  1. Open **Members**.", "  1. Open **Members**.\n\n     ```\n     whoami");
  const fences = shellProblems(text).filter((p) => /a fenced code block/.test(p));
  assert.equal(fences.length, 1, fences.join("\n"));
  assert.match(fences[0], /^line \d+: S1: /);
});

test("a column-0 line after prose is read as a whole line, so a bare command there fails", () => {
  const setup = "1. Restore the `admin` account with `accounts.restore`.";
  for (const [before, command] of [
    ["1. Seed the database:", "npx prisma db seed"],
    ["### Data", "docker compose up -d"],
    // Accepted false positive: unindented wrapped prose that starts with a command word
    // is reported; the author indents or re-wraps it. The check errs toward reporting.
    ["1. Turn on **Invites** for the team that reads the", "curl examples on the **Docs** page."],
  ]) {
    const text = broken(setup, `${before}\n${command}`);
    const problems = shellProblems(text);
    assert.equal(problems.length, 1, `${command}\n${problems.join("\n")}`);
    assert.match(problems[0], new RegExp(`^line ${lineHolding(text, command)}: Setup: a line`));
  }
  // Indented, the wrap carries on the prose, and only a `$ ` prompt there still counts.
  assert.deepEqual(
    shellProblems(
      broken(setup, "1. Turn on **Invites** for the team that reads the\n   curl examples."),
    ),
    [],
  );
  const prompted = broken(setup, "1. Clear the cache:\n   $ redis-cli FLUSHALL");
  assert.equal(shellProblems(prompted).length, 1, problemsOf(prompted).join("\n"));
});

test("each line of an indented block is read whole, not only its first", () => {
  // A line read whole is no prose for the next indented line to carry on (#215 review).
  const setup = "1. Restore the `admin` account with `accounts.restore`.";
  const command = "        npx prisma db seed";
  const text = broken(setup, `1. Seed the database:\n\n        cd backend\n${command}`);
  const problems = shellProblems(text);
  assert.ok(
    problems.some((p) => p.startsWith(`line ${lineHolding(text, command)}: Setup: a line`)),
    problems.join("\n"),
  );
  const step = "  1. Open **Members**.";
  const inSteps = broken(step, `  1. Seed the database:\n\n       cd backend\n${command}`);
  assert.ok(
    shellProblems(inSteps).some((p) =>
      p.startsWith(`line ${lineHolding(inSteps, command)}: S1: step 1`),
    ),
    shellProblems(inSteps).join("\n"),
  );
});

test("an indented line after a blank line, or at the start of the range, is read whole", () => {
  // #215: only a line directly under non-blank, unfenced prose in the same range continues it.
  const setup = "1. Restore the `admin` account with `accounts.restore`.";
  for (const [before, command] of [
    ["1. Seed the database:", "        npx prisma db seed"],
    ["Bring the stack up before the first scenario.", "    docker compose up -d"],
  ]) {
    const text = broken(setup, `${before}\n\n${command}`);
    const problems = shellProblems(text);
    assert.equal(problems.length, 1, `${command}\n${problems.join("\n")}`);
    assert.match(
      problems[0],
      new RegExp(`^line ${lineHolding(text, command)}: Setup: a line reads as a shell command`),
    );
  }
  const step = "  1. Open **Members**.";
  const command = "     npx prisma db seed";
  const text = broken(step, `  1. Seed the database:\n\n${command}`);
  const problems = shellProblems(text);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.match(
    problems[0],
    new RegExp(`^line ${lineHolding(text, command)}: S1: step 1 reads as a shell command`),
  );
  // Read whole, indented prose that starts with no command word passes.
  assert.deepEqual(
    shellProblems(broken(step, "  1. Open **Members**:\n\n     the list of the team's members.")),
    [],
  );
  // At the start of the range, nothing above it is prose to carry on: under the Setup
  // heading, and under a bare **Steps:** label.
  const atSetup = broken("## Setup\n\n", "## Setup\n    docker compose up -d\n\n");
  const [first, ...more] = shellProblems(atSetup);
  assert.deepEqual(more, []);
  assert.match(
    first,
    new RegExp(`^line ${lineHolding(atSetup, "    docker compose up -d")}: Setup: a line`),
  );
  const underLabel = broken("- **Steps:**\n", "- **Steps:**\n    npx prisma db seed\n");
  const problems2 = shellProblems(underLabel);
  assert.equal(problems2.length, 1, problems2.join("\n"));
  assert.match(
    problems2[0],
    new RegExp(
      `^line ${lineHolding(underLabel, "npx prisma db seed")}: S1: \\*\\*Steps:\\*\\* reads`,
    ),
  );
});

test("a command outside Setup and Steps is not this check's to report", () => {
  const text = broken(
    "- **A failure means:** the dialog does not save an invitation.",
    "- **A failure means:** the dialog does not save an invitation (`docker logs api` shows why).",
  );
  assert.deepEqual(shellProblems(text), []);
});

test("a plan with a shell command in a step exits 1 from `plan`", () => {
  const text = broken("  1. Open **Members**.", "  1. Run `npx prisma db seed`.");
  const result = main(["plan"], { read: () => null, stdin: () => text });
  assert.equal(result.code, 1);
  assert.ok(JSON.parse(result.out).problems.some((p) => SHELL.test(p)));
});

test("a scenario signs in only as a role the Run brief names, or nobody", () => {
  assertProblem(
    broken("- **Signs in as:** `admin`", "- **Signs in as:** `owner`"),
    /S1 signs in as `owner`, which is neither a role the Run brief's \*\*Roles:\*\* names nor a Scenario account/,
  );
});

test("first-word values are read as ANATOMY.md states: marks dropped, nothing else stripped", () => {
  // The three draft lines the #124 pilot wrote, which ANATOMY.md now rules out.
  // A mark stuck to a valid word still fails; the problem says so (#201).
  assertProblem(
    broken("- **Surface:** `web`", "- **Surface:** `web`."),
    /\*\*Surface:\*\* read `web\.`: a `\.` is stuck to the value/,
  );
  assertProblem(
    broken("- **Signs in as:** `admin`", "- **Signs in as:** the new user from S1, then `admin`."),
    /S1 signs in as `the`, which is neither a role the Run brief's \*\*Roles:\*\* names nor a Scenario account an earlier scenario creates/,
  );
  assertProblem(
    broken("- **Signs in as:** `admin`", "- **Signs in as:** `admin`."),
    /S1 signs in as `admin\.`: a `\.` is stuck to the value/,
  );
  assertProblem(
    broken("- **Target:** `stack`", "- **Target:** `stack`."),
    /\*\*Target:\*\* read `stack\.`: a `\.` is stuck to the value/,
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

test("a mark stuck to a first-word value is named, with the fix (#201)", () => {
  const fix = (word) => `write \`${word}\` followed by a space, comma or parenthesis`;
  const surfaceLine = lineOf(GOOD, "- **Surface:**");
  const targetLine = lineOf(GOOD, "- **Target:**");
  const signsLine = lineOf(GOOD, "- **Signs in as:** `admin`");
  for (const [from, to, problem] of [
    [
      "- **Surface:** `web`",
      "- **Surface:** `api`.",
      `line ${surfaceLine}: **Surface:** read \`api.\`: a \`.\` is stuck to the value; ${fix("api")}`,
    ],
    [
      "- **Surface:** `web`",
      "- **Surface:** `api.` in Chrome",
      `line ${surfaceLine}: **Surface:** read \`api.\`: a \`.\` is stuck to the value; ${fix("api")}`,
    ],
    [
      "- **Surface:** `web`",
      "- **Surface:** **web**!",
      `line ${surfaceLine}: **Surface:** read \`web**!\`: a \`!\` is stuck to the value; ${fix("web")}`,
    ],
    [
      "- **Target:** `stack`",
      "- **Target:** `url`?",
      `line ${targetLine}: **Target:** read \`url?\`: a \`?\` is stuck to the value; ${fix("url")}`,
    ],
    [
      "- **Signs in as:** `admin`",
      "- **Signs in as:** admin. Then S1 invites a member",
      `line ${signsLine}: S1 signs in as \`admin.\`: a \`.\` is stuck to the value; ${fix("admin")}`,
    ],
    [
      "- **Signs in as:** `admin`",
      "- **Signs in as:** `nobody`.",
      `line ${signsLine}: S1 signs in as \`nobody.\`: a \`.\` is stuck to the value; ${fix("nobody")}`,
    ],
  ])
    assert.deepEqual(problemsOf(broken(from, to)), [problem], to);
  // A session id gets it too, on the Sessions line.
  const session = withSessions("A = member, B = admin.");
  assert.deepEqual(problemsOf(session), [
    `line ${sessionsLine(session)}: S1's session B signs in as \`admin.\`: a \`.\` is stuck to the value; ${fix("admin")}`,
  ]);
  // A Scenario account id with a mark stuck to it, too.
  const account = withAccount([
    "- **Signs in as:** `temp-user` (created in S1)",
    "- **Signs in as:** `temp-user`.",
  ]);
  assert.deepEqual(problemsOf(account), [
    `line ${lineOf(account, "- **Signs in as:** `temp-user`")}: S2 signs in as \`temp-user.\`: a \`.\` is stuck to the value; ${fix("temp-user")}`,
  ]);
  // A Scenario account the scenario creates itself, or a later one creates, is no fix:
  // without the mark it would still fail, so the problem is today's.
  const neither = (word) =>
    `S1 signs in as \`${word}\`, which is neither a role the Run brief's **Roles:** names nor a Scenario account an earlier scenario creates`;
  const itself = broken(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `temp-user`.\n- **Creates:** `temp-user`\n",
  );
  assert.deepEqual(problemsOf(itself), [
    `line ${lineOf(itself, "- **Signs in as:** `temp-user`")}: ${neither("temp-user.")}`,
  ]);
  const later = broken(
    "- **Signs in as:** nobody\n",
    "- **Signs in as:** nobody\n- **Creates:** `temp-user`\n",
  ).replace("- **Signs in as:** `admin`", "- **Signs in as:** `temp-user`.");
  assert.deepEqual(problemsOf(later), [
    `line ${lineOf(later, "- **Signs in as:** `temp-user`")}: ${neither("temp-user.")}`,
  ]);
  // No valid word under the mark, or no mark: today's message.
  for (const [from, to, problem] of [
    [
      "- **Surface:** `web`",
      "- **Surface:** `browser`",
      "**Surface:** expected one of: web, desktop, mobile, api",
    ],
    [
      "- **Surface:** `web`",
      "- **Surface:** `browser`.",
      "**Surface:** expected one of: web, desktop, mobile, api",
    ],
    ["- **Target:** `stack`", "- **Target:** `stacks`", "**Target:** expected one of: stack, url"],
    [
      "- **Signs in as:** `admin`",
      "- **Signs in as:** `owner`.",
      "S1 signs in as `owner.`, which is neither a role the Run brief's **Roles:** names nor a Scenario account an earlier scenario creates",
    ],
    [
      "- **Signs in as:** `admin`",
      "- **Signs in as:** `admin`..",
      "S1 signs in as `admin..`, which is neither a role the Run brief's **Roles:** names nor a Scenario account an earlier scenario creates",
    ],
  ]) {
    const problems = problemsOf(broken(from, to));
    assert.equal(problems.length, 1, `${to}: ${problems.join("\n")}`);
    assert.ok(problems[0].endsWith(problem), `${to}: got ${problems[0]}`);
  }
  // A comma, semicolon, colon or parenthesis already ends the word (ANATOMY.md, rule 2),
  // so nothing is stuck: these read cleanly, as before.
  for (const to of [
    "- **Target:** `stack`,",
    "- **Target:** `stack,`",
    "- **Target:** `stack`; on a laptop",
    "- **Target:** `stack`)",
  ])
    assert.deepEqual(problemsOf(broken("- **Target:** `stack`", to)), [], to);
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

// ── A Surface per scenario (format=2) ───────────────────────────────────────

/** The 1-based number of the last line starting `start`: a scenario's, past the Run brief's. */
const lastLineOf = (text, start) => text.split("\n").findLastIndex((l) => l.startsWith(start)) + 1;
/** The good plan with S2's **Surface:** line, placed right after **Signs in as:**. */
const withSurface = (line = "- **Surface:** `api`") => broken(S2_SIGNS, `${S2_SIGNS}${line}\n`);

test("a scenario's **Surface:** overrides the Run brief's for that scenario only", () => {
  const { plan, problems } = validatePlan(withSurface());
  assert.deepEqual(problems, []);
  assert.equal(plan.brief.surface, "web");
  assert.deepEqual(
    plan.scenarios.map((s) => [s.id, s.surface]),
    [
      ["S1", "web"],
      ["S2", "api"],
    ],
  );
  // A first-word value: prose may follow it, and `*`, `_` and backticks around it are dropped.
  for (const line of ["- **Surface:** api, its headers are the promise", "- **Surface:** **api**"])
    assert.deepEqual(validatePlan(withSurface(line)).plan.scenarios[1].surface, "api", line);
});

test("a **Surface:** after **Sessions:** or **Creates:** reads too", () => {
  const sessions = withSessions().replace(
    "(each in its own browser)\n",
    "(each in its own browser)\n- **Surface:** `api`\n",
  );
  assert.deepEqual(problemsOf(sessions), []);
  assert.equal(validatePlan(sessions).plan.scenarios[0].surface, "api");
  const creates = broken(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `admin`\n- **Creates:** `temp-user` (chosen in S1)\n- **Surface:** `api`\n",
  );
  assert.deepEqual(problemsOf(creates), []);
  assert.equal(validatePlan(creates).plan.scenarios[0].surface, "api");
});

test("a **Surface:** out of position is a problem naming its line", () => {
  const late = broken(
    "- **A failure means:** the members page is reachable without signing in.",
    "- **A failure means:** the members page is reachable without signing in.\n- **Surface:** `api`",
  );
  assert.deepEqual(problemsOf(late), [
    `line ${lastLineOf(late, "- **Surface:**")}: S2: **Surface:** is out of position: it goes right after **Signs in as:** or **Sessions:** (and **Creates:**, when present), before **Steps:**`,
  ]);
  const early = broken(
    "- **Why only a human can prove it:** the redirect",
    "- **Surface:** `api`\n- **Why only a human can prove it:** the redirect",
  );
  assert.deepEqual(problemsOf(early), [
    `line ${lastLineOf(early, "- **Surface:**")}: S2: **Surface:** is out of position: it goes right after **Signs in as:** or **Sessions:** (and **Creates:**, when present), before **Steps:**`,
  ]);
  // Before **Creates:** is out of position too.
  const beforeCreates = broken(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `admin`\n- **Surface:** `api`\n- **Creates:** `temp-user` (chosen in S1)\n",
  );
  assertProblem(beforeCreates, /S1: \*\*Surface:\*\* is out of position/);
});

test("a **Surface:** outside the four, empty, stuck to a mark or repeated is a problem on its line", () => {
  const tv = withSurface("- **Surface:** `tv`");
  assert.deepEqual(problemsOf(tv), [
    `line ${lastLineOf(tv, "- **Surface:**")}: S2: **Surface:** expected one of: web, desktop, mobile, api`,
  ]);
  const empty = withSurface("- **Surface:**");
  assert.deepEqual(problemsOf(empty), [
    `line ${lastLineOf(empty, "- **Surface:**")}: S2: **Surface:** is empty`,
  ]);
  const stuck = withSurface("- **Surface:** `api`.");
  assert.deepEqual(problemsOf(stuck), [
    `line ${lastLineOf(stuck, "- **Surface:**")}: S2: **Surface:** read \`api.\`: a \`.\` is stuck to the value; write \`api\` followed by a space, comma or parenthesis`,
  ]);
  const twice = withSurface("- **Surface:** `api`\n- **Surface:** `web`");
  assert.deepEqual(problemsOf(twice), [
    `line ${lastLineOf(twice, "- **Surface:** `web`")}: S2: a second **Surface:**: a scenario has at most one`,
  ]);
});

test("a format=1 plan carries no per-scenario **Surface:**", () => {
  const text = withSurface().replace("format=2", "format=1");
  assert.deepEqual(problemsOf(text), [
    `line ${lastLineOf(text, "- **Surface:**")}: S2: **Surface:** is a format=2 field: mark the plan \`format=2\`, or leave the Run brief's **Surface:** to every scenario`,
  ]);
});

test("`plan` prints each scenario's effective surface", () => {
  const result = main(["plan"], { read: () => null, stdin: () => withSurface() });
  assert.equal(result.code, 0);
  assert.deepEqual(
    JSON.parse(result.out).plan.scenarios.map((s) => s.surface),
    ["web", "api"],
  );
});

// ── What a scenario observes (format=2) ─────────────────────────────────────

/** The good plan with S2 on `api`, then its **Observes:** line right after **Surface:**. */
const withObserves = (line = "- **Observes:** headers, httponly-cookies") =>
  withSurface(`- **Surface:** \`api\`\n${line}`);
const OBSERVES_POSITION =
  "**Observes:** is out of position: it goes right after the scenario's **Surface:**, or after **Signs in as:** or **Sessions:** (and **Creates:**, when present) when it has none, before **Steps:**";

test("**Observes:** reads into the scenario's list; a scenario without one observes `[]`", () => {
  const { plan, problems } = validatePlan(withObserves());
  assert.deepEqual(problems, []);
  assert.deepEqual(
    plan.scenarios.map((s) => [s.id, s.observes]),
    [
      ["S1", []],
      ["S2", ["headers", "httponly-cookies"]],
    ],
  );
  // Backticks and `*` or `_` around a value are dropped; prose may follow the list.
  const prose = withObserves("- **Observes:** `headers`, **status** (the `Set-Cookie` line)");
  assert.deepEqual(problemsOf(prose), []);
  assert.deepEqual(validatePlan(prose).plan.scenarios[1].observes, ["headers", "status"]);
  // Every value in the list reads across single-surface sets; mixing api-only and screen is flagged.
  const apiSet = withObserves(
    "- **Observes:** headers, cookies, httponly-cookies, status, body, local-file",
  );
  assert.deepEqual(problemsOf(apiSet), []);
  assert.equal(validatePlan(apiSet).plan.scenarios[1].observes.length, 6);
  const webSet = withSurface("- **Surface:** `web`\n- **Observes:** body, screen, local-file");
  assert.deepEqual(problemsOf(webSet), []);
  assert.equal(validatePlan(webSet).plan.scenarios[1].observes.length, 3);
  const apiStatusBody = withObserves("- **Observes:** status, body");
  assert.deepEqual(problemsOf(apiStatusBody), []);
  const all = withObserves(
    "- **Observes:** headers, cookies, httponly-cookies, status, body, screen, local-file",
  );
  assert.equal(validatePlan(all).plan.scenarios[1].observes.length, 7);
  assertProblem(all, /split it into one scenario per Surface/);
});

test("**Observes:** needing values no single Surface can see is a problem saying to split it (#378)", () => {
  for (const line of [
    "- **Observes:** status, screen",
    "- **Observes:** headers, screen",
    "- **Observes:** httponly-cookies, screen",
  ]) {
    const mixed = withSurface(line);
    const probs = problemsOf(mixed);
    assert.equal(probs.length, 1, line);
    assert.match(probs[0], /S2: \*\*Observes:\*\*/, line);
    assert.match(
      probs[0],
      /no single Surface's drivers can observe all of them; split it into one scenario per Surface/,
      line,
    );
  }
});

test("**Observes:** with a value outside the list is a problem naming it, on its line", () => {
  const html = withObserves("- **Observes:** headers, html");
  assert.deepEqual(problemsOf(html), [
    `line ${lastLineOf(html, "- **Observes:**")}: S2: **Observes:** \`html\`: expected one of: headers, cookies, httponly-cookies, status, body, screen, local-file`,
  ]);
  const stuck = withObserves("- **Observes:** headers.");
  assert.deepEqual(problemsOf(stuck), [
    `line ${lastLineOf(stuck, "- **Observes:**")}: S2: **Observes:** read \`headers.\`: a \`.\` is stuck to the value; write \`headers\` followed by a space, comma or parenthesis`,
  ]);
  const comma = withObserves("- **Observes:** headers,, status");
  assert.deepEqual(problemsOf(comma), [
    `line ${lastLineOf(comma, "- **Observes:**")}: S2: **Observes:** has an empty value: a comma with nothing after it`,
  ]);
  const twice = withObserves("- **Observes:** headers, headers");
  assert.deepEqual(problemsOf(twice), [
    `line ${lastLineOf(twice, "- **Observes:**")}: S2: **Observes:** \`headers\` is named twice`,
  ]);
  const empty = withObserves("- **Observes:**");
  assert.deepEqual(problemsOf(empty), [
    `line ${lastLineOf(empty, "- **Observes:**")}: S2: **Observes:** is empty`,
  ]);
  const prose = withObserves("- **Observes:** (the header)");
  assert.deepEqual(problemsOf(prose), [
    `line ${lastLineOf(prose, "- **Observes:**")}: S2: **Observes:** expected one or more of: headers, cookies, httponly-cookies, status, body, screen, local-file`,
  ]);
  const again = withObserves("- **Observes:** headers\n- **Observes:** body");
  assert.deepEqual(problemsOf(again), [
    `line ${lastLineOf(again, "- **Observes:** body")}: S2: a second **Observes:**: a scenario has at most one`,
  ]);
});

test("**Observes:** with no **Surface:** follows the sign-in field", () => {
  const signs = broken(S2_SIGNS, `${S2_SIGNS}- **Observes:** screen\n`);
  assert.deepEqual(problemsOf(signs), []);
  assert.deepEqual(validatePlan(signs).plan.scenarios[1].observes, ["screen"]);
  const creates = broken(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `admin`\n- **Creates:** `temp-user` (chosen in S1)\n- **Observes:** body\n",
  );
  assert.deepEqual(problemsOf(creates), []);
  const sessions = withSessions().replace(
    "(each in its own browser)\n",
    "(each in its own browser)\n- **Observes:** screen\n",
  );
  assert.deepEqual(problemsOf(sessions), []);
});

test("**Observes:** out of position is a problem naming its line", () => {
  const beforeSurface = withSurface("- **Observes:** headers\n- **Surface:** `api`");
  assert.deepEqual(problemsOf(beforeSurface), [
    `line ${lastLineOf(beforeSurface, "- **Observes:**")}: S2: ${OBSERVES_POSITION}`,
  ]);
  const early = broken(
    "- **Why only a human can prove it:** the redirect",
    "- **Observes:** status\n- **Why only a human can prove it:** the redirect",
  );
  assert.deepEqual(problemsOf(early), [
    `line ${lastLineOf(early, "- **Observes:**")}: S2: ${OBSERVES_POSITION}`,
  ]);
  const late = broken(
    "- **A failure means:** the members page is reachable without signing in.",
    "- **A failure means:** the members page is reachable without signing in.\n- **Observes:** status",
  );
  assert.deepEqual(problemsOf(late), [
    `line ${lastLineOf(late, "- **Observes:**")}: S2: ${OBSERVES_POSITION}`,
  ]);
  const beforeCreates = broken(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `admin`\n- **Observes:** body\n- **Creates:** `temp-user` (chosen in S1)\n",
  );
  assertProblem(beforeCreates, /S1: \*\*Observes:\*\* is out of position/);
});

test("a format=1 plan carries no **Observes:**", () => {
  const text = broken(S2_SIGNS, `${S2_SIGNS}- **Observes:** screen\n`).replace(
    "format=2",
    "format=1",
  );
  assert.deepEqual(problemsOf(text), [
    `line ${lastLineOf(text, "- **Observes:**")}: S2: **Observes:** is a format=2 field: mark the plan \`format=2\`, or leave it out`,
  ]);
});

test("`plan` prints each scenario's **Observes:** list", () => {
  const result = main(["plan"], { read: () => null, stdin: () => withObserves() });
  assert.equal(result.code, 0);
  assert.deepEqual(
    JSON.parse(result.out).plan.scenarios.map((s) => s.observes),
    [[], ["headers", "httponly-cookies"]],
  );
});

// ── What a run captures, and what the merge-base shows (format=3) ───────────

/** The format 3 example plan with one replacement; the replacement must apply. */
function broken3(from, to) {
  assert.ok(GOOD3.includes(from), `good-format-3.md has no ${JSON.stringify(from)}`);
  return GOOD3.replace(from, to);
}
const S1_CAPTURE = "- **Capture:** `screenshot`, of the list after the invite is sent\n";
const S1_BEFORE =
  "- **Expected before:** the dialog closes, and the list does not show `new@example.test`.\n";
const S3_CAPTURE = "- **Capture:** transcript\n";
const CAPTURE_POSITION =
  "**Capture:** is out of position: it goes right after the scenario's **Observes:** or **Surface:**, or after **Signs in as:** or **Sessions:** (and **Creates:**, when present) when it has neither, before **Steps:**";
const BEFORE_POSITION =
  "**Expected before:** is out of position: it goes right after **Expected result:**";

test("a freshly written format 3 plan reads, with each scenario's capture and expected before", () => {
  const { plan, problems } = validatePlan(GOOD3);
  assert.deepEqual(problems, []);
  assert.equal(plan.format, 3);
  assert.deepEqual(
    plan.scenarios.map((s) => [s.id, s.surface, s.capture, s.captureGiven, s.expectedBefore]),
    [
      [
        "S1",
        "web",
        "screenshot",
        true,
        "the dialog closes, and the list does not show `new@example.test`.",
      ],
      ["S2", "web", "screenshot", false, null],
      ["S3", "api", "transcript", true, null],
    ],
  );
  // `capture` reflects the value written: each one its surface allows.
  for (const [value, from, to, at] of [
    ["video", S1_CAPTURE, "- **Capture:** video (two tabs race)\n", 0],
    ["none", S1_CAPTURE, "- **Capture:** **none**\n", 0],
    ["none", S3_CAPTURE, "- **Capture:** `none`\n", 2],
  ]) {
    const text = broken3(from, to);
    assert.deepEqual(problemsOf(text), [], to);
    assert.equal(validatePlan(text).plan.scenarios[at].capture, value, to);
  }
  // Expected before runs on to the next field, as Expected result does.
  const long = broken3(S1_BEFORE, `${S1_BEFORE}  The badge **Invited** is missing.\n`);
  assert.match(validatePlan(long).plan.scenarios[0].expectedBefore, /\n {2}The badge/);
});

test("format 1 and 2 plans read as before: capture defaults by surface, expectedBefore is null", () => {
  for (const format of ["format=1", "format=2"]) {
    const { plan, problems } = validatePlan(broken("format=2", format));
    assert.deepEqual(problems, [], format);
    for (const s of plan.scenarios) {
      assert.equal(s.capture, "screenshot", `${format} ${s.id}`);
      assert.equal(s.captureGiven, false, `${format} ${s.id}`);
      assert.equal(s.expectedBefore, null, `${format} ${s.id}`);
    }
  }
  // On `api`, a missing **Capture:** means `transcript`.
  assert.deepEqual(
    validatePlan(withSurface()).plan.scenarios.map((s) => [s.id, s.capture, s.captureGiven]),
    [
      ["S1", "screenshot", false],
      ["S2", "transcript", false],
    ],
  );
  const api = validatePlan(broken("- **Surface:** `web`", "- **Surface:** `api`"));
  assert.deepEqual(
    api.plan.scenarios.map((s) => s.capture),
    ["transcript", "transcript"],
  );
});

test("**Capture:** or **Expected before:** in a format=1 or format=2 plan is a problem naming the field and format=3", () => {
  for (const format of ["format=1", "format=2"]) {
    const capture = broken(S2_SIGNS, `${S2_SIGNS}- **Capture:** screenshot\n`).replace(
      "format=2",
      format,
    );
    assert.deepEqual(problemsOf(capture), [
      `line ${lastLineOf(capture, "- **Capture:**")}: S2: **Capture:** is a format=3 field: mark the plan \`format=3\`, or leave it out`,
    ]);
    const before = broken(
      "- **Expected result:** the sign-in page, with the heading **Sign in to continue**.\n",
      "- **Expected result:** the sign-in page, with the heading **Sign in to continue**.\n- **Expected before:** the members page opens.\n",
    ).replace("format=2", format);
    assert.deepEqual(problemsOf(before), [
      `line ${lastLineOf(before, "- **Expected before:**")}: S2: **Expected before:** is a format=3 field: mark the plan \`format=3\`, or leave it out`,
    ]);
  }
});

test("**Capture:** that the scenario's surface does not take, or outside the four, is a problem naming the scenario", () => {
  const transcriptOnWeb = broken3(S1_CAPTURE, "- **Capture:** transcript\n");
  assert.deepEqual(problemsOf(transcriptOnWeb), [
    `line ${lineOf(transcriptOnWeb, "- **Capture:** transcript")}: S1: **Capture:** \`transcript\` is for an \`api\` scenario, and this one drives \`web\`: use \`screenshot\`, \`video\` or \`none\``,
  ]);
  for (const value of ["video", "screenshot"]) {
    const onApi = broken3(S3_CAPTURE, `- **Capture:** ${value}\n`);
    assert.deepEqual(problemsOf(onApi), [
      `line ${lastLineOf(onApi, `- **Capture:** ${value}`)}: S3: **Capture:** \`${value}\` is for a scenario with a screen, and this one drives \`api\`: use \`transcript\` or \`none\``,
    ]);
  }
  // The effective surface decides: S3's own `api`, not the Run brief's `web`.
  const own = broken3("- **Surface:** `api`\n", "");
  assert.deepEqual(problemsOf(own), [
    `line ${lastLineOf(own, "- **Capture:** transcript")}: S3: **Capture:** \`transcript\` is for an \`api\` scenario, and this one drives \`web\`: use \`screenshot\`, \`video\` or \`none\``,
  ]);
  const gif = broken3(S1_CAPTURE, "- **Capture:** gif\n");
  assert.deepEqual(problemsOf(gif), [
    `line ${lineOf(gif, "- **Capture:**")}: S1: **Capture:** \`gif\`: expected one of: screenshot, video, transcript, none`,
  ]);
  const stuck = broken3(S1_CAPTURE, "- **Capture:** video.\n");
  assert.deepEqual(problemsOf(stuck), [
    `line ${lineOf(stuck, "- **Capture:**")}: S1: **Capture:** read \`video.\`: a \`.\` is stuck to the value; write \`video\` followed by a space, comma or parenthesis`,
  ]);
  const empty = broken3(S1_CAPTURE, "- **Capture:**\n");
  assert.deepEqual(problemsOf(empty), [
    `line ${lineOf(empty, "- **Capture:**")}: S1: **Capture:** is empty`,
  ]);
});

test("**Capture:** is not judged against a surface whose own **Surface:** was refused", () => {
  // The writer meant `api`: only the stuck mark is reported, not the Capture too.
  const stuck = broken3("- **Surface:** `api`\n", "- **Surface:** api.\n");
  assert.deepEqual(problemsOf(stuck), [
    `line ${lastLineOf(stuck, "- **Surface:**")}: S3: **Surface:** read \`api.\`: a \`.\` is stuck to the value; write \`api\` followed by a space, comma or parenthesis`,
  ]);
  const unknown = broken3("- **Surface:** `api`\n", "- **Surface:** tv\n");
  assert.deepEqual(problemsOf(unknown), [
    `line ${lastLineOf(unknown, "- **Surface:**")}: S3: **Surface:** expected one of: web, desktop, mobile, api`,
  ]);
});

test("**Capture:** with its value on the next line names the set, not an empty value", () => {
  const next = broken3(S1_CAPTURE, "- **Capture:**\n  screenshot\n");
  assert.deepEqual(problemsOf(next), [
    `line ${lineOf(next, "- **Capture:**")}: S1: **Capture:** expected one of: screenshot, video, transcript, none, first on its line`,
  ]);
});

test("a repeated **Capture:** or **Expected before:** is a problem naming the scenario", () => {
  const capture = broken3(S1_CAPTURE, `${S1_CAPTURE}- **Capture:** none\n`);
  assert.deepEqual(problemsOf(capture), [
    `line ${lineOf(capture, "- **Capture:** none")}: S1: a second **Capture:**: a scenario has at most one`,
  ]);
  const before = broken3(S1_BEFORE, `${S1_BEFORE}- **Expected before:** nothing happens.\n`);
  assert.deepEqual(problemsOf(before), [
    `line ${lineOf(before, "- **Expected before:** nothing")}: S1: a second **Expected before:**: a scenario has at most one`,
  ]);
});

test("**Capture:** out of position is a problem naming the scenario", () => {
  const beforeObserves = broken3(
    "- **Observes:** status, body\n- **Capture:** transcript\n",
    "- **Capture:** transcript\n- **Observes:** status, body\n",
  );
  assert.deepEqual(problemsOf(beforeObserves), [
    `line ${lastLineOf(beforeObserves, "- **Capture:** transcript")}: S3: ${CAPTURE_POSITION}`,
  ]);
  const beforeSurface = broken3(
    "- **Surface:** `api`\n- **Observes:** status, body\n- **Capture:** transcript\n",
    "- **Capture:** transcript\n- **Surface:** `api`\n- **Observes:** status, body\n",
  );
  assertProblem(beforeSurface, /S3: \*\*Capture:\*\* is out of position/);
  const beforeSignIn = broken3(
    "- **Signs in as:** `admin`\n- **Capture:**",
    "- **Capture:**",
  ).replace(S1_CAPTURE, `${S1_CAPTURE}- **Signs in as:** \`admin\`\n`);
  assertProblem(beforeSignIn, /S1: \*\*Capture:\*\* is out of position/);
  const late = broken3(S1_CAPTURE, "").replace(S1_BEFORE, `${S1_BEFORE}${S1_CAPTURE}`);
  assert.deepEqual(problemsOf(late), [
    `line ${lineOf(late, "- **Capture:**")}: S1: ${CAPTURE_POSITION}`,
  ]);
  // With no **Observes:** or **Surface:**, right after the sign-in field reads.
  const signs = broken(S2_SIGNS, `${S2_SIGNS}- **Capture:** none\n`).replace(
    "format=2",
    "format=3",
  );
  assert.deepEqual(problemsOf(signs), []);
  assert.equal(validatePlan(signs).plan.scenarios[1].capture, "none");
  const sessions = withSessions()
    .replace("format=2", "format=3")
    .replace("(each in its own browser)\n", "(each in its own browser)\n- **Capture:** video\n");
  assert.deepEqual(problemsOf(sessions), []);
  assert.equal(validatePlan(sessions).plan.scenarios[0].capture, "video");
});

test("**Expected before:** that follows anything other than **Expected result:** is a problem", () => {
  const afterFailure = broken3(S1_BEFORE, "").replace(
    "- **A failure means:** the dialog does not save an invitation.\n",
    `- **A failure means:** the dialog does not save an invitation.\n${S1_BEFORE}`,
  );
  assert.deepEqual(problemsOf(afterFailure), [
    `line ${lineOf(afterFailure, "- **Expected before:**")}: S1: ${BEFORE_POSITION}`,
  ]);
  const beforeResult = broken3(S1_BEFORE, "").replace(
    "- **Expected result:** the list shows",
    `${S1_BEFORE}- **Expected result:** the list shows`,
  );
  assert.deepEqual(problemsOf(beforeResult), [
    `line ${lineOf(beforeResult, "- **Expected before:**")}: S1: ${BEFORE_POSITION}`,
  ]);
  const afterRuleOut = broken3(S1_BEFORE, "").replace(
    "  - `docs/agents/qa-hazards/auth.md`: a session cookie left over from an earlier run.\n",
    `  - \`docs/agents/qa-hazards/auth.md\`: a session cookie left over from an earlier run.\n${S1_BEFORE}`,
  );
  assertProblem(afterRuleOut, /S1: \*\*Expected before:\*\* is out of position/);
  const empty = broken3(S1_BEFORE, "- **Expected before:**\n");
  assert.deepEqual(problemsOf(empty), [
    `line ${lineOf(empty, "- **Expected before:**")}: S1: **Expected before:** is empty`,
  ]);
});

test("`plan` prints each scenario's capture, whether the plan gave it, and expected before", () => {
  const result = main(["plan"], { read: () => null, stdin: () => GOOD3 });
  assert.equal(result.code, 0);
  assert.deepEqual(
    JSON.parse(result.out).plan.scenarios.map((s) => [s.capture, s.captureGiven, s.expectedBefore]),
    [
      ["screenshot", true, "the dialog closes, and the list does not show `new@example.test`."],
      ["screenshot", false, null],
      ["transcript", true, null],
    ],
  );
});

// ── Review boxes (#205) ─────────────────────────────────────────────────────

const REVIEW = "- [ ] Review: docs/x.html says the token lasts 30 days";
/** The good plan with a `Review:` box added to its Sign-off checklist. */
const withReview = (box = REVIEW) =>
  broken(
    "- [ ] Setup 1: the `admin` account was restored",
    `- [ ] Setup 1: the \`admin\` account was restored\n${box}`,
  );
/** The good plan with no scenarios: its Scenarios says `None.`, and its checklist holds `boxes`. */
const reviewOnly = (...boxes) =>
  GOOD.replace(/(## Scenarios\n\n)[\s\S]*?(?=## Sign-off checklist)/, "$1None.\n\n").replace(
    /(## Sign-off checklist\n\n)[\s\S]*?(?=\n## Stop)/,
    `$1${boxes.join("\n")}\n`,
  );

test("a `Review:` box reads, and is in the parsed plan's review list", () => {
  const { plan, problems } = validatePlan(withReview());
  assert.deepEqual(problems, []);
  assert.deepEqual(plan.reviews, [
    { text: "docs/x.html says the token lasts 30 days", ticked: false, place: null },
  ]);
  assert.deepEqual(validatePlan(GOOD).plan.reviews, []);
  const ticked = validatePlan(withReview("* [x] Review: README.md names the new flag")).plan;
  assert.deepEqual(ticked.reviews, [
    { text: "README.md names the new flag", ticked: true, place: null },
  ]);
});

test("a `Review:` box says what to read, and what it must say", () => {
  assertProblem(withReview("- [ ] Review:"), /a `Review:` box with nothing after it/);
  assertProblem(withReview("- [ ] Review:   "), /a `Review:` box with nothing after it/);
});

test("a box that misspells `Review:` is reported, not read as an ordinary box", () => {
  for (const box of [
    "- [ ] review: docs/x.html says 30 days",
    "- [ ] **Review:** docs/x.html says 30 days",
    "- [ ] Review : docs/x.html says 30 days",
    "- [x] _review_: docs/x.html says 30 days",
    "- [ ] Review:docs/x.html says 30 days",
  ])
    assertProblem(
      withReview(box),
      /write it `- \[ \] Review: <what to read, and what it must say>`/,
    );
  // A box that only starts with the word, with no colon after it, is prose.
  assert.deepEqual(problemsOf(withReview("- [ ] Reviewer notes are in the PR")), []);
});

test("a `Review:` box is no scenario's box, so a scenario without its own is still a problem", () => {
  const text = broken(
    "- [ ] S2: A signed-out visitor cannot open the members page",
    "- [ ] Review: S2 docs/members.md says signed-out visitors are sent to sign in",
  );
  assertProblem(text, /no `- \[ \] S2: …` box for S2/);
  assert.deepEqual(validatePlan(text).plan.reviews, [
    {
      text: "S2 docs/members.md says signed-out visitors are sent to sign in",
      ticked: false,
      place: null,
    },
  ]);
});

test("a plan whose Residue is only review boxes is still a plan", () => {
  const { plan, problems } = validatePlan(reviewOnly(REVIEW));
  assert.deepEqual(problems, []);
  assert.deepEqual(plan.scenarios, []);
  assert.equal(plan.reviews.length, 1);
  // With neither a scenario nor a review box, the Residue is empty: no plan.
  assertProblem(
    reviewOnly("- [ ] Setup 1: the `admin` account was restored"),
    /no `### S1: …` scenario and no `Review:` box/,
  );
  // With a review box, a Scenarios that is not exactly `None.` is named as such.
  for (const none of ["None", "_None._"])
    assertProblem(
      reviewOnly(REVIEW).replace("## Scenarios\n\nNone.", `## Scenarios\n\n${none}`),
      /with only `Review:` boxes, `## Scenarios` says exactly `None\.`/,
    );
  // Prose in Scenarios is not `None.`: a scenario that lost its heading is still caught.
  assertProblem(
    reviewOnly(REVIEW).replace("## Scenarios\n\nNone.", "## Scenarios\n\nThe invite dialog."),
    /no `### S1: …` scenario/,
  );
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

// ── A Story, one sentence per Scene (format=4) ──────────────────────────────

const GOOD4 = readFileSync(new URL("fixtures/plans/good-format-4.md", import.meta.url), "utf8");
/** The format 4 example plan with one replacement; the replacement must apply. */
function broken4(from, to) {
  assert.ok(GOOD4.includes(from), `good-format-4.md has no ${JSON.stringify(from)}`);
  return GOOD4.replace(from, to);
}
const problems4 = (text) => validatePlan(text).problems;
/** The 1-based numbers of the lines of `text` that start with `start`, in order. */
const linesOf4 = (text, start) =>
  text.split("\n").flatMap((line, n) => (line.startsWith(start) ? [n + 1] : []));
/** The first of them: S2's line, for a field S2 and S4 both carry. */
const firstLineOf4 = (text, start) => linesOf4(text, start)[0];
/** The last of them: S4's line. */
const lastLineOf4 = (text, start) => linesOf4(text, start).at(-1);
const S2_STORY =
  "- **Story:**\n  1. A signed-out visitor opens the members page and is sent to sign in.\n";
const S4_LAST = "  3. The member reloads **Members** and lands on the sign-in page.\n";
const STORY_POSITION =
  "**Story:** is out of position: it goes right after the scenario's **Capture:**, or wherever **Capture:** would sit when it has none, before **Steps:**";

test("the composer writes format=4, and the reader takes formats 1 to 4", () => {
  assert.equal(FORMAT, 4);
  assert.deepEqual([...FORMATS], [1, 2, 3, 4]);
  assert.deepEqual(problems4(GOOD4.replace("format=4", "format=5")), [
    "line 1: format=5: this copy of ANATOMY.md reads format=1, format=2, format=3 and format=4 only",
  ]);
});

test("a format=4 plan whose Stories match their Scenes reads, with each scenario's story", () => {
  const { plan, problems } = validatePlan(GOOD4);
  assert.deepEqual(problems, []);
  assert.equal(plan.format, 4);
  assert.deepEqual(
    plan.scenarios.map((s) => [s.id, s.capture, s.story]),
    [
      ["S1", "screenshot", []],
      ["S2", "video", ["A signed-out visitor opens the members page and is sent to sign in."]],
      ["S3", "transcript", []],
      [
        "S4",
        "video",
        [
          "The member signs in and opens Members.",
          "The admin signs in, removes the member, and sees the list without them.",
          "The member reloads Members and lands on the sign-in page.",
        ],
      ],
    ],
  );
});

test("a Story sentence reads as plain text: paired inline Markdown is stripped, snake_case and a lone * stay", () => {
  const story = (sentence) =>
    validatePlan(broken4(S2_STORY, `- **Story:**\n  1. ${sentence}\n`)).plan.scenarios[1].story;
  assert.deepEqual(story("The member signs in and opens **Members**."), [
    "The member signs in and opens Members.",
  ]);
  assert.deepEqual(
    story(
      "A __visitor__ opens *the* _members_ page at `/members` and reads [the guide](https://example.test/guide).",
    ),
    ["A visitor opens the members page at /members and reads the guide."],
  );
  assert.deepEqual(story("The member_id field shows 5 * 3 and a_b."), [
    "The member_id field shows 5 * 3 and a_b.",
  ]);
  assert.deepEqual(story("The `__init__` file and `*.md` glob read as written."), [
    "The __init__ file and *.md glob read as written.",
  ]);
  assert.deepEqual(story("It opens [the guide](https://example.test/a_(b)) now."), [
    "It opens the guide now.",
  ]);
});

test("a single-session scenario is one Scene: a one-sentence Story reads, a second sentence is refused", () => {
  assert.deepEqual(problems4(GOOD4), []);
  const two = broken4(S2_STORY, `${S2_STORY}  2. The sign-in page asks for an email.\n`);
  assert.deepEqual(problems4(two), [
    `line ${firstLineOf4(two, "- **Story:**")}: S2: **Story:** has 2 sentences, and its steps make 1 Scene: write one sentence per Scene, in order`,
  ]);
});

test("each change of `In session <name>,` starts a Scene; a Story of another count is refused, naming both counts", () => {
  // S4's steps run A, B, B, A, A: three Scenes.
  const short = broken4(S4_LAST, "");
  assert.deepEqual(problems4(short), [
    `line ${lastLineOf4(short, "- **Story:**")}: S4: **Story:** has 2 sentences, and its steps make 3 Scenes: write one sentence per Scene, in order`,
  ]);
  const long = broken4(S4_LAST, `${S4_LAST}  4. The admin sees the member gone.\n`);
  assert.deepEqual(problems4(long), [
    `line ${lastLineOf4(long, "- **Story:**")}: S4: **Story:** has 4 sentences, and its steps make 3 Scenes: write one sentence per Scene, in order`,
  ]);
  // The same steps with one Cut fewer make two Scenes.
  const merged = broken4("  1. In session A, open **Members**.\n", "");
  assert.deepEqual(problems4(merged), [
    `line ${lastLineOf4(merged, "- **Story:**")}: S4: **Story:** has 3 sentences, and its steps make 2 Scenes: write one sentence per Scene, in order`,
  ]);
  // A sentence's own nested list is prose, not another sentence.
  const nested = broken4(S4_LAST, `${S4_LAST}     - the page reads **Sign in to continue**\n`);
  assert.deepEqual(problems4(nested), []);
});

test("a `Capture: video` scenario with no Story is refused at format=4", () => {
  const text = broken4(S2_STORY, "");
  assert.deepEqual(problems4(text), [
    `line ${firstLineOf4(text, "- **Capture:** `video`")}: S2: **Capture:** \`video\` needs a **Story:**, one sentence per Scene, in order, so each Scene of the video opens on its Title card`,
  ]);
});

test("an older plan's `Capture: video` scenario still reads with no Story", () => {
  const text = GOOD4.replace("format=4", "format=3").replace(S2_STORY, "");
  const s4 = text.slice(text.indexOf("### S4"));
  const story = s4.slice(s4.indexOf("- **Story:**"), s4.indexOf("- **Steps:**"));
  const { plan, problems } = validatePlan(text.replace(story, ""));
  assert.deepEqual(problems, []);
  assert.deepEqual(
    plan.scenarios.map((s) => [s.id, s.capture, s.story]),
    [
      ["S1", "screenshot", []],
      ["S2", "video", []],
      ["S3", "transcript", []],
      ["S4", "video", []],
    ],
  );
});

test("a Story in a format=3 or older plan is refused, naming the field and format=4", () => {
  const text = GOOD4.replace("format=4", "format=3");
  const stories = linesOf4(text, "- **Story:**");
  assert.deepEqual(problems4(text), [
    `line ${stories[0]}: S2: **Story:** is a format=4 field: mark the plan \`format=4\`, or leave it out`,
    `line ${stories[1]}: S4: **Story:** is a format=4 field: mark the plan \`format=4\`, or leave it out`,
  ]);
  for (const format of ["format=1", "format=2"])
    assert.ok(
      problems4(GOOD4.replace("format=4", format)).includes(
        `line ${stories[0]}: S2: **Story:** is a format=4 field: mark the plan \`format=4\`, or leave it out`,
      ),
      format,
    );
});

test("a Story sits right after Capture, before Steps, once, as a numbered list", () => {
  // Before **Capture:**.
  const early = broken4(
    `- **Capture:** \`video\`\n${S2_STORY}`,
    `${S2_STORY}- **Capture:** \`video\`\n`,
  );
  assert.deepEqual(problems4(early), [
    `line ${firstLineOf4(early, "- **Story:**")}: S2: ${STORY_POSITION}`,
  ]);
  // After **Steps:**.
  const late = broken4(
    `${S2_STORY}- **Steps:**\n  1. Open \`/members\` while signed out.\n`,
    `- **Steps:**\n  1. Open \`/members\` while signed out.\n${S2_STORY}`,
  );
  assert.deepEqual(problems4(late), [
    `line ${firstLineOf4(late, "- **Story:**")}: S2: ${STORY_POSITION}`,
  ]);
  // With no **Capture:**, right after the sign-in field.
  const s1 = broken4(
    "- **Capture:** `screenshot`, of the list after the invite is sent\n",
    "- **Story:**\n  1. The admin signs in and invites a new member.\n",
  );
  assert.deepEqual(problems4(s1), []);
  // Twice.
  const twice = broken4(S2_STORY, `${S2_STORY}${S2_STORY}`);
  assert.ok(
    problems4(twice).includes(
      `line ${linesOf4(twice, "- **Story:**")[1]}: S2: a second **Story:**: a scenario has at most one`,
    ),
    problems4(twice).join("\n"),
  );
  // Inline prose, or nothing, in place of a numbered list.
  for (const story of [
    "- **Story:** A signed-out visitor is sent to sign in.\n",
    "- **Story:**\n",
    "- **Story:**\n  - A signed-out visitor is sent to sign in.\n",
  ]) {
    const text = broken4(S2_STORY, story);
    assert.deepEqual(
      problems4(text),
      [
        `line ${firstLineOf4(text, "- **Story:**")}: S2: **Story:** expected a numbered list, one sentence per Scene, in order`,
      ],
      story,
    );
  }
});

// --- Places on a `Review:` box (#416, ADR 0033) ---

const PLACES = [
  { name: "local", holds: true },
  { name: "staging", holds: false },
  { name: "production", holds: false },
];
const placeProblems = (box, places) =>
  validatePlan(withReview(box), { places }).problems.join("\n");

test("a `Review:` box may lead with a Place, which the parsed plan keeps beside the whole text", () => {
  const { plan, problems } = validatePlan(
    withReview("- [ ] Review: [local] docs/x.html says 30 days"),
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(plan.reviews, [
    { text: "[local] docs/x.html says 30 days", ticked: false, place: "local" },
  ]);
});

test("with the configured Places, a `Review:` box that names a Place names one of them", () => {
  assert.equal(placeProblems("- [ ] Review: [staging] docs/x.html says 30 days", PLACES), "");
  // A box with no Place, from a plan made before Places, still runs: it is read as the first Place that holds.
  assert.equal(placeProblems("- [ ] Review: docs/x.html says 30 days", PLACES), "");
  assert.equal(
    validatePlan(withReview("- [ ] Review: docs/x.html says 30 days"), { places: PLACES }).plan
      .reviews[0].place,
    null,
  );
  assert.match(
    placeProblems("- [ ] Review: [prod] docs/x.html says 30 days", PLACES),
    /Place `prod` is not configured \(local, staging, production\)/,
  );
  assert.match(
    placeProblems("- [ ] Review: [Local] docs/x.html says 30 days", PLACES),
    /Place `Local` is not configured/,
  );
  assert.match(placeProblems("- [ ] Review: [local]", PLACES), /nothing after it/);
});

test("with Places turned off, a `Review:` box carries no Place", () => {
  assert.equal(placeProblems("- [ ] Review: docs/x.html says 30 days", null), "");
  assert.match(
    placeProblems("- [ ] Review: [local] docs/x.html says 30 days", null),
    /Places are off: write the box with no Place/,
  );
});

test("with Places off, a `Review:` box whose text starts with a bracket is text, not a Place", () => {
  assert.equal(placeProblems("- [ ] Review: [WIP] docs/x.html says 30 days", null), "");
  assert.equal(placeProblems("- [ ] Review: [the docs](docs/x.html) say 30 days", null), "");
});

test("a plan checked with no Places given reads any tag as a Place and demands none", () => {
  assert.deepEqual(problemsOf(withReview("- [ ] Review: docs/x.html says 30 days")), []);
  assert.deepEqual(problemsOf(withReview("- [ ] Review: [anywhere] docs/x.html says 30 days")), []);
});

test("`adapter.mjs plan` checks a box's Place against the repository's config", () => {
  const plan = withReview("- [ ] Review: [prod] docs/x.html says 30 days");
  const run = (config) =>
    main(["plan"], {
      stdin: () => plan,
      read: (path) => (path === "qa.config.yml" ? config : null),
    });
  assert.equal(run("report:\n  places: [local, prod]\n  holds: [local]\n").code, 0);
  assert.match(run("report:\n  places: none\n").out, /Places are off/);
  assert.match(run(null).out, /Place `prod` is not configured \(local, staging, production\)/);
});

// ── Which service a scenario tests (format=2, #418) ─────────────────────────

const withService = (line = "- **Service:** `billing`", { after: anchor = S2_SIGNS } = {}) =>
  broken(anchor, `${anchor}${line}\n`);

test("a scenario with **Service:** validates and `plan` prints it; one without prints null", () => {
  assert.deepEqual(problemsOf(withService()), []);
  const result = main(["plan"], { read: () => null, stdin: () => withService() });
  assert.equal(result.code, 0);
  assert.deepEqual(
    JSON.parse(result.out).plan.scenarios.map((s) => s.service),
    [null, "billing"],
  );
});

test("**Service:** sits after **Surface:** and before **Observes:**", () => {
  const ok = broken(
    S2_SIGNS,
    `${S2_SIGNS}- **Surface:** api\n- **Service:** billing\n- **Observes:** status\n`,
  );
  assert.deepEqual(problemsOf(ok), []);
  const before = broken(S2_SIGNS, `${S2_SIGNS}- **Service:** billing\n- **Surface:** api\n`);
  assertProblem(before, /S2: \*\*Service:\*\* is out of position/);
  const afterObserves = broken(
    S2_SIGNS,
    `${S2_SIGNS}- **Observes:** status\n- **Service:** billing\n`,
  );
  // The later field is the one out of position: **Observes:** goes after **Service:**.
  assertProblem(afterObserves, /S2: \*\*Observes:\*\* is out of position/);
});

test("**Service:** is read as a first-word name; an empty, repeated or malformed one is a problem", () => {
  assertProblem(withService("- **Service:**"), /S2: \*\*Service:\*\* is empty/);
  assertProblem(
    withService("- **Service:** billing\n- **Service:** auth"),
    /S2: a second \*\*Service:\*\*: a scenario has at most one/,
  );
  assertProblem(
    withService("- **Service:** `@billing`"),
    /S2: \*\*Service:\*\* expected a service name: letters, digits, `_` and `-`/,
  );
  assert.deepEqual(problemsOf(withService("- **Service:** **billing**, the billing API")), []);
});

test("a format=1 plan carries no **Service:**", () => {
  const text = withService().replace("format=2", "format=1");
  assertProblem(
    text,
    /S2: \*\*Service:\*\* is a format=2 field: mark the plan `format=2`, or leave it out/,
  );
});
