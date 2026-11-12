/**
 * Contract suite for `manual-qa`'s half of the config and its host rule:
 * every `run:` shape outside ADAPTER.md is a named problem with its line, the
 * readiness check names exactly what a run still needs, a problem in one
 * skill's section never stops the other, and the host rule: a `stack` run
 * signs in only to a local development host, a `url` run also to a labelled
 * test host the QA person confirmed in chat, and nothing that looks like
 * production.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  hostVerdict,
  main,
  parseConfig,
  readQaConfig,
  runReadiness,
  validatePlan,
} from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOOD_PLAN = readFileSync(join(HERE, "fixtures", "plans", "good.md"), "utf8");
const yaml = (...lines) => parseConfig("qa.config.yml", lines.join("\n"));
const reader = (files) => (path) => (Object.hasOwn(files, path) ? files[path] : null);

/** A complete `run:` section for a local QA Stack. */
const STACK_RUN = [
  "run:",
  "  target: stack",
  "  surface: web",
  "  stack:",
  '    up: "docker compose up -d"',
  '    migrate: "npm run migrate"',
  '    seed: "npm run seed:qa"',
  '    down: "docker compose down"',
  "  accounts:",
  '    print: "npm run seed:qa -- --print"',
  '    restore: "npm run seed:qa -- --restore --account {id}"',
  "    roles:",
  "      - id: admin",
  '        purpose: "manages members"',
  "      - id: member",
  '        purpose: "an ordinary member"',
  "  version_endpoint: /version",
  "  evidence: { upload: none }",
];

// ── `run:` shapes ───────────────────────────────────────────────────────────

test("a complete `run:` section reads with no problems in either skill", () => {
  const read = yaml(...STACK_RUN);
  assert.deepEqual(read.problems, []);
  assert.deepEqual(read.runProblems, []);
  assert.equal(read.config.run.accounts.roles[1].id, "member");
});

test("the spec's flow-style `run:` example reads with no problems", () => {
  const read = yaml(
    "run:",
    "  target: stack",
    "  surface: web",
    '  stack: { up: "...", migrate: "...", seed: "...", down: "..." }',
    "  accounts:",
    '    print: "..."',
    '    restore: "... --restore --account {id}"',
    '    roles: [{ id: admin, purpose: "..." }, { id: user, purpose: "..." }]',
    "  version_endpoint: /version",
    "  evidence: { upload: none }",
  );
  assert.deepEqual(read.runProblems, []);
});

test("each `run:` problem is named with its line", () => {
  const read = yaml(
    "run:",
    "  target: local",
    "  surface: tv",
    "  stack: { up: docker, start: now }",
    "  accounts:",
    '    print: ""',
    "    restore: reset-everything",
    "    roles:",
    '      - { id: "bad id", purpose: x }',
    "      - { id: admin }",
    "      - { id: admin, purpose: again }",
    "  version_endpoint: https://prod.example.com/version",
    "  evidence: { upload: s3 }",
    "  colour: blue",
  );
  assert.deepEqual(read.runProblems, [
    "line 14: `run.colour`: unknown key (ADAPTER.md documents: target, surface, stack, accounts, version_endpoint, evidence)",
    "line 2: `run.target`: expected one of: stack, url",
    "line 3: `run.surface`: expected one of: web, desktop, mobile, api",
    "line 4: `run.stack.start`: unknown key (ADAPTER.md documents: up, migrate, seed, down)",
    "line 6: `run.accounts.print`: expected a command",
    "line 7: `run.accounts.restore`: expected `{id}` where the role id goes",
    "line 9: `run.accounts.roles[0].id`: required: letters, digits, `_` and `-` only",
    "line 10: `run.accounts.roles[1].purpose`: required: expected a string",
    "line 11: `run.accounts.roles[2].id`: duplicate role `admin`",
    "line 12: `run.version_endpoint`: expected a path on the build's own host, such as `/version`",
    "line 13: `run.evidence.upload`: expected `none` or `gh-release:<tag>`",
  ]);
});

