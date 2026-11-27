/**
 * Contract suite for the orchestrate records script. The claims under test:
 * a Run Event is appended with the clock's time and a closed set of typed
 * fields; the Run Record derived from a run's events carries the expected
 * counts, causes and durations; a record that holds free text or a field
 * outside the schema is refused with the field named, never stripped; and
 * the record is written outside the run folder. Every test goes through
 * `main(argv, io)` with an injected clock, files root and transport.
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, afterEach, describe, it } from "node:test";
import { request } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HEARTBEAT_MINUTES } from "./pages/board.mjs";
import { routeOf, switcherFor } from "./pages/shell.mjs";

import {
  CAUSES,
  EVENT_KINDS,
  STEP_KINDS,
  checkEvent,
  checkRecord,
  main,
  openSink,
  parseSinkPath,
  rawExpiry,
  repoFromRemote,
  signRequest,
} from "./records.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "fixtures", "records", "2026-11-19-spec-344");
const RUN = "2026-11-19-spec-344";
const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A temp files root holding a copy of the spec-344 run folder under `tmp/orchestrate/`. */
function root() {
  const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
  made.push(dir);
  cpSync(FIXTURE, join(dir, "tmp", "orchestrate", RUN), { recursive: true });
  return dir;
}
const runFolder = (dir) => join(dir, "tmp", "orchestrate", RUN);
const recordPath = (dir) => join(dir, "tmp", "orchestrate", "records", `${RUN}.json`);
const at = (iso) => () => new Date(iso);
const derive = (dir, io = {}) =>
  main(["derive", `tmp/orchestrate/${RUN}`], {
    cwd: dir,
    env: { ORCHESTRATE_OPERATOR: "naim" },
    ...io,
  });
const derived = async (dir = root(), io) => {
  const result = await derive(dir, io);
  assert.equal(result.code, 0, result.out);
  return JSON.parse(readFileSync(recordPath(dir), "utf8"));
};

describe("event: append one Run Event", () => {
  it("appends a line with the clock's time, the kind, the actor and the typed fields", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    const file = "tmp/orchestrate/r/delegations/d12/events.jsonl";
    const result = await main(
      [
        "event",
        "--file",
        file,
        "--kind",
        "delegation-landed",
        "--actor",
        "delegation",
        "--delegation",
        "d12",
        "--head",
        "6fc67d7",
      ],
      { cwd: dir, now: at("2026-11-25T10:00:00.500Z") },
    );
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, file), "utf8")), {
      at: "2026-11-25T10:00:00Z",
      kind: "delegation-landed",
      delegation: "d12",
      head: "6fc67d7",
      actor: "delegation",
    });
  });

  it("appends: a second event goes on a new line and the first is kept", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    const file = "events.jsonl";
    for (const minute of ["01", "02"])
      await main(
        [
          "event",
          "--file",
          file,
          "--kind",
          "pull-request",
          "--actor",
          "chief-of-staff",
          "--pr",
          "387",
        ],
        {
          cwd: dir,
          now: at(`2026-11-25T10:${minute}:00Z`),
        },
      );
    const lines = readFileSync(join(dir, file), "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.deepEqual(
      lines.map((l) => JSON.parse(l).at),
      ["2026-11-25T10:01:00Z", "2026-11-25T10:02:00Z"],
    );
  });

  const refused = [
    ["a field outside the schema", ["--kind", "pull-request", "--pr", "1", "--note", "x"], "note"],
    [
      "free text where an id belongs",
      ["--kind", "decision-request", "--id", "should the export keep the old order"],
      "id",
    ],
    ["a typed time", ["--kind", "pull-request", "--pr", "1", "--at", "2026-01-01T00:00:00Z"], "at"],
    ["a number that is not a number", ["--kind", "pull-request", "--pr", "seven"], "pr"],
    [
      "an unknown cause",
      [
        "--kind",
        "human-step",
        "--step-kind",
        "merge",
        "--cause",
        "the human was slow",
        "--how",
        "chat",
      ],
      "cause",
    ],
    ["an unknown kind", ["--kind", "lunch"], "kind"],
    ["a kind named after an object property", ["--kind", "constructor"], "kind"],
    ["a kind named `toString`", ["--kind", "toString"], "kind"],
    ["a missing required field", ["--kind", "pull-request"], "pr"],
  ];
  for (const [name, args, field] of refused)
    it(`refuses ${name}, naming \`${field}\`, and writes nothing`, async () => {
      const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
      made.push(dir);
      const result = await main(["event", "--file", "events.jsonl", "--actor", "human", ...args], {
        cwd: dir,
      });
      assert.equal(result.code, 1, result.out);
      assert.match(result.out, new RegExp(`(^|\\n)${field}:`));
      assert.equal(existsSync(join(dir, "events.jsonl")), false);
    });

  it("refuses one flag written once with `-` and once with `_` (D9)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    const result = await main(
      [
        "event",
        "--file",
        "events.jsonl",
        "--kind",
        "ci",
        "--actor",
        "chief-of-staff",
        "--pr",
        "7",
        "--head",
        "a".repeat(40),
        "--result",
        "fail",
        "--failed-checks",
        "1",
        "--failed_checks",
        "2",
      ],
      { cwd: dir },
    );
    assert.equal(result.code, 2, result.out);
    assert.match(result.out, /^usage: node records\.mjs event/);
    assert.equal(existsSync(join(dir, "events.jsonl")), false);
  });

  it("refuses a repeated flag with the usage line, and writes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    const result = await main(
      [
        "event",
        "--file",
        "events.jsonl",
        "--kind",
        "send-back",
        "--kind",
        "run-closed",
        "--actor",
        "chief-of-staff",
      ],
      { cwd: dir },
    );
    assert.equal(result.code, 2, result.out);
    assert.match(result.out, /^usage: node records\.mjs event/);
    // The usage line names each kind's field flags, from the schema (C19).
    assert.match(result.out, /\n {4}write: \[--delegation\] --write-kind --as-human\n/);
    assert.match(
      result.out,
      /\n {4}wait-opened: --wait-id \[--delegation\] --step-kind --cause --how/,
    );
    assert.match(result.out, /\n {4}heartbeat: none\n/);
    for (const kind of Object.keys(EVENT_KINDS))
      assert.match(result.out, new RegExp(`\\n {4}${kind}: `), kind);
    assert.equal(existsSync(join(dir, "events.jsonl")), false);
  });

  it("checkEvent refuses a kind named after an object property", () => {
    for (const kind of ["constructor", "toString", "__proto__", "hasOwnProperty"])
      assert.deepEqual(
        checkEvent({ at: "2026-11-25T10:00:00Z", kind, actor: "human" }),
        [`kind: must be one of ${Object.keys(EVENT_KINDS).join(" | ")}`],
        kind,
      );
  });

  it("refuses an event with no actor, and a file not named events.jsonl", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    const none = await main(
      ["event", "--file", "events.jsonl", "--kind", "pull-request", "--pr", "1"],
      { cwd: dir },
    );
    assert.equal(none.code, 1);
    assert.match(none.out, /actor: is missing/);
    const named = await main(
      ["event", "--file", "notes.md", "--kind", "pull-request", "--actor", "human", "--pr", "1"],
      { cwd: dir },
    );
    assert.equal(named.code, 2);
  });

  it("has one entry for each kind the prose names", () => {
    assert.deepEqual(Object.keys(EVENT_KINDS).sort(), [
      "ci",
      "decision-request",
      "delegation-ended",
      "delegation-landed",
      "delegation-started",
      "heartbeat",
      "human-step",
      "plan-approved",
      "pull-request",
      "qa-result",
      "review",
      "ruling-made",
      "ruling-verdict",
      "run-closed",
      "run-opened",
      "send-back",
      "wait-closed",
      "wait-opened",
      "write",
    ]);
  });
});

describe("derive: the Run Record from a Run Event stream", () => {
  it("derives the spec-344 record with the expected run, counts and durations", async () => {
    const record = await derived();
    assert.equal(record.schema, "run-record/1");
    const { run } = record;
    assert.equal(run.id, RUN);
    assert.equal(run.repo, "github.com/mnaimfaizy/agent-kit");
    assert.equal(run.operator, "naim");
    assert.deepEqual(
      [
        run.kind,
        run.spec,
        run.team,
        run.harness,
        run.support_level,
        run.decision_authority,
        run.landing,
        run.outcome,
      ],
      [
        "spec",
        344,
        false,
        "claude-code-desktop",
        "verified",
        "autonomous",
        "integration-branch",
        "merged",
      ],
    );
    assert.deepEqual(run.tickets, [348, 349, 350, 351, 352, 353]);
    assert.deepEqual(run.pull_requests, [387]);
    assert.deepEqual(
      [run.started_at, run.plan_approved_at, run.closed_at, run.duration_seconds, run.open_waits],
      ["2026-11-19T01:44:00Z", "2026-11-19T03:08:30Z", "2026-11-19T06:27:30Z", 17010, 0],
    );
    assert.equal(Object.hasOwn(run, "team_run"), false);
    assert.deepEqual(record.rulings, { made: 0, upheld: 0, overturned: 0 });
    assert.deepEqual(
      record.reviews.map((r) => [r.round, r.findings, r.fixed]),
      [
        [1, 7, 7],
        [2, 1, 1],
        [3, 0, 0],
      ],
    );
    assert.deepEqual(
      record.ci.map((c) => c.head),
      ["75aa766", "b3609bb", "b779e0c"],
    );
    assert.equal(checkRecord(record).length, 0);
  });

  it("carries each Delegation's Executor kind, model, route and its real start and end", async () => {
    const { delegations } = await derived();
    assert.deepEqual(
      delegations.map((d) => [
        d.id,
        d.kind,
        d.executor,
        d.model,
        d.start_route,
        d.started_at,
        d.ended_at,
        d.duration_seconds,
      ]),
      [
        [
          "d344-fix1",
          "fix",
          "live-session",
          "default",
          "card",
          "2026-11-19T05:06:23Z",
          "2026-11-19T06:08:30Z",
          3727,
        ],
        [
          "d348",
          "building",
          "live-session",
          "default",
          "direct",
          "2026-11-19T03:09:50Z",
          "2026-11-19T03:15:10Z",
          320,
        ],
        [
          "d349",
          "building",
          "live-session",
          "default",
          "direct",
          "2026-11-19T03:19:40Z",
          "2026-11-19T03:26:40Z",
          420,
        ],
        [
          "d350",
          "building",
          "live-session",
          "default",
          "card",
          "2026-11-19T03:33:20Z",
          "2026-11-19T03:42:10Z",
          530,
        ],
        [
          "d351",
          "building",
          "live-session",
          "default",
          "card",
          "2026-11-19T03:49:30Z",
          "2026-11-19T03:57:30Z",
          480,
        ],
        [
          "d352",
          "building",
          "live-session",
          "default",
          "card",
          "2026-11-19T04:04:20Z",
          "2026-11-19T04:08:00Z",
          220,
        ],
        [
          "d353",
          "building",
          "live-session",
          "default",
          "card",
          "2026-11-19T04:23:50Z",
          "2026-11-19T04:29:20Z",
          330,
        ],
      ].sort((a, b) => (a[5] < b[5] ? -1 : 1)),
    );
    const fix = delegations.find((d) => d.id === "d344-fix1");
    assert.deepEqual(
      [fix.send_backs, fix.landed_at, fix.outcome],
      [1, "2026-11-19T05:23:04Z", "landed"],
    );
  });

  it("counts one human step per touch, each with its cause, avoidability, wait and covered Decision Requests", async () => {
    const record = await derived();
    assert.deepEqual(record.summary, {
      human_steps: 13,
      avoidable: 9,
      by_design: 4,
      by_cause: {
        "by-design": 4,
        "harness-limit": 5,
        "missing-config": 1,
        "spec-gap": 1,
        "permission-refusal": 2,
      },
      human_wait_seconds: 6791,
    });
    const steps = record.human_steps;
    assert.deepEqual(
      steps.map((s) => s.kind),
      [
        "plan-approval",
        "card-start",
        "card-start",
        "card-start",
        "card-start",
        "decision-request",
        "decision-request",
        "card-start",
        "post-replies",
        "post-replies",
        "merge",
        "close-out",
        "close-out",
      ],
    );
    const batch = steps.find((s) => s.wait_id === "w7");
    assert.deepEqual(
      [batch.covers, batch.waited_seconds, batch.cause, batch.avoidable],
      [["dr3", "dr4", "dr5"], 1090, "spec-gap", true],
    );
    const card = steps.find((s) => s.wait_id === "w5");
    assert.deepEqual(
      [card.delegation, card.cause, card.how, card.card, card.waited_seconds, card.actor],
      ["d353", "harness-limit", "card", "task_e0243937", 920, "human"],
    );
    const plan = steps[0];
    assert.deepEqual(
      [plan.delegation, plan.cause, plan.avoidable, plan.how],
      [null, "by-design", false, "chat"],
    );
    const closeOut = steps.at(-1);
    assert.deepEqual([closeOut.wait_id, closeOut.waited_seconds], [null, null]);
  });

  it("records every write with its actor, so a write made with the human's login is not the human's", async () => {
    const { writes } = await derived();
    assert.equal(writes.length, 5);
    assert.ok(writes.every((w) => w.actor === "chief-of-staff" && w.as_human === true));
  });

  it("writes the record outside the run folder, and deleting the folder leaves it", async () => {
    const dir = root();
    const record = await derived(dir);
    const path = recordPath(dir);
    assert.equal(path.startsWith(`${runFolder(dir)}/`), false);
    assert.deepEqual(readdirSync(join(dir, "tmp", "orchestrate", "records")), [`${RUN}.json`]);
    rmSync(runFolder(dir), { recursive: true });
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), record);
  });

  it("derives the same record twice", async () => {
    const dir = root();
    await derived(dir);
    const one = readFileSync(recordPath(dir), "utf8");
    await derived(dir);
    assert.equal(readFileSync(recordPath(dir), "utf8"), one);
  });
});

describe("derive: the spec-253 stream, a relay run with six QA Delegations (F18)", () => {
  // Rebuilt from the hand-derived record on `prototype/run-record-fields`, as spec-344's was. That
  // record gives most times as a local date only, so those events carry times placed in its order;
  // it names no card id, so the three card starts carry `task_<delegation>`; its one follow-up
  // posted after the run closed, and its one "ruling" (a standing human answer applied, in a relay
  // run), are left out.
  const RUN_253 = "2026-11-17-spec-253";
  const derive253 = async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    cpSync(join(here, "fixtures", "records", RUN_253), join(dir, "tmp", "orchestrate", RUN_253), {
      recursive: true,
    });
    const result = await main(["derive", `tmp/orchestrate/${RUN_253}`], {
      cwd: dir,
      env: { ORCHESTRATE_OPERATOR: "naim" },
    });
    assert.equal(result.code, 0, result.out);
    return JSON.parse(
      readFileSync(join(dir, "tmp", "orchestrate", "records", `${RUN_253}.json`), "utf8"),
    );
  };

  it("derives the run: relay authority, per-ticket landing, five pull requests, merged", async () => {
    const { run } = await derive253();
    assert.deepEqual(
      [run.kind, run.spec, run.decision_authority, run.landing, run.outcome, run.open_waits],
      ["spec", 253, "relay", "per-ticket", "merged", 0],
    );
    assert.deepEqual(run.pull_requests, [270, 271, 272, 277, 282]);
    assert.equal(run.plan_approved_at, "2026-11-17T08:28:25Z");
    assert.equal(run.closed_at, "2026-11-18T02:14:54Z");
  });

  it("has the five building and six QA Delegations, three QA ones started from a card", async () => {
    const { delegations } = await derive253();
    const qa = delegations.filter((d) => d.kind === "qa");
    assert.equal(delegations.filter((d) => d.kind === "building").length, 5);
    assert.deepEqual(qa.map((d) => d.id).sort(), [
      "d255-qa",
      "d255-qa2",
      "d256-qa",
      "d257-qa",
      "d258-qa",
      "d259-qa",
    ]);
    assert.deepEqual(
      qa
        .filter((d) => d.start_route === "card")
        .map((d) => d.id)
        .sort(),
      ["d256-qa", "d257-qa", "d258-qa"],
    );
    // The first QA of #255 was voided when its head moved, so it has no `qa-result`.
    assert.equal(delegations.find((d) => d.id === "d255-qa").outcome, "abandoned");
  });

  it("carries each qa-result, and the QA human steps by their qa- kinds", async () => {
    const record = await derive253();
    assert.deepEqual(
      record.qa.map((q) => [q.delegation, q.target, q.route, q.result]),
      ["d255-qa2", "d256-qa", "d258-qa", "d259-qa", "d257-qa"].map((d) => [
        d,
        "stack",
        "typed",
        "pass",
      ]),
    );
    const kinds = {};
    for (const s of record.human_steps) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
    assert.deepEqual(
      [kinds["qa-command"], kinds["qa-readiness"], kinds["qa-plan-delivery"], kinds["qa-held"]],
      [12, 5, 6, 6],
    );
    assert.equal(kinds["card-start"], 3);
    assert.equal(kinds.merge, 6);
  });

  it("counts 64 human steps, its 19 review rounds and 6 CI results", async () => {
    const record = await derive253();
    assert.equal(record.summary.human_steps, 64);
    assert.equal(record.summary.by_design + record.summary.avoidable, 64);
    assert.equal(record.reviews.length, 19);
    assert.equal(record.ci.length, 6);
    assert.deepEqual(record.rulings, { made: 0, upheld: 0, overturned: 0 });
  });
});

describe("derive: who the operator is", () => {
  const noEnv = { env: {} };
  const exec = (log, answers) => (command, args) => {
    log.push([command, ...args].join(" "));
    return answers[command] ?? { code: 1, out: "" };
  };

  it("is the `gh api user` login on GitHub", async () => {
    const log = [];
    const record = await derived(root(), {
      ...noEnv,
      exec: exec(log, { gh: { code: 0, out: '{"login":"sam"}' } }),
    });
    assert.equal(record.run.operator, "sam");
    assert.deepEqual(log, ["gh api user"]);
  });

  it("is the `glab api user` username on GitLab", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"tracker":"github"', '"tracker":"gitlab"'),
    );
    const log = [];
    const record = await derived(dir, {
      ...noEnv,
      exec: exec(log, { glab: { code: 0, out: '{"username":"kim"}' } }),
    });
    assert.equal(record.run.operator, "kim");
    assert.deepEqual(log, ["glab api user"]);
  });

  it("is ORCHESTRATE_OPERATOR when set, and the tracker CLI is not asked", async () => {
    const log = [];
    const record = await derived(root(), {
      env: { ORCHESTRATE_OPERATOR: "lee" },
      exec: exec(log, {}),
    });
    assert.equal(record.run.operator, "lee");
    assert.deepEqual(log, []);
  });

  it("is null, with a note, when there is no login: the record is kept, and nothing could be uploaded", async () => {
    const dir = root();
    const result = await derive(dir, { ...noEnv, exec: exec([], {}) });
    assert.equal(result.code, 0);
    assert.match(result.out, /run\.operator is null/);
    assert.equal(JSON.parse(readFileSync(recordPath(dir), "utf8")).run.operator, null);
  });

  it("is never taken from any other environment variable", async () => {
    const record = await derived(root(), {
      env: { USER: "root", LOGNAME: "root", GITHUB_ACTOR: "bot" },
      exec: exec([], { gh: { code: 0, out: '{"login":"sam"}' } }),
    });
    assert.equal(record.run.operator, "sam");
  });

  it("names the repository from the origin remote when the run did not", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"repo":"github.com/mnaimfaizy/agent-kit",', ""),
    );
    const git = (command, args) =>
      args.includes("get-url")
        ? { code: 0, out: "git@GitHub.com:Acme/Widgets.git\n" }
        : { code: 0, out: "upstream\norigin\n" };
    const record = await derived(dir, { exec: git });
    assert.equal(record.run.repo, "github.com/acme/widgets");
  });

  it("reads host/owner/repo from https, ssh and scp-style remotes", () => {
    assert.equal(repoFromRemote("https://github.com/Acme/Widgets.git"), "github.com/acme/widgets");
    assert.equal(
      repoFromRemote("ssh://git@ghe.example.com:2222/acme/widgets"),
      "ghe.example.com/acme/widgets",
    );
    assert.equal(
      repoFromRemote("git@gitlab.com:group/sub/widgets.git"),
      "gitlab.com/group/sub/widgets",
    );
    assert.equal(repoFromRemote("nonsense"), null);
  });

  it("reads an all-digit owner in an scp-style remote as the owner, not a port", () => {
    assert.equal(repoFromRemote("git@github.com:12345/repo.git"), "github.com/12345/repo");
    assert.equal(repoFromRemote("gitlab.com:12345/sub/repo"), "gitlab.com/12345/sub/repo");
    // A port is read only after a scheme.
    assert.equal(
      repoFromRemote("https://ghe.example.com:8443/12345/repo.git"),
      "ghe.example.com/12345/repo",
    );
  });
});

describe("derive: Team Runs, takeovers and waits on a teammate", () => {
  it("carries team, spec and took_over, with no run.team_run", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8")
        .replace('"run_kind":"spec"', '"run_kind":"team"')
        .replace('"team":false', '"team":true,"took_over":["2026-11-18-spec-344"]'),
    );
    const { run } = await derived(dir);
    assert.deepEqual(
      [run.kind, run.spec, run.team, run.took_over],
      ["team", 344, true, ["2026-11-18-spec-344"]],
    );
    assert.equal(Object.hasOwn(run, "team_run"), false);
  });

  it("records a ticket parked on a teammate's ticket as a by-design wait with the blocker's id and login", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    const args = (more) => [
      "event",
      "--file",
      `tmp/orchestrate/${RUN}/events.jsonl`,
      "--actor",
      "chief-of-staff",
      ...more,
    ];
    await main(
      args([
        "--kind",
        "wait-opened",
        "--wait-id",
        "w20",
        "--delegation",
        "d353",
        "--step-kind",
        "teammate-blocker",
        "--cause",
        "teammate-blocker",
        "--how",
        "github",
        "--blocker",
        "355",
        "--blocker-login",
        "sam",
      ]),
      { cwd: dir, now: at("2026-11-19T06:20:00Z") },
    );
    await main(args(["--kind", "wait-closed", "--wait-id", "w20"]), {
      cwd: dir,
      now: at("2026-11-19T06:25:00Z"),
    });
    const record = await derived(dir);
    const step = record.human_steps.find((s) => s.wait_id === "w20");
    assert.deepEqual(
      [
        step.cause,
        step.avoidable,
        step.blocker,
        step.blocker_login,
        step.waited_seconds,
        step.actor,
      ],
      ["teammate-blocker", false, 355, "sam", 300, "chief-of-staff"],
    );
    assert.equal(record.summary.human_steps, 13, "a wait on a teammate is not a human step");
  });

  it("counts a wait still open at close-out, and does not make it a step", async () => {
    const dir = root();
    await main(
      [
        "event",
        "--file",
        `tmp/orchestrate/${RUN}/events.jsonl`,
        "--kind",
        "wait-opened",
        "--actor",
        "chief-of-staff",
        "--wait-id",
        "w30",
        "--step-kind",
        "merge",
        "--cause",
        "by-design",
        "--how",
        "github",
      ],
      { cwd: dir, now: at("2026-11-19T06:20:00Z") },
    );
    const record = await derived(dir);
    assert.equal(record.run.open_waits, 1);
    assert.equal(
      record.human_steps.some((s) => s.wait_id === "w30"),
      false,
    );
  });
});

describe("derive: waits and Rulings as Run Events", () => {
  /** Append one event to the Chief of Staff's events file at a clock time. */
  const emit = (dir, time, more, actor = "chief-of-staff") =>
    main(["event", "--file", `tmp/orchestrate/${RUN}/events.jsonl`, "--actor", actor, ...more], {
      cwd: dir,
      now: at(time),
    });
  const wait = (id, extra) => ["--kind", "wait-opened", "--wait-id", id, ...extra];

  it("derives a run-level wait with delegation null, its how and its waited seconds", async () => {
    const dir = root();
    await emit(
      dir,
      "2026-11-19T06:10:00Z",
      wait("w40", ["--step-kind", "review-label", "--cause", "by-design", "--how", "github"]),
    );
    await emit(dir, "2026-11-19T06:12:30Z", ["--kind", "wait-closed", "--wait-id", "w40"], "human");
    const step = (await derived(dir)).human_steps.find((s) => s.wait_id === "w40");
    assert.deepEqual(
      [step.delegation, step.kind, step.how, step.waited_seconds, step.actor, step.avoidable],
      [null, "review-label", "github", 150, "human", false],
    );
  });

  it("derives a refused card start as a harness-limit wait with the card's id, avoidable", async () => {
    const dir = root();
    const step = (await derived(dir)).human_steps.find((s) => s.wait_id === "w2");
    assert.deepEqual(
      [step.cause, step.how, step.card, step.avoidable, step.delegation],
      ["harness-limit", "card", "task_184e1773", true, "d350"],
    );
  });

  it("refuses a harness-limit wait that names no card", async () => {
    const dir = root();
    await emit(
      dir,
      "2026-11-19T06:10:00Z",
      wait("w41", ["--step-kind", "card-start", "--cause", "harness-limit", "--how", "card"]),
    );
    await emit(dir, "2026-11-19T06:11:00Z", ["--kind", "wait-closed", "--wait-id", "w41"], "human");
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /human_steps: a `harness-limit` step must name its `card`/);
    assert.equal(existsSync(recordPath(dir)), false);
  });

  it("refuses an open harness-limit wait that names no card, though it never becomes a step", async () => {
    const dir = root();
    await emit(
      dir,
      "2026-11-19T06:10:00Z",
      wait("w45", ["--step-kind", "card-start", "--cause", "harness-limit", "--how", "card"]),
    );
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /a `harness-limit` step must name its `card`/);
  });

  it("refuses a teammate-blocker wait with no blocker ticket or login, or on another step kind", async () => {
    const dir = root();
    await emit(
      dir,
      "2026-11-19T06:10:00Z",
      wait("w42", ["--step-kind", "other", "--cause", "teammate-blocker", "--how", "github"]),
    );
    await emit(dir, "2026-11-19T06:11:00Z", ["--kind", "wait-closed", "--wait-id", "w42"]);
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /a `teammate-blocker` step must have step kind `teammate-blocker`/);
    assert.match(
      result.out,
      /a `teammate-blocker` step must name its `blocker` ticket and `blocker_login`/,
    );
  });

  it("never counts a by-design cause as avoidable", async () => {
    const record = await derived();
    for (const s of record.human_steps) assert.equal(s.avoidable, CAUSES[s.cause] === "avoidable");
    assert.equal(record.summary.avoidable + record.summary.by_design, record.summary.human_steps);
  });

  it("derives the Rulings counts from ruling-made and ruling-verdict, and each Delegation's own", async () => {
    const dir = root();
    for (const [n, who] of [
      ["R1", "d350"],
      ["R2", "d350"],
      ["R3", "d351"],
    ])
      await emit(dir, "2026-11-19T06:00:00Z", [
        "--kind",
        "ruling-made",
        "--delegation",
        who,
        "--ruling",
        n,
      ]);
    await emit(
      dir,
      "2026-11-19T06:05:00Z",
      ["--kind", "ruling-verdict", "--ruling", "R1", "--verdict", "upheld"],
      "human",
    );
    await emit(
      dir,
      "2026-11-19T06:05:00Z",
      ["--kind", "ruling-verdict", "--ruling", "R2", "--verdict", "overturned"],
      "human",
    );
    const record = await derived(dir);
    assert.deepEqual(record.rulings, { made: 3, upheld: 1, overturned: 1 });
    assert.deepEqual(
      record.delegations.filter((d) => d.rulings).map((d) => [d.id, d.rulings]),
      [
        ["d350", 2],
        ["d351", 1],
      ],
    );
  });

  it("refuses a verdict for a Ruling nobody made", async () => {
    const dir = root();
    await emit(
      dir,
      "2026-11-19T06:05:00Z",
      ["--kind", "ruling-verdict", "--ruling", "R9", "--verdict", "upheld"],
      "human",
    );
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /ruling-verdict: `R9` has no `ruling-made` event before it/);
  });

  it("reports each wait still open at close-out by id and step kind", async () => {
    const dir = root();
    await emit(
      dir,
      "2026-11-19T06:20:00Z",
      wait("w43", ["--step-kind", "merge", "--cause", "by-design", "--how", "github"]),
    );
    const result = await derive(dir);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /1 waits still open: w43 \(merge\)/);
  });

  it("refuses prose in every new field, naming it", async () => {
    const dir = root();
    for (const [field, kind, extra] of [
      [
        "blocker-login",
        "wait-opened",
        [
          "--wait-id",
          "w44",
          "--step-kind",
          "teammate-blocker",
          "--cause",
          "teammate-blocker",
          "--how",
          "github",
          "--blocker",
          "355",
        ],
      ],
      [
        "card",
        "wait-opened",
        [
          "--wait-id",
          "w44",
          "--step-kind",
          "card-start",
          "--cause",
          "harness-limit",
          "--how",
          "card",
        ],
      ],
      ["ruling", "ruling-made", ["--delegation", "d350"]],
    ]) {
      const result = await emit(dir, "2026-11-19T06:20:00Z", [
        "--kind",
        kind,
        ...extra,
        `--${field}`,
        "please start this card now",
      ]);
      assert.equal(result.code, 1, field);
      assert.match(result.out, new RegExp(field.replaceAll("-", "_")));
    }
  });
});

