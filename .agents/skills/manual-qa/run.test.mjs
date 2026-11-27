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
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  WEB_NOTES,
  findPlaywright,
  hostVerdict,
  main,
  onPath,
  parseConfig,
  readQaConfig,
  resolveHosts,
  resolvePlaywright,
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
    "line 14: `run.colour`: unknown key (ADAPTER.md documents: target, surface, stack, hosts, accounts, playwright, version_endpoint, evidence)",
    "line 2: `run.target`: expected one of: stack, url",
    "line 3: `run.surface`: expected one of: web, desktop, mobile, api",
    "line 4: `run.stack.start`: unknown key (ADAPTER.md documents: up, migrate, seed, down, address)",
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
    "line 2: `run.stack`: expected a mapping of `up`, `migrate`, `seed`, `down`, `address`",
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

// ── The `web` driver's tools (#232) ─────────────────────────────────────────

const tools = (chromium, ffmpeg) => () => ({ chromium, ffmpeg });
const STACK_READ = () => readQaConfig(reader({ "qa.config.yml": STACK_RUN.join("\n") }));

test("a `web` run notes whether Playwright with Chromium and ffmpeg are there, and needs neither", () => {
  const plan = validatePlan(GOOD_PLAN).plan;
  const without = runReadiness(STACK_READ(), plan, tools(false, false));
  assert.equal(without.ready, true);
  assert.deepEqual(without.needs, []);
  assert.deepEqual(without.notes, [WEB_NOTES.noChromium, WEB_NOTES.noFfmpeg]);
  assert.deepEqual(runReadiness(STACK_READ(), plan, tools(true, true)).notes, [
    WEB_NOTES.chromium,
    WEB_NOTES.ffmpeg,
  ]);
  // Each note says what the run loses without the tool (#236).
  assert.match(WEB_NOTES.noChromium, /harness's browsers/);
  assert.match(WEB_NOTES.noChromium, /`web\.mjs`/);
  assert.match(WEB_NOTES.noChromium, /no Storyboards \(and so no MP4s\)/);
  assert.match(WEB_NOTES.noFfmpeg, /no `ffmpeg` with `ffprobe` on `PATH`, so no MP4s/);
  assert.match(WEB_NOTES.noFfmpeg, /keeps its Storyboard/);
  assert.match(WEB_NOTES.ffmpeg, /`mp4\.mjs` builds an MP4 for each `Capture: video` scenario/);
});

test("the tool notes come only when a scenario drives `web`", () => {
  const apiOnly = GOOD_PLAN.replace("- **Surface:** `web`", "- **Surface:** `api`");
  const api = STACK_RUN.map((l) => l.replace("surface: web", "surface: api")).join("\n");
  const plan = validatePlan(apiOnly).plan;
  assert.ok(plan.scenarios.every((s) => s.surface === "api"));
  let asked = false;
  const read = readQaConfig(reader({ "qa.config.yml": api }));
  const readiness = runReadiness(read, plan, () => {
    asked = true;
    return { chromium: false, ffmpeg: false };
  });
  assert.deepEqual(readiness.notes, []);
  assert.equal(asked, false, "no detection when nothing drives `web`");
  // No plan: the effective surface decides.
  assert.equal(runReadiness(STACK_READ(), null, tools(false, true)).notes.length, 2);
});

test("check --for run reports the tool notes it detects", () => {
  const io = {
    read: reader({ "qa.config.yml": STACK_RUN.join("\n") }),
    readFile: (p) => (p === "plan.md" ? GOOD_PLAN : null),
    tools: tools(false, true),
  };
  const out = JSON.parse(main(["check", "--for", "run", "--plan", "plan.md"], io).out);
  assert.deepEqual(out.readiness.notes, [WEB_NOTES.noChromium, WEB_NOTES.ffmpeg]);
});

test("onPath finds a program by PATH and PATHEXT, and findPlaywright finds none in an empty folder", () => {
  const bin = mkdtempSync(join(tmpdir(), "onpath-"));
  try {
    writeFileSync(join(bin, "ffmpeg"), "");
    writeFileSync(join(bin, "ffmpeg.EXE"), "");
    assert.equal(onPath("ffmpeg", { PATH: bin }, "linux"), true);
    assert.equal(onPath("ffmpeg", { PATH: "" }, "linux"), false);
    assert.equal(onPath("ffmpeg", { Path: `C:\\nope;${bin}`, PATHEXT: ".EXE" }, "win32"), true);
    mkdirSync(join(bin, "ffprobe"));
    assert.equal(onPath("ffprobe", { PATH: bin }, "linux"), false, "a folder is not a program");
    assert.deepEqual(findPlaywright(bin), { package: null, module: null, chromium: false });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
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

// ── The surface question (#223) ───────────────────────────────────────────────

/** The good plan with its Run brief on `api`: both scenarios drive `api`. */
const API_PLAN = GOOD_PLAN.replace("- **Surface:** `web`", "- **Surface:** `api`");
const surfaceNeed = (text, config = STACK_RUN.join("\n")) => {
  const { plan, problems } = validatePlan(text);
  assert.deepEqual(problems, []);
  const readiness = runReadiness(readQaConfig(reader({ "qa.config.yml": config })), plan);
  return readiness.needs.filter((n) => n.startsWith("run.surface:"));
};

test("the surface question offers the two surfaces in dispute and names the scenarios that move", () => {
  assert.deepEqual(surfaceNeed(API_PLAN), [
    "run.surface: the config says `web` but the plan's Run brief says `api`; say which this run " +
      "uses, `web` or `api`. With `web`, S1 and S2 drive `web`; with `api`, they drive `api`, " +
      "the surface the plan's author chose from what those scenarios must observe. " +
      "No scenario keeps its own **Surface:** whatever the answer.",
  ]);
});

test("the surface question names a scenario that keeps its own Surface", () => {
  // S2 carries its own `desktop`; S1 repeats the Run brief's `api`, which moves it all the same.
  const mixed = API_PLAN.replace(
    "- **Signs in as:** `admin`\n",
    "- **Signs in as:** `admin`\n- **Surface:** `api`\n",
  ).replace("- **Signs in as:** nobody\n", "- **Signs in as:** nobody\n- **Surface:** `desktop`\n");
  assert.deepEqual(surfaceNeed(mixed), [
    "run.surface: the config says `web` but the plan's Run brief says `api`; say which this run " +
      "uses, `web` or `api`. With `web`, S1 drives `web`; with `api`, it drives `api`, " +
      "the surface the plan's author chose from what that scenario must observe. " +
      "S2 (`desktop`) keeps its own **Surface:** whatever the answer.",
  ]);
  // When every scenario carries another surface, neither answer moves one.
  const allOwn = mixed.replace(
    "- **Signs in as:** `admin`\n- **Surface:** `api`\n",
    "- **Signs in as:** `admin`\n- **Surface:** `mobile`\n",
  );
  assert.deepEqual(surfaceNeed(allOwn), [
    "run.surface: the config says `web` but the plan's Run brief says `api`; say which this run " +
      "uses, `web` or `api`. No scenario drives the Run brief's surface, so neither answer moves " +
      "one. S1 (`mobile`) and S2 (`desktop`) keep their own **Surface:** whatever the answer.",
  ]);
});

test("no surface question when the config agrees with the plan or gives no surface", () => {
  assert.deepEqual(surfaceNeed(GOOD_PLAN), []);
  const api = STACK_RUN.join("\n").replace("surface: web", "surface: api");
  assert.deepEqual(surfaceNeed(API_PLAN, api), []);
  const none = STACK_RUN.filter((l) => !/surface:/.test(l)).join("\n");
  assert.deepEqual(surfaceNeed(API_PLAN, none), []);
});

test("`run.surface` accepts a non-empty list of distinct surfaces, and a one-item list equals the string (#378)", () => {
  const flow = yaml("run:", "  surface: [api, web]");
  assert.deepEqual(flow.runProblems, []);
  assert.deepEqual(flow.config.run.surface, ["api", "web"]);

  const block = yaml("run:", "  surface:", "    - api", "    - web");
  assert.deepEqual(block.runProblems, []);
  assert.deepEqual(block.config.run.surface, ["api", "web"]);

  const single = yaml("run:", "  surface: [web]");
  assert.deepEqual(single.runProblems, []);

  const json = parseConfig("qa.config.json", JSON.stringify({ run: { surface: ["api", "web"] } }));
  assert.deepEqual(json.runProblems, []);

  for (const [label, text] of [
    ["empty list", "run:\n  surface: []"],
    ["duplicate", "run:\n  surface: [api, api]"],
    ["unknown", "run:\n  surface: [api, cli]"],
    ["mapping", "run:\n  surface: { a: api }"],
  ]) {
    const bad = yaml(text);
    assert.ok(
      bad.runProblems.some((p) => /`run\.surface`:/.test(p)),
      `${label}: ${JSON.stringify(bad.runProblems)}`,
    );
  }
  const badJson = parseConfig("qa.config.json", JSON.stringify({ run: { surface: [123] } }));
  assert.ok(badJson.runProblems.some((p) => /`run\.surface`:/.test(p)));
});

test("with a `run.surface` list, no need is raised when the Run brief's Surface is listed, and scenarios keep their own Surface (#378)", () => {
  const listConfig = STACK_RUN.join("\n").replace("surface: web", "surface: [api, web]");
  const read = readQaConfig(reader({ "qa.config.yml": listConfig }));

  // Run brief is `api` (in list): no surface need, effective default is `api`.
  const apiReadiness = runReadiness(read, validatePlan(API_PLAN).plan);
  assert.deepEqual(apiReadiness.needs, []);
  assert.equal(apiReadiness.run.surface, "api");
  assert.deepEqual(apiReadiness.run.surfaces, ["api", "web"]);

  // A scenario whose own Surface is outside the list (`desktop`) keeps it with no need raised.
  const outsideOwn = API_PLAN.replace(
    "- **Signs in as:** nobody\n",
    "- **Signs in as:** nobody\n- **Surface:** `desktop`\n",
  );
  const outsidePlan = validatePlan(outsideOwn).plan;
  assert.equal(outsidePlan.scenarios[0].surface, "api");
  assert.equal(outsidePlan.scenarios[1].surface, "desktop");
  assert.deepEqual(surfaceNeed(outsideOwn, listConfig), []);

  // A one-item list behaves identically to the string in surfaceQuestion and readiness.run.
  const oneListConfig = STACK_RUN.join("\n").replace("surface: web", "surface: [web]");
  const oneRead = readQaConfig(reader({ "qa.config.yml": oneListConfig }));
  const oneReadiness = runReadiness(oneRead, validatePlan(GOOD_PLAN).plan);
  assert.deepEqual(oneReadiness.run, {
    target: "stack",
    surface: "web",
    roles: ["admin", "member"],
  });
  assert.deepEqual(surfaceNeed(API_PLAN, oneListConfig), surfaceNeed(API_PLAN));
});

test("with a `run.surface` list and a Run brief outside it, the surface need offers all choices and names moving and keeping scenarios (#378)", () => {
  const listConfig = STACK_RUN.join("\n").replace("surface: web", "surface: [api, web]");
  const desktopPlan = GOOD_PLAN.replace("- **Surface:** `web`", "- **Surface:** `desktop`").replace(
    "- **Signs in as:** nobody\n",
    "- **Signs in as:** nobody\n- **Surface:** `mobile`\n",
  );
  const needs = surfaceNeed(desktopPlan, listConfig);
  assert.equal(needs.length, 1);
  assert.match(needs[0], /^run\.surface:/);
  assert.match(needs[0], /`desktop`/);
  assert.match(needs[0], /`api`/);
  assert.match(needs[0], /`web`/);
  assert.match(needs[0], /\bS1\b/);
  assert.match(needs[0], /S2 \(`mobile`\) keeps its own \*\*Surface:\*\* whatever the answer/);
});

test("check --for run with no plan and a `run.surface` list raises no surface need and checks `web` tools when `web` is listed (#378)", () => {
  const listConfig = STACK_RUN.join("\n").replace("surface: web", "surface: [api, web]");
  const withWeb = JSON.parse(
    main(["check", "--for", "run"], {
      read: reader({ "qa.config.yml": listConfig }),
      tools: tools(false, true),
    }).out,
  );
  assert.deepEqual(withWeb.problems, []);
  assert.deepEqual(withWeb.readiness.needs, []);
  assert.equal(withWeb.readiness.run.surface, "api");
  assert.deepEqual(withWeb.readiness.run.surfaces, ["api", "web"]);
  assert.deepEqual(withWeb.readiness.notes, [WEB_NOTES.noChromium, WEB_NOTES.ffmpeg]);

  const noWebConfig = STACK_RUN.join("\n").replace("surface: web", "surface: [api, desktop]");
  let probed = false;
  const withoutWeb = JSON.parse(
    main(["check", "--for", "run"], {
      read: reader({ "qa.config.yml": noWebConfig }),
      tools: () => {
        probed = true;
        return { chromium: false, ffmpeg: false };
      },
    }).out,
  );
  assert.deepEqual(withoutWeb.readiness.needs, []);
  assert.deepEqual(withoutWeb.readiness.notes, []);
  assert.equal(probed, false);
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

// ── Readiness for a plan with no scenarios (#221) ─────────────────────────────

/** The good plan with no scenarios: its Scenarios says `None.`, and its checklist one `Review:` box. */
const REVIEW_ONLY = GOOD_PLAN.replace(
  /(## Scenarios\n\n)[\s\S]*?(?=## Sign-off checklist)/,
  "$1None.\n\n",
).replace(
  /(## Sign-off checklist\n\n)[\s\S]*?(?=\n## Stop)/,
  "$1- [ ] Review: docs/x.html says the token lasts 30 days\n",
);
const reviewOnlyPlan = (text = REVIEW_ONLY) => {
  const { plan, problems } = validatePlan(text);
  assert.deepEqual(problems, []);
  assert.equal(plan.scenarios.length, 0);
  return plan;
};

test("a plan with no scenarios asks for nothing that only driving scenarios needs", () => {
  const plan = reviewOnlyPlan();
  const none = runReadiness(readQaConfig(reader({})), plan);
  assert.equal(none.ready, true);
  assert.deepEqual(none.needs, []);
  // A config that leaves out roles, stack commands and `accounts.print` asks nothing either.
  const bare = runReadiness(
    readQaConfig(reader({ "qa.config.yml": "run:\n  target: stack\n  stack: { up: go }\n" })),
    plan,
  );
  assert.equal(bare.ready, true);
  assert.deepEqual(bare.needs, []);
  // Nor does a Run brief with no target or surface, or roles the config does not declare.
  const unbriefed = {
    ...plan,
    brief: { ...plan.brief, target: null, surface: null, roles: ["admin", "member"] },
  };
  const asks = runReadiness(
    readQaConfig(
      reader({ "qa.config.yml": "run:\n  accounts:\n    roles: [{ id: admin, purpose: x }]\n" }),
    ),
    unbriefed,
  );
  assert.deepEqual(asks.needs, []);
  assert.equal(asks.ready, true);
});

test("a plan with no scenarios raises no target or surface conflict, and still reports the run", () => {
  const conflicting = [
    "run:",
    "  target: url",
    "  surface: api",
    "  accounts:",
    "    roles: [{ id: admin, purpose: x }]",
  ].join("\n");
  const readiness = runReadiness(
    readQaConfig(reader({ "qa.config.yml": conflicting })),
    reviewOnlyPlan(),
  );
  assert.deepEqual(readiness.needs, []);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.run, { target: "url", surface: "api", roles: ["admin"] });
  // The same config with the good plan's scenarios asks which surface and target this run uses.
  const driven = runReadiness(
    readQaConfig(reader({ "qa.config.yml": conflicting })),
    validatePlan(GOOD_PLAN).plan,
  );
  assert.ok(driven.needs.some((n) => /^run\.surface: the config says `api`/.test(n)));
  assert.ok(driven.needs.some((n) => /^run\.target: the config says `url`/.test(n)));
});

test("a plan with no scenarios keeps the build-check note, and drops the notes about driving", () => {
  // It reads no version endpoint (step 4 skips step 5), so only `gh` can check its build,
  // whether or not the Build or the config names an endpoint.
  const BUILD_NOTE =
    "a plan with no scenarios reads no version endpoint: without `gh` access the build cannot be " +
    "checked against the plan's head, and the report opens with **build not verified against plan**";
  const unbuilt = REVIEW_ONLY.replace(
    /- \*\*Build:\*\*.*\n/,
    "- **Build:** 2222222222222222222222222222222222222222\n",
  );
  const url = "run:\n  target: url\n  surface: web\n";
  const notesOf = (text, plan) => runReadiness(readQaConfig(reader(text)), plan).notes;
  assert.deepEqual(notesOf({ "qa.config.yml": url }, reviewOnlyPlan(unbuilt)), [BUILD_NOTE]);
  // The Build names a version endpoint, and so does the config: the note stays.
  assert.deepEqual(notesOf({ "qa.config.yml": url }, reviewOnlyPlan()), [BUILD_NOTE]);
  assert.deepEqual(
    notesOf({ "qa.config.yml": `${url}  version_endpoint: /version\n` }, reviewOnlyPlan(unbuilt)),
    [BUILD_NOTE],
  );
  const unconfigured = notesOf({}, reviewOnlyPlan(unbuilt));
  assert.equal(unconfigured.length, 2);
  assert.match(unconfigured[0], /^no qa\.config\.yml/);
  assert.equal(unconfigured[1], BUILD_NOTE);
});

test("a plan with no scenarios still gets each `run:` config problem", () => {
  const read = readQaConfig(reader({ "qa.config.yml": "run:\n  target: moon\n" }));
  assert.ok(read.runProblems.length);
  const readiness = runReadiness(read, reviewOnlyPlan());
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.needs, ["a config with no problems in `run:`: fix each one listed"]);
});

test("check --for run --plan: a review-only plan with no config is ready and needs nothing", () => {
  const io = { read: reader({}), readFile: (p) => (p === "plan.md" ? REVIEW_ONLY : null) };
  const result = main(["check", "--for", "run", "--plan", "plan.md"], io);
  assert.equal(result.code, 0);
  const out = JSON.parse(result.out);
  assert.deepEqual(out.planProblems, []);
  assert.equal(out.readiness.ready, true);
  assert.deepEqual(out.readiness.needs, []);
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
  assert.ok(
    readiness.notes.some((n) =>
      /no config key confirms a hosted address; ask the QA person to type it in chat/.test(n),
    ),
  );
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

// ── `check --for run --answers`: run needs given up front ───────────────────

/** A repository folder holding `files` (objects as JSON), removed after the suite. */
function answersRepo(files) {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "run-answers-")));
  after(() => rmSync(repo, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), typeof text === "string" ? text : JSON.stringify(text));
  }
  return repo;
}

/** The `run:` answers a QA Stack run needs, as `qa-run.json` holds them. */
const RUN_ANSWERS = {
  run: {
    target: "stack",
    surface: "web",
    stack: { up: "make up", migrate: "make migrate", seed: "make seed", down: "make down" },
    accounts: {
      print: "make print",
      roles: [{ id: "admin", purpose: "manages members" }],
    },
  },
};
const ANSWERS_FILE = "tmp/qa/qa-run.json";
const checkRun = (repo, ...extra) => {
  const { code, out } = main(["check", "--for", "run", "--repo", repo, ...extra]);
  return { code, result: out.startsWith("{") ? JSON.parse(out) : out };
};

test("check --for run --answers reports no needs when the file answers them all", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: RUN_ANSWERS });
  const { code, result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(code, 0);
  assert.deepEqual(result.readiness.needs, []);
  assert.equal(result.readiness.ready, true);
  assert.equal(result.effective.run.stack.up, "make up");
  assert.equal(result.answers.used, true);
});

test("check --for run --answers lists only the needs the file leaves", () => {
  const repo = answersRepo({
    [ANSWERS_FILE]: { run: { target: "stack", stack: { up: "make up", down: "make down" } } },
  });
  const { code, result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(code, 0);
  assert.deepEqual(
    result.readiness.needs.map((need) => need.split(":")[0]),
    [
      "run.surface",
      "run.accounts.roles",
      "run.stack.migrate",
      "run.stack.seed",
      "run.accounts.print",
    ],
  );
});

test("check --for run --answers merges `run` key by key, as qa-plan's rules do", () => {
  const repo = answersRepo({
    "qa.config.yml": "run:\n  target: stack\n  stack: { up: from-config, down: d }\n",
    [ANSWERS_FILE]: { run: { stack: { up: "from-answers" } } },
  });
  const { result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(result.effective.run.target, "stack");
  // `run` merges one level down: an answered `stack` replaces the config's whole `stack`.
  assert.deepEqual(result.effective.run.stack, { up: "from-answers" });
});

test("check --for run --answers shows the reused-answers line, each value as key=value", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: { run: { target: "stack", surface: "web" } } });
  const { result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(
    result.answers.reused,
    `Run answers reused from ${ANSWERS_FILE}: run.target="stack"; run.surface="web"`,
  );
  assert.equal(result.answers.file, ANSWERS_FILE);
});

test("check --for run with no --answers has no reused-answers line", () => {
  const repo = answersRepo({});
  const { result } = checkRun(repo);
  assert.equal("answers" in result, false);
});

test("an answers file for another base branch is not used", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: RUN_ANSWERS });
  const { code, result } = checkRun(
    repo,
    "--answers",
    ANSWERS_FILE,
    "--answers-base",
    "main",
    "--base",
    "release/2.0",
  );
  assert.equal(code, 0);
  assert.equal(result.answers.used, false);
  assert.match(result.answers.why, /`main`.*`release\/2\.0`/);
  assert.equal("reused" in result.answers, false);
  assert.equal(result.effective.run, null);
  assert.ok(result.readiness.needs.some((need) => need.startsWith("run.target:")));
});

