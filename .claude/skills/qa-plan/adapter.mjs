// The QA config reader: one place that turns `qa.config.{yml,yaml,json}` into
// an object, for `qa-plan` and `manual-qa` alike (ADAPTER.md). It also holds
// the one reading of the plan format both skills share (ANATOMY.md):
// `validatePlan` is how `manual-qa` accepts a plan and `qa-plan` checks a
// draft, so the composer and the runner cannot read the format differently.
//
// ONE FILE, TWO SKILLS
//   `qa-plan` owns this file and `manual-qa` carries a byte-identical copy,
//   enforced by a contract test (DESIGN.md, "Two skills, one format"). Each
//   skill reads its own section and ignores the other's: `plan:` and
//   `hazards` are checked by `configProblems`, which `check --for plan` uses;
//   `run:` is checked by `runProblems`, which only `check --for run` uses, so
//   a mistake in one skill's section never stops the other skill.
//
// WHY A PARSER, AND WHY THIS SMALL
//   Both skills import only Node built-ins, and Node ships no YAML parser.
//   This reader takes JSON whole, and YAML only in the subset ADAPTER.md
//   documents. Anything outside that subset, any unknown key and any value of
//   the wrong shape is a **problem**, reported with its line, never a silent
//   default. The approach is copied from the `instruction-drift-audit` skill's
//   reader, not imported: a Portable skill carries everything it runs.
//
// THE YAML SUBSET
//   - block mappings and block sequences, indented with spaces; a sequence may
//     sit at its key's own indent (`suites:` then `- name: backend`);
//   - plain, single-quoted or double-quoted scalars;
//   - flow lists and flow mappings that open and close on one line, nested
//     freely (`{ name: api, surfaces: ["api/**"] }`, `[]`, `{}`);
//   - full-line `#` comments anywhere, and a trailing ` # comment`.
//   Every scalar is a string. Tabs, anchors, aliases, multi-line scalars,
//   escapes inside quotes and duplicate keys are outside it; JSON is the
//   dialect for anything the subset cannot say.
//
// CLI (run from the repository root; `--repo <dir>` points elsewhere)
//   node adapter.mjs check --for plan      config, problems, effective values, readiness
//   node adapter.mjs check --for run [--plan <file>]
//                                          the same for `run:`, against a plan's Run brief
//   node adapter.mjs plan [<file>]         a QA Plan (the file, or stdin) against ANATOMY.md
//   node adapter.mjs host <url> [--target stack|url] [--confirmed <host>]
//                                          whether a run may sign in at this address
//   node adapter.mjs hazards < files.txt   Hazard packs matching the changed paths
//   node adapter.mjs delivery [--label L]… where the plan goes, by `plan.publish`
//   node adapter.mjs render [--write] < answers.json
//                                          the config with the answers merged in
//   Each prints JSON (render prints the new file body, or writes it with --write)
//   and exits 1 on any problem, 2 on bad usage; `host` exits 0 when the run may
//   sign in, 1 on a stop, 3 when the QA person must confirm the host in chat.

import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Lookup order: the first file present is the config (ADAPTER.md). */
export const CONFIG_FILES = /** @type {const} */ ([
  "qa.config.yml",
  "qa.config.yaml",
  "qa.config.json",
]);

export const TOP_KEYS = /** @type {const} */ (["working_dir", "plan", "hazards", "run"]);
export const PLAN_KEYS = /** @type {const} */ (["base_ref", "suites", "publish", "tracker"]);
export const SUITE_KEYS = /** @type {const} */ (["name", "command", "junit", "surfaces"]);
export const PUBLISH_KEYS = /** @type {const} */ (["when_label", "default", "to", "label"]);
export const HAZARD_KEYS = /** @type {const} */ (["pack"]);
export const PUBLISH_TARGETS = /** @type {const} */ ([
  "working-copy",
  "tracker-issue",
  "pr-comment",
]);
export const TRACKERS = /** @type {const} */ (["github", "none"]);
export const RUN_KEYS = /** @type {const} */ ([
  "target",
  "surface",
  "stack",
  "accounts",
  "version_endpoint",
  "evidence",
]);
export const STACK_KEYS = /** @type {const} */ (["up", "migrate", "seed", "down"]);
export const ACCOUNT_KEYS = /** @type {const} */ (["print", "restore", "roles"]);
export const ROLE_KEYS = /** @type {const} */ (["id", "purpose"]);
export const EVIDENCE_KEYS = /** @type {const} */ (["upload"]);
export const TARGETS = /** @type {const} */ (["stack", "url"]);
export const SURFACES = /** @type {const} */ (["web", "desktop", "mobile", "api"]);

/** ADAPTER.md's defaults. `base_ref` and `suites` have none: the readiness check asks. */
export const DEFAULTS = Object.freeze({
  working_dir: "tmp/qa",
  publish: Object.freeze([Object.freeze({ default: true, to: "working-copy" })]),
  tracker: "none",
});

// ── YAML subset ─────────────────────────────────────────────────────────────

const KEY_LINE = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*?)|[ \t]*)$/;
const SEQUENCE_LINE = /^-(?:[ \t]|$)/;
const indentOf = (line) => line.text.length - line.text.trimStart().length;

/** Problems a plain scalar raises: the YAML features outside the subset. */
function plainProblems(value, problem) {
  if (value.startsWith("&") || value.startsWith("*"))
    problem(
      `\`${value[0]}\` (anchor or alias) is outside the YAML subset ADAPTER.md documents — ` +
        "write the config as JSON instead",
    );
  if (/^[|>][+-]?$/.test(value))
    problem("multi-line scalars are outside the YAML subset ADAPTER.md documents");
}

/**
 * One flow value starting at `text[i]`: a list, a mapping, a quoted or a
 * plain scalar. Plain scalars end at `,`, `]` or `}`; a mapping key also ends
 * at `:`.
 *
 * @returns {[unknown, number]} the value and the index after it
 */
function parseFlow(text, i, problem, stops = ",]}") {
  const skip = (j) => {
    while (j < text.length && /\s/.test(text[j])) j += 1;
    return j;
  };
  i = skip(i);
  const open = text[i];
  if (open === "[" || open === "{") {
    const close = open === "[" ? "]" : "}";
    const out = open === "[" ? [] : {};
    i = skip(i + 1);
    if (text[i] === close) return [out, i + 1];
    while (i < text.length) {
      if (open === "[") {
        const [item, next] = parseFlow(text, i, problem);
        out.push(item);
        i = skip(next);
      } else {
        const [key, afterKey] = parseFlow(text, i, problem, ":,}");
        i = skip(afterKey);
        if (text[i] !== ":") {
          problem(`expected \`key: value\` inside \`{…}\` after \`${key}\``);
          return [out, text.length];
        }
        const [value, next] = parseFlow(text, i + 1, problem);
        if (Object.hasOwn(out, String(key))) problem(`duplicate key \`${key}\``);
        out[String(key)] = value;
        i = skip(next);
      }
      if (text[i] === ",") {
        i = skip(i + 1);
        continue;
      }
      if (text[i] === close) return [out, i + 1];
      break;
    }
    problem(
      `a flow ${open === "[" ? "list" : "mapping"} must close on the same line with \`${close}\``,
    );
    return [out, text.length];
  }
  if (open === "'" || open === '"') {
    const end = text.indexOf(open, i + 1);
    if (end === -1) {
      problem(`unterminated ${open} quote`);
      return [text.slice(i + 1), text.length];
    }
    const quoted = text.slice(i + 1, end);
    // Real YAML reads `\` escapes inside "…"; this subset does not, so a
    // backslash there would be read differently from every other YAML tool.
    if (open === '"' && quoted.includes("\\"))
      problem(
        'escapes inside "…" are outside the YAML subset ADAPTER.md documents — ' +
          "use single quotes, or write the config as JSON",
      );
    return [quoted, end + 1];
  }
  let j = i;
  while (j < text.length && !stops.includes(text[j])) j += 1;
  const value = text.slice(i, j).trim();
  plainProblems(value, problem);
  if (value === "") problem("an empty value inside a flow collection");
  return [value, j];
}

/**
 * The value after `key:` or `- ` on one line.
 *
 * @param {string} raw
 * @param {(message: string) => void} problem
 */