test("wrong shapes for `run:` and its mappings are problems", () => {
  assert.deepEqual(yaml("run: stack").runProblems, ["line 1: `run`: expected a mapping"]);
  assert.deepEqual(yaml("run:", "  stack: up", "  accounts: [a]", "  evidence: none").runProblems, [
    "line 2: `run.stack`: expected a mapping of `up`, `migrate`, `seed`, `down`",
    "line 3: `run.accounts`: expected a mapping of `print`, `restore`, `roles`",
    "line 4: `run.evidence`: expected a mapping, such as `{ upload: none }`",
  ]);
  assert.deepEqual(yaml("run:", "  accounts:", "    roles: admin").runProblems, [
    "line 3: `run.accounts.roles`: expected a list of `{ id: <role>, purpose: <what it is for> }`",
  ]);
});

test("`gh-release:<tag>` is a valid upload target", () => {
  assert.deepEqual(yaml("run:", "  evidence: { upload: gh-release:qa-evidence }").runProblems, []);
});

test("JSON `run:` problems carry their key path", () => {
  const read = parseConfig("qa.config.json", JSON.stringify({ run: { target: "prod" } }));
  assert.deepEqual(read.runProblems, ["`run.target`: expected one of: stack, url"]);
});

test("a problem in one skill's section never stops the other", () => {
  const badRun = yaml("plan:", "  base_ref: origin/main", "run:", "  target: prod");
  assert.deepEqual(badRun.problems, []);
  assert.equal(badRun.runProblems.length, 1);
  const badPlan = yaml("plan:", "  tracker: jira", "run:", "  target: stack");
  assert.equal(badPlan.problems.length, 1);
  assert.deepEqual(badPlan.runProblems, []);
});

test("a problem both skills read stops both: syntax, unknown top-level keys, working_dir", () => {
  for (const lines of [["\tworking_dir: x"], ["nope: 1"], ["working_dir: /etc"]]) {
    const read = yaml(...lines);
    assert.equal(read.problems.length, 1, lines[0]);
    assert.deepEqual(read.runProblems, read.problems, lines[0]);
  }
});

// ── Readiness ───────────────────────────────────────────────────────────────

test("readiness with no config names target, surface, roles", () => {
  const readiness = runReadiness(readQaConfig(reader({})));
  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.needs.map((n) => n.split(":")[0]),
    ["run.target", "run.surface", "run.accounts.roles"],
  );
});

test("a `stack` target also needs the four stack commands and `accounts.print`", () => {
  const readiness = runReadiness(
    readQaConfig(reader({ "qa.config.yml": "run:\n  target: stack\n  stack: { up: go }\n" })),
  );
  assert.deepEqual(
    readiness.needs.map((n) => n.split(":")[0]),
    [
      "run.surface",
      "run.accounts.roles",
      "run.stack.migrate",
      "run.stack.seed",
      "run.stack.down",
      "run.accounts.print",
    ],
  );
});

