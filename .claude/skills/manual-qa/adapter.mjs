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
//   node adapter.mjs check --for plan --answers <file.json>
//                                          the same, with answers given up front
//                                          merged over the config (none written)
//   node adapter.mjs check --for run [--plan <file>]
//                                          the same for `run:`, against a plan's Run brief
//   node adapter.mjs plan [<file>]         a QA Plan (the file, or stdin) against ANATOMY.md
//   node adapter.mjs host <url> [--target stack|url] [--confirmed <host>]
//                                          whether a run may sign in at this address
//   node adapter.mjs hazards < files.txt   Hazard packs matching the changed paths
//   node adapter.mjs delivery [--label L]… where the plan goes, by `plan.publish`
//   node adapter.mjs render [--write [--drop-comments]] < answers.json
//                                          the config with the answers merged in
//   node adapter.mjs where <skill>         whether this copy of the skill is the
//                                          repository's own (`whichCopy`)
//   Each prints JSON (render prints the new file body, or writes it with --write;
//   --write over a commented YAML config exits 3 unless --drop-comments)
//   and exits 1 on any problem, 2 on bad usage; `host` exits 0 when the run may
//   sign in, 1 on a stop, 3 when the QA person must confirm the host in chat.

import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Lookup order: the first file present is the config (ADAPTER.md). */
export const CONFIG_FILES = /** @type {const} */ ([
  "qa.config.yml",
  "qa.config.yaml",
  "qa.config.json",
]);

export const TOP_KEYS = /** @type {const} */ (["working_dir", "plan", "hazards", "run", "report"]);
export const REPORT_KEYS = /** @type {const} */ (["places", "holds"]);
/** The Places a repository starts with: `local` holds a merge, the others are deferred (ADR 0033). */
export const DEFAULT_PLACES = Object.freeze(["local", "staging", "production"]);
export const DEFAULT_HOLDS = Object.freeze(["local"]);
/** A Place's name: one lowercase word, so `[<place>]` reads back. */
export const PLACE_NAME = /^[a-z0-9][a-z0-9-]*$/;
export const PLAN_KEYS = /** @type {const} */ (["base_ref", "suites", "publish", "tracker"]);
export const SUITE_KEYS = /** @type {const} */ ([
  "name",
  "command",
  "junit",
  "surfaces",
  "services",
]);
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
  "hosts",
  "accounts",
  "playwright",
  "version_endpoint",
  "evidence",
]);
/** What each `run.hosts` entry may hold: the candidate's name, address and optional surface. */
export const HOST_KEYS = /** @type {const} */ (["name", "url", "surface"]);
export const STACK_KEYS = /** @type {const} */ (["up", "migrate", "seed", "down"]);
/** What `run.stack` may hold: the four commands, and the optional local address. */
export const STACK_CONFIG_KEYS = /** @type {const} */ ([...STACK_KEYS, "address"]);
export const ACCOUNT_KEYS = /** @type {const} */ (["print", "restore", "roles"]);
export const ROLE_KEYS = /** @type {const} */ (["id", "purpose"]);
export const EVIDENCE_KEYS = /** @type {const} */ (["upload"]);
export const TARGETS = /** @type {const} */ (["stack", "url"]);
export const SURFACES = /** @type {const} */ (["web", "desktop", "mobile", "api"]);
/**
 * Marks a writer may leave stuck to the end of a first-word value (#201). A comma,
 * semicolon, colon or parenthesis already ends the word (ANATOMY.md, "First-word
 * values"), so none of them is ever left on it.
 */