describe("derive: ordering, summary and by-design steps", () => {
  it("puts a Delegation's start before a Chief of Staff event of the same second that names it", async () => {
    const dir = root();
    const stamp = "2026-11-19T06:20:00Z";
    appendFileSync(
      join(runFolder(dir), "events.jsonl"),
      `${JSON.stringify({ at: stamp, kind: "send-back", actor: "chief-of-staff", delegation: "d777" })}\n`,
    );
    mkdirSync(join(runFolder(dir), "delegations", "d777"), { recursive: true });
    writeFileSync(
      join(runFolder(dir), "delegations", "d777", "events.jsonl"),
      `${JSON.stringify({ at: stamp, kind: "delegation-started", actor: "delegation", delegation: "d777", delegation_kind: "fix", executor: "headless", model: "default", start_route: "direct" })}\n`,
    );
    const record = await derived(dir);
    assert.equal(record.delegations.find((d) => d.id === "d777").send_backs, 1);
  });

  it("counts only human steps in the totals, so a wait on a teammate is not in by_cause", async () => {
    const dir = root();
    const a = [
      "event",
      "--file",
      `tmp/orchestrate/${RUN}/events.jsonl`,
      "--actor",
      "chief-of-staff",
    ];
    await main(
      [
        ...a,
        "--kind",
        "wait-opened",
        "--wait-id",
        "w20",
        "--step-kind",
        "teammate-blocker",
        "--cause",
        "teammate-blocker",
        "--how",
        "github",
        "--blocker",
        "355",
        "--blocker-login",
        "sam",
      ],
      { cwd: dir, now: at("2026-11-19T06:20:00Z") },
    );
    await main([...a, "--kind", "wait-closed", "--wait-id", "w20"], {
      cwd: dir,
      now: at("2026-11-19T06:25:00Z"),
    });
    const { summary } = await derived(dir);
    assert.equal(summary.by_cause["teammate-blocker"], undefined);
    assert.equal(summary.human_wait_seconds, 6791);
  });

  it("refuses a plan-approval or close-out step whose cause is not by-design", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(
        '"step_kind":"plan-approval","cause":"by-design"',
        '"step_kind":"plan-approval","cause":"human-choice"',
      ),
    );
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /a `plan-approval` step must have cause `by-design`/);
  });

  it("is null for a login that is not a login, rather than failing the derive", async () => {
    const record = await derived(root(), {
      env: {},
      exec: () => ({ code: 0, out: '{"login":"not a login!"}' }),
    });
    assert.equal(record.run.operator, null);
  });
});

describe("derive: the cause list", () => {
  it("marks each cause avoidable or by design, and only by-design and teammate-blocker are by design", () => {
    assert.deepEqual(
      Object.entries(CAUSES)
        .filter(([, v]) => v === "by-design")
        .map(([k]) => k)
        .sort(),
      ["by-design", "teammate-blocker"],
    );
    assert.ok(Object.values(CAUSES).every((v) => v === "avoidable" || v === "by-design"));
    for (const cause of [
      "harness-limit",
      "permission-refusal",
      "tool-missing",
      "skill-bug",
      "spec-gap",
      "missing-config",
      "human-choice",
    ])
      assert.equal(CAUSES[cause], "avoidable");
  });

  it("groups QA step kinds under a `qa-` prefix and folds the rare ones into `other`", () => {
    assert.ok(STEP_KINDS.includes("other"));
    assert.ok(STEP_KINDS.filter((k) => k.startsWith("qa-")).length >= 4);
  });
});

describe("the safe-field check", () => {
  const good = async () => derived();

  it("refuses a free-text field, naming it, and never strips it", async () => {
    const record = await good();
    record.human_steps[2].reason = "the harness refused to start the session";
    const problems = checkRecord(record);
    assert.deepEqual(problems, ["human_steps[2].reason: is outside the schema"]);
    assert.equal(Object.hasOwn(record.human_steps[2], "reason"), true);
  });

  it("refuses prose in a field the schema does hold, naming the field and not repeating the prose", async () => {
    const record = await good();
    record.run.harness = "Claude Code on my laptop";
    record.delegations[0].model = "the big one";
    const problems = checkRecord(record);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /^run\.harness: .*free text/);
    assert.match(problems[1], /^delegations\[0\]\.model: /);
    assert.ok(problems.every((p) => !p.includes("laptop") && !p.includes("big one")));
  });

  it("refuses a field outside the schema at the top, in a list item and in a count", async () => {
    const record = await good();
    record.title = "Write Run Events";
    record.reviews[0].comment = "rename this";
    record.summary.by_cause.vibes = 1;
    record.run.team_run = true;
    assert.deepEqual(checkRecord(record).sort(), [
      "reviews[0].comment: is outside the schema",
      "run.team_run: is outside the schema",
      "summary.by_cause.vibes: is outside the schema",
      "title: is outside the schema",
    ]);
  });

  it("refuses a missing field and a wrong type", async () => {
    const record = await good();
    delete record.run.outcome;
    record.run.tickets = "348";
    assert.deepEqual(checkRecord(record).sort(), [
      "run.outcome: is missing",
      "run.tickets: must be a list",
    ]);
  });

  it("derive refuses a hand-edited event line that carries prose, names the line, and writes no record", async () => {
    const dir = root();
    const file = join(runFolder(dir), "delegations", "d348", "events.jsonl");
    appendFileSync(
      file,
      `${JSON.stringify({ at: "2026-11-19T03:16:00Z", kind: "send-back", actor: "chief-of-staff", delegation: "d348", why: "tests were thin" })}\n`,
    );
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /delegations\/d348\/events\.jsonl:4: why: is outside the schema/);
    assert.equal(existsSync(recordPath(dir)), false);
  });

  it("derive refuses an event whose id field holds a sentence", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    appendFileSync(
      file,
      `${JSON.stringify({ at: "2026-11-19T06:27:31Z", kind: "decision-request", actor: "chief-of-staff", id: "should we merge this" })}\n`,
    );
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /events\.jsonl:\d+: id: must be an id/);
  });
});

describe("derive: events that do not add up", () => {
  const without = (dir, pattern) => {
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => !pattern.test(l))
        .join("\n") + "\n",
    );
  };

  it("refuses a run with no run-closed event", async () => {
    const dir = root();
    without(dir, /run-closed/);
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /no `run-closed` event/);
  });

  it("refuses a wait closed that was never opened", async () => {
    const dir = root();
    without(dir, /"wait_id":"w3".*wait-opened|wait-opened.*"wait_id":"w3"/);
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /wait-closed: `w3` has no `wait-opened` event/);
  });

  it("refuses a step that covers a Decision Request nobody raised", async () => {
    const dir = root();
    without(dir, /"id":"dr6"/);
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /covers: `dr6` names no `decision-request` event/);
  });

  it("refuses an event for a Delegation that never started", async () => {
    const dir = root();
    without(dir, /^$/);
    appendFileSync(
      join(runFolder(dir), "events.jsonl"),
      `${JSON.stringify({ at: "2026-11-19T06:27:29Z", kind: "send-back", actor: "chief-of-staff", delegation: "d999" })}\n`,
    );
    const result = await derive(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /`d999` has no `delegation-started` event/);
  });
});

// ── Upload ──────────────────────────────────────────────────────────────────

const SINK_CONFIG = [
  "records:",
  "  sink:",
  "    type: github",
  "    repo: acme/run-records",
  "",
].join("\n");
const SINK_PATH = `records/github.com/mnaimfaizy/agent-kit/naim/${RUN}.json`;

/**
 * A fake `gh` and `git`: the private repositories it holds and every call it
 * was given. Nothing here touches the network. `repos` maps `owner/name` (or
 * `host/owner/name`) to its visibility, collaborators and files.
 */
function fakeTransport({ repos = {}, remotes = {}, conflicts = 0 } = {}) {
  const calls = [];
  const state = {
    calls,
    conflicts,
    repos: Object.fromEntries(
      Object.entries({
        "acme/run-records": {},
        ...repos,
      }).map(([name, repo]) => [
        name,
        {
          visibility: "private",
          collaborators: ["a", "b", "c", "d"],
          files: new Map(),
          ...repo,
        },
      ]),
    ),
    puts: () => calls.filter((c) => c.args.includes("PUT")),
    contents: () => calls.filter((c) => c.args.some((a) => /\/contents\//.test(a))),
  };
  const missing = {
    code: 1,
    out: '{"message":"Not Found","status":"404"}',
    err: "gh: Not Found (HTTP 404)",
  };
  state.exec = (command, args, options = {}) => {
    calls.push({ command, args, input: options.input });
    if (command === "git") {
      const sub = args.slice(2);
      if (sub[0] === "remote" && sub[1] === "get-url") {
        const url = remotes[sub[2]];
        return url ? { code: 0, out: `${url}\n` } : { code: 2, out: "" };
      }
      if (sub[0] === "remote") return { code: 0, out: `${Object.keys(remotes).join("\n")}\n` };
    }
    if (command !== "gh" || args[0] !== "api") return { code: 127, out: "" };
    const host = args.includes("--hostname") ? args[args.indexOf("--hostname") + 1] : "github.com";
    const endpoint = args.find((a) => /^repos\//.test(a));
    const [, owner, name, ...rest] = endpoint.split("?")[0].split("/");
    const key = host === "github.com" ? `${owner}/${name}` : `${host}/${owner}/${name}`;
    const repo = state.repos[key];
    if (!repo) return missing;
    if (repo.forbidden) return { code: 1, out: "", err: "gh: Resource not accessible (HTTP 403)" };
    const kind = rest[0];
    if (kind === undefined) return { code: 0, out: `${repo.visibility}\n` };
    if (kind === "collaborators")
      return repo.collaborators
        ? { code: 0, out: repo.collaborators.map((l) => `${l}\n`).join("") }
        : { code: 1, out: "", err: "gh: Must have push access (HTTP 403)" };
    if (kind === "git" && rest[1] === "trees") {
      const paths = [...repo.files.keys()];
      if (endpoint.includes("recursive=1")) {
        const tree = paths.map((path) => ({ path, type: "blob" }));
        return repo.truncate
          ? { code: 0, out: JSON.stringify({ tree: [], truncated: true }) }
          : { code: 0, out: JSON.stringify({ tree, truncated: false }) };
      }
      // One level: `sha` is the folder's path, and HEAD is the root.
      const sha = rest.slice(2).join("/").split("?")[0];
      const prefix = sha === "HEAD" ? "" : `${sha}/`;
      const level = new Map();
      for (const path of paths.filter((p) => p.startsWith(prefix))) {
        const [head, ...more] = path.slice(prefix.length).split("/");
        level.set(
          head,
          more.length
            ? { path: head, type: "tree", sha: `${prefix}${head}` }
            : { path: head, type: "blob" },
        );
      }
      return { code: 0, out: JSON.stringify({ tree: [...level.values()], truncated: false }) };
    }
    if (kind !== "contents") return missing;
    const path = decodeURIComponent(rest.slice(1).join("/"));
    if (args.includes("PUT")) {
      if (state.conflicts > 0) {
        state.conflicts -= 1;
        return { code: 1, out: "", err: "gh: is at abc but expected def (HTTP 409)" };
      }
      if (repo.files.has(path)) return { code: 1, out: "", err: "gh: Invalid request (HTTP 422)" };
      const body = JSON.parse(options.input);
      repo.files.set(path, Buffer.from(body.content, "base64").toString("utf8"));
      repo.lastPut = body;
      return { code: 0, out: "{}" };
    }
    return repo.files.has(path) ? { code: 0, out: repo.files.get(path) } : missing;
  };
  return state;
}

/** The dir with a derived record and the sink config; `extra` lines are added to `records:`. */
async function readyToUpload({ config = SINK_CONFIG, operator = "naim", edit } = {}) {
  const dir = root();
  writeFileSync(join(dir, "orchestrate.config.yml"), config);
  const result = await derive(dir, operator ? {} : { env: {}, exec: () => ({ code: 1, out: "" }) });
  assert.equal(result.code, 0, result.out);
  if (edit) {
    const file = recordPath(dir);
    writeFileSync(file, edit(readFileSync(file, "utf8")));
  }
  return dir;
}
const upload = (dir, transport, args = [RUN, "--yes"], env = {}) =>
  main(["upload", ...args], { cwd: dir, env, exec: transport.exec });

describe("upload: the disclosure", () => {
  it("shows the approved wording, with the access count, and uploads nothing without a yes", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport();
    const result = await upload(dir, transport, [RUN]);
    assert.equal(result.code, 0, result.out);
    assert.match(
      result.out,
      new RegExp(
        "\\*\\*Upload this run's Run Record\\?\\*\\* To `acme/run-records` \\(private GitHub repository, 4 people with access\\) at `" +
          SINK_PATH.replaceAll(".", "\\.") +
          "`\\. It holds counts, ids, times, outcomes and 13 human steps with their kind and cause: no issue text, no command output, no prose\\. It is kept indefinitely \\(git cannot expire it\\)\\. \\[Show the record\\] \\[Upload\\] \\[Not now\\]",
      ),
    );
    assert.equal(transport.puts().length, 0);
    assert.equal(transport.repos["acme/run-records"].files.size, 0);
  });

  it("leaves the access count out when the sink cannot be read for it", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport({ repos: { "acme/run-records": { collaborators: null } } });
    const result = await upload(dir, transport, [RUN]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /\(private GitHub repository\) at `records\//);
    assert.doesNotMatch(result.out, /with access/);
  });

  it("says one person, not one people", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport({ repos: { "acme/run-records": { collaborators: ["naim"] } } });
    assert.match((await upload(dir, transport, [RUN])).out, /1 person with access/);
  });

  it("is shown before an upload too, so the human is never surprised", async () => {
    const dir = await readyToUpload();
    const result = await upload(dir, fakeTransport());
    assert.match(result.out, /^\*\*Upload this run's Run Record\?\*\*/);
    assert.match(result.out, /\nuploaded `records\//);
  });
});

describe("upload: create-only writes to a github sink", () => {
  it("creates the record at its namespaced path with the record's exact bytes", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport();
    const result = await upload(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.match(
      result.out,
      new RegExp(`uploaded \`${SINK_PATH.replaceAll(".", "\\.")}\` to \`acme/run-records\``),
    );
    assert.equal(
      transport.repos["acme/run-records"].files.get(SINK_PATH),
      readFileSync(recordPath(dir), "utf8"),
    );
    const [put] = transport.puts();
    assert.deepEqual(put.args.slice(0, 3), ["api", "-X", "PUT"]);
    assert.ok(put.args.includes(`repos/acme/run-records/contents/${SINK_PATH}`));
    assert.equal(transport.repos["acme/run-records"].lastPut.sha, undefined, "create-only: no sha");
  });

  it("counts identical bytes already there as uploaded, and repeating is safe", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport();
    assert.equal((await upload(dir, transport)).code, 0);
    const again = await upload(dir, transport);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /already uploaded/);
    assert.equal(transport.puts().length, 1);
  });

  it("stops when different bytes are already at the path, and overwrites nothing", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport({
      repos: { "acme/run-records": { files: new Map([[SINK_PATH, '{"someone":"else"}']]) } },
    });
    const result = await upload(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /different bytes are already at `records\//);
    assert.equal(transport.puts().length, 0);
    assert.equal(transport.repos["acme/run-records"].files.get(SINK_PATH), '{"someone":"else"}');
  });

  it("retries a 409 from parallel Contents writes", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport({ conflicts: 2 });
    const result = await upload(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.equal(transport.puts().length, 3);
    assert.ok(transport.repos["acme/run-records"].files.has(SINK_PATH));
  });

  it("gives up, saying so, when every try is a 409", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport({ conflicts: 99 });
    const result = await upload(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /409/);
    assert.equal(transport.repos["acme/run-records"].files.size, 0);
  });

  it("counts a record another writer created between the read and the write as uploaded when identical", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport({ conflicts: 1 });
    const bytes = readFileSync(recordPath(dir), "utf8");
    const exec = transport.exec;
    transport.exec = (command, args, options) => {
      const result = exec(command, args, options);
      if (args.includes("PUT") && result.code !== 0)
        transport.repos["acme/run-records"].files.set(SINK_PATH, bytes);
      return result;
    };
    const result = await main(["upload", RUN, "--yes"], {
      cwd: dir,
      env: {},
      exec: transport.exec,
    });
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /already uploaded/);
  });

  it("writes to the configured branch, and reads from it", async () => {
    const dir = await readyToUpload({ config: `${SINK_CONFIG}    branch: records\n` });
    const transport = fakeTransport();
    assert.equal((await upload(dir, transport)).code, 0);
    assert.equal(transport.repos["acme/run-records"].lastPut.branch, "records");
    assert.ok(
      transport
        .contents()
        .every((c) => c.args.some((a) => a.includes("ref=records") || a === "PUT")),
    );
  });

  it("uses the sink's own host for host/owner/name", async () => {
    const dir = await readyToUpload({
      config: SINK_CONFIG.replace("acme/run-records", "ghe.acme.dev/acme/run-records"),
    });
    const transport = fakeTransport({ repos: { "ghe.acme.dev/acme/run-records": {} } });
    const result = await upload(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.ok(transport.calls.every((c) => c.command !== "gh" || c.args.includes("ghe.acme.dev")));
    assert.ok(transport.repos["ghe.acme.dev/acme/run-records"].files.has(SINK_PATH));
  });
});

describe("upload: never to a public repository", () => {
  for (const visibility of ["public", "internal"])
    it(`refuses a ${visibility} repository, with no override, before any read or write`, async () => {
      const dir = await readyToUpload();
      const transport = fakeTransport({ repos: { "acme/run-records": { visibility } } });
      for (const args of [[RUN], [RUN, "--yes"]]) {
        const result = await upload(dir, transport, args);
        assert.notEqual(result.code, 0);
        assert.doesNotMatch(result.out, /Upload this run's Run Record\?/);
        assert.match(result.out, /is not private/);
      }
      assert.equal(transport.contents().length, 0);
      // There is no flag that lifts it.
      assert.equal((await upload(dir, transport, [RUN, "--yes", "--force"])).code, 2);
      assert.equal(transport.contents().length, 0);
    });

  it("refuses when the visibility cannot be read, since it cannot be shown private", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport();
    delete transport.repos["acme/run-records"];
    const result = await upload(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /cannot read whether `acme\/run-records` is private/);
    assert.equal(transport.contents().length, 0);
  });
});

describe("upload: the namespace and the login", () => {
  it("uploads nothing with no login, and makes no call", async () => {
    const dir = await readyToUpload({ operator: null });
    const transport = fakeTransport();
    const result = await upload(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /no tracker login/);
    assert.equal(transport.calls.length, 0);
  });

  it("lowercases every segment, and `records.repository` pins the repository", async () => {
    const dir = await readyToUpload({
      config: `records:\n  repository: GitHub.com/Acme/Widgets\n  sink:\n    type: github\n    repo: acme/run-records\n`,
      operator: null,
    });
    // The record names its operator as written; the path is lowercased.
    const file = recordPath(dir);
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"operator": null', '"operator": "Naim"'),
    );
    const transport = fakeTransport();
    const result = await upload(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(
      [...transport.repos["acme/run-records"].files.keys()],
      [`records/github.com/acme/widgets/naim/${RUN}.json`],
    );
  });

  it("reads the repository from the origin remote when the record names none", async () => {
    const dir = await readyToUpload({
      edit: (text) => text.replace(/"repo": "[^"]+"/, '"repo": null'),
    });
    const transport = fakeTransport({
      remotes: { origin: "git@github.com:Acme/Widgets.git", fork: "https://github.com/me/widgets" },
    });
    const result = await upload(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.ok(
      transport.repos["acme/run-records"].files.has(
        `records/github.com/acme/widgets/naim/${RUN}.json`,
      ),
    );
  });

  it("asks, rather than guess, with several remotes and none named origin", async () => {
    const dir = await readyToUpload({
      edit: (text) => text.replace(/"repo": "[^"]+"/, '"repo": null'),
    });
    const transport = fakeTransport({
      remotes: { upstream: "https://github.com/a/b", fork: "https://github.com/me/b" },
    });
    const result = await upload(dir, transport);
    assert.equal(result.code, 3);
    assert.match(result.out, /several remotes and none is `origin`/);
    assert.equal(transport.contents().length, 0);
  });
});

describe("upload: when there is nothing to upload", () => {
  it("a run with no `records` keys behaves as today: the local record only, no call", async () => {
    const dir = await readyToUpload({ config: "run_dir: tmp/orchestrate\n" });
    const transport = fakeTransport();
    const result = await upload(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /no `records\.sink`/);
    assert.equal(transport.calls.length, 0);
    assert.ok(existsSync(recordPath(dir)));
  });

  it("derive is unchanged by a sink: it still only writes the local record", async () => {
    const dir = root();
    writeFileSync(join(dir, "orchestrate.config.yml"), SINK_CONFIG);
    const transport = fakeTransport();
    const result = await main(["derive", `tmp/orchestrate/${RUN}`], {
      cwd: dir,
      env: { ORCHESTRATE_OPERATOR: "naim" },
      exec: transport.exec,
    });
    assert.equal(result.code, 0, result.out);
    assert.equal(transport.calls.length, 0);
  });

  it("names a config problem and uploads nothing", async () => {
    const dir = await readyToUpload({
      config: "records:\n  sink:\n    type: azure\n    repo: a/b\n",
    });
    const transport = fakeTransport();
    const result = await upload(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /unknown sink type `azure`/);
    assert.equal(transport.calls.length, 0);
  });

  it("names a run with no record, and a record that holds free text, and uploads neither", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport();
    const none = await upload(dir, transport, ["2026-01-01-nothing", "--yes"]);
    assert.equal(none.code, 1);
    assert.match(none.out, /no Run Record for `2026-01-01-nothing`/);
    const file = recordPath(dir);
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.run.note = "the issue said to drop the production table";
    writeFileSync(file, JSON.stringify(record));
    const unsafe = await upload(dir, transport);
    assert.equal(unsafe.code, 1);
    assert.match(unsafe.out, /run\.note: is outside the schema/);
    assert.doesNotMatch(unsafe.out, /production table/);
    assert.equal(transport.calls.length, 0);
  });

  it("exits 2 with the usage for a bad call", async () => {
    const transport = fakeTransport();
    for (const args of [[], ["a", "b"], [RUN, "--force"]])
      assert.equal((await upload(root(), transport, args)).code, 2, args.join(" "));
  });
});

describe("upload: answering Not now, and uploading later", () => {
  it("keeps the local record, and `upload <run>` later uploads it", async () => {
    const dir = await readyToUpload();
    const transport = fakeTransport();
    // "Not now": the disclosure was shown and the human declined; nothing was run with --yes.
    assert.equal((await upload(dir, transport, [RUN])).code, 0);
    assert.ok(existsSync(recordPath(dir)));
    assert.equal(transport.puts().length, 0);
    // Later, with the run folder gone: the record outlives it.
    rmSync(runFolder(dir), { recursive: true });
    const later = await upload(dir, transport, [RUN, "--yes"]);
    assert.equal(later.code, 0, later.out);
    assert.ok(transport.repos["acme/run-records"].files.has(SINK_PATH));
  });

  it("works from the run folder's path, and with `upload: never`", async () => {
    const dir = await readyToUpload({
      config: `records:\n  upload: never\n  sink:\n    type: github\n    repo: acme/run-records\n`,
    });
    const transport = fakeTransport();
    const result = await upload(dir, transport, [`tmp/orchestrate/${RUN}`, "--yes"]);
    assert.equal(result.code, 0, result.out);
    assert.ok(transport.repos["acme/run-records"].files.has(SINK_PATH));
  });
});

describe("sinks: one interface, local and github behind it", () => {
  it("lists, reads and creates on the local sink, create-only", async () => {
    const dir = await readyToUpload();
    const local = openSink("local", { dir: join(dir, "tmp", "orchestrate", "records") });
    assert.deepEqual(await local.list(""), [`${RUN}.json`]);
    const text = readFileSync(recordPath(dir), "utf8");
    assert.deepEqual(await local.read(`${RUN}.json`), { status: "found", text });
    assert.deepEqual(await local.read("nope.json"), { status: "missing" });
    assert.deepEqual(await local.create("new.json", "{}\n"), { status: "created" });
    assert.deepEqual(await local.create("new.json", "{}\n"), { status: "exists" });
    assert.deepEqual(await local.privacy(), { private: true, visibility: "local" });
    assert.equal(await local.access(), null);
  });

  it("lists, reads and checks a github sink through gh api", async () => {
    const transport = fakeTransport({
      repos: { "acme/run-records": { files: new Map([["records/a/b.json", "{}"]]) } },
    });
    const sink = openSink("github", { repo: "acme/run-records", exec: transport.exec });
    assert.deepEqual(await sink.privacy(), { private: true, visibility: "private" });
    assert.equal(await sink.access(), 4);
    assert.deepEqual(await sink.read("records/a/b.json"), { status: "found", text: "{}" });
    assert.deepEqual(await sink.read("records/a/c.json"), { status: "missing" });
    assert.deepEqual(await sink.list("records/"), ["records/a/b.json"]);
    assert.deepEqual(await sink.list("raw/"), []);
  });

  it("walks a github sink level by level when the recursive listing is truncated", async () => {
    const files = new Map(
      ["records/h/o/r/naim/a.json", "records/h/o/r/lee/b.json", "raw/x"].map((p) => [p, "{}"]),
    );
    const transport = fakeTransport({ repos: { "acme/run-records": { files, truncate: true } } });
    const sink = openSink("github", { repo: "acme/run-records", exec: transport.exec });
    assert.deepEqual(await sink.list("records/"), [
      "records/h/o/r/lee/b.json",
      "records/h/o/r/naim/a.json",
    ]);
    assert.equal(
      await openSink("github", { repo: "acme/nowhere", exec: transport.exec }).list(""),
      null,
    );
  });
});

// ── The gitlab sink ─────────────────────────────────────────────────────────

const GITLAB_CONFIG = SINK_CONFIG.replace("github", "gitlab");

/**
 * A fake `glab`: the projects it holds and every call it was given. Pages hold
 * at most `pageSize` entries whatever `per_page` asks, as a server may cap them.
 * `projects` maps `owner/name` (or `host/owner/name`) to its visibility,
 * members, default branch and files.
 */
function fakeGitlab({ projects = {}, conflicts = 0, pageSize = 100 } = {}) {
  const calls = [];
  const state = {
    calls,
    conflicts,
    repos: Object.fromEntries(
      Object.entries({ "acme/run-records": {}, ...projects }).map(([name, project]) => [
        name,
        {
          visibility: "private",
          default_branch: "main",
          members: ["a", "b", "c", "d"],
          files: new Map(),
          ...project,
        },
      ]),
    ),
    puts: () => calls.filter((c) => c.args.includes("POST")),
    files: () => calls.filter((c) => c.args.some((a) => /\/repository\/files\//.test(a))),
  };
  const fail = (code, said) => ({ code: 1, out: "", err: `glab: ${said} (HTTP ${code})` });
  state.exec = (command, args, options = {}) => {
    calls.push({ command, args, input: options.input });
    if (command === "git") return { code: 2, out: "" };
    if (command !== "glab" || args[0] !== "api") return { code: 127, out: "" };
    const host = args.includes("--hostname") ? args[args.indexOf("--hostname") + 1] : "gitlab.com";
    const endpoint = args.find((a) => /^projects\//.test(a));
    const [route, query = ""] = endpoint.split("?");
    const [, id, ...rest] = route.split("/");
    const params = new URLSearchParams(query);
    const name = decodeURIComponent(id);
    const project = state.repos[host === "gitlab.com" ? name : `${host}/${name}`];
    if (!project) return fail(404, "404 Project Not Found");
    if (project.forbidden) return fail(403, "403 Forbidden");
    const pageOf = (items) => {
      const page = Number(params.get("page") ?? 1);
      return items.slice((page - 1) * pageSize, page * pageSize);
    };
    if (rest.length === 0)
      return {
        code: 0,
        out: JSON.stringify({
          visibility: project.visibility,
          default_branch: project.default_branch,
        }),
      };
    if (rest[0] === "members" && rest[1] === "all")
      return project.members
        ? {
            code: 0,
            out: JSON.stringify(pageOf(project.members.map((username) => ({ username })))),
          }
        : fail(403, "403 Forbidden");
    const ref = params.get("ref");
    if (ref !== null && ref !== (project.branch ?? project.default_branch))
      return fail(404, "404 Ref Not Found");
    if (rest[0] === "repository" && rest[1] === "tree") {
      const where = params.get("path") ?? "";
      const paths = [...project.files.keys()].filter((p) => p.startsWith(where ? `${where}/` : ""));
      if (where && paths.length === 0) return fail(404, "404 Tree Not Found");
      const entries = [];
      const seen = new Set();
      for (const path of paths) {
        const parts = path.split("/");
        for (let n = 1; n < parts.length; n += 1) {
          const dir = parts.slice(0, n).join("/");
          if (!seen.has(dir) && dir.length > where.length) {
            seen.add(dir);
            entries.push({ path: dir, type: "tree" });
          }
        }
        entries.push({ path, type: "blob" });
      }
      return { code: 0, out: JSON.stringify(pageOf(entries)) };
    }
    if (rest[0] !== "repository" || rest[1] !== "files") return fail(404, "404 Not Found");
    const path = decodeURIComponent(rest[2]);
    if (args.includes("POST")) {
      if (state.conflicts > 0) {
        state.conflicts -= 1;
        return fail(409, "409 Conflict: file is locked");
      }
      const body = JSON.parse(options.input);
      if (project.files.has(path))
        return fail(400, "400 Bad Request: A file with this name already exists");
      project.files.set(path, Buffer.from(body.content, "base64").toString("utf8"));
      project.lastPost = body;
      return { code: 0, out: "{}" };
    }
    if (rest[3] !== "raw") return fail(404, "404 Not Found");
    return project.files.has(path)
      ? { code: 0, out: project.files.get(path) }
      : fail(404, "404 File Not Found");
  };
  return state;
}

const uploadGitlab = (dir, transport, args = [RUN, "--yes"]) =>
  main(["upload", ...args], { cwd: dir, env: {}, exec: transport.exec });

describe("upload: create-only writes to a gitlab sink", () => {
  it("shows the disclosure for a private GitLab project, with the member count", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const transport = fakeGitlab();
    const result = await uploadGitlab(dir, transport, [RUN]);
    assert.equal(result.code, 0, result.out);
    assert.match(
      result.out,
      /To `acme\/run-records` \(private GitLab project, 4 people with access\) at `records\//,
    );
    assert.equal(transport.puts().length, 0);
  });

  it("reads the path first, then creates it with the record's exact bytes, on the default branch", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const transport = fakeGitlab();
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.match(
      result.out,
      new RegExp(`uploaded \`${SINK_PATH.replaceAll(".", "\\.")}\` to \`acme/run-records\``),
    );
    const project = transport.repos["acme/run-records"];
    assert.equal(project.files.get(SINK_PATH), readFileSync(recordPath(dir), "utf8"));
    assert.equal(project.lastPost.branch, "main");
    assert.equal(project.lastPost.encoding, "base64");
    const files = transport.files();
    assert.ok(
      files[0].args.some((a) => a.includes("/raw")),
      "the first file call reads",
    );
    assert.deepEqual(files[1].args.slice(0, 5), ["api", "--hostname", "gitlab.com", "-X", "POST"]);
    assert.ok(
      files[1].args.includes(
        `projects/acme%2Frun-records/repository/files/${encodeURIComponent(SINK_PATH)}`,
      ),
    );
  });

  it("counts identical bytes already there as uploaded, and repeating is safe", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const transport = fakeGitlab();
    assert.equal((await uploadGitlab(dir, transport)).code, 0);
    const again = await uploadGitlab(dir, transport);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /already uploaded/);
    assert.equal(transport.puts().length, 1);
  });

  it("stops when different bytes are already at the path, and overwrites nothing", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const transport = fakeGitlab({
      projects: { "acme/run-records": { files: new Map([[SINK_PATH, '{"someone":"else"}']]) } },
    });
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /different bytes are already at `records\//);
    assert.equal(transport.puts().length, 0);
    assert.equal(transport.repos["acme/run-records"].files.get(SINK_PATH), '{"someone":"else"}');
  });

  it("retries a 409, reading the path again each time, and gives up saying so", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const some = fakeGitlab({ conflicts: 2 });
    assert.equal((await uploadGitlab(dir, some)).code, 0);
    assert.equal(some.puts().length, 3);
    const all = fakeGitlab({ conflicts: 99 });
    const result = await uploadGitlab(dir, all);
    assert.equal(result.code, 1);
    assert.match(result.out, /409/);
    assert.equal(all.repos["acme/run-records"].files.size, 0);
  });

  it("counts a path created between the read and the write as uploaded when identical, and a clash as exists", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const bytes = readFileSync(recordPath(dir), "utf8");
    const transport = fakeGitlab();
    const exec = transport.exec;
    transport.exec = (command, args, options) => {
      // Another writer lands the same file just before our POST.
      if (args.includes("POST")) transport.repos["acme/run-records"].files.set(SINK_PATH, bytes);
      return exec(command, args, options);
    };
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /already uploaded/);
  });

  it("writes to the configured branch, and reads from it", async () => {
    const dir = await readyToUpload({ config: `${GITLAB_CONFIG}    branch: records\n` });
    const transport = fakeGitlab({ projects: { "acme/run-records": { branch: "records" } } });
    assert.equal((await uploadGitlab(dir, transport)).code, 0);
    assert.equal(transport.repos["acme/run-records"].lastPost.branch, "records");
    assert.ok(
      transport.files().every((c) => c.args.some((a) => a.includes("ref=records") || a === "POST")),
    );
  });

  it("uses the sink's own host for host/owner/name, and gitlab.com otherwise", async () => {
    const dir = await readyToUpload({
      config: GITLAB_CONFIG.replace("acme/run-records", "gitlab.acme.dev/acme/run-records"),
    });
    const transport = fakeGitlab({ projects: { "gitlab.acme.dev/acme/run-records": {} } });
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.ok(
      transport.calls.every((c) => c.command !== "glab" || c.args.includes("gitlab.acme.dev")),
    );
    assert.ok(transport.repos["gitlab.acme.dev/acme/run-records"].files.has(SINK_PATH));
    const home = fakeGitlab();
    await uploadGitlab(await readyToUpload({ config: GITLAB_CONFIG }), home);
    assert.ok(
      home.calls.every(
        (c) => c.command !== "glab" || c.args.join(" ").includes("--hostname gitlab.com"),
      ),
      "gitlab.com is named too, so a clone on another host cannot redirect the call",
    );
  });

  for (const visibility of ["public", "internal"])
    it(`refuses a ${visibility} project at every upload, with no override, before any read or write`, async () => {
      const dir = await readyToUpload({ config: GITLAB_CONFIG });
      const transport = fakeGitlab({ projects: { "acme/run-records": { visibility } } });
      for (const args of [[RUN], [RUN, "--yes"]]) {
        const result = await uploadGitlab(dir, transport, args);
        assert.notEqual(result.code, 0);
        assert.doesNotMatch(result.out, /Upload this run's Run Record\?/);
        assert.match(result.out, new RegExp(`is not private \\(${visibility}\\)`));
      }
      assert.equal(transport.files().length, 0);
      assert.equal((await uploadGitlab(dir, transport, [RUN, "--yes", "--force"])).code, 2);
    });

  it("refuses when the visibility cannot be read", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const transport = fakeGitlab();
    delete transport.repos["acme/run-records"];
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 1);
    assert.match(result.out, /cannot read whether `acme\/run-records` is private/);
    assert.equal(transport.files().length, 0);
  });

  it("leaves the member count out when it cannot be read, and counts every page of members", async () => {
    const dir = await readyToUpload({ config: GITLAB_CONFIG });
    const none = await uploadGitlab(
      dir,
      fakeGitlab({ projects: { "acme/run-records": { members: null } } }),
      [RUN],
    );
    assert.match(none.out, /\(private GitLab project\) at `records\//);
    const paged = await uploadGitlab(dir, fakeGitlab({ pageSize: 2 }), [RUN]);
    assert.match(paged.out, /4 people with access/);
  });
});