test("an answers file for the same base branch is used, `origin/main` naming `main`", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: RUN_ANSWERS });
  const { result } = checkRun(
    repo,
    "--answers",
    ANSWERS_FILE,
    "--answers-base",
    "origin/main",
    "--base",
    "main",
  );
  assert.equal(result.answers.used, true);
  assert.deepEqual(result.readiness.needs, []);
});

test("a base given without the other leaves the file in use, as qa-plan's does", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: RUN_ANSWERS });
  assert.equal(
    checkRun(repo, "--answers", ANSWERS_FILE, "--base", "main").result.answers.used,
    true,
  );
  assert.equal(
    checkRun(repo, "--answers", ANSWERS_FILE, "--answers-base", "main").result.answers.used,
    true,
  );
});

test("check --for run --answers exits 2 for a missing, non-JSON or outside file", () => {
  const repo = answersRepo({
    [ANSWERS_FILE]: "not json",
    "elsewhere/qa-run.json": RUN_ANSWERS,
    "list.json": [],
  });
  for (const file of ["tmp/qa/none.json", ANSWERS_FILE, "list.json", "elsewhere/qa-run.json"]) {
    const { code, result } = checkRun(repo, "--answers", file);
    assert.equal(code, 2, file);
    assert.match(result, /^check: /, file);
  }
  assert.equal(main(["check", "--for", "run", "--answers"], { read: reader({}) }).code, 2);
});

