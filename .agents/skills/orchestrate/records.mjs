#!/usr/bin/env node
/**
 * The orchestrate records script: Run Events in, a Run Record out.
 *
 * Portable: Node built-ins and the tracker CLI only. One CLI, with
 * subcommands later tickets extend (upload, prune, dashboard, board):
 *
 *   node records.mjs event --file <events.jsonl> --kind <kind> --actor <actor> [--<field> <value>]...
 *   node records.mjs derive <run-folder>
 *   node records.mjs upload <run> [--yes]
 *   node records.mjs prune [--declined]
 *   node records.mjs dashboard [--local-logs]
 *   node records.mjs board <run-folder> [--heartbeat <minutes|none>]
 *   node records.mjs serve <run-folder> [--port <n>] [--heartbeat <minutes|none>]
 *
 * `main(argv, io)` is the one seam. `io` injects the clock (`now`), the files
 * root (`cwd`, which relative paths resolve against), the environment (`env`)
 * and a transport (`exec`: tracker CLI and git calls, `(command, args) =>
 * {code, out}`), so a test never touches the network or the real clock.
 * `serve` runs until `io.signal` aborts, and tells `io.listening` its address.
 *
 * A Run Record holds only counts, ids, SHAs, issue and pull request numbers,
 * times, durations, enum values and outcomes. Every value is checked against
 * a type that cannot hold prose, and a field outside the schema is an error,
 * never stripped.
 */

import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { effectiveConfig, readConfig } from "./config.mjs";

export const SCHEMA = "run-record/1";
export const ACTORS = /** @type {const} */ (["human", "chief-of-staff", "delegation"]);

/**
 * The curated `cause` list. A cause is either avoidable (a fix to the skill,
 * the config, the harness or the spec would remove the step) or by design
 * (an expected step). `by-design` and `teammate-blocker` are by design.
 */
export const CAUSES = Object.freeze({
  "harness-limit": "avoidable",
  "permission-refusal": "avoidable",
  "tool-missing": "avoidable",
  "skill-bug": "avoidable",
  "spec-gap": "avoidable",
  "missing-config": "avoidable",
  "human-choice": "avoidable",
  other: "avoidable",
  "by-design": "by-design",
  "teammate-blocker": "by-design",
});

/** What a human step was: one touch of one kind. QA kinds carry a `qa-` prefix. */
export const STEP_KINDS = /** @type {const} */ ([
  "plan-approval",
  "card-start",
  "decision-request",
  "write-as-human",
  "typed-command",
  "readiness-answer",
  "permission-refusal",
  "review-label",
  "post-replies",
  "ruling-review",
  "merge",
  "close-out",
  "teammate-blocker",
  "qa-command",
  "qa-readiness",
  "qa-plan-delivery",
  "qa-run-need",
  "qa-host",
  "qa-held",
  "other",
]);

const RUN_KINDS = ["tickets", "spec", "team"];
const SUPPORT = ["verified", "tried", "documented"];
const AUTHORITY = ["relay", "autonomous"];
const LANDINGS = ["integration-branch", "per-ticket"];
const RUN_OUTCOMES = ["merged", "partly-merged", "abandoned"];
const DELEGATION_KINDS = ["building", "fix", "qa", "analysis"];
const EXECUTORS = ["live-session", "sub-agent", "headless", "human-started"];
const ROUTES = ["direct", "card"];
const DELEGATION_OUTCOMES = [
  "open",
  "landed",
  "sent-back",
  "abandoned",
  "analysis-delivered",
  "qa-pass",
  "qa-fail",
];
const HOW = ["chat", "card", "github"];
const TRACKERS = ["github", "gitlab"];
const VERDICTS = ["upheld", "overturned"];
const CI_RESULTS = ["pass", "fail"];
const QA_TARGETS = ["stack", "url"];
const QA_ROUTES = ["brief", "typed"];
const QA_RESULTS = ["pass", "fail", "waiting"];
const WRITE_KINDS = [
  "add-label",
  "post-replies",
  "post-comment",
  "open-pull-request",
  "edit-pull-request",
  "move-label",
  "close-issue",
  "other",
];

// --- Value types. Every one is closed: an enum, a number, or a pattern that cannot hold a sentence.

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,38}$/;
/**
 * `host/owner/repo`, or `host/<group>/…/<project>` for a GitLab project in a subgroup.
 * An owner or group starts with a letter, a digit or `_`, as `config.mjs`'s REPOSITORY has it.
 */
const REPO = /^[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9_][\w.-]*){1,20}\/[\w.-]+$/;
const SHA = /^[0-9a-f]{7,64}$/;
/** A repository name REPO takes, where a `github.com` one has exactly `host/owner/repo`: GitHub has no subgroups. */
const plainRepository = (value) =>
  REPO.test(value) && (!value.startsWith("github.com/") || value.split("/").length === 3);

const t = {
  int: { type: "int" },
  bool: { type: "bool" },
  iso: { type: "iso" },
  id: { type: "id" },
  sha: { type: "sha" },
  repo: { type: "repo" },
  login: { type: "login" },
  enum: (values) => ({ type: "enum", values }),
  list: (item) => ({ type: "list", item }),
  nullable: (inner) => ({ type: "nullable", inner }),
  object: (fields) => ({ type: "object", fields }),
  /** A map from an id to a count, such as the number of human steps by cause. */
  counts: (keys) => ({ type: "counts", keys }),
};

/**
 * Check one value against a type. Returns null when it fits, otherwise a
 * short reason that never repeats the value (a rejected value may be prose).
 */
function violates(type, value) {
  switch (type.type) {
    case "int":
      return Number.isInteger(value) && value >= 0 ? null : "must be a whole number";
    case "bool":
      return typeof value === "boolean" ? null : "must be true or false";
    case "iso":
      return typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(value))
        ? null
        : "must be a UTC time like 2026-11-19T03:10:20Z";
    case "id":
      return typeof value === "string" && ID.test(value)
        ? null
        : "must be an id (letters, digits, . _ : -), and is free text otherwise";
    case "sha":
      return typeof value === "string" && SHA.test(value) ? null : "must be a git SHA";
    case "repo":
      return typeof value === "string" && plainRepository(value)
        ? null
        : "must be host/owner/repo, or host/group/…/project for a GitLab subgroup";
    case "login":
      return typeof value === "string" && LOGIN.test(value) ? null : "must be a tracker login";
    case "enum":
      return type.values.includes(value) ? null : `must be one of ${type.values.join(" | ")}`;
    case "nullable":
      return value === null ? null : violates(type.inner, value);
    default:
      return "has a shape the schema does not allow here";
  }
}

/**
 * Walk a value against a schema type and collect every violation as a dotted
 * path with a reason. Objects are closed: a key the type does not list is
 * "outside the schema". A key ending in `?` is optional.
 */
function check(type, value, path, problems) {
  if (type.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      problems.push(`${path}: must be an object`);
      return;
    }
    const known = new Map(
      Object.entries(type.fields).map(([key, inner]) => [key.replace(/\?$/, ""), [key, inner]]),
    );
    for (const key of Object.keys(value)) {
      if (!known.has(key)) problems.push(`${dotted(path, key)}: is outside the schema`);
    }
    for (const [name, [key, inner]] of known) {
      if (!Object.hasOwn(value, name)) {
        if (!key.endsWith("?")) problems.push(`${dotted(path, name)}: is missing`);
        continue;
      }
      check(inner, value[name], dotted(path, name), problems);
    }
    return;
  }
  if (type.type === "list") {
    if (!Array.isArray(value)) problems.push(`${path}: must be a list`);
    else value.forEach((item, n) => check(type.item, item, `${path}[${n}]`, problems));
    return;
  }
  if (type.type === "counts") {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return void problems.push(`${path}: must be an object of counts`);
    for (const [key, count] of Object.entries(value)) {
      if (!type.keys.includes(key)) problems.push(`${dotted(path, key)}: is outside the schema`);
      else if (violates(t.int, count))
        problems.push(`${dotted(path, key)}: must be a whole number`);
    }
    return;
  }
  if (type.type === "nullable" && value !== null && ["object", "list"].includes(type.inner.type))
    return check(type.inner, value, path, problems);
  const reason = violates(type, value);
  if (reason) problems.push(`${path}: ${reason}`);
}

const dotted = (path, key) => (path === "" ? key : `${path}.${key}`);

// --- The Run Record schema.

const CAUSE_KEYS = Object.keys(CAUSES);

export const RECORD_SCHEMA = t.object({
  schema: t.enum([SCHEMA]),
  run: t.object({
    id: t.id,
    repo: t.nullable(t.repo),
    operator: t.nullable(t.login),
    kind: t.enum(RUN_KINDS),
    "spec?": t.int,
    team: t.bool,
    took_over: t.list(t.id),
    tickets: t.list(t.int),
    harness: t.id,
    support_level: t.enum(SUPPORT),
    decision_authority: t.enum(AUTHORITY),
    landing: t.nullable(t.enum(LANDINGS)),
    started_at: t.iso,
    plan_approved_at: t.nullable(t.iso),
    closed_at: t.iso,
    duration_seconds: t.int,
    outcome: t.enum(RUN_OUTCOMES),
    pull_requests: t.list(t.int),
    open_waits: t.int,
  }),
  delegations: t.list(
    t.object({
      id: t.id,
      issue: t.nullable(t.int),
      kind: t.enum(DELEGATION_KINDS),
      executor: t.enum(EXECUTORS),
      model: t.id,
      start_route: t.enum(ROUTES),
      started_at: t.iso,
      landed_at: t.nullable(t.iso),
      ended_at: t.nullable(t.iso),
      duration_seconds: t.nullable(t.int),
      outcome: t.enum(DELEGATION_OUTCOMES),
      send_backs: t.int,
      decision_requests: t.int,
      rulings: t.int,
    }),
  ),
  human_steps: t.list(
    t.object({
      at: t.iso,
      opened_at: t.nullable(t.iso),
      delegation: t.nullable(t.id),
      kind: t.enum(STEP_KINDS),
      cause: t.enum(CAUSE_KEYS),
      avoidable: t.bool,
      "issue?": t.int,
      actor: t.enum(ACTORS),
      wait_id: t.nullable(t.id),
      waited_seconds: t.nullable(t.int),
      how: t.nullable(t.enum(HOW)),
      "card?": t.id,
      "blocker?": t.int,
      "blocker_login?": t.login,
      covers: t.list(t.id),
    }),
  ),
  writes: t.list(
    t.object({
      at: t.iso,
      kind: t.enum(WRITE_KINDS),
      actor: t.enum(ACTORS),
      as_human: t.bool,
      delegation: t.nullable(t.id),
    }),
  ),
  reviews: t.list(
    t.object({
      pr: t.int,
      round: t.int,
      "head?": t.sha,
      findings: t.int,
      fixed: t.int,
      answered: t.int,
    }),
  ),
  ci: t.list(
    t.object({
      pr: t.int,
      head: t.sha,
      result: t.enum(CI_RESULTS),
      failed_checks: t.int,
    }),
  ),
  rulings: t.object({ made: t.int, upheld: t.int, overturned: t.int }),
  qa: t.list(
    t.object({
      delegation: t.id,
      target: t.enum(QA_TARGETS),
      route: t.enum(QA_ROUTES),
      result: t.enum(QA_RESULTS),
    }),
  ),
  summary: t.object({
    human_steps: t.int,
    avoidable: t.int,
    by_design: t.int,
    by_cause: t.counts(CAUSE_KEYS),
    human_wait_seconds: t.int,
  }),
});

/**
 * The safe-field check. Returns the problems, each naming the dotted path of
 * the field; an empty list means the record is safe to keep and share.
 */
export function checkRecord(record) {
  const problems = [];
  check(RECORD_SCHEMA, record, "", problems);
  return problems;
}

// --- The Run Event schema: one entry per kind, each field typed as above.

const actor = t.enum(ACTORS);
const ISSUE = t.int;
/** What every event carries: when (set by the clock, never typed), what, and who wrote it. */
const COMMON = { at: t.iso, kind: t.id, actor };