describe("GitLab subgroups: a project at host/group/sub/project (F2)", () => {
  const SUB = "gitlab.com/grp/sub/proj";
  const subgroupRemote = (command, args) =>
    args.includes("get-url")
      ? { code: 0, out: "git@gitlab.com:Grp/Sub/Proj.git\n" }
      : { code: 0, out: "origin\n" };
  const withoutRepo = (dir) => {
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"repo":"github.com/mnaimfaizy/agent-kit",', ""),
    );
    return dir;
  };

  it("derives a Run Record from a subgroup remote", async () => {
    const record = await derived(withoutRepo(root()), { exec: subgroupRemote });
    assert.equal(record.run.repo, SUB);
  });

  it("takes a group whose path starts with `_`, as config.mjs does", async () => {
    assert.deepEqual(
      checkRecord({ run: { repo: "gitlab.com/_team/proj" } }).filter((p) =>
        p.startsWith("run.repo"),
      ),
      [],
    );
    assert.deepEqual(
      checkRecord({ run: { repo: "gitlab.com/_team/_sub/proj" } }).filter((p) =>
        p.startsWith("run.repo"),
      ),
      [],
    );
    const underscore = (command, args) =>
      args.includes("get-url")
        ? { code: 0, out: "git@gitlab.com:_team/proj.git\n" }
        : { code: 0, out: "origin\n" };
    const record = await derived(withoutRepo(root()), { exec: underscore });
    assert.equal(record.run.repo, "gitlab.com/_team/proj");
    assert.deepEqual(parseSinkPath(`records/gitlab.com/_team/proj/naim/${RUN}.json`), {
      repository: "gitlab.com/_team/proj",
      login: "naim",
      id: RUN,
    });
    // Both still refuse a group that starts with a dot or a hyphen.
    for (const repo of ["gitlab.com/.team/proj", "gitlab.com/-team/proj"])
      assert.ok(
        checkRecord({ run: { repo } }).some((p) => p.startsWith("run.repo: must be")),
        repo,
      );
  });

  it("still refuses a repository with no owner", () => {
    assert.ok(
      checkRecord({ run: { repo: "gitlab.com/proj" } }).some((p) =>
        p.startsWith("run.repo: must be host/owner/repo"),
      ),
    );
  });

  it("parses a sink path from the end: the namespace is everything between records/ and the login", () => {
    assert.deepEqual(parseSinkPath(`records/${SUB}/naim/${RUN}.json`), {
      repository: SUB,
      login: "naim",
      id: RUN,
    });
    // A github or s3 path still has exactly host/owner/repo, and parses as before.
    assert.deepEqual(parseSinkPath(`records/github.com/acme/widgets/naim/${RUN}.json`), {
      repository: "github.com/acme/widgets",
      login: "naim",
      id: RUN,
    });
    assert.equal(parseSinkPath(`records/github.com/acme/naim/${RUN}.json`), null);
    // GitHub has no subgroups: a deeper github.com namespace is refused, in a path and in a record.
    assert.equal(parseSinkPath(`records/github.com/acme/sub/widgets/naim/${RUN}.json`), null);
    assert.ok(
      checkRecord({ run: { repo: "github.com/acme/sub/widgets" } }).some((p) =>
        p.startsWith("run.repo: must be host/owner/repo"),
      ),
    );
    assert.equal(parseSinkPath(`records/github.com/acme/../naim/${RUN}.json`), null);
  });

  it("uploads a subgroup project's record to a gitlab sink in a subgroup, read as a namespace", async () => {
    const dir = await readyToUpload({
      config: [
        "records:",
        `  repository: ${SUB}`,
        "  sink:",
        "    type: gitlab",
        "    repo: acme/records/run-records",
        "",
      ].join("\n"),
    });
    const transport = fakeGitlab({ projects: { "acme/records/run-records": {} } });
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 0, result.out);
    const path = `records/${SUB}/naim/${RUN}.json`;
    assert.ok(transport.repos["acme/records/run-records"].files.has(path), result.out);
    const post = transport.puts()[0].args;
    assert.deepEqual(post.slice(0, 3), ["api", "--hostname", "gitlab.com"]);
    assert.ok(
      post.includes(
        `projects/acme%2Frecords%2Frun-records/repository/files/${encodeURIComponent(path)}`,
      ),
    );
  });

  it("takes the host from a sink repo only when its first segment has a dot", async () => {
    const dir = await readyToUpload({
      config: [
        "records:",
        "  sink:",
        "    type: gitlab",
        "    repo: gitlab.example.com/acme/records/run-records",
        "",
      ].join("\n"),
    });
    const transport = fakeGitlab({
      projects: { "gitlab.example.com/acme/records/run-records": {} },
    });
    const result = await uploadGitlab(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(transport.puts()[0].args.slice(0, 3), [
      "api",
      "--hostname",
      "gitlab.example.com",
    ]);
  });
});

describe("sinks: the gitlab adapter behind the same interface", () => {
  const open = (transport, options = {}) =>
    openSink("gitlab", { repo: "acme/run-records", exec: transport.exec, ...options });

  it("checks, reads and lists a project through glab api", async () => {
    const transport = fakeGitlab({
      projects: {
        "acme/run-records": {
          files: new Map([
            ["records/a/b.json", "{}"],
            ["raw/x", "{}"],
          ]),
        },
      },
    });
    const sink = open(transport);
    assert.deepEqual(await sink.privacy(), { private: true, visibility: "private" });
    assert.equal(await sink.access(), 4);
    assert.deepEqual(await sink.read("records/a/b.json"), { status: "found", text: "{}" });
    assert.deepEqual(await sink.read("records/a/c.json"), { status: "missing" });
    assert.deepEqual(await sink.list("records/"), ["records/a/b.json"]);
    assert.deepEqual(await sink.list(""), ["raw/x", "records/a/b.json"]);
    assert.deepEqual(await sink.list("nothing/"), []);
  });

  it("follows every page of the recursive tree, 2 at a time, and asks for a recursive listing of records", async () => {
    const paths = Array.from({ length: 7 }, (_, n) => `records/h/o/r/naim/run-${n}.json`);
    const transport = fakeGitlab({
      pageSize: 2,
      projects: { "acme/run-records": { files: new Map(paths.map((p) => [p, "{}"])) } },
    });
    assert.deepEqual(await open(transport).list("records/"), paths);
    const trees = transport.calls.filter((c) => c.args.some((a) => /repository\/tree/.test(a)));
    assert.ok(trees.length >= 4, "more than one page");
    assert.ok(
      trees.every((c) => c.args.some((a) => /recursive=true/.test(a) && /path=records/.test(a))),
    );
  });

  it("returns null for a list it cannot read, and [] for a missing records folder", async () => {
    const transport = fakeGitlab();
    assert.equal(
      await openSink("gitlab", { repo: "acme/nowhere", exec: transport.exec }).list(""),
      null,
    );
    assert.deepEqual(await open(transport).list("records/"), []);
    transport.repos["acme/run-records"].forbidden = true;
    assert.equal(await open(transport).list("records/"), null);
  });

  it("does not take a failure that merely mentions 404 for a missing path", async () => {
    const sink = openSink("gitlab", {
      repo: "acme/run-records",
      branch: "b",
      exec: () => ({
        code: 1,
        out: "",
        err: "glab: server error while reading run-404 (HTTP 500)",
      }),
    });
    assert.equal((await sink.read("records/run-404.json")).status, "error");
  });

  it("reports a failed read or create as an error with its first line", async () => {
    const transport = fakeGitlab();
    transport.repos["acme/run-records"].forbidden = true;
    const sink = open(transport);
    assert.equal((await sink.read("records/x.json")).status, "error");
    assert.equal((await sink.create("records/x.json", "{}")).status, "error");
  });
});

describe("the dashboard reads a gitlab sink", () => {
  it("lists records over several pages, reads only the paths its cache lacks, and builds the page", async () => {
    const { dir, files } = await readyToRead({ config: GITLAB_CONFIG });
    const transport = fakeGitlab({ pageSize: 3, projects: { "acme/run-records": { files } } });
    const first = await build(dir, transport);
    assert.equal(first.code, 0, first.out);
    assert.match(first.out, /built the dashboard from 4 Run Records/);
    assert.match(first.out, /skipped records\/stray\.txt/);
    const html = body(page(dir));
    for (const ns of [NS_A, NS_B]) assert.match(html, new RegExp(`id="/repo/${ns}"`));
    const raw = () => transport.calls.filter((c) => c.args.some((a) => /\/raw/.test(a))).length;
    const fetched = raw();
    assert.ok(fetched >= 4);
    await build(dir, transport);
    assert.equal(raw(), fetched, "the cache held every record");
  });

  it("warns, and builds from local records only, when the project cannot be read", async () => {
    const { dir } = await readyToRead({ config: GITLAB_CONFIG });
    const transport = fakeGitlab({ projects: { "acme/run-records": { forbidden: true } } });
    const result = await build(dir, transport);
    assert.equal(result.code, 1, "nothing is local, so there is nothing to build");
    assert.match(result.out, /could not read `acme\/run-records`/);
  });
});

describe("the command line", () => {
  it("exits 2 with the usage on an unknown command or a missing run folder", async () => {
    assert.equal((await main([])).code, 2);
    assert.equal((await main(["upload"])).code, 2);
    const missing = await main(["derive", "nowhere"], {
      cwd: mkdtempSync(join(tmpdir(), "orchestrate-records-")),
    });
    assert.equal(missing.code, 2);
  });

  it("appends and derives when run as a script", () => {
    const dir = root();
    const env = { ...process.env, ORCHESTRATE_OPERATOR: "naim" };
    const event = spawnSync(
      process.execPath,
      [
        join(here, "records.mjs"),
        "event",
        "--file",
        `tmp/orchestrate/${RUN}/events.jsonl`,
        "--kind",
        "write",
        "--actor",
        "chief-of-staff",
        "--write-kind",
        "other",
        "--as-human",
        "false",
      ],
      { cwd: dir, env, encoding: "utf8" },
    );
    assert.equal(event.status, 0, event.stdout + event.stderr);
    const result = spawnSync(
      process.execPath,
      [join(here, "records.mjs"), "derive", `tmp/orchestrate/${RUN}`],
      { cwd: dir, env, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(readFileSync(recordPath(dir), "utf8")).writes.length, 6);
    const bad = spawnSync(
      process.execPath,
      [
        join(here, "records.mjs"),
        "event",
        "--file",
        "events.jsonl",
        "--kind",
        "lunch",
        "--actor",
        "human",
      ],
      { cwd: dir, env, encoding: "utf8" },
    );
    assert.equal(bad.status, 1);
  });
});

// ── prune: closed-out run folders, on opt-in ────────────────────────────────

const DAY = 86_400_000;
const NOW = "2026-11-25T12:00:00Z";
const ago = (days) => new Date(Date.parse(NOW) - days * DAY).toISOString().replace(/\.\d+Z$/, "Z");

/** A temp root with a config, and the run folders `runs` names: `closedDaysAgo` null is an open run. */
function pruneRoot({ config = ["prune:", "  after_days: 30"], runs = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "orchestrate-prune-"));
  made.push(dir);
  if (config !== null) writeFileSync(join(dir, "orchestrate.config.yml"), `${config.join("\n")}\n`);
  const base = join(dir, "tmp", "orchestrate");
  mkdirSync(join(base, "records"), { recursive: true });
  const template = JSON.parse(
    readFileSync(join(here, "fixtures", "records", "template-record.json"), "utf8"),
  );
  for (const [id, closedDaysAgo] of Object.entries(runs)) {
    mkdirSync(join(base, id, "delegations", "d1"), { recursive: true });
    writeFileSync(join(base, id, "board.md"), "board\n");
    writeFileSync(join(base, id, "delegations", "d1", "report.md"), "report\n");
    if (closedDaysAgo === null) continue;
    const record = { ...template, run: { ...template.run, id, closed_at: ago(closedDaysAgo) } };
    writeFileSync(join(base, "records", `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  }
  return dir;
}
const prune = (dir, args = []) => main(["prune", ...args], { cwd: dir, now: at(NOW) });
const kept = (dir) => readdirSync(join(dir, "tmp", "orchestrate")).sort();

describe("prune: only closed-out run folders older than prune.after_days", () => {
  it("deletes a closed-out run past the age, and keeps every record", async () => {
    const dir = pruneRoot({ runs: { "run-old": 40, "run-new": 10 } });
    const result = await prune(dir);
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(kept(dir), ["records", "run-new"]);
    assert.deepEqual(readdirSync(join(dir, "tmp", "orchestrate", "records")).sort(), [
      "run-new.json",
      "run-old.json",
    ]);
    assert.match(result.out, /pruned run-old/);
    assert.doesNotMatch(result.out, /pruned run-new/);
  });

  it("never deletes an open run, however old its folder, or a run with no valid record", async () => {
    const dir = pruneRoot({ runs: { "run-open": null, "run-old": 400 } });
    const base = join(dir, "tmp", "orchestrate");
    // A record that is not JSON, one for another run, and one with no closing time.
    for (const [id, text] of [
      ["run-garbled", "{not json"],
      ["run-other", JSON.stringify({ run: { id: "somebody-else", closed_at: ago(400) } })],
      ["run-untimed", JSON.stringify({ run: { id: "run-untimed" } })],
    ]) {
      mkdirSync(join(base, id), { recursive: true });
      writeFileSync(join(base, "records", `${id}.json`), text);
    }
    await prune(dir);
    assert.deepEqual(kept(dir), ["records", "run-garbled", "run-open", "run-other", "run-untimed"]);
  });

  it("keeps a run closed exactly after_days ago, and prunes one a second older", async () => {
    const dir = pruneRoot({ runs: { "run-edge": 30 } });
    await prune(dir);
    assert.deepEqual(kept(dir), ["records", "run-edge"]);
    const later = await main(["prune"], { cwd: dir, now: at("2026-11-25T12:00:01Z") });
    assert.equal(later.code, 0);
    assert.deepEqual(kept(dir), ["records"]);
  });

  it("deletes nothing when the config has no prune key, or no config at all", async () => {
    for (const config of [["limits:", "  building: 2"], null]) {
      const dir = pruneRoot({ config, runs: { "run-old": 900 } });
      const result = await prune(dir);
      assert.equal(result.code, 0, result.out);
      assert.match(result.out, /pruning is off/);
      assert.deepEqual(kept(dir), ["records", "run-old"]);
    }
  });

  it("reads the setting from a JSON config, and from a custom run_dir", async () => {
    const dir = pruneRoot({ config: null });
    writeFileSync(
      join(dir, "orchestrate.config.json"),
      JSON.stringify({ run_dir: "tmp/orchestrate", prune: { after_days: 5 } }),
    );
    const base = join(dir, "tmp", "orchestrate");
    mkdirSync(join(base, "run-a"));
    writeFileSync(
      join(base, "records", "run-a.json"),
      JSON.stringify({ run: { id: "run-a", closed_at: ago(6) } }),
    );
    await prune(dir);
    assert.deepEqual(kept(dir), ["records"]);

    const other = pruneRoot({ config: ["run_dir: runs/here", "prune:", "  after_days: 1"] });
    const from = join(other, "tmp", "orchestrate");
    renameSync(from, join(other, "runs-tmp"));
    mkdirSync(join(other, "runs"), { recursive: true });
    renameSync(join(other, "runs-tmp"), join(other, "runs", "here"));
    mkdirSync(join(other, "runs", "here", "run-b"));
    writeFileSync(
      join(other, "runs", "here", "records", "run-b.json"),
      JSON.stringify({ run: { id: "run-b", closed_at: ago(3) } }),
    );
    await prune(other);
    assert.deepEqual(readdirSync(join(other, "runs", "here")), ["records"]);
  });

  it("leaves files and symlinks in the run folder alone, and never follows a link out", async () => {
    const dir = pruneRoot({ runs: { "run-old": 99 } });
    const base = join(dir, "tmp", "orchestrate");
    const outside = mkdtempSync(join(tmpdir(), "orchestrate-outside-"));
    made.push(outside);
    writeFileSync(join(outside, "precious.txt"), "keep\n");
    symlinkSync(outside, join(base, "run-link"));
    writeFileSync(
      join(base, "records", "run-link.json"),
      JSON.stringify({ run: { id: "run-link", closed_at: ago(99) } }),
    );
    writeFileSync(join(base, "notes.txt"), "mine\n");
    await prune(dir);
    assert.deepEqual(kept(dir), ["notes.txt", "records", "run-link"]);
    assert.equal(existsSync(join(outside, "precious.txt")), true);
  });

  it("refuses to delete anything when the config has a problem", async () => {
    const dir = pruneRoot({ config: ["prune:", "  after_days: 0"], runs: { "run-old": 99 } });
    const result = await prune(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /`prune\.after_days`: expected a whole number of 1 or more/);
    assert.deepEqual(kept(dir), ["records", "run-old"]);
  });

  it("deletes nothing when the clock cannot be read", async () => {
    const dir = pruneRoot({ runs: { "run-old": 99 } });
    const result = await main(["prune"], { cwd: dir, now: () => "not a time" });
    assert.equal(result.code, 1);
    assert.match(result.out, /cannot read the clock/);
    assert.deepEqual(kept(dir), ["records", "run-old"]);
  });

  it("says what it deleted, and what it found nothing to delete", async () => {
    const dir = pruneRoot({ runs: { "run-new": 1 } });
    const result = await prune(dir);
    assert.equal(result.code, 0);
    assert.match(result.out, /nothing to prune/);
  });
});

describe("prune --declined: a no is remembered, and writes no config", () => {
  it("writes a marker file in the run directory that no later prune deletes", async () => {
    const dir = pruneRoot({ config: null, runs: { "run-old": 900 } });
    const result = await prune(dir, ["--declined"]);
    assert.equal(result.code, 0, result.out);
    const marker = join(dir, "tmp", "orchestrate", "prune-declined");
    assert.equal(existsSync(marker), true);
    assert.equal(existsSync(join(dir, "orchestrate.config.yml")), false);
    await prune(dir);
    assert.deepEqual(kept(dir), ["prune-declined", "records", "run-old"]);
  });

  it("exits 2 with the usage on an unknown flag", async () => {
    const result = await prune(pruneRoot({ config: null }), ["--now"]);
    assert.equal(result.code, 2);
    assert.match(result.out, /usage: node records\.mjs prune/);
  });
});

// --- dashboard: the past-runs page, built from local Run Records.

const PROSE = "CANARY-PROSE the Chief of Staff said something private";
const SECRET = "s3cr3t-key-value-0123456789";
const OTHER_RUN = "2026-11-21-tickets-9";

/** A root with the spec-344 record derived, an Activity Log beside its run folder, and a second record with no run folder. */
async function readyToBuild() {
  const dir = root();
  await derived(dir);
  writeFileSync(join(runFolder(dir), "activity.md"), `# Activity Log\n\n${PROSE}\n`);
  const second = JSON.parse(readFileSync(recordPath(dir), "utf8"));
  second.run.id = OTHER_RUN;
  second.run.kind = "tickets";
  second.run.outcome = "abandoned";
  writeFileSync(
    join(dir, "tmp", "orchestrate", "records", `${OTHER_RUN}.json`),
    JSON.stringify(second),
  );
  return dir;
}
const BUILT_AT = at("2026-11-25T10:00:00Z");
const dashboard = (dir, args = [], env = {}) =>
  main(["dashboard", ...args], { cwd: dir, now: BUILT_AT, env });
const page = (dir, name = "dashboard.html") =>
  readFileSync(join(dir, "tmp", "orchestrate", name), "utf8");
/** The page without its stylesheet and scripts: what a reader sees, and the attributes that carry colour. */
const body = (html) =>
  html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");

describe("dashboard: building the page", () => {
  it("writes the page into the run directory and prints a file:// link, never opening a browser", async () => {
    const dir = await readyToBuild();
    const calls = [];
    const result = await main(["dashboard"], {
      cwd: dir,
      now: BUILT_AT,
      exec: (command, args) => (calls.push(command), { code: 1, out: "" }),
    });
    assert.equal(result.code, 0, result.out);
    const file = join(dir, "tmp", "orchestrate", "dashboard.html");
    assert.ok(existsSync(file));
    assert.ok(result.out.split("\n").includes(pathToFileURL(file).href), result.out);
    assert.match(result.out, /2 Run Records/);
    assert.deepEqual(
      calls.filter((c) => !["git", "gh", "glab"].includes(c)),
      [],
    );
    assert.ok(!existsSync(join(dir, "tmp", "orchestrate", "dashboard.local.html")));
  });

  it("has one self-contained page: no external script, style or request", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    assert.match(html, /^<!doctype html>/i);
    assert.doesNotMatch(
      html,
      /<script[^>]+src=|<link[^>]+href=|@import|https?:\/\/(?!github\.com)/i,
    );
  });

  it("shows when it was built and the rebuild command", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = body(page(dir));
    assert.match(html, /Built 2026-11-25T10:00:00Z/);
    assert.match(html, /Rebuild: <code>\/orchestrate --dashboard<\/code>/);
    assert.match(html, /records\.mjs dashboard/);
  });

  it("exits 1 and writes nothing when there are no Run Records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orchestrate-records-"));
    made.push(dir);
    const result = await dashboard(dir);
    assert.equal(result.code, 1);
    assert.match(result.out, /no Run Records/);
    assert.ok(!existsSync(join(dir, "tmp", "orchestrate", "dashboard.html")));
  });

  it("skips a record that is not JSON or fails the safe-field check, names it, and builds the rest", async () => {
    const dir = await readyToBuild();
    const records = join(dir, "tmp", "orchestrate", "records");
    writeFileSync(join(records, "broken.json"), "{not json");
    const unsafe = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    unsafe.run.id = "2026-11-22-unsafe";
    unsafe.run.outcome = "a sentence of free text";
    writeFileSync(join(records, "2026-11-22-unsafe.json"), JSON.stringify(unsafe));
    const result = await dashboard(dir);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /skipped broken\.json/);
    assert.match(result.out, /skipped 2026-11-22-unsafe\.json/);
    assert.doesNotMatch(page(dir), /a sentence of free text/);
  });

  it("takes only --local-logs, and exits 2 with the usage on anything else", async () => {
    const dir = await readyToBuild();
    assert.equal((await dashboard(dir, ["--sink", "x"])).code, 2);
    assert.equal((await dashboard(dir, ["extra"])).code, 2);
    assert.equal((await dashboard(dir, ["--local-logs", "--local-logs"])).code, 2);
  });

  it("reads the run directory from the config", async () => {
    const dir = await readyToBuild();
    renameSync(join(dir, "tmp", "orchestrate"), join(dir, "runs"));
    writeFileSync(join(dir, "orchestrate.config.yml"), "run_dir: runs\n");
    const result = await dashboard(dir);
    assert.equal(result.code, 0, result.out);
    assert.ok(existsSync(join(dir, "runs", "dashboard.html")));
  });
});