test("check --for run --answers refuses answers whose merged `run:` has problems", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: { run: { target: "moon" } } });
  const { code, result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(code, 1);
  assert.deepEqual(result.problems, ["the answers: `run.target`: expected one of: stack, url"]);
  assert.equal(result.effective, null);
});

test("check --for run --answers keeps the plan checks beside the answers", () => {
  const repo = answersRepo({ [ANSWERS_FILE]: RUN_ANSWERS });
  writeFileSync(join(repo, "tmp/qa/plan.md"), GOOD_PLAN);
  const { result } = checkRun(
    repo,
    "--answers",
    ANSWERS_FILE,
    "--plan",
    join(repo, "tmp/qa/plan.md"),
  );
  assert.deepEqual(result.planProblems, []);
  assert.ok(result.readiness.needs.every((need) => !need.startsWith("run.target")));
});

// ── `run.stack.address` ─────────────────────────────────────────────────────

test("`run.stack.address` reads with no problem for a local address, and is not a need", () => {
  const read = yaml(
    "run:",
    "  target: stack",
    "  stack: { up: a, migrate: b, seed: c, down: d, address: http://localhost:3000 }",
  );
  assert.deepEqual(read.runProblems, []);
  const needs = runReadiness({ path: "qa.config.yml", config: read.config }).needs;
  assert.equal(
    needs.some((need) => need.startsWith("run.stack.address")),
    false,
  );
});