export const EVENT_KINDS = Object.freeze({
  "run-opened": {
    "repo?": t.repo,
    "tracker?": t.enum(TRACKERS),
    run_kind: t.enum(RUN_KINDS),
    "spec?": t.int,
    team: t.bool,
    "took_over?": t.list(t.id),
    "tickets?": t.list(t.int),
    harness: t.id,
    support_level: t.enum(SUPPORT),
    decision_authority: t.enum(AUTHORITY),
    "landing?": t.enum(LANDINGS),
  },
  "plan-approved": { "decision_authority?": t.enum(AUTHORITY) },
  "delegation-started": {
    delegation: t.id,
    "issue?": ISSUE,
    delegation_kind: t.enum(DELEGATION_KINDS),
    executor: t.enum(EXECUTORS),
    model: t.id,
    start_route: t.enum(ROUTES),
  },
  "delegation-landed": { delegation: t.id, "head?": t.sha },
  "delegation-ended": { delegation: t.id, outcome: t.enum(DELEGATION_OUTCOMES) },
  "send-back": { delegation: t.id },
  "decision-request": { "delegation?": t.id, id: t.id },
  "ruling-made": { delegation: t.id, ruling: t.id },
  "ruling-verdict": { ruling: t.id, verdict: t.enum(VERDICTS) },
  "wait-opened": {
    wait_id: t.id,
    "delegation?": t.id,
    step_kind: t.enum(STEP_KINDS),
    cause: t.enum(CAUSE_KEYS),
    how: t.enum(HOW),
    "card?": t.id,
    "issue?": ISSUE,
    "blocker?": t.int,
    "blocker_login?": t.login,
  },
  "wait-closed": { wait_id: t.id, "covers?": t.list(t.id) },
  "human-step": {
    "delegation?": t.id,
    step_kind: t.enum(STEP_KINDS),
    cause: t.enum(CAUSE_KEYS),
    how: t.enum(HOW),
    "card?": t.id,
    "issue?": ISSUE,
    "covers?": t.list(t.id),
  },
  write: { "delegation?": t.id, write_kind: t.enum(WRITE_KINDS), as_human: t.bool },
  review: {
    pr: t.int,
    round: t.int,
    "head?": t.sha,
    findings: t.int,
    fixed: t.int,
    answered: t.int,
  },
  ci: { pr: t.int, head: t.sha, result: t.enum(CI_RESULTS), failed_checks: t.int },
  "qa-result": {
    delegation: t.id,
    target: t.enum(QA_TARGETS),
    route: t.enum(QA_ROUTES),
    result: t.enum(QA_RESULTS),
  },
  "pull-request": { pr: t.int },
  "run-closed": { outcome: t.enum(RUN_OUTCOMES), "pull_requests?": t.list(t.int) },
  /** The Chief of Staff is alive: written at every heartbeat firing. `derive` ignores it; the board's staleness check counts it. */
  heartbeat: { actor: t.enum(["chief-of-staff"]) },
});

/** The fields of an event kind, or null: `constructor` and the like are not kinds. */
const kindFields = (kind) => (Object.hasOwn(EVENT_KINDS, kind) ? EVENT_KINDS[kind] : null);

/** Problems with one Run Event, as dotted field paths. */
export function checkEvent(event) {
  const problems = [];
  if (event === null || typeof event !== "object" || Array.isArray(event))
    return ["event: must be an object"];
  const fields = kindFields(event.kind);
  if (!fields) return [`kind: must be one of ${Object.keys(EVENT_KINDS).join(" | ")}`];
  check(t.object({ ...COMMON, kind: t.enum([event.kind]), ...fields }), event, "", problems);
  return problems;
}

// --- Appending an event.

/** Read a CLI value as the type of the field it sets. Null when it does not read. */
function coerce(type, raw) {
  const inner = type.type === "nullable" ? type.inner : type;
  if (inner.type === "int") return /^\d+$/.test(raw) ? Number(raw) : raw;
  if (inner.type === "bool") return raw === "true" ? true : raw === "false" ? false : raw;
  if (inner.type === "list") {
    if (raw === "") return [];
    return raw
      .split(",")
      .map((item) => (inner.item.type === "int" ? coerce(inner.item, item) : item));
  }
  return raw;
}

function nowIso(io) {
  const now = io.now ? io.now() : new Date();
  return (now instanceof Date ? now : new Date(now)).toISOString().replace(/\.\d+Z$/, "Z");
}

/** Parse `--name value` pairs. Null on a bare word, a repeated name or a missing value. */
function pairs(args) {
  const out = {};
  for (let n = 0; n < args.length; n += 2) {
    const [name, value] = [args[n], args[n + 1]];
    // `--failed-checks` and `--failed_checks` set one field, so they are one name.
    const key = name?.slice(2).replaceAll("_", "-");
    if (!name?.startsWith("--") || value === undefined || Object.hasOwn(out, key)) return null;
    out[key] = value;
  }
  return out;
}

/** The field flags of one event kind, as `event` takes them: `--write-kind`, and `[--head]` when optional. */
export function eventFlags(kind) {
  const fields = kindFields(kind);
  if (!fields) return null;
  return Object.keys(fields)
    .filter((name) => name !== "actor")
    .map((name) => {
      const flag = `--${name.replace(/\?$/, "").replaceAll("_", "-")}`;
      return name.endsWith("?") ? `[${flag}]` : flag;
    });
}

const EVENT_USAGE = `usage: node records.mjs event --file <events.jsonl> --kind <kind> --actor <human|chief-of-staff|delegation> [--<field> <value>]...
  the fields of each kind ([optional]):
${Object.keys(EVENT_KINDS)
  .map((kind) => `    ${kind}: ${eventFlags(kind).join(" ") || "none"}\n`)
  .join("")}`;
const DERIVE_USAGE = "usage: node records.mjs derive <run-folder>\n";
const UPLOAD_RAW_USAGE =
  "usage: node records.mjs upload-raw <run id or run folder> [--list] [--yes]\n";
const UPLOAD_USAGE = "usage: node records.mjs upload <run id or run folder> [--yes]\n";
const PRUNE_USAGE = "usage: node records.mjs prune [--declined]\n";
const DASHBOARD_USAGE =
  "usage: node records.mjs dashboard [--repo <host/owner/repo>] [--local-logs]\n";
const BOARD_USAGE = "usage: node records.mjs board <run-folder> [--heartbeat <minutes|none>]\n";
const SERVE_USAGE =
  "usage: node records.mjs serve <run-folder> [--port <n>] [--heartbeat <minutes|none>]\n";
const USAGE = `${EVENT_USAGE}${DERIVE_USAGE}${UPLOAD_USAGE}${UPLOAD_RAW_USAGE}${PRUNE_USAGE}${DASHBOARD_USAGE}${BOARD_USAGE}${SERVE_USAGE}`;

function appendEvent(args, io) {
  const given = pairs(args);
  if (!given) return { code: 2, out: EVENT_USAGE };
  const { file, kind, ...rest } = given;
  if (!file || !kind) return { code: 2, out: EVENT_USAGE };
  if (basename(file) !== "events.jsonl")
    return { code: 2, out: "the events file must be named `events.jsonl`\n" };
  const fields = kindFields(kind);
  if (!fields)
    return {
      code: 1,
      out: `kind: must be one of ${Object.keys(EVENT_KINDS).join(" | ")}\n`,
    };
  const event = { at: nowIso(io), kind };
  const problems = [];
  for (const [flag, raw] of Object.entries(rest)) {
    const name = flag.replaceAll("-", "_");
    if (name === "at") {
      problems.push("at: is set by the clock, never typed");
      continue;
    }
    const type = name === "actor" ? actor : (fields[name] ?? fields[`${name}?`] ?? null);
    if (!type) {
      problems.push(`${name}: is outside the schema for a \`${kind}\` event`);
      continue;
    }
    event[name] = coerce(type, raw);
  }
  problems.push(...checkEvent(event));
  if (problems.length) return { code: 1, out: `${[...new Set(problems)].join("\n")}\n` };
  const path = resolve(io.cwd ?? process.cwd(), file);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`);
  return { code: 0, out: `recorded ${kind} at ${event.at}\n` };
}

// --- Deriving the record.

const seconds = (from, to) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));

/** The events files of a run folder: the Chief of Staff's, then each Delegation's. */
function eventFiles(runFolder) {
  const files = [];
  const own = join(runFolder, "events.jsonl");
  if (existsSync(own)) files.push(own);
  const delegations = join(runFolder, "delegations");
  if (existsSync(delegations))
    for (const name of readdirSync(delegations).sort()) {
      const path = join(delegations, name, "events.jsonl");
      if (existsSync(path)) files.push(path);
    }
  return files;
}

/** The events of a run folder: the Chief of Staff's, then each Delegation's, each checked. */
function readEvents(runFolder) {
  const files = eventFiles(runFolder);
  const events = [];
  const problems = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, n) => {
        if (line.trim() === "") return;
        const where = `${file.slice(runFolder.length + 1)}:${n + 1}`;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return void problems.push(`${where}: is not JSON`);
        }
        const bad = checkEvent(event);
        if (bad.length) return void problems.push(...bad.map((p) => `${where}: ${p}`));
        events.push({ ...event, order: events.length });
      });
  }
  // Times have one-second resolution, so a Delegation's start sorts first among events of its second.
  const rank = (e) => (e.kind === "delegation-started" ? 0 : 1);
  events.sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at) || rank(a) - rank(b) || a.order - b.order,
  );
  return { events, problems };
}

/** `host/owner/repo` from a git remote URL, lowercased. Null when it does not read. */
export function repoFromRemote(url) {
  const bare = url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  // A port follows the host only in a URL with a scheme: in scp-style `user@host:path` the colon ends the host.
  const match =
    /^[a-z+]+:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(bare) ??
    /^(?![a-z+]+:\/\/)(?:[^@/]+@)?([^/:]+)[:/](.+)$/i.exec(bare);
  if (!match || !match[2].includes("/")) return null;
  return `${match[1]}/${match[2]}`.toLowerCase();
}

/** The tracker CLI login: ORCHESTRATE_OPERATOR, or `gh api user` / `glab api user`. */
function operatorOf(io, tracker) {
  const env = io.env ?? process.env;
  if (env.ORCHESTRATE_OPERATOR) return env.ORCHESTRATE_OPERATOR;
  const exec = io.exec ?? defaultExec;
  // GitHub unless the run says it is on GitLab.
  const [command, args, field] =
    tracker === "gitlab" ? ["glab", ["api", "user"], "username"] : ["gh", ["api", "user"], "login"];
  const result = exec(command, args);
  if (result.code !== 0) return null;
  try {
    const login = JSON.parse(result.out)[field];
    return typeof login === "string" && LOGIN.test(login) ? login : null;
  } catch {
    return null;
  }
}

/** `host/owner/repo` from the `origin` remote, or the only remote. Null when there is none, or several and none is `origin`. */
function repoOf(io) {
  const exec = io.exec ?? defaultExec;
  const cwd = io.cwd ?? process.cwd();
  const git = (...args) => exec("git", ["-C", cwd, ...args]);
  const listed = git("remote");
  if (listed.code !== 0) return null;
  const remotes = listed.out.split(/\r?\n/).filter(Boolean);
  const name = remotes.includes("origin") ? "origin" : remotes.length === 1 ? remotes[0] : null;
  if (name === null) return null;
  const url = git("remote", "get-url", name);
  return url.code === 0 ? repoFromRemote(url.out) : null;
}

/**
 * Build the record from the merged, time-ordered events. Returns `{record,
 * problems}`: problems are things the events themselves get wrong (a close
 * with no open, a Decision Request nobody raised), named so they can be fixed.
 */
function build(events, runId, operator) {
  const problems = [];
  const first = (kind) => events.find((e) => e.kind === kind);
  const opened = first("run-opened");
  const closed = events.findLast((e) => e.kind === "run-closed");
  if (!opened) problems.push("the run has no `run-opened` event");
  if (!closed) problems.push("the run has no `run-closed` event: derive at close-out");
  if (!opened || !closed) return { record: null, problems };

  const delegations = new Map();
  const steps = [];
  const open = new Map();
  const dr = new Set();
  const rulings = new Map();
  const writes = [];
  const reviews = [];
  const ci = [];
  const qa = [];
  const pulls = new Set();

  const delegation = (id, event) => {
    const found = delegations.get(id);
    if (!found)
      problems.push(`${event.kind}: \`${id}\` has no \`delegation-started\` event before it`);
    return found;
  };

  for (const e of events) {
    switch (e.kind) {
      case "delegation-started":
        delegations.set(e.delegation, {
          id: e.delegation,
          issue: e.issue ?? null,
          kind: e.delegation_kind,
          executor: e.executor,
          model: e.model,
          start_route: e.start_route,
          started_at: e.at,
          landed_at: null,
          ended_at: null,
          duration_seconds: null,
          outcome: "open",
          send_backs: 0,
          decision_requests: 0,
          rulings: 0,
        });
        break;
      case "delegation-landed": {
        const d = delegation(e.delegation, e);
        if (d) d.landed_at ??= e.at;
        break;
      }
      case "delegation-ended": {
        const d = delegation(e.delegation, e);
        if (d) {
          d.ended_at = e.at;
          d.outcome = e.outcome;
          d.duration_seconds = seconds(d.started_at, e.at);
        }
        break;
      }
      case "send-back": {
        const d = delegation(e.delegation, e);
        if (d) d.send_backs += 1;
        break;
      }
      case "decision-request": {
        dr.add(e.id);
        const d = e.delegation === undefined ? null : delegation(e.delegation, e);
        if (d) d.decision_requests += 1;
        break;
      }
      case "ruling-made": {
        rulings.set(e.ruling, null);
        const d = delegation(e.delegation, e);
        if (d) d.rulings += 1;
        break;
      }
      case "ruling-verdict":
        if (!rulings.has(e.ruling))
          problems.push(`ruling-verdict: \`${e.ruling}\` has no \`ruling-made\` event before it`);
        rulings.set(e.ruling, e.verdict);
        break;
      case "wait-opened":
        if (open.has(e.wait_id)) problems.push(`wait-opened: \`${e.wait_id}\` is already open`);
        open.set(e.wait_id, e);
        break;
      case "wait-closed": {
        const o = open.get(e.wait_id);
        if (!o) {
          problems.push(`wait-closed: \`${e.wait_id}\` has no \`wait-opened\` event before it`);
          break;
        }
        open.delete(e.wait_id);
        steps.push(step(o, e, { opened_at: o.at, waited_seconds: seconds(o.at, e.at) }));
        break;
      }
      case "human-step":
        steps.push(step(e, e, { opened_at: null, waited_seconds: null, wait_id: null }));
        break;
      case "write":
        writes.push({
          at: e.at,
          kind: e.write_kind,
          actor: e.actor,
          as_human: e.as_human,
          delegation: e.delegation ?? null,
        });
        break;
      case "review":
        reviews.push({
          pr: e.pr,
          round: e.round,
          ...(e.head ? { head: e.head } : {}),
          findings: e.findings,
          fixed: e.fixed,
          answered: e.answered,
        });
        break;
      case "ci":
        ci.push({ pr: e.pr, head: e.head, result: e.result, failed_checks: e.failed_checks });
        break;
      case "qa-result":
        qa.push({
          delegation: e.delegation,
          target: e.target,
          route: e.route,
          result: e.result,
        });
        break;
      case "pull-request":
        pulls.add(e.pr);
        break;
    }
  }

  // An open wait is held to the same rules as a closed one: it never becomes a step.
  const openWaits = [...open.values()].map((o) => ({ ...o, kind: o.step_kind }));
  for (const s of [...steps, ...openWaits]) {
    if (["plan-approval", "close-out"].includes(s.kind) && s.cause !== "by-design")
      problems.push(`human_steps: a \`${s.kind}\` step must have cause \`by-design\``);
    if (s.cause === "harness-limit" && s.card === undefined)
      problems.push("human_steps: a `harness-limit` step must name its `card`");
    if (s.cause === "teammate-blocker") {
      if (s.kind !== "teammate-blocker")
        problems.push(
          "human_steps: a `teammate-blocker` step must have step kind `teammate-blocker`",
        );
      if (s.blocker === undefined || s.blocker_login === undefined)
        problems.push(
          "human_steps: a `teammate-blocker` step must name its `blocker` ticket and `blocker_login`",
        );
    }
  }
  for (const s of steps)
    for (const id of s.covers)
      if (!dr.has(id)) problems.push(`covers: \`${id}\` names no \`decision-request\` event`);

  const approved = first("plan-approved");
  const byCause = {};
  const human = steps.filter((s) => s.actor === "human");
  for (const s of human) byCause[s.cause] = (byCause[s.cause] ?? 0) + 1;
  const verdicts = [...rulings.values()];
  const record = {
    schema: SCHEMA,
    run: {
      id: runId,
      repo: opened.repo ?? null,
      operator,
      kind: opened.run_kind,
      ...(opened.spec === undefined ? {} : { spec: opened.spec }),
      team: opened.team,
      took_over: opened.took_over ?? [],
      tickets: opened.tickets ?? [],
      harness: opened.harness,
      support_level: opened.support_level,
      decision_authority: approved?.decision_authority ?? opened.decision_authority,
      landing: opened.landing ?? null,
      started_at: opened.at,
      plan_approved_at: approved?.at ?? null,
      closed_at: closed.at,
      duration_seconds: seconds(opened.at, closed.at),
      outcome: closed.outcome,
      pull_requests: [...new Set([...(closed.pull_requests ?? []), ...pulls])].sort(
        (a, b) => a - b,
      ),
      open_waits: open.size,
    },
    delegations: [...delegations.values()],
    human_steps: steps,
    writes,
    reviews,
    ci,
    rulings: {
      made: rulings.size,
      upheld: verdicts.filter((v) => v === "upheld").length,
      overturned: verdicts.filter((v) => v === "overturned").length,
    },
    qa,
    summary: {
      human_steps: human.length,
      avoidable: human.filter((s) => s.avoidable).length,
      by_design: human.filter((s) => !s.avoidable).length,
      by_cause: byCause,
      human_wait_seconds: human.reduce((sum, s) => sum + (s.waited_seconds ?? 0), 0),
    },
  };
  return { record, problems, open: [...open.values()] };
}