describe("dashboard: as a script", () => {
  it("builds and prints the link when run from the command line", async () => {
    const dir = await readyToBuild();
    const result = spawnSync(process.execPath, [join(here, "records.mjs"), "dashboard"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^file:\/\/.*dashboard\.html$/m);
    assert.ok(existsSync(join(dir, "tmp", "orchestrate", "dashboard.html")));
  });
});

describe("dashboard: the pages and tabs", () => {
  const TABS = ["summary", "timeline", "delegations", "steps", "reviews", "log", "record"];

  it("has the Run page with every tab, for every run", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    for (const run of [RUN, OTHER_RUN])
      for (const tab of TABS) assert.match(html, new RegExp(`id="/run/${run}/${tab}"`), tab);
    const labels = [
      ...html.matchAll(/<a class="tab[^"]*" href="#\/run\/2026-11-19-spec-344\/\w+"[^>]*>([^<]+)/g),
    ].map((m) => m[1].replace(/&amp;/g, "&").trim());
    assert.deepEqual(
      [...new Set(labels)],
      ["Summary", "Timeline", "Delegations", "Human steps", "Reviews & CI", "Log", "Record (JSON)"],
    );
  });

  it("has the Runs index, the Key page, and a page for every Delegation and human step", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    assert.match(html, /id="\/"/);
    assert.match(html, /id="\/key"/);
    for (const d of record.delegations)
      assert.match(html, new RegExp(`id="/run/${RUN}/delegation/${d.id}"`));
    record.human_steps.forEach((_, n) =>
      assert.match(html, new RegExp(`id="/run/${RUN}/step/${n + 1}"`)),
    );
    assert.match(html, /href="#\/run\/2026-11-19-spec-344\/step\/1"/);
  });

  it("Summary has what to improve next run, why you were needed, the plan and the outcome", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const summary = html.split(`id="/run/${RUN}/summary"`)[1].split("</section>")[0];
    for (const heading of ["Improve next run", "Why you were needed", "Plan", "Outcome"])
      assert.match(summary, new RegExp(`<h2>${heading}</h2>`));
    assert.match(summary, /13 human steps/);
    assert.match(summary, /9 avoidable/);
  });

  it("Timeline has a Human lane, a Chief of Staff lane, a Reviews & CI lane and one lane per Delegation", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    const timeline = html.split(`id="/run/${RUN}/timeline"`)[1].split("</section>")[0];
    const lanes = [...timeline.matchAll(/data-lane="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(lanes, [
      "human",
      "chief-of-staff",
      "reviews-ci",
      ...record.delegations.map((d) => `delegation:${d.id}`),
    ]);
    // Writes are marked by their actor.
    for (const write of record.writes)
      assert.match(timeline, new RegExp(`class="mark write actor-${write.actor}"`));
    assert.match(timeline, />Human</);
    assert.match(timeline, />Chief of Staff</);
  });

  it("Human steps lists every step, each with its cause, kind and actor to filter on", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    const steps = html.split(`id="/run/${RUN}/steps"`)[1].split("</section>")[0];
    const rows = [
      ...steps.matchAll(/<tr [^>]*data-cause="([^"]+)" data-kind="([^"]+)" data-actor="([^"]+)"/g),
    ];
    assert.equal(rows.length, record.human_steps.length);
    assert.deepEqual(
      rows.map((m) => m[1]),
      record.human_steps.map((s) => s.cause),
    );
    assert.match(steps, /<select[^>]+data-filter="cause"/);
    assert.match(steps, /<select[^>]+data-filter="kind"/);
  });

  it("Reviews & CI lists each review round and each CI result", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    const tab = html.split(`id="/run/${RUN}/reviews"`)[1].split("</section>")[0];
    assert.equal((tab.match(/<tr data-review/g) ?? []).length, record.reviews.length);
    assert.equal((tab.match(/<tr data-ci/g) ?? []).length, record.ci.length);
  });

  it("the step page has the step in a sentence, its cause and fix, the events around it and the raw entry", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    const first = html.split(`id="/run/${RUN}/step/1"`)[1].split("</section>")[0];
    assert.match(first, /class="sentence"/);
    assert.match(first, /<h2>Cause and fix<\/h2>/);
    assert.match(first, /<h2>Around it<\/h2>/);
    assert.match(first, /<h2>Raw entry<\/h2>/);
    assert.match(first, new RegExp(`&quot;kind&quot;: &quot;${record.human_steps[0].kind}&quot;`));
  });

  it("the Delegation page has its facts, its steps and its writes", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    const d = record.delegations[0];
    const text = html.split(`id="/run/${RUN}/delegation/${d.id}"`)[1].split("</section>")[0];
    assert.match(text, new RegExp(`<h1>Delegation ${d.id}`));
    assert.match(text, /<h2>Facts<\/h2>/);
    assert.match(text, /<h2>Human steps<\/h2>/);
    assert.match(text, new RegExp(`Executor</dt><dd>${d.executor}`));
  });

  it("the Key page explains every cause, every step kind and every timeline mark", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const key = html.split('id="/key"')[1].split("</section>")[0];
    for (const cause of Object.keys(CAUSES)) assert.match(key, new RegExp(`data-cause="${cause}"`));
    for (const kind of STEP_KINDS) assert.match(key, new RegExp(`data-kind="${kind}"`));
    for (const mark of ["human-step", "wait", "write", "delegation", "review", "ci"])
      assert.match(key, new RegExp(`data-mark="${mark}"`));
  });
});

describe("dashboard: colour means cause", () => {
  it("every cause chip names its cause and says avoidable or by design", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = body(page(dir));
    const chips = [
      ...html.matchAll(/<span class="chip cause c-([a-z-]+)">([\s\S]*?)<\/span><\/span>/g),
    ].map((m) => [m[0], m[1], `${m[2]}</span>`]);
    assert.ok(chips.length > 20, "there are chips");
    for (const [, cause, inner] of chips) {
      assert.ok(Object.hasOwn(CAUSES, cause), cause);
      assert.match(inner, /class="tag (avoid|design)">(avoidable|by design)</);
      const wanted = CAUSES[cause] === "avoidable" ? "avoidable" : "by design";
      assert.ok(inner.includes(`>${wanted}<`), `${cause} is ${wanted}`);
      assert.ok(inner.replace(/<[^>]+>/g, " ").trim().length > wanted.length, "it names the cause");
    }
  });

  it("the stylesheet gives each cause one colour, and no page element carries a colour of its own", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const colours = Object.keys(CAUSES).map((cause) => {
      const m = css.match(new RegExp(`\\.c-${cause}\\s*\\{[^}]*--cause:\\s*(#[0-9a-f]{6})`, "i"));
      assert.ok(m, `${cause} has a colour`);
      return m[1].toLowerCase();
    });
    assert.equal(new Set(colours).size, colours.length, "no two causes share a colour");
    assert.doesNotMatch(
      body(html),
      /#(?:[0-9a-f]{6}|[0-9a-f]{8})\b|rgb\(|hsl\(|style="[^"]*(?:color|fill|stroke|background)/i,
    );
  });

  it("states are grey: a state chip never carries a cause class", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = body(page(dir));
    const states = [...html.matchAll(/<span class="([^"]*\bstate\b[^"]*)"/g)].map((m) => m[1]);
    assert.ok(states.length > 0);
    for (const cls of states) assert.doesNotMatch(cls, /\bc-|\bcause\b/);
    const css = page(dir).match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.match(css, /\.state\s*\{[^}]*var\(--grey\)/);
  });
});

describe("dashboard: the Log tab", () => {
  it("has the Run Events as text derived from the record, to copy or download", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const log = html.split(`id="/run/${RUN}/log"`)[1].split("</section>")[0];
    const events = log.match(/<pre class="log" id="events-[^"]+">([\s\S]*?)<\/pre>/)[1];
    const lines = events.trim().split("\n");
    assert.match(lines[0], /^2026-11-19T01:44:00Z\s+run-opened/);
    assert.ok(
      lines.some(
        (l) => /human-step/.test(l) && /actor=human/.test(l) && /cause=harness-limit/.test(l),
      ),
    );
    assert.ok(lines.some((l) => /delegation-started/.test(l) && /d348/.test(l)));
    assert.match(lines.at(-1), /run-closed/);
    const times = lines.map((l) => l.split(/\s+/)[0]);
    assert.deepEqual(times, [...times].sort());
    assert.match(log, /data-copy="events-/);
    assert.match(
      log,
      /data-download="events-[^"]+" data-filename="2026-11-19-spec-344-events\.txt"/,
    );
  });

  it("has the report text for the run", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const log = html.split(`id="/run/${RUN}/log"`)[1].split("</section>")[0];
    const report = log.match(/<pre class="log" id="report-[^"]+">([\s\S]*?)<\/pre>/)[1];
    assert.match(report, /^Run 2026-11-19-spec-344/m);
    assert.match(report, /13 human steps \(9 avoidable, 4 by design\)/);
    assert.match(report, /d348/);
  });

  it("has the Record as JSON, the same record that is on disk", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    const tab = html.split(`id="/run/${RUN}/record"`)[1].split("</section>")[0];
    const json = tab.match(/<pre class="log" id="record-[^"]+">([\s\S]*?)<\/pre>/)[1];
    const text = json.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&amp;", "&");
    assert.deepEqual(JSON.parse(text), JSON.parse(readFileSync(recordPath(dir), "utf8")));
  });
});

describe("dashboard: private prose, only with --local-logs and only in its own file", () => {
  it("holds no prose without --local-logs", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    assert.ok(!html.includes(PROSE));
    assert.doesNotMatch(html, /contains private prose from this machine/);
    assert.ok(!existsSync(join(dir, "tmp", "orchestrate", "dashboard.local.html")));
  });

  it("puts the prose Activity Log and the banner only in dashboard.local.html", async () => {
    const dir = await readyToBuild();
    const result = await dashboard(dir, ["--local-logs"]);
    assert.equal(result.code, 0, result.out);
    const local = page(dir, "dashboard.local.html");
    assert.ok(local.includes(PROSE));
    assert.match(
      local,
      /contains private prose from this machine, don&#39;t share this file|contains private prose from this machine, don't share this file/,
    );
    const shared = page(dir);
    assert.ok(!shared.includes(PROSE));
    assert.doesNotMatch(shared, /contains private prose from this machine/);
    const links = result.out.split("\n").filter((l) => l.startsWith("file://"));
    assert.equal(links.length, 2);
    assert.match(links[1], /dashboard\.local\.html$/);
  });

  it("inlines prose only for a run whose folder still exists", async () => {
    const dir = await readyToBuild();
    await dashboard(dir, ["--local-logs"]);
    const local = page(dir, "dashboard.local.html");
    const log = (run) => local.split(`id="/run/${run}/log"`)[1].split("</section>")[0];
    assert.match(log(RUN), /<h2>Activity Log \(local only\)<\/h2>/);
    assert.doesNotMatch(log(OTHER_RUN), /Activity Log/);
    assert.match(log(OTHER_RUN), /no run folder on this machine/);
  });

  it("escapes the prose, so it cannot add markup", async () => {
    const dir = await readyToBuild();
    writeFileSync(join(runFolder(dir), "activity.md"), "</pre><script>alert(1)</script>\n");
    await dashboard(dir, ["--local-logs"]);
    const local = page(dir, "dashboard.local.html");
    assert.ok(!local.includes("<script>alert(1)"));
    assert.ok(local.includes("&lt;script&gt;alert(1)"));
  });

  it("never shows a credential, in either file, even one quoted in the prose", async () => {
    const dir = await readyToBuild();
    writeFileSync(join(runFolder(dir), "activity.md"), `leaked ${SECRET} here\n`);
    const env = {
      ORCHESTRATE_S3_SECRET_ACCESS_KEY: SECRET,
      ORCHESTRATE_S3_ACCESS_KEY_ID: "AKIAEXAMPLEKEYID0000",
      GH_TOKEN: "ghp_exampletoken0123456789",
    };
    await dashboard(dir, ["--local-logs"], env);
    for (const name of ["dashboard.html", "dashboard.local.html"]) {
      const html = page(dir, name);
      for (const value of Object.values(env)) assert.ok(!html.includes(value), `${name} ${value}`);
    }
    assert.match(page(dir, "dashboard.local.html"), /leaked \[redacted\] here/);
  });
});

// --- dashboard: reading the configured sink, and every repository in it.

const NS_A = "github.com/mnaimfaizy/agent-kit";
const NS_B = "github.com/acme/widgets";
const ORIGIN = { origin: "git@github.com:mnaimfaizy/agent-kit.git" };
const sinkFile = (ns, login, id) => `records/${ns}/${login}/${id}.json`;

/** The spec-344 record as bytes, made over as another repository's, login's and run's. */
function recordBytes(stencil, { repo, login, id, outcome }) {
  const record = JSON.parse(stencil);
  record.run.id = id;
  record.run.repo = repo;
  record.run.operator = login;
  if (outcome) record.run.outcome = outcome;
  return `${JSON.stringify(record, null, 2)}\n`;
}

/**
 * A root with a configured github sink holding records from two repositories
 * and two logins, plus paths that do not parse. Returns the fake transport
 * and the files behind it.
 */
async function readyToRead({ config = SINK_CONFIG, sink = {} } = {}) {
  const dir = await readyToUpload({ config });
  const stencil = readFileSync(recordPath(dir), "utf8");
  const bytes = (spec) => recordBytes(stencil, spec);
  const files = new Map([
    [
      sinkFile(NS_A, "naim", "2026-11-01-tickets-1"),
      bytes({ repo: NS_A, login: "naim", id: "2026-11-01-tickets-1" }),
    ],
    [
      sinkFile(NS_A, "lee", "2026-11-02-tickets-2"),
      bytes({ repo: NS_A, login: "lee", id: "2026-11-02-tickets-2", outcome: "abandoned" }),
    ],
    [
      sinkFile(NS_B, "naim", "2026-11-03-spec-9"),
      bytes({ repo: NS_B, login: "naim", id: "2026-11-03-spec-9" }),
    ],
    // The same run id in another repository: two pages, never one.
    [
      sinkFile(NS_B, "lee", "2026-11-01-tickets-1"),
      bytes({ repo: NS_B, login: "lee", id: "2026-11-01-tickets-1" }),
    ],
    [`records/${NS_B}/oops.json`, "{}"],
    ["records/stray.txt", "x"],
    ["README.md", "outside records/"],
  ]);
  const transport = fakeTransport({
    remotes: ORIGIN,
    repos: { "acme/run-records": { files, ...sink } },
  });
  // Nothing is local: the derived record was only the stencil.
  rmSync(recordPath(dir));
  return { dir, files, transport, bytes, stencil };
}
const addLocal = (dir, id, text) =>
  writeFileSync(join(dir, "tmp", "orchestrate", "records", `${id}.json`), text);
const build = (dir, transport, args = [], env = {}) =>
  main(["dashboard", ...args], { cwd: dir, now: BUILT_AT, env, exec: transport.exec });
const reads = (transport) =>
  transport.calls.filter(
    (c) => c.args.some((a) => /\/contents\//.test(a)) && !c.args.includes("PUT"),
  );
const section = (html, id) => html.split(`id="${id}"`)[1].split("</section>")[0];

describe("dashboard: namespaces from the sink's paths", () => {
  it("lists every namespace found, the logins under it, and skips a path that does not parse", async () => {
    const { dir, transport } = await readyToRead();
    const result = await build(dir, transport);
    assert.equal(result.code, 0, result.out);
    const html = body(page(dir));
    for (const ns of [NS_A, NS_B]) assert.match(html, new RegExp(`id="/repo/${ns}"`));
    const tree = section(html, "/").split("data-tree")[1].split("</ul>\n</div>")[0];
    for (const login of ["naim", "lee"]) assert.match(tree, new RegExp(`>${login}<`));
    assert.match(tree, new RegExp(NS_A));
    assert.match(tree, new RegExp(NS_B));
    // The malformed paths are listed, in the output and in the page, and nothing else is.
    assert.match(result.out, new RegExp(`skipped records/${NS_B}/oops\\.json`));
    assert.match(result.out, /skipped records\/stray\.txt/);
    const skipped = section(html, "/").split("data-skipped")[1].split("</ul>")[0];
    assert.match(skipped, /oops\.json/);
    assert.match(skipped, /stray\.txt/);
    assert.doesNotMatch(skipped, /README/);
    assert.match(result.out, /built the dashboard from 4 Run Records/);
  });

  it("gives a run id that two repositories share one page each", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const html = page(dir);
    const ids = [...html.matchAll(/<section class="page" id="(\/run\/[^"]*\/summary)"/g)].map(
      (m) => m[1],
    );
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 4);
    assert.equal(ids.filter((i) => i.includes("2026-11-01-tickets-1")).length, 2);
  });

  it("lists a truncated recursive listing level by level and still builds", async () => {
    const { dir, transport } = await readyToRead({ sink: { truncate: true } });
    const result = await build(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /4 Run Records/);
  });

  it("makes one recursive Git Trees call to list", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const trees = transport.calls.filter((c) => c.args.some((a) => /git\/trees\//.test(a)));
    assert.equal(trees.length, 1);
    assert.ok(trees[0].args.some((a) => a.includes("recursive=1")));
  });
});

describe("dashboard: GitLab subgroups in the Namespaces tree (C2)", () => {
  it("names a project by its last segment, under its whole group path, one node per project", async () => {
    const { dir, transport, files, bytes } = await readyToRead();
    for (const name of ["a", "b"])
      files.set(
        sinkFile(
          `gitlab.com/grp/sub/${name}`,
          "naim",
          `2026-11-0${name === "a" ? 5 : 6}-tickets-${name}`,
        ),
        bytes({
          repo: `gitlab.com/grp/sub/${name}`,
          login: "naim",
          id: `2026-11-0${name === "a" ? 5 : 6}-tickets-${name}`,
        }),
      );
    const result = await build(dir, transport);
    assert.equal(result.code, 0, result.out);
    const html = body(page(dir));
    const tree = section(html, "/").split("data-tree")[1].split("</ul>\n</div>")[0];
    assert.match(tree, /<code>grp\/sub<\/code>/);
    for (const name of ["a", "b"]) {
      const route = `/repo/gitlab.com/grp/sub/${name}`;
      assert.match(
        tree,
        new RegExp(`<a href="#${route}">${name}</a> <span class="muted small">1 run</span>`),
      );
      assert.match(html, new RegExp(`<section class="page" id="${route}"`));
    }
    assert.doesNotMatch(tree, /href="#\/repo\/gitlab\.com\/grp\/sub"/);
  });
});

describe("dashboard: a step page centres on its own line (C17)", () => {
  it("shows each of two same-kind steps in one second around its own line", async () => {
    let total = 0;
    const dir = await readyToUpload({
      edit: (text) => {
        const record = JSON.parse(text);
        const first = record.human_steps[0];
        const twin = (how) => ({
          ...first,
          how,
          wait_id: null,
          opened_at: null,
          waited_seconds: null,
        });
        record.human_steps.splice(1, 0, twin("chat"), twin("card"));
        total = record.human_steps.length;
        return `${JSON.stringify(record, null, 2)}\n`;
      },
    });
    const result = await dashboard(dir);
    assert.equal(result.code, 0, result.out);
    assert.ok(total > 3);
    const html = page(dir);
    const around = (n) =>
      section(html, `/run/${RUN}/step/${n}`).split("<h2>Around it</h2>")[1].split("</pre>")[0];
    const centre = (n) => {
      const lines = around(n)
        .replace(/^\s*<pre class="log">/, "")
        .split("\n");
      return lines[Math.min(3, lines.length - 1)];
    };
    assert.notEqual(around(2), around(3));
    assert.match(centre(3), /human-step/);
    assert.match(centre(3), /how=card/);
    assert.match(centre(2), /how=chat/);
  });
});

describe("dashboard: the cache", () => {
  it("fetches only new paths: a second build makes no read, a new path makes one", async () => {
    const { dir, transport, files, bytes } = await readyToRead();
    await build(dir, transport);
    assert.equal(reads(transport).length, 4);
    transport.calls.length = 0;
    const again = await build(dir, transport);
    assert.equal(again.code, 0, again.out);
    assert.equal(reads(transport).length, 0);
    assert.match(again.out, /4 Run Records/);
    files.set(
      sinkFile(NS_A, "naim", "2026-11-09-tickets-5"),
      bytes({ repo: NS_A, login: "naim", id: "2026-11-09-tickets-5" }),
    );
    transport.calls.length = 0;
    const third = await build(dir, transport);
    assert.equal(reads(transport).length, 1);
    assert.match(third.out, /5 Run Records/);
  });

  it("keeps the cache under a folder that mirrors the sink paths", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const cached = join(
      dir,
      "tmp",
      "orchestrate",
      "records-cache",
      "github.com",
      "acme",
      "run-records",
      sinkFile(NS_A, "naim", "2026-11-01-tickets-1"),
    );
    assert.ok(existsSync(cached), cached);
    assert.equal(
      readFileSync(cached, "utf8"),
      transport.repos["acme/run-records"].files.get(sinkFile(NS_A, "naim", "2026-11-01-tickets-1")),
    );
  });

  it("checks a cached record again: one edited since it was cached is skipped, never shown", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const cached = join(
      dir,
      "tmp",
      "orchestrate",
      "records-cache",
      "github.com",
      "acme",
      "run-records",
      sinkFile(NS_A, "lee", "2026-11-02-tickets-2"),
    );
    const record = JSON.parse(readFileSync(cached, "utf8"));
    record.run.outcome = "a sentence of free text";
    writeFileSync(cached, JSON.stringify(record));
    const result = await build(dir, transport);
    assert.match(
      result.out,
      /skipped records\/.*2026-11-02-tickets-2\.json: fails the safe-field check/,
    );
    assert.doesNotMatch(page(dir), /a sentence of free text/);
  });
});

describe("dashboard: local and sink copies", () => {
  /** A local record made over as the sink's `id` copy (same or different bytes), or another run. */
  async function withLocal() {
    const ready = await readyToRead();
    const { dir, files } = ready;
    const records = join(dir, "tmp", "orchestrate", "records");
    const same = sinkFile(NS_A, "naim", "2026-11-01-tickets-1");
    writeFileSync(join(records, "2026-11-01-tickets-1.json"), files.get(same));
    const other = sinkFile(NS_A, "lee", "2026-11-02-tickets-2");
    const changed = JSON.parse(files.get(other));
    changed.run.outcome = "merged";
    writeFileSync(join(records, "2026-11-02-tickets-2.json"), JSON.stringify(changed));
    const only = JSON.parse(files.get(same));
    only.run.id = "2026-11-10-tickets-7";
    writeFileSync(join(records, "2026-11-10-tickets-7.json"), JSON.stringify(only));
    return ready;
  }

  it("counts identical bytes in both once, tags a local-only record not uploaded with its --upload command, and warns when the bytes differ", async () => {
    const { dir, transport } = await withLocal();
    const result = await build(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /built the dashboard from 5 Run Records/);
    assert.match(
      result.out,
      /records\/github\.com\/mnaimfaizy\/agent-kit\/lee\/2026-11-02-tickets-2\.json.*differ/,
    );
    const html = body(page(dir));
    const tagged = [
      ...html.matchAll(
        /<span class="state not-uploaded">not uploaded<\/span> <code>([^<]+)<\/code>/g,
      ),
    ].map((m) => m[1]);
    assert.ok(tagged.includes("/orchestrate --upload 2026-11-10-tickets-7"), tagged.join());
    assert.ok(!tagged.includes("/orchestrate --upload 2026-11-01-tickets-1"));
    assert.ok(!tagged.includes("/orchestrate --upload 2026-11-02-tickets-2"));
    // The warning is in the page, too.
    assert.match(html, /<div class="warn">[^<]*2026-11-02-tickets-2[^<]*differ/);
    // The sink's copy won: its abandoned outcome, not the local "merged".
    const row = html.split("2026-11-02-tickets-2/summary")[1].split("</tr>")[0];
    assert.match(row, /abandoned/);
  });

  it("does not tag a record not uploaded when no sink is configured or the sink was not read", async () => {
    const none = await readyToBuild();
    await dashboard(none);
    assert.doesNotMatch(page(none), /not uploaded/);
    const { dir } = await withLocal();
    const down = fakeTransport({
      remotes: ORIGIN,
      repos: { "acme/run-records": { forbidden: true } },
    });
    await build(dir, down);
    assert.doesNotMatch(page(dir), /not uploaded/);
  });
});

describe("dashboard: a sink that cannot be read", () => {
  for (const [why, sink] of [
    ["404", null],
    ["403", { forbidden: true }],
  ]) {
    it(`warns once on a ${why} and builds the page from local`, async () => {
      const { dir, bytes } = await readyToRead();
      addLocal(
        dir,
        "2026-11-12-tickets-3",
        bytes({ repo: NS_A, login: "naim", id: "2026-11-12-tickets-3" }),
      );
      const transport = fakeTransport({
        remotes: ORIGIN,
        repos: sink ? { "acme/run-records": sink } : {},
      });
      if (!sink) delete transport.repos["acme/run-records"];
      const result = await build(dir, transport);
      assert.equal(result.code, 0, result.out);
      assert.equal((result.out.match(/acme\/run-records/g) ?? []).length, 1, result.out);
      assert.match(result.out, /could not read `acme\/run-records`/);
      assert.match(result.out, /1 Run Record\b/);
      assert.match(body(page(dir)), /<div class="warn">[^<]*could not read/);
      assert.equal(reads(transport).length, 0);
    });
  }

  it("warns about a sink that has turned public, and reads it anyway", async () => {
    const { dir, transport } = await readyToRead({ sink: { visibility: "public" } });
    const result = await build(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /acme\/run-records.* is not private \(public\)/);
    assert.match(result.out, /4 Run Records|5 Run Records/);
    assert.ok(reads(transport).length > 0);
  });

  it("checks the sink is private before it lists or reads anything", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const asked = (c) => c.command === "gh" && c.args.at(-1) === "repos/acme/run-records";
    const first = transport.calls.findIndex(asked);
    assert.ok(first >= 0);
    const firstRead = transport.calls.findIndex((c) =>
      c.args.some((a) => /git\/trees|\/contents\//.test(a)),
    );
    assert.ok(first < firstRead);
  });

  it("reads only the local records when no sink is configured", async () => {
    const dir = await readyToBuild();
    const transport = fakeTransport({ remotes: ORIGIN });
    const result = await build(dir, transport);
    assert.equal(result.code, 0, result.out);
    assert.equal(transport.calls.filter((c) => c.command === "gh").length, 0);
  });
});