test("a `url` target starts nothing: no stack commands or `accounts.print` are needed", () => {
  const roles = "    roles: [{ id: admin, purpose: x }]";
  const read = (...lines) =>
    runReadiness(readQaConfig(reader({ "qa.config.yml": lines.join("\n") })));
  const bare = read("run:", "  target: url", "  surface: web", "  accounts:", roles);
  assert.equal(bare.ready, true);
  assert.deepEqual(bare.needs, []);
  assert.ok(bare.notes.some((n) => /QA person types each role's test values into chat/.test(n)));
  const seeded = read(
    "run:",
    "  target: url",
    "  surface: web",
    "  accounts:",
    "    print: p",
    roles,
  );
  assert.ok(
    seeded.notes.some((n) => /only if the environment's owner ran the same seeder/.test(n)),
  );
});

test("a complete stack config is ready, and says nothing is missing", () => {
  const readiness = runReadiness(readQaConfig(reader({ "qa.config.yml": STACK_RUN.join("\n") })));
  assert.deepEqual(readiness, {
    ready: true,
    needs: [],
    notes: [],
    run: { target: "stack", surface: "web", roles: ["admin", "member"] },
  });
});

test("without `restore` or `version_endpoint`, the run goes on with a note", () => {
  const text = STACK_RUN.filter((l) => !/restore:|version_endpoint:/.test(l)).join("\n");
  const readiness = runReadiness(readQaConfig(reader({ "qa.config.yml": text })));
  assert.equal(readiness.ready, true);
  assert.equal(readiness.notes.length, 2);
});

test("no version-endpoint note when the plan's Build names one", () => {
  const text = STACK_RUN.filter((l) => !/version_endpoint:/.test(l)).join("\n");
  const read = readQaConfig(reader({ "qa.config.yml": text }));
  assert.equal(runReadiness(read).notes.length, 1);
  assert.deepEqual(runReadiness(read, validatePlan(GOOD_PLAN).plan).notes, []);
});

test("the plan's Run brief fills target and surface; its roles must be declared", () => {
  const { plan } = validatePlan(GOOD_PLAN);
  const onlyAdmin = [
    "run:",
    "  stack: { up: a, migrate: b, seed: c, down: d }",
    "  accounts:",
    "    print: p",
    "    roles: [{ id: admin, purpose: x }]",
  ].join("\n");
  const readiness = runReadiness(readQaConfig(reader({ "qa.config.yml": onlyAdmin })), plan);
  assert.deepEqual(readiness.run, { target: "stack", surface: "web", roles: ["admin"] });
  assert.deepEqual(readiness.needs, [
    "run.accounts.roles: the plan signs in as `member`, which the config does not declare",
  ]);
});

test("readiness never asks for a Scenario account, only for Run brief roles", () => {
  const withAccount = GOOD_PLAN.replace(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `admin`\n- **Creates:** `temp-user`\n",
  ).replace("- **Signs in as:** nobody\n", "- **Signs in as:** `temp-user` (created in S1)\n");
  const { plan, problems } = validatePlan(withAccount);
  assert.deepEqual(problems, []);
  const config = (roles) =>
    readQaConfig(
      reader({
        "qa.config.yml": [
          "run:",
          "  stack: { up: a, migrate: b, seed: c, down: d }",
          "  accounts:",
          "    print: p",
          `    roles: [${roles}]`,
        ].join("\n"),
      }),
    );
  const both = runReadiness(config("{ id: admin, purpose: x }, { id: member, purpose: y }"), plan);
  assert.deepEqual(both.needs, []);
  const onlyAdmin = runReadiness(config("{ id: admin, purpose: x }"), plan);
  assert.deepEqual(onlyAdmin.needs, [
    "run.accounts.roles: the plan signs in as `member`, which the config does not declare",
  ]);
});

test("readiness asks for every role a session signs in as, and never a Scenario account", () => {
  // S1's sessions sign in as `member` and `admin`, and S1 creates `temp-user`; S2's
  // sessions sign in as `temp-user` and `nobody`.
  const text = GOOD_PLAN.replace(
    "- **Signs in as:** `admin`\n- **Steps:**\n  1. Open **Members**.\n  2. Click **Invite member**",
    "- **Sessions:** A = member, B = admin\n- **Creates:** `temp-user`\n- **Steps:**\n  1. In session A, open **Members**.\n  2. In session B, click **Invite member**",
  ).replace(
    "- **Signs in as:** nobody\n- **Steps:**\n  1. Open `/members` while signed out.",
    "- **Sessions:** A = `temp-user`, B = nobody\n- **Steps:**\n  1. In session A, open `/members`.\n  2. In session B, open `/members` while signed out.",
  );
  const { plan, problems } = validatePlan(text);
  assert.deepEqual(problems, []);
  const config = (roles) =>
    readQaConfig(
      reader({
        "qa.config.yml": [
          "run:",
          "  stack: { up: a, migrate: b, seed: c, down: d }",
          "  accounts:",
          "    print: p",
          `    roles: [${roles}]`,
        ].join("\n"),
      }),
    );
  assert.deepEqual(
    runReadiness(config("{ id: admin, purpose: x }, { id: member, purpose: y }"), plan).needs,
    [],
  );
  const want = [
    "run.accounts.roles: the plan signs in as `member`, which the config does not declare",
  ];
  assert.deepEqual(runReadiness(config("{ id: admin, purpose: x }"), plan).needs, want);
  // A role named only in **Sessions:** is asked for even when the Run brief's list is short.
  const onlySessions = { ...plan, brief: { ...plan.brief, roles: ["admin"] } };
  assert.deepEqual(runReadiness(config("{ id: admin, purpose: x }"), onlySessions).needs, want);
});

test("a config that disagrees with the plan's Run brief is asked about", () => {
  const { plan } = validatePlan(GOOD_PLAN);
  const text = STACK_RUN.join("\n").replace("surface: web", "surface: api");
  const readiness = runReadiness(readQaConfig(reader({ "qa.config.yml": text })), plan);
  assert.equal(readiness.ready, false);
  assert.match(
    readiness.needs[0],
    /^run\.surface: the config says `api` but the plan's Run brief says `web`/,
  );
});

test("a malformed role entry is a problem, not a crash", () => {
  for (const roles of [["    roles:", "      -"], ["    roles: [admin]"]]) {
    const files = { "qa.config.yml": ["run:", "  accounts:", ...roles].join("\n") };
    const read = readQaConfig(reader(files));
    assert.match(read.runProblems[0], /`run\.accounts\.roles\[0\]`: expected a mapping/);
    assert.equal(runReadiness(read).ready, false);
    assert.equal(main(["check", "--for", "run"], { read: reader(files) }).code, 1);
  }
});

test("a version endpoint on another host is a problem", () => {
  for (const endpoint of ["//prod.example.com/version", "'/\\prod.example.com/version'"])
    assert.deepEqual(yaml("run:", `  version_endpoint: ${endpoint}`).runProblems, [
      "line 2: `run.version_endpoint`: expected a path on the build's own host, such as `/version`",
    ]);
});

test("readiness is never ready over `run:` problems", () => {
  const readiness = runReadiness(
    readQaConfig(reader({ "qa.config.yml": "run:\n  target: prod\n" })),
  );
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.needs, ["a config with no problems in `run:`: fix each one listed"]);
});

// ── check --for run ─────────────────────────────────────────────────────────

test("check --for run prints problems and exits 1", () => {
  const result = main(["check", "--for", "run"], { read: reader({ "qa.config.yml": "run: x\n" }) });
  assert.equal(result.code, 1);
  assert.deepEqual(JSON.parse(result.out).problems, ["line 1: `run`: expected a mapping"]);
});

test("check --for run --plan reads the plan's Run brief into readiness", () => {
  const io = {
    read: reader({ "qa.config.yml": STACK_RUN.join("\n") }),
    readFile: (p) => (p === "plan.md" ? GOOD_PLAN : null),
  };
  const result = main(["check", "--for", "run", "--plan", "plan.md"], io);
  assert.equal(result.code, 0);
  const out = JSON.parse(result.out);
  assert.deepEqual(out.planProblems, []);
  assert.equal(out.readiness.ready, true);
  assert.equal(out.effective.working_dir, "tmp/qa");
  assert.equal(out.effective.run.target, "stack");
});

test("check --for run --plan exits 1 on a plan with problems", () => {
  const io = { read: reader({}), readFile: () => "not a plan" };
  const result = main(["check", "--for", "run", "--plan", "plan.md"], io);
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.out).planProblems.length, 1);
});