/** One human step: the touch that closed a wait, or a touch with no wait. */
function step(source, touch, extra) {
  const wait = Object.hasOwn(extra, "wait_id") ? extra.wait_id : source.wait_id;
  return {
    at: touch.at,
    opened_at: extra.opened_at,
    delegation: source.delegation ?? null,
    kind: source.step_kind,
    cause: source.cause,
    avoidable: CAUSES[source.cause] === "avoidable",
    ...(source.issue === undefined ? {} : { issue: source.issue }),
    actor: touch.actor,
    wait_id: wait ?? null,
    waited_seconds: extra.waited_seconds,
    how: source.how ?? null,
    ...(source.card === undefined ? {} : { card: source.card }),
    ...(source.blocker === undefined ? {} : { blocker: source.blocker }),
    ...(source.blocker_login === undefined ? {} : { blocker_login: source.blocker_login }),
    covers: touch.covers ?? source.covers ?? [],
  };
}

function derive(args, io) {
  if (args.length !== 1) return { code: 2, out: DERIVE_USAGE };
  const runFolder = resolve(io.cwd ?? process.cwd(), args[0]);
  if (!existsSync(runFolder)) return { code: 2, out: `no run folder at \`${args[0]}\`\n` };
  const runId = basename(runFolder);
  const { events, problems } = readEvents(runFolder);
  if (problems.length) return { code: 1, out: `${problems.join("\n")}\n` };
  const opened = events.find((e) => e.kind === "run-opened");
  if (opened && !opened.repo) {
    const repo = repoOf(io);
    if (repo) opened.repo = repo;
  }
  const notes = [];
  const operator = opened ? operatorOf(io, opened.tracker ?? "github") : null;
  if (opened && operator === null)
    notes.push(
      "run.operator is null: no tracker login (set ORCHESTRATE_OPERATOR); nothing can be uploaded",
    );
  const built = build(events, runId, operator);
  const refused = [...built.problems, ...(built.record ? checkRecord(built.record) : [])];
  if (refused.length) return { code: 1, out: `${[...new Set(refused)].join("\n")}\n` };

  // Outside the run folder, so pruning or deleting it leaves the record.
  const dir = join(dirname(runFolder), "records");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${runId}.json`);
  const temporary = `${out}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(built.record, null, 2)}\n`);
  renameSync(temporary, out);
  const s = built.record.summary;
  const lines = [
    `wrote ${out}`,
    `${built.record.delegations.length} Delegations, ${s.human_steps} human steps (${s.avoidable} avoidable, ${s.by_design} by design), ${built.record.run.open_waits} waits still open${built.open.length ? `: ${built.open.map((o) => `${o.wait_id} (${o.step_kind})`).join(", ")}` : ""}`,
    ...notes,
  ];
  return { code: 0, out: `${lines.join("\n")}\n` };
}

// --- Sinks: one interface, `local`, `github`, `gitlab` and `s3` behind it.
//
//   list(prefix)          the paths under a prefix, as a sorted list
//   read(path)            {status: "found", text} | {status: "missing"} | {status: "error", detail}
//   create(path, text)    create-only: {status: "created"} | {status: "exists"} | {status: "conflict"} | {status: "error", detail}
//   privacy()             {private, visibility}; both null when it cannot be read
//   access()              how many people can read the sink, or null when it cannot be read
//   kind                  what the disclosure calls the sink: "GitHub repository", "GitLab project", "S3 bucket"
//
// `create` never overwrites: it reports `exists` and writes nothing. What a
// caller does about an existing path (identical bytes count as uploaded,
// different bytes stop) is `createOnly`, shared by every sink.

const DOTS = /^\.+$/;
/** A sink path segment: lowercase, and never empty or only dots. */
const segmentOf = (value) => {
  const segment = String(value).toLowerCase();
  return segment === "" || DOTS.test(segment) || /[/\\\s]/.test(segment) ? null : segment;
};

/**
 * Open a sink by type.
 *
 * @param {"local" | "github" | "gitlab" | "s3"} type
 * @param {{dir?: string, repo?: string, branch?: string | null, exec?: Function, endpoint?: string, bucket?: string, region?: string, env?: Record<string, string | undefined>, fetch?: Function, now?: () => Date}} options
 */
export function openSink(type, options = {}) {
  if (type === "local") return localSink(options.dir);
  if (type === "github") return githubSink(options);
  if (type === "gitlab") return gitlabSink(options);
  if (type === "s3") return s3Sink(options);
  throw new Error(`unknown sink type \`${type}\``);
}

/** The records folder on this machine: always on, never private to anyone but its owner. */
function localSink(dir) {
  const file = (path) => join(dir, path);
  return {
    name: "local",
    async list(prefix = "") {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith(".json") && name.startsWith(prefix))
        .sort();
    },
    async read(path) {
      try {
        return { status: "found", text: readFileSync(file(path), "utf8") };
      } catch (error) {
        return error?.code === "ENOENT"
          ? { status: "missing" }
          : { status: "error", detail: String(error?.code ?? error) };
      }
    },
    async create(path, text) {
      mkdirSync(dirname(file(path)), { recursive: true });
      try {
        writeFileSync(file(path), text, { flag: "wx" });
        return { status: "created" };
      } catch (error) {
        return error?.code === "EEXIST"
          ? { status: "exists" }
          : { status: "error", detail: String(error?.code ?? error) };
      }
    },
    async privacy() {
      return { private: true, visibility: "local" };
    },
    async access() {
      return null;
    },
  };
}

/**
 * `owner/name` or `host/owner/name`, as the config reader checked it. A
 * `gitlab` repo may sit in subgroups (`group/sub/name`), so its first segment
 * is a host only when it has a dot, and `owner` is the whole namespace.
 */
function splitSinkRepo(repo, type = "github") {
  const parts = repo.split("/");
  if (type === "gitlab") {
    const hosted = parts.length > 2 && parts[0].includes(".");
    const rest = hosted ? parts.slice(1) : parts;
    return {
      host: hosted ? parts[0] : "gitlab.com",
      owner: rest.slice(0, -1).join("/"),
      name: rest.at(-1),
    };
  }
  return parts.length === 3
    ? { host: parts[0], owner: parts[1], name: parts[2] }
    : { host: "github.com", owner: parts[0], name: parts[1] };
}

/** What a configured sink is called to the human: `owner/name`, or `s3://bucket`. */
const sinkLabel = (config) => (config.type === "s3" ? `s3://${config.bucket}` : config.repo);

/** Open the sink `records.sink` configures, with the transports `io` injects. */
function openConfigured(config, { exec, env, fetch, now }) {
  return openSink(config.type, {
    repo: config.repo,
    branch: config.branch,
    endpoint: config.endpoint,
    bucket: config.bucket,
    region: config.region,
    exec,
    env,
    fetch,
    now,
  });
}

const NOT_FOUND = /HTTP 404|"status":\s*"404"/;