describe("the page shell: routes and the Repository switcher", () => {
  it("opens the home page on a hash that does not decode, instead of stopping the script (C18)", () => {
    assert.equal(
      routeOf("#50%", { home: "/repo/github.com/acme/app" }),
      "/repo/github.com/acme/app",
    );
    assert.equal(routeOf("#%E0%A4%A", {}), "/");
    assert.equal(routeOf("", { home: "/repo/x" }), "/repo/x");
    assert.equal(routeOf("#/run/a%20b/summary", {}), "/run/a b/summary");
  });

  it("selects a repository's own option, never one whose name only begins the same (C3)", () => {
    const values = ["/", "/repo/github.com/acme/app", "/repo/github.com/acme/app-two"];
    for (const page of [
      "/repo/github.com/acme/app-two",
      "/repo/github.com/acme/app-two/person/lee",
      "/repo/github.com/acme/app-two/spec/9",
    ])
      assert.equal(switcherFor(page, values), "/repo/github.com/acme/app-two", page);
    assert.equal(switcherFor("/repo/github.com/acme/app", values), "/repo/github.com/acme/app");
    assert.equal(
      switcherFor("/repo/github.com/acme/app/person/naim", values),
      "/repo/github.com/acme/app",
    );
    assert.equal(switcherFor("/", values), null);
  });

  it("runs the same route and switcher code in the page as the tests check", async () => {
    const dir = await readyToBuild();
    await dashboard(dir);
    const html = page(dir);
    assert.ok(html.includes(String(routeOf)));
    assert.ok(html.includes(String(switcherFor)));
    assert.doesNotMatch(html, /decodeURIComponent\(location\.hash/);
  });

  it("follows an alias from a run's qualified route to the route its page has", () => {
    const aliases = { "/run/github.com/acme/app/naim/r1": "/run/r1" };
    assert.equal(
      routeOf("#/run/github.com/acme/app/naim/r1/summary", { aliases }),
      "/run/r1/summary",
    );
    assert.equal(routeOf("#/run/github.com/acme/app/naim/r1", { aliases }), "/run/r1");
    assert.equal(
      routeOf("#/run/github.com/acme/app/naim/r10/summary", { aliases }),
      "/run/github.com/acme/app/naim/r10/summary",
    );
  });
});

describe("board: the closed run's link opens its dashboard page, whatever runs share its id (C4)", () => {
  const CLOSED = "2026-11-19T06:30:00Z";
  const OWN = `/run/github.com/mnaimfaizy/agent-kit/naim/${RUN}`;
  const target = (html, prefix) =>
    new RegExp(`<a href="${prefix.replace(/[.\/]/g, "\\$&")}#([^"]+)">This run's page`).exec(
      html,
    )?.[1] ?? new RegExp(`<a href="${prefix.replace(/[.\/]/g, "\\$&")}#([^"]+)">`).exec(html)?.[1];
  const sections = (html) =>
    new Set([...html.matchAll(/<section class="page" id="([^"]+)"/g)].map((m) => m[1]));
  const aliasesOf = (html) => {
    const raw = /<body[^>]* data-aliases="([^"]*)"/.exec(html)?.[1];
    return raw ? JSON.parse(raw.replaceAll("&quot;", '"').replaceAll("&amp;", "&")) : {};
  };
  const closedWithRecord = async () => {
    const dir = replayed(CLOSED);
    writeFileSync(join(dir, "orchestrate.config.yml"), SINK_CONFIG);
    assert.equal((await derive(dir)).code, 0);
    return dir;
  };

  it("links under the run's repository and login once its record is derived", async () => {
    const dir = await closedWithRecord();
    const { html } = await board(dir, [], { until: CLOSED });
    assert.equal(target(html, "../dashboard.html"), `${OWN}/summary`);
  });

  it("opens that page when a teammate's run shares the id, and when no run does", async () => {
    const dir = await closedWithRecord();
    const { html } = await board(dir, [], { until: CLOSED });
    const hash = target(html, "../dashboard.html");
    const stencil = readFileSync(recordPath(dir), "utf8");
    const lee = recordBytes(stencil, { repo: NS_A, login: "lee", id: RUN });
    // Alone: the dashboard keys the run on its id, and the board's route is an alias of it.
    const alone = fakeTransport({
      remotes: ORIGIN,
      repos: { "acme/run-records": { files: new Map() } },
    });
    await build(dir, alone);
    const one = page(dir);
    assert.ok(sections(one).has(`/run/${RUN}/summary`));
    assert.ok(sections(one).has(routeOf(`#${hash}`, { aliases: aliasesOf(one) })));
    // A teammate's run with the same id: the dashboard keys both under repository and login.
    const shared = fakeTransport({
      remotes: ORIGIN,
      repos: { "acme/run-records": { files: new Map([[sinkFile(NS_A, "lee", RUN), lee]]) } },
    });
    await build(dir, shared);
    const two = page(dir);
    assert.ok(!sections(two).has(`/run/${RUN}/summary`));
    assert.ok(sections(two).has(hash), hash);
    assert.ok(sections(two).has(routeOf(`#${hash}`, { aliases: aliasesOf(two) })));
  });

  it("links under the repository with `-` for no login, and opens that page beside a teammate's run of the same id (D8)", async () => {
    const dir = replayed(CLOSED);
    writeFileSync(join(dir, "orchestrate.config.yml"), SINK_CONFIG);
    assert.equal((await derive(dir, { env: {}, exec: () => ({ code: 1, out: "" }) })).code, 0);
    assert.equal(JSON.parse(readFileSync(recordPath(dir), "utf8")).run.operator, null);
    const { html } = await board(dir, [], { until: CLOSED });
    const hash = target(html, "../dashboard.html");
    assert.equal(hash, `/run/github.com/mnaimfaizy/agent-kit/-/${RUN}/summary`);
    const stencil = readFileSync(recordPath(dir), "utf8");
    const lee = recordBytes(stencil, { repo: NS_A, login: "lee", id: RUN });
    const shared = fakeTransport({
      remotes: ORIGIN,
      repos: { "acme/run-records": { files: new Map([[sinkFile(NS_A, "lee", RUN), lee]]) } },
    });
    await build(dir, shared);
    assert.ok(sections(page(dir)).has(hash), hash);
  });

  it("links the bare run id when the local record has no `run`, and still writes the board", async () => {
    const dir = replayed(CLOSED);
    mkdirSync(join(dir, "tmp", "orchestrate", "records"), { recursive: true });
    writeFileSync(recordPath(dir), "{}");
    const { result, html } = await board(dir, [], { until: CLOSED });
    assert.equal(result.code, 0, result.out);
    assert.equal(target(html, "../dashboard.html"), `/run/${RUN}/summary`);
  });

  it("links the served board the same way", async () => {
    const dir = await closedWithRecord();
    const server = await serving(dir);
    const html = await (await fetch(server.url)).text();
    assert.equal(target(html, "/dashboard"), `${OWN}/summary`);
  });
});

describe("dashboard: the Repository switcher and the pages", () => {
  it("offers All repositories and every namespace, and opens on the current repository", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const html = body(page(dir));
    const select = html.split('id="repo-switch"')[1].split("</select>")[0];
    const options = [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g)].map((m) => [
      m[1],
      m[2],
    ]);
    assert.deepEqual(options, [
      ["/", "All repositories"],
      [`/repo/${NS_B}`, NS_B],
      [`/repo/${NS_A}`, NS_A],
    ]);
    assert.match(html, new RegExp(`<body data-home="/repo/${NS_A}"`));
  });

  it("names the run's repository on a run page and a Delegation page opened by address", async () => {
    const values = ["/", `/repo/${NS_A}`, `/repo/${NS_B}`];
    // A run's pages are not under its repository's route: the page names its owner.
    assert.equal(switcherFor("/run/r1/summary", values, `/repo/${NS_B}`), `/repo/${NS_B}`);
    assert.equal(switcherFor("/run/r1/delegation/d1", values, `/repo/${NS_A}`), `/repo/${NS_A}`);
    assert.equal(switcherFor("/run/r1/summary", values), null);
    assert.equal(switcherFor("/run/r1/summary", values, "/repo/github.com/not/offered"), null);

    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const html = body(page(dir));
    const tag = (id) => html.split(`<section class="page" id="${id}"`)[1].split(">")[0];
    const run = "/run/2026-11-02-tickets-2";
    const delegation = html.match(new RegExp(`id="(${run}/delegation/[^"]+)"`))?.[1];
    assert.ok(delegation, "the fixture run has a Delegation page");
    for (const id of [`${run}/summary`, `${run}/log`, delegation])
      assert.match(tag(id), new RegExp(`data-repo="/repo/${NS_A}"`), id);
    assert.doesNotMatch(tag(`/repo/${NS_A}`), /data-repo=/);
    assert.ok(
      page(dir).includes("o.value), page.dataset.repo)"),
      "the routing script passes the owner",
    );
  });

  it("--repo picks the repository the page opens on", async () => {
    const { dir, transport } = await readyToRead();
    const result = await build(dir, transport, ["--repo", NS_B]);
    assert.equal(result.code, 0, result.out);
    assert.match(page(dir), new RegExp(`<body data-home="/repo/${NS_B}"`));
  });

  it("--repo with a repository no record is in, or not given a name, exits without writing", async () => {
    const { dir, transport } = await readyToRead();
    const missing = await build(dir, transport, ["--repo", "github.com/nobody/nothing"]);
    assert.equal(missing.code, 1);
    assert.match(missing.out, /no Run Records for `github\.com\/nobody\/nothing`/);
    assert.match(missing.out, new RegExp(NS_A));
    assert.equal((await build(dir, transport, ["--repo"])).code, 2);
    assert.equal((await build(dir, transport, ["--repo", NS_A, "--repo", NS_B])).code, 2);
    assert.ok(!existsSync(join(dir, "tmp", "orchestrate", "dashboard.html")));
  });

  it("the All repositories page has the merge rate, human steps per run, the avoidable trend, the top cause, the chart, recent runs and the tree", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const all = section(body(page(dir)), "/");
    assert.match(all, /<h1>All repositories<\/h1>/);
    // Three merged, one abandoned (lee's record in the first repository).
    assert.match(all, /data-kpi="merge-rate"[^>]*><b>\d+%<\/b>/);
    assert.match(all, /data-kpi="merge-rate"[^>]*><b>75%<\/b>/);
    assert.match(all, /data-kpi="steps-per-run"/);
    assert.match(all, /data-chart="avoidable-trend"/);
    assert.match(all, /data-kpi="top-cause"[\s\S]*?class="chip cause c-/);
    const chart = all.split('data-chart="repositories"')[1];
    for (const ns of [NS_A, NS_B]) assert.match(chart.split("</svg>")[0], new RegExp(ns));
    assert.match(all, /data-table="recent-runs"/);
    assert.match(all, /data-tree/);
  });

  it("shows the warnings on the Repository page too, where the page opens", async () => {
    const { dir, transport } = await readyToRead({ sink: { visibility: "public" } });
    await build(dir, transport);
    assert.match(section(body(page(dir)), `/repo/${NS_A}`), /<div class="warn">[^<]*not private/);
  });

  it("the Repository page has human steps per run stacked by cause, and its runs", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const repo = section(body(page(dir)), `/repo/${NS_A}`);
    assert.match(repo, new RegExp(`<h1>${NS_A}</h1>`));
    const chart = repo.split('data-chart="steps-by-cause"')[1].split("</svg>")[0];
    assert.match(chart, /class="seg c-/);
    const runs = repo.split('data-table="runs"')[1];
    assert.match(runs, /2026-11-01-tickets-1/);
    assert.match(runs, /2026-11-02-tickets-2/);
    assert.doesNotMatch(runs, /2026-11-03-spec-9/);
  });

  it("colours only mean cause: the repository chart uses no cause class", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const all = section(body(page(dir)), "/");
    const chart = all.split('data-chart="repositories"')[1].split("</svg>")[0];
    assert.doesNotMatch(chart, /c-(by-design|human-choice|harness-limit|other|skill-bug)/);
    assert.doesNotMatch(chart, /style="[^"]*(color|fill|stroke)/);
  });

  it("never shows prose from a sink record, with --local-logs too", async () => {
    const { dir, transport, bytes } = await readyToRead();
    addLocal(dir, RUN, bytes({ repo: NS_A, login: "naim", id: RUN }));
    writeFileSync(join(runFolder(dir), "activity.md"), `# Activity Log\n\n${PROSE}\n`);
    await build(dir, transport, ["--local-logs"]);
    const html = readFileSync(join(dir, "tmp", "orchestrate", "dashboard.local.html"), "utf8");
    assert.match(html, new RegExp(PROSE));
    const sinkLog = html.split('id="/run/2026-11-02-tickets-2/log"')[1].split("</section>")[0];
    assert.doesNotMatch(sinkLog, new RegExp(PROSE));
    assert.doesNotMatch(page(dir), new RegExp(PROSE));
  });
});

// --- dashboard: People, Person pages and Spec pages (#432).

const NS_G = "gitlab.example.com/acme/widgets";
const HOST_A = "github.com";
const HOST_G = "gitlab.example.com";
const daysBefore = (days, seconds = 0) =>
  new Date(Date.parse("2026-11-25T10:00:00Z") - days * DAY - seconds * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, "Z");

/** The stencil, made over as one run of one person: kind, spec, takeover, length, when it closed, its Delegations and steps. */
function personRun(stencil, o) {
  const record = JSON.parse(stencil);
  const { run } = record;
  run.id = o.id;
  run.repo = o.repo;
  run.operator = o.login;
  run.kind = o.kind ?? "tickets";
  if (o.spec === undefined) delete run.spec;
  else run.spec = o.spec;
  run.team = o.team ?? false;
  run.took_over = o.tookOver ?? [];
  run.outcome = o.outcome ?? "merged";
  run.closed_at = daysBefore(o.closedAgo);
  run.started_at = daysBefore(o.closedAgo, o.seconds);
  run.duration_seconds = o.seconds;
  if (o.harness) run.harness = o.harness;
  if (o.authority) run.decision_authority = o.authority;
  if (o.tickets) run.tickets = o.tickets;
  if (o.delegations) record.delegations = record.delegations.slice(0, o.delegations);
  for (const [id, change] of Object.entries(o.change ?? {}))
    Object.assign(
      record.delegations.find((d) => d.id === id),
      change,
    );
  if (o.steps) record.human_steps.push(...o.steps);
  if (o.qa) record.qa = [{ delegation: "d348", target: "stack", route: "brief", result: "pass" }];
  return `${JSON.stringify(record, null, 2)}\n`;
}

/** A sink of three logins on two hosts: naim on both, lee on the first, sam on the second, and one team spec with a takeover and a wait on a teammate. */
async function readyToTeam({ sink = {} } = {}) {
  const dir = await readyToUpload({ config: SINK_CONFIG });
  const stencil = readFileSync(recordPath(dir), "utf8");
  const run = (o) => personRun(stencil, o);
  const parked = {
    at: "2026-11-19T04:00:00Z",
    opened_at: "2026-11-19T02:30:00Z",
    delegation: "d353",
    kind: "teammate-blocker",
    cause: "teammate-blocker",
    avoidable: false,
    actor: "chief-of-staff",
    wait_id: "w20",
    waited_seconds: 5400,
    how: "github",
    blocker: 355,
    blocker_login: "lee",
    covers: [],
  };
  const files = new Map(
    [
      [NS_A, "naim", { id: "2026-11-20-tickets-1", closedAgo: 5, seconds: 600, qa: true }],
      [
        NS_A,
        "naim",
        { id: "2026-10-01-spec-8", kind: "spec", spec: 8, closedAgo: 55, seconds: 7200 },
      ],
      [NS_A, "naim", { id: "2026-07-01-tickets-0", closedAgo: 140, seconds: 1200 }],
      [
        NS_A,
        "lee",
        {
          id: "2026-11-02-team-77a",
          kind: "team",
          spec: 77,
          team: true,
          closedAgo: 20,
          seconds: 3000,
          outcome: "abandoned",
          harness: "codex",
          authority: "relay",
          delegations: 3,
          tickets: [348, 349, 355],
          change: { d350: { issue: 355, model: "gpt-5" } },
        },
      ],
      [
        NS_A,
        "naim",
        {
          id: "2026-11-05-team-77b",
          kind: "team",
          spec: 77,
          team: true,
          tookOver: ["2026-11-02-team-77a"],
          closedAgo: 15,
          seconds: 9000,
          steps: [parked],
          change: { d351: { model: "opus" } },
        },
      ],
      [NS_G, "naim", { id: "2026-11-03-tickets-1", closedAgo: 22, seconds: 900 }],
      [NS_G, "sam", { id: "2026-11-04-tickets-2", closedAgo: 21, seconds: 1800 }],
    ].map(([repo, login, o]) => [sinkFile(repo, login, o.id), run({ ...o, repo, login })]),
  );
  files.set("records/stray.txt", "x");
  const transport = fakeTransport({
    remotes: ORIGIN,
    repos: { "acme/run-records": { files, ...sink } },
  });
  rmSync(recordPath(dir));
  return { dir, files, transport, stencil };
}