test("check --for run is not stopped by a problem in `plan:`", () => {
  const io = {
    read: reader({ "qa.config.yml": `plan:\n  tracker: jira\n${STACK_RUN.join("\n")}` }),
  };
  assert.equal(main(["check", "--for", "run"], io).code, 0);
  assert.equal(main(["check", "--for", "plan"], io).code, 1);
});

// ── render with `run:` answers ──────────────────────────────────────────────

test("render writes `run:` answers that read back with no problems", () => {
  const answers = {
    run: {
      target: "stack",
      surface: "web",
      stack: { up: "make up", migrate: "make migrate", seed: "make seed", down: "make down" },
      accounts: {
        print: "make seed -- --print",
        restore: "make seed -- --restore --account {id}",
        roles: [{ id: "admin", purpose: "manages members" }],
      },
    },
  };
  const result = main(["render"], { read: reader({}), stdin: () => JSON.stringify(answers) });
  assert.equal(result.code, 0);
  const back = parseConfig("qa.config.yml", result.out);
  assert.deepEqual(back.runProblems, []);
  assert.deepEqual(back.config.run, answers.run);
});

test("render saves `run:` answers over a problem in `plan:`, and the reverse", () => {
  const answers = { run: { target: "stack" } };
  const badPlan = reader({ "qa.config.yml": "plan:\n  tracker: jira\n" });
  const runResult = main(["render"], { read: badPlan, stdin: () => JSON.stringify(answers) });
  assert.equal(runResult.code, 0, runResult.out);
  const back = parseConfig("qa.config.yml", runResult.out);
  assert.equal(back.config.plan.tracker, "jira");
  assert.deepEqual(back.runProblems, []);

  const badRun = reader({ "qa.config.yml": "run:\n  target: prod\n" });
  const planAnswers = { plan: { base_ref: "origin/main" } };
  const planResult = main(["render"], { read: badRun, stdin: () => JSON.stringify(planAnswers) });
  assert.equal(planResult.code, 0, planResult.out);
});