/** A private GitHub repository, written with `gh api` Contents calls. */
function githubSink({ repo, branch = null, exec = defaultExec }) {
  const { host, owner, name } = splitSinkRepo(repo);
  const gh = (args, options) =>
    exec("gh", ["api", ...(host === "github.com" ? [] : ["--hostname", host]), ...args], options);
  const base = `repos/${owner}/${name}`;
  const contents = (path) =>
    `${base}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const detail = (r) => (r.err || r.out || `exit ${r.code}`).trim().split("\n")[0];
  return {
    name: repo,
    kind: "GitHub repository",
    async list(prefix = "") {
      const first = gh([`${base}/git/trees/${branch ?? "HEAD"}?recursive=1`]);
      if (first.code !== 0) return null;
      let body;
      try {
        body = JSON.parse(first.out);
      } catch {
        return null;
      }
      // A truncated recursive listing is walked level by level instead.
      const entries = body.truncated ? walkTree(gh, base, branch ?? "HEAD") : body.tree;
      if (entries === null) return null;
      return entries
        .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
        .map((entry) => entry.path)
        .sort();
    },
    async read(path) {
      const r = gh(["-H", "Accept: application/vnd.github.raw+json", `${contents(path)}${ref}`]);
      if (r.code === 0) return { status: "found", text: r.out };
      return NOT_FOUND.test(`${r.err}${r.out}`)
        ? { status: "missing" }
        : { status: "error", detail: detail(r) };
    },
    async create(path, text) {
      const body = {
        message: `Add Run Record ${basename(path, ".json")}`,
        content: Buffer.from(text, "utf8").toString("base64"),
        ...(branch ? { branch } : {}),
      };
      const r = gh(["-X", "PUT", contents(path), "--input", "-"], { input: JSON.stringify(body) });
      if (r.code === 0) return { status: "created" };
      const said = `${r.err}${r.out}`;
      if (/HTTP 409/.test(said)) return { status: "conflict" };
      // Contents refuses a create over an existing path with 422 (the sha it would need is missing).
      if (/HTTP 422/.test(said)) return { status: "exists" };
      return { status: "error", detail: detail(r) };
    },
    async privacy() {
      const r = gh(["--jq", ".visibility", base]);
      const visibility = r.code === 0 ? r.out.trim() : "";
      return visibility === ""
        ? { private: null, visibility: null }
        : { private: visibility === "private", visibility };
    },
    async access() {
      const r = gh(["--paginate", "--jq", ".[].login", `${base}/collaborators`]);
      return r.code === 0 ? r.out.split(/\r?\n/).filter(Boolean).length : null;
    },
  };
}

/** A GitLab 404: `glab api` prints the status in its message, or the body's own. */
const GITLAB_NOT_FOUND = /HTTP 404|\b404 (?:[A-Za-z]+ )*Not Found/i;
/** The most pages a listing follows: a stop for a server that never runs out. */
const MAX_PAGES = 1000;

/**
 * A private GitLab project, written with `glab api` Repository Files calls.
 * `--hostname` is always passed: inside a clone, `glab api` otherwise sends the request to that clone's host.
 * GitLab does not document create-only, so `createOnly` reads the path before
 * every create. Pages are followed by hand until one comes back empty, since a
 * server may cap `per_page` below what was asked.
 */
function gitlabSink({ repo, branch = null, exec = defaultExec }) {
  const { host, owner, name } = splitSinkRepo(repo, "gitlab");
  const glab = (args, options) => exec("glab", ["api", "--hostname", host, ...args], options);
  const project = `projects/${encodeURIComponent(`${owner}/${name}`)}`;
  const file = (path) => `${project}/repository/files/${encodeURIComponent(path)}`;
  const detail = (r) => (r.err || r.out || `exit ${r.code}`).trim().split("\n")[0];
  const json = (r) => {
    if (r.code !== 0) return null;
    try {
      return JSON.parse(r.out);
    } catch {
      return null;
    }
  };
  /** Every item of a paginated list endpoint, or null when a page cannot be read. */
  const pages = (endpoint) => {
    const items = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const body = json(
        glab([`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`]),
      );
      if (!Array.isArray(body)) return null;
      if (body.length === 0) return items;
      items.push(...body);
    }
    return null;
  };
  // The Files API always wants a ref: the configured branch, else the project's default.
  let defaultBranch;
  const refOf = () => {
    if (branch) return branch;
    if (defaultBranch === undefined) defaultBranch = json(glab([project]))?.default_branch ?? null;
    return defaultBranch;
  };
  return {
    name: repo,
    kind: "GitLab project",
    async list(prefix = "") {
      const ref = refOf();
      if (ref === null) return null;
      const folder = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/")) : "";
      const query = `?recursive=true&ref=${encodeURIComponent(ref)}${folder ? `&path=${encodeURIComponent(folder)}` : ""}`;
      const tree = `${project}/repository/tree${query}`;
      let entries = pages(tree);
      if (entries === null) {
        // A folder that is not there yet is an empty listing, when the project itself can be read.
        const first = glab([`${tree}&per_page=100&page=1`]);
        if (!GITLAB_NOT_FOUND.test(`${first.err}${first.out}`) || json(glab([project])) === null)
          return null;
        entries = [];
      }
      return entries
        .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
        .map((entry) => entry.path)
        .sort();
    },
    async read(path) {
      const ref = refOf();
      if (ref === null)
        return { status: "error", detail: "the project's default branch cannot be read" };
      const r = glab([`${file(path)}/raw?ref=${encodeURIComponent(ref)}`]);
      if (r.code === 0) return { status: "found", text: r.out };
      return GITLAB_NOT_FOUND.test(`${r.err}${r.out}`)
        ? { status: "missing" }
        : { status: "error", detail: detail(r) };
    },
    async create(path, text) {
      const ref = refOf();
      if (ref === null)
        return { status: "error", detail: "the project's default branch cannot be read" };
      const body = {
        branch: ref,
        commit_message: `Add Run Record ${basename(path, ".json")}`,
        encoding: "base64",
        content: Buffer.from(text, "utf8").toString("base64"),
      };
      const r = glab(
        ["-X", "POST", "-H", "Content-Type: application/json", file(path), "--input", "-"],
        {
          input: JSON.stringify(body),
        },
      );
      if (r.code === 0) return { status: "created" };
      const said = `${r.err}${r.out}`;
      if (/already exists/i.test(said)) return { status: "exists" };
      if (/\b409\b/.test(said)) return { status: "conflict" };
      return { status: "error", detail: detail(r) };
    },
    async privacy() {
      const body = json(glab([project]));
      const visibility = typeof body?.visibility === "string" ? body.visibility : "";
      return visibility === ""
        ? { private: null, visibility: null }
        : { private: visibility === "private", visibility };
    },
    async access() {
      const members = pages(`${project}/members/all`);
      return members === null ? null : members.length;
    },
  };
}

// --- SigV4, from `node:crypto`: what an S3-compatible store checks on every request.

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
/** RFC 3986 percent-encoding, as SigV4 wants it: only `A-Za-z0-9-_.~` stay as they are. */
const uriEncode = (text) =>
  encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Sign one request with AWS Signature Version 4 and return the headers to send
 * (never `host`: `fetch` sets it) with the pieces a test can check. The path is
 * encoded once, as S3 and its compatibles expect; `s3: true` adds the
 * `x-amz-content-sha256` header they require, and signs it.
 *
 * @param {{method: string, url: string, headers?: Record<string, string>, body?: string, region: string, service?: string, s3?: boolean, accessKeyId: string, secretAccessKey: string, now: Date}} request
 */
export function signRequest({
  method,
  url,
  headers = {},
  body = "",
  region,
  service = "s3",
  s3 = true,
  accessKeyId,
  secretAccessKey,
  now,
}) {
  const target = new URL(url);
  const stamp = now.toISOString().replace(/[-:]|\.\d+/g, "");
  const day = stamp.slice(0, 8);
  const payload = sha256(body);
  const all = { host: target.host, "x-amz-date": stamp };
  for (const [name, value] of Object.entries(headers))
    all[name.toLowerCase()] = String(value).trim().replace(/\s+/g, " ");
  if (s3) all["x-amz-content-sha256"] = payload;
  const names = Object.keys(all).sort();
  const path = target.pathname
    .split("/")
    .map((segment) => uriEncode(decodeURIComponent(segment)))
    .join("/");
  const query = [...target.searchParams]
    .map(([k, v]) => [uriEncode(k), uriEncode(v)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    method,
    path,
    query,
    ...names.map((name) => `${name}:${all[name]}`),
    "",
    signedHeaders,
    payload,
  ].join("\n");
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonicalRequest)].join("\n");
  const key = [day, region, service, "aws4_request"].reduce(
    (k, part) => hmac(k, part),
    `AWS4${secretAccessKey}`,
  );
  const signature = createHmac("sha256", key).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const { host: _host, ...send } = all;
  return {
    headers: { ...send, authorization },
    authorization,
    canonicalRequest,
    stringToSign,
    signature,
  };
}

export const S3_KEY_ID = "ORCHESTRATE_S3_ACCESS_KEY_ID";
export const S3_SECRET = "ORCHESTRATE_S3_SECRET_ACCESS_KEY";

/** A listed key, url-decoded; a store that ignored `encoding-type=url` may hold a literal `%`. */
const unescapeKey = (key) => {
  try {
    return decodeURIComponent(key.replace(/\+/g, " "));
  } catch {
    return key;
  }
};

/** A `<Code>` from an S3 error body: what the store said, never the body itself. */
const s3Code = (text) => /<Code>([A-Za-z0-9]+)<\/Code>/.exec(text)?.[1] ?? null;
const xmlText = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * An S3-compatible bucket, addressed path-style (`<endpoint>/<bucket>/<key>`,
 * which every store accepts) and signed with SigV4. Credentials come only from
 * the environment. Requests go through `fetch`, which a test replaces.
 *
 * `create` sends `If-None-Match: *`, so a store that honours it refuses an
 * overwrite on its own; `createOnly` reads the path first for the stores that
 * ignore it. Privacy has no single read on S3-compatible stores, so it is
 * tested the way a stranger would: the bucket must answer a signed request and
 * must refuse an unsigned listing.
 */
function s3Sink({
  endpoint,
  bucket,
  region,
  env = {},
  fetch = globalThis.fetch,
  now = () => new Date(),
}) {
  const accessKeyId = env[S3_KEY_ID];
  const secretAccessKey = env[S3_SECRET];
  const base = String(endpoint).replace(/\/+$/, "");
  const url = (key, query = {}) => {
    const path = `/${[bucket, ...(key ? key.split("/") : [])].map(uriEncode).join("/")}`;
    const text = Object.entries(query)
      .map(([k, v]) => `${uriEncode(k)}=${uriEncode(String(v))}`)
      .join("&");
    return `${base}${path}${text ? `?${text}` : ""}`;
  };
  const request = async (method, key, { query, headers = {}, body = "", signed = true } = {}) => {
    const target = url(key, query);
    let send = { ...headers };
    if (signed)
      send = signRequest({
        method,
        url: target,
        headers,
        body,
        region,
        accessKeyId,
        secretAccessKey,
        now: now(),
      }).headers;
    try {
      const response = await fetch(target, {
        method,
        headers: send,
        ...(body === "" ? {} : { body }),
      });
      return { status: response.status, text: await response.text() };
    } catch (error) {
      return { status: 0, text: "", detail: String(error?.message ?? error) };
    }
  };
  const detail = (r) =>
    r.status === 0
      ? `the request failed (${r.detail})`
      : `HTTP ${r.status}${s3Code(r.text) ? ` ${s3Code(r.text)}` : ""}`;
  const missing = !accessKeyId || !secretAccessKey;
  return {
    name: `s3://${bucket}`,
    kind: "S3 bucket",
    /** What to tell the human when the credentials are not in the environment, else null. */
    problem: missing
      ? `set ${S3_KEY_ID} and ${S3_SECRET} in the environment (they are read from nowhere else)`
      : null,
    async list(prefix = "") {
      if (missing) return null;
      const out = [];
      let token = null;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const r = await request("GET", "", {
          query: {
            "list-type": 2,
            "encoding-type": "url",
            prefix,
            ...(token ? { "continuation-token": token } : {}),
          },
        });
        if (r.status !== 200) return null;
        for (const m of r.text.matchAll(/<Key>([\s\S]*?)<\/Key>/g))
          out.push(unescapeKey(xmlText(m[1])));
        if (!/<IsTruncated>true<\/IsTruncated>/.test(r.text)) return out.sort();
        token = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(r.text)?.[1];
        if (!token) return null;
        token = xmlText(token);
      }
      return null;
    },
    async read(path) {
      if (missing) return { status: "error", detail: this.problem };
      const r = await request("GET", path);
      if (r.status === 200) return { status: "found", text: r.text };
      return r.status === 404 ? { status: "missing" } : { status: "error", detail: detail(r) };
    },
    async create(path, text, { contentType = "application/json" } = {}) {
      if (missing) return { status: "error", detail: this.problem };
      const r = await request("PUT", path, {
        headers: { "content-type": contentType, "if-none-match": "*" },
        body: text,
      });
      if (r.status >= 200 && r.status < 300) return { status: "created" };
      if (r.status === 412) return { status: "exists" };
      if (r.status === 409) return { status: "conflict" };
      return { status: "error", detail: detail(r) };
    },
    async privacy() {
      const unknown = { private: null, visibility: null };
      if (missing) return unknown;
      const head = await request("HEAD", "");
      if (head.status !== 200) return unknown;
      const stranger = await request("GET", "", {
        query: { "list-type": 2, "max-keys": 1 },
        signed: false,
      });
      if (stranger.status === 200) return { private: false, visibility: "public" };
      return stranger.status === 401 || stranger.status === 403
        ? { private: true, visibility: "private" }
        : unknown;
    },
    async access() {
      // S3 has no list of the people who can read a bucket: the disclosure leaves the count out.
      return null;
    },
    /** The bucket's lifecycle rules as the store's XML: the seam raw-folder upload reads. */
    async lifecycle() {
      if (missing) return { status: "error", detail: this.problem };
      const r = await request("GET", "", { query: { lifecycle: "" } });
      if (r.status === 200) return { status: "found", xml: r.text };
      return r.status === 404 ? { status: "missing" } : { status: "error", detail: detail(r) };
    },
  };
}