/** The part of a page section for one date range. */
const inRange = (html, range) => {
  const from = html.split(`data-range="${range}"`)[1];
  return from.split(/data-range="/)[0];
};
const rowOf = (html, key) => html.split(`data-person="${key}"`)[1].split("</tr>")[0];
const cell = (row, col) => row.split(`data-col="${col}"`)[1].split("</td>")[0];
const plain = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
const text = (row, col) => plain(cell(row, col).replace(/^>/, "")).trim();
const peopleOf = async () => {
  const made = await readyToTeam();
  const result = await build(made.dir, made.transport);
  assert.equal(result.code, 0, result.out);
  return { ...made, html: body(page(made.dir)) };
};

describe("dashboard: the People table", () => {
  it("has a row per login on the Repository page, sorted by login, with every column", async () => {
    const { html } = await peopleOf();
    const repo = section(html, `/repo/${NS_A}`);
    const table = inRange(repo, "90").split('data-table="people"')[1];
    const head = [...table.split("</thead>")[0].matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]);
    assert.deepEqual(head, [
      "Login",
      "Runs by kind",
      "Outcomes",
      "Median run length",
      "Longest run",
      "Waiting on the human",
      "Human steps per Delegation",
      "Avoidable",
      "Top avoidable cause",
      "Trend",
      "Decision authority",
      "QA",
      "Harness",
      "Model",
      "Last record",
    ]);
    const logins = [...table.matchAll(/<tr data-person="[^"]*" data-login="([^"]*)"/g)].map(
      (m) => m[1],
    );
    assert.deepEqual(logins, ["lee", "naim"]);
  });

  it("counts runs and run lengths per kind and never mixes kinds", async () => {
    const { html } = await peopleOf();
    const row = rowOf(inRange(section(html, `/repo/${NS_A}`), "90"), `${NS_A}/naim`);
    const runs = cell(row, "runs");
    for (const kind of ["tickets", "spec", "team"])
      assert.match(runs, new RegExp(`data-kind="${kind}"[^>]*>[^<]*<b>1</b>`));
    assert.match(cell(row, "median"), /data-kind="tickets"[^>]*>[^<]*10m 0s/);
    assert.match(cell(row, "median"), /data-kind="spec"[^>]*>[^<]*2h 0m/);
    assert.match(cell(row, "median"), /data-kind="team"[^>]*>[^<]*2h 30m/);
    assert.match(cell(row, "longest"), /data-kind="team"[^>]*>[^<]*2h 30m/);
    // No figure folds the kinds into one: the three medians are three elements.
    assert.equal(cell(row, "median").match(/data-kind=/g).length, 3);
  });

  it("takes the median of an even number of runs and the longest from the same kind", async () => {
    const { html } = await peopleOf();
    const row = rowOf(inRange(section(html, `/repo/${NS_A}`), "all"), `${NS_A}/naim`);
    assert.match(cell(row, "median"), /data-kind="tickets"[^>]*>[^<]*15m 0s/);
    assert.match(cell(row, "longest"), /data-kind="tickets"[^>]*>[^<]*20m 0s/);
    assert.match(cell(row, "runs"), /data-kind="tickets"[^>]*>[^<]*<b>2<\/b>/);
  });

  it("shows outcome mix, waiting, steps per Delegation, avoidable share, top cause, trend, authority, QA, harness, model and the last record", async () => {
    const { html } = await peopleOf();
    const repo = inRange(section(html, `/repo/${NS_A}`), "90");
    const lee = rowOf(repo, `${NS_A}/lee`);
    assert.match(text(lee, "outcomes"), /abandoned 1/);
    // The stencil: 13 human steps and 6791 s waiting over 7 Delegations; lee's run has 3 Delegations.
    assert.equal(text(lee, "waiting"), "1h 53m");
    assert.equal(text(lee, "steps-per-delegation"), "4.3");
    // 9 of 13 steps were avoidable: 69%, and the most common avoidable cause is the harness limit.
    assert.equal(text(lee, "avoidable"), "69%");
    assert.match(cell(lee, "top-cause"), /class="chip cause c-harness-limit"/);
    assert.match(cell(lee, "trend"), /<svg[^>]*data-trend/);
    assert.match(text(lee, "authority"), /relay 1/);
    assert.equal(text(lee, "qa"), "0%");
    assert.match(text(lee, "harness"), /codex 1/);
    assert.match(cell(lee, "model"), /gpt-5/);
    assert.equal(text(lee, "last"), "2026-11-05");
    const naim = rowOf(repo, `${NS_A}/naim`);
    // One of naim's three runs in range logged a QA result.
    assert.equal(text(naim, "qa"), "33%");
    assert.match(text(naim, "authority"), /autonomous 3/);
    assert.equal(text(naim, "last"), "2026-11-20");
    assert.equal(text(naim, "steps-per-delegation"), "1.9");
  });

  it("has a date-range filter of 30, 90 days and all, defaulting to 90", async () => {
    const { html } = await peopleOf();
    const repo = section(html, `/repo/${NS_A}`);
    const select = repo.split("data-range-select")[1].split("</select>")[0];
    assert.deepEqual(
      [...select.matchAll(/<option value="([^"]*)"( selected)?/g)].map((m) => [m[1], !!m[2]]),
      [
        ["30", false],
        ["90", true],
        ["all", false],
      ],
    );
    const hidden = [...repo.matchAll(/data-range="(30|90|all)"( hidden)?/g)].map((m) => [
      m[1],
      !!m[2],
    ]);
    assert.deepEqual(hidden.slice(0, 3), [
      ["30", true],
      ["90", false],
      ["all", true],
    ]);
    const runsIn = (range) =>
      Number(
        inRange(repo, range)
          .split(`data-person="${NS_A}/naim"`)[1]
          .split("</tr>")[0]
          .match(/data-col="runs"[\s\S]*?<\/td>/)[0]
          .match(/<b>(\d+)<\/b>/g)
          .reduce((n, b) => n + Number(b.replace(/\D/g, "")), 0),
      );
    // naim's runs closed 5, 15, 55 and 140 days before the build.
    assert.deepEqual([runsIn("30"), runsIn("90"), runsIn("all")], [2, 3, 4]);
  });

  it("has no ranking, score, best or worst, no total row, and no config key to hide people", async () => {
    const { html } = await peopleOf();
    for (const text of [
      section(html, "/"),
      section(html, `/repo/${NS_A}`),
      section(html, `/repo/${NS_A}/person/naim`),
    ])
      assert.doesNotMatch(
        plain(text),
        /\b(rank(ing|ed)?|score|best|worst|leaderboard|top performer)\b/i,
      );
    const table = inRange(section(html, `/repo/${NS_A}`), "90").split('data-table="people"')[1];
    assert.doesNotMatch(table, /<tfoot|data-total/);
    assert.match(section(html, `/repo/${NS_A}`), /sorted by login/i);
  });

  it("groups All repositories by host and login with a count of repositories, never merging hosts", async () => {
    const { html } = await peopleOf();
    const all = inRange(section(html, "/"), "90");
    const people = all.split('data-table="people"')[1];
    const keys = [...people.matchAll(/<tr data-person="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(keys, [`${HOST_A}/lee`, `${HOST_A}/naim`, `${HOST_G}/naim`, `${HOST_G}/sam`]);
    assert.equal(text(rowOf(all, `${HOST_A}/naim`), "repositories"), "1");
    // The two naims are separate rows with separate runs: three here, one on the other host.
    assert.match(cell(rowOf(all, `${HOST_A}/naim`), "runs"), /data-kind="team"/);
    const gitlabNaim = cell(rowOf(all, `${HOST_G}/naim`), "runs");
    assert.match(gitlabNaim, /data-kind="tickets"[^>]*>[^<]*<b>1<\/b>/);
    assert.doesNotMatch(gitlabNaim, /data-kind="(spec|team)"/);
    // Each row links to the person's runs in each namespace.
    assert.match(rowOf(all, `${HOST_G}/naim`), new RegExp(`href="#/repo/${NS_G}/person/naim"`));
    assert.doesNotMatch(
      rowOf(all, `${HOST_G}/naim`),
      new RegExp(`href="#/repo/${NS_A}/person/naim"`),
    );
  });
});

describe("dashboard: Person pages", () => {
  it("has one page per (namespace, login), with the two hosts kept apart and no alias", async () => {
    const { html } = await peopleOf();
    const ids = [
      ...html.matchAll(/<section class="page" id="(\/repo\/[^"]*\/person\/[^"]*)"/g),
    ].map((m) => m[1]);
    assert.deepEqual(ids.sort(), [
      `/repo/${NS_A}/person/lee`,
      `/repo/${NS_A}/person/naim`,
      `/repo/${NS_G}/person/naim`,
      `/repo/${NS_G}/person/sam`,
    ]);
    const github = section(html, `/repo/${NS_A}/person/naim`);
    const gitlab = section(html, `/repo/${NS_G}/person/naim`);
    assert.match(github, /2026-11-20-tickets-1/);
    assert.doesNotMatch(github, /2026-11-03-tickets-1/);
    assert.match(gitlab, /2026-11-03-tickets-1/);
    assert.doesNotMatch(gitlab, /2026-11-20-tickets-1/);
    assert.doesNotMatch(plain(section(html, `/repo/${NS_A}`)), /alias/i);
  });

  it("shows runs over time, run lengths, human steps by cause, the avoidable trend and links to Spec pages", async () => {
    const { html } = await peopleOf();
    const person = inRange(section(html, `/repo/${NS_A}/person/naim`), "90");
    assert.match(person, /data-chart="runs-over-time"/);
    assert.match(person, /data-table="run-lengths"/);
    assert.match(person, /data-chart="steps-by-cause"[\s\S]*?class="bar c-harness-limit"/);
    assert.match(person, /data-chart="avoidable-trend"/);
    assert.match(person, new RegExp(`href="#/repo/${NS_A}/spec/77"`));
    // Run lengths stay in their own kind.
    const lengths = person.split('data-table="run-lengths"')[1];
    assert.match(lengths, /data-kind="team"/);
    assert.match(lengths, /data-kind="tickets"/);
    // The 55-day run is outside 30 days, and inside 90.
    assert.doesNotMatch(
      inRange(section(html, `/repo/${NS_A}/person/naim`), "30"),
      /2026-10-01-spec-8/,
    );
    assert.match(person, /2026-10-01-spec-8/);
    assert.match(
      inRange(section(html, `/repo/${NS_A}/person/naim`), "all"),
      /2026-07-01-tickets-0/,
    );
  });

  it("links the person from the People row and the page back to its repository", async () => {
    const { html } = await peopleOf();
    const row = rowOf(inRange(section(html, `/repo/${NS_A}`), "90"), `${NS_A}/lee`);
    assert.match(row, new RegExp(`href="#/repo/${NS_A}/person/lee"`));
    assert.match(section(html, `/repo/${NS_A}/person/lee`), new RegExp(`href="#/repo/${NS_A}"`));
  });
});

describe("dashboard: Spec pages", () => {
  const SPEC = `/repo/${NS_A}/spec/77`;

  it("keys a takeover on the run, not its id: a teammate's run with the same id is not superseded (C5)", async () => {
    const made = await readyToTeam();
    const run = (o) => personRun(made.stencil, o);
    const team = { kind: "team", spec: 77, team: true, seconds: 600 };
    const add = (login, o) =>
      made.files.set(sinkFile(NS_A, login, o.id), run({ ...team, ...o, repo: NS_A, login }));
    add("naim", { id: "2026-11-17-team-77c", closedAgo: 8 });
    add("lee", { id: "2026-11-17-team-77c", closedAgo: 8 });
    add("naim", { id: "2026-11-18-team-77d", closedAgo: 7, tookOver: ["2026-11-17-team-77c"] });
    assert.equal((await build(made.dir, made.transport)).code, 0);
    const spec = section(body(page(made.dir)), SPEC);
    const lane = (login, id) =>
      plain(spec.split(`data-lane-login="${login}" data-lane-run="${id}"`)[1].split("</tr>")[0]);
    assert.match(lane("naim", "2026-11-17-team-77c"), /superseded by 2026-11-18-team-77d/);
    assert.doesNotMatch(lane("lee", "2026-11-17-team-77c"), /superseded/);
    assert.match(
      lane("naim", "2026-11-18-team-77d"),
      /took over 2026-11-17-team-77c(?! \(not shown\))/,
    );
    // The cross-login takeover of the fixture still reads as before.
    assert.match(lane("lee", "2026-11-02-team-77a"), /superseded by 2026-11-05-team-77b/);
  });

  it("prints no `#undefined`, `undefined` or `null` for a parked step with no blocker recorded (C6)", async () => {
    const made = await readyToTeam();
    const bare = {
      at: "2026-11-19T04:00:00Z",
      opened_at: "2026-11-19T03:00:00Z",
      delegation: "d352",
      kind: "teammate-blocker",
      cause: "teammate-blocker",
      avoidable: false,
      actor: "chief-of-staff",
      wait_id: "w21",
      waited_seconds: 3600,
      how: "github",
      covers: [],
    };
    made.files.set(
      sinkFile(NS_A, "sam", "2026-11-19-team-77e"),
      personRun(made.stencil, {
        id: "2026-11-19-team-77e",
        kind: "team",
        spec: 77,
        team: true,
        closedAgo: 6,
        seconds: 600,
        steps: [bare],
        repo: NS_A,
        login: "sam",
      }),
    );
    const result = await build(made.dir, made.transport);
    assert.equal(result.code, 0, result.out);
    const spec = section(body(page(made.dir)), SPEC);
    const parked = spec.split('data-table="parked"')[1].split("</table>")[0];
    assert.doesNotMatch(parked, /undefined|null/);
    assert.match(plain(parked), /a teammate's ticket/);
    assert.doesNotMatch(spec, /#undefined|parked on #undefined/);
  });

  it("has a page per team spec only, linked from the Repository page", async () => {
    const { html } = await peopleOf();
    const ids = [...html.matchAll(/<section class="page" id="(\/repo\/[^"]*\/spec\/[^"]*)"/g)].map(
      (m) => m[1],
    );
    assert.deepEqual(ids, [SPEC]);
    assert.match(section(html, `/repo/${NS_A}`), new RegExp(`href="#${SPEC}"`));
    assert.match(section(html, SPEC), /<h1>Spec #77<\/h1>/);
  });

  it("has a lane per run under each login, with harness and model per lane, on one clock", async () => {
    const { html } = await peopleOf();
    const spec = section(html, SPEC);
    const lanes = [...spec.matchAll(/data-lane-login="([^"]*)" data-lane-run="([^"]*)"/g)].map(
      (m) => [m[1], m[2]],
    );
    assert.deepEqual(lanes, [
      ["lee", "2026-11-02-team-77a"],
      ["naim", "2026-11-05-team-77b"],
    ]);
    const lee = spec.split('data-lane-login="lee"')[1].split("</tr>")[0];
    assert.match(lee, /codex/);
    assert.match(lee, /gpt-5/);
    const naim = spec.split('data-lane-login="naim"')[1].split("</tr>")[0];
    assert.match(naim, /claude-code-desktop/);
    assert.match(naim, /opus/);
    assert.match(spec, /<svg[^>]*data-chart="spec-lanes"/);
  });

  it("shows the tickets each teammate built", async () => {
    const { html } = await peopleOf();
    const spec = section(html, SPEC);
    const built = spec.split('data-table="tickets-built"')[1].split("</table>")[0];
    assert.match(built, /<td>lee<\/td>[^]*?#355/);
    assert.match(built, /<td>naim<\/td>[^]*?#348[^]*?#353/);
  });

  it("shows the time parked on a teammate's ticket: how long, on whose ticket, and that it was unparked", async () => {
    const { html } = await peopleOf();
    const parked = section(html, SPEC).split('data-table="parked"')[1].split("</table>")[0];
    const text = plain(parked);
    assert.match(text, /#353/);
    assert.match(text, /#355/);
    assert.match(text, /lee/);
    assert.match(text, /1h 30m/);
    assert.match(text, /unparked 2026-11-19T04:00:00Z/);
    assert.match(parked, /c-teammate-blocker/);
  });

  it("marks a takeover: the run taken over is superseded by the run that took over", async () => {
    const { html } = await peopleOf();
    const spec = section(html, SPEC);
    assert.match(
      plain(spec.split('data-lane-run="2026-11-02-team-77a"')[1].split("</tr>")[0]),
      /superseded by 2026-11-05-team-77b/,
    );
    assert.match(
      plain(spec.split('data-lane-run="2026-11-05-team-77b"')[1].split("</tr>")[0]),
      /took over 2026-11-02-team-77a/,
    );
  });

  it("totals the spec: first start to last close, human steps and tickets merged of those listed", async () => {
    const { html } = await peopleOf();
    const totals = plain(section(html, SPEC).split("data-totals")[1].split("</dl>")[0]);
    assert.match(totals, /120h 50m/);
    assert.match(totals, /26/);
    assert.match(totals, /6 of 7 listed tickets landed in merged runs/);
    assert.match(totals, /Landed in partly-merged runs 0 more/);
  });

  it("counts tickets landed in a partly-merged run apart, never as merged (F6)", async () => {
    const made = await readyToTeam();
    const key = [...made.files.keys()].find((k) => k.endsWith("/2026-11-05-team-77b.json"));
    const text = made.files.get(key);
    assert.match(text, /"outcome": "merged"/);
    made.files.set(key, text.replace('"outcome": "merged"', '"outcome": "partly-merged"'));
    const result = await build(made.dir, made.transport);
    assert.equal(result.code, 0, result.out);
    const totals = plain(
      section(body(page(made.dir)), SPEC)
        .split("data-totals")[1]
        .split("</dl>")[0],
    );
    assert.doesNotMatch(totals, /6 of 7/);
    assert.match(totals, /listed tickets landed in merged runs/);
    assert.match(totals, /Landed in partly-merged runs [1-9]\d* more/);
  });

  it("names the sink it read above the People table, on Repository and All repositories pages (F4)", async () => {
    const { html } = await peopleOf();
    const sentence =
      "Only runs uploaded to acme/run-records are here. Teammates who haven't uploaded, upload elsewhere, or have runs still open aren't shown.";
    for (const route of [`/repo/${NS_A}`, "/"]) {
      const panel = section(html, route).split('data-panel="people"')[1];
      const [above] = panel.split('data-table="people"');
      assert.ok(plain(above).includes(sentence), route);
    }
  });

  it("names the sink it read, says who is not shown, and points at --status --spec", async () => {
    const { html } = await peopleOf();
    const spec = plain(section(html, SPEC));
    assert.ok(
      spec.includes(
        "Only runs uploaded to acme/run-records are here. Teammates who haven't uploaded, upload elsewhere, or have runs still open aren't shown.",
      ),
    );
    assert.match(section(html, SPEC), /<code>acme\/run-records<\/code>/);
    assert.match(section(html, SPEC), /<code>\/orchestrate --status --spec 77<\/code>/);
    assert.match(spec, /logins found:? lee, naim/i);
    assert.match(spec, /never reads the tracker/i);
  });

  it("never calls the tracker: only the sink is read", async () => {
    const { transport } = await peopleOf();
    assert.ok(
      transport.calls.every((c) => !c.args.includes("issue") && !c.args.includes("pr")),
      JSON.stringify(transport.calls.map((c) => c.args.slice(0, 2))),
    );
  });
});

// --- The s3 sink: SigV4 first, then the adapter against a fake S3.

const VECTORS = JSON.parse(
  readFileSync(join(here, "fixtures", "sigv4", "aws-vectors.json"), "utf8"),
).vectors;
/** `Credential=..., SignedHeaders=..., Signature=...`, with or without a space after each comma. */
const tidy = (text) => text.replace(/,\s+/g, ",");

describe("SigV4: the signer matches AWS's published vectors", () => {
  for (const v of VECTORS) {
    it(`${v.name}`, () => {
      const signed = signRequest({
        method: v.method,
        url: v.url,
        headers: v.headers,
        body: v.body,
        region: v.region,
        service: v.service,
        s3: v.s3,
        accessKeyId: v.accessKeyId,
        secretAccessKey: v.secretAccessKey,
        now: new Date(
          v.date.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, "$1-$2-$3T$4:$5:$6Z"),
        ),
      });
      assert.equal(tidy(signed.authorization), tidy(v.authorization));
      if (v.canonicalRequest) assert.equal(signed.canonicalRequest, v.canonicalRequest.trimEnd());
      if (v.stringToSign) assert.equal(signed.stringToSign, v.stringToSign.trimEnd());
    });
  }

  it("never sends the secret, and sends no host header (fetch sets it)", () => {
    const signed = signRequest({
      method: "GET",
      url: "https://example.com/bucket/key",
      region: "auto",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "SECRETSECRETSECRETSECRET",
      now: new Date("2026-11-25T10:00:00Z"),
    });
    assert.ok(!JSON.stringify(signed).includes("SECRETSECRET"));
    assert.ok(!("host" in signed.headers) && !("Host" in signed.headers));
    assert.equal(signed.headers["x-amz-date"], "20261125T100000Z");
  });
});

// --- The s3 adapter, through `main(argv, io)` against a fake S3.

const S3_CONFIG = [
  "records:",
  "  sink:",
  "    type: s3",
  "    endpoint: https://s3.example.test",
  "    bucket: acme-run-records",
  "    region: us-east-1",
  "",
].join("\n");
const S3_KEY = "AKIDEXAMPLE";
const S3_SECRET_VALUE = "EXAMPLEsecretVALUEforTESTSonly0123456789ab";
const S3_ENV = {
  ORCHESTRATE_S3_ACCESS_KEY_ID: S3_KEY,
  ORCHESTRATE_S3_SECRET_ACCESS_KEY: S3_SECRET_VALUE,
};
const xml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A fake S3-compatible store, path-style, that checks every signature by
 * signing the same request again with the key it knows. `buckets` maps a name
 * to `{objects, pageSize, refuse, only, publicList, conflicts, ignoreIfNoneMatch,
 * racer, lifecycle}`. Every request is recorded, and nothing touches the network.
 */
function fakeS3({ buckets = {}, region = "us-east-1" } = {}) {
  const calls = [];
  const state = {
    calls,
    buckets: Object.fromEntries(
      Object.entries({ "acme-run-records": {}, ...buckets }).map(([name, bucket]) => [
        name,
        { objects: new Map(), pageSize: 1000, ...bucket },
      ]),
    ),
    puts: () => calls.filter((c) => c.method === "PUT"),
    gets: () => calls.filter((c) => c.method === "GET" && c.key !== ""),
    lists: () =>
      calls.filter(
        (c) =>
          c.method === "GET" && c.key === "" && c.query.has("list-type") && c.headers.authorization,
      ),
  };
  // A real `Response`, as the real `fetch` gives: its body is read with `text()`, once.
  const reply = (status, text = "", code = null) =>
    new Response(
      code ? `<?xml version="1.0"?><Error><Code>${code}</Code><Message>no</Message></Error>` : text,
      { status },
    );
  state.fetch = async (url, { method = "GET", headers = {}, body } = {}) => {
    const target = new URL(url);
    const [, name, ...keyParts] = target.pathname.split("/");
    const key = keyParts.map(decodeURIComponent).join("/");
    const call = { url, method, headers, body, key, query: target.searchParams, bucket: name };
    calls.push(call);
    const bucket = state.buckets[name];
    if (!bucket) return reply(404, "", "NoSuchBucket");
    // The signature: recompute it from what was sent, with the key this store knows.
    const sent = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const signed = Boolean(sent.authorization);
    if (signed) {
      const stamp = sent["x-amz-date"].replace(
        /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/,
        "$1-$2-$3T$4:$5:$6Z",
      );
      const { authorization, ...rest } = sent;
      const again = signRequest({
        method,
        url,
        headers: Object.fromEntries(
          Object.entries(rest).filter(([k]) => !["x-amz-date", "x-amz-content-sha256"].includes(k)),
        ),
        body: body ?? "",
        region,
        accessKeyId: S3_KEY,
        secretAccessKey: S3_SECRET_VALUE,
        now: new Date(stamp),
      });
      if (again.authorization !== authorization) return reply(403, "", "SignatureDoesNotMatch");
    }
    if (method === "HEAD" && key === "") return signed && !bucket.noHead ? reply(200) : reply(403);
    if (key === "" && target.searchParams.has("lifecycle"))
      return !signed
        ? reply(403, "", "AccessDenied")
        : bucket.lifecycle
          ? reply(200, bucket.lifecycle)
          : reply(404, "", "NoSuchLifecycleConfiguration");
    if (key === "" && target.searchParams.has("list-type")) {
      if (!signed)
        return bucket.publicList
          ? reply(200, "<ListBucketResult/>")
          : reply(403, "", "AccessDenied");
      const prefix = target.searchParams.get("prefix") ?? "";
      if (bucket.refuse && prefix === "records/") return reply(403, "", "AccessDenied");
      if (bucket.only && !prefix.startsWith(bucket.only)) return reply(403, "", "AccessDenied");
      const keys = [...bucket.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const token = target.searchParams.get("continuation-token");
      const start = token ? Number(atob(token.replace(/\/\+$/, "")).slice(1)) : 0;
      const page = keys.slice(start, start + bucket.pageSize);
      const more = start + bucket.pageSize < keys.length;
      return reply(
        200,
        `<?xml version="1.0"?><ListBucketResult><Prefix>${xml(prefix)}</Prefix>` +
          `<IsTruncated>${more}</IsTruncated>` +
          (more
            ? `<NextContinuationToken>${xml(btoa(`n${start + bucket.pageSize}`) + "/+")}</NextContinuationToken>`
            : "") +
          page
            .map(
              (k) =>
                `<Contents><Key>${xml(encodeURIComponent(k).replace(/%2F/g, "/"))}</Key></Contents>`,
            )
            .join("") +
          "</ListBucketResult>",
      );
    }
    if (!signed) return reply(403, "", "AccessDenied");
    if (bucket.only && !key.startsWith(bucket.only)) return reply(403, "", "AccessDenied");
    if (method === "GET")
      return bucket.objects.has(key)
        ? reply(200, bucket.objects.get(key))
        : reply(404, "", "NoSuchKey");
    if (method === "PUT") {
      if (bucket.conflicts > 0) {
        bucket.conflicts -= 1;
        return reply(409, "", "OperationAborted");
      }
      if (bucket.racer !== undefined) {
        bucket.objects.set(key, bucket.racer);
        delete bucket.racer;
        return reply(412, "", "PreconditionFailed");
      }
      if (sent["if-none-match"] === "*" && !bucket.ignoreIfNoneMatch && bucket.objects.has(key))
        return reply(412, "", "PreconditionFailed");
      bucket.objects.set(key, body);
      bucket.lastPut = { headers: sent };
      return reply(200);
    }
    return reply(405, "", "MethodNotAllowed");
  };
  return state;
}

/** A root with the s3 config and a derived record. `s3` is the fake store. */
const readyToUploadS3 = (options = {}) => readyToUpload({ config: S3_CONFIG, ...options });
const gitExec = fakeTransport({ remotes: ORIGIN }).exec;
const uploadS3 = (dir, s3, args = [RUN, "--yes"], env = S3_ENV) =>
  main(["upload", ...args], { cwd: dir, env, exec: gitExec, fetch: s3.fetch, now: BUILT_AT });
const BUCKET_OF = (s3) => s3.buckets["acme-run-records"].objects;

describe("upload: create-only writes to an s3 sink", () => {
  it("shows the disclosure for a private bucket, with no people count, and writes nothing without a yes", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3();
    const result = await uploadS3(dir, s3, [RUN]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /To `s3:\/\/acme-run-records` \(private S3 bucket\) at `records\//);
    assert.doesNotMatch(result.out, /people with access/);
    assert.match(result.out, /deletes it|bucket's own rule/);
    assert.equal(s3.puts().length, 0);
  });

  it("checks privacy first: a signed look at the bucket, then an unsigned listing that must be refused", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3();
    await uploadS3(dir, s3);
    const [head, stranger, ...rest] = s3.calls;
    assert.equal(head.method, "HEAD");
    assert.ok(head.headers.authorization);
    assert.equal(stranger.method, "GET");
    assert.equal(stranger.headers.authorization, undefined);
    assert.ok(rest.length > 0 && s3.calls.indexOf(s3.puts()[0]) > 1);
  });

  it("reads the path first, then creates it with the record's exact bytes, signed, and create-only", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3();
    const result = await uploadS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.match(
      result.out,
      new RegExp(`uploaded \`${SINK_PATH.replaceAll(".", "\\.")}\` to \`s3://acme-run-records\``),
    );
    assert.equal(BUCKET_OF(s3).get(SINK_PATH), readFileSync(recordPath(dir), "utf8"));
    const [put] = s3.puts();
    assert.equal(put.headers["if-none-match"], "*");
    assert.match(
      put.headers.authorization,
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request/,
    );
    assert.equal(put.url, `https://s3.example.test/acme-run-records/${SINK_PATH}`);
    assert.ok(
      s3.calls.indexOf(s3.gets()[0]) < s3.calls.indexOf(put),
      "the path is read before it is created",
    );
  });

  it("counts identical bytes already there as uploaded, and repeating is safe", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3();
    assert.equal((await uploadS3(dir, s3)).code, 0);
    const again = await uploadS3(dir, s3);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /already uploaded/);
    assert.equal(s3.puts().length, 1);
  });

  it("stops when different bytes are already at the path, and overwrites nothing", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3({
      buckets: { "acme-run-records": { objects: new Map([[SINK_PATH, '{"someone":"else"}']]) } },
    });
    const result = await uploadS3(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /different bytes are already at `records\//);
    assert.equal(s3.puts().length, 0);
    assert.equal(BUCKET_OF(s3).get(SINK_PATH), '{"someone":"else"}');
  });

  it("stops on different bytes even from a store that ignores If-None-Match", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3({
      buckets: {
        "acme-run-records": { ignoreIfNoneMatch: true, objects: new Map([[SINK_PATH, "{}"]]) },
      },
    });
    assert.equal((await uploadS3(dir, s3)).code, 1);
    assert.equal(BUCKET_OF(s3).get(SINK_PATH), "{}");
  });

  it("reads again after a 412 from a parallel writer: identical bytes there count as uploaded", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3({
      buckets: { "acme-run-records": { racer: readFileSync(recordPath(dir), "utf8") } },
    });
    const result = await uploadS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /already uploaded/);
  });

  it("retries a 409, and gives up saying so", async () => {
    const dir = await readyToUploadS3();
    const some = fakeS3({ buckets: { "acme-run-records": { conflicts: 2 } } });
    assert.equal((await uploadS3(dir, some)).code, 0);
    assert.equal(some.puts().length, 3);
    const never = fakeS3({ buckets: { "acme-run-records": { conflicts: 99 } } });
    const failed = await uploadS3(dir, never);
    assert.equal(failed.code, 1);
    assert.match(failed.out, /409 conflict after 4 tries/);
  });

  it("refuses a bucket that lists to a stranger, with no override", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3({ buckets: { "acme-run-records": { publicList: true } } });
    const result = await uploadS3(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /`s3:\/\/acme-run-records` is not private \(public\).*no override/);
    assert.equal(s3.puts().length, 0);
  });

  it("uploads nothing when the bucket cannot be read: no such bucket, or a signature it refuses", async () => {
    const dir = await readyToUploadS3();
    const gone = await uploadS3(dir, fakeS3({ region: "eu-west-1" }));
    assert.equal(gone.code, 1);
    assert.match(
      gone.out,
      /cannot read whether `s3:\/\/acme-run-records` is private: nothing uploaded/,
    );
    const other = readFileSync(join(dir, "orchestrate.config.yml"), "utf8").replace(
      "acme-run-records",
      "other-bucket",
    );
    writeFileSync(join(dir, "orchestrate.config.yml"), other);
    const s3 = fakeS3();
    assert.equal((await uploadS3(dir, s3)).code, 1);
    assert.equal(s3.puts().length, 0);
  });
});

describe("s3 credentials come only from the injected environment", () => {
  for (const missing of ["ORCHESTRATE_S3_ACCESS_KEY_ID", "ORCHESTRATE_S3_SECRET_ACCESS_KEY"]) {
    it(`names ${missing} when it is not set, and makes no request`, async () => {
      const dir = await readyToUploadS3();
      const s3 = fakeS3();
      const { [missing]: _gone, ...env } = S3_ENV;
      const result = await uploadS3(dir, s3, [RUN, "--yes"], env);
      assert.equal(result.code, 1);
      assert.match(result.out, /ORCHESTRATE_S3_ACCESS_KEY_ID and ORCHESTRATE_S3_SECRET_ACCESS_KEY/);
      assert.equal(s3.calls.length, 0);
    });
  }

  it("does not fall back to the process environment, or to other AWS variables", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3();
    const saved = { ...process.env };
    Object.assign(process.env, S3_ENV);
    try {
      const result = await uploadS3(dir, s3, [RUN, "--yes"], {
        AWS_ACCESS_KEY_ID: S3_KEY,
        AWS_SECRET_ACCESS_KEY: S3_SECRET_VALUE,
      });
      assert.equal(result.code, 1);
      assert.equal(s3.calls.length, 0);
    } finally {
      for (const key of Object.keys(S3_ENV)) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  });

  it("never puts the secret in a request, the output or the page", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3();
    const result = await uploadS3(dir, s3);
    assert.ok(!JSON.stringify(s3.calls).includes(S3_SECRET_VALUE));
    assert.ok(!result.out.includes(S3_SECRET_VALUE));
  });
});

// The dashboard's read path: the same adapter, the same cache.

const S3_LAYOUT = (bytes) => [
  [
    sinkFile(NS_A, "naim", "2026-11-01-tickets-1"),
    bytes({ repo: NS_A, login: "naim", id: "2026-11-01-tickets-1" }),
  ],
  [
    sinkFile(NS_A, "lee", "2026-11-02-tickets-2"),
    bytes({ repo: NS_A, login: "lee", id: "2026-11-02-tickets-2", outcome: "abandoned" }),
  ],
  [
    sinkFile(NS_B, "naim", "2026-11-03-spec-9"),
    bytes({ repo: NS_B, login: "naim", id: "2026-11-03-spec-9" }),
  ],
  [
    sinkFile(NS_B, "lee", "2026-11-01-tickets-1"),
    bytes({ repo: NS_B, login: "lee", id: "2026-11-01-tickets-1" }),
  ],
  ["records/stray.txt", "x"],
  ["raw/github.com/acme/widgets/naim/2026-11-03-spec-9/events.jsonl", "private"],
];

async function readyToReadS3(bucket = {}) {
  const dir = await readyToUploadS3();
  const stencil = readFileSync(recordPath(dir), "utf8");
  const bytes = (spec) => recordBytes(stencil, spec);
  const objects = new Map(S3_LAYOUT(bytes));
  const s3 = fakeS3({ buckets: { "acme-run-records": { objects, ...bucket } } });
  rmSync(recordPath(dir));
  return { dir, s3, objects, bytes };
}
const buildS3 = (dir, s3, args = [], env = S3_ENV) =>
  main(["dashboard", ...args], { cwd: dir, now: BUILT_AT, env, exec: gitExec, fetch: s3.fetch });

describe("the dashboard reads an s3 sink", () => {
  it("lists `records/` with ListObjectsV2 over several pages, and builds the page from every namespace", async () => {
    const { dir, s3 } = await readyToReadS3({ pageSize: 2 });
    const result = await buildS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /built the dashboard from 4 Run Records/);
    assert.match(result.out, /skipped records\/stray\.txt/);
    const html = body(page(dir));
    for (const ns of [NS_A, NS_B]) assert.match(html, new RegExp(`id="/repo/${ns}"`));
    const lists = s3.lists();
    assert.ok(lists.length >= 3, `${lists.length} list calls for 5 keys at 2 a page`);
    for (const call of lists) {
      assert.equal(call.query.get("list-type"), "2");
      assert.equal(call.query.get("prefix"), "records/");
    }
    assert.ok(lists.slice(1).every((c) => c.query.get("continuation-token")));
  });

  it("never lists or reads raw/, and fetches only the paths the cache lacks", async () => {
    const { dir, s3, objects, bytes } = await readyToReadS3();
    await buildS3(dir, s3);
    assert.equal(s3.gets().length, 4);
    assert.ok(s3.calls.every((c) => !c.key.startsWith("raw/")));
    s3.calls.length = 0;
    const again = await buildS3(dir, s3);
    assert.equal(again.code, 0, again.out);
    assert.equal(s3.gets().length, 0);
    objects.set(
      sinkFile(NS_A, "naim", "2026-11-09-tickets-5"),
      bytes({ repo: NS_A, login: "naim", id: "2026-11-09-tickets-5" }),
    );
    s3.calls.length = 0;
    assert.match((await buildS3(dir, s3)).out, /5 Run Records/);
    assert.equal(s3.gets().length, 1);
  });

  it("checks privacy before it lists, and warns about a bucket that lists to a stranger, then reads anyway", async () => {
    const { dir, s3 } = await readyToReadS3({ publicList: true });
    const result = await buildS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /`s3:\/\/acme-run-records` is not private \(public\)/);
    assert.match(result.out, /4 Run Records/);
    assert.equal(s3.calls[0].method, "HEAD");
  });

  it("retries a refused list of `records/` with the current repository's prefix, and says what it could not see", async () => {
    const { dir, s3 } = await readyToReadS3({ refuse: true, only: `records/${NS_A}/` });
    const result = await buildS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /built the dashboard from 2 Run Records/);
    assert.match(
      result.out,
      new RegExp(
        `could not list all of \`records/\` in \`s3://acme-run-records\`.*records/${NS_A}/`,
      ),
    );
    const prefixes = s3.lists().map((c) => c.query.get("prefix"));
    assert.deepEqual(prefixes.slice(0, 2), ["records/", `records/${NS_A}/`]);
    const html = body(page(dir));
    assert.match(html, new RegExp(`id="/repo/${NS_A}"`));
    assert.doesNotMatch(html, new RegExp(`id="/repo/${NS_B}"`));
    assert.match(html, /could not list all of/);
  });

  it("still reads when the privacy check is refused, as for a reader limited to one prefix", async () => {
    const { dir, s3 } = await readyToReadS3({
      noHead: true,
      refuse: true,
      only: `records/${NS_A}/`,
    });
    const result = await buildS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /built the dashboard from 2 Run Records/);
    assert.match(result.out, /whether it is private could not be checked/);
    assert.match(result.out, /could not list all of `records\/`/);
  });

  it("is one warning when the fallback is refused too, and builds from local", async () => {
    const { dir, s3, bytes } = await readyToReadS3({ refuse: true, only: "nothing/" });
    addLocal(
      dir,
      "2026-11-12-tickets-3",
      bytes({ repo: NS_A, login: "naim", id: "2026-11-12-tickets-3" }),
    );
    const result = await buildS3(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.equal((result.out.match(/s3:\/\/acme-run-records/g) ?? []).length, 1, result.out);
    assert.match(result.out, /could not read `s3:\/\/acme-run-records`/);
    assert.match(result.out, /1 Run Record\b/);
    assert.match(body(page(dir)), /<div class="warn">[^<]*could not read/);
    assert.equal(s3.gets().length, 0);
  });

  it("is one warning when the bucket cannot be reached, or the credentials are missing", async () => {
    const { dir, s3, bytes } = await readyToReadS3();
    addLocal(
      dir,
      "2026-11-12-tickets-3",
      bytes({ repo: NS_A, login: "naim", id: "2026-11-12-tickets-3" }),
    );
    const unset = await buildS3(dir, s3, [], {});
    assert.equal(unset.code, 0, unset.out);
    assert.match(
      unset.out,
      /could not read `s3:\/\/acme-run-records`.*ORCHESTRATE_S3_ACCESS_KEY_ID/s,
    );
    assert.equal(s3.calls.length, 0);
    const down = await main(["dashboard"], {
      cwd: dir,
      now: BUILT_AT,
      env: S3_ENV,
      exec: gitExec,
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    assert.equal(down.code, 0, down.out);
    assert.equal((down.out.match(/could not read/g) ?? []).length, 1, down.out);
  });

  it("keeps a cache folder of its own per bucket, never mixed with a git sink's", async () => {
    const { dir, s3 } = await readyToReadS3();
    await buildS3(dir, s3);
    const cache = join(dir, "tmp", "orchestrate", "records-cache");
    assert.deepEqual(readdirSync(cache), ["s3"]);
    assert.ok(
      existsSync(
        join(
          cache,
          "s3",
          "s3.example.test",
          "acme-run-records",
          "records",
          NS_A,
          "naim",
          "2026-11-01-tickets-1.json",
        ),
      ),
    );
  });
});

describe("the s3 adapter", () => {
  const open = (s3, env = S3_ENV) =>
    openSink("s3", {
      endpoint: "https://s3.example.test",
      bucket: "acme-run-records",
      region: "us-east-1",
      env,
      fetch: s3.fetch,
    });

  it("reads the bucket's lifecycle as the store's XML, for raw-folder upload to use", async () => {
    const rules =
      "<LifecycleConfiguration><Rule><Prefix>raw/</Prefix></Rule></LifecycleConfiguration>";
    const found = await open(
      fakeS3({ buckets: { "acme-run-records": { lifecycle: rules } } }),
    ).lifecycle();
    assert.deepEqual(found, { status: "found", xml: rules });
    assert.deepEqual(await open(fakeS3()).lifecycle(), { status: "missing" });
    const sink = open(fakeS3());
    assert.equal(sink.name, "s3://acme-run-records");
    assert.equal(await sink.access(), null);
  });

  it("decodes listed keys, and reads and writes keys with awkward characters", async () => {
    const s3 = fakeS3();
    const sink = open(s3);
    const path = "records/gh/a b/ü+x/run #1.json";
    assert.equal((await sink.create(path, "{}")).status, "created");
    assert.deepEqual(await sink.list("records/"), [path]);
    assert.deepEqual(await sink.read(path), { status: "found", text: "{}" });
    assert.deepEqual(await sink.read("records/none.json"), { status: "missing" });
    assert.equal((await sink.create(path, "{}")).status, "exists");
  });
});

// --- Raw run folders: only to an `s3` bucket whose own rule expires `raw/`.

const RAW_CONFIG = [
  "records:",
  "  raw:",
  "    sink:",
  "      type: s3",
  "      endpoint: https://s3.example.test",
  "      bucket: acme-run-records",
  "      region: us-east-1",
  "",
].join("\n");
const rule = (inner, status = "Enabled") =>
  `<?xml version="1.0"?><LifecycleConfiguration><Rule><ID>r</ID><Status>${status}</Status>${inner}</Rule></LifecycleConfiguration>`;
const RAW_30 = rule(
  "<Filter><Prefix>raw/</Prefix></Filter><Expiration><Days>30</Days></Expiration>",
);
const RAW_FILES = (() => {
  const out = [];
  const walk = (dir, rel = "") => {
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      entry.isDirectory()
        ? walk(join(dir, entry.name), `${rel}${entry.name}/`)
        : out.push(`${rel}${entry.name}`);
  };
  walk(FIXTURE);
  return out.sort();
})();
const RAW_PREFIX = `raw/github.com/mnaimfaizy/agent-kit/naim/${RUN}/`;
const rawBucket = (lifecycle) => ({ buckets: { "acme-run-records": { lifecycle } } });
const readyToRaw = (options = {}) => readyToUpload({ config: RAW_CONFIG, ...options });
const uploadRaw = (dir, s3, args = [RUN, "--yes"], env = S3_ENV) =>
  main(["upload-raw", ...args], { cwd: dir, env, exec: gitExec, fetch: s3.fetch, now: BUILT_AT });

describe("rawExpiry: does a lifecycle rule expire everything under `raw/`", () => {
  const days = (xml) => rawExpiry(xml)?.days ?? null;
  it("takes an enabled rule on `raw/`, in the filter, the legacy prefix and the `And` forms", () => {
    assert.equal(days(RAW_30), 30);
    assert.equal(days(rule("<Prefix>raw/</Prefix><Expiration><Days>14</Days></Expiration>")), 14);
    assert.equal(
      days(
        rule(
          "<Filter><And><Prefix>raw/</Prefix></And></Filter><Expiration><Days>7</Days></Expiration>",
        ),
      ),
      7,
    );
  });
  it("takes a rule on a shorter prefix, or the whole bucket, since it covers `raw/` too", () => {
    assert.equal(
      days(rule("<Filter><Prefix></Prefix></Filter><Expiration><Days>90</Days></Expiration>")),
      90,
    );
    assert.equal(days(rule("<Filter/><Expiration><Days>90</Days></Expiration>")), 90);
    assert.equal(days(rule("<Prefix/><Expiration><Days>90</Days></Expiration>")), 90);
    assert.equal(
      days(rule("<Filter><Prefix>ra</Prefix></Filter><Expiration><Days>5</Days></Expiration>")),
      5,
    );
  });
  it("quotes the shortest of several covering rules", () => {
    const two = `<LifecycleConfiguration>${RAW_30.match(/<Rule>[\s\S]*<\/Rule>/)[0]}<Rule><Status>Enabled</Status><Filter><Prefix>raw/</Prefix></Filter><Expiration><Days>10</Days></Expiration></Rule></LifecycleConfiguration>`;
    assert.equal(days(two), 10);
  });
  it("refuses everything that does not expire all of `raw/` by age", () => {
    const no = [
      rule(
        "<Filter><Prefix>raw/</Prefix></Filter><Expiration><Days>30</Days></Expiration>",
        "Disabled",
      ),
      rule("<Filter><Prefix>records/</Prefix></Filter><Expiration><Days>30</Days></Expiration>"),
      rule(
        "<Filter><Prefix>raw/github.com/</Prefix></Filter><Expiration><Days>30</Days></Expiration>",
      ),
      rule("<Filter><Prefix>rawer/</Prefix></Filter><Expiration><Days>30</Days></Expiration>"),
      rule(
        "<Filter><Tag><Key>a</Key><Value>b</Value></Tag></Filter><Expiration><Days>30</Days></Expiration>",
      ),
      rule(
        "<Filter><And><Prefix>raw/</Prefix><Tag><Key>a</Key><Value>b</Value></Tag></And></Filter><Expiration><Days>30</Days></Expiration>",
      ),
      rule(
        "<Filter><ObjectSizeGreaterThan>5</ObjectSizeGreaterThan></Filter><Expiration><Days>30</Days></Expiration>",
      ),
      rule(
        "<Filter><Prefix>raw/</Prefix></Filter><Expiration><Date>2030-01-01T00:00:00Z</Date></Expiration>",
      ),
      rule(
        "<Filter><Prefix>raw/</Prefix></Filter><Transition><Days>30</Days><StorageClass>GLACIER</StorageClass></Transition>",
      ),
      rule(
        "<Filter><Prefix>raw/</Prefix></Filter><NoncurrentVersionExpiration><NoncurrentDays>30</NoncurrentDays></NoncurrentVersionExpiration>",
      ),
      rule("<Filter><Prefix>raw/</Prefix></Filter><Expiration><Days>0</Days></Expiration>"),
      "<LifecycleConfiguration/>",
      "not xml at all",
    ];
    for (const xml of no) assert.equal(rawExpiry(xml), null, xml);
  });
});

describe("upload-raw: the lifecycle gate", () => {
  it("uploads nothing when the bucket has no lifecycle at all", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3();
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /no lifecycle rule/);
    assert.match(result.out, /Nothing uploaded/);
    assert.equal(s3.puts().length, 0);
  });

  it("uploads nothing when no enabled rule expires `raw/`", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(
      rawBucket(
        rule("<Filter><Prefix>records/</Prefix></Filter><Expiration><Days>30</Days></Expiration>"),
      ),
    );
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /no enabled rule expires `raw\/`/);
    assert.equal(s3.puts().length, 0);
  });

  it("uploads nothing when the lifecycle cannot be read", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    const base = s3.fetch;
    s3.fetch = async (url, init) =>
      new URL(url).searchParams.has("lifecycle")
        ? new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 })
        : base(url, init);
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(
      result.out,
      /cannot read the lifecycle of `s3:\/\/acme-run-records`: HTTP 403 AccessDenied/,
    );
    assert.equal(s3.puts().length, 0);
  });

  it("never writes bucket configuration: its only requests are reads and object puts", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    assert.equal((await uploadRaw(dir, s3)).code, 0);
    for (const call of s3.calls) {
      if (call.method === "PUT") assert.ok(call.key.startsWith("raw/"), call.url);
      else assert.ok(["GET", "HEAD"].includes(call.method), call.method);
    }
  });
});