const STUCK_MARKS = [".", "!", "?"];

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
  // Real YAML ends the line at ` #`, leaving the collection unclosed; this
  // subset would otherwise keep the comment as part of the value.
  if (/(?:^|\s)#/.test(value))
    problem(
      "a `#` comment inside a flow collection is outside the YAML subset ADAPTER.md documents",
    );
  // A key stops at `:` already. In a value, real YAML refuses `{ a: b: c }`
  // and reads `[a: b]` as a mapping, so other tools would read it otherwise.
  if (!stops.includes(":") && /:(?:\s|$)/.test(value))
    problem(
      "a `: ` inside an unquoted value is outside the YAML subset ADAPTER.md documents — quote the value",
    );
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
  // Real YAML refuses `key: a: b` ("mapping values are not allowed here").
  if (/:(?:\s|$)/.test(value))
    problem(
      "a `: ` inside an unquoted value is outside the YAML subset ADAPTER.md documents — quote the value",
    );
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
      // `- # note` is an item with no value, as in real YAML, never the text `# note`.
      const content = body.replace(/^-[ \t]*/, "").replace(/^#.*$/, "");
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
  reportProblems(sink, config.report);
}

/** `report:`, the Places a posted QA Report tags its Left for a person items with (ADR 0033). */
function reportProblems(sink, report) {
  if (!present(report)) return;
  if (!isMapping(report)) return sink.add("report", "expected a mapping");
  unknownKeys(sink, report, "report", REPORT_KEYS);
  const { places, holds } = report;
  const off = places === "none";
  let named = DEFAULT_PLACES;
  if (present(places) && !off) {
    if (!Array.isArray(places) || !places.length)
      sink.add("report.places", "expected a list of Places, or `none` to turn them off");
    else {
      named = [];
      places.forEach((place, n) => {
        const path = `report.places[${n}]`;
        if (typeof place !== "string" || !PLACE_NAME.test(place))
          sink.add(path, "expected a lowercase word, such as `local`");
        else if (named.includes(place)) sink.add(path, `\`${place}\` is listed twice`);
        else named.push(place);
      });
    }
  }
  if (off) {
    if (present(holds))
      sink.add("report.holds", "Places are off, so none holds a merge: remove it");
    return;
  }
  if (!present(holds)) {
    if (present(places))
      sink.add("report.holds", "name the Places that hold a merge, as a list of the Places above");
    return;
  }
  if (!Array.isArray(holds)) return sink.add("report.holds", "expected a list of Places");
  if (!holds.length) sink.add("report.holds", "name at least one Place that holds a merge");
  holds.forEach((place, n) => {
    if (!named.includes(place))
      sink.add(`report.holds[${n}]`, `\`${place}\` is not in \`report.places\``);
  });
}

/**
 * The Places a posted QA Report may tag an item with: each `{name, holds}`, in
 * order, or `null` when the config turns Places off (items untagged, all held).
 * Read a config with no problems; a key with a problem is not defaulted.
 *
 * @param {Record<string, any>} config
 * @returns {{name: string, holds: boolean}[] | null}
 */
export function effectivePlaces(config) {
  const report = isMapping(config?.report) ? config.report : {};
  if (report.places === "none") return null;
  const names = Array.isArray(report.places) ? report.places : DEFAULT_PLACES;
  const holds = Array.isArray(report.holds) ? report.holds : DEFAULT_HOLDS;
  return names.map((name) => ({ name, holds: holds.includes(name) }));
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
        if (present(suite.services) && !isStringList(suite.services))
          sink.add(`${path}.services`, "expected a list of service names");
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
 * @param {{read?: (path: string) => string | null | undefined}} [options]
 * @returns {string[]}
 */
export function runProblems(config, lines, options = {}) {
  const { read } = options;
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
  if (present(run.surface)) {
    if (typeof run.surface === "string") {
      if (!SURFACES.includes(run.surface))
        sink.add("run.surface", `expected one of: ${SURFACES.join(", ")}`);
    } else if (Array.isArray(run.surface)) {
      if (!run.surface.length)
        sink.add("run.surface", `expected a non-empty list of: ${SURFACES.join(", ")}`);
      else {
        const seen = new Set();
        for (const item of run.surface) {
          if (typeof item !== "string" || !SURFACES.includes(item)) {
            sink.add(
              "run.surface",
              typeof item === "string"
                ? `\`${item}\`: expected one of: ${SURFACES.join(", ")}`
                : `expected one of: ${SURFACES.join(", ")}`,
            );
            break;
          }
          if (seen.has(item)) {
            sink.add("run.surface", `\`${item}\` is listed twice`);
            break;
          }
          seen.add(item);
        }
      }
    } else {
      sink.add(
        "run.surface",
        `expected one of: ${SURFACES.join(", ")}, or a non-empty list of them`,
      );
    }
  }

  if (present(run.stack)) {
    if (!isMapping(run.stack))
      sink.add("run.stack", "expected a mapping of `up`, `migrate`, `seed`, `down`, `address`");
    else {
      unknownKeys(sink, run.stack, "run.stack", STACK_CONFIG_KEYS);
      for (const key of STACK_KEYS)
        if (present(run.stack[key]) && !nonEmpty(run.stack[key]))
          sink.add(`run.stack.${key}`, "expected a command");
      // The address a stack whose `up` prints none serves on. `host` must call it
      // `local`: a `stack` run signs in nowhere else, so a config never holds another.
      if (
        present(run.stack.address) &&
        !(nonEmpty(run.stack.address) && isLocalAddress(run.stack.address))
      )
        sink.add(
          "run.stack.address",
          "expected a local address, one `adapter.mjs host` calls `local`, such as `http://localhost:3000`",
        );
    }
  }

  if (present(run.hosts)) {
    if (!Array.isArray(run.hosts))
      sink.add("run.hosts", "expected a list of `{ name, url, surface }` candidates");
    else {
      const names = new Set();
      /** @type {Map<string, string>} each surface, by the entry that holds it */
      const surfaces = new Map();
      run.hosts.forEach((entry, n) => {
        const path = `run.hosts[${n}]`;
        if (!isMapping(entry))
          return sink.add(path, "expected a mapping of `name`, `url`, `surface`");
        unknownKeys(sink, entry, path, HOST_KEYS);
        if (typeof entry.name !== "string" || !SERVICE_NAME.test(entry.name))
          sink.add(`${path}.name`, "required: letters, digits, `_` and `-` only");
        else if (names.has(entry.name))
          sink.add(`${path}.name`, `duplicate name \`${entry.name}\``);
        else names.add(entry.name);
        const address =
          nonEmpty(entry.url) && /^https?:\/\//i.test(entry.url) ? addressUrl(entry.url) : null;
        if (!address)
          sink.add(`${path}.url`, "required: a web address, such as `https://qa.example.com`");
        else if (address.username || address.password)
          sink.add(`${path}.url`, "required: a web address with no sign-in values in it");
        if (present(entry.surface)) {
          if (!SURFACES.includes(entry.surface))
            sink.add(`${path}.surface`, `expected one of: ${SURFACES.join(", ")}`);
          else if (surfaces.has(entry.surface))
            sink.add(
              `${path}.surface`,
              `\`${entry.surface}\` already has an entry (\`${surfaces.get(entry.surface)}\`): a surface has at most one`,
            );
          else surfaces.set(entry.surface, String(entry.name));
        }
      });
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

  if (present(run.playwright)) {
    if (!isRepoPath(run.playwright))
      sink.add("run.playwright", "expected a relative folder inside the repository");
    else if (read && read(posix.join(run.playwright.replace(/\\/g, "/"), "package.json")) === null)
      sink.add(
        "run.playwright",
        `no \`package.json\` in \`${run.playwright}\`: expected the folder whose \`node_modules\` holds Playwright`,
      );
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
 * @param {{read?: (path: string) => string | null | undefined}} [options]
 * @returns {{config: Record<string, unknown>, problems: string[], runProblems: string[]}}
 *   `problems` are what `qa-plan` stops on (`configProblems`), `runProblems`
 *   what `manual-qa` stops on (`runProblems`). A YAML syntax problem, or a
 *   file that does not parse, is in both.
 */
export function parseConfig(path, text, options = {}) {
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
    return {
      config: parsed,
      problems: configProblems(parsed),
      runProblems: runProblems(parsed, undefined, options),
    };
  }
  const { value, problems, lines } = parseYamlSubset(text);
  return {
    config: value,
    problems: [...problems, ...configProblems(value, lines)],
    runProblems: [...problems, ...runProblems(value, lines, options)],
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
    return { path, ...parseConfig(path, text, { read }) };
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
    places: effectivePlaces(config),
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
        "the `junit` XML path it writes, the `surfaces` globs it covers, " +
        "and the `services` it runs against for real",
    );
  for (const suite of plan.suites)
    if (!present(suite.junit))
      notes.push(
        `suite \`${suite.name}\` has no \`junit\` path: what it proves is read from its exit code only, tagged [reconstructed]`,
      );
  if (isMapping(config.run) && present(config.run.stack) && plan.suites.length)
    if (!plan.suites.some((suite) => isStringList(suite.services) && suite.services.length))
      notes.push(
        "no suite lists `services`: each suite is taken to run against doubles, so a promise " +
          "that depends on a QA Stack service stays in the Residue unless a CI job against the real services covers it",
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

/** `a`, `a and b`, `a, b and c`. */
const listed = (items) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** `a`, `a or b`, `a, b or c`. */
const orListed = (items) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;

/** Normalize `run.surface` (string or list of strings) to a list of surface names. */
const configuredSurfaces = (value) =>
  typeof value === "string" ? [value] : Array.isArray(value) ? value : [];

/**
 * The readiness need when the config's `run.surface` does not include the Run
 * brief's (#223, #378): the surfaces in dispute, the scenarios each answer moves
 * (those whose effective surface is the Run brief's, as step 4 applies it), and
 * those that keep their own **Surface:** whatever the answer.
 *
 * @param {string | string[]} configured the config's surface or surfaces
 * @param {string} briefed the Run brief's surface
 * @param {{id: string, surface: string | null}[]} scenarios
 */
function surfaceQuestion(configured, briefed, scenarios) {
  const list = configuredSurfaces(configured);
  const moving = scenarios.filter((s) => s.surface === briefed).map((s) => s.id);
  const keeping = scenarios.filter((s) => s.surface !== briefed);
  const one = moving.length === 1;
  const keeps = keeping.length
    ? `${listed(keeping.map((s) => `${s.id} (\`${s.surface}\`)`))} ` +
      `${keeping.length === 1 ? "keeps its" : "keep their"} own **Surface:** whatever the answer.`
    : "No scenario keeps its own **Surface:** whatever the answer.";
  if (list.length === 1) {
    const only = list[0];
    const moves = moving.length
      ? `With \`${only}\`, ${listed(moving)} ${one ? "drives" : "drive"} \`${only}\`; ` +
        `with \`${briefed}\`, ${one ? "it drives" : "they drive"} \`${briefed}\`, the surface the ` +
        `plan's author chose from what ${one ? "that scenario" : "those scenarios"} must observe.`
      : "No scenario drives the Run brief's surface, so neither answer moves one.";
    return (
      `run.surface: the config says \`${only}\` but the plan's Run brief says \`${briefed}\`; ` +
      `say which this run uses, \`${only}\` or \`${briefed}\`. ${moves} ${keeps}`
    );
  }
  const choices = orListed([briefed, ...list].map((s) => `\`${s}\``));
  const allowed = listed(list.map((s) => `\`${s}\``));
  const orAllowed = orListed(list.map((s) => `\`${s}\``));
  const moves = moving.length
    ? `With ${orAllowed}, ${listed(moving)} ${one ? "drives" : "drive"} that surface; ` +
      `with \`${briefed}\`, ${one ? "it drives" : "they drive"} \`${briefed}\`, the surface the ` +
      `plan's author chose from what ${one ? "that scenario" : "those scenarios"} must observe.`
    : "No scenario drives the Run brief's surface, so no answer moves one.";
  return (
    `run.surface: the config allows ${allowed} but the plan's Run brief says \`${briefed}\`; ` +
    `say which this run uses, ${choices}. ${moves} ${keeps}`
  );
}

// ── The `web` driver's tools ────────────────────────────────────────────────

/**
 * The readiness notes for the `web` driver's optional tools (#232, #236; ADAPTER.md
 * "Readiness check"). Notes, never needs: without either, the run goes on.
 */
export const WEB_NOTES = /** @type {const} */ ({
  chromium:
    "`web`: Playwright with Chromium is installed in this repository, so `web.mjs` drives the `web` scenarios",
  noChromium:
    "`web`: no Playwright with Chromium in this repository, so no `web.mjs`: " +
    "the `web` scenarios run on the harness's browsers, with no Storyboards (and so no MP4s)",
  ffmpeg:
    "`web`: `ffmpeg` with `ffprobe` is on `PATH`, so `mp4.mjs` builds an MP4 for each " +
    "`Capture: video` scenario",
  noFfmpeg:
    "`web`: no `ffmpeg` with `ffprobe` on `PATH`, so no MP4s: each `Capture: video` " +
    "scenario keeps its Storyboard",
});

/** The packages that carry Playwright's `chromium`, in the order they are tried. */
const PLAYWRIGHT_PACKAGES = ["playwright", "@playwright/test", "playwright-core"];

/**
 * Playwright as the repository at `dir` has it, loaded from its own
 * `node_modules` (never installed): the package found, its module, and whether
 * its Chromium is downloaded. Agent-kit takes no dependency on it.
 * @param {string} dir the repository root
 * @returns {{package: string | null, module: any, chromium: boolean}}
 */
export function findPlaywright(dir) {
  const require = createRequire(join(resolve(dir), "package.json"));
  for (const name of PLAYWRIGHT_PACKAGES) {
    let module;
    try {
      module = require(name);
    } catch {
      continue;
    }
    if (!module?.chromium) continue;
    let executable = "";
    try {
      executable = module.chromium.executablePath();
    } catch {
      // no browser for this platform
    }
    return { package: name, module, chromium: Boolean(executable) && existsSync(executable) };
  }
  return { package: null, module: null, chromium: false };
}

/**
 * First-level folders under `repo` that hold a `package.json` and Playwright with
 * Chromium, in sorted order. Searches one folder level only, never deeper (#533).
 * @param {string} repo
 * @returns {string[]}
 */
export function findPlaywrightSubdirs(repo) {
  const root = resolve(repo);
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const dir = join(root, entry.name);
    const isDir =
      entry.isDirectory() ||
      (entry.isSymbolicLink() &&
        (() => {
          try {
            return statSync(dir).isDirectory();
          } catch {
            return false;
          }
        })());
    if (!isDir || !existsSync(join(dir, "package.json"))) continue;
    if (findPlaywright(dir).chromium) dirs.push(entry.name);
  }
  return dirs.sort();
}

/**
 * The readiness note when the repository root has no Playwright with Chromium,
 * `run.playwright` is unset, and one or more first-level folders have it (#533).
 * @param {string[]} dirs
 */
export function hintedNoChromiumNote(dirs) {
  if (dirs.length === 1)
    return (
      `\`web\`: no Playwright with Chromium at the repository root; \`${dirs[0]}\` has it: ` +
      `set \`run.playwright: ${dirs[0]}\``
    );
  const names = listed(dirs.map((dir) => `\`${dir}\``));
  const settings = orListed(dirs.map((dir) => `\`run.playwright: ${dir}\``));
  return `\`web\`: no Playwright with Chromium at the repository root; ${names} have it: set ${settings}`;
}

/**
 * Resolves Playwright for a `web` driver (`web.mjs`, `storyboard.mjs`, `mp4.mjs`)
 * from `overrideDir` (`--playwright-dir`), else `run.playwright` in the repository's
 * QA config, else the repository root.
 * @param {string} repo
 * @param {string | undefined} [overrideDir]
 * @returns {{dir: string | null, from: string | null, found: {package: string | null, module: any, chromium: boolean}, error: string | null}}
 */
export function resolvePlaywright(repo, overrideDir) {
  const root = resolve(repo);
  let from = null;
  let label = "`run.playwright`";
  if (overrideDir !== undefined) {
    from = overrideDir;
    label = "`--playwright-dir`";
  } else {
    const loaded = readQaConfig(repoReader(root));
    const configured = loaded.config?.run?.playwright;
    if (present(configured)) from = configured;
  }
  if (from !== null) {
    if (!isRepoPath(from))
      return {
        dir: null,
        from: null,
        found: { package: null, module: null, chromium: false },
        error: `${label}: expected a relative folder inside the repository`,
      };
    const normalized = from.replace(/\\/g, "/");
    const dir = resolve(root, normalized);
    if (!existsSync(join(dir, "package.json")))
      return {
        dir: null,
        from: null,
        found: { package: null, module: null, chromium: false },
        error: `${label}: no \`package.json\` in \`${from}\``,
      };
    return { dir, from: normalized, found: findPlaywright(dir), error: null };
  }
  return { dir: root, from: null, found: findPlaywright(root), error: null };
}

/**
 * Whether a program is a file in one of `PATH`'s folders (with a `PATHEXT`
 * extension on Windows). Nothing is run.
 * @param {string} name
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [platform]
 */
export function onPath(name, env = process.env, platform = process.platform) {
  const windows = platform === "win32";
  const folders = (env.PATH ?? env.Path ?? "").split(windows ? ";" : ":").filter(Boolean);
  const extensions = windows ? ["", ...(env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  return folders.some((folder) =>
    extensions.some((extension) => {
      try {
        return statSync(join(folder, name + extension)).isFile();
      } catch {
        return false;
      }
    }),
  );
}

/** What `check --for run` detects for the `web` notes, from `run.playwright` or the repository root. */
const detectWebTools =
  (repo, config = {}) =>
  () => {
    const subdir = config?.run?.playwright;
    const ffmpeg = onPath("ffmpeg") && onPath("ffprobe");
    if (present(subdir) && isRepoPath(subdir)) {
      return {
        chromium: findPlaywright(join(resolve(repo), subdir.replace(/\\/g, "/"))).chromium,
        playwrightDirs: [],
        ffmpeg,
      };
    }
    const chromium = findPlaywright(repo).chromium;
    return {
      chromium,
      playwrightDirs: chromium ? [] : findPlaywrightSubdirs(repo),
      ffmpeg,
    };
  };

/**
 * What `manual-qa` still needs before it runs a plan, from the config and,
 * when one is given, the plan's Run brief. `needs` are asked for; a `note` is
 * said, and the run goes on.
 *
 * @param {{path: string | null, config: Record<string, any>, runProblems?: string[]}} read
 * @param {{brief: {target: string | null, surface: string | null, roles: string[]}, scenarios?: {id: string, surface: string | null, sessions?: {id: string}[], creates?: string[]}[]} | null} [plan]
 *   a plan `validatePlan` read with no problems; every session id that is a role
 *   must be declared, and a Scenario account need not be. A plan with no
 *   scenarios needs nothing, and is told only `gh` can check its build
 * @param {(() => {chromium: boolean, ffmpeg: boolean}) | null} [tools] detects the `web`
 *   driver's tools, called only when a scenario drives `web`; without it, no tool notes
 * @param {Record<string, string>} [typed] each `run.hosts` entry's host, as the QA person typed it, by name
 * @returns {{ready: boolean, needs: string[], notes: string[], run: {target: string | null, surface: string | null, roles: string[]}, hosts?: HostState[], held?: {id: string, why: string}[], scenarioHosts?: {id: string, entry: string, host: string | null}[], environments?: {host: string, entries: string[], question: string}[]}}
 */
export function runReadiness(
  { path, config, runProblems: problems = [] },
  plan = null,
  tools = null,
  typed = {},
) {
  const brief = plan?.brief ?? null;
  const run = isMapping(config.run) ? config.run : {};
  // A malformed entry is a `run:` problem, reported below; it declares no role.
  const declared = Array.isArray(run.accounts?.roles)
    ? run.accounts.roles.flatMap((role) =>
        isMapping(role) && typeof role.id === "string" ? [role.id] : [],
      )
    : [];
  const configured = configuredSurfaces(run.surface);
  const defaultSurface =
    configured.length === 1
      ? configured[0]
      : brief?.surface && configured.includes(brief.surface)
        ? brief.surface
        : (configured[0] ?? brief?.surface ?? null);
  const effective = {
    target: run.target ?? brief?.target ?? null,
    surface: defaultSurface,
    ...(configured.length > 1 ? { surfaces: configured } : {}),
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
  // A plan with no scenarios drives nothing and starts nothing: it needs no target,
  // surface, roles or stack. Its run never reaches the address, so it reads no version
  // endpoint either, and only `gh` can check its build.
  if (Array.isArray(plan?.scenarios) && plan.scenarios.length === 0) {
    notes.push(
      "a plan with no scenarios reads no version endpoint: without `gh` access the build cannot be " +
        "checked against the plan's head, and the report opens with **build not verified against plan**",
    );
    return { ready: true, needs, notes, run: effective };
  }

  if (!effective.target)
    needs.push(
      "run.target: `stack` (a local QA Stack this run starts) or `url` (a hosted test environment)",
    );
  else if (present(run.target) && brief?.target && run.target !== brief.target)
    needs.push(
      `run.target: the config says \`${run.target}\` but the plan's Run brief says \`${brief.target}\`; ` +
        `say which this run uses (${TARGETS.join(" or ")})`,
    );

  const surfaceConflict = Boolean(
    brief?.surface && configured.length && !configured.includes(brief.surface),
  );
  if (!effective.surface)
    needs.push("run.surface: what the scenarios drive: `web`, `desktop`, `mobile` or `api`");
  else if (surfaceConflict)
    needs.push(surfaceQuestion(configured, brief.surface, plan?.scenarios ?? []));

  if (!declared.length)
    needs.push("run.accounts.roles: each role a scenario signs in as, by `id` and `purpose`");
  // Every role the plan names, and every session id that is not `nobody` or a Scenario
  // account a scenario creates: those are made during the run, not declared.
  const created = new Set((plan?.scenarios ?? []).flatMap((scenario) => scenario.creates ?? []));
  const signedIn = (plan?.scenarios ?? []).flatMap((scenario) =>
    (scenario.sessions ?? []).map((session) => session.id),
  );
  const missing = [...new Set([...(brief?.roles ?? []), ...signedIn])].filter(
    (id) => id !== "nobody" && !created.has(id) && !declared.includes(id),
  );
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
  /** @type {Pick<ReturnType<typeof runReadiness>, "hosts" | "held" | "scenarioHosts" | "environments">} */
  let hostsOut = {};
  if (target === "url") {
    const resolved = resolveHosts(run.hosts, plan?.scenarios ?? [], typed);
    hostsOut = {
      hosts: resolved.hosts,
      held: resolved.held,
      scenarioHosts: resolved.scenarioHosts,
      environments: resolved.environments,
    };
    notes.push(
      resolved.hosts.length
        ? "target `url`: `run.hosts` lists candidates, and no config key confirms a hosted address: " +
            "the QA person types each host, per host, per run, and `host --target url --confirmed <typed>` " +
            "checks each before any sign-in there"
        : "target `url`: no config key confirms a hosted address; ask the QA person to type it in chat " +
            "and check it with `host --target url --confirmed <typed>`, since a URL in the plan or a file is " +
            "not confirmation",
    );
    for (const host of resolved.hosts)
      if (!host.confirmed)
        notes.push(
          `host \`${host.name}\` (${host.url}) is a candidate, never a confirmation: ask the QA person to type its host` +
            (host.verdict === "stop" ? ` (${host.why})` : ""),
        );
    for (const environment of resolved.environments)
      notes.push(
        `${environment.question} Role values come from \`run.accounts.print\` only if so; ` +
          "otherwise the QA person types them into chat",
      );
    if (!resolved.environments.length)
      notes.push(
        present(run.accounts?.print)
          ? "target `url`: role values come from `run.accounts.print` only if the environment's owner ran " +
              "the same seeder there; otherwise the QA person types them into chat"
          : "target `url`: the QA person types each role's test values into chat",
      );
  } else if (Array.isArray(run.hosts) && run.hosts.length)
    notes.push("`run.hosts` is read only for target `url`; this run's target is not");
  if (!present(run.accounts?.restore))
    notes.push(
      "no `run.accounts.restore`: a scenario that needs a role's account restored is left for a person",
    );
  if (!present(run.version_endpoint) && !brief?.versionEndpoint)
    notes.push(
      "no `run.version_endpoint`: without `gh` access the build cannot be checked against the plan's head",
    );
  // The `web` driver's tools are optional: each note says what the run loses without one.
  // With a plan, the scenarios' surfaces, and the config's when the surface question
  // could move scenarios onto it; with none, the configured list (or effective surface).
  const surfaces = plan?.scenarios?.length
    ? [
        ...plan.scenarios.map((scenario) => scenario.surface),
        ...(surfaceConflict ? configured : []),
      ]
    : configured.length
      ? configured
      : [effective.surface];
  if (tools && surfaces.includes("web")) {
    const found = tools();
    notes.push(
      found.chromium
        ? WEB_NOTES.chromium
        : found.playwrightDirs?.length
          ? hintedNoChromiumNote(found.playwrightDirs)
          : WEB_NOTES.noChromium,
      found.ffmpeg ? WEB_NOTES.ffmpeg : WEB_NOTES.noFfmpeg,
    );
  }
  return { ready: needs.length === 0, needs, notes, run: effective, ...hostsOut };
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
 * @param {boolean} [nested] also open a fence indented four or more spaces, as
 *   one inside a list item is. A fence then closes only on a line indented no
 *   deeper than its opening one (or 3 spaces), so an indented fence line inside an
 *   ordinary block is its content, as it is without `nested`.
 * @returns {boolean[]}
 */
function fencedLines(lines, nested = false) {
  const fenced = [];
  let fence = null;
  let indent = 0;
  const opens = nested ? /^(\s*)(`{3,}|~{3,})/ : /^(\s{0,3})(`{3,}|~{3,})/;
  for (const line of lines) {
    const found = opens.exec(line);
    const marker = found?.[2];
    if (fence === null && marker) {
      fence = marker;
      indent = found[1].length;
      fenced.push(true);
    } else if (fence !== null) {
      fenced.push(true);
      if (
        marker &&
        found[1].length <= Math.max(indent, 3) &&
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
/**
 * The alternative to **Signs in as:**, in its position: a scenario with two or more
 * Sessions names each one (`A = user, B = admin`). A scenario carries one of the two.
 */
export const SESSIONS = "Sessions";
/** The optional field naming each Scenario account a scenario creates; it follows **Signs in as:**. */
export const CREATES = "Creates";
/**
 * The optional field (format=2) giving the one Surface a scenario drives, in place of the
 * Run brief's default: after **Signs in as:** or **Sessions:** (and **Creates:**), before
 * **Steps:**.
 */
export const SCENARIO_SURFACE = "Surface";
/**
 * The optional field (format=2) naming the service a scenario tests on a hosted (`url`)
 * target, in place of its surface's entry: right after **Surface:** (or where it would
 * sit), before **Observes:**.
 */
export const SCENARIO_SERVICE = "Service";
/** A service's name, as `run.hosts` and **Service:** spell it. */
export const SERVICE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
/**
 * The optional field (format=2) naming what a scenario's result observes, for `manual-qa`
 * to check each driver against: right after the scenario's **Surface:**, or after its
 * sign-in field (and **Creates:**) when it has none, before **Steps:**.
 */
export const SCENARIO_OBSERVES = "Observes";
/** The values **Observes:** takes, from ANATOMY.md "Scenarios". */
export const OBSERVES = /** @type {const} */ ([
  "headers",
  "cookies",
  "httponly-cookies",
  "status",
  "body",
  "screen",
  "local-file",
]);
/** What each Surface's drivers can observe, from `qa-plan` and `manual-qa` SKILL.md (#378). */
export const SURFACE_OBSERVES = /** @type {const} */ ({
  api: ["headers", "cookies", "httponly-cookies", "status", "body", "local-file"],
  web: ["body", "screen", "local-file"],
  desktop: ["screen", "local-file"],
  mobile: ["screen", "local-file"],
});
/**
 * The optional field (format=3) saying what evidence a run keeps for a scenario: right
 * after its **Observes:**, or wherever **Observes:** would sit when it has none, before
 * **Steps:**. Missing, it means `screenshot` on a screen surface and `transcript` on `api`.
 */
export const SCENARIO_CAPTURE = "Capture";
/** The values **Capture:** takes, from ANATOMY.md "Scenarios". */
export const CAPTURES = /** @type {const} */ (["screenshot", "video", "transcript", "none"]);
/**
 * The optional field (format=3) saying what the tester sees at the merge-base, where the
 * change is not yet made: right after **Expected result:**. A scenario with one is a fix
 * scenario.
 */
export const SCENARIO_EXPECTED_BEFORE = "Expected before";
/**
 * The field (format=4) telling a scenario's story: a numbered list with one sentence per
 * Scene, in order, right after its **Capture:**, or wherever **Capture:** would sit when it
 * has none, before **Steps:**. A `Capture: video` scenario in a format=4 plan carries one.
 */
export const SCENARIO_STORY = "Story";

/**
 * A Story sentence as plain text, since a Title card and a Storyboard heading show it as
 * written: paired inline Markdown is stripped (`**x**`, `__x__`, `*x*`, `_x_` and `` `x` ``
 * to `x`, `[text](url)` to `text`). A code span's content is kept as written, and an
 * underscore inside a word (`member_id`) and a lone `*` are kept.
 */
function plainStory(sentence) {
  return sentence
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      i % 2
        ? part.slice(1, -1)
        : part
            .replace(/\[([^\]]+)\]\((?:[^()\s]|\([^()\s]*\))*\)/g, "$1")
            .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "$1")
            .replace(/(?<![\p{L}\p{N}_])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])/gu, "$1")
            .replace(/\*(?=\S)([^*]+?)(?<=\S)\*/g, "$1")
            .replace(/(?<![\p{L}\p{N}_])_(?=\S)([^_]+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, "$1"),
    )
    .join("");
}

/**
 * The plan formats this copy reads. A format=1 plan carries no per-scenario field; a
 * format=2 plan no **Capture:** or **Expected before:**; a format=3 plan no **Story:**.
 */
export const FORMATS = /** @type {const} */ ([1, 2, 3, 4]);
/** The format the composer writes. */
export const FORMAT = FORMATS.at(-1);
const RULE_OUT = "If this fails, first rule out";
/** A Sign-off box for a promise only reading can check: `- [ ] Review: <what to read, and what it must say>`, a space after the colon. */
const REVIEW_BOX = /^\s*[-*]\s+\[(?<tick>[ xX])\]\s+Review:(?<text>(?:\s.*)?)$/;
/** A Place leading a `Review:` box's text: `[<place>] <text>`. */
const REVIEW_PLACE = /^\[([^\]\s]*)\](?:\s|$)/;
/**
 * What is wrong with a `Review:` box's Place, given the configured Places
 * (`effectivePlaces`; `undefined` checks none, `null` is Places turned off).
 */
function placeProblem(place, text, places) {
  if (places === undefined) return null;
  // Off, only a Place-shaped tag is a Place: `[the docs](x) say …` and `[WIP] …` are text.
  if (places === null)
    return place === null || !PLACE_NAME.test(place)
      ? null
      : "Places are off: write the box with no Place, `Review: <text>`";
  const names = places.map((p) => p.name);
  // A box with no Place is read as the first Place that holds a merge: a plan made before Places still runs.
  if (place === null) return null;
  if (text === `[${place}]`)
    return "a `Review:` box with nothing after its Place: say what to read, and what it must say";
  if (!names.includes(place))
    return `the box's Place \`${place}\` is not configured (${names.join(", ")}): pick one of them, or add it to \`report.places\``;
  return null;
}
/** A box that looks meant as a `Review:` box but is not written as one: `review:`, `**Review:**`, `Review :`, `Review:docs`. */
const NEAR_REVIEW_BOX = /^\s*[-*]\s+\[[ xX]\]\s+[*_]*review[*_]*\s*[*_]*:/i;
/** A role id, and a Scenario account id: letters, digits, `_` and `-`. */
const ACCOUNT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const NOT_RUN = "_Not run yet._";

/**
 * The words a shell command starts with (#199). A Setup line or a step that begins with
 * one followed by an argument, or holds a backticked span that does, reads as a command,
 * not a product action. Matched in lower case only, and only as a whole word followed by
 * an argument, so `Export the CSV` and a lone `docker` label are prose.
 */
export const COMMAND_WORDS = /** @type {const} */ ([
  "docker",
  "docker-compose",
  "kubectl",
  "redis-cli",
  "psql",
  "mysql",
  "python",
  "python3",
  "node",
  "npm",
  "npx",
  "curl",
  "wget",
  "env",
  "export",
  "bash",
  "sh",
]);
/**
 * Command words that also name things in a product (a toolbar's `export`, a `python`
 * language, an `env staging` badge). These read as a command only before an argument
 * that reads as one; the others before any argument. A word alone is never a command.
 */
export const COPY_WORDS = /** @type {const} */ (["export", "node", "env", "python", "sh"]);
/**
 * The marks after a `COPY_WORDS` word that make it a command: assignment, pipes,
 * variables, lists, redirects.
 */
export const COMMAND_MARKS = /** @type {const} */ (["=", "|", "$", ";", "&", "<", ">"]);
/** The script files a `COPY_WORDS` word runs: `node seed.js`, `python manage.py`. */
export const SCRIPT_EXTENSIONS = /** @type {const} */ (["py", "js", "mjs", "cjs", "ts", "sh"]);
/**
 * An argument as a command takes one: a flag (`-c`, `--force`: a dash before a
 * letter, so a lone `-` separator is copy), a path that starts with `/`, `./`,
 * `../` or `~/`, a script file, or one of `COMMAND_MARKS`. A `/` inside a word
 * (`CSV/PDF`) and a version (`v20.x`) are copy.
 */
const COMMAND_ARGUMENT = new RegExp(
  `(?:^|\\s)(?:-{1,2}[A-Za-z]|(?:\\.{1,2}|~)?/)|[${COMMAND_MARKS.join("")}]|\\w\\.(?:${SCRIPT_EXTENSIONS.join("|")})(?=\\s|$)`,
);
const COMMAND_START = new RegExp(`^(?:\\$\\s|(${COMMAND_WORDS.join("|")})\\s+(\\S.*))`);
const NOT_RUN_HERE =
  "a plan carries product actions only, and `manual-qa` will not run it: " +
  "write the product action that shows the same thing, or leave the promise out of the Residue";
const NO_CODE_BLOCK =
  "a plan gives product actions, and any data to enter, as prose, never as a code block, " +
  "and `manual-qa` runs nothing from one: quote data to type or paste in a backticked span";

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
 * every label each section requires, the scenarios numbered from S1, each
 * scenario's one **Signs in as:** or its **Sessions:** (with each step naming
 * its session), each Scenario account created once and signed in as only after
 * it, no shell command in Setup or Steps, and no credentials. Each parsed
 * scenario lists its `sessions` as `{name, id}`: one with `name: null` for
 * **Signs in as:**, else one per letter, its effective `surface`: its own
 * **Surface:** (format=2), else the Run brief's, and the values its **Observes:**
 * (format=2) lists, as `observes` (`[]` with none), what its run keeps as `capture`
 * (format=3: its **Capture:**, else `transcript` on `api` and `screenshot` elsewhere),
 * with `captureGiven` saying whether the plan wrote it, and its **Expected before:**
 * (format=3) as `expectedBefore` (`null` with none), and the sentences of its **Story:**
 * (format=4), one per Scene, as `story` (`[]` with none). Each `Review:` box in the
 * Sign-off checklist is in `reviews`, as `{text, ticked}`: never a scenario's box,
 * and a plan whose Scenarios says `None.` reads when it has one.
 * `manual-qa` runs nothing from a plan with a problem.
 *
 * @param {string} text
 * @returns {{plan: Record<string, any>, problems: string[]}}
 */
export function validatePlan(text, { places } = {}) {
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
    reviews: [],
    executed: false,
  };

  const marker = MARKER.exec((lines[0] ?? "").trim());
  if (!marker) {
    at(
      0,
      `expected the marker \`<!-- qa-plan format=${FORMAT} subject=#<n> pr=#<n> -->\`: this is not a QA Plan`,
    );
    problems.push(...credentialProblems(lines));
    return { plan, problems };
  }
  [plan.format, plan.subject, plan.pr] = marker.slice(1).map(Number);
  if (!FORMATS.includes(plan.format))
    at(
      0,
      `format=${plan.format}: this copy of ANATOMY.md reads ${FORMATS.slice(0, -1)
        .map((f) => `format=${f}`)
        .join(", ")} and format=${FORMAT} only`,
    );

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
  /** A first-word value (ANATOMY.md, "First-word values"): `*` and `_` only around the word. */
  const plainWord = (value) =>
    (
      value
        .replace(/`/g, "")
        .trim()
        .split(/[\s,;:()]+/)[0] ?? ""
    ).replace(/^[*_]+|[*_]+$/g, "");
  /**
   * A first-word value that fails only because a mark is stuck to its end (#201), such
   * as `api.` for `api`: the word as read, the mark and the fix, for the problem to name.
   * The plan still fails; this only says why. `null` when `word` is valid, or is not
   * valid without its last mark either.
   * @param {string} word the value as `plainWord` read it
   * @param {(word: string) => boolean} valid
   */
  const stuckMark = (word, valid) => {
    const mark = word.slice(-1);
    if (valid(word) || !STUCK_MARKS.includes(mark)) return null;
    const bare = word.slice(0, -1).replace(/[*_]+$/, "");
    if (bare === "" || !valid(bare)) return null;
    return `\`${word}\`: a \`${mark}\` is stuck to the value; write \`${bare}\` followed by a space, comma or parenthesis`;
  };
  /**
   * The ids a **Creates:** line names (ANATOMY.md, "Scenario accounts"), and the values an
   * **Observes:** line names, read the same way: first-word values
   * joined by commas, with any spaces around each comma. Any other space, a semicolon, a
   * colon or a parenthesis ends the list; the rest is prose. An empty id after a comma is
   * kept as `""`, so the checker names it on this line.
   */
  const idList = (value) => {
    const ids = [];
    let rest = value.replace(/`/g, "").trim();
    for (let first = true; ; first = false) {
      const word = /^[^\s,;:()]*/.exec(rest)[0];
      const id = word.replace(/^[*_]+|[*_]+$/g, "");
      if (first && id === "") return ids;
      ids.push(id);
      rest = rest.slice(word.length);
      const comma = /^\s*,\s*/.exec(rest);
      if (!comma) return ids;
      rest = rest.slice(comma[0].length);
    }
  };
  /**
   * The sessions a **Sessions:** line names (ANATOMY.md, "Sessions"): `<name> = <id>`
   * entries joined by commas, with any spaces around each comma and each `=`. Each id is
   * a first-word value, read as `plainWord` reads one. Any other space, a semicolon, a
   * colon or a parenthesis after an id ends the list; the rest is prose. An entry with no
   * `=` is kept with `id: null`, so the checker names it on this line.
   */
  const sessionList = (value) => {
    const sessions = [];
    let rest = value.replace(/`/g, "").trim();
    for (;;) {
      const entry = /^([^\s=,;:()]*)\s*=\s*([^\s,;:()]*)/.exec(rest);
      if (!entry) {
        sessions.push({ name: /^[^\s,;:()]*/.exec(rest)[0], id: null });
        return sessions;
      }
      sessions.push({ name: plainWord(entry[1]), id: plainWord(entry[2]) });
      rest = rest.slice(entry[0].length);
      const comma = /^\s*,\s*/.exec(rest);
      if (!comma) return sessions;
      rest = rest.slice(comma[0].length);
    }
  };
  /**
   * The top-level numbered items in lines `from`–`to`, each with its line, number and
   * text. An item is top-level when it starts left of the first item's text; a list nested
   * under one starts at or past it (CommonMark lets siblings shift up to 3 spaces).
   */
  const topItems = (from, to) => {
    const numbered = [];
    for (let n = from; n < to; n += 1) {
      const item = !fenced[n] && /^(\s*)(\d+)\.\s+(.*)$/.exec(lines[n]);
      if (item)
        numbered.push({
          n,
          indent: item[1].length,
          column: lines[n].length - item[3].length,
          number: item[2],
          text: item[3],
        });
    }
    const column = numbered[0]?.column ?? 0;
    return numbered.filter((item) => item.indent < column);
  };
  /**
   * In a multi-session scenario, each top-level numbered step in lines `from`–`to` starts
   * `In session X,` or `In X,`, naming one of `names` (ANATOMY.md, "Sessions"). Returns
   * each step's session name in order, `null` for a step that names none.
   */
  const stepSessions = (from, to, names, id) => {
    /** @type {(string | null)[]} */
    const order = [];
    for (const step of topItems(from, to)) {
      const session = /^In (?:session )?[`*_]*([A-Za-z])[`*_]*,/.exec(step.text)?.[1];
      order.push(session ?? null);
      if (session === undefined)
        at(
          step.n,
          `${id}: step ${step.number} names no session: in a multi-session scenario, each step starts \`In session <name>,\``,
        );
      else if (!names.has(session))
        at(
          step.n,
          `${id}: step ${step.number} is in session ${session}, which **${SESSIONS}:** does not declare`,
        );
    }
    return order;
  };

  /**
   * The shell command a line of Setup or Steps reads as (#199): `$ `, or the command word
   * that the line's text, or a backticked span on it, begins with before an argument
   * (`COPY_WORDS` before one that reads as a command's); `null` for a product action. A
   * `continuation` (an indented line, no list item, right under prose) carries on that
   * prose, so only its spans and a `$ ` prompt are read. A lone word, such as a
   * role id or a label, is no command.
   */
  const commandIn = (text, continuation) => {
    const starts = (value) => {
      const match = COMMAND_START.exec(value);
      if (!match) return null;
      if (match[1] === undefined) return "$ ";
      return COPY_WORDS.includes(match[1]) && !COMMAND_ARGUMENT.test(match[2]) ? null : match[1];
    };
    for (const [, span] of text.matchAll(/`([^`]+)`/g)) {
      const word = starts(span.trim());
      if (word) return word;
    }
    // A `$ ` prompt is never prose, so it counts on a continuation too.
    if (continuation) return /^\s*\$\s/.test(text) ? "$ " : null;
    // Read whole: the indent goes too, as an indented line that continues nothing reaches here.
    return starts(text.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)?/, ""));
  };
  /**
   * Each line in `from`–`to` that reads as a shell command, and each fenced block there
   * (named once, at its opening fence), as a problem: Setup and Steps carry product
   * actions only (ANATOMY.md). In Steps, `where` is the scenario's id and each problem
   * names the numbered step it is in; `first` stands in for line `from`'s text.
   * @param {number} from
   * @param {number} to
   * @param {{where: string, section: string, steps?: boolean, first?: string}} options
   */
  const commandProblems = (from, to, { where, section, steps = false, first }) => {
    const cite = `(ANATOMY.md, "${section}")`;
    let step = null;
    let column = null;
    // Whether the line above was an indented line read whole: a code block's line, which
    // the next indented line carries on as a block, not as prose.
    let inBlock = false;
    // Fences as a list item nests them too (a step's fence sits four or more spaces in),
    // read within this range only: a fence ends with its section or field, as CommonMark
    // ends one with its container, so one left open elsewhere never hides this range.
    const fenced = fencedLines(lines.slice(from, to), true);
    for (let n = from; n < to; n += 1) {
      if (fenced[n - from]) {
        inBlock = false;
        if (n === from || !fenced[n - from - 1])
          at(n, `${where}: a fenced code block; ${NO_CODE_BLOCK} ${cite}`);
        continue;
      }
      const text = n === from && first !== undefined ? first : lines[n];
      const numbered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(text);
      if (numbered) {
        column ??= text.length - numbered[3].length;
        if (numbered[1].length < column) step = numbered[2];
      }
      // An indented line that is no list item carries on the prose just above it, when that
      // line is in this range, non-blank, not fenced and not itself an indented line read
      // whole (#215); line `from` is read as `first`, so a bare `- **Steps:**` label is no
      // prose. Any other line, a column-0 one even when it wraps prose, is read whole: the
      // check errs toward reporting.
      const above = n - 1 === from && first !== undefined ? first : lines[n - 1];
      const indented = !numbered && !/^\s*[-*+]\s/.test(text) && /^\s/.test(text);
      const continuation =
        indented && n > from && !fenced[n - from - 1] && !inBlock && /\S/.test(above);
      inBlock = indented && !continuation && /\S/.test(text);
      const word = commandIn(text, continuation);
      if (word === null) continue;
      const what = !steps
        ? `${where}: a line`
        : step === null
          ? `${where}: **Steps:**`
          : `${where}: step ${step}`;
      const named = word === "$ " ? "a `$ ` prompt" : `\`${word}\``;
      at(n, `${what} reads as a shell command (${named}); ${NOT_RUN_HERE} ${cite}`);
    }
  };

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
      const stuck = stuckMark(word, (candidate) => choices.includes(candidate));
      if (stuck) at(entry.n, `**${label}:** read ${stuck}`);
      else if (!choices.includes(word))
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

  if (sections.Setup) {
    const { from, to } = sections.Setup;
    commandProblems(from, to, { where: "Setup", section: "Setup" });
  }

  // Each `Review:` box: a promise only reading can check (ANATOMY.md, "Sign-off checklist").
  // Read before Scenarios, whose empty-Residue check counts them.
  if (sections["Sign-off checklist"]) {
    const { from, to } = sections["Sign-off checklist"];
    for (let n = from; n < to; n += 1) {
      const box = !fenced[n] && REVIEW_BOX.exec(lines[n]);
      if (!box) {
        // Read as an ordinary box, it would reach no one's Follow-ups.
        if (!fenced[n] && NEAR_REVIEW_BOX.test(lines[n]))
          at(
            n,
            "a box that reads as a review box: write it `- [ ] Review: <what to read, and what it must say>`, with `Review:` exactly and a space after it",
          );
        continue;
      }
      const { tick, text } = /** @type {Record<string, string>} */ (box.groups);
      if (text.trim() === "")
        at(n, "a `Review:` box with nothing after it: say what to read, and what it must say");
      else {
        const place = REVIEW_PLACE.exec(text.trim())?.[1] ?? null;
        plan.reviews.push({ text: text.trim(), ticked: tick !== " ", place });
        const why = placeProblem(place, text.trim(), places);
        if (why) at(n, why);
      }
    }
  }

  if (sections.Scenarios) {
    const { n, from, to } = sections.Scenarios;
    const heads = [];
    /** Per scenario, beside `plan.scenarios`: the lines of its account fields, and the ids it names. */
    const accountLines = [];
    for (let i = from; i < to; i += 1) {
      const match = !fenced[i] && /^### (.*)$/.exec(lines[i]);
      if (match) heads.push({ text: match[1].trim(), n: i });
    }
    // A Residue of review boxes only is still a plan; its Scenarios says `None.`.
    const scenariosText = textOf("Scenarios");
    if (
      !heads.length &&
      scenariosText !== "" &&
      !(scenariosText === "None." && plan.reviews.length)
    )
      at(
        n,
        plan.reviews.length
          ? "no `### S1: …` scenario: with only `Review:` boxes, `## Scenarios` says exactly `None.`"
          : "no `### S1: …` scenario and no `Review:` box: a plan with neither is not written (empty Residue)",
      );
    heads.forEach((head, i) => {
      const match = /^S(\d+):\s*(\S.*)$/.exec(head.text);
      if (!match) return at(head.n, "expected `### S<n>: <what is verified>`");
      const id = `S${match[1]}`;
      if (Number(match[1]) !== i + 1)
        at(head.n, `expected S${i + 1} here: scenarios are numbered from S1 with no gaps`);
      const found = labelsIn(head.n + 1, heads[i + 1]?.n ?? to);
      const position = (label) => found.findIndex((entry) => entry.label === label);
      const get = (label) => found[position(label)];
      const named = position(SESSIONS) === -1 ? null : get(SESSIONS);
      for (const label of SCENARIO_LABELS) {
        // **Sessions:** stands in for **Signs in as:** (ANATOMY.md, "Sessions").
        if (label === "Signs in as" && named && position(label) === -1) continue;
        if (position(label) === -1) at(head.n, `${id} lacks **${label}:**`);
        else if (get(label).text === "") at(get(label).n, `${id}: **${label}:** is empty`);
      }
      if (named && position("Signs in as") !== -1)
        at(
          named.n,
          `${id} has both **Signs in as:** and **Sessions:**: a scenario has one or the other`,
        );
      const before = [...SCENARIO_LABELS.slice(0, 2), SESSIONS, CREATES];
      const after = [...SCENARIO_LABELS.slice(2), RULE_OUT];
      const positions = [...before, ...after].map(position).filter((p) => p !== -1);
      if (positions.some((p, k) => k > 0 && p < positions[k - 1]))
        at(head.n, `${id}: its fields are out of order (ANATOMY.md, "Scenarios")`);
      // A Surface per scenario (#203): checked on its own line, apart from the order above.
      let surface = plan.brief.surface;
      /** False when the scenario's own **Surface:** was refused: its surface is then unknown. */
      let surfaceKnown = true;
      const surfaces = found.filter((entry) => entry.label === SCENARIO_SURFACE);
      for (const extra of surfaces.slice(1))
        at(extra.n, `${id}: a second **${SCENARIO_SURFACE}:**: a scenario has at most one`);
      const own = surfaces[0];
      if (own) {
        const k = found.indexOf(own);
        const misplaced =
          found.slice(k + 1).some((entry) => before.includes(entry.label)) ||
          found.slice(0, k).some((entry) => after.includes(entry.label));
        const word = plainWord(own.inline);
        const stuck = stuckMark(word, (candidate) => SURFACES.includes(candidate));
        if (plan.format === 1)
          at(
            own.n,
            `${id}: **${SCENARIO_SURFACE}:** is a format=2 field: mark the plan \`format=2\`, or leave the Run brief's **Surface:** to every scenario`,
          );
        else if (misplaced)
          at(
            own.n,
            `${id}: **${SCENARIO_SURFACE}:** is out of position: it goes right after **${SCENARIO_LABELS[1]}:** or **${SESSIONS}:** (and **${CREATES}:**, when present), before **Steps:**`,
          );
        else if (own.text === "") at(own.n, `${id}: **${SCENARIO_SURFACE}:** is empty`);
        else if (stuck) at(own.n, `${id}: **${SCENARIO_SURFACE}:** read ${stuck}`);
        else if (!SURFACES.includes(word))
          at(own.n, `${id}: **${SCENARIO_SURFACE}:** expected one of: ${SURFACES.join(", ")}`);
        else surface = word;
        if (surface !== word) surfaceKnown = false;
      }
      // The service it tests (#418): after its Surface, else after its sign-in field.
      /** @type {string | null} */
      let service = null;
      const services = found.filter((entry) => entry.label === SCENARIO_SERVICE);
      for (const extra of services.slice(1))
        at(extra.n, `${id}: a second **${SCENARIO_SERVICE}:**: a scenario has at most one`);
      const ownService = services[0];
      if (ownService) {
        const k = found.indexOf(ownService);
        const misplaced =
          found.slice(k + 1).some((entry) => [...before, SCENARIO_SURFACE].includes(entry.label)) ||
          found.slice(0, k).some((entry) => after.includes(entry.label));
        const what = `${id}: **${SCENARIO_SERVICE}:**`;
        const word = plainWord(ownService.inline);
        if (plan.format === 1)
          at(
            ownService.n,
            `${what} is a format=2 field: mark the plan \`format=2\`, or leave it out`,
          );
        else if (misplaced)
          at(
            ownService.n,
            `${what} is out of position: it goes right after the scenario's **${SCENARIO_SURFACE}:**, or after **${SCENARIO_LABELS[1]}:** or **${SESSIONS}:** (and **${CREATES}:**, when present) when it has none, before **Steps:**`,
          );
        else if (ownService.text === "") at(ownService.n, `${what} is empty`);
        else if (!SERVICE_NAME.test(word))
          at(
            ownService.n,
            `${what} expected a service name: letters, digits, \`_\` and \`-\`, first on its line`,
          );
        else service = word;
      }
      // What the scenario observes (#204): after its Surface, else after its sign-in field.
      /** @type {string[]} */
      const observes = [];
      const observing = found.filter((entry) => entry.label === SCENARIO_OBSERVES);
      for (const extra of observing.slice(1))
        at(extra.n, `${id}: a second **${SCENARIO_OBSERVES}:**: a scenario has at most one`);
      const listed = observing[0];
      if (listed) {
        const k = found.indexOf(listed);
        const misplaced =
          found
            .slice(k + 1)
            .some((entry) =>
              [...before, SCENARIO_SURFACE, SCENARIO_SERVICE].includes(entry.label),
            ) || found.slice(0, k).some((entry) => after.includes(entry.label));
        const what = `${id}: **${SCENARIO_OBSERVES}:**`;
        if (plan.format === 1)
          at(listed.n, `${what} is a format=2 field: mark the plan \`format=2\`, or leave it out`);
        else if (misplaced)
          at(
            listed.n,
            `${what} is out of position: it goes right after the scenario's **${SCENARIO_SURFACE}:**, or after **${SCENARIO_LABELS[1]}:** or **${SESSIONS}:** (and **${CREATES}:**, when present) when it has none, before **Steps:**`,
          );
        else if (listed.text === "") at(listed.n, `${what} is empty`);
        else if (!idList(listed.inline).length)
          at(listed.n, `${what} expected one or more of: ${OBSERVES.join(", ")}`);
        else {
          let badValue = false;
          for (const value of idList(listed.inline)) {
            const stuck = stuckMark(value, (candidate) => OBSERVES.includes(candidate));
            if (value === "")
              at(listed.n, `${what} has an empty value: a comma with nothing after it`);
            else if (stuck) {
              at(listed.n, `${what} read ${stuck}`);
              badValue = true;
            } else if (!OBSERVES.includes(value)) {
              at(listed.n, `${what} \`${value}\`: expected one of: ${OBSERVES.join(", ")}`);
              badValue = true;
            } else if (observes.includes(value))
              at(listed.n, `${what} \`${value}\` is named twice`);
            else observes.push(value);
          }
          if (
            !badValue &&
            observes.length &&
            !SURFACES.some((candidate) =>
              observes.every((value) => SURFACE_OBSERVES[candidate].includes(value)),
            )
          )
            at(
              listed.n,
              `${what} ${observes.map((v) => `\`${v}\``).join(", ")}: no single Surface's drivers can observe all of them; split it into one scenario per Surface`,
            );
        }
      }
      // What a run keeps (#233): after Observes, or wherever Observes would sit.
      const defaultCapture = surface === "api" ? "transcript" : "screenshot";
      let capture = defaultCapture;
      const captures = found.filter((entry) => entry.label === SCENARIO_CAPTURE);
      for (const extra of captures.slice(1))
        at(extra.n, `${id}: a second **${SCENARIO_CAPTURE}:**: a scenario has at most one`);
      const ownCapture = captures[0];
      if (ownCapture) {
        const k = found.indexOf(ownCapture);
        const misplaced =
          found
            .slice(k + 1)
            .some((entry) =>
              [...before, SCENARIO_SURFACE, SCENARIO_SERVICE, SCENARIO_OBSERVES].includes(
                entry.label,
              ),
            ) || found.slice(0, k).some((entry) => after.includes(entry.label));
        const what = `${id}: **${SCENARIO_CAPTURE}:**`;
        const word = plainWord(ownCapture.inline);
        const stuck = stuckMark(word, (candidate) => CAPTURES.includes(candidate));
        if (plan.format < 3)
          at(
            ownCapture.n,
            `${what} is a format=3 field: mark the plan \`format=3\`, or leave it out`,
          );
        else if (misplaced)
          at(
            ownCapture.n,
            `${what} is out of position: it goes right after the scenario's **${SCENARIO_OBSERVES}:** or **${SCENARIO_SURFACE}:**, or after **${SCENARIO_LABELS[1]}:** or **${SESSIONS}:** (and **${CREATES}:**, when present) when it has neither, before **Steps:**`,
          );
        else if (ownCapture.text === "") at(ownCapture.n, `${what} is empty`);
        else if (stuck) at(ownCapture.n, `${what} read ${stuck}`);
        else if (word === "")
          at(ownCapture.n, `${what} expected one of: ${CAPTURES.join(", ")}, first on its line`);
        else if (!CAPTURES.includes(word))
          at(ownCapture.n, `${what} \`${word}\`: expected one of: ${CAPTURES.join(", ")}`);
        // A refused own **Surface:** is reported on its line; the Capture is not judged against a guess.
        else if (!surfaceKnown) capture = word;
        else if (word === "transcript" && surface && surface !== "api")
          at(
            ownCapture.n,
            `${what} \`transcript\` is for an \`api\` scenario, and this one drives \`${surface}\`: use \`screenshot\`, \`video\` or \`none\``,
          );
        else if ((word === "screenshot" || word === "video") && surface === "api")
          at(
            ownCapture.n,
            `${what} \`${word}\` is for a scenario with a screen, and this one drives \`api\`: use \`transcript\` or \`none\``,
          );
        else capture = word;
      }
      // The story, one sentence per Scene (#382): right after Capture, or where it would sit.
      /** @type {string[]} */
      let story = [];
      /** The **Story:** line, when its list read; its count is checked against the Scenes below. */
      let storyLine = null;
      const stories = found.filter((entry) => entry.label === SCENARIO_STORY);
      for (const extra of stories.slice(1))
        at(extra.n, `${id}: a second **${SCENARIO_STORY}:**: a scenario has at most one`);
      const ownStory = stories[0];
      if (ownStory) {
        const k = found.indexOf(ownStory);
        const misplaced =
          found
            .slice(k + 1)
            .some((entry) =>
              [
                ...before,
                SCENARIO_SURFACE,
                SCENARIO_SERVICE,
                SCENARIO_OBSERVES,
                SCENARIO_CAPTURE,
              ].includes(entry.label),
            ) || found.slice(0, k).some((entry) => after.includes(entry.label));
        const what = `${id}: **${SCENARIO_STORY}:**`;
        const end = found[k + 1]?.n ?? heads[i + 1]?.n ?? to;
        const items = topItems(ownStory.n + 1, end);
        if (plan.format < 4)
          at(
            ownStory.n,
            `${what} is a format=4 field: mark the plan \`format=4\`, or leave it out`,
          );
        else if (misplaced)
          at(
            ownStory.n,
            `${what} is out of position: it goes right after the scenario's **${SCENARIO_CAPTURE}:**, or wherever **${SCENARIO_CAPTURE}:** would sit when it has none, before **Steps:**`,
          );
        else if (ownStory.inline !== "" || !items.length)
          at(ownStory.n, `${what} expected a numbered list, one sentence per Scene, in order`);
        else {
          // A sentence runs on over its wrapped lines, up to a blank line or a nested list.
          story = items.map((item) => {
            const parts = [item.text.trim()];
            for (let n = item.n + 1; n < end; n += 1) {
              if (fenced[n] || lines[n].trim() === "" || /^\s*(?:[-*+]|\d+[.)])\s/.test(lines[n]))
                break;
              parts.push(lines[n].trim());
            }
            return plainStory(parts.join(" ").trim());
          });
          const empty = story.findIndex((sentence) => sentence === "");
          if (empty !== -1) {
            at(items[empty].n, `${what} sentence ${items[empty].number} is empty`);
            story = [];
          } else storyLine = ownStory.n;
        }
      } else if (plan.format >= 4 && capture === "video" && ownCapture)
        at(
          ownCapture.n,
          `${id}: **${SCENARIO_CAPTURE}:** \`video\` needs a **${SCENARIO_STORY}:**, one sentence per Scene, in order, so each Scene of the video opens on its Title card`,
        );
      // What the merge-base shows (#233): right after Expected result. Its text is the
      // scenario's, so it is read in full, as Expected result is.
      /** @type {string | null} */
      let expectedBefore = null;
      const expectedBefores = found.filter((entry) => entry.label === SCENARIO_EXPECTED_BEFORE);
      for (const extra of expectedBefores.slice(1))
        at(extra.n, `${id}: a second **${SCENARIO_EXPECTED_BEFORE}:**: a scenario has at most one`);
      const ownBefore = expectedBefores[0];
      if (ownBefore) {
        const what = `${id}: **${SCENARIO_EXPECTED_BEFORE}:**`;
        if (plan.format < 3)
          at(
            ownBefore.n,
            `${what} is a format=3 field: mark the plan \`format=3\`, or leave it out`,
          );
        else if (found[found.indexOf(ownBefore) - 1]?.label !== SCENARIO_LABELS[3])
          at(
            ownBefore.n,
            `${what} is out of position: it goes right after **${SCENARIO_LABELS[3]}:**`,
          );
        else if (ownBefore.text === "") at(ownBefore.n, `${what} is empty`);
        else expectedBefore = ownBefore.text;
      }
      const steps = get("Steps");
      if (steps && steps.text !== "" && !/^\s*\d+\.\s+\S/m.test(steps.text))
        at(steps.n, `${id}: **Steps:** expected a numbered list`);
      if (steps)
        commandProblems(steps.n, found[position("Steps") + 1]?.n ?? heads[i + 1]?.n ?? to, {
          where: id,
          section: "Scenarios",
          steps: true,
          first: steps.inline,
        });
      const signs = get("Signs in as");
      const who = signs ? plainWord(signs.inline) : null;
      /** @type {{name: string | null, id: string}[]} */
      const sessions = [];
      /** The Scenes the steps make: one for a single-session scenario; `null` when unknown. */
      let scenes = steps && steps.text !== "" ? 1 : null;
      if (named && named.text === "") at(named.n, `${id}: **${SESSIONS}:** is empty`);
      else if (named) {
        const listed = sessionList(named.inline);
        for (const { name, id: who } of listed) {
          const what = `${id}: **${SESSIONS}:**`;
          // An entry with no `=` is always the last one read: after a comma, or alone.
          if (who === null && name === "" && listed.length > 1)
            at(named.n, `${what} a comma with no session after it`);
          else if (who === null)
            at(
              named.n,
              `${what} expected \`<name> = <id>\` for each session, joined by commas` +
                (name === "" ? "" : `, at \`${name}\``),
            );
          else if (name === "")
            at(named.n, `${what} an entry has no name before \`=\`: a single capital letter`);
          else if (!/^[A-Z]$/.test(name))
            at(named.n, `${what} \`${name}\` is not a session name: a single capital letter`);
          else if (sessions.some((session) => session.name === name))
            at(named.n, `${what} session ${name} is named twice`);
          else if (who === "") at(named.n, `${what} session ${name} has no id after \`=\``);
          else sessions.push({ name, id: who });
        }
        if (listed.every((session) => session.id !== null) && listed.length < 2)
          at(
            named.n,
            `${id}: **${SESSIONS}:** names one session: a scenario with one session uses **Signs in as:**`,
          );
        scenes = null;
        if (steps && steps.text !== "") {
          const order = stepSessions(
            steps.n + 1,
            found[position("Steps") + 1]?.n ?? heads[i + 1]?.n ?? to,
            new Set(listed.map((session) => session.name)),
            id,
          );
          // A Cut is a step whose Session is not the previous step's; each starts a Scene.
          // A step that names no session is reported above, and leaves the count unknown.
          if (order.length && !order.includes(null))
            scenes = order.filter((name, k) => k === 0 || name !== order[k - 1]).length;
        }
      } else if (who) sessions.push({ name: null, id: who });
      if (storyLine !== null && scenes !== null && story.length !== scenes)
        at(
          storyLine,
          `${id}: **${SCENARIO_STORY}:** has ${story.length} sentence${story.length === 1 ? "" : "s"}, and its steps make ${scenes} Scene${scenes === 1 ? "" : "s"}: write one sentence per Scene, in order`,
        );
      const creates = position(CREATES) === -1 ? null : get(CREATES);
      const made = creates ? idList(creates.inline) : [];
      if (creates && !made.length)
        at(creates.n, `${id}: **Creates:** expected the id of each Scenario account it creates`);
      plan.scenarios.push({
        id,
        title: match[2].trim(),
        signsInAs: named ? null : who || null,
        sessions,
        creates: [...new Set(made.filter((made) => made !== ""))],
        surface,
        service,
        observes,
        capture,
        captureGiven: Boolean(ownCapture),
        expectedBefore,
        story,
      });
      accountLines.push({ signs: (named ?? signs)?.n, creates: creates?.n, made });
    });

    // Scenario accounts (ANATOMY.md): each id has one creator, and only a later scenario
    // signs in as it. Read after every scenario, so a reference forward can name its creator.
    /** @type {Map<string, number>} each Scenario account id, by the index of its creator */
    const creatorOf = new Map();
    plan.scenarios.forEach((scenario, i) => {
      const { creates: line, made: named } = accountLines[i];
      const seen = new Set();
      for (const made of named) {
        const what = `${scenario.id}: **Creates:** \`${made}\``;
        if (made === "")
          at(line, `${scenario.id}: **Creates:** has an empty id: a comma with no id after it`);
        else if (!ACCOUNT_ID.test(made))
          at(line, `${what} is not an id: letters, digits, \`_\` and \`-\`, as a role id is`);
        else if (made === "nobody")
          at(line, `${what}: \`nobody\` means signed out, so a Scenario account needs another id`);
        else if (plan.brief.roles.includes(made))
          at(
            line,
            `${what} is a role the Run brief's **Roles:** names: a Scenario account needs its own id`,
          );
        else if (seen.has(made)) at(line, `${what} is named twice`);
        else if (creatorOf.has(made))
          at(
            line,
            `${what} is already created by ${plan.scenarios[creatorOf.get(made)].id}: each Scenario account has one creator`,
          );
        else creatorOf.set(made, i);
        seen.add(made);
      }
    });
    // Each session's id follows the rule **Signs in as:** does (ANATOMY.md, "Sessions").
    plan.scenarios.forEach(({ id, sessions }, i) => {
      for (const { name, id: who } of sessions) {
        if (who === "nobody" || plan.brief.roles.includes(who)) continue;
        const line = accountLines[i].signs;
        const subject = name === null ? id : `${id}'s session ${name}`;
        const creator = creatorOf.get(who);
        const stuck = stuckMark(
          who,
          (candidate) =>
            candidate === "nobody" ||
            plan.brief.roles.includes(candidate) ||
            (creatorOf.get(candidate) ?? Infinity) < i,
        );
        if (stuck) at(line, `${subject} signs in as ${stuck}`);
        else if (creator === undefined)
          at(
            line,
            `${subject} signs in as \`${who}\`, which is neither a role the Run brief's **Roles:** names nor a Scenario account an earlier scenario creates`,
          );
        else if (creator === i)
          at(
            line,
            `${subject} signs in as \`${who}\`, which ${name === null ? "it" : id} creates itself: only a later scenario may sign in as it`,
          );
        else if (creator > i)
          at(
            line,
            `${subject} signs in as \`${who}\`, which ${plan.scenarios[creator].id} creates later: only a scenario after its creator may sign in as it`,
          );
      }
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

/** Whether `host` calls `address` `local`: the only address a `stack` run signs in to. */
export function isLocalAddress(address) {
  return hostVerdict(address, { target: "stack" }).verdict === "local";
}

/**
 * @typedef {{name: string, url: string, surface: string | null, verdict: "local" | "hosted" | "confirm" | "stop", host: string | null, why: string, confirmed: boolean}} HostState
 */

/**
 * A `url` target's entries, each checked by the host rule, and which entry each scenario
 * uses. A `run.hosts` entry is a candidate: it is `confirmed` only when its verdict is
 * `local`, or `hosted` because the QA person typed its host (`typed`, by entry name). A
 * scenario uses the entry its **Service:** names, else the entry for its surface; one
 * whose entry is missing, refused (`stop`) or not confirmed is `held` for a person with
 * the reason, and the others go on. Every environment (host) is asked about its seeder
 * once.
 *
 * @param {unknown} entries `run.hosts`, as the config holds it (an invalid one reads as none)
 * @param {{id: string, surface: string | null, service?: string | null}[]} scenarios
 * @param {Record<string, string>} [typed]
 * @returns {{hosts: HostState[], held: {id: string, why: string}[], scenarioHosts: {id: string, entry: string, host: string | null}[], environments: {host: string, entries: string[], question: string}[]}}
 */
export function resolveHosts(entries, scenarios, typed = {}) {
  const hosts = (Array.isArray(entries) ? entries : []).flatMap((entry) => {
    if (!isMapping(entry) || typeof entry.name !== "string" || typeof entry.url !== "string")
      return [];
    const result = hostVerdict(entry.url, { target: "url", confirmed: typed[entry.name] });
    return [
      {
        name: entry.name,
        url: entry.url,
        surface: typeof entry.surface === "string" ? entry.surface : null,
        verdict: result.verdict,
        host: result.host,
        why: result.why,
        confirmed: result.verdict === "local" || result.verdict === "hosted",
      },
    ];
  });
  /** @type {{id: string, why: string}[]} */
  const held = [];
  /** @type {{id: string, entry: string, host: string | null}[]} */
  const scenarioHosts = [];
  for (const scenario of scenarios) {
    const entry = scenario.service
      ? hosts.find((candidate) => candidate.name === scenario.service)
      : scenario.surface
        ? hosts.find((candidate) => candidate.surface === scenario.surface)
        : undefined;
    if (!entry) {
      // One URL for every surface (no list) serves a scenario with no **Service:**.
      if (!scenario.service && !hosts.length) continue;
      held.push({
        id: scenario.id,
        why: scenario.service
          ? `no service \`${scenario.service}\` in the run's hosts: no host is added mid-run`
          : `no entry for the \`${scenario.surface}\` surface in the run's hosts: no host is added mid-run`,
      });
    } else if (entry.verdict === "stop")
      held.push({ id: scenario.id, why: `the host of \`${entry.name}\` is refused: ${entry.why}` });
    else if (!entry.confirmed)
      held.push({
        id: scenario.id,
        why: `the host of \`${entry.name}\` is not confirmed: the QA person has not typed it`,
      });
    else scenarioHosts.push({ id: scenario.id, entry: entry.name, host: entry.host });
  }
  /** @type {Map<string, string[]>} */
  const byHost = new Map();
  for (const entry of hosts)
    if (entry.verdict !== "stop" && entry.host)
      byHost.set(entry.host, [...(byHost.get(entry.host) ?? []), entry.name]);
  const environments = [...byHost].map(([host, names]) => ({
    host,
    entries: names,
    question: `At \`${host}\`, did the environment's owner run this repo's seeder there?`,
  }));
  return { hosts, held, scenarioHosts, environments };
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

/** The config sections whose answers merge key by key, one level down. */
const MERGED_ONE_LEVEL_DOWN = ["plan", "run"];

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
      MERGED_ONE_LEVEL_DOWN.includes(key) && isMapping(existing[key]) && isMapping(value)
        ? { ...existing[key], ...value }
        : value;
  return merged;
}

/** An answers file that cannot be read: a one-line message, exit 2. */
export class AnswersError extends Error {}

/** Whether `path` is `dir` or inside it, compared as real paths (Windows ignores case). */
export function isInside(path, dir) {
  const key = (p) => {
    let full = resolve(p);
    try {
      full = realpathSync.native(full);
    } catch {
      // not there: compare as given
    }
    return process.platform === "win32" ? full.toLowerCase() : full;
  };
  const rel = relative(key(dir), key(path));
  return rel === "" || (!isAbsolute(rel) && rel.split(/[\\/]/)[0] !== "..");
}

/**
 * The answers given in chat, or up front by an orchestrate run, read from
 * `file` (relative to `repo`): the JSON object `render` takes. Throws an
 * `AnswersError` when the file is missing, is not JSON, or holds no object.
 *
 * @returns {{path: string, answers: Record<string, unknown>}}
 */
export function readAnswersFile(repo, file) {
  const path = resolve(repo, file);
  if (!existsSync(path) || !statSync(path).isFile())
    throw new AnswersError(`no answers file at \`${file}\``);
  let answers;
  try {
    answers = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new AnswersError(`the answers file \`${file}\` is not valid JSON (${error.message})`);
  }
  if (!isMapping(answers))
    throw new AnswersError(
      `the answers file \`${file}\` must hold a JSON object, the one \`adapter.mjs render\` takes`,
    );
  return { path, answers };
}

/**
 * Why an effective `working_dir`, or an answers file inside it, cannot be
 * used, or null when both can: `working_dir` must be relative and stay inside
 * the repository, and the answers file (when there is one) must be inside it.
 * Checked after the merge, since an answer may set `working_dir` itself.
 *
 * @param {string} repo
 * @param {string} workingDir the effective `working_dir`
 * @param {string | null} answersPath the answers file's resolved path, or null
 * @returns {string | null}
 */
export function answersPlaceProblem(repo, workingDir, answersPath) {
  if (isAbsolute(workingDir) || workingDir.split(/[\\/]/).includes(".."))
    return "`working_dir` must be a relative path inside the repository";
  if (answersPath !== null && !isInside(answersPath, resolve(repo, workingDir)))
    return `the answers file must be inside \`working_dir\` (\`${workingDir}\`)`;
  return null;
}

/**
 * The one line a draft QA Plan is shown with when its readiness answers came
 * from a file: each answer as `key=value`, one level down for `plan` and `run`,
 * as `mergeAnswers` lays them over the config.
 *
 * @param {string} file the answers file, as given
 * @param {Record<string, any>} answers
 * @param {string} [what] whose answers: `Readiness` (`qa-plan`) or `Run` (`manual-qa`)
 */
export function reusedAnswersLine(file, answers, what = "Readiness") {
  const values = [];
  for (const [key, value] of Object.entries(answers))
    if (MERGED_ONE_LEVEL_DOWN.includes(key) && isMapping(value))
      for (const [sub, inner] of Object.entries(value))
        values.push(`${key}.${sub}=${JSON.stringify(inner)}`);
    else values.push(`${key}=${JSON.stringify(value)}`);
  return `${what} answers reused from ${file}: ${values.join("; ") || "none"}`;
}

/**
 * The file to write the answers to, and its new body: the config file the
 * lookup found (in its own dialect), or `qa.config.yml` when there is none.
 * Writing anywhere else would leave a second file that one of the two
 * shadows. YAML comments in the old file are not kept.
 *
 * @param {{path: string | null, config: Record<string, any>, problems: string[], runProblems?: string[]}} loaded
 * @param {Record<string, any>} answers
 * @param {{read?: (path: string) => string | null | undefined}} [options]
 * @returns {{path: string, body: string}}
 */
export function renderConfigUpdate(loaded, answers, options = {}) {
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
    unique([
      forPlan ? configProblems(config) : [],
      forRun ? runProblems(config, undefined, options) : [],
    ]);
  const merged = mergeAnswers(loaded.config, answers);
  const path = loaded.path ?? CONFIG_FILES[0];
  if (path.endsWith(".json")) {
    const problems = check(merged);
    if (problems.length) throw new Error(`the answers have problems:\n- ${problems.join("\n- ")}`);
    return { path, body: `${JSON.stringify(merged, null, 2)}\n` };
  }
  return { path, body: renderConfigYaml(merged, check) };
}

/**
 * The lines of a YAML config that hold a comment, which a rewrite drops: a
 * full-line `#` comment, or a ` # comment` after a value. A quoted scalar is
 * set aside first, so a `#` inside it is not one; as in `inlineValue`, a quote
 * quotes only where a value opens (line start, after `- `, `: `, `[`, `{` or
 * `,`), so an apostrophe in a plain value hides nothing. Erring towards a
 * comment only costs a confirmation; erring away loses the person's notes.
 *
 * @param {string} text
 * @returns {number[]} 1-based line numbers
 */
export function yamlCommentLines(text) {
  const found = [];
  String(text)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const bare = raw.replace(/(^\s*(?:-\s+)?|:\s+|[[{,]\s*)(?:"[^"]*"|'[^']*')/g, '$1""');
      if (/^\s*#/.test(bare) || /\s#/.test(bare)) found.push(index + 1);
    });
  return found;
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

// ── Which copy runs ─────────────────────────────────────────────────────────
//
// A harness can hand a session a user-level copy of this skill (under the home
// folder) while the repository the run is for keeps its own pinned copy. The
// two drift apart, and the user-level one would then run out-of-date rules.
// `whichCopy` is the comparison SKILL.md asks for before anything else: it is
// copied, not imported, into each Portable skill that runs it, so each one
// carries it.

/** The repository folders a harness reads skills from, in the order checked. */
export const PROJECT_SKILL_DIRS = /** @type {const} */ ([
  ".claude/skills",
  ".agents/skills",
  ".github/skills",
  ".cursor/skills",
]);

const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;

const realOrSelf = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/**
 * Whether the copy in `skillDir` is the repository's own, or the repository
 * has its own copy of skill `name` to load instead.
 * @param {string} name the skill's name, which is its folder's name
 * @param {{skillDir: string, cwd: string, exists?: (path: string) => boolean,
 *   real?: (path: string) => string, platform?: string}} at
 */
export function whichCopy(name, at) {
  const exists = at.exists ?? existsSync;
  const real = at.real ?? realOrSelf;
  // Two spellings of one Windows path may differ only in case.
  const key = (path) => ((at.platform ?? process.platform) === "win32" ? path.toLowerCase() : path);
  const within = (dir, path) => {
    const rel = relative(key(dir), key(path));
    return rel === "" || (!/^\.\.(?:[\\/]|$)/.test(rel) && !isAbsolute(rel));
  };
  let repository = null;
  for (let dir = resolve(at.cwd); ; dir = dirname(dir)) {
    // `.git` is a folder in a clone and a file in a worktree.
    if (exists(join(dir, ".git"))) {
      repository = dir;
      break;
    }
    if (dirname(dir) === dir) break;
  }
  const self = real(resolve(at.skillDir));
  const copies =
    repository === null
      ? []
      : PROJECT_SKILL_DIRS.map((dir) => `${dir}/${name}`).filter((dir) =>
          exists(join(repository, dir, "SKILL.md")),
        );
  // A repository copy that is a link to this folder is this copy.
  const ours =
    repository !== null &&
    (within(real(repository), self) ||
      copies.some((dir) => key(real(join(repository, dir))) === key(self)));
  const use = ours || copies.length === 0 ? "this" : "repository";
  return {
    skill: name,
    this_copy: self,
    repository,
    repository_copies: copies,
    use,
    load: use === "repository" ? join(repository, copies[0], "SKILL.md") : null,
  };
}

/**
 * `where <name> [--repo <dir>]`: print `whichCopy` for the script's own
 * folder; null on any other argument.
 */
function whichCopyCommand(argv, io) {
  const [, name, ...rest] = argv;
  if (name === undefined || !SKILL_NAME.test(name)) return null;
  if (rest.length !== 0 && (rest.length !== 2 || rest[0] !== "--repo" || rest[1].startsWith("--")))
    return null;
  const cwd = resolve(io.cwd ?? process.cwd(), rest[1] ?? ".");
  const skillDir = io.skillDir ?? dirname(fileURLToPath(import.meta.url));
  const result = whichCopy(name, { skillDir, cwd });
  return { code: 0, out: `${JSON.stringify(result, null, 2)}\n` };
}

/**
 * The hosts the QA person typed, from each `--host <name>=<host>`, as [name, host]
 * pairs. A string is the usage problem.
 *
 * @param {string[]} argv
 * @returns {[string, string][] | string}
 */
function typedHostArgs(argv) {
  /** @type {[string, string][]} */
  const pairs = [];
  for (const [n, arg] of argv.entries()) {
    if (arg !== "--host" || argv[n + 1] === undefined) continue;
    const text = argv[n + 1];
    const at = text.indexOf("=");
    if (at < 1 || at === text.length - 1)
      return `--host expects <name>=<host the QA person typed>, not \`${text}\``;
    pairs.push([text.slice(0, at), text.slice(at + 1)]);
  }
  return pairs;
}

/** The names of `config`'s `run.hosts` entries. */
function hostNames(config) {
  return new Set(
    (Array.isArray(config.run?.hosts) ? config.run.hosts : []).flatMap((entry) =>
      isMapping(entry) && typeof entry.name === "string" ? [entry.name] : [],
    ),
  );
}

/**
 * The typed hosts by `run.hosts` entry name, each name checked against `config`
 * (with any answers already merged). A string is the usage problem.
 *
 * @param {[string, string][]} pairs from `typedHostArgs`
 * @param {Record<string, any>} config
 * @returns {Record<string, string> | string}
 */
function typedHosts(pairs, config) {
  /** @type {Record<string, string>} */
  const typed = {};
  const named = hostNames(config);
  for (const [name, host] of pairs) {
    if (!named.has(name)) return `no \`run.hosts\` entry named \`${name}\` for --host to confirm`;
    typed[name] = host;
  }
  return typed;
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
 * `check --for plan --answers <file>`: the plan readiness with the answers
 * given up front merged over the config, as `render` merges them. Nothing is
 * written. The file must be inside the merged `working_dir`.
 *
 * @returns {{code: number, out: string} | null} null on bad usage
 */
function checkPlanAnswers(argv, repo, loaded) {
  const file = option(argv, "--answers")[0];
  if (file === undefined || file.startsWith("--")) return null;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  if (loaded.problems.length)
    return {
      code: 1,
      out: json({
        path: loaded.path,
        problems: loaded.problems,
        effective: null,
        readiness: planReadiness(loaded),
      }),
    };
  let read;
  try {
    read = readAnswersFile(repo, file);
  } catch (error) {
    if (error instanceof AnswersError) return { code: 2, out: `check: ${error.message}\n` };
    throw error;
  }
  const merged = mergeAnswers(loaded.config, read.answers);
  const problems = configProblems(merged).map((p) => `the answers: ${p}`);
  if (problems.length)
    return {
      code: 1,
      out: json({
        path: loaded.path,
        problems,
        effective: null,
        readiness: planReadiness({ ...loaded, problems }),
      }),
    };
  const effective = effectiveConfig(merged);
  const misplaced = answersPlaceProblem(repo, effective.working_dir, read.path);
  if (misplaced) return { code: 2, out: `check: ${misplaced}\n` };
  return {
    code: 0,
    out: json({
      path: loaded.path,
      problems: [],
      effective,
      readiness: planReadiness({ path: loaded.path, config: merged, problems: [] }),
      answers: { file, reused: reusedAnswersLine(file, read.answers) },
    }),
  };
}

/** A base branch as `origin/main` and `main` both name it. */
const baseName = (ref) => ref.replace(/^refs\/heads\//, "").replace(/^origin\//, "");

/**
 * `check --for run --answers <file>`: the run readiness with the run needs
 * given up front merged over the config, by `check --for plan --answers`'s
 * rules: the file is the JSON object `render` takes, read only from inside the
 * merged `working_dir`, and nothing is written. The file holds for the base
 * branch it was given for: with `--answers-base` and `--base` that differ, it
 * is not used, and the readiness is that of the config alone.
 *
 * @param {string[]} argv
 * @param {string} repo
 * @param {{path: string | null, config: Record<string, any>, runProblems: string[]}} loaded
 * @param {{plan: {plan: any, problems: string[]} | null, tools?: () => {chromium: boolean, ffmpeg: boolean}, typedPairs: [string, string][], read?: (path: string) => string | null | undefined}} given
 * @returns {{code: number, out: string} | null} null on bad usage
 */
function checkRunAnswers(
  argv,
  repo,
  loaded,
  { plan: planned, tools: ioTools, typedPairs, read: readFile },
) {
  const file = option(argv, "--answers")[0];
  if (file === undefined || file.startsWith("--")) return null;
  const [answersBase] = option(argv, "--answers-base");
  const [base] = option(argv, "--base");
  for (const flag of ["--answers-base", "--base"])
    if (argv.includes(flag) && (option(argv, flag)[0] ?? "--").startsWith("--")) return null;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const planProblems = planned ? { planProblems: planned.problems } : {};
  // Before the answers are merged, a name the config lacks is left out, not refused.
  const lenient = (config) =>
    Object.fromEntries(typedPairs.filter(([name]) => hostNames(config).has(name)));
  const readiness = (config, problems, typed = lenient(config)) =>
    runReadiness(
      { path: loaded.path, config, runProblems: problems },
      planned?.problems.length ? null : planned?.plan,
      ioTools ?? detectWebTools(repo, config),
      typed,
    );
  const planFailed = (planned?.problems.length ?? 0) > 0;
  if (loaded.runProblems.length)
    return {
      code: 1,
      out: json({
        path: loaded.path,
        problems: loaded.runProblems,
        ...planProblems,
        effective: null,
        readiness: readiness(loaded.config, loaded.runProblems),
      }),
    };
  if (answersBase !== undefined && base !== undefined && baseName(answersBase) !== baseName(base)) {
    const effective = effectiveConfig(loaded.config);
    return {
      code: planFailed ? 1 : 0,
      out: json({
        path: loaded.path,
        problems: [],
        ...planProblems,
        effective: { working_dir: effective.working_dir, run: effective.run },
        readiness: readiness(loaded.config, []),
        answers: {
          file,
          used: false,
          why: `the answers were given for \`${answersBase}\`, and this pull request's base is \`${base}\``,
        },
      }),
    };
  }
  let read;
  try {
    read = readAnswersFile(repo, file);
  } catch (error) {
    if (error instanceof AnswersError) return { code: 2, out: `check: ${error.message}\n` };
    throw error;
  }
  const merged = mergeAnswers(loaded.config, read.answers);
  const typed = typedHosts(typedPairs, merged);
  if (typeof typed === "string") return { code: 2, out: `check: ${typed}\n` };
  const problems = runProblems(merged, undefined, { read: readFile }).map(
    (p) => `the answers: ${p}`,
  );
  if (problems.length)
    return {
      code: 1,
      out: json({
        path: loaded.path,
        problems,
        ...planProblems,
        effective: null,
        readiness: readiness(merged, problems, typed),
      }),
    };
  const effective = effectiveConfig(merged);
  const misplaced = answersPlaceProblem(repo, effective.working_dir, read.path);
  if (misplaced) return { code: 2, out: `check: ${misplaced}\n` };
  return {
    code: planFailed ? 1 : 0,
    out: json({
      path: loaded.path,
      problems: [],
      ...planProblems,
      effective: { working_dir: effective.working_dir, run: effective.run },
      readiness: readiness(merged, [], typed),
      answers: { file, used: true, reused: reusedAnswersLine(file, read.answers, "Run") },
    }),
  };
}

/**
 * @param {string[]} argv the arguments after the script
 * @param {{read?: (path: string) => string | null, stdin?: () => string,
 *   tools?: () => {chromium: boolean, ffmpeg: boolean}}} [io]
 * @returns {{code: number, out: string}}
 */
export function main(argv, io = {}) {
  const [command] = argv;
  const repo = option(argv, "--repo")[0] ?? process.cwd();
  const read = io.read ?? repoReader(repo);
  const stdin = io.stdin ?? readStdin;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const loaded = readQaConfig(read);
  const typedPairs = typedHostArgs(argv);
  if (typeof typedPairs === "string") return { code: 2, out: `check: ${typedPairs}\n` };
  // With `--answers`, the names are checked against the config the answers are merged
  // into (`checkRunAnswers`): the answers may be what carries `run.hosts`.
  const withAnswers = argv.includes("--answers");
  const typed = withAnswers ? {} : typedHosts(typedPairs, loaded.config);
  if (typeof typed === "string") return { code: 2, out: `check: ${typed}\n` };
  const usage = {
    code: 2,
    out:
      "usage: node adapter.mjs check --for plan [--answers <file.json>] | check --for run [--plan <file>] [--host <name>=<typed host>]… [--answers <file.json> [--answers-base <branch> --base <branch>]] | " +
      "plan [<file>] < plan.md | host <url> [--target stack|url] [--confirmed <host>] | " +
      "hazards < changed-paths | " +
      "delivery [--label <name>]… | render [--write [--drop-comments]] < answers.json | " +
      "where <skill>   " +
      "[--repo <dir>]\n",
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
    // Each `Review:` box's Place is checked against the configured ones (ADR 0033).
    return validatePlan(text, { places: effectivePlaces(loaded.config) });
  };

  if (command === "where") return whichCopyCommand(argv, io) ?? usage;
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
      const { path, body } = renderConfigUpdate(loaded, JSON.parse(stdin()), { read });
      if (!argv.includes("--write")) return { code: 0, out: body };
      // Rewriting a commented YAML config drops its comments. The person
      // consented to the body, which has none, so `--write` refuses unless
      // `--drop-comments` says they agreed to lose them too (ADAPTER.md).
      const comments =
        loaded.path !== null && !path.endsWith(".json") ? yamlCommentLines(read(path) ?? "") : [];
      if (comments.length && !argv.includes("--drop-comments"))
        return {
          code: 3,
          out:
            `${path} has YAML comments (line ${comments.join(", ")}) that --write would drop; ` +
            "nothing was written. Tell the person; only if they agree to lose them, " +
            "run again with --write --drop-comments.\n",
        };
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
      if (argv.includes("--answers"))
        return (
          checkRunAnswers(argv, repo, loaded, {
            plan: planned,
            tools: io.tools,
            typedPairs,
            read,
          }) ?? usage
        );
      const readiness = runReadiness(
        loaded,
        planned?.problems.length ? null : planned?.plan,
        io.tools ?? detectWebTools(repo, loaded.config),
        typed,
      );
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
    if (argv.includes("--answers")) return checkPlanAnswers(argv, repo, loaded) ?? usage;
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