/** Every blob under a tree, read one level at a time. Null when a level cannot be read. */
function walkTree(gh, base, sha, prefix = "") {
  const r = gh([`${base}/git/trees/${sha}`]);
  if (r.code !== 0) return null;
  let body;
  try {
    body = JSON.parse(r.out);
  } catch {
    return null;
  }
  const out = [];
  for (const entry of body.tree) {
    const path = `${prefix}${entry.path}`;
    if (entry.type === "tree") {
      const below = walkTree(gh, base, entry.sha ?? entry.path, `${path}/`);
      if (below === null) return null;
      out.push(...below);
    } else out.push({ ...entry, path });
  }
  return out;
}

/**
 * The create-only rule for any sink: identical bytes at the path count as
 * already uploaded, different bytes stop the upload, and a conflict from
 * parallel writes is retried (the next read decides again).
 */
async function createOnly(sink, path, text, tries = 4, options = undefined) {
  let last = "";
  for (let n = 0; n < tries; n += 1) {
    const there = await sink.read(path);
    if (there.status === "error") return { status: "error", detail: there.detail };
    if (there.status === "found") return { status: there.text === text ? "already" : "different" };
    const made = await sink.create(path, text, options);
    if (made.status === "created") return { status: "created" };
    if (made.status === "error") return { status: "error", detail: made.detail };
    last = made.status;
  }
  return {
    status: "error",
    detail: `still ${last === "conflict" ? "a 409 conflict" : "in conflict"} after ${tries} tries`,
  };
}

// --- Uploading a closed run's Run Record.

const RECORD_KEPT = "It is kept indefinitely (git cannot expire it).";
const RECORD_KEPT_S3 =
  "It is kept until the bucket's own rule deletes it, and indefinitely when it has none.";

/** The namespaced sink path: `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, every segment lowercased; `<owner>` may be a GitLab group and its subgroups. */
function sinkPath(repository, login, runId) {
  const segments = [...repository.split("/"), login, runId].map(segmentOf);
  return repository.split("/").length >= 3 && segments.every(Boolean)
    ? `records/${segments.join("/")}.json`
    : null;
}

async function upload(args, io) {
  const yes = args.includes("--yes");
  const rest = args.filter((a) => a !== "--yes");
  if (rest.length !== 1 || rest[0].startsWith("--")) return { code: 2, out: UPLOAD_USAGE };
  const cwd = io.cwd ?? process.cwd();

  // The config: a problem in it is named, and nothing is uploaded.
  const read = (path) => {
    try {
      return readFileSync(resolve(cwd, path), "utf8");
    } catch {
      return null;
    }
  };
  const loaded = readConfig(read);
  if (loaded.problems.length) return { code: 1, out: `${loaded.problems.join("\n")}\n` };
  const { records, run_dir: runDir } = effectiveConfig(loaded.config);

  // Find the record: by id under the run folder, or beside a run folder given by path.
  const arg = rest[0];
  const asPath = arg.includes("/");
  const runId = asPath ? basename(resolve(cwd, arg)) : arg;
  const recordsDir = asPath
    ? join(dirname(resolve(cwd, arg)), "records")
    : resolve(cwd, runDir, "records");
  const local = openSink("local", { dir: recordsDir });
  const found = ID.test(runId) ? await local.read(`${runId}.json`) : { status: "missing" };
  if (found.status !== "found")
    return {
      code: 1,
      out: `no Run Record for \`${runId}\` in ${recordsDir}: derive it at close-out (\`records.mjs derive <run-folder>\`)\n`,
    };
  let record;
  try {
    record = JSON.parse(found.text);
  } catch {
    return { code: 1, out: `the Run Record for \`${runId}\` is not JSON: nothing uploaded\n` };
  }
  // The safe-field check runs again at upload: a record edited since it was derived is refused.
  const unsafe = checkRecord(record);
  if (unsafe.length) return { code: 1, out: `${unsafe.join("\n")}\nnothing uploaded\n` };

  if (records.sink === null)
    return {
      code: 1,
      out: `no \`records.sink\` in the config: the Run Record stays at ${join(recordsDir, `${runId}.json`)}\n`,
    };

  const login = record.run.operator;
  if (login === null)
    return {
      code: 1,
      out: "no tracker login: nothing is uploaded under no name. Sign in with `gh`, or set ORCHESTRATE_OPERATOR, and derive the record again\n",
    };
  const exec = io.exec ?? defaultExec;
  const repository = (
    records.repository ??
    record.run.repo ??
    repoOf({ ...io, exec })
  )?.toLowerCase();
  if (!repository) {
    return {
      code: 3,
      out: "cannot tell which repository this run belongs to: there are several remotes and none is `origin`, or there is no remote. Ask which one, then pin it as `records.repository`\n",
    };
  }
  const path = sinkPath(repository, login, record.run.id);
  if (path === null)
    return {
      code: 1,
      out: `\`${repository}\` is not a \`host/owner/repo\` name: nothing uploaded\n`,
    };

  const sink = openConfigured(records.sink, {
    exec,
    env: io.env ?? process.env,
    fetch: io.fetch,
    now: io.now,
  });
  const where = sinkLabel(records.sink);
  if (sink.problem) return { code: 1, out: `\`${where}\`: ${sink.problem}: nothing uploaded\n` };

  // The privacy check, at every upload: visibility can change, and there is no override.
  const privacy = await sink.privacy();
  if (privacy.private === null)
    return {
      code: 1,
      out: `cannot read whether \`${where}\` is private: nothing uploaded\n`,
    };
  if (!privacy.private)
    return {
      code: 1,
      out: `\`${where}\` is not private (${privacy.visibility}): a Run Record is never uploaded to it, and there is no override. Nothing uploaded\n`,
    };

  const people = await sink.access();
  const access =
    people === null ? "" : `, ${people} ${people === 1 ? "person" : "people"} with access`;
  const steps = record.summary.human_steps;
  const disclosure = `**Upload this run's Run Record?** To \`${where}\` (private ${sink.kind}${access}) at \`${path}\`. It holds counts, ids, times, outcomes and ${steps} human ${steps === 1 ? "step" : "steps"} with their kind and cause: no issue text, no command output, no prose. ${records.sink.type === "s3" ? RECORD_KEPT_S3 : RECORD_KEPT} [Show the record] [Upload] [Not now]\n`;
  if (!yes) return { code: 0, out: `${disclosure}record: ${join(recordsDir, `${runId}.json`)}\n` };

  const done = await createOnly(sink, path, found.text);
  if (done.status === "error")
    return { code: 1, out: `${disclosure}upload failed: ${done.detail}\n` };
  if (done.status === "different")
    return {
      code: 1,
      out: `${disclosure}different bytes are already at \`${path}\` in \`${where}\`: the upload stopped and nothing was overwritten\n`,
    };
  const verb = done.status === "already" ? "already uploaded" : "uploaded";
  return { code: 0, out: `${disclosure}${verb} \`${path}\` to \`${where}\`\n` };
}

// --- Uploading a closed run's raw run folder, only to an `s3` bucket that expires it.

const RAW_ROOT = "raw/";

/**
 * The days after which the bucket's own lifecycle deletes everything under
 * `raw/`, read from the store's XML; null when no rule does. A rule counts
 * only when it is enabled, expires by age (`Expiration` with `Days`), and
 * covers all of `raw/`: no prefix, or a prefix `raw/` starts with, in the
 * legacy `Prefix`, `Filter/Prefix` or `Filter/And/Prefix` form. A rule with a
 * tag or size filter reaches only some objects, so it does not count. Of
 * several covering rules the shortest is quoted: that is when the folder is
 * surely gone.
 *
 * @param {string} xml
 * @returns {{days: number} | null}
 */
export function rawExpiry(xml) {
  let days = null;
  for (const [, rule] of String(xml).matchAll(/<Rule>([\s\S]*?)<\/Rule>/g)) {
    if (!/<Status>\s*Enabled\s*<\/Status>/.test(rule)) continue;
    const after = /<Expiration>[\s\S]*?<Days>\s*(\d+)\s*<\/Days>[\s\S]*?<\/Expiration>/.exec(rule);
    const n = after ? Number(after[1]) : 0;
    if (!(n >= 1)) continue;
    const filter = /<Filter>([\s\S]*?)<\/Filter>/.exec(rule)?.[1] ?? null;
    if (filter !== null && /<Tag>|<ObjectSize/.test(filter)) continue;
    const prefix =
      /<Prefix>([\s\S]*?)<\/Prefix>/.exec(
        filter ?? rule.replace(/<Expiration>[\s\S]*?<\/Expiration>/, ""),
      )?.[1] ?? "";
    if (!RAW_ROOT.startsWith(xmlText(prefix))) continue;
    days = days === null ? n : Math.min(days, n);
  }
  return days === null ? null : { days };
}

/** The namespaced raw prefix: `raw/<host>/<owner>/<repo>/<login>/<run-id>/`, every segment lowercased; `<owner>` may be a GitLab group and its subgroups. */
function rawPrefix(repository, login, runId) {
  const segments = [...repository.split("/"), login, runId].map(segmentOf);
  return repository.split("/").length >= 3 && segments.every(Boolean)
    ? `${RAW_ROOT}${segments.join("/")}/`
    : null;
}

/** `1.8 MB`, `9.1 kB`, `12 B`: decimal units, one place. */
function sizeText(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  return bytes < 1_000_000
    ? `${(bytes / 1000).toFixed(1)} kB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * Every regular file under a run folder, with its text, in path order. A link
 * is never followed (it could lead out of the folder) and is named instead.
 * A file that is not UTF-8 text is named too: the upload sends text only.
 */
function folderFiles(folder) {
  const files = [];
  const links = [];
  const binary = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const path = `${rel}${entry.name}`;
      if (entry.isSymbolicLink()) links.push(path);
      else if (entry.isDirectory()) walk(join(dir, entry.name), `${path}/`);
      else if (entry.isFile()) {
        const bytes = readFileSync(join(dir, entry.name));
        const text = bytes.toString("utf8");
        if (Buffer.from(text, "utf8").equals(bytes)) files.push({ path, text, size: bytes.length });
        else binary.push(path);
      }
    }
  };
  walk(folder, "");
  return { files, links, binary };
}

const listed = (names) => names.map((name) => `\`${name}\``).join(", ");

/**
 * `upload-raw <run> [--list] [--yes]`: the raw run folder, to the `s3` bucket
 * `records.raw.sink` names, and only when that bucket's own lifecycle expires
 * `raw/`. It reads the lifecycle and never writes it. Without `--yes` it
 * shows the disclosure line and writes nothing; the yes is the human's, given
 * at every close-out (never a routine write).
 */