describe("upload-raw: the upload", () => {
  it("puts every file of the folder, one object each, under the lowercased namespace", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(
      [...BUCKET_OF(s3).keys()].sort(),
      RAW_FILES.map((file) => `${RAW_PREFIX}${file}`),
    );
    for (const file of RAW_FILES)
      assert.equal(
        BUCKET_OF(s3).get(`${RAW_PREFIX}${file}`),
        readFileSync(join(FIXTURE, file), "utf8"),
      );
    assert.match(result.out, new RegExp(`uploaded ${RAW_FILES.length} files`));
  });

  it("lowercases every namespace segment, and leaves the file path as it is", async () => {
    const dir = await readyToRaw({ operator: "Naim" });
    writeFileSync(join(runFolder(dir), "Notes.MD"), "x\n");
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3, [RUN, "--yes"], S3_ENV);
    assert.equal(result.code, 0, result.out);
    assert.ok(BUCKET_OF(s3).has(`${RAW_PREFIX}Notes.MD`), [...BUCKET_OF(s3).keys()].join("\n"));
    for (const key of BUCKET_OF(s3).keys())
      assert.ok(key.startsWith(RAW_PREFIX), `${key} is outside ${RAW_PREFIX}`);
  });

  it("uploads nothing without a yes, and says so", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3, [RUN]);
    assert.equal(result.code, 0, result.out);
    assert.equal(s3.puts().length, 0);
  });

  it("is create-only: a second run finds every object already there, and different bytes stop it", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    assert.equal((await uploadRaw(dir, s3)).code, 0);
    const again = await uploadRaw(dir, s3);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, new RegExp(`already uploaded ${RAW_FILES.length} files`));
    assert.equal(s3.puts().length, RAW_FILES.length);
    appendFileSync(join(runFolder(dir), RAW_FILES[0]), "more\n");
    const changed = await uploadRaw(dir, s3);
    assert.equal(changed.code, 1);
    assert.match(changed.out, /different bytes are already at/);
    assert.match(changed.out, /nothing was overwritten/);
  });

  it("refuses a bucket that lists to a stranger, as for the record", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3({ buckets: { "acme-run-records": { lifecycle: RAW_30, publicList: true } } });
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /is not private/);
    assert.equal(s3.puts().length, 0);
  });

  it("stops on a file that is not text, before it uploads any", async () => {
    const dir = await readyToRaw();
    writeFileSync(join(runFolder(dir), "shot.png"), Buffer.from([0x89, 0x50, 0xff, 0xfe, 0x00]));
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /`shot\.png` is not UTF-8 text/);
    assert.equal(s3.puts().length, 0);
  });

  it("does not follow a link out of the run folder", async () => {
    const dir = await readyToRaw();
    writeFileSync(join(dir, "secret.txt"), "private\n");
    symlinkSync(join(dir, "secret.txt"), join(runFolder(dir), "link.txt"));
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 0, result.out);
    assert.ok(![...BUCKET_OF(s3).keys()].some((key) => key.endsWith("link.txt")));
    assert.match(result.out, /skipped 1 link: `link\.txt`/);
  });

  it("is a no-op with no `records.raw`: raw folders are never offered", async () => {
    const dir = await readyToUploadS3();
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /no `records\.raw\.sink`/);
    assert.equal(s3.calls.length, 0);
  });

  it("needs the Run Record first, for the login and the repository", async () => {
    const dir = root();
    writeFileSync(join(dir, "orchestrate.config.yml"), RAW_CONFIG);
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /no Run Record for/);
    assert.equal(s3.calls.length, 0);
  });

  it("names the credentials when they are not in the environment, and makes no request", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3, [RUN, "--yes"], {});
    assert.equal(result.code, 1);
    assert.match(result.out, /ORCHESTRATE_S3_ACCESS_KEY_ID and ORCHESTRATE_S3_SECRET_ACCESS_KEY/);
    assert.equal(s3.calls.length, 0);
  });

  it("names a config problem and uploads nothing", async () => {
    const dir = await readyToRaw({ config: RAW_CONFIG.replace("type: s3", "type: github") });
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3);
    assert.equal(result.code, 1);
    assert.match(result.out, /records\.raw\.sink\.type/);
    assert.equal(s3.calls.length, 0);
  });
});

describe("upload-raw: the disclosure line", () => {
  it("is the approved wording, with the file count, the size, the bucket, the path and the rule's days", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3, [RUN]);
    assert.equal(
      result.out.split("\n")[0],
      `**Also upload the raw run folder?** ${RAW_FILES.length} files, 9.1 kB, to bucket \`acme-run-records\` at \`${RAW_PREFIX}\`. It **may quote private issue text, command output and file contents**. The bucket's own rule deletes it after about 30 days. [List the files] [Upload] [Not now]`,
    );
  });

  it("quotes the days of the rule it found, and the singular for one file", async () => {
    const dir = await readyToRaw();
    const only = join(runFolder(dir), "delegations");
    rmSync(only, { recursive: true });
    rmSync(join(runFolder(dir), "events.jsonl"));
    writeFileSync(join(runFolder(dir), "one.md"), "x");
    const s3 = fakeS3(
      rawBucket(
        rule("<Filter><Prefix>raw/</Prefix></Filter><Expiration><Days>14</Days></Expiration>"),
      ),
    );
    const result = await uploadRaw(dir, s3, [RUN]);
    assert.match(result.out, /^\*\*Also upload the raw run folder\?\*\* 1 file, 1 B, to bucket/);
    assert.match(result.out, /deletes it after about 14 days\./);
  });

  it("lists the files, one path per line, on `--list`, and uploads nothing", async () => {
    const dir = await readyToRaw();
    const s3 = fakeS3(rawBucket(RAW_30));
    const result = await uploadRaw(dir, s3, [RUN, "--list"]);
    assert.equal(result.code, 0, result.out);
    for (const file of RAW_FILES) assert.ok(result.out.split("\n").includes(file), file);
    assert.equal(s3.puts().length, 0);
  });

  it("shows no offer where the upload is refused", async () => {
    const dir = await readyToRaw();
    const result = await uploadRaw(dir, fakeS3(), [RUN]);
    assert.doesNotMatch(result.out, /\[Upload\]/);
  });
});

// --- board: the live run board, written beside board.md.

const TICKETS = ["d348", "d349", "d350", "d351", "d352", "d353"];
const boardAt = (dir) => join(runFolder(dir), "board.html");

/** The spec-344 run as it stood at `until`: every events file cut to the events at or before it. */
function replayed(until) {
  const dir = root();
  const cut = (file) => {
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
    writeFileSync(
      file,
      lines
        .filter((l) => JSON.parse(l).at <= until)
        .map((l) => `${l}\n`)
        .join(""),
    );
  };
  cut(join(runFolder(dir), "events.jsonl"));
  for (const d of readdirSync(join(runFolder(dir), "delegations")))
    cut(join(runFolder(dir), "delegations", d, "events.jsonl"));
  return dir;
}
const board = async (dir, args = [], io = {}) => {
  const result = await main(["board", `tmp/orchestrate/${RUN}`, ...args], {
    cwd: dir,
    now: at(io.until ?? "2026-11-19T07:00:00Z"),
    env: {},
    ...io,
  });
  return { result, html: existsSync(boardAt(dir)) ? readFileSync(boardAt(dir), "utf8") : null };
};
/** The column each card is in, from the page. */
function columns(html) {
  const out = {};
  for (const [, name, inner] of html.matchAll(
    /<section class="col" data-column="([^"]+)">([\s\S]*?)<\/section>/g,
  ))
    for (const [, id] of inner.matchAll(/data-delegation="([^"]+)"/g)) out[id] = name;
  return out;
}
const column = (html, name) =>
  html.match(
    new RegExp(`<section class="col" data-column="${name}">([\\s\\S]*?)</section>`),
  )?.[1] ?? "";

describe("board: writing board.html", () => {
  it("writes board.html in the run folder, whole, and prints its file link", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const { result, html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /file:\/\/.*\/2026-11-19-spec-344\/board\.html\n$/);
    assert.ok(html.startsWith("<!doctype html>"));
    assert.deepEqual(
      readdirSync(runFolder(dir)).filter((f) => f.includes(".tmp")),
      [],
    );
  });

  it("names a rebuild command that writes the board: the `board` command, not `--status` (D6)", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    const rebuild = /Rebuild: (.*?)<\/span>/.exec(html)?.[1];
    assert.match(
      rebuild,
      /^<code>node \S*records\.mjs board tmp\/orchestrate\/2026-11-19-spec-344<\/code>$/,
    );
    assert.doesNotMatch(html, /orchestrate --status/);
  });

  it("carries its data inline and reloads itself about every 15 seconds", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    assert.match(html, /id="board-data"/);
    assert.match(html, /"reloadSeconds":15/);
    assert.match(html, /location\.reload\(\)/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href="https?:|@import/);
  });

  it("shares the dashboard's shell and its stylesheet", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    const { html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    const style = (page) => page.match(/<style>([\s\S]*?)<\/style>/)[1];
    const shared = readFileSync(join(here, "pages", "shared.css"), "utf8");
    assert.equal(style(html), shared);
    assert.match(html, /<header class="top">/);
  });

  it("refuses a missing folder, a bad flag and a bad interval", async () => {
    const dir = root();
    assert.equal((await main(["board"], { cwd: dir })).code, 2);
    assert.equal((await main(["board", "nowhere"], { cwd: dir })).code, 2);
    assert.equal((await board(dir, ["--sink", "x"])).result.code, 2);
    assert.equal((await board(dir, ["--heartbeat", "soon"])).result.code, 2);
  });

  it("names a Run Event that does not check, and writes nothing", async () => {
    const dir = root();
    appendFileSync(join(runFolder(dir), "events.jsonl"), '{"at":"x"}\n');
    const { result, html } = await board(dir);
    assert.equal(result.code, 1);
    assert.equal(html, null);
  });

  it("runs as a script", () => {
    const dir = root();
    const result = spawnSync(
      process.execPath,
      [join(here, "records.mjs"), "board", `tmp/orchestrate/${RUN}`],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(boardAt(dir)));
  });
});

describe("board: the spec-344 stream replayed", () => {
  it("puts each card in its column as the run goes", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:30:00Z" });
    assert.deepEqual(columns(html), {
      d348: "Landed",
      d349: "Landed",
      d350: "Needs you",
      d351: "Planned",
      d352: "Planned",
      d353: "Planned",
    });
    assert.match(html, /<h2>Needs you <span class="n">1<\/span>/);
  });

  it("moves a card through the columns: running, then landed", async () => {
    const a = replayed("2026-11-19T03:35:00Z");
    assert.equal(
      columns((await board(a, [], { until: "2026-11-19T03:35:00Z" })).html).d350,
      "Running",
    );
    const b = replayed("2026-11-19T03:45:00Z");
    const cols = columns((await board(b, [], { until: "2026-11-19T03:45:00Z" })).html);
    assert.equal(cols.d350, "Landed");
    assert.equal(cols.d351, "Needs you");
  });

  it("shows the exact state and the time in it on each card", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    const running = column(html, "Running");
    assert.match(running, /data-delegation="d350" data-state="running"/);
    assert.match(running, /<span class="state">running<\/span>/);
    assert.match(running, /data-since="2026-11-19T03:33:20Z">1m 40s</);
  });

  it("shows a Needs-you wait with its cause chip, how and age", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:30:00Z" });
    const needs = column(html, "Needs you");
    assert.match(needs, /data-delegation="d350"/);
    assert.match(needs, /chip cause c-harness-limit/);
    assert.match(needs, /Click the New task card task_184e1773 in the Chief of Staff session/);
    assert.match(needs, /data-since="2026-11-19T03:26:30Z">3m 30s</);
    // The banner says it too, and counts it.
    assert.match(html, /<b>1 thing waits on you<\/b>/);
    assert.match(html, /<li data-wait="w2">/);
  });

  it("makes a run-level wait a card of its own, with its cause and where to answer", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    const needs = column(html, "Needs you");
    assert.match(needs, /class="card run-wait" data-wait="w1"/);
    assert.match(needs, /plan approval/);
    assert.match(needs, /c-by-design/);
    assert.match(needs, /Answer in the Chief of Staff chat/);
    assert.match(needs, /data-since="2026-11-19T03:02:00Z">3m 0s</);
    assert.deepEqual(
      Object.values(columns(html)).sort(),
      TICKETS.map(() => "Planned"),
    );
  });

  it("counts the open waits in the tab title and the favicon", async () => {
    const dir = replayed("2026-11-19T04:48:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T04:48:00Z" });
    assert.match(html, /<title>\(1\) Run 2026-11-19-spec-344<\/title>/);
    assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,[^"]*1[^"]*">/);
    const done = await board(replayed("2026-11-19T06:30:00Z"), [], {
      until: "2026-11-19T06:30:00Z",
    });
    assert.match(done.html, /<title>Run 2026-11-19-spec-344<\/title>/);
  });

  it("feeds the most recent Run Events, newest first", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:30:00Z" });
    const feed = html.match(/<section class="panel feed">([\s\S]*?)<\/section>/)[1];
    assert.match(feed, /Recent Run Events/);
    assert.ok(feed.indexOf("d350: waiting on you") < feed.indexOf("d349: landed"));
  });

  it("ends with every landed Delegation merged and no wait open", async () => {
    const dir = replayed("2026-11-19T06:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T06:30:00Z" });
    assert.deepEqual(
      Object.values(columns(html)),
      [...TICKETS, "d344-fix1"].map(() => "Merged"),
    );
    assert.match(html, /Nothing waits on you/);
  });

  it("follows a Delegation sent back and landed again", async () => {
    const dir = replayed("2026-11-19T05:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T05:30:00Z" });
    assert.match(column(html, "Needs you"), /data-delegation="d344-fix1" data-state="sent back"/);
    assert.match(column(html, "Needs you"), /c-permission-refusal/);
  });

  it("keeps a wait on a teammate's ticket out of Needs you: it parks the card, with its age (F3)", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const before = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    const parked = (wait, delegation, blocker, login, iso) =>
      appendFileSync(
        join(runFolder(dir), "events.jsonl"),
        `${JSON.stringify({ at: iso, kind: "wait-opened", actor: "chief-of-staff", wait_id: wait, delegation, step_kind: "teammate-blocker", cause: "teammate-blocker", how: "github", blocker, blocker_login: login })}\n`,
      );
    parked("w90", "d350", 355, "sam", "2026-11-19T03:34:00Z"); // running, then parked
    parked("w91", "d352", 356, "lee", "2026-11-19T03:34:30Z"); // not started yet
    const { html } = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    const cols = columns(html);
    assert.equal(cols.d350, "Planned");
    assert.equal(cols.d352, "Planned");
    assert.doesNotMatch(column(html, "Needs you"), /data-delegation="d35[02]"/);
    // Nothing more waits on the human: the banner, the tab title, the favicon and the page's notifications agree.
    const title = (h) => /<title>(.*?)<\/title>/.exec(h)[1];
    const icon = (h) => /<link rel="icon" href="([^"]*)">/.exec(h)[1];
    const needs = (h) => /<div class="needs[^"]*" id="needs">[\s\S]*?<\/div>/.exec(h)[0];
    const data = (h) =>
      JSON.parse(/<script type="application\/json" id="board-data">(.*?)<\/script>/s.exec(h)[1]);
    assert.equal(title(html), title(before.html));
    assert.equal(icon(html), icon(before.html));
    assert.equal(needs(html), needs(before.html));
    assert.deepEqual(data(html).waits, data(before.html).waits);
    assert.equal(data(html).open, data(before.html).open);
    assert.doesNotMatch(html, /Answer on GitHub/);
    // The card says what it is parked on, and for how long.
    const card = /<div class="card" data-delegation="d350"[\s\S]*?\n<\/div>/.exec(html)[0];
    assert.match(card, /data-state="parked"/);
    assert.match(card, /c-teammate-blocker/);
    assert.match(card, /Parked on #355 \(@sam\)/);
    assert.match(card, /parked <span class="age" data-since="2026-11-19T03:34:00Z">1m 0s</);
    assert.match(html, /d350: parked on #355 \(@sam\)/);
  });

  it("unparks the card when the teammate's ticket merges (F3)", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const file = join(runFolder(dir), "events.jsonl");
    appendFileSync(
      file,
      `${JSON.stringify({ at: "2026-11-19T03:34:00Z", kind: "wait-opened", actor: "chief-of-staff", wait_id: "w90", delegation: "d350", step_kind: "teammate-blocker", cause: "teammate-blocker", how: "github", blocker: 355, blocker_login: "sam" })}\n${JSON.stringify({ at: "2026-11-19T03:34:50Z", kind: "wait-closed", actor: "chief-of-staff", wait_id: "w90" })}\n`,
    );
    const { html } = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    assert.equal(columns(html).d350, "Running");
    const card = /<div class="card" data-delegation="d350"[\s\S]*?\n<\/div>/.exec(html)[0];
    assert.doesNotMatch(card, /Parked on #355/);
  });

  it("counts a card board.md puts in Needs you in the banner, the tab title, the favicon and the notifications (C7)", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const before = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    writeFileSync(
      join(runFolder(dir), "board.md"),
      "# Run\n\n| Delegation | Issue | State |\n| --- | --- | --- |\n| d353 | #353 | stalled |\n",
    );
    const { html } = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    assert.match(column(html, "Needs you"), /data-delegation="d353" data-state="stalled"/);
    const title = (h) => /<title>(.*?)<\/title>/.exec(h)[1];
    const icon = (h) => /<link rel="icon" href="([^"]*)">/.exec(h)[1];
    const needs = (h) => /<div class="needs[^"]*" id="needs">[\s\S]*?<\/div>/.exec(h)[0];
    const data = (h) =>
      JSON.parse(/<script type="application\/json" id="board-data">(.*?)<\/script>/s.exec(h)[1]);
    const was = data(before.html).open;
    assert.equal(data(html).open, was + 1);
    assert.equal(title(html), `(${was + 1}) Run ${RUN}`);
    assert.notEqual(icon(html), icon(before.html));
    assert.match(needs(html), new RegExp(`<b>${was + 1} things? waits? on you</b>`));
    assert.match(needs(html), /<li data-wait="state:d353">[\s\S]*?d353[\s\S]*?stalled/);
    assert.ok(data(html).waits.some((w) => w.id === "state:d353"));
    // Each Needs you card, and each wait of the run, is counted in the column header too.
    const header = Number(/<h2>Needs you <span class="n">(\d+)<\/span>/.exec(html)[1]);
    assert.ok(header >= 1);
  });

  it("counts the Needs you header as the banner counts it, two waits on one card included (C7)", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const add = (event) =>
      appendFileSync(join(runFolder(dir), "events.jsonl"), `${JSON.stringify(event)}\n`);
    add({
      at: "2026-11-19T03:34:20Z",
      kind: "wait-opened",
      actor: "chief-of-staff",
      wait_id: "w93",
      delegation: "d350",
      step_kind: "decision-request",
      cause: "spec-gap",
      how: "chat",
    });
    add({
      at: "2026-11-19T03:34:30Z",
      kind: "wait-opened",
      actor: "chief-of-staff",
      wait_id: "w94",
      delegation: "d350",
      step_kind: "decision-request",
      cause: "human-choice",
      how: "chat",
    });
    const { html } = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    const data = JSON.parse(
      /<script type="application\/json" id="board-data">(.*?)<\/script>/s.exec(html)[1],
    );
    assert.ok(data.open >= 2, String(data.open));
    const header = Number(/<h2>Needs you <span class="n">(\d+)<\/span>/.exec(html)[1]);
    assert.equal(header, data.open);
    assert.match(/<title>(.*?)<\/title>/.exec(html)[1], new RegExp(`^\\(${data.open}\\) `));
  });

  it("says Nothing waits on you only when Needs you is empty (C7)", async () => {
    const dir = replayed("2026-11-19T06:30:00Z");
    writeFileSync(
      join(runFolder(dir), "board.md"),
      "# Run\n\n| Delegation | Issue | State |\n| --- | --- | --- |\n| d348 | #348 | crashed |\n",
    );
    const { html } = await board(dir, [], { until: "2026-11-19T06:30:00Z" });
    assert.match(column(html, "Needs you"), /data-delegation="d348" data-state="crashed"/);
    assert.doesNotMatch(html, /Nothing waits on you/);
    assert.match(html, /<h2>Needs you <span class="n">1<\/span>/);
    assert.match(/<title>(.*?)<\/title>/.exec(html)[1], /^\(1\) /);
  });

  it("moves a parked Delegation that opens a wait on the human to `waiting`, and back to `parked` once it closes (C7)", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const file = join(runFolder(dir), "events.jsonl");
    const add = (event) => appendFileSync(file, `${JSON.stringify(event)}\n`);
    add({
      at: "2026-11-19T03:34:00Z",
      kind: "wait-opened",
      actor: "chief-of-staff",
      wait_id: "w90",
      delegation: "d350",
      step_kind: "teammate-blocker",
      cause: "teammate-blocker",
      how: "github",
      blocker: 355,
      blocker_login: "sam",
    });
    add({
      at: "2026-11-19T03:34:20Z",
      kind: "wait-opened",
      actor: "chief-of-staff",
      wait_id: "w92",
      delegation: "d350",
      step_kind: "decision-request",
      cause: "spec-gap",
      how: "chat",
    });
    const open = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    assert.equal(columns(open.html).d350, "Needs you");
    assert.match(column(open.html, "Needs you"), /data-delegation="d350" data-state="waiting"/);
    add({
      at: "2026-11-19T03:34:40Z",
      kind: "wait-closed",
      actor: "chief-of-staff",
      wait_id: "w92",
    });
    const closed = await board(dir, [], { until: "2026-11-19T03:35:00Z" });
    assert.equal(columns(closed.html).d350, "Planned");
    assert.match(closed.html, /data-delegation="d350" data-state="parked"/);
  });

  it("takes the exact state of board.md where it has the row, and files it in its column", async () => {
    const dir = replayed("2026-11-19T04:30:00Z");
    writeFileSync(
      join(runFolder(dir), "board.md"),
      "# Run\n\n| Delegation | Issue | State |\n| --- | --- | --- |\n| d353 | #353 | reported |\n| d352 | #352 | `verified` |\n",
    );
    const { html } = await board(dir, [], { until: "2026-11-19T04:30:00Z" });
    assert.match(column(html, "Checking"), /data-delegation="d353" data-state="reported"/);
    assert.match(column(html, "Checking"), /data-delegation="d352" data-state="verified"/);
  });
});