test("`run.stack.address` that `host` does not call local is refused, in the config and as an answer", () => {
  for (const address of [
    "https://app.example.com",
    "https://staging.example.com",
    "http://admin:pw@localhost:3000",
    "not an address",
    "file:///etc/passwd",
  ]) {
    const read = yaml("run:", "  stack:", `    address: "${address}"`);
    assert.deepEqual(
      read.runProblems.map((p) => p.replace(/^line \d+: /, "").split(":")[0]),
      ["`run.stack.address`"],
      address,
    );
    assert.match(read.runProblems[0], /expected a local address/);
    const repo = answersRepo({ [ANSWERS_FILE]: { run: { stack: { address } } } });
    const { code, result } = checkRun(repo, "--answers", ANSWERS_FILE);
    assert.equal(code, 1, address);
    assert.match(result.problems[0], /^the answers: `run\.stack\.address`/, address);
  }
});

test("`run.stack.address` given as a run answer reaches the effective run", () => {
  const repo = answersRepo({
    [ANSWERS_FILE]: {
      run: { ...RUN_ANSWERS.run, stack: { ...RUN_ANSWERS.run.stack, address: "localhost:3000" } },
    },
  });
  const { code, result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(code, 0);
  assert.equal(result.effective.run.stack.address, "localhost:3000");
  assert.equal(main(["host", "localhost:3000"], { read: reader({}) }).code, 0);
});

// ── run.hosts: candidates the person still confirms by typing (#418) ────────

const HOSTS_CONFIG = [
  "run:",
  "  target: url",
  "  surface: web",
  "  hosts:",
  "    - { name: app, url: https://qa.example.com, surface: web }",
  "    - { name: api, url: https://api.qa.example.com, surface: api }",
  "    - { name: billing, url: https://billing.staging.example.com }",
  "  accounts:",
  '    print: "npm run seed:qa -- --print"',
  "    roles:",
  "      - { id: admin, purpose: manages members }",
  "      - { id: member, purpose: an ordinary member }",
].join("\n");
const URL_PLAN = GOOD_PLAN.replace("- **Target:** `stack`", "- **Target:** `url`");
/** S2 drives the `api` surface; S1 stays on the Run brief's `web`. */
const API_S2 = URL_PLAN.replace(
  "- **Signs in as:** nobody\n",
  "- **Signs in as:** nobody\n- **Surface:** api\n",
);
/** S2 tests the named `billing` service. */
const BILLING_S2 = API_S2.replace(
  "- **Surface:** api\n",
  "- **Surface:** api\n- **Service:** billing\n",
);

/** `check --for run --plan` over HOSTS_CONFIG (or `config`), with each `--host` typed. */
function checkHosts(plan, typed = [], config = HOSTS_CONFIG) {
  const io = {
    read: reader({ "qa.config.yml": config }),
    readFile: (p) => (p === "plan.md" ? plan : null),
  };
  const flags = typed.flatMap((value) => ["--host", value]);
  const result = main(["check", "--for", "run", "--plan", "plan.md", ...flags], io);
  return { code: result.code, out: JSON.parse(result.out) };
}

test("`run.hosts` reads as a list of { name, url, surface } and is a candidate list", () => {
  assert.deepEqual(yaml(...HOSTS_CONFIG.split("\n")).runProblems, []);
});

test("`run.hosts` problems are named with their line", () => {
  const read = yaml(
    "run:",
    "  hosts:",
    "    - { name: app, url: https://qa.example.com, surface: web }",
    "    - { name: app, url: https://qa2.example.com }",
    "    - { name: other, url: https://qa3.example.com, surface: web }",
    "    - { name: bad name, url: https://qa.example.com }",
    "    - { name: nourl }",
    "    - { name: creds, url: https://me:pw@qa.example.com }",
    "    - { name: ftp, url: ftp://qa.example.com }",
    "    - { name: tv, url: https://tv.example.com, surface: tv }",
    "    - { name: extra, url: https://x.example.com, token: abc }",
    "    - not-a-mapping",
  );
  assert.deepEqual(read.runProblems, [
    "line 4: `run.hosts[1].name`: duplicate name `app`",
    "line 5: `run.hosts[2].surface`: `web` already has an entry (`app`): a surface has at most one",
    "line 6: `run.hosts[3].name`: required: letters, digits, `_` and `-` only",
    "line 7: `run.hosts[4].url`: required: a web address, such as `https://qa.example.com`",
    "line 8: `run.hosts[5].url`: required: a web address with no sign-in values in it",
    "line 9: `run.hosts[6].url`: required: a web address, such as `https://qa.example.com`",
    "line 10: `run.hosts[7].surface`: expected one of: web, desktop, mobile, api",
    "line 11: `run.hosts[8].token`: unknown key (ADAPTER.md documents: name, url, surface)",
    "line 12: `run.hosts[9]`: expected a mapping of `name`, `url`, `surface`",
  ]);
  assert.deepEqual(yaml("run:", "  hosts: https://qa.example.com").runProblems, [
    "line 2: `run.hosts`: expected a list of `{ name, url, surface }` candidates",
  ]);
});

test("check --for run lists each `run.hosts` entry as a candidate and still asks to type it", () => {
  const { code, out } = checkHosts(URL_PLAN);
  assert.equal(code, 0);
  assert.deepEqual(
    out.readiness.hosts.map((h) => [h.name, h.verdict, h.confirmed]),
    [
      ["app", "confirm", false],
      ["api", "confirm", false],
      ["billing", "confirm", false],
    ],
  );
  for (const name of ["app", "api", "billing"])
    assert.ok(
      out.readiness.notes.some(
        (n) => n.includes(`\`${name}\``) && n.includes("a candidate, never a confirmation"),
      ),
      name,
    );
  // Nothing typed: the config confirms nothing, and every scenario waits for a person.
  assert.deepEqual(
    out.readiness.held.map((h) => h.id),
    ["S1", "S2"],
  );
  assert.ok(out.readiness.held.every((h) => /not confirmed/.test(h.why)));
});

test("a typed host confirms its entry; a scenario without Service: uses its surface's entry", () => {
  const { out } = checkHosts(API_S2, ["app=qa.example.com", "api=https://api.qa.example.com"]);
  assert.deepEqual(
    out.readiness.hosts.map((h) => [h.name, h.verdict, h.confirmed]),
    [
      ["app", "hosted", true],
      ["api", "hosted", true],
      ["billing", "confirm", false],
    ],
  );
  assert.deepEqual(out.readiness.held, []);
  assert.deepEqual(
    out.readiness.scenarioHosts.map((s) => [s.id, s.entry]),
    [
      ["S1", "app"],
      ["S2", "api"],
    ],
  );
});

test("**Service:** picks the named entry, and the surface's entry is not used", () => {
  const { out } = checkHosts(BILLING_S2, [
    "app=qa.example.com",
    "billing=billing.staging.example.com",
  ]);
  assert.deepEqual(out.readiness.held, []);
  assert.deepEqual(
    out.readiness.scenarioHosts.map((s) => [s.id, s.entry]),
    [
      ["S1", "app"],
      ["S2", "billing"],
    ],
  );
});

test("a host typed for another address does not confirm the entry", () => {
  const { out } = checkHosts(URL_PLAN, ["app=evil.example.com", "api=api.qa.example.com"]);
  const app = out.readiness.hosts.find((h) => h.name === "app");
  assert.equal(app.verdict, "stop");
  assert.equal(app.confirmed, false);
  assert.ok(out.readiness.held.some((h) => h.id === "S1" && /app/.test(h.why)));
});

test("a `stop` entry holds only its own scenarios; the rest run", () => {
  const config = HOSTS_CONFIG.replace("https://api.qa.example.com", "https://api.example.com");
  const { out } = checkHosts(API_S2, ["app=qa.example.com", "api=api.example.com"], config);
  const api = out.readiness.hosts.find((h) => h.name === "api");
  assert.equal(api.verdict, "stop");
  assert.deepEqual(
    out.readiness.held.map((h) => h.id),
    ["S2"],
  );
  assert.match(out.readiness.held[0].why, /api/);
  assert.deepEqual(
    out.readiness.scenarioHosts.map((s) => s.id),
    ["S1"],
  );
});

test("a scenario that needs an entry the run lacks is held, not given another host", () => {
  // No `api` entry for S2's surface.
  const noApi = HOSTS_CONFIG.replace(
    "    - { name: api, url: https://api.qa.example.com, surface: api }\n",
    "",
  );
  const lacking = checkHosts(API_S2, ["app=qa.example.com"], noApi).out.readiness.held;
  assert.deepEqual(
    lacking.map((h) => h.id),
    ["S2"],
  );
  assert.match(lacking[0].why, /no entry for the `api` surface/);
  // **Service:** names a service the run has no entry for.
  const noBilling = HOSTS_CONFIG.replace(
    "    - { name: billing, url: https://billing.staging.example.com }\n",
    "",
  );
  const missing = checkHosts(BILLING_S2, ["app=qa.example.com"], noBilling).out.readiness.held;
  assert.deepEqual(
    missing.map((h) => h.id),
    ["S2"],
  );
  assert.match(missing[0].why, /no service `billing`/);
});

test("with no `run.hosts`, a **Service:** scenario is held and the rest use the one typed URL", () => {
  const config = HOSTS_CONFIG.split("\n")
    .filter((l) => !/^  hosts:|^    - \{ name: (app|api|billing)/.test(l))
    .join("\n");
  const { out } = checkHosts(BILLING_S2, [], config);
  assert.deepEqual(
    out.readiness.held.map((h) => h.id),
    ["S2"],
  );
  assert.match(out.readiness.held[0].why, /no service `billing`/);
  assert.deepEqual(out.readiness.hosts, []);
});

test("the seeder question is asked once per environment", () => {
  const config = HOSTS_CONFIG.replace("https://api.qa.example.com", "https://qa.example.com/api");
  const { out } = checkHosts(API_S2, [], config);
  assert.deepEqual(
    out.readiness.environments.map((e) => [e.host, e.entries]),
    [
      ["qa.example.com", ["app", "api"]],
      ["billing.staging.example.com", ["billing"]],
    ],
  );
  for (const environment of out.readiness.environments)
    assert.match(environment.question, /did the environment's owner run this repo's seeder/i);
});

test("`--host` for a name `run.hosts` lacks is a usage error", () => {
  const io = { read: reader({ "qa.config.yml": HOSTS_CONFIG }) };
  const result = main(["check", "--for", "run", "--host", "nope=qa.example.com"], io);
  assert.equal(result.code, 2);
  assert.match(result.out, /no `run.hosts` entry named `nope`/);
  assert.equal(main(["check", "--for", "run", "--host", "nope"], io).code, 2);
});

test("`--host` confirms a `run.hosts` entry that only the `--answers` file carries", () => {
  const config = HOSTS_CONFIG.split("\n")
    .filter((line) => !line.includes("billing"))
    .join("\n");
  const answers = {
    run: {
      hosts: [{ name: "billing", url: "https://billing.staging.example.com" }],
    },
  };
  const repo = answersRepo({ "qa.config.yml": config, [ANSWERS_FILE]: answers });
  const unconfirmed = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(unconfirmed.code, 0);
  const confirmed = checkRun(
    repo,
    "--answers",
    ANSWERS_FILE,
    "--host",
    "billing=billing.staging.example.com",
  );
  assert.equal(confirmed.code, 0);
  assert.notDeepEqual(confirmed.result.readiness.hosts, unconfirmed.result.readiness.hosts);
  // A name neither the config nor the answers carry is still a usage error.
  const nope = checkRun(repo, "--answers", ANSWERS_FILE, "--host", "nope=x.example.com");
  assert.equal(nope.code, 2);
  assert.match(nope.result, /no `run.hosts` entry named `nope`/);
});

test("`run.hosts` is read only for a `url` target", () => {
  const config = HOSTS_CONFIG.replace("target: url", "target: stack");
  const { out } = checkHosts(GOOD_PLAN, [], config);
  assert.equal(out.readiness.hosts, undefined);
  assert.ok(out.readiness.notes.some((n) => /`run.hosts` is read only for target `url`/.test(n)));
});

test("a scenario with no surface never binds to a surface-less named service", () => {
  const { held } = resolveHosts(
    [{ name: "billing", url: "https://billing.staging.example.com" }],
    [{ id: "S1", surface: null, service: null }],
    { billing: "billing.staging.example.com" },
  );
  assert.deepEqual(
    held.map((h) => h.id),
    ["S1"],
  );
});

// ── `run.playwright`: Playwright in a subdirectory (#533) ────────────────────

/** Writes a fake Playwright with Chromium into `dir` under `repo`. */
function installFakePlaywright(repo, subdir = ".") {
  const baseDir = subdir === "." ? repo : join(repo, subdir);
  const pkgDir = join(baseDir, "node_modules", "playwright");
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(baseDir, "package.json"), JSON.stringify({ name: "fake-app" }));
  const browser = join(baseDir, "chromium-bin");
  writeFileSync(browser, "");
  writeFileSync(
    join(pkgDir, "index.js"),
    `module.exports = { chromium: { executablePath: () => ${JSON.stringify(browser)} } };\n`,
  );
}

test("`run.playwright` refuses `/abs`, `../x`, and a folder with no `package.json`", () => {
  for (const bad of ["/abs", "../x", ""]) {
    const read = yaml("run:", `  playwright: ${JSON.stringify(bad)}`);
    assert.deepEqual(
      read.runProblems.map((p) => p.replace(/^line \d+: /, "").split(":")[0]),
      ["`run.playwright`"],
      bad,
    );
  }
  const missingPkg = answersRepo({ "qa.config.yml": "run:\n  playwright: react-frontend\n" });
  mkdirSync(join(missingPkg, "react-frontend"), { recursive: true });
  const res = checkRun(missingPkg);
  assert.equal(res.code, 1);
  assert.match(res.result.problems[0], /^line 2: `run\.playwright`:.*package\.json/);

  const jsonBad = parseConfig(
    "qa.config.json",
    JSON.stringify({ run: { playwright: "../outside" } }),
  );
  assert.match(jsonBad.runProblems[0], /^`run\.playwright`:/);
});

test("with Playwright only in `react-frontend` and `run.playwright: react-frontend`, `check --for run` reports it installed", () => {
  const repo = answersRepo({
    "qa.config.yml": `${STACK_RUN.join("\n")}\n  playwright: react-frontend\n`,
  });
  installFakePlaywright(repo, "react-frontend");
  const { code, result } = checkRun(repo);
  assert.equal(code, 0, JSON.stringify(result));
  assert.deepEqual(result.problems, []);
  assert.ok(result.readiness.notes.includes(WEB_NOTES.chromium));
  assert.equal(result.effective.run.playwright, "react-frontend");
});

test("without `run.playwright`, a first-level subfolder with Playwright is hinted, never guessed, and deeper ones are ignored", () => {
  const repo = answersRepo({ "qa.config.yml": `${STACK_RUN.join("\n")}\n` });
  installFakePlaywright(repo, "react-frontend");
  installFakePlaywright(repo, "apps/nested-frontend");
  const { code, result } = checkRun(repo);
  assert.equal(code, 0, JSON.stringify(result));
  assert.equal(
    result.readiness.notes.includes(
      "`web`: no Playwright with Chromium at the repository root; `react-frontend` has it: set `run.playwright: react-frontend`",
    ),
    true,
    JSON.stringify(result.readiness.notes),
  );
  assert.equal(result.readiness.notes.includes(WEB_NOTES.chromium), false);
  assert.equal(
    result.readiness.notes.some((n) => n.includes("nested-frontend")),
    false,
    "must not search deeper than one folder level",
  );
});

test("`run.playwright` as a run answer (`--answers`) is used and shown in `Run answers reused`", () => {
  const repo = answersRepo({
    "qa.config.yml": `${STACK_RUN.join("\n")}\n`,
    [ANSWERS_FILE]: { run: { playwright: "react-frontend" } },
  });
  installFakePlaywright(repo, "react-frontend");
  const { code, result } = checkRun(repo, "--answers", ANSWERS_FILE);
  assert.equal(code, 0, JSON.stringify(result));
  assert.equal(result.effective.run.playwright, "react-frontend");
  assert.ok(result.readiness.notes.includes(WEB_NOTES.chromium));
  assert.equal(
    result.answers.reused,
    `Run answers reused from ${ANSWERS_FILE}: run.playwright="react-frontend"`,
  );

  // Invalid answer is refused too.
  const badRepo = answersRepo({
    [ANSWERS_FILE]: { run: { playwright: "missing-dir" } },
  });
  const bad = checkRun(badRepo, "--answers", ANSWERS_FILE);
  assert.equal(bad.code, 1);
  assert.match(bad.result.problems[0], /^the answers: `run\.playwright`:/);
});

test("Playwright at the repository root with no `run.playwright` behaves as before", () => {
  const repo = answersRepo({ "qa.config.yml": `${STACK_RUN.join("\n")}\n` });
  installFakePlaywright(repo, ".");
  const { code, result } = checkRun(repo);
  assert.equal(code, 0, JSON.stringify(result));
  assert.ok(result.readiness.notes.includes(WEB_NOTES.chromium));
  assert.equal(result.effective.run.playwright, undefined);
});

test("`run.playwright` with backslashes (`apps\\\\web`) resolves consistently in check and resolvePlaywright", () => {
  const repo = answersRepo({
    "qa.config.yml": `${STACK_RUN.join("\n")}\n  playwright: 'apps\\web'\n`,
  });
  installFakePlaywright(repo, "apps/web");
  const { code, result } = checkRun(repo);
  assert.equal(code, 0, JSON.stringify(result));
  assert.deepEqual(result.problems, []);
  assert.ok(result.readiness.notes.includes(WEB_NOTES.chromium));

  const resolved = resolvePlaywright(repo);
  assert.equal(resolved.error, null);
  assert.equal(resolved.found.chromium, true);
});