async function uploadRaw(args, io) {
  const yes = args.includes("--yes");
  const list = args.includes("--list");
  const rest = args.filter((a) => a !== "--yes" && a !== "--list");
  if (rest.length !== 1 || rest[0].startsWith("--")) return { code: 2, out: UPLOAD_RAW_USAGE };
  const cwd = io.cwd ?? process.cwd();
  const read = (path) => {
    try {
      return readFileSync(resolve(cwd, path), "utf8");
    } catch {
      return null;
    }
  };
  const loaded = readConfig(read);
  if (loaded.problems.length) return { code: 1, out: `${loaded.problems.join("\n")}\n` };
  const { records, run_dir: runDir } = effectiveConfig(loaded.config);
  const target = records.raw.sink;
  if (target === null)
    return {
      code: 1,
      out: "no `records.raw.sink` in the config: raw run folders are never offered, and nothing is uploaded\n",
    };

  // The Run Record comes first: it names the login and the repository, and the close-out has already shown it.
  const arg = rest[0];
  const asPath = arg.includes("/");
  const runId = asPath ? basename(resolve(cwd, arg)) : arg;
  const folder = asPath ? resolve(cwd, arg) : resolve(cwd, runDir, runId);
  const recordsDir = asPath ? join(dirname(folder), "records") : resolve(cwd, runDir, "records");
  const found = ID.test(runId)
    ? await openSink("local", { dir: recordsDir }).read(`${runId}.json`)
    : { status: "missing" };
  if (found.status !== "found")
    return {
      code: 1,
      out: `no Run Record for \`${runId}\` in ${recordsDir}: derive it at close-out (\`records.mjs derive <run-folder>\`)\n`,
    };
  let record;
  try {
    record = JSON.parse(found.text);
  } catch {
    return { code: 1, out: `the Run Record for \`${runId}\` is not JSON: nothing uploaded\n` };
  }
  const login = record?.run?.operator ?? null;
  if (login === null)
    return {
      code: 1,
      out: "no tracker login: nothing is uploaded under no name. Sign in with `gh`, or set ORCHESTRATE_OPERATOR, and derive the record again\n",
    };
  const exec = io.exec ?? defaultExec;
  const repository = (
    records.repository ??
    record.run.repo ??
    repoOf({ ...io, exec })
  )?.toLowerCase();
  if (!repository)
    return {
      code: 3,
      out: "cannot tell which repository this run belongs to: there are several remotes and none is `origin`, or there is no remote. Ask which one, then pin it as `records.repository`\n",
    };
  const prefix = rawPrefix(repository, login, record.run.id);
  if (prefix === null)
    return {
      code: 1,
      out: `\`${repository}\` is not a \`host/owner/repo\` name: nothing uploaded\n`,
    };

  let tree;
  try {
    tree = folderFiles(folder);
  } catch {
    return { code: 1, out: `no run folder at ${folder}: nothing uploaded\n` };
  }
  if (tree.binary.length)
    return {
      code: 1,
      out: `${listed(tree.binary)} ${tree.binary.length === 1 ? "is" : "are"} not UTF-8 text: raw upload sends text files only. Nothing uploaded\n`,
    };
  const { files, links } = tree;

  const sink = openConfigured(target, {
    exec,
    env: io.env ?? process.env,
    fetch: io.fetch,
    now: io.now,
  });
  const where = sinkLabel(target);
  if (sink.problem) return { code: 1, out: `\`${where}\`: ${sink.problem}: nothing uploaded\n` };
  const privacy = await sink.privacy();
  if (privacy.private === null)
    return { code: 1, out: `cannot read whether \`${where}\` is private: nothing uploaded\n` };
  if (!privacy.private)
    return {
      code: 1,
      out: `\`${where}\` is not private (${privacy.visibility}): a raw run folder is never uploaded to it, and there is no override. Nothing uploaded\n`,
    };

  // The gate: the bucket's own rule must expire `raw/`. This only reads; the skill never writes bucket configuration.
  const lifecycle = await sink.lifecycle();
  if (lifecycle.status === "error")
    return {
      code: 1,
      out: `cannot read the lifecycle of \`${where}\`: ${lifecycle.detail}. A raw run folder is uploaded only to a bucket whose rule expires \`raw/\`: nothing uploaded\n`,
    };
  if (lifecycle.status === "missing")
    return {
      code: 1,
      out: `\`${where}\` has no lifecycle rule. A raw run folder is uploaded only to a bucket whose rule expires \`raw/\`: set one on the bucket (the skill never writes it). Nothing uploaded\n`,
    };
  const expiry = rawExpiry(lifecycle.xml);
  if (expiry === null)
    return {
      code: 1,
      out: `no enabled rule expires \`raw/\` in the lifecycle of \`${where}\`. A raw run folder is uploaded only to a bucket whose rule expires \`raw/\`: set one on the bucket (the skill never writes it). Nothing uploaded\n`,
    };

  const total = files.reduce((sum, file) => sum + file.size, 0);
  const count = `${files.length} ${files.length === 1 ? "file" : "files"}`;
  const disclosure = `**Also upload the raw run folder?** ${count}, ${sizeText(total)}, to bucket \`${target.bucket}\` at \`${prefix}\`. It **may quote private issue text, command output and file contents**. The bucket's own rule deletes it after about ${expiry.days} days. [List the files] [Upload] [Not now]\n`;
  const skipped = links.length
    ? `skipped ${links.length} ${links.length === 1 ? "link" : "links"}: ${listed(links)} (a link is never followed)\n`
    : "";
  if (list)
    return { code: 0, out: `${disclosure}${files.map((f) => f.path).join("\n")}\n${skipped}` };
  if (!yes) return { code: 0, out: `${disclosure}${skipped}` };

  let created = 0;
  let already = 0;
  for (const file of files) {
    const key = `${prefix}${file.path}`;
    const done = await createOnly(sink, key, file.text, 4, {
      contentType: "application/octet-stream",
    });
    if (done.status === "error")
      return {
        code: 1,
        out: `${disclosure}upload failed at \`${key}\`: ${done.detail} (${created + already} of ${files.length} done)\n`,
      };
    if (done.status === "different")
      return {
        code: 1,
        out: `${disclosure}different bytes are already at \`${key}\` in \`${where}\`: the upload stopped and nothing was overwritten (${created + already} of ${files.length} done)\n`,
      };
    if (done.status === "already") already += 1;
    else created += 1;
  }
  const verb =
    created === 0
      ? `already uploaded ${count}`
      : `uploaded ${created} ${created === 1 ? "file" : "files"}${already ? `, ${already} already there` : ""}`;
  return { code: 0, out: `${disclosure}${verb} to \`${where}\` at \`${prefix}\`\n${skipped}` };
}

// --- Pruning closed-out run folders, on opt-in.

/** Where a "no" to the close-out's prune ask is remembered: a file beside the run folders, never a folder. */
const PRUNE_DECLINED = "prune-declined";
const DAY_MS = 86_400_000;

/**
 * Delete the closed-out run folders older than `prune.after_days`, and
 * nothing else. A run folder is closed out when its Run Record sits beside it
 * in `records/` (derived at close-out) and names the same run; its age is the
 * record's `closed_at` against the clock. An open run has no record, so it
 * stays; `records/` and every file in the run directory stay; a link is
 * never followed. Without the key nothing is deleted.
 *
 * `--declined` records the human's "no" to the close-out ask, so it is not asked again.
 */
function prune(args, io) {
  const declined = args.includes("--declined");
  if (args.length > (declined ? 1 : 0)) return { code: 2, out: PRUNE_USAGE };
  const cwd = io.cwd ?? process.cwd();
  const read = (path) => {
    try {
      return readFileSync(resolve(cwd, path), "utf8");
    } catch {
      return null;
    }
  };
  const loaded = readConfig(read);
  if (loaded.problems.length) return { code: 1, out: `${loaded.problems.join("\n")}\n` };
  const { prune: setting, run_dir: runDir } = effectiveConfig(loaded.config);
  const base = resolve(cwd, runDir);

  if (declined) {
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, PRUNE_DECLINED), "declined at close-out; not asked again\n");
    return { code: 0, out: `recorded that pruning was declined: ${join(base, PRUNE_DECLINED)}\n` };
  }
  if (setting.after_days === null)
    return {
      code: 0,
      out: "pruning is off: set `prune.after_days` to turn it on. Nothing deleted\n",
    };
  if (!existsSync(base)) return { code: 0, out: "nothing to prune\n" };

  const now = new Date(io.now ? io.now() : Date.now()).getTime();
  const cutoff = now - setting.after_days * DAY_MS;
  if (!Number.isFinite(cutoff)) return { code: 1, out: "cannot read the clock: nothing deleted\n" };
  const deleted = [];
  let failed = null;
  for (const name of readdirSync(base).sort()) {
    if (name === "records" || !ID.test(name)) continue;
    const folder = join(base, name);
    if (!lstatSync(folder).isDirectory()) continue;
    const closed = closedAt(join(base, "records", `${name}.json`), name);
    if (closed === null || closed >= cutoff) continue;
    try {
      rmSync(folder, { recursive: true, force: true });
    } catch (error) {
      failed = `${name}: ${error?.code ?? error}`;
      break;
    }
    deleted.push(name);
  }
  const done = deleted.map((name) => `pruned ${name}`);
  if (failed) return { code: 1, out: `${[...done, `could not delete ${failed}`].join("\n")}\n` };
  if (deleted.length === 0) return { code: 0, out: "nothing to prune\n" };
  return {
    code: 0,
    out: `${done.join("\n")}\n${deleted.length} closed-out run ${deleted.length === 1 ? "folder" : "folders"} older than ${setting.after_days} days deleted; every Run Record kept\n`,
  };
}

/** When a run closed (ms), from its Run Record. Null when the record is missing, unreadable, another run's, or has no valid time. */
function closedAt(path, runId) {
  try {
    const record = JSON.parse(readFileSync(path, "utf8"));
    const closed = record?.run?.closed_at;
    if (record?.run?.id !== runId || typeof closed !== "string" || !ISO.test(closed)) return null;
    const time = Date.parse(closed);
    return Number.isNaN(time) ? null : time;
  } catch {
    return null;
  }
}

const plural = (n, one) => `${n} ${n === 1 ? one : `${one}s`}`;

// --- The past-runs dashboard, built from the local Run Records.
//
// The pages live in `pages/` (one shell, one stylesheet, the dashboard's page
// builder); this is the command that reads the records, writes the files and
// prints the links. It never opens a browser.

const SECRET_NAME = /TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_KEY/i;
const SECRET_SHAPES = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
];

/** Prose with every credential the environment holds, and the usual token shapes, replaced. */
function redact(text, env) {
  let out = text;
  for (const [name, value] of Object.entries(env))
    if (SECRET_NAME.test(name) && typeof value === "string" && value.length >= 8)
      out = out.split(value).join("[redacted]");
  for (const shape of SECRET_SHAPES) out = out.replace(shape, "[redacted]");
  return out;
}

/** Write a file whole or not at all: beside it first, then renamed over it. */
function writeWhole(path, text) {
  const beside = `${path}.${process.pid}.tmp`;
  writeFileSync(beside, text);
  renameSync(beside, path);
}

/**
 * The sink path of a record, parsed from the end: `records/<namespace>/<login>/<run-id>.json`,
 * where the namespace is `host/owner/repo`, or `host/<group>/…/<project>` for a GitLab subgroup.
 * Null when it does not parse.
 */
export function parseSinkPath(path) {
  const parts = path.split("/");
  if (parts.length < 6 || parts[0] !== "records" || !parts.at(-1).endsWith(".json")) return null;
  const file = parts.at(-1);
  const login = parts.at(-2);
  const namespace = parts.slice(1, -2);
  const id = file.slice(0, -".json".length);
  const named = [...namespace, login].every((s) => segmentOf(s) === s);
  const repository = namespace.join("/");
  if (!named || !plainRepository(repository) || !LOGIN.test(login) || !ID.test(id) || DOTS.test(id))
    return null;
  return { repository, login, id };
}

/** Where the dashboard keeps the records it fetched: a folder that mirrors the sink's paths. Null when the sink's name is not a safe folder name. */
function cacheFolder(runDir, sinkConfig) {
  if (sinkConfig.type === "s3") {
    // One folder per store and bucket, never mixed with a git sink's.
    const segments = [new URL(sinkConfig.endpoint).host.replace(/:/g, "_"), sinkConfig.bucket].map(
      segmentOf,
    );
    return segments.every(Boolean) ? join(runDir, "records-cache", "s3", ...segments) : null;
  }
  const { host, owner, name } = splitSinkRepo(sinkConfig.repo, sinkConfig.type);
  const segments = [host, ...owner.split("/"), name].map(segmentOf);
  if (!segments.every(Boolean)) return null;
  if (sinkConfig.branch) segments.push(`@${encodeURIComponent(sinkConfig.branch)}`);
  return join(runDir, "records-cache", ...segments);
}

/** A record's text, parsed and checked again. `{record}` or `{why}`. */
function checkedRecord(text) {
  try {
    const record = JSON.parse(text);
    const problems = checkRecord(record);
    return problems.length ? { why: `fails the safe-field check (${problems[0]})` } : { record };
  } catch {
    return { why: "is not JSON" };
  }
}

/**
 * Read the configured sink: its records, through the adapter every upload
 * uses, and the paths it skipped. Reads only paths the cache does not hold.
 * A sink that cannot be read is one warning and no records.
 */