function inlineValue(raw, problem) {
  const text = raw.trim();
  if (/^[[{'"]/.test(text)) {
    const [value, end] = parseFlow(text, 0, problem);
    const rest = text.slice(end);
    if (rest.trim() !== "" && !/^\s+#/.test(rest))
      problem(`unexpected text after the value: ${rest.trim()}`);
    return value;
  }
  const value = text.replace(/\s+#.*$/, "").trim();
  plainProblems(value, problem);
  return value;
}

/**
 * Parse the documented YAML subset, with no shape check.
 *
 * @param {string} text
 * @returns {{value: Record<string, unknown>, problems: string[], lines: Map<string, number>}}
 *   `lines` maps a key path (`plan.suites[0]`) to the line it starts on.
 */
export function parseYamlSubset(text) {
  const problems = [];
  const lines = [];
  const where = new Map();
  String(text)
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const no = index + 1;
      if (raw.trim() === "" || /^\s*#/.test(raw)) return;
      if (/^\s*\t/.test(raw)) {
        problems.push(`line ${no}: indented with a tab; use spaces`);
        return;
      }
      lines.push({ text: raw.replace(/\s+$/, ""), no });
    });

  let pos = 0;
  const at = (line, message) => problems.push(`line ${line.no}: ${message}`);

  function parseBlock(indent, path) {
    return SEQUENCE_LINE.test(lines[pos].text.trimStart())
      ? parseSequence(indent, path)
      : parseMapping(indent, {}, path);
  }

  /** The value of `key:`: inline on its line, or the block below it. */
  function valueFor(line, rest, indent, path) {
    if (rest !== undefined && rest !== "" && !/^#/.test(rest))
      return inlineValue(rest, (message) => at(line, message));
    const next = lines[pos];
    if (!next) return null;
    const nextIndent = indentOf(next);
    if (nextIndent > indent) return parseBlock(nextIndent, path);
    if (nextIndent === indent && SEQUENCE_LINE.test(next.text.trimStart()))
      return parseSequence(indent, path);
    return null;
  }

  function parseMapping(indent, map, path) {
    while (pos < lines.length) {
      const line = lines[pos];
      const lineIndent = indentOf(line);
      if (lineIndent < indent) break;
      if (lineIndent > indent) {
        at(line, "unexpected indentation");
        pos += 1;
        continue;
      }
      const body = line.text.slice(lineIndent);
      if (SEQUENCE_LINE.test(body)) break; // a sequence at the parent's indent
      const match = body.match(KEY_LINE);
      pos += 1;
      if (!match) {
        at(line, `expected \`key: value\`, found \`${body}\``);
        continue;
      }
      const [, key, rest] = match;
      const keyPath = path ? `${path}.${key}` : key;
      if (Object.hasOwn(map, key)) at(line, `duplicate key \`${key}\``);
      where.set(keyPath, line.no);
      map[key] = valueFor(line, rest, indent, keyPath);
    }
    return map;
  }

  function parseSequence(indent, path) {
    const items = [];
    while (pos < lines.length) {
      const line = lines[pos];
      const lineIndent = indentOf(line);
      const body = line.text.slice(lineIndent);
      if (lineIndent < indent) break;
      if (lineIndent > indent) {
        at(line, "unexpected indentation");
        pos += 1;
        continue;
      }
      if (!SEQUENCE_LINE.test(body)) break;
      pos += 1;
      const itemPath = `${path}[${items.length}]`;
      where.set(itemPath, line.no);
      const content = body.replace(/^-[ \t]*/, "");
      if (content === "") {
        const next = lines[pos];
        items.push(next && indentOf(next) > indent ? parseBlock(indentOf(next), itemPath) : null);
        continue;
      }
      const match = /^[[{'"]/.test(content) ? null : content.match(KEY_LINE);
      if (match) {
        // `- key: value` opens a mapping whose keys sit where `key` sits.
        const keyIndent = lineIndent + (body.length - content.length);
        const map = {};
        where.set(`${itemPath}.${match[1]}`, line.no);
        map[match[1]] = valueFor(line, match[2], keyIndent, `${itemPath}.${match[1]}`);
        items.push(parseMapping(keyIndent, map, itemPath));
        continue;
      }
      items.push(inlineValue(content, (message) => at(line, message)));
    }
    return items;
  }

  let value = {};
  if (lines.length) {
    if (indentOf(lines[0]) !== 0) at(lines[0], "the first key must start at column 1");
    if (SEQUENCE_LINE.test(lines[0].text.trimStart())) {
      at(lines[0], "the config must be a mapping, not a list");
      pos = lines.length;
    } else value = parseMapping(0, {}, "");
    while (pos < lines.length) {
      at(lines[pos], "unexpected indentation");
      pos += 1;
    }
  }
  return { value, problems, lines: where };
}

// ── Shapes ──────────────────────────────────────────────────────────────────

const isMapping = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStringList = (v) => Array.isArray(v) && v.every((item) => typeof item === "string");
const isTrue = (v) => v === true || v === "true";

/**
 * A checker that names each problem with its key path, and its line when the
 * source was YAML. A path with no line of its own (a value inside a flow
 * collection) takes the line of the nearest enclosing path that has one.
 */
function problemSink(lines) {
  const problems = [];
  const lineOf = (path) => {
    let p = path;
    while (p) {
      if (lines?.has(p)) return lines.get(p);
      const parent = p.replace(/(?:\.[^.[\]]+|\[\d+\])$/, "");
      if (parent === p) break;
      p = parent;
    }
    return undefined;
  };
  return {
    problems,
    add(path, message) {
      const line = lineOf(path);
      problems.push(`${line ? `line ${line}: ` : ""}\`${path}\`: ${message}`);
    },
  };
}

function unknownKeys(sink, map, path, known) {
  for (const key of Object.keys(map))
    if (!known.includes(key))
      sink.add(
        path ? `${path}.${key}` : key,
        `unknown key (ADAPTER.md documents: ${known.join(", ")})`,
      );
}

const present = (v) => v !== null && v !== undefined;

/** Repository-relative, forward slashes, never leaving the repository. */
const isRepoPath = (v) =>
  typeof v === "string" &&
  v !== "" &&
  !/^(?:[A-Za-z]:)?[\\/]/.test(v) &&
  !v.split(/[\\/]/).includes("..");

/**
 * Every problem in a parsed config. `run:` is accepted as it is: `manual-qa`
 * owns that section and checks it.
 *
 * @param {Record<string, unknown>} config
 * @param {Map<string, number>} [lines]
 * @returns {string[]}
 */
export function configProblems(config, lines) {
  const sink = problemSink(lines);
  sharedProblems(sink, config);

  const plan = config.plan;
  if (present(plan) && !isMapping(plan)) sink.add("plan", "expected a mapping");
  if (isMapping(plan)) planProblems(sink, plan);

  const hazards = config.hazards;
  if (present(hazards)) {
    if (!Array.isArray(hazards)) sink.add("hazards", "expected a list of `{ pack: <path> }`");
    else
      hazards.forEach((entry, n) => {
        const path = `hazards[${n}]`;
        if (!isMapping(entry)) return sink.add(path, "expected a mapping with a `pack` path");
        unknownKeys(sink, entry, path, HAZARD_KEYS);
        if (!isRepoPath(entry.pack))
          sink.add(`${path}.pack`, "expected a relative path inside the repository");
      });
  }
  return sink.problems;
}

/** The keys both skills read: the top level and `working_dir`. */
function sharedProblems(sink, config) {
  unknownKeys(sink, config, "", TOP_KEYS);
  const workingDir = config.working_dir;
  if (present(workingDir) && !isRepoPath(workingDir))
    sink.add("working_dir", "expected a relative path inside the repository");
}

function planProblems(sink, plan) {
  unknownKeys(sink, plan, "plan", PLAN_KEYS);

  if (present(plan.base_ref) && (typeof plan.base_ref !== "string" || plan.base_ref === ""))
    sink.add("plan.base_ref", "expected a git ref, such as `origin/main`");

  if (present(plan.tracker) && !TRACKERS.includes(plan.tracker))
    sink.add("plan.tracker", `expected one of: ${TRACKERS.join(", ")}`);

  if (present(plan.suites)) {
    if (!Array.isArray(plan.suites)) sink.add("plan.suites", "expected a list of suites");
    else {
      const names = new Set();
      plan.suites.forEach((suite, n) => {
        const path = `plan.suites[${n}]`;
        if (!isMapping(suite)) return sink.add(path, "expected a mapping");
        unknownKeys(sink, suite, path, SUITE_KEYS);
        for (const key of ["name", "command"])
          if (typeof suite[key] !== "string" || suite[key] === "")
            sink.add(`${path}.${key}`, "required: expected a string");
        if (typeof suite.name === "string") {
          if (names.has(suite.name))
            sink.add(`${path}.name`, `duplicate suite name \`${suite.name}\``);
          names.add(suite.name);
        }
        if (present(suite.junit) && !isRepoPath(suite.junit))
          sink.add(`${path}.junit`, "expected a relative path inside the repository");
        if (present(suite.surfaces) && !isStringList(suite.surfaces))
          sink.add(`${path}.surfaces`, "expected a list of globs");
      });
    }
  }

  if (present(plan.publish)) {
    if (!Array.isArray(plan.publish)) sink.add("plan.publish", "expected a list of rules");
    else {
      let defaultAt = -1;
      plan.publish.forEach((rule, n) => {
        const path = `plan.publish[${n}]`;
        if (!isMapping(rule)) return sink.add(path, "expected a mapping");
        unknownKeys(sink, rule, path, PUBLISH_KEYS);
        if (defaultAt !== -1)
          sink.add(
            path,
            `never reached: rule ${defaultAt} is a \`default\` rule, and the first match wins`,
          );
        const byLabel = present(rule.when_label);
        const byDefault = present(rule.default);
        if (byLabel && byDefault)
          sink.add(path, "give one of `when_label` or `default: true`, not both");
        else if (!byLabel && !byDefault) sink.add(path, "give a `when_label` or `default: true`");
        if (byLabel && (typeof rule.when_label !== "string" || rule.when_label === ""))
          sink.add(`${path}.when_label`, "expected a label name");
        if (byDefault && !isTrue(rule.default)) sink.add(`${path}.default`, "expected `true`");
        if (byDefault && !byLabel && isTrue(rule.default) && defaultAt === -1) defaultAt = n;
        if (!PUBLISH_TARGETS.includes(rule.to))
          sink.add(`${path}.to`, `required: expected one of: ${PUBLISH_TARGETS.join(", ")}`);
        if (present(rule.label)) {
          if (rule.to !== "tracker-issue")
            sink.add(`${path}.label`, "only a `tracker-issue` rule labels what it creates");
          else if (typeof rule.label !== "string" || rule.label === "")
            sink.add(`${path}.label`, "expected a label name");
        }
        if (
          PUBLISH_TARGETS.includes(rule.to) &&
          rule.to !== "working-copy" &&
          !present(plan.tracker)
        )
          sink.add(
            `${path}.to`,
            `\`${rule.to}\` needs \`plan.tracker\` set: \`github\`, or \`none\` to keep plans in the working copy`,
          );
      });
    }
  }
}

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
/** A role id goes into a shell command (`restore`'s `{id}`), so it is a plain word. */
const ROLE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
/** A path on the build's own host: `//host/…` and `/\\host/…` name another host. */
const ENDPOINT_PATH = /^\/(?![/\\])[^\s\\]*$/;
const UPLOAD = /^(?:none|gh-release:[A-Za-z0-9][A-Za-z0-9._/-]*)$/;

/**
 * Every problem `manual-qa` stops on: the keys both skills read, and the
 * `run:` section it owns. Kept apart from `configProblems`, so a mistake in
 * `run:` never stops `qa-plan` and one in `plan:` never stops `manual-qa`.
 *
 * @param {Record<string, unknown>} config
 * @param {Map<string, number>} [lines]
 * @returns {string[]}
 */
export function runProblems(config, lines) {
  const sink = problemSink(lines);
  sharedProblems(sink, config);
  const run = config.run;
  if (!present(run)) return sink.problems;
  if (!isMapping(run)) {
    sink.add("run", "expected a mapping");
    return sink.problems;
  }
  unknownKeys(sink, run, "run", RUN_KEYS);
  if (present(run.target) && !TARGETS.includes(run.target))
    sink.add("run.target", `expected one of: ${TARGETS.join(", ")}`);
  if (present(run.surface) && !SURFACES.includes(run.surface))
    sink.add("run.surface", `expected one of: ${SURFACES.join(", ")}`);

  if (present(run.stack)) {
    if (!isMapping(run.stack))
      sink.add("run.stack", "expected a mapping of `up`, `migrate`, `seed`, `down`");
    else {
      unknownKeys(sink, run.stack, "run.stack", STACK_KEYS);
      for (const key of STACK_KEYS)
        if (present(run.stack[key]) && !nonEmpty(run.stack[key]))
          sink.add(`run.stack.${key}`, "expected a command");
    }
  }

  if (present(run.accounts)) {
    const accounts = run.accounts;
    if (!isMapping(accounts))
      sink.add("run.accounts", "expected a mapping of `print`, `restore`, `roles`");
    else {
      unknownKeys(sink, accounts, "run.accounts", ACCOUNT_KEYS);
      if (present(accounts.print) && !nonEmpty(accounts.print))
        sink.add("run.accounts.print", "expected a command");
      if (present(accounts.restore)) {
        if (!nonEmpty(accounts.restore)) sink.add("run.accounts.restore", "expected a command");
        else if (!accounts.restore.includes("{id}"))
          sink.add("run.accounts.restore", "expected `{id}` where the role id goes");
      }
      if (present(accounts.roles)) {
        if (!Array.isArray(accounts.roles))
          sink.add(
            "run.accounts.roles",
            "expected a list of `{ id: <role>, purpose: <what it is for> }`",
          );
        else {
          const ids = new Set();
          accounts.roles.forEach((role, n) => {
            const path = `run.accounts.roles[${n}]`;
            if (!isMapping(role))
              return sink.add(path, "expected a mapping with `id` and `purpose`");
            unknownKeys(sink, role, path, ROLE_KEYS);
            if (typeof role.id !== "string" || !ROLE_ID.test(role.id))
              sink.add(`${path}.id`, "required: letters, digits, `_` and `-` only");
            else if (ids.has(role.id)) sink.add(`${path}.id`, `duplicate role \`${role.id}\``);
            else ids.add(role.id);
            if (!nonEmpty(role.purpose)) sink.add(`${path}.purpose`, "required: expected a string");
          });
        }
      }
    }
  }

  if (
    present(run.version_endpoint) &&
    !(nonEmpty(run.version_endpoint) && ENDPOINT_PATH.test(run.version_endpoint))
  )
    sink.add("run.version_endpoint", "expected a path on the build's own host, such as `/version`");

  if (present(run.evidence)) {
    if (!isMapping(run.evidence))
      sink.add("run.evidence", "expected a mapping, such as `{ upload: none }`");
    else {
      unknownKeys(sink, run.evidence, "run.evidence", EVIDENCE_KEYS);
      if (
        present(run.evidence.upload) &&
        !(typeof run.evidence.upload === "string" && UPLOAD.test(run.evidence.upload))
      )
        sink.add("run.evidence.upload", "expected `none` or `gh-release:<tag>`");
    }
  }
  return sink.problems;
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * Parse a config's text in the dialect its name says.
 *
 * @param {string} path
 * @param {string} text
 * @returns {{config: Record<string, unknown>, problems: string[], runProblems: string[]}}
 *   `problems` are what `qa-plan` stops on (`configProblems`), `runProblems`
 *   what `manual-qa` stops on (`runProblems`). A YAML syntax problem, or a
 *   file that does not parse, is in both.
 */
export function parseConfig(path, text) {
  if (path.endsWith(".json")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const problem = `not valid JSON: ${error instanceof Error ? error.message : error}`;
      return { config: {}, problems: [problem], runProblems: [problem] };
    }
    if (!isMapping(parsed)) {
      const problem = "the config must be a JSON object";
      return { config: {}, problems: [problem], runProblems: [problem] };
    }
    return { config: parsed, problems: configProblems(parsed), runProblems: runProblems(parsed) };
  }
  const { value, problems, lines } = parseYamlSubset(text);
  return {
    config: value,
    problems: [...problems, ...configProblems(value, lines)],
    runProblems: [...problems, ...runProblems(value, lines)],
  };
}

/**
 * Find and parse the config.
 *
 * @param {(path: string) => string | null | undefined} read a repository
 *   file's text, or null when it is not there
 * @returns {{path: string | null, config: Record<string, any>, problems: string[], runProblems: string[]}}
 *   `path` is null when the repository has no config: not an error, the
 *   readiness check says what to ask for.
 */
export function readQaConfig(read) {
  for (const path of CONFIG_FILES) {
    const text = read(path);
    if (text === null || text === undefined) continue;
    return { path, ...parseConfig(path, text) };
  }
  return { path: null, config: {}, problems: [], runProblems: [] };
}

/**
 * The values each step uses: the config's own, or ADAPTER.md's defaults.
 * Read a config with no problems; a key with a problem is not defaulted.
 *
 * @param {Record<string, any>} config
 */
export function effectiveConfig(config) {
  const plan = isMapping(config.plan) ? config.plan : {};
  return {
    working_dir: present(config.working_dir) ? config.working_dir : DEFAULTS.working_dir,
    plan: {
      base_ref: present(plan.base_ref) ? plan.base_ref : null,
      suites: Array.isArray(plan.suites) ? plan.suites : [],
      publish: Array.isArray(plan.publish) && plan.publish.length ? plan.publish : DEFAULTS.publish,
      tracker: present(plan.tracker) ? plan.tracker : DEFAULTS.tracker,
    },
    hazards: Array.isArray(config.hazards) ? config.hazards : [],
    run: present(config.run) ? config.run : null,
  };
}

/**
 * What `qa-plan` still needs before it composes. `needs` are asked for; a
 * `note` is said, and compose goes on.
 *
 * @param {{path: string | null, config: Record<string, any>, problems: string[]}} read
 * @returns {{ready: boolean, needs: string[], notes: string[]}}
 */
export function planReadiness({ path, config, problems }) {
  if (problems.length)
    return { ready: false, needs: ["a config with no problems: fix each one listed"], notes: [] };
  const needs = [];
  const notes = [];
  if (path === null) notes.push(`no ${CONFIG_FILES.join(" / ")} at the repository root`);
  const { plan } = effectiveConfig(config);
  if (!plan.base_ref)
    needs.push("plan.base_ref: the ref this pull request merges into, such as `origin/main`");
  if (!plan.suites.length)
    needs.push(
      "plan.suites: each test suite CI runs, with its `name`, the `command` that runs it, " +
        "the `junit` XML path it writes, and the `surfaces` globs it covers",
    );
  for (const suite of plan.suites)
    if (!present(suite.junit))
      notes.push(
        `suite \`${suite.name}\` has no \`junit\` path: what it proves is read from its exit code only, tagged [reconstructed]`,
      );
  return { ready: needs.length === 0, needs, notes };
}

/**
 * Where a plan goes: the first `plan.publish` rule that matches wins.
 * `tracker: none` keeps every plan in the working copy.
 *
 * @param {Record<string, any>} config a config with no problems
 * @param {{labels?: string[]}} subject the subject issue's labels
 * @returns {{to: string, label: string | null, rule: number | null, why: string}}
 */
export function pickDelivery(config, { labels = [] } = {}) {
  const { plan } = effectiveConfig(config);
  const rules = plan.publish;
  const index = rules.findIndex(
    (rule) =>
      isTrue(rule.default) ||
      // GitHub label names are case-insensitive.
      (present(rule.when_label) &&
        labels.some((label) => label.toLowerCase() === String(rule.when_label).toLowerCase())),
  );
  if (index === -1)
    return { to: "working-copy", label: null, rule: null, why: "no `plan.publish` rule matched" };
  const rule = rules[index];
  const ruleName = rules === DEFAULTS.publish ? "the default rule" : `plan.publish[${index}]`;
  if (plan.tracker === "none" && rule.to !== "working-copy")
    return {
      to: "working-copy",
      label: null,
      rule: rules === DEFAULTS.publish ? null : index,
      why: `${ruleName} says \`${rule.to}\`, but \`plan.tracker\` is \`none\``,
    };
  return {
    to: rule.to,
    label: rule.to === "tracker-issue" && present(rule.label) ? rule.label : null,
    rule: rules === DEFAULTS.publish ? null : index,
    why: isTrue(rule.default)
      ? `${ruleName} (default)`
      : `${ruleName}: label \`${rule.when_label}\``,
  };
}

const STACK_NEEDS = {
  up: "the command that starts the QA Stack",
  migrate: "the command that brings its database schema up to date",
  seed: "the command that creates the QA Accounts, idempotent and refusing any non-local database",
  down: "the command that stops what `up` started, and nothing else",
};

/**
 * What `manual-qa` still needs before it runs a plan, from the config and,
 * when one is given, the plan's Run brief. `needs` are asked for; a `note` is
 * said, and the run goes on.
 *
 * @param {{path: string | null, config: Record<string, any>, runProblems?: string[]}} read
 * @param {{brief: {target: string | null, surface: string | null, roles: string[]}} | null} [plan]
 *   a plan `validatePlan` read with no problems
 * @returns {{ready: boolean, needs: string[], notes: string[], run: {target: string | null, surface: string | null, roles: string[]}}}
 */
export function runReadiness({ path, config, runProblems: problems = [] }, plan = null) {
  const brief = plan?.brief ?? null;
  const run = isMapping(config.run) ? config.run : {};
  // A malformed entry is a `run:` problem, reported below; it declares no role.
  const declared = Array.isArray(run.accounts?.roles)
    ? run.accounts.roles.flatMap((role) =>
        isMapping(role) && typeof role.id === "string" ? [role.id] : [],
      )
    : [];
  const effective = {
    target: run.target ?? brief?.target ?? null,
    surface: run.surface ?? brief?.surface ?? null,
    roles: declared,
  };
  if (problems.length)
    return {
      ready: false,
      needs: ["a config with no problems in `run:`: fix each one listed"],
      notes: [],
      run: effective,
    };
  const needs = [];
  const notes = [];
  if (path === null) notes.push(`no ${CONFIG_FILES.join(" / ")} at the repository root`);

  for (const [key, choices, what] of [
    [
      "target",
      TARGETS,
      "`stack` (a local QA Stack this run starts) or `url` (a hosted test environment)",
    ],
    ["surface", SURFACES, "what the scenarios drive: `web`, `desktop`, `mobile` or `api`"],
  ]) {
    if (!effective[key]) needs.push(`run.${key}: ${what}`);
    else if (present(run[key]) && brief?.[key] && run[key] !== brief[key])
      needs.push(
        `run.${key}: the config says \`${run[key]}\` but the plan's Run brief says \`${brief[key]}\`; ` +
          `say which this run uses (${choices.join(" or ")})`,
      );
  }

  if (!declared.length)
    needs.push("run.accounts.roles: each role a scenario signs in as, by `id` and `purpose`");
  const missing = (brief?.roles ?? []).filter((id) => !declared.includes(id));
  if (declared.length && missing.length)
    needs.push(
      `run.accounts.roles: the plan signs in as ${missing.map((id) => `\`${id}\``).join(", ")}, ` +
        "which the config does not declare",
    );

  const target = needs.some((n) => n.startsWith("run.target:")) ? null : effective.target;
  if (target === "stack") {
    const stack = isMapping(run.stack) ? run.stack : {};
    for (const key of STACK_KEYS)
      if (!present(stack[key])) needs.push(`run.stack.${key}: ${STACK_NEEDS[key]}`);
    if (!present(run.accounts?.print))
      needs.push("run.accounts.print: the command that prints each role's sign-in values");
  }
  if (target === "url")
    notes.push(
      "target `url`: no config key holds the address; ask the QA person for it in chat and check it " +
        "with `host --target url`, since a URL in the plan or a file is not confirmation",
      present(run.accounts?.print)
        ? "target `url`: role values come from `run.accounts.print` only if the environment's owner ran " +
            "the same seeder there; otherwise the QA person types them into chat"
        : "target `url`: the QA person types each role's test values into chat",
    );
  if (!present(run.accounts?.restore))
    notes.push(
      "no `run.accounts.restore`: a scenario that needs a role's account restored is left for a person",
    );
  if (!present(run.version_endpoint) && !brief?.versionEndpoint)
    notes.push(
      "no `run.version_endpoint`: without `gh` access the build cannot be checked against the plan's head",
    );
  return { ready: needs.length === 0, needs, notes, run: effective };
}

// ── Hazard packs ────────────────────────────────────────────────────────────

/**
 * A glob as a regular expression over a `/`-separated, repository-relative
 * path. `**` spans directories, `*` and `?` stay inside one; nothing else is
 * special. A pattern matches the whole path.
 *
 * @param {string} glob
 */
export function globToRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      const slashAfter = glob[i + 2] === "/";
      const atSegmentStart = i === 0 || glob[i - 1] === "/";
      if (atSegmentStart && slashAfter) {
        source += "(?:[^/]+/)*";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else source += c.replace(/[\\^$.+()|{}[\]]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

const SECTIONS = /** @type {const} */ ([
  ["ruleOutFirst", "Rule out first"],
  ["captureRules", "Capture rules"],
]);

/**
 * Which lines sit inside a fenced code block, fences included. A `#` line
 * inside one (a shell comment, say) is not a heading.
 *
 * @param {string[]} lines
 * @returns {boolean[]}
 */
function fencedLines(lines) {
  const fenced = [];
  let fence = null;
  for (const line of lines) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker;
      fenced.push(true);
    } else if (fence !== null) {
      fenced.push(true);
      if (
        marker &&
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        line.trim() === marker
      )
        fence = null;
    } else fenced.push(false);
  }
  return fenced;
}

/**
 * A Hazard pack: `when:` globs in frontmatter, then a *Rule out first* and a
 * *Capture rules* section (ADAPTER.md, "Hazard packs").
 *
 * @param {string} text
 * @returns {{when: string[], ruleOutFirst: string, captureRules: string, problems: string[]}}
 */
export function parseHazardPack(text) {
  const problems = [];
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/);
  const out = { when: [], ruleOutFirst: "", captureRules: "", problems };
  if (lines[0]?.trimEnd() !== "---") {
    problems.push("line 1: expected `---` opening frontmatter with `when:` globs");
    return out;
  }
  const end = lines.findIndex((line, n) => n > 0 && line.trimEnd() === "---");
  if (end === -1) {
    problems.push("the frontmatter opened on line 1 never closes with `---`");
    return out;
  }
  const front = parseYamlSubset(lines.slice(1, end).join("\n"));
  // Frontmatter lines start on line 2 of the pack.
  problems.push(
    ...front.problems.map((p) => p.replace(/^line (\d+)/, (_, n) => `line ${Number(n) + 1}`)),
  );
  const shifted = new Map([...front.lines].map(([k, n]) => [k, n + 1]));
  const sink = problemSink(shifted);
  unknownKeys(sink, front.value, "", ["when"]);
  if (!isStringList(front.value.when) || front.value.when.length === 0)
    sink.add("when", "required: expected a non-empty list of globs");
  else out.when = front.value.when;
  problems.push(...sink.problems);

  const body = lines.slice(end + 1);
  const fenced = fencedLines(body);
  const headingLevel = (n) =>
    fenced[n] ? 0 : (/^ {0,3}(#{1,6})\s/.exec(body[n])?.[1].length ?? 0);
  for (const [key, title] of SECTIONS) {
    const pattern = new RegExp(`^#{2,6}\\s+${title}\\s*#*\\s*$`, "i");
    const start = body.findIndex((line, n) => !fenced[n] && pattern.test(line.trim()));
    if (start === -1) {
      problems.push(`no \`## ${title}\` section`);
      continue;
    }
    const level = headingLevel(start);
    let stop = body.length;
    for (let n = start + 1; n < body.length; n += 1) {
      const heading = headingLevel(n);
      if (heading && heading <= level) {
        stop = n;
        break;
      }
    }
    const content = body
      .slice(start + 1, stop)
      .join("\n")
      .trim();
    if (content === "") problems.push(`line ${end + 2 + start}: the \`${title}\` section is empty`);
    out[key] = content;
  }
  return out;
}

/**
 * The Hazard packs whose `when:` globs match any changed path.
 *
 * @param {(path: string) => string | null | undefined} read
 * @param {Record<string, any>} config a config with no problems
 * @param {string[]} changed repository-relative paths the diff touches
 * @returns {{packs: {pack: string, matched: string[], ruleOutFirst: string, captureRules: string}[], problems: string[]}}
 */
export function matchHazards(read, config, changed) {
  const packs = [];
  const problems = [];
  const paths = changed.map((p) => p.trim().replace(/\\/g, "/")).filter(Boolean);
  for (const { pack } of effectiveConfig(config).hazards) {
    const text = read(pack);
    if (text === null || text === undefined) {
      problems.push(`${pack}: no such file (named in \`hazards\`)`);
      continue;
    }
    const parsed = parseHazardPack(text);
    if (parsed.problems.length) {
      problems.push(...parsed.problems.map((p) => `${pack}: ${p}`));
      continue;
    }
    const globs = parsed.when.map(globToRegExp);
    const matched = paths.filter((p) => globs.some((glob) => glob.test(p)));
    if (matched.length)
      packs.push({
        pack,
        matched,
        ruleOutFirst: parsed.ruleOutFirst,
        captureRules: parsed.captureRules,
      });
  }
  return { packs, problems };
}

// ── QA Plans ────────────────────────────────────────────────────────────────

/** ANATOMY.md's nine sections, in the order a plan carries them. */
export const PLAN_SECTIONS = /** @type {const} */ ([
  "Anchors",
  "What automation already proves",
  "Expected red herrings",
  "Run brief",
  "Setup",
  "Scenarios",
  "Sign-off checklist",
  "Stop and do not merge if",
  "Execution record",
]);
export const ANCHOR_LABELS = /** @type {const} */ ([
  "Subject issue",
  "Pull request",
  "Merge-base",
  "Head",
]);
export const BRIEF_LABELS = /** @type {const} */ ([
  "Target",
  "Surface",
  "Build",
  "Roles",
  "Credentials",
  "Capture rules",
]);
/** Each scenario's fields, in order; the optional rule-out list comes last. */
export const SCENARIO_LABELS = /** @type {const} */ ([
  "Why only a human can prove it",
  "Signs in as",
  "Steps",
  "Expected result",
  "A failure means",
]);
const RULE_OUT = "If this fails, first rule out";
export const NOT_RUN = "_Not run yet._";

const MARKER = /^<!-- qa-plan format=(\d+) subject=#(\d+) pr=#(\d+) -->$/;
const FULL_SHA = /\b[0-9a-f]{40}(?:[0-9a-f]{24})?\b/;
const LABEL = /^\s*(?:[-*]\s+)?\*\*([^*]+?):\*\*\s*(.*)$/;
const TAG = /\[(?:observed|reconstructed)\]/g;

const NO_CREDENTIALS =
  "a plan carries role ids, at most their emails, and where the values come from, never the values " +
  '(ANATOMY.md, "No credentials travel with a plan")';

/** Shapes a secret has wherever it appears. */
const SECRET_SHAPES = [
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["an API key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["a cloud access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["a chat-service token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["a JSON Web Token", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["a bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/i],
  // `scheme://user:password@`, or `scheme://:password@` with no user.
  ["a password inside an address", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]*:[^\s/@]+@/i],
];

/** Names a sign-in form gives its secret fields. */
const SECRET_NAME =
  "(?:password|passphrase|passcode|passwd|pwd|secret|client[ _-]?secret|" +
  "(?:(?:access|auth|api|bearer|refresh|session|personal access)[ _-]?)?token|" +
  "(?:api|access|secret|private)[ _-]?key|session[ _-]?(?:id|cookie)|cookie|otp|" +
  "one[ -]time (?:code|password)|(?:recovery|backup|2fa|mfa|verification) code|pin)";
const LITERAL = "(?:`([^`]+)`|\"([^\"]+)\"|'([^']+)')";
/**
 * A secret name, alone or inside a longer key: `DB_PASSWORD`,
 * `SECRET_KEY_BASE`, `admin.password`. camelCase (`adminPassword`) is split
 * to `admin_Password` before matching, so it reads the same. A suffix is one
 * that still names the secret itself (`_base`, `_hash`); `token_type` or
 * `otp-length` name something about it, and are not read as one.
 */
const KEYED_NAME = `(?<![A-Za-z0-9])(?:[A-Za-z0-9]+[_.-])*${SECRET_NAME}(?:[_.-](?:base|value|hash|plain|raw))*(?![A-Za-z0-9])`;
const NAMED_VALUE = new RegExp(
  `${KEYED_NAME}[*_]*\\s*(?:[:=]|\\bis\\b)\\s*[*_]*\\s*(?:${LITERAL}|([^\\s,;)]+)\\s*(?=$|[,;)]))`,
  "gi",
);
const NAMED_LITERAL = new RegExp(`${KEYED_NAME}[*_]*\\s+${LITERAL}`, "gi");
const TYPED_INTO = new RegExp(
  `\\b(?:type|enter|fill in|paste|input|use)\\s+${LITERAL}\\s+(?:in|into|as|for)\\s+(?:the\\s+)?[*_]*${SECRET_NAME}\\b`,
  "gi",
);
const TABLE_SEPARATOR = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;
const SECRET_HEADER = new RegExp(`^\\s*[*_\`]*${SECRET_NAME}[*_\`]*\\s*$`, "i");
/** What stands in for a value without being one. */
const PLACEHOLDER =
  /^(?:<[^>]*>|\{[^}]*\}|\[[^\]]*\]|\*+|•+|\.{3}|…|x{3,}|redacted|none|n\/a|not shown|hidden|-+|accounts\.(?:print|restore)\b.*)$/i;
/** A page's path (`/account/reset`): lower case, segments only, no symbols. */
const PATH_VALUE = /^\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/?$/;
/**
 * A value after a secret name is one only if it looks like one: a digit or a
 * symbol, which `HttpOnly`, `Bearer` and `single-use` lack. `-`, `_` and `.`
 * do not count: prose and camelCase splitting supply them. A bare word must
 * also be longer than a quoted one, since prose runs on after it.
 */
const looksSecret = (value, minimum) => value.length >= minimum && /[0-9!@#$%^&*+=~]/.test(value);
const BASIC_AUTH = /\bBasic\s+([A-Za-z0-9+/]{8,}={0,2})(?![A-Za-z0-9+/=])/g;
/** `Basic <base64>` whose value decodes to `user:password`, as HTTP writes it. */
const hasBasicAuth = (line) =>
  [...line.matchAll(BASIC_AUTH)].some(([, encoded]) =>
    /^[^:\s]*:\S+$/.test(Buffer.from(encoded, "base64").toString("utf8")),
  );

/**
 * The lines of a plan that carry what a sign-in form would accept as a
 * secret. A heuristic: it names the line and the kind, never the value.
 *
 * @param {string[]} lines
 * @returns {string[]}
 */
export function credentialProblems(lines) {
  const problems = [];
  let secretColumns = null; // the columns of the current table named for a secret
  lines.forEach((line, n) => {
    const flag = (kind) => problems.push(`line ${n + 1}: looks like ${kind}; ${NO_CREDENTIALS}`);
    if (!/^\s*\|.*\|\s*$/.test(line)) secretColumns = null;
    else if (TABLE_SEPARATOR.test(line)) return;
    else {
      const cells = line.trim().slice(1, -1).split("|");
      // A table's first row is its header, when a separator row follows it.
      if (secretColumns === null)
        secretColumns = TABLE_SEPARATOR.test(lines[n + 1] ?? "")
          ? cells.flatMap((cell, i) => (SECRET_HEADER.test(cell) ? [i] : []))
          : [];
      else if (
        secretColumns.some((i) => {
          const value = (cells[i] ?? "").replace(/[`*_]/g, "").trim();
          return value !== "" && !PLACEHOLDER.test(value);
        })
      )
        return flag("a credential in a table column named for one");
    }

    const shape = SECRET_SHAPES.find(([, pattern]) => pattern.test(line));
    if (shape) return flag(shape[0]);
    if (hasBasicAuth(line)) return flag("a basic-auth value");
    // Every match on the line: a placeholder first (`Password: n/a; token: "…"`)
    // must not hide a value after it.
    const split = line.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
    for (const pattern of [NAMED_VALUE, NAMED_LITERAL, TYPED_INTO])
      for (const match of split.matchAll(pattern)) {
        const [literal, bare] = [match[1] ?? match[2] ?? match[3], match[4]];
        const value = (literal ?? bare ?? "").trim();
        if (value === "" || PLACEHOLDER.test(value) || PATH_VALUE.test(value)) continue;
        if (!looksSecret(value, literal === undefined ? 6 : 4)) continue;
        return flag("a credential value");
      }
  });
  return problems;
}

/**
 * Read a QA Plan against ANATOMY.md: the marker, the nine sections in order,
 * every label each section requires, the scenarios numbered from S1, and no
 * credentials. `manual-qa` runs nothing from a plan with a problem.
 *
 * @param {string} text
 * @returns {{plan: Record<string, any>, problems: string[]}}
 */
export function validatePlan(text) {
  const problems = [];
  const lines = String(text).replace(/^﻿/, "").split(/\r?\n/);
  const at = (n, message) => problems.push(`line ${n + 1}: ${message}`);
  const plan = {
    format: null,
    subject: null,
    pr: null,
    title: null,
    anchors: { subjectIssue: null, pullRequest: null, mergeBase: null, head: null },
    brief: { target: null, surface: null, versionEndpoint: null, roles: [] },
    scenarios: [],
    executed: false,
  };

  const marker = MARKER.exec((lines[0] ?? "").trim());
  if (!marker) {
    at(
      0,
      "expected the marker `<!-- qa-plan format=1 subject=#<n> pr=#<n> -->`: this is not a QA Plan",
    );
    problems.push(...credentialProblems(lines));
    return { plan, problems };
  }
  [plan.format, plan.subject, plan.pr] = marker.slice(1).map(Number);
  if (plan.format !== 1)
    at(0, `format=${plan.format}: this copy of ANATOMY.md reads format=1 only`);

  const titleAt = lines.findIndex((line, n) => n > 0 && line.trim() !== "");
  const title = /^# QA Plan: (\S.*)$/.exec(lines[titleAt]?.trim() ?? "");
  if (!title)
    at(Math.max(titleAt, 1), "expected the title `# QA Plan: <the subject issue's title>`");
  else plan.title = title[1].trim();

  const fenced = fencedLines(lines);
  const headings = [];
  lines.forEach((line, n) => {
    const match = !fenced[n] && /^## (.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push({ title: match[1].trim(), n });
  });
  const sections = {};
  headings.forEach((heading, i) => {
    if (!PLAN_SECTIONS.includes(heading.title))
      return at(
        heading.n,
        `\`## ${heading.title}\` is not a QA Plan section (ANATOMY.md: ${PLAN_SECTIONS.join(" · ")})`,
      );
    if (sections[heading.title]) return at(heading.n, `a second \`## ${heading.title}\``);
    sections[heading.title] = {
      n: heading.n,
      from: heading.n + 1,
      to: headings[i + 1]?.n ?? lines.length,
    };
  });
  for (const name of PLAN_SECTIONS) if (!sections[name]) problems.push(`no \`## ${name}\` section`);
  const order = Object.keys(sections);
  if (order.join("\n") !== PLAN_SECTIONS.filter((name) => sections[name]).join("\n"))
    problems.push(`the sections are out of order: ANATOMY.md gives ${PLAN_SECTIONS.join(" · ")}`);

  const bodyOf = (name) => lines.slice(sections[name].from, sections[name].to);
  const textOf = (name) =>
    bodyOf(name)
      .filter((line) => line.trim() !== "")
      .join("\n")
      .trim();
  for (const name of order)
    if (textOf(name) === "")
      at(sections[name].n, `\`## ${name}\` is empty: a section with nothing to say says \`None.\``);

  /** The `**Label:**` lines in a range, each with its text up to the next label. */
  const labelsIn = (from, to) => {
    const found = [];
    for (let n = from; n < to; n += 1) {
      const match = !fenced[n] && LABEL.exec(lines[n]);
      if (match) found.push({ label: match[1].trim(), n, inline: match[2].trim() });
    }
    found.forEach((entry, i) => {
      entry.text = [entry.inline, ...lines.slice(entry.n + 1, found[i + 1]?.n ?? to)]
        .join("\n")
        .trim();
    });
    return found;
  };
  const plainWord = (value) =>
    value
      .replace(/[`*_]/g, "")
      .trim()
      .split(/[\s,;:()]+/)[0] ?? "";

  if (sections.Anchors) {
    const { n, from, to } = sections.Anchors;
    const found = labelsIn(from, to);
    const get = (label) => found.find((entry) => entry.label === label);
    for (const label of ANCHOR_LABELS) if (!get(label)) at(n, `Anchors lacks **${label}:**`);
    for (const [label, key, markerValue, name] of [
      ["Subject issue", "subjectIssue", plan.subject, "subject"],
      ["Pull request", "pullRequest", plan.pr, "pr"],
    ]) {
      const entry = get(label);
      if (!entry) continue;
      const number = /^`?#(\d+)/.exec(entry.inline);
      if (!number) at(entry.n, `**${label}:** expected \`#<n>\``);
      else {
        plan.anchors[key] = Number(number[1]);
        if (Number(number[1]) !== markerValue)
          at(
            entry.n,
            `**${label}:** #${number[1]} differs from the marker's ${name}=#${markerValue}`,
          );
      }
    }
    for (const [label, key] of [
      ["Merge-base", "mergeBase"],
      ["Head", "head"],
    ]) {
      const entry = get(label);
      if (!entry) continue;
      const sha = FULL_SHA.exec(entry.inline);
      if (!sha) at(entry.n, `**${label}:** expected the full commit SHA`);
      else plan.anchors[key] = sha[0];
    }
  }

  for (const name of ["What automation already proves", "Expected red herrings"]) {
    if (!sections[name] || textOf(name) === "None.") continue;
    const { n, from, to } = sections[name];
    const bullets = [];
    for (let i = from; i < to; i += 1) {
      if (fenced[i]) continue;
      if (/^[-*]\s/.test(lines[i])) bullets.push({ n: i, text: lines[i] });
      else if (bullets.length && /^\s+\S/.test(lines[i])) bullets.at(-1).text += `\n${lines[i]}`;
    }
    if (!bullets.length && textOf(name) !== "")
      at(n, `\`## ${name}\`: expected one bullet per entry, or \`None.\``);
    for (const bullet of bullets)
      if ((bullet.text.match(TAG) ?? []).length !== 1)
        at(bullet.n, "expected exactly one tag, `[observed]` or `[reconstructed]`");
  }

  if (sections["Run brief"]) {
    const { n, from, to } = sections["Run brief"];
    const found = labelsIn(from, to);
    const get = (label) => found.find((entry) => entry.label === label);
    for (const label of BRIEF_LABELS)
      if (!get(label)) at(n, `Run brief lacks **${label}:**`);
      else if (get(label).text === "") at(get(label).n, `**${label}:** is empty`);
    for (const [label, key, choices] of [
      ["Target", "target", TARGETS],
      ["Surface", "surface", SURFACES],
    ]) {
      const entry = get(label);
      if (!entry || entry.text === "") continue;
      const word = plainWord(entry.inline);
      if (!choices.includes(word))
        at(entry.n, `**${label}:** expected one of: ${choices.join(", ")}`);
      else plan.brief[key] = word;
    }
    const build = get("Build");
    if (build && plan.anchors.head && !build.text.includes(plan.anchors.head))
      at(build.n, "**Build:** expected the head SHA from Anchors");
    const endpoint = build ? /`(\/[^`\s]*)`/.exec(build.text)?.[1] : undefined;
    const goodEndpoint = endpoint !== undefined && ENDPOINT_PATH.test(endpoint);
    if (endpoint !== undefined && !goodEndpoint)
      at(
        build.n,
        "**Build:** the version endpoint must be a path on the build's own host, such as `/version`",
      );
    plan.brief.versionEndpoint = goodEndpoint ? endpoint : null;
    const roles = get("Roles");
    if (roles && roles.text !== "" && roles.text !== "None.") {
      plan.brief.roles = [
        ...new Set([...roles.text.matchAll(/`([A-Za-z0-9][A-Za-z0-9_-]*)`\s*:/g)].map((m) => m[1])),
      ];
      if (!plan.brief.roles.length) at(roles.n, "**Roles:** name each role as `id`: its purpose");
    }
  }

  if (sections.Scenarios) {
    const { n, from, to } = sections.Scenarios;
    const heads = [];
    for (let i = from; i < to; i += 1) {
      const match = !fenced[i] && /^### (.*)$/.exec(lines[i]);
      if (match) heads.push({ text: match[1].trim(), n: i });
    }
    if (!heads.length && textOf("Scenarios") !== "")
      at(n, "no `### S1: …` scenario: a plan with no scenarios is not written (empty Residue)");
    heads.forEach((head, i) => {
      const match = /^S(\d+):\s*(\S.*)$/.exec(head.text);
      if (!match) return at(head.n, "expected `### S<n>: <what is verified>`");
      const id = `S${match[1]}`;
      if (Number(match[1]) !== i + 1)
        at(head.n, `expected S${i + 1} here: scenarios are numbered from S1 with no gaps`);
      const found = labelsIn(head.n + 1, heads[i + 1]?.n ?? to);
      const position = (label) => found.findIndex((entry) => entry.label === label);
      const get = (label) => found[position(label)];
      for (const label of SCENARIO_LABELS) {
        if (position(label) === -1) at(head.n, `${id} lacks **${label}:**`);
        else if (get(label).text === "") at(get(label).n, `${id}: **${label}:** is empty`);
      }
      const positions = [...SCENARIO_LABELS, RULE_OUT].map(position).filter((p) => p !== -1);
      if (positions.some((p, k) => k > 0 && p < positions[k - 1]))
        at(head.n, `${id}: its fields are out of order (ANATOMY.md, "Scenarios")`);
      const steps = get("Steps");
      if (steps && steps.text !== "" && !/^\s*\d+\.\s+\S/m.test(steps.text))
        at(steps.n, `${id}: **Steps:** expected a numbered list`);
      const signs = get("Signs in as");
      const who = signs ? plainWord(signs.inline) : null;
      if (signs && who && who !== "nobody" && !plan.brief.roles.includes(who))
        at(signs.n, `${id} signs in as \`${who}\`, which the Run brief's **Roles:** does not name`);
      plan.scenarios.push({ id, title: match[2].trim(), signsInAs: who || null });
    });
  }

  if (sections["Sign-off checklist"]) {
    const body = bodyOf("Sign-off checklist").join("\n");
    for (const { id } of plan.scenarios)
      if (!new RegExp(`^\\s*[-*]\\s+\\[[ xX]\\]\\s+${id}\\b`, "m").test(body))
        at(sections["Sign-off checklist"].n, `no \`- [ ] ${id}: …\` box for ${id}`);
  }

  if (sections["Execution record"]) plan.executed = textOf("Execution record") !== NOT_RUN;
  problems.push(...credentialProblems(lines));
  return { plan, problems };
}

// ── Host rule ───────────────────────────────────────────────────────────────

/** Hostname labels that mark a hosted test environment (`qa.example.com`). */
export const TEST_LABELS = ["staging", "dev", "test", "qa", "sandbox", "preview", "uat"];
/** Hostname labels that mark production: a stop, whatever else the host says. */
const PRODUCTION_LABELS = ["prod", "production", "live"];
const LOCAL_HOSTS = "`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`, `*.test`";
/**
 * Suffixes under which each name is someone's own site, so the site's name is
 * one label left of the suffix, not of the last two labels: `qa.co.uk` and
 * `staging.vercel.app` are sites, not test hosts. Node ships no public suffix
 * list, so this is the common part of it; a suffix missing here makes a site
 * named `qa` or `staging` read as `confirm`, never as a sign-in on its own.
 */
const MULTI_PART_SUFFIXES = [
  ...["co", "org", "ac", "gov", "me", "net", "ltd", "plc"].map((s) => `${s}.uk`),
  ...["com", "net", "org", "edu", "gov"].map((s) => `${s}.au`),
  ...["co", "org", "net"].map((s) => `${s}.nz`),
  ...["co", "ne", "or"].map((s) => `${s}.jp`),
  ...["co", "net", "org"].map((s) => `${s}.in`),
  ..."com.br com.cn com.mx com.tr com.sg com.hk co.za co.kr co.il".split(" "),
  ..."github.io gitlab.io vercel.app netlify.app herokuapp.com pages.dev workers.dev".split(" "),
  ..."web.app firebaseapp.com appspot.com azurewebsites.net cloudfront.net".split(" "),
  ..."onrender.com fly.dev amplifyapp.com up.railway.app".split(" "),
];

/** An address's URL, reading a bare host as `http://`; null when it is not one. */
function addressUrl(address) {
  const text = String(address ?? "").trim();
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`);
  } catch {
    return null;
  }
}

/** A URL's hostname, lower-cased, without a trailing root dot. */
const hostnameOf = (url) => url.hostname.toLowerCase().replace(/\.$/, "");

/**
 * Whether a run may sign in at an address.
 *
 * A `stack` run signs in only to a local development host: `localhost`,
 * `127.0.0.1`, `[::1]`, `*.localhost` or `*.test`. A `url` run may also sign
 * in to a hosted host with a test-environment label (`TEST_LABELS`) in its
 * subdomain, as in `qa.example.com`, and only once the QA person has named or
 * confirmed that host in chat: `confirmed` is the host as they typed it. The
 * label must sit left of the site's own name (the label left of the suffix,
 * which is the last label or one of `MULTI_PART_SUFFIXES`), so `example.dev` (a TLD), `dev.to` and
 * `qa.co.uk` (the site's own name) are not test hosts. An IP address, a host
 * with no such label, or one with a production label (`prod`, `production`,
 * `live`) is a stop, confirmed or not.
 *
 * @param {string} address a URL, or a host with an optional port
 * @param {{target?: "stack" | "url", confirmed?: string}} [options]
 *   `target` defaults to `stack`. `confirmed` comes from the person in chat,
 *   never from a plan, a config or any other file.
 * @returns {{verdict: "local" | "hosted" | "confirm" | "stop", host: string | null, why: string}}
 *   `local` and `hosted` may sign in; `confirm` may once the person confirms
 *   the host in chat; `stop` may not.
 */
export function hostVerdict(address, { target = "stack", confirmed } = {}) {
  const url = addressUrl(address);
  if (!url) return { verdict: "stop", host: null, why: "not an address" };
  const host = hostnameOf(url);
  const stop = (why) => ({ verdict: "stop", host, why });
  if (url.username || url.password)
    return stop("the address carries sign-in values; they never go in an address");
  if (!["http:", "https:"].includes(url.protocol))
    return stop(`\`${url.protocol}\` is not a web address`);
  if (!["stack", "url"].includes(target)) return stop(`\`${target}\` is not a target`);
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".test");
  if (local) return { verdict: "local", host, why: "a local development host" };
  if (target === "stack")
    return stop(`a \`stack\` run signs in only to a local development host (${LOCAL_HOSTS})`);

  const labels = host.split(".");
  if (/^\[|^[\d.]+$/.test(host)) return stop("an IP address carries no test-environment label");
  const production = labels.find((label) => PRODUCTION_LABELS.includes(label));
  if (production) return stop(`looks like production: the hostname carries \`${production}\``);
  const suffix = MULTI_PART_SUFFIXES.find((s) => host.endsWith(`.${s}`));
  const subdomains = labels.slice(0, -((suffix ? suffix.split(".").length : 1) + 1));
  const label = subdomains.find((part) => TEST_LABELS.includes(part));
  if (!label)
    return stop(
      "looks like production: no test-environment label " +
        `(${TEST_LABELS.map((l) => `\`${l}\``).join(", ")}) in its subdomain, ` +
        "and a TLD such as `.dev` does not count",
    );
  if (confirmed === undefined || String(confirmed).trim() === "")
    return {
      verdict: "confirm",
      host,
      why:
        `a hosted test host (\`${label}\`): sign in only once the QA person names or confirms ` +
        `\`${host}\` in chat; a URL found in the plan or a file is not confirmation`,
    };
  const said = addressUrl(confirmed);
  if (!said || hostnameOf(said) !== host)
    return stop(`the host confirmed in chat is not \`${host}\``);
  return { verdict: "hosted", host, why: `a hosted test host (\`${label}\`), confirmed in chat` };
}

// ── Writing ─────────────────────────────────────────────────────────────────

const PLAIN_SAFE = /^[A-Za-z0-9_./@~+-][A-Za-z0-9_./@~+=-]*$/;
const RESERVED = /^(?:true|false|null|yes|no|on|off|~)$/i;

/** A scalar the subset reads back unchanged. */
function emitScalar(value) {
  const text = String(value);
  const cannot = () =>
    new Error(`cannot write ${JSON.stringify(text)} in the YAML subset; use qa.config.json`);
  // A value spans one line, and a backslash inside "…" is an escape to real YAML.
  if (/[\r\n]/.test(text)) throw cannot();
  if (PLAIN_SAFE.test(text) && !RESERVED.test(text) && !/^[-?]/.test(text)) return text;
  if (!text.includes('"') && !text.includes("\\")) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  throw cannot();
}

function emitFlow(value) {
  if (Array.isArray(value)) return `[${value.map(emitFlow).join(", ")}]`;
  if (isMapping(value))
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${emitFlow(v)}`)
      .join(", ")} }`;
  return value === true ? "true" : emitScalar(value);
}

function emitBlock(map, indent) {
  const pad = " ".repeat(indent);
  return Object.entries(map)
    .filter(([, v]) => present(v))
    .flatMap(([key, v]) => {
      if (Array.isArray(v) && v.length && v.every(isMapping))
        // Block style, one key per line: a formatter never wraps it out of the subset.
        return [
          `${pad}${key}:`,
          ...v.flatMap((item) => {
            const lines = emitBlock(item, indent + 4);
            if (!lines.length) return [`${pad}  - {}`];
            return lines.map((line, n) => (n === 0 ? `${pad}  - ${line.trimStart()}` : line));
          }),
        ];
      if (Array.isArray(v))
        return v.length
          ? [`${pad}${key}:`, ...v.map((item) => `${pad}  - ${emitFlow(item)}`)]
          : [`${pad}${key}: []`];
      if (isMapping(v)) return [`${pad}${key}:`, ...emitBlock(v, indent + 2)];
      return [`${pad}${key}: ${emitFlow(v)}`];
    });
}

/**
 * A `qa.config.yml` body for a config, in the subset this reader takes.
 * Written only with the person's consent (SKILL.md, step 2).
 *
 * @param {Record<string, any>} config
 * @param {(config: Record<string, any>) => string[]} [check] the problems
 *   that refuse it; by default `qa-plan`'s
 * @returns {string}
 */
export function renderConfigYaml(config, check = configProblems) {
  const problems = check(config);
  if (problems.length) throw new Error(`the answers have problems:\n- ${problems.join("\n- ")}`);
  const ordered = Object.fromEntries(
    TOP_KEYS.filter((key) => present(config[key])).map((key) => [key, config[key]]),
  );
  return `${emitBlock(ordered, 0).join("\n")}\n`;
}

/**
 * The repository's config with the person's answers laid over it: a top-level
 * answer replaces that key, except `plan` and `run`, whose keys are merged one
 * level down. Nothing the answers do not name is lost.
 *
 * @param {Record<string, any>} existing
 * @param {Record<string, any>} answers
 */
export function mergeAnswers(existing, answers) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(answers))
    merged[key] =
      (key === "plan" || key === "run") && isMapping(existing[key]) && isMapping(value)
        ? { ...existing[key], ...value }
        : value;
  return merged;
}

/**
 * The file to write the answers to, and its new body: the config file the
 * lookup found (in its own dialect), or `qa.config.yml` when there is none.
 * Writing anywhere else would leave a second file that one of the two
 * shadows. YAML comments in the old file are not kept.
 *
 * @param {{path: string | null, config: Record<string, any>, problems: string[], runProblems?: string[]}} loaded
 * @param {Record<string, any>} answers
 * @returns {{path: string, body: string}}
 */
export function renderConfigUpdate(loaded, answers) {
  if (!isMapping(answers)) throw new Error("the answers must be a JSON object");
  // Only the sections the answers write can refuse them: `run:` answers are
  // checked as `manual-qa` reads the file, anything else as `qa-plan` does.
  // A YAML syntax problem, or one in the keys both skills read, is in both
  // lists, so it always refuses: rewriting a file that did not parse loses
  // what it says. The other skill's section is carried over as it is.
  const keys = Object.keys(answers);
  const forRun = keys.includes("run");
  const forPlan = !forRun || keys.some((key) => key !== "run");
  const unique = (lists) => [...new Set(lists.flat())];
  const before = unique([forPlan ? loaded.problems : [], forRun ? (loaded.runProblems ?? []) : []]);
  if (before.length)
    throw new Error(`${loaded.path} has problems; fix them first:\n- ${before.join("\n- ")}`);
  const check = (config) =>
    unique([forPlan ? configProblems(config) : [], forRun ? runProblems(config) : []]);
  const merged = mergeAnswers(loaded.config, answers);
  const path = loaded.path ?? CONFIG_FILES[0];
  if (path.endsWith(".json")) {
    const problems = check(merged);
    if (problems.length) throw new Error(`the answers have problems:\n- ${problems.join("\n- ")}`);
    return { path, body: `${JSON.stringify(merged, null, 2)}\n` };
  }
  return { path, body: renderConfigYaml(merged, check) };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function repoReader(repo) {
  return (path) => {
    const absolute = join(repo, path);
    if (!existsSync(absolute)) return null;
    try {
      return readFileSync(absolute, "utf8");
    } catch {
      return null;
    }
  };
}

function option(argv, name) {
  const values = [];
  argv.forEach((arg, n) => {
    if (arg === name && argv[n + 1] !== undefined) values.push(argv[n + 1]);
  });
  return values;
}

const readStdin = () => {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
};

/**
 * @param {string[]} argv the arguments after the script
 * @param {{read?: (path: string) => string | null, stdin?: () => string}} [io]
 * @returns {{code: number, out: string}}
 */
export function main(argv, io = {}) {
  const [command] = argv;
  const repo = option(argv, "--repo")[0] ?? process.cwd();
  const read = io.read ?? repoReader(repo);
  const stdin = io.stdin ?? readStdin;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const loaded = readQaConfig(read);
  const usage = {
    code: 2,
    out:
      "usage: node adapter.mjs check --for plan | check --for run [--plan <file>] | " +
      "plan [<file>] < plan.md | host <url> [--target stack|url] [--confirmed <host>] | " +
      "hazards < changed-paths | " +
      "delivery [--label <name>]… | render [--write] < answers.json   [--repo <dir>]\n",
  };
  // A plan is the person's file, wherever they keep it: read from the working
  // directory, not from the repository root.
  const readFile =
    io.readFile ??
    ((path) => {
      try {
        return readFileSync(resolve(path), "utf8");
      } catch {
        return null;
      }
    });
  const readPlan = (path) => {
    const text = path === undefined ? stdin() : readFile(path);
    if (text === null) return { plan: null, problems: [`${path}: no such file`] };
    return validatePlan(text);
  };

  if (command === "plan") {
    const result = readPlan(argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined);
    return { code: result.problems.length ? 1 : 0, out: json(result) };
  }
  if (command === "host") {
    const address = argv[1];
    if (address === undefined || address.startsWith("--")) return usage;
    const [target = "stack"] = option(argv, "--target");
    const [confirmed] = option(argv, "--confirmed");
    if (argv.includes("--confirmed") && (confirmed === undefined || confirmed.startsWith("--")))
      return usage;
    if (argv.includes("--target") && !["stack", "url"].includes(option(argv, "--target")[0]))
      return usage;
    const result = hostVerdict(address, { target, confirmed });
    const codes = { local: 0, hosted: 0, confirm: 3, stop: 1 };
    return { code: codes[result.verdict], out: json(result) };
  }

  if (command === "render") {
    try {
      const { path, body } = renderConfigUpdate(loaded, JSON.parse(stdin()));
      if (!argv.includes("--write")) return { code: 0, out: body };
      (io.write ?? ((p, text) => writeFileSync(join(repo, p), text)))(path, body);
      return { code: 0, out: `wrote ${path}\n` };
    } catch (error) {
      return { code: 1, out: `${error instanceof Error ? error.message : error}\n` };
    }
  }
  if (command === "check") {
    const section = option(argv, "--for")[0];
    if (section === "run") {
      const planPath = option(argv, "--plan")[0];
      const planned = planPath === undefined ? null : readPlan(planPath);
      const readiness = runReadiness(loaded, planned?.problems.length ? null : planned?.plan);
      const failed = loaded.runProblems.length > 0 || (planned?.problems.length ?? 0) > 0;
      return {
        code: failed ? 1 : 0,
        out: json({
          path: loaded.path,
          problems: loaded.runProblems,
          ...(planned ? { planProblems: planned.problems } : {}),
          effective: loaded.runProblems.length
            ? null
            : {
                working_dir: effectiveConfig(loaded.config).working_dir,
                run: effectiveConfig(loaded.config).run,
              },
          readiness,
        }),
      };
    }
    if (section !== "plan") return usage;
    const readiness = planReadiness(loaded);
    return {
      code: loaded.problems.length ? 1 : 0,
      out: json({
        path: loaded.path,
        problems: loaded.problems,
        effective: loaded.problems.length ? null : effectiveConfig(loaded.config),
        readiness,
      }),
    };
  }
  if (loaded.problems.length)
    return { code: 1, out: json({ path: loaded.path, problems: loaded.problems }) };
  if (command === "hazards") {
    const result = matchHazards(read, loaded.config, stdin().split(/\r?\n/));
    return { code: result.problems.length ? 1 : 0, out: json(result) };
  }
  if (command === "delivery")
    return { code: 0, out: json(pickDelivery(loaded.config, { labels: option(argv, "--label") })) };
  return usage;
}

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

// Compared as real paths: `file://${argv[1]}` never matches on Windows, and a
// symlinked skills directory must still count as running this file.
if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) {
  const { code, out } = main(process.argv.slice(2));
  process.stdout.write(out);
  process.exitCode = code;
}