test("render refuses over a problem in the section it writes, or one both skills read", () => {
  const answers = JSON.stringify({ run: { surface: "web" } });
  for (const text of ["run:\n  target: prod\n", "nope: 1\n", "\tworking_dir: x\n"]) {
    const result = main(["render"], {
      read: reader({ "qa.config.yml": text }),
      stdin: () => answers,
    });
    assert.equal(result.code, 1, text);
    assert.match(result.out, /has problems; fix them first/);
  }
});

test("render refuses `run:` answers with problems", () => {
  const result = main(["render"], {
    read: reader({}),
    stdin: () => JSON.stringify({ run: { target: "prod" } }),
  });
  assert.equal(result.code, 1);
  assert.match(result.out, /`run\.target`: expected one of: stack, url/);
});

// ── Host rule ───────────────────────────────────────────────────────────────

const url = { target: "url" };
/** The verdict for an address the QA person confirmed, as they typed it. */
const confirmed = (address, typed = address) =>
  hostVerdict(address, { target: "url", confirmed: typed }).verdict;

const LOCAL = [
  "http://localhost:3000/login",
  "localhost:8080",
  "http://127.0.0.1:5173",
  "http://[::1]:4000/",
  "https://app.localhost",
  "http://shop.test/sign-in",
  "HTTP://LOCALHOST",
];
const LABELLED = [
  "https://staging.example.com",
  "https://qa.example.com/login",
  "https://dev.example.com",
  "https://test.example.com",
  "https://sandbox.shop.example.org",
  "https://preview.example.co.uk",
  "https://uat.example.com:8443",
  "https://api.staging.example.com",
  "https://qa.shop.co.uk",
  "https://staging.myapp.vercel.app",
  "http://example.test.evil.com",
  "https://STAGING.Example.com.",
];
const PRODUCTION_LOOKING = [
  "https://app.example.com",
  "https://www.example.com",
  "https://example.com",
  "https://staging-example.com",
  "https://mystaging.example.com",
  "https://staging.prod.example.com",
  "https://qa.production.example.com",
  "https://live.preview.example.com",
  "https://203.0.113.7",
  "http://[2001:db8::1]",
  "http://localhost.example.com",
  "http://127.0.0.2",
  "http://0.0.0.0:3000",
  "http://test",
];
const TLD_ONLY = ["https://example.dev", "https://app.dev", "https://qa.dev", "https://dev.to"];
/** A site's own name under a multi-part suffix: someone's site, not a test host. */
const SITE_NAMES = [
  "https://qa.co.uk",
  "https://dev.com.au",
  "https://staging.github.io",
  "https://staging.vercel.app",
  "https://preview.netlify.app",
  "https://sandbox.herokuapp.com",
];

test("local development hosts pass, for either target", () => {
  for (const address of LOCAL) {
    assert.equal(hostVerdict(address).verdict, "local", address);
    assert.equal(hostVerdict(address, url).verdict, "local", address);
  }
});

test("a labelled hosted host passes only with chat confirmation", () => {
  for (const address of LABELLED) {
    assert.equal(hostVerdict(address, url).verdict, "confirm", address);
    assert.equal(confirmed(address), "hosted", address);
  }
  assert.equal(confirmed("https://qa.example.com/login", "qa.example.com"), "hosted");
  assert.equal(confirmed("https://qa.example.com", "QA.example.com/"), "hosted");
});

test("a confirmation names this host, not another", () => {
  for (const typed of ["staging.example.org", "example.com", "app.staging.example.com", "yes", " "])
    assert.notEqual(confirmed("https://staging.example.com", typed), "hosted", typed);
  assert.equal(confirmed("https://staging.example.com", "qa.example.com"), "stop");
});