async function readSink(sinkConfig, { cache, exec, env, fetch, now, current }) {
  const where = sinkLabel(sinkConfig);
  const out = { read: false, found: new Map(), skipped: [], warnings: [] };
  const sink = openConfigured(sinkConfig, { exec, env, fetch, now });
  if (sink.problem) {
    out.warnings.push(
      `could not read \`${where}\`: ${sink.problem}. The page is built from the local records only`,
    );
    return out;
  }
  // The privacy check runs before anything is listed or read; a sink turned public warns, and the read goes ahead.
  const privacy = await sink.privacy();
  // A bucket's privacy needs `ListBucket` on the whole bucket, which a reader limited to one prefix lacks:
  // on `s3` an unknown answer does not stop the read, and the list below decides whether the bucket is readable.
  const unchecked = privacy.private === null && sinkConfig.type === "s3";
  if (privacy.private === null && !unchecked) {
    out.warnings.push(
      `could not read \`${where}\`: it does not exist, you have no read access to it, or the call failed. The page is built from the local records only`,
    );
    return out;
  }
  if (privacy.private === false)
    out.warnings.push(
      `\`${where}\` is not private (${privacy.visibility}): its records are read anyway, but make it private`,
    );
  let listed = await sink.list("records/");
  if (listed === null && sinkConfig.type === "s3" && current) {
    // A bucket policy may allow only this repository's prefix: retry with it, and say what is not seen.
    const own = `records/${current}/`;
    listed = await sink.list(own);
    if (listed !== null)
      out.warnings.push(
        `could not list all of \`records/\` in \`${where}\`: only \`${own}\` was read. Other repositories in the bucket are not shown, and nothing is assumed about them`,
      );
  }
  if (listed === null) {
    out.warnings.push(
      `could not read \`${where}\`: its file list is not readable. The page is built from the local records only`,
    );
    return out;
  }
  if (unchecked)
    out.warnings.push(
      `\`${where}\`: whether it is private could not be checked (that needs \`ListBucket\` on the whole bucket): its records are read anyway`,
    );
  out.read = true;
  for (const path of listed) {
    const parsed = parseSinkPath(path);
    if (parsed === null) {
      out.skipped.push(path);
      continue;
    }
    const file = cache ? join(cache, ...path.split("/")) : null;
    let text = null;
    try {
      if (file && existsSync(file)) text = readFileSync(file, "utf8");
    } catch {
      text = null;
    }
    if (text === null) {
      const got = await sink.read(path);
      if (got.status !== "found") {
        out.warnings.push(
          `skipped ${path}: ${got.status === "missing" ? "gone from the sink" : `could not be read (${got.detail})`}`,
        );
        continue;
      }
      text = got.text;
      if (file)
        try {
          mkdirSync(dirname(file), { recursive: true });
          writeWhole(file, text);
        } catch {
          // A cache that cannot be written only costs the next build a fetch.
        }
    }
    out.found.set(path, { ...parsed, text });
  }
  return out;
}

/** The sink's records as an earlier build cached them, with no call to the sink. */
function cachedSink(sinkConfig, cache) {
  const out = { read: false, found: new Map(), skipped: [], warnings: [] };
  out.warnings.push(
    `the server reads no sink: records of \`${sinkLabel(sinkConfig)}\` are the copies an earlier build cached, if any. Run \`/orchestrate --dashboard\` to fetch new ones`,
  );
  let names = [];
  try {
    names = readdirSync(join(cache, "records"), { recursive: true });
  } catch {
    // No cache yet: the local records are all there is.
  }
  for (const name of names.sort()) {
    const path = `records/${String(name).replaceAll("\\", "/")}`;
    const parsed = parseSinkPath(path);
    if (parsed === null) continue;
    const text = readText(join(cache, ...path.split("/")));
    if (text !== null) out.found.set(path, { ...parsed, text });
  }
  return out;
}

/**
 * What a build shows, from the local records and the configured sink: the entries and the
 * render options, or `{problem}`, a command result. Writes no page. `offline` reads no sink:
 * it takes the records an earlier build cached.
 */
async function buildDashboard(io, { only = null, offline = false } = {}) {
  const cwd = io.cwd ?? process.cwd();
  const env = io.env ?? process.env;
  const exec = io.exec ?? defaultExec;

  const loaded = readConfig((path) => {
    try {
      return readFileSync(resolve(cwd, path), "utf8");
    } catch {
      return null;
    }
  });
  if (loaded.problems.length)
    return { problem: { code: 1, out: `${loaded.problems.join("\n")}\n` } };
  const { records, run_dir } = effectiveConfig(loaded.config);
  const runDir = resolve(cwd, run_dir);
  const recordsDir = join(runDir, "records");
  const current = (records.repository ?? repoOf({ ...io, exec }))?.toLowerCase() ?? null;

  // The local records, each checked again: a record edited since it was derived is skipped, never shown.
  const sink = openSink("local", { dir: recordsDir });
  const locals = [];
  const warnings = [];
  const seen = new Set();
  for (const name of await sink.list()) {
    const found = await sink.read(name);
    let checked = { why: "is not readable" };
    if (found.status === "found") {
      checked = checkedRecord(found.text);
      if (checked.record && seen.has(checked.record.run.id))
        checked = { why: "repeats a run id already shown" };
    }
    if (!checked.record) warnings.push(`skipped ${name}: ${checked.why}`);
    else {
      seen.add(checked.record.run.id);
      locals.push({ record: checked.record, text: found.text });
    }
  }

  // The configured sink, if any: one more place the same records may be.
  const configured = records.sink;
  let far = null;
  if (configured)
    far = offline
      ? cachedSink(configured, cacheFolder(runDir, configured))
      : await readSink(configured, {
          cache: cacheFolder(runDir, configured),
          exec,
          env,
          fetch: io.fetch,
          now: io.now,
          current,
        });
  warnings.push(...(far?.warnings ?? []));

  const entries = [];
  const inSink = new Set();
  for (const [path, got] of far?.found ?? []) {
    const checked = checkedRecord(got.text);
    if (!checked.record) {
      warnings.push(`skipped ${path}: ${checked.why}`);
      continue;
    }
    inSink.add(path);
    entries.push({
      record: checked.record,
      repository: got.repository,
      login: got.login,
      source: "sink",
      path,
    });
  }
  for (const { record, text } of locals) {
    const repository = recordRepository(records.repository, record, current);
    const login = record.run.operator;
    const path = repository && login ? sinkPath(repository, login, record.run.id) : null;
    const twin = path === null ? undefined : far?.found.get(path);
    if (twin) {
      // Identical bytes are one record. When they differ the sink's copy, already added, wins.
      if (twin.text !== text)
        warnings.push(
          `\`${path}\`: the local copy and the sink's copy differ; the sink's copy is shown`,
        );
      const shown = entries.find((e) => e.path === path);
      if (shown) shown.source = "both";
      continue;
    }
    entries.push({
      record,
      repository,
      login,
      source: "local",
      ...(far?.read ? { notUploaded: true } : {}),
    });
  }
  const skipped = far?.skipped ?? [];
  const lines = [...warnings, ...skipped.map((p) => `skipped ${p}: not a Run Record path`)];
  if (entries.length === 0)
    return {
      problem: {
        code: 1,
        out: `${lines.map((w) => `${w}\n`).join("")}no Run Records in ${recordsDir}${configured ? ` or in \`${sinkLabel(configured)}\`` : ""}: derive one at close-out (\`records.mjs derive <run-folder>\`)\n`,
      },
    };

  const namespaces = [...new Set(entries.map((e) => e.repository).filter(Boolean))].sort();
  if (only !== null && !namespaces.includes(only))
    return {
      problem: {
        code: 1,
        out: `${lines.map((w) => `${w}\n`).join("")}no Run Records for \`${only}\`. Repositories with records: ${namespaces.join(", ") || "none"}\n`,
      },
    };
  const home = only ?? (namespaces.includes(current) ? current : null);

  const script = fileURLToPath(import.meta.url);
  const shown = relative(cwd, script);
  const path = shown.startsWith("..") || isAbsolute(shown) ? script : shown;
  const node = `node ${/\s/.test(path) ? `"${path}"` : path} dashboard${only ? ` --repo ${only}` : ""}`;
  const slash = `/orchestrate --dashboard${only ? ` --repo ${only}` : ""}`;
  const builtAt = nowIso(io);
  const common = {
    vocabulary: { causes: CAUSES, stepKinds: STEP_KINDS },
    builtAt,
    warnings,
    skipped,
    home,
    sink: configured
      ? { name: sinkLabel(configured), read: far.read, ...(offline ? { cached: true } : {}) }
      : null,
  };

  return { entries, common, lines, locals, configured, far, runDir, env, rebuild: { slash, node } };
}

async function dashboard(args, io) {
  let localLogs = false;
  let only = null;
  for (let n = 0; n < args.length; n += 1) {
    if (args[n] === "--local-logs" && !localLogs) localLogs = true;
    else if (args[n] === "--repo" && only === null && args[n + 1] && !args[n + 1].startsWith("--"))
      only = args[(n += 1)].toLowerCase();
    else return { code: 2, out: DASHBOARD_USAGE };
  }
  if (only !== null && !REPO.test(only)) return { code: 2, out: DASHBOARD_USAGE };
  const built = await buildDashboard(io, { only });
  if (built.problem) return built.problem;
  const { entries, common, lines, locals, configured, far, runDir, env } = built;
  const { slash, node } = built.rebuild;
  const { renderDashboard } = await import("./pages/dashboard.mjs");
  mkdirSync(runDir, { recursive: true });

  const sharedFile = join(runDir, "dashboard.html");
  writeWhole(sharedFile, renderDashboard(entries, { ...common, rebuild: { slash, node } }));
  const links = [pathToFileURL(sharedFile).href];

  if (localLogs) {
    // Prose only for a run whose folder, with its Activity Log, is still on this machine.
    const logs = {};
    for (const { record } of locals) {
      const file = join(runDir, record.run.id, "activity.md");
      if (existsSync(file)) logs[record.run.id] = redact(readFileSync(file, "utf8"), env);
    }
    const localFile = join(runDir, "dashboard.local.html");
    writeWhole(
      localFile,
      renderDashboard(entries, {
        ...common,
        rebuild: { slash: `${slash} --local-logs`, node: `${node} --local-logs` },
        banner: "contains private prose from this machine, don't share this file",
        logs,
      }),
    );
    links.push(pathToFileURL(localFile).href);
  }

  const from = far?.read ? ` (local and \`${sinkLabel(configured)}\`)` : "";
  return {
    code: 0,
    out: `${lines.map((w) => `${w}\n`).join("")}built the dashboard from ${plural(entries.length, "Run Record")}${from}${localLogs ? "; the prose is only in the .local file, which holds private prose from this machine: do not share it" : ""}\n${links.join("\n")}\n`,
  };
}

// --- The live run board, written beside `board.md` each time the Chief of Staff rewrites it.
//
// The page is built from the run folder alone: the Run Events, `board.md`'s
// State column, the Ruling Ledger and the Activity Logs. It never reads a
// sink or the tracker, and it is never hosted. The Activity Logs are private
// prose, so they are redacted as the dashboard's local page redacts them, and
// the page says it holds them.

/** The Activity Log's tail: a long log would make the page slow, and the drawer shows what is recent. */
const LOG_CHARS = 60_000;