describe("board: the drawer", () => {
  it("has a drawer per card, linkable as #open=d:<id>, with its facts, states, waits and events", async () => {
    const dir = replayed("2026-11-19T03:45:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T03:45:00Z" });
    assert.match(html, /href="#open=d:d350"/);
    const drawer = html.match(/<aside class="drawer" data-open="d:d350"[\s\S]*?<\/aside>/)[0];
    assert.match(drawer, /<dt>Started from<\/dt><dd>a card you clicked<\/dd>/);
    assert.match(drawer, /<dt>Issue<\/dt><dd>#350<\/dd>/);
    assert.match(drawer, /<dt>Kind<\/dt><dd>building<\/dd>/);
    // States with durations: planned, running, landed.
    assert.match(
      drawer,
      /<span class="state">planned<\/span>[\s\S]*<span class="state">running<\/span>[\s\S]*<span class="state">landed<\/span>/,
    );
    assert.match(drawer, /8m 28s/); // running 03:33:20 to 03:41:48
    // Its wait, closed, with how long it lasted.
    assert.match(drawer, /Click the New task card task_184e1773/);
    assert.match(drawer, /to 2026-11-19T03:33:10Z \(6m 40s\)/);
    // Its Run Events.
    assert.match(drawer, /d350: started \(building, from a card\)/);
    assert.match(drawer, /d350: landed/);
  });

  it("says a direct start was not from a card", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const file = join(runFolder(dir), "delegations", "d348", "events.jsonl");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('"start_route":"card"', '"start_route":"direct"'),
    );
    const { html } = await board(dir, [], { until: "2026-11-19T03:30:00Z" });
    const drawer = html.match(/<aside class="drawer" data-open="d:d348"[\s\S]*?<\/aside>/)[0];
    assert.match(drawer, /<dd>the Chief of Staff, directly<\/dd>/);
  });

  it("shows the Delegation's local Activity Log, escaped, and not another's", async () => {
    const dir = replayed("2026-11-19T03:45:00Z");
    writeFileSync(
      join(runFolder(dir), "delegations", "d350", "activity.md"),
      "## 03:35 ran the suite <script>alert(1)</script>\n",
    );
    writeFileSync(join(runFolder(dir), "activity.md"), "CoS-only line\n");
    const { html } = await board(dir, [], { until: "2026-11-19T03:45:00Z" });
    const d350 = html.match(/<aside class="drawer" data-open="d:d350"[\s\S]*?<\/aside>/)[0];
    const d351 = html.match(/<aside class="drawer" data-open="d:d351"[\s\S]*?<\/aside>/)[0];
    assert.match(d350, /ran the suite &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.doesNotMatch(d351, /ran the suite|CoS-only/);
    assert.match(d351, /No Activity Log on this machine/);
    assert.match(
      html.match(/<aside class="drawer" data-open="run"[\s\S]*?<\/aside>/)[0],
      /CoS-only line/,
    );
  });

  it("opens the drawer from the address in its script", async () => {
    const { html } = await board(replayed("2026-11-19T03:45:00Z"), [], {
      until: "2026-11-19T03:45:00Z",
    });
    assert.match(html, /open=\(\.\+\)/);
  });
});

const RULINGS = `# Ruling Ledger

### R1: Keep the outcome definitions in one file?

**Delegation:** d350, for #350
**Question:** Keep them in one file or both?
**Options:**

1. One file: one place to change
2. Both files: each reads alone

**Choice:** 1, because the spec asks for one source of truth
**Evidence:** RUN.md:212 at f17e566
**Cites:** none
**Commits:** none yet
**Verdict:** unreviewed

### R2: A row below the floor?

**Delegation:** d352, for #352
**Question:** Write n/a or keep the source?
**Options:**

1. Write n/a: never published
2. Keep the source: can still be closed

**Choice:** 2, because of the closed advisory
**Evidence:** RUN.md:301 at 5159081
**Cites:** R1
**Commits:** none yet
**Verdict:** upheld, 2026-11-19
`;
/** The replay with Rulings: spec-344's own plan-approved says autonomous. */
function withRulings(until) {
  const dir = replayed(until);
  writeFileSync(join(runFolder(dir), "rulings.md"), RULINGS);
  const own = join(runFolder(dir), "events.jsonl");
  appendFileSync(
    own,
    [
      '{"at":"2026-11-19T03:37:00Z","kind":"ruling-made","actor":"chief-of-staff","delegation":"d350","ruling":"R1"}',
      '{"at":"2026-11-19T04:05:00Z","kind":"ruling-made","actor":"chief-of-staff","delegation":"d352","ruling":"R2"}',
      '{"at":"2026-11-19T04:20:00Z","kind":"ruling-verdict","actor":"human","ruling":"R2","verdict":"upheld"}',
    ]
      .filter((l) => JSON.parse(l).at <= until)
      .map((l) => `${l}\n`)
      .join(""),
  );
  return dir;
}

describe("board: Rulings, in an autonomous run only", () => {
  it("has a Rulings section with the unreviewed count, and a badge on each card", async () => {
    const dir = withRulings("2026-11-19T04:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T04:30:00Z" });
    assert.match(
      html,
      /<section class="panel rulings" id="rulings"><h2>Rulings <span class="n">1 unreviewed<\/span>/,
    );
    assert.match(html, /<a class="state ruling" href="#open=r:R1">R1 unreviewed<\/a>/);
    assert.match(column(html, "Landed"), /data-delegation="d350"[\s\S]*?R1 unreviewed/);
  });

  it("opens each Ruling in the drawer: question, options, choice, reason, evidence, cites and verdict history", async () => {
    const dir = withRulings("2026-11-19T04:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T04:30:00Z" });
    const r2 = html.match(/<aside class="drawer" data-open="r:R2"[\s\S]*?<\/aside>/)[0];
    assert.match(r2, /A row below the floor\?/);
    assert.match(r2, /<li>Write n\/a: never published<\/li>/);
    assert.match(r2, /<li>Keep the source: can still be closed<\/li>/);
    assert.match(r2, /2, because of the closed advisory/);
    assert.match(r2, /RUN\.md:301 at 5159081/);
    assert.match(r2, /<a href="#open=r:R1">R1<\/a>/);
    assert.match(r2, /04:20:00Z<\/time> upheld/);
    assert.match(r2, /upheld, 2026-11-19/);
    assert.match(r2, /read-only/);
  });

  it("is read-only: the board has no form, button or control that answers", async () => {
    const dir = withRulings("2026-11-19T04:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T04:30:00Z" });
    const text = html
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<script[\s\S]*?<\/script>/g, "");
    assert.doesNotMatch(text, /<form|<input|<textarea|<select/);
    assert.doesNotMatch(text.replace(/<button id="theme"[^>]*>.*?<\/button>/, ""), /<button/);
  });

  it("has no Rulings section in a run that is not autonomous", async () => {
    const dir = replayed("2026-11-19T03:05:00Z"); // before the plan was approved: still `relay`
    writeFileSync(join(runFolder(dir), "rulings.md"), RULINGS);
    const { html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    assert.doesNotMatch(html, /class="panel rulings"|id="rulings"/);
    assert.doesNotMatch(html, /data-open="r:/);
    assert.doesNotMatch(html, /R1 unreviewed/);
  });
});

describe("board: a quiet run and a stopped one", () => {
  const LAST = "2026-11-19T03:30:00Z"; // the last Run Event of the replay below is at 03:26:40Z
  it("warns that the run is stale when the last Run Event is older than the heartbeat allows", async () => {
    const dir = replayed(LAST);
    const { html } = await board(dir, ["--heartbeat", "5"], { until: "2026-11-19T04:00:00Z" });
    assert.match(
      html,
      /<div class="banner stale-warning" role="alert">Stale: the last heartbeat or Run Event was 33m 20s ago, and the heartbeat is every 5 min\./,
    );
  });

  it("does not warn when the last Run Event is fresh", async () => {
    const dir = replayed(LAST);
    const { html } = await board(dir, ["--heartbeat", "5"], { until: "2026-11-19T03:30:00Z" });
    assert.doesNotMatch(html, /class="banner stale-warning"/);
  });

  it("allows one missed firing before it warns", async () => {
    const dir = replayed(LAST);
    // 3m 30s after... the last event is 03:26:40Z; 5-minute heartbeat; under 10m is within two intervals.
    const near = await board(dir, ["--heartbeat", "5"], { until: "2026-11-19T03:35:40Z" });
    assert.doesNotMatch(near.html, /class="banner stale-warning"/);
    const far = await board(dir, ["--heartbeat", "5"], { until: "2026-11-19T03:37:00Z" });
    assert.match(far.html, /class="banner stale-warning"/);
  });

  it("takes its default from the board page's one constant (D7)", async () => {
    const dir = replayed(LAST);
    const { html } = await board(dir, [], { until: "2026-11-19T04:00:00Z" });
    assert.match(html, new RegExp(`the heartbeat is every ${HEARTBEAT_MINUTES} min`));
    // Given as the default, the rebuild command leaves the flag out; any other value it names.
    assert.doesNotMatch(html, /board [^<]*--heartbeat/);
    const other = await board(dir, ["--heartbeat", String(HEARTBEAT_MINUTES + 1)], {
      until: "2026-11-19T04:00:00Z",
    });
    assert.match(other.html, new RegExp(`board [^<]*--heartbeat ${HEARTBEAT_MINUTES + 1}<`));
  });

  it("uses the 10 minute default of HARNESSES.md when none is given", async () => {
    const dir = replayed(LAST);
    const quiet = await board(dir, [], { until: "2026-11-19T03:40:00Z" });
    assert.doesNotMatch(quiet.html, /class="banner stale-warning"/);
    const stopped = await board(dir, [], { until: "2026-11-19T04:00:00Z" });
    assert.match(stopped.html, /the heartbeat is every 10 min/);
  });

  it("never warns with no heartbeat armed, or once the run is closed", async () => {
    const none = await board(replayed(LAST), ["--heartbeat", "none"], {
      until: "2026-11-20T04:00:00Z",
    });
    assert.doesNotMatch(none.html, /class="banner stale-warning"/);
    const closed = await board(replayed("2026-11-19T06:30:00Z"), [], {
      until: "2026-11-21T00:00:00Z",
    });
    assert.doesNotMatch(closed.html, /class="banner stale-warning"/);
  });

  const heartbeat = (dir, iso) =>
    appendFileSync(
      join(runFolder(dir), "events.jsonl"),
      `${JSON.stringify({ at: iso, kind: "heartbeat", actor: "chief-of-staff" })}\n`,
    );

  it("counts a heartbeat event: a quiet run whose last heartbeat is fresh is not stale (F1)", async () => {
    const dir = replayed(LAST);
    heartbeat(dir, "2026-11-19T03:55:00Z");
    const { result, html } = await board(dir, ["--heartbeat", "5"], {
      until: "2026-11-19T04:00:00Z",
    });
    assert.equal(result.code, 0, result.out);
    assert.doesNotMatch(html, /class="banner stale-warning"/);
    assert.match(html, /"lastEventAt":"2026-11-19T03:55:00Z"/);
    // A heartbeat is not news: it never shows in the feed.
    const feed = /<section class="panel feed">[\s\S]*?<\/section>/.exec(html)[0];
    assert.doesNotMatch(feed, /heartbeat/);
  });

  it("warns once the last heartbeat is old too (F1)", async () => {
    const dir = replayed(LAST);
    heartbeat(dir, "2026-11-19T03:40:00Z");
    const { html } = await board(dir, ["--heartbeat", "5"], { until: "2026-11-19T04:00:00Z" });
    assert.match(
      html,
      /Stale: the last heartbeat or Run Event was 20m 0s ago, and the heartbeat is every 5 min\./,
    );
  });

  it("derive ignores heartbeat events (F1)", async () => {
    const plain = await derived();
    const dir = root();
    heartbeat(dir, "2026-11-19T03:55:00Z");
    heartbeat(dir, "2026-11-19T04:05:00Z");
    assert.deepEqual(await derived(dir), plain);
  });

  it("appends a heartbeat event with no fields (F1)", async () => {
    const dir = root();
    const file = join(runFolder(dir), "events.jsonl");
    const result = await main(
      ["event", "--file", file, "--kind", "heartbeat", "--actor", "chief-of-staff"],
      { cwd: dir, now: at("2026-11-19T03:55:00Z") },
    );
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8").trim().split("\n").at(-1)), {
      at: "2026-11-19T03:55:00Z",
      kind: "heartbeat",
      actor: "chief-of-staff",
    });
    const wrong = await main(
      ["event", "--file", file, "--kind", "heartbeat", "--actor", "delegation"],
      { cwd: dir, now: at("2026-11-19T03:56:00Z") },
    );
    assert.equal(wrong.code, 1);
  });

  it("tells the page's own script when to warn, so a file left open still goes stale", async () => {
    const { html } = await board(replayed(LAST), ["--heartbeat", "5"], { until: LAST });
    assert.match(html, /"lastEventAt":"2026-11-19T03:26:40Z"/);
    assert.match(html, /"staleAfterMs":600000/);
  });
});

describe("board: links, and what never leaves the folder", () => {
  it("links a closed run to its page in the dashboard", async () => {
    const dir = replayed("2026-11-19T06:30:00Z");
    const { html } = await board(dir, [], { until: "2026-11-19T06:30:00Z" });
    assert.match(
      html,
      /<a href="\.\.\/dashboard\.html#\/run\/2026-11-19-spec-344\/summary">This run's page in the dashboard<\/a>/,
    );
    const open = await board(replayed("2026-11-19T03:30:00Z"), [], {
      until: "2026-11-19T03:30:00Z",
    });
    assert.doesNotMatch(open.html, /dashboard\.html/);
  });

  it("links a Team Run to the Shared Board instead of copying it", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const file = join(runFolder(dir), "events.jsonl");
    writeFileSync(file, readFileSync(file, "utf8").replace('"team":false', '"team":true'));
    mkdirSync(join(runFolder(dir), "shared-board"));
    writeFileSync(join(runFolder(dir), "shared-board", "350.md"), "TEAMMATE-ROW-PROSE\n");
    const { html } = await board(dir, [], { until: "2026-11-19T03:30:00Z" });
    assert.match(
      html,
      /<a href="https:\/\/github\.com\/mnaimfaizy\/agent-kit\/issues\/344">Shared Board<\/a>/,
    );
    assert.match(html, /--status --spec 344/);
    assert.doesNotMatch(html, /TEAMMATE-ROW-PROSE/);
    const solo = await board(replayed("2026-11-19T03:30:00Z"), [], {
      until: "2026-11-19T03:30:00Z",
    });
    assert.doesNotMatch(solo.html, /Shared Board/);
  });

  it("carries no credential, and says it holds private prose", async () => {
    const dir = replayed("2026-11-19T03:45:00Z");
    const ghp = `ghp_${"a1B2".repeat(8)}`;
    writeFileSync(
      join(runFolder(dir), "delegations", "d350", "activity.md"),
      `pushed with ${ghp} and ${SECRET}\n`,
    );
    writeFileSync(join(runFolder(dir), "activity.md"), `AKIA${"A".repeat(16)}\n`);
    const { html } = await board(dir, [], {
      until: "2026-11-19T03:45:00Z",
      env: { GH_TOKEN: SECRET },
    });
    assert.doesNotMatch(html, new RegExp(`${ghp}|${SECRET}|AKIA${"A".repeat(16)}`));
    assert.match(html, /\[redacted\]/);
    assert.match(html, /contains private prose from this machine, don&#39;t share this file/);
  });

  it("holds no prose from outside the run folder: not the tracker, not a sink", async () => {
    const calls = [];
    const dir = replayed("2026-11-19T03:45:00Z");
    await board(dir, [], {
      until: "2026-11-19T03:45:00Z",
      exec: (command, args) => (calls.push([command, ...args]), { code: 1, out: "", err: "" }),
      fetch: () => assert.fail("the board never reads a sink"),
    });
    assert.deepEqual(
      calls.filter(([c]) => c !== "git"),
      [],
    );
  });
});

// --- serve: the optional 127.0.0.1 server for the live run board (#434).

/** Start `serve` through `main` on an ephemeral port. `stop()` aborts it and returns main's result. */
async function serving(dir, args = [], io = {}) {
  const controller = new AbortController();
  let listening;
  const ready = new Promise((resolve) => (listening = resolve));
  const done = main(["serve", `tmp/orchestrate/${RUN}`, ...args], {
    cwd: dir,
    now: at("2026-11-19T03:30:00Z"),
    env: {},
    pollMs: 20,
    signal: controller.signal,
    listening,
    ...io,
  });
  const info = await Promise.race([
    ready,
    done.then((r) => assert.fail(`serve ended before listening: ${r.out}`)),
  ]);
  const stop = () => (controller.abort(), done);
  stops.push(stop);
  return { ...info, stop };
}
const stops = [];
afterEach(() => Promise.all(stops.splice(0).map((stop) => stop())));

/** Connect to the server's event stream. `next(event)` waits for the next message of that name. */
async function listen(url, query = "") {
  const controller = new AbortController();
  const response = await fetch(new URL(`events${query}`, url), { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  stops.push(async () => controller.abort());
  const queue = [];
  let buffer = "";
  return async function next(name) {
    const deadline = Date.now() + 5000;
    for (;;) {
      const found = queue.findIndex((m) => m.event === name);
      if (found >= 0) return queue.splice(found, 1)[0].data;
      const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
      const { value, done } = await reader.read().finally(() => clearTimeout(timer));
      assert.ok(!done, `the stream ended while waiting for ${name}`);
      buffer += value;
      let cut;
      while ((cut = buffer.indexOf("\n\n")) >= 0) {
        const lines = buffer.slice(0, cut).split("\n");
        buffer = buffer.slice(cut + 2);
        const event = lines.find((l) => l.startsWith("event: "))?.slice(7);
        const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
        if (event) queue.push({ event, data: JSON.parse(data) });
      }
    }
  };
}

const delegationEvents = (dir, id) => join(runFolder(dir), "delegations", id, "events.jsonl");
const line = (event) => `${JSON.stringify(event)}\n`;
const SEND_BACK = {
  at: "2026-11-19T03:31:00Z",
  kind: "send-back",
  actor: "chief-of-staff",
  delegation: "d350",
};

describe("serve: bound to 127.0.0.1, pushing Run Events", () => {
  it("listens on 127.0.0.1 only, on the port it reports, and stops when told", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const server = await serving(dir);
    assert.equal(server.address, "127.0.0.1");
    assert.equal(server.url, `http://127.0.0.1:${server.port}/`);
    assert.equal((await fetch(server.url)).status, 200);
    await assert.rejects(fetch(`http://[::1]:${server.port}/`));
    const result = await server.stop();
    assert.equal(result.code, 0, result.out);
    await assert.rejects(fetch(server.url));
  });

  it("pushes an event appended to the Chief of Staff's events file to a connected client", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const server = await serving(dir);
    const next = await listen(server.url);
    const event = {
      at: "2026-11-19T03:31:00Z",
      kind: "pull-request",
      actor: "chief-of-staff",
      pr: 9,
    };
    appendFileSync(join(runFolder(dir), "events.jsonl"), line(event));
    assert.deepEqual(await next("run-event"), event);
  });

  it("pushes a Delegation's own step, from a file that existed and from one made after the start", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const server = await serving(dir);
    const next = await listen(server.url);
    appendFileSync(delegationEvents(dir, "d350"), line(SEND_BACK));
    assert.deepEqual(await next("run-event"), SEND_BACK);
    mkdirSync(join(runFolder(dir), "delegations", "d999"), { recursive: true });
    const late = { ...SEND_BACK, delegation: "d999" };
    writeFileSync(delegationEvents(dir, "d999"), line(late));
    assert.deepEqual(await next("run-event"), late);
  });

  it("pushes nothing that was there at the start, nothing half written and nothing that fails the check", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const server = await serving(dir);
    const next = await listen(server.url);
    const text = line(SEND_BACK);
    appendFileSync(delegationEvents(dir, "d350"), `{"kind":"nonsense"}\n${text.slice(0, 20)}`);
    await new Promise((resolve) => setTimeout(resolve, 80));
    appendFileSync(delegationEvents(dir, "d350"), text.slice(20));
    assert.deepEqual(await next("run-event"), SEND_BACK);
  });

  it("replays to a page that connects late what was appended since the page was built", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const server = await serving(dir);
    const html = await (await fetch(server.url)).text();
    const { session, seq } = JSON.parse(html.match(/id="board-live">([\s\S]*?)<\/script>/)[1]);
    appendFileSync(delegationEvents(dir, "d350"), line(SEND_BACK));
    await new Promise((resolve) => setTimeout(resolve, 80));
    const next = await listen(server.url, `?session=${session}&after=${seq}`);
    assert.deepEqual(await next("run-event"), SEND_BACK);
    const stale = await listen(server.url, "?session=other&after=0");
    assert.deepEqual(await stale("reload"), {});
  });

  it("answers only GET and HEAD, only for its own address, and gives no other origin the board", async () => {
    const server = await serving(replayed("2026-11-19T03:30:00Z"));
    const asked = (headers, method = "GET", path = "/") =>
      new Promise((resolve, reject) =>
        request({ host: "127.0.0.1", port: server.port, path, method, headers }, (res) => {
          res.resume();
          resolve(res);
        })
          .on("error", reject)
          .end(),
      );
    assert.equal((await asked({ host: "evil.example" })).statusCode, 403);
    assert.equal((await asked({ host: `localhost:${server.port}` })).statusCode, 200);
    assert.equal((await asked({}, "POST")).statusCode, 405);
    assert.equal((await asked({}, "GET", "/events.jsonl")).statusCode, 404);
    const page = await asked({ origin: "https://evil.example" });
    assert.equal(page.headers["access-control-allow-origin"], undefined);
    assert.equal(page.headers["cache-control"], "no-store");
  });

  it("refuses a missing folder, a bad flag, a bad port and a port in use", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const run = (args) => main(["serve", ...args], { cwd: dir, env: {} });
    assert.equal((await run([])).code, 2);
    assert.equal((await run(["nowhere"])).code, 2);
    const folder = `tmp/orchestrate/${RUN}`;
    assert.equal((await run([folder, "--host", "0.0.0.0"])).code, 2);
    assert.equal((await run([folder, "--port", "70000"])).code, 2);
    const first = await serving(dir);
    const second = await run([folder, "--port", String(first.port)]);
    assert.equal(second.code, 1);
    assert.match(second.out, /port \d+ is already in use/);
  });

  it("runs as a script, printing its address and stopping on SIGINT", async () => {
    const dir = replayed("2026-11-19T03:30:00Z");
    const child = spawn(
      process.execPath,
      [join(here, "records.mjs"), "serve", `tmp/orchestrate/${RUN}`],
      { cwd: dir },
    );
    let out = "";
    const exited = new Promise((resolve) => child.on("exit", resolve));
    stops.push(async () => child.kill("SIGKILL"));
    await new Promise((resolve, reject) => {
      child.on("exit", () => reject(new Error(`ended before listening: ${out}`)));
      child.stdout.on("data", (chunk) => {
        out += chunk;
        if (/http:\/\/127\.0\.0\.1:\d+\/\n/.test(out)) resolve();
      });
    });
    const url = out.match(/http:\/\/127\.0\.0\.1:\d+\//)[0];
    assert.equal((await fetch(url)).status, 200);
    child.kill("SIGINT");
    assert.equal(await exited, 0);
    assert.match(out, /stopped serving/);
  });
});

describe("serve: the served board, and the file board without it", () => {
  const dataOf = (html, id) =>
    JSON.parse(html.match(new RegExp(`id="${id}">([\\s\\S]*?)</script>`))[1]);

  it("serves the board of the run as it now is", async () => {
    const dir = replayed("2026-11-19T03:35:00Z");
    const server = await serving(dir);
    const before = await (await fetch(server.url)).text();
    assert.equal(columns(before).d350, "Running");
    appendFileSync(
      delegationEvents(dir, "d350"),
      line({
        at: "2026-11-19T03:36:00Z",
        kind: "wait-opened",
        actor: "delegation",
        wait_id: "w-new",
        delegation: "d350",
        step_kind: "decision-request",
        cause: "spec-gap",
        how: "chat",
      }),
    );
    const after = await (await fetch(server.url)).text();
    assert.equal(columns(after).d350, "Needs you");
  });

  it("may raise browser notifications for new waits, only after the human asks for them", async () => {
    const server = await serving(replayed("2026-11-19T03:05:00Z"));
    const html = await (await fetch(server.url)).text();
    assert.match(html, /<button[^>]+id="notify"[^>]*hidden[^>]*>Notify me of new waits<\/button>/);
    assert.match(html, /Notification\.requestPermission\(\)/);
    assert.ok(Array.isArray(dataOf(html, "board-data").waits));
  });

  it("when the server stops, stops reloading and points at board.html, which a browser cannot open itself", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const server = await serving(dir);
    const html = await (await fetch(server.url)).text();
    const file = pathToFileURL(boardAt(dir)).href;
    assert.match(html, /new EventSource\(/);
    assert.match(
      html,
      /<div class="banner server-stopped" role="alert" hidden>The server stopped, so this page no longer updates\./,
    );
    assert.ok(html.includes(`<code id="file-board">${file}</code>`));
    assert.doesNotMatch(html, /setTimeout\(reload, data\.reloadSeconds/);
  });

  it("writes board.html at the start only when the run has none", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    await serving(dir);
    assert.ok(existsSync(boardAt(dir)));
    const kept = replayed("2026-11-19T03:05:00Z");
    writeFileSync(boardAt(kept), "the Chief of Staff's\n");
    await serving(kept);
    assert.equal(readFileSync(boardAt(kept), "utf8"), "the Chief of Staff's\n");
  });

  it("leaves a file board that needs no server: it reloads itself and connects to nothing", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const server = await serving(dir);
    await server.stop();
    const { result, html } = await board(dir, [], { until: "2026-11-19T03:05:00Z" });
    assert.equal(result.code, 0, result.out);
    assert.match(html, /setTimeout\(reload, data\.reloadSeconds \* 1000\)/);
    assert.doesNotMatch(
      html,
      /EventSource|Notification|127\.0\.0\.1|id="board-live"|server-stopped" role/,
    );
  });

  it("says what is wrong with a bad events file, and tries again", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const server = await serving(dir);
    appendFileSync(join(runFolder(dir), "events.jsonl"), '{"at":"x"}\n');
    const response = await fetch(server.url);
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.match(text, /events\.jsonl:\d+/);
    // It tries again only while the server answers, so a stopped server leaves no error page behind.
    assert.doesNotMatch(text, /http-equiv="refresh"/);
    assert.match(text, /method: "HEAD"[\s\S]*\.ok\) location\.reload\(\)/);
    assert.ok(text.includes(pathToFileURL(boardAt(dir)).href));
  });

  it("tells an open page when the board cannot be rebuilt, and holds its reload while it asks to notify", async () => {
    const server = await serving(replayed("2026-11-19T03:05:00Z"));
    const html = await (await fetch(server.url)).text();
    assert.match(
      html,
      /<div class="banner server-trouble" role="alert" hidden>The server cannot build the board from the run folder, so this page is out of date\. Reload it to see why\.<\/div>/,
    );
    assert.match(html, /trouble\.hidden = false/);
    assert.match(html, /if \(asking\) return;/);
  });

  it("returns a failure, and serves nothing, when the run folder cannot be read", async () => {
    const dir = replayed("2026-11-19T03:05:00Z");
    const folder = join(runFolder(dir), "delegations");
    rmSync(folder, { recursive: true });
    writeFileSync(folder, "a file\n");
    const result = await main(["serve", `tmp/orchestrate/${RUN}`], { cwd: dir, env: {} });
    assert.equal(result.code, 1);
    assert.match(result.out, /could not read the run folder/);
  });

  it("redacts the Activity Logs it serves, and links a closed run to /dashboard", async () => {
    const dir = replayed("2026-11-19T06:30:00Z");
    writeFileSync(join(runFolder(dir), "activity.md"), `pushed with ${SECRET}\n`);
    const server = await serving(dir, [], { env: { GH_TOKEN: SECRET } });
    const html = await (await fetch(server.url)).text();
    assert.ok(!html.includes(SECRET));
    assert.match(html, /<a href="\/dashboard#\/run\/2026-11-19-spec-344\/summary">/);
  });
});

describe("serve: /dashboard", () => {
  it("returns the dashboard built from the local records, rebuilt on each request", async () => {
    const dir = replayed("2026-11-19T06:30:00Z");
    const server = await serving(dir);
    const none = await fetch(new URL("dashboard", server.url));
    assert.equal(none.status, 404);
    assert.match(await none.text(), /no Run Records/);
    await derived(dir);
    const first = await fetch(new URL("dashboard", server.url));
    assert.equal(first.status, 200);
    assert.match(first.headers.get("content-type"), /^text\/html/);
    const html = await first.text();
    assert.ok(html.includes(`id="/run/${RUN}/summary"`));
    assert.doesNotMatch(html, /don&#39;t share this file/);
    const record = JSON.parse(readFileSync(recordPath(dir), "utf8"));
    record.run.id = "2026-11-20-later";
    writeFileSync(
      join(dir, "tmp", "orchestrate", "records", "2026-11-20-later.json"),
      JSON.stringify(record),
    );
    const second = await (await fetch(new URL("dashboard", server.url))).text();
    assert.ok(second.includes('id="/run/2026-11-20-later/summary"'));
    assert.ok(!existsSync(join(dir, "tmp", "orchestrate", "dashboard.html")), "writes no file");
  });

  it("reads no sink and no tracker: it shows the records an earlier build cached, and says so", async () => {
    const { dir, transport } = await readyToRead();
    await build(dir, transport);
    const built = page(dir);
    const calls = [];
    const server = await serving(dir, [], {
      exec: (command, args) => {
        calls.push([command, ...args]);
        return command === "git" ? transport.exec(command, args) : { code: 1, out: "", err: "" };
      },
      fetch: () => assert.fail("the server never reads a sink"),
    });
    const html = await (await fetch(new URL("dashboard", server.url))).text();
    assert.deepEqual(
      calls.filter(([c]) => c !== "git"),
      [],
    );
    for (const ns of [NS_A, NS_B]) {
      assert.ok(built.includes(`id="/repo/${ns}"`));
      assert.ok(html.includes(`id="/repo/${ns}"`), ns);
    }
    assert.match(html, /the server reads no sink/);
    assert.doesNotMatch(html, /could not be read/);
    assert.equal(readFileSync(join(dir, "tmp", "orchestrate", "dashboard.html"), "utf8"), built);
  });
});