test("a URL found only in the plan is not confirmation", () => {
  const planUrl = "https://staging.example.com";
  const text = GOOD_PLAN.replace("- **Target:** `stack`", `- **Target:** \`url\`, at ${planUrl}`);
  const { plan, problems } = validatePlan(text);
  assert.deepEqual(problems, []);
  assert.equal(plan.brief.target, "url");
  // Nothing in the plan's reading, or in readiness, carries an address to sign in at.
  assert.doesNotMatch(JSON.stringify(plan.brief), /example\.com/);
  const files = {
    "qa.config.yml": [
      "run:",
      "  accounts:",
      "    roles: [{ id: admin, purpose: x }, { id: member, purpose: y }]",
    ].join("\n"),
  };
  const readiness = runReadiness(readQaConfig(reader(files)), plan);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.run.target, "url");
  assert.doesNotMatch(JSON.stringify(readiness), /example\.com/);
  assert.ok(readiness.notes.some((n) => /ask the QA person for it in chat/.test(n)));
  // The plan's own URL, unconfirmed, is not one a run may sign in at.
  assert.equal(hostVerdict(planUrl, url).verdict, "confirm");
  assert.equal(main(["host", planUrl, "--target", "url"], { read: reader(files) }).code, 3);
});

test("anything that looks like production stops, confirmed or not", () => {
  for (const address of PRODUCTION_LOOKING) {
    assert.equal(hostVerdict(address, url).verdict, "stop", address);
    assert.equal(confirmed(address), "stop", address);
  }
  assert.match(hostVerdict("https://staging.prod.example.com", url).why, /looks like production/);
});

test("a TLD-only `.dev` host stops: a TLD is not a test-environment label", () => {
  for (const address of TLD_ONLY) {
    assert.equal(hostVerdict(address, url).verdict, "stop", address);
    assert.equal(confirmed(address), "stop", address);
  }
  assert.match(hostVerdict("https://example.dev", url).why, /a TLD such as `\.dev` does not count/);
});

test("a site named like a label under a multi-part suffix stops: it is the site's own name", () => {
  for (const address of SITE_NAMES) {
    assert.equal(hostVerdict(address, url).verdict, "stop", address);
    assert.equal(confirmed(address), "stop", address);
  }
});

test("a `stack` run signs in only to a local host, even a confirmed labelled one", () => {
  for (const address of [...LABELLED, ...PRODUCTION_LOOKING, ...TLD_ONLY, ...SITE_NAMES])
    assert.equal(
      hostVerdict(address, { target: "stack", confirmed: address }).verdict,
      "stop",
      address,
    );
  assert.equal(hostVerdict("https://staging.example.com").verdict, "stop");
});

test("not a web address stops, for either target", () => {
  for (const address of ["file:///etc/passwd", "ftp://staging.example.com", "not a url at all", ""])
    for (const options of [{}, url, { target: "url", confirmed: address }])
      assert.equal(hostVerdict(address, options).verdict, "stop", address);
  assert.equal(hostVerdict("https://staging.example.com", { target: "prod" }).verdict, "stop");
});

test("an address carrying sign-in values stops, even on localhost or confirmed", () => {
  assert.deepEqual(hostVerdict("http://admin:pw@localhost:3000"), {
    verdict: "stop",
    host: "localhost",
    why: "the address carries sign-in values; they never go in an address",
  });
  assert.equal(confirmed("https://admin:pw@staging.example.com", "staging.example.com"), "stop");
});

test("`host` exits 0 to sign in, 1 on a stop, 3 to confirm, 2 on bad usage", () => {
  const io = { read: reader({}) };
  const code = (...argv) => main(["host", ...argv], io).code;
  assert.equal(code("http://localhost:3000"), 0);
  assert.equal(code("https://app.example.com"), 1);
  assert.equal(code("https://staging.example.com"), 1);
  assert.equal(code("https://staging.example.com", "--target", "url"), 3);
  assert.equal(
    code("https://staging.example.com", "--target", "url", "--confirmed", "staging.example.com"),
    0,
  );
  assert.equal(code("https://example.dev", "--target", "url", "--confirmed", "example.dev"), 1);
  assert.equal(code(), 2);
  assert.equal(code("https://staging.example.com", "--target", "url", "--confirmed"), 2);
  assert.equal(code("https://staging.example.com", "--target"), 2);
  assert.equal(code("https://staging.example.com", "--target", "prod"), 2);
  assert.equal(code("https://staging.example.com", "--target", "--confirmed", "x"), 2);
  assert.equal(code("https://qa.example.com", "--confirmed", "--target", "url"), 2);
  assert.deepEqual(
    JSON.parse(main(["host", "https://qa.example.com", "--target", "url"], io).out).verdict,
    "confirm",
  );
});