/** The State column of `board.md`, by Delegation id. */
export function boardStates(text) {
  const states = {};
  let columns = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) {
      columns = null;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
    if (columns === null) {
      columns = cells[0] === "Delegation" && cells.includes("State") ? cells.indexOf("State") : -1;
      continue;
    }
    if (columns < 0 || cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const id = cells[0];
    const given = cells[columns]?.replace(/`/g, "").trim();
    if (ID.test(id) && given) states[id] = given;
  }
  return states;
}

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * `<run-folder> [--heartbeat <minutes|none>]`, and the flags `extra` names. Null on anything else.
 * With no `--heartbeat`, `heartbeat` is undefined, and `buildBoard` takes the board page's default.
 */
function boardArgs(args, extra = []) {
  const out = { folder: null, heartbeat: undefined };
  const seen = new Set();
  for (let n = 0; n < args.length; n += 1) {
    const flag = args[n];
    const value = args[n + 1];
    if (flag.startsWith("--")) {
      if (value === undefined || value.startsWith("--") || seen.has(flag)) return null;
      seen.add(flag);
      n += 1;
      if (flag === "--heartbeat" && value === "none") out.heartbeat = null;
      else if (flag === "--heartbeat" && /^[1-9]\d{0,3}$/.test(value))
        out.heartbeat = Number(value);
      else if (extra.includes(flag)) out[flag.slice(2)] = value;
      else return null;
    } else if (out.folder === null) out.folder = flag;
    else return null;
  }
  return out.folder === null ? null : out;
}

/**
 * The board of a run folder as HTML: `{model, html}`, or `{problems}` with its events.
 * `dashboard` is where a closed run's link goes, and `live` is set by the server alone.
 */
async function buildBoard(
  runFolder,
  io,
  { heartbeat: given, dashboard = "../dashboard.html", live = null },
) {
  const cwd = io.cwd ?? process.cwd();
  const env = io.env ?? process.env;
  const { events, problems } = readEvents(runFolder);
  if (problems.length) return { problems };

  const opened = events.find((e) => e.kind === "run-opened");
  if (opened && !opened.repo) opened.repo = repoOf({ ...io, exec: io.exec ?? defaultExec });

  const { HEARTBEAT_MINUTES, boardModel, parseLedger, renderBoard } =
    await import("./pages/board.mjs");
  const heartbeat = given === undefined ? HEARTBEAT_MINUTES : given;
  const { qualifiedSlug } = await import("./pages/dashboard.mjs");
  const stateText = readText(join(runFolder, "board.md"));
  const ledgerText = readText(join(runFolder, "rulings.md"));
  const model = boardModel({
    events,
    now: (io.now ? io.now() : new Date()).valueOf(),
    states: stateText === null ? {} : boardStates(stateText),
    ledger: ledgerText === null ? null : parseLedger(redact(ledgerText, env)),
    heartbeatMinutes: heartbeat,
  });
  const runId = basename(runFolder);
  model.run.id = runId;

  // Prose comes only from this run folder, never leaves it, and has no credential in it.
  const logs = {};
  const own = readText(join(runFolder, "activity.md"));
  if (own !== null) logs.run = redact(own, env).slice(-LOG_CHARS);
  for (const d of model.delegations) {
    const text = readText(join(runFolder, "delegations", d.id, "activity.md"));
    if (text !== null) logs[d.id] = redact(text, env).slice(-LOG_CHARS);
  }

  // The Shared Board is the spec issue's comments: the board links to it, never copies it.
  const { run } = model;
  const sharedBoardHref =
    run.team && run.repo && run.spec
      ? `https://${run.repo}/${run.tracker === "gitlab" ? "-/" : ""}issues/${run.spec}`
      : null;
  const script = fileURLToPath(import.meta.url);
  const shown = relative(cwd, script);
  const scriptPath = shown.startsWith("..") || isAbsolute(shown) ? script : shown;
  const folderPath = relative(cwd, runFolder) || ".";
  const quote = (text) => (/\s/.test(text) ? `"${text}"` : text);
  const html = renderBoard(model, {
    builtAt: nowIso(io),
    // `--status` writes nothing, so the one command that rewrites this page is `board`.
    rebuild: `node ${quote(scriptPath)} board ${quote(folderPath)}${heartbeat === HEARTBEAT_MINUTES ? "" : ` --heartbeat ${heartbeat ?? "none"}`}`,
    logs,
    dashboardHref: `${dashboard}#/run/${dashboardSlug(runFolder, runId, cwd, model.run.repo, qualifiedSlug)}/summary`,
    sharedBoardHref,
    banner: "contains private prose from this machine, don't share this file",
    live,
  });
  return { model, html };
}

/** A local record's repository, as the dashboard and the board's link read it: pinned, else the record's, else the remote's. */
const recordRepository = (pinned, record, fallback) =>
  (pinned ?? record.run.repo ?? fallback)?.toLowerCase() ?? null;

/**
 * The run's key in the dashboard, made as the dashboard makes it for a local record: under its
 * repository (`records.repository`, else the record's) and login. That key resolves whatever other
 * runs share the id; a record with no login is under `-`, as the dashboard keys it. With no local
 * record yet, one with no `run`, or no repository, the run id alone.
 */
function dashboardSlug(runFolder, runId, cwd, repo, qualifiedSlug) {
  const text = readText(join(dirname(runFolder), "records", `${runId}.json`));
  let record = null;
  try {
    record = text === null ? null : JSON.parse(text);
  } catch {
    record = null;
  }
  if (!record?.run) return runId;
  const loaded = readConfig((path) => readText(resolve(cwd, path)));
  const pinned = loaded.problems.length ? null : effectiveConfig(loaded.config).records.repository;
  const repository = recordRepository(pinned, record, repo);
  return repository ? qualifiedSlug(repository, record.run.operator ?? null, runId) : runId;
}

async function board(args, io) {
  const given = boardArgs(args);
  if (!given) return { code: 2, out: BOARD_USAGE };
  const runFolder = resolve(io.cwd ?? process.cwd(), given.folder);
  if (!existsSync(runFolder)) return { code: 2, out: `no run folder at \`${given.folder}\`\n` };
  const { model, html, problems } = await buildBoard(runFolder, io, given);
  if (problems) return { code: 1, out: `${problems.join("\n")}\n` };
  const file = join(runFolder, "board.html");
  writeWhole(file, html);
  const waits = model.open.length;
  return {
    code: 0,
    out: `wrote the board: ${plural(model.delegations.length, "Delegation")}, ${waits} ${waits === 1 ? "wait" : "waits"} on you${model.stale ? ", stale" : ""}\n${pathToFileURL(file).href}\n`,
  };
}

// --- The optional server of the live run board.
//
// It binds to 127.0.0.1 only, polls the run's events files and pushes each new
// Run Event to the pages connected to it, over Server-Sent Events. It serves
// the board of this one run folder and, at `/dashboard`, the dashboard built
// from what is on this machine: it never reads a sink or the tracker. It
// answers only a request made to its own address, so another web page cannot
// reach it through a DNS name, and sends no CORS header, so no other origin
// can read what it serves.

/** How often the events files are read: a step shows within a second. */
const POLL_MS = 500;

/**
 * A reader of the events appended to a run folder: each call returns the checked events of the
 * whole lines written since the last one. A line still being written waits for its newline.
 */
function followEvents(runFolder) {
  const taken = new Map();
  return () => {
    const fresh = [];
    for (const file of eventFiles(runFolder)) {
      const text = readText(file);
      if (text === null) continue;
      const lines = text.split("\n").slice(0, -1);
      for (const line of lines.slice(taken.get(file) ?? 0)) {
        try {
          const event = JSON.parse(line);
          if (checkEvent(event).length === 0) fresh.push(event);
        } catch {
          // Not JSON: not pushed. The board's page names the line when it is loaded.
        }
      }
      taken.set(file, lines.length);
    }
    return fresh;
  };
}

async function serve(args, io) {
  const given = boardArgs(args, ["--port"]);
  const port = given?.port ?? "0";
  if (!given || !/^\d{1,5}$/.test(port) || Number(port) > 65535)
    return { code: 2, out: SERVE_USAGE };
  const runFolder = resolve(io.cwd ?? process.cwd(), given.folder);
  if (!existsSync(runFolder)) return { code: 2, out: `no run folder at \`${given.folder}\`\n` };
  const { renderDashboard } = await import("./pages/dashboard.mjs");
  const { esc } = await import("./pages/shell.mjs");

  // This server's own name: a page of an earlier one is told to reload.
  const session = randomUUID();
  const pushed = [];
  const clients = new Set();
  const follow = followEvents(runFolder);
  try {
    follow(); // What is there already is on the page: only what comes next is pushed.
  } catch (error) {
    return { code: 1, out: `could not read the run folder: ${error.message}\n` };
  }
  const file = join(runFolder, "board.html");
  const boardFile = pathToFileURL(file).href;
  const send = (client, name, data) =>
    client.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  const poll = () => {
    try {
      for (const event of follow()) {
        pushed.push(event);
        for (const client of clients) send(client, "run-event", event);
      }
    } catch {
      // A folder or file that went away between the listing and the read: the next poll sees it.
    }
  };

  const reply = (res, status, type, text) => {
    res.writeHead(status, {
      "content-type": `${type}; charset=utf-8`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(res.req.method === "HEAD" ? undefined : text);
  };
  // Tries again only while the server answers: a stopped server leaves this page, not the browser's error.
  const errorPage = (res, status, text) =>
    reply(
      res,
      status,
      "text/html",
      `<!doctype html>\n<meta charset="utf-8"><title>Run board</title><pre>${esc(text)}</pre>\n<p>If the server stops, the file board is <code>${esc(boardFile)}</code></p>\n<script>setInterval(async () => { try { if ((await fetch(location.href, { method: "HEAD", cache: "no-store" })).ok) location.reload(); } catch {} }, 5000);</script>\n`,
    );

  const stream = (req, res, query) => {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    if (req.method === "HEAD") return void res.end();
    res.write(": connected\n\n");
    poll();
    if (query.has("session") && query.get("session") !== session) send(res, "reload", {});
    else if (query.has("after"))
      for (const event of pushed.slice(Number(query.get("after")) || 0))
        send(res, "run-event", event);
    clients.add(res);
    res.on("close", () => clients.delete(res));
  };

  const answer = async (req, res) => {
    const own = server.address().port;
    if (![`127.0.0.1:${own}`, `localhost:${own}`].includes(req.headers.host))
      return reply(res, 403, "text/plain", "this server answers its own address only\n");
    if (req.method !== "GET" && req.method !== "HEAD")
      return reply(res, 405, "text/plain", "this server is read-only\n");
    const { pathname, searchParams } = new URL(req.url, "http://127.0.0.1");
    if (pathname === "/events") return stream(req, res, searchParams);
    if (pathname === "/") {
      // Read before the page is built, so an event appended meanwhile is pushed again, never lost.
      poll();
      const live = {
        session,
        seq: pushed.length,
        file: boardFile,
      };
      const built = await buildBoard(runFolder, io, {
        heartbeat: given.heartbeat,
        dashboard: "/dashboard",
        live,
      });
      if (built.problems) return errorPage(res, 500, built.problems.join("\n"));
      return reply(res, 200, "text/html", built.html);
    }
    if (pathname === "/dashboard") {
      const built = await buildDashboard(io, { offline: true });
      if (built.problem) return errorPage(res, 404, built.problem.out);
      const html = renderDashboard(built.entries, { ...built.common, rebuild: built.rebuild });
      return reply(res, 200, "text/html", html);
    }
    return reply(
      res,
      404,
      "text/plain",
      "not found: the board is at /, the dashboard at /dashboard\n",
    );
  };

  const server = createServer((req, res) => {
    answer(req, res).catch((error) => {
      if (res.headersSent) res.end();
      else errorPage(res, 500, String(error?.message ?? error));
    });
  });
  const failed = await new Promise((done) => {
    server.once("error", done);
    server.listen(Number(port), "127.0.0.1", () => done(null));
  });
  if (failed)
    return {
      code: 1,
      out:
        failed.code === "EADDRINUSE"
          ? `port ${port} is already in use: give another with --port, or none for a free one\n`
          : `could not start the server: ${failed.message}\n`,
    };

  const timer = setInterval(poll, io.pollMs ?? POLL_MS);
  // The served page falls back to board.html, so the run must have one. The Chief of Staff's own is left alone.
  if (!existsSync(file))
    try {
      const first = await buildBoard(runFolder, io, given);
      if (!first.problems) writeWhole(file, first.html);
    } catch {
      // A board that cannot be written now is still served; the Chief of Staff writes the file.
    }
  const { address, port: bound } = server.address();
  io.listening?.({ address, port: bound, url: `http://${address}:${bound}/` });
  await new Promise((done) => {
    if (io.signal?.aborted) done();
    else io.signal?.addEventListener("abort", done, { once: true });
  });
  clearInterval(timer);
  await new Promise((done) => {
    server.close(done);
    server.closeAllConnections();
  });
  return { code: 0, out: "stopped serving the board\n" };
}

/** The real transport: a command run to the end, its output and its error text. `options.input` goes to its stdin. */
function defaultExec(command, args, options = {}) {
  try {
    const out = execFileSync(command, args, {
      encoding: "utf8",
      input: options.input,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    return { code: 0, out, err: "" };
  } catch (error) {
    return {
      code: error?.status ?? 1,
      out: String(error?.stdout ?? ""),
      err: String(error?.stderr ?? ""),
    };
  }
}

/**
 * @param {string[]} argv the arguments after the script
 * @param {{now?: () => Date, cwd?: string, env?: Record<string, string | undefined>, exec?: (command: string, args: string[], options?: {input?: string}) => {code: number, out: string, err?: string}, signal?: AbortSignal, listening?: (at: {address: string, port: number, url: string}) => void, pollMs?: number}} [io]
 * @returns {Promise<{code: number, out: string}>}
 */
export async function main(argv, io = {}) {
  const [command, ...rest] = argv;
  if (command === "event") return appendEvent(rest, io);
  if (command === "derive") return derive(rest, io);
  if (command === "upload") return upload(rest, io);
  if (command === "upload-raw") return uploadRaw(rest, io);
  if (command === "prune") return prune(rest, io);
  if (command === "dashboard") return dashboard(rest, io);
  if (command === "board") return board(rest, io);
  if (command === "serve") return serve(rest, io);
  return { code: 2, out: USAGE };
}

const realOrSelf = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

if (process.argv[1] && realOrSelf(fileURLToPath(import.meta.url)) === realOrSelf(process.argv[1])) {
  const argv = process.argv.slice(2);
  const io = {};
  if (argv[0] === "serve") {
    // The server runs until the human stops it.
    const stop = new AbortController();
    for (const name of ["SIGINT", "SIGTERM"]) process.once(name, () => stop.abort());
    io.signal = stop.signal;
    io.listening = ({ url }) =>
      process.stdout.write(`serving the live board until stopped (Ctrl-C):\n${url}\n`);
  }
  const { code, out } = await main(argv, io);
  process.stdout.write(out);
  process.exitCode = code;
}
