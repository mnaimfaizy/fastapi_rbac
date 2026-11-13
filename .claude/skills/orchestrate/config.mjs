// The orchestrate config reader: the one place that turns
// `orchestrate.config.{yml,yaml,json}` into the repository facts the skill
// uses (CONFIG.md). The skill body names no repository command, skill, label
// or path; every one of them comes through here.
//
// WHY A PARSER, AND WHY THIS SMALL
//   The skill imports only Node built-ins, and Node ships no YAML parser. This
//   reader takes JSON whole, and YAML only in the subset CONFIG.md documents.
//   Anything outside that subset, any unknown key and any value of the wrong
//   shape is a **problem**, reported with its line in both dialects, never a
//   silent default (DESIGN.md, "The config reader"). The YAML subset parser is
//   copied from the `qa-plan` skill's reader, not imported: a Portable skill
//   carries everything it runs.
//
// THE YAML SUBSET
//   - block mappings and block sequences, indented with spaces; a sequence may
//     sit at its key's own indent (`regate:` then `- npm test`);
//   - plain, single-quoted or double-quoted scalars;
//   - flow lists and flow mappings that open and close on one line, nested
//     freely (`{ building: 2, shared: [database] }`, `[]`, `{}`);
//   - full-line `#` comments anywhere, and a trailing ` # comment`.
//   Every scalar is a string. Tabs, anchors, aliases, multi-line scalars,
//   escapes inside quotes and duplicate keys are outside it; JSON is the
//   dialect for anything the subset cannot say.
//
// ONE CHECKER PER TOP-LEVEL KEY
//   `SECTIONS` maps each top-level key to the function that checks it. A mode
//   that needs keys of its own adds its section there, in this file, and
//   CONFIG.md documents it; an unknown top-level key stays a problem.
//
// CLI (run from the repository root; `--repo <dir>` points elsewhere)
//   node config.mjs check [--answers <file.json>]
//       the config's path, its problems, the effective values (defaults
//       applied, answers merged in) and readiness: what the run still needs
//       to ask for, and notes to say. Prints JSON; exits 1 on any problem,
//       2 on bad usage.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Lookup order: the first file present is the config (CONFIG.md). */
export const CONFIG_FILES = /** @type {const} */ ([
  "orchestrate.config.yml",
  "orchestrate.config.yaml",
  "orchestrate.config.json",
]);

/** The five canonical triage roles. A repository maps each to its own label. */
export const TRIAGE_ROLES = /** @type {const} */ ([
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
]);

export const ROUTE_KEYS = /** @type {const} */ (["commit", "pull_request", "merge"]);
export const SKILL_KEYS = /** @type {const} */ (["implement", "triage", "review"]);
export const MODEL_KEYS = /** @type {const} */ (["analysis", "build", "review"]);
export const LIMIT_KEYS = /** @type {const} */ (["building", "shared"]);
export const DECISION_KEYS = /** @type {const} */ (["to", "marker"]);
export const DECISION_TARGETS = /** @type {const} */ (["pull-request", "issue-comment"]);
export const READY_KEYS = /** @type {const} */ (["review", "qa", "qa_labels"]);
export const REVIEW_RULES = /** @type {const} */ (["settled", "approved"]);
export const QA_RULES = /** @type {const} */ (["none", "report"]);
export const SPEC_KEYS = /** @type {const} */ (["landing", "integration_branch"]);
export const LANDINGS = /** @type {const} */ (["ask", "integration-branch", "per-ticket"]);

/** CONFIG.md's defaults. A key with no default here is asked for, or left to the harness. */
export const DEFAULTS = Object.freeze({
  run_dir: "tmp/orchestrate",
  building: 3,
  decisions: "pull-request",
  review: "settled",
  qa: "none",
  landing: "ask",
  integration_branch: "orchestrate/spec-<n>",
});

/**
 * Set `key` as an own property, even `__proto__`, which plain assignment
 * would turn into the object's prototype: hidden from every key check, and
 * its values read through the prototype unchecked.
 */
const setOwn = (map, key, value) =>
  Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });

// ── YAML subset ─────────────────────────────────────────────────────────────

const KEY_LINE = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*?)|[ \t]*)$/;
const SEQUENCE_LINE = /^-(?:[ \t]|$)/;
const indentOf = (line) => line.text.length - line.text.trimStart().length;

/** Problems a plain scalar raises: the YAML features outside the subset. */
function plainProblems(value, problem) {
  if (value.startsWith("&") || value.startsWith("*"))
    problem(
      `\`${value[0]}\` (anchor or alias) is outside the YAML subset CONFIG.md documents — ` +
        "write the config as JSON instead",
    );
  if (/^[|>][+-]?$/.test(value))
    problem("multi-line scalars are outside the YAML subset CONFIG.md documents");
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
        setOwn(out, String(key), value);
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
        'escapes inside "…" are outside the YAML subset CONFIG.md documents — ' +
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
      "a `#` comment inside a flow collection is outside the YAML subset CONFIG.md documents",
    );
  // A key stops at `:` already. In a value, real YAML refuses `{ a: b: c }`
  // and reads `[a: b]` as a mapping, so other tools would read it otherwise.
  if (!stops.includes(":") && /:(?:\s|$)/.test(value))
    problem(
      "a `: ` inside an unquoted value is outside the YAML subset CONFIG.md documents — quote the value",
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
      "a `: ` inside an unquoted value is outside the YAML subset CONFIG.md documents — quote the value",
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
      setOwn(map, key, valueFor(line, rest, indent, keyPath));
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
        setOwn(map, match[1], valueFor(line, match[2], keyIndent, `${itemPath}.${match[1]}`));
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

// ── JSON lines ──────────────────────────────────────────────────────────────

/**
 * The line each key path of a JSON text starts on, and its duplicate keys,
 * which `JSON.parse` would otherwise drop without a word. Call it only on
 * text `JSON.parse` accepts.
 *
 * @param {string} text
 * @returns {{lines: Map<string, number>, problems: string[]}}
 */
export function jsonLines(text) {
  const where = new Map();
  const problems = [];
  let i = 0;
  let line = 1;
  const skip = () => {
    while (i < text.length && /\s/.test(text[i])) {
      if (text[i] === "\n") line += 1;
      i += 1;
    }
  };
  const string = () => {
    let j = i + 1;
    while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
    const value = JSON.parse(text.slice(i, j + 1));
    i = j + 1;
    return value;
  };
  const value = (path) => {
    skip();
    const open = text[i];
    if (open === "{" || open === "[") {
      const close = open === "{" ? "}" : "]";
      const seen = new Set();
      i += 1;
      skip();
      if (text[i] === close) {
        i += 1;
        return;
      }
      for (let n = 0; ; n += 1) {
        skip();
        let child;
        if (open === "{") {
          const keyLine = line;
          const key = string();
          child = path ? `${path}.${key}` : key;
          if (seen.has(key)) problems.push(`line ${keyLine}: \`${child}\`: duplicate key`);
          seen.add(key);
          where.set(child, keyLine);
          skip();
          i += 1; // the `:`
        } else {
          child = `${path}[${n}]`;
          skip();
          where.set(child, line);
        }
        value(child);
        skip();
        const at = text[i];
        i += 1;
        if (at !== ",") return;
      }
    }
    if (open === '"') {
      string();
      return;
    }
    while (i < text.length && !/[\s,\]}]/.test(text[i])) i += 1;
  };
  value("");
  return { lines: where, problems };
}

// ── Shapes ──────────────────────────────────────────────────────────────────

const isMapping = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";

/** Repository-relative: never absolute or drive-relative, never leaving the repository, never its root. */
const isRepoPath = (v) =>
  nonEmpty(v) &&
  !/^(?:[A-Za-z]:|[\\/])/.test(v) &&
  !v.split(/[\\/]/).includes("..") &&
  v.split(/[\\/]/).some((part) => part !== "" && part !== ".");

/**
 * A checker that names each problem with its key path, and where it is. A
 * path with no location of its own (a value inside a YAML flow collection)
 * takes the location of the nearest enclosing path that has one.
 *
 * @param {Map<string, string>} [where] key path → `line 4`, or `<file> line 4`
 */
function problemSink(where) {
  const problems = [];
  const locate = (path) => {
    let p = path;
    while (p) {
      if (where?.has(p)) return where.get(p);
      const parent = p.replace(/(?:\.[^.[\]]+|\[\d+\])$/, "");
      if (parent === p) break;
      p = parent;
    }
    return undefined;
  };
  return {
    problems,
    add(path, message) {
      const at = locate(path);
      problems.push(`${at ? `${at}: ` : ""}\`${path}\`: ${message}`);
    },
  };
}

/**
 * True when `map` has `key` with a value. A key written with no value (`key:`
 * in YAML, `null` in JSON) is a problem: it reads like a setting, and the
 * default it would silently take may not be what was meant.
 */
function given(sink, map, key, path) {
  if (!Object.hasOwn(map, key)) return false;
  if (map[key] === null || map[key] === undefined) {
    sink.add(path, "no value: give one, or delete the key");
    return false;
  }
  return true;
}

function unknownKeys(sink, map, path, known) {
  for (const key of Object.keys(map))
    if (!known.includes(key))
      sink.add(
        path ? `${path}.${key}` : key,
        `unknown key (CONFIG.md documents: ${known.join(", ")})`,
      );
}

/** A mapping whose keys are all in `known`, each a non-empty string. */
function stringMapping(sink, value, path, known) {
  if (!isMapping(value)) return sink.add(path, "expected a mapping");
  unknownKeys(sink, value, path, known);
  for (const key of known)
    if (given(sink, value, key, `${path}.${key}`) && !nonEmpty(value[key]))
      sink.add(`${path}.${key}`, "expected a non-empty string");
}

/** A list of distinct items, each passing `ok`: `one` names an item, `many` the list's items. */
function distinctList(sink, value, path, ok, one, many) {
  if (!Array.isArray(value)) return sink.add(path, `expected a list of ${many}`);
  const seen = new Set();
  value.forEach((item, n) => {
    if (!ok(item)) return sink.add(`${path}[${n}]`, `expected ${one}`);
    if (seen.has(item)) sink.add(`${path}[${n}]`, `\`${item}\` is listed twice`);
    seen.add(item);
  });
}

/**
 * A branch name pattern: `<n>` (the spec's number) at least once, no other
 * `<` or `>`, and, with `<n>` filled in, a name `git check-ref-format --branch`
 * accepts. Two specs never share an integration branch, and a typo such as
 * `<spec>` is never left in a branch name.
 */
function branchPatternProblem(v) {
  if (!nonEmpty(v)) return "expected a branch name pattern";
  if (!v.includes("<n>")) return "expected `<n>` in it, for the spec's number";
  const name = v.replaceAll("<n>", "1");
  if (/[<>]/.test(name)) return "`<n>` is the only placeholder";
  const bad =
    /[\x00-\x20\x7f~^:?*[\\]/.test(name) ||
    name.startsWith("-") ||
    name.includes("..") ||
    name.includes("@{") ||
    name === "@" ||
    name.endsWith(".") ||
    name.split("/").some((part) => part === "" || part.startsWith(".") || part.endsWith(".lock"));
  return bad ? "expected a valid git branch name once `<n>` is filled in" : null;
}

const isCount = (v) =>
  (typeof v === "number" && Number.isSafeInteger(v) && v >= 1) ||
  (typeof v === "string" && /^[1-9]\d{0,8}$/.test(v));

/**
 * The checker for each top-level key, in CONFIG.md's order. A mode that needs
 * keys of its own adds its section here.
 *
 * @type {Record<string, (sink: ReturnType<typeof problemSink>, value: unknown, config: Record<string, any>) => void>}
 */
export const SECTIONS = {
  run_dir(sink, value) {
    if (!isRepoPath(value)) sink.add("run_dir", "expected a relative path inside the repository");
  },
  read_first(sink, value) {
    distinctList(
      sink,
      value,
      "read_first",
      isRepoPath,
      "a relative path inside the repository",
      "relative paths inside the repository",
    );
  },
  routes(sink, value) {
    stringMapping(sink, value, "routes", ROUTE_KEYS);
  },
  regate(sink, value) {
    distinctList(sink, value, "regate", nonEmpty, "a command", "commands");
  },
  skills(sink, value) {
    stringMapping(sink, value, "skills", SKILL_KEYS);
  },
  triage_labels(sink, value) {
    if (typeof value === "string") {
      if (!isRepoPath(value))
        sink.add("triage_labels", "expected a relative path inside the repository");
      return;
    }
    if (!isMapping(value))
      return sink.add(
        "triage_labels",
        "expected the path of the repository's own mapping of triage roles to labels, " +
          "or a mapping of the roles to labels",
      );
    unknownKeys(sink, value, "triage_labels", TRIAGE_ROLES);
    const labels = new Map();
    for (const role of TRIAGE_ROLES) {
      const path = `triage_labels.${role}`;
      if (!given(sink, value, role, path)) continue;
      if (!nonEmpty(value[role])) {
        sink.add(path, "expected a label name");
        continue;
      }
      if (labels.has(value[role]))
        sink.add(path, `\`${value[role]}\` is also the label for \`${labels.get(value[role])}\``);
      else labels.set(value[role], role);
    }
  },
  models(sink, value) {
    stringMapping(sink, value, "models", MODEL_KEYS);
  },
  limits(sink, value) {
    if (!isMapping(value)) return sink.add("limits", "expected a mapping");
    unknownKeys(sink, value, "limits", LIMIT_KEYS);
    if (given(sink, value, "building", "limits.building") && !isCount(value.building))
      sink.add("limits.building", "expected a whole number of 1 or more");
    if (given(sink, value, "shared", "limits.shared"))
      distinctList(
        sink,
        value.shared,
        "limits.shared",
        nonEmpty,
        "a resource name",
        "resource names",
      );
  },
  decisions(sink, value) {
    if (!isMapping(value)) return sink.add("decisions", "expected a mapping");
    unknownKeys(sink, value, "decisions", DECISION_KEYS);
    if (given(sink, value, "to", "decisions.to") && !DECISION_TARGETS.includes(value.to))
      sink.add("decisions.to", `expected one of: ${DECISION_TARGETS.join(", ")}`);
    if (given(sink, value, "marker", "decisions.marker") && !nonEmpty(value.marker))
      sink.add("decisions.marker", "expected a non-empty string");
  },
  ready_to_merge(sink, value) {
    if (!isMapping(value)) return sink.add("ready_to_merge", "expected a mapping");
    unknownKeys(sink, value, "ready_to_merge", READY_KEYS);
    const path = (key) => `ready_to_merge.${key}`;
    if (given(sink, value, "review", path("review")) && !REVIEW_RULES.includes(value.review))
      sink.add(path("review"), `expected one of: ${REVIEW_RULES.join(", ")}`);
    if (given(sink, value, "qa", path("qa")) && !QA_RULES.includes(value.qa))
      sink.add(path("qa"), `expected one of: ${QA_RULES.join(", ")}`);
    if (given(sink, value, "qa_labels", path("qa_labels"))) {
      distinctList(
        sink,
        value.qa_labels,
        path("qa_labels"),
        nonEmpty,
        "a label name",
        "label names",
      );
      if (value.qa !== "report")
        sink.add(
          path("qa_labels"),
          "only `qa: report` is limited to labels; set it, or delete this key",
        );
    }
  },
  spec(sink, value) {
    if (!isMapping(value)) return sink.add("spec", "expected a mapping");
    unknownKeys(sink, value, "spec", SPEC_KEYS);
    if (given(sink, value, "landing", "spec.landing") && !LANDINGS.includes(value.landing))
      sink.add("spec.landing", `expected one of: ${LANDINGS.join(", ")}`);
    if (given(sink, value, "integration_branch", "spec.integration_branch")) {
      const problem = branchPatternProblem(value.integration_branch);
      if (problem) sink.add("spec.integration_branch", problem);
    }
  },
};

/**
 * Every problem in a parsed config: unknown keys, keys with no value, and
 * values of the wrong shape.
 *
 * @param {Record<string, unknown>} config
 * @param {Map<string, string>} [where] key path → location
 * @returns {string[]}
 */
export function configProblems(config, where) {
  const sink = problemSink(where);
  const known = Object.keys(SECTIONS);
  unknownKeys(sink, config, "", known);
  for (const key of known)
    if (given(sink, config, key, key)) SECTIONS[key](sink, config[key], config);
  return sink.problems;
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** `line N` for every key path, optionally prefixed with the file it is in. */
const located = (lines, file = "") =>
  new Map([...lines].map(([path, no]) => [path, `${file ? `${file} ` : ""}line ${no}`]));

/**
 * Parse a config's text in the dialect its name says, with no shape check.
 *
 * @param {string} path
 * @param {string} text
 * @returns {{value: Record<string, unknown>, problems: string[], lines: Map<string, number>}}
 *   `problems` are syntax problems only.
 */
export function parseText(path, text, what = "the config") {
  const body = String(text).replace(/^﻿/, "");
  if (!path.endsWith(".json")) return parseYamlSubset(body);
  let value;
  try {
    value = JSON.parse(body);
  } catch (error) {
    return {
      value: {},
      problems: [`not valid JSON: ${error instanceof Error ? error.message : error}`],
      lines: new Map(),
    };
  }
  if (!isMapping(value))
    return { value: {}, problems: [`${what} must be a JSON object`], lines: new Map() };
  return { value, ...jsonLines(body) };
}

/**
 * Parse and check a config's text.
 *
 * @param {string} path the file name, which gives the dialect
 * @param {string} text
 * @returns {{config: Record<string, unknown>, problems: string[], lines: Map<string, number>}}
 */
export function parseConfig(path, text) {
  const { value, problems, lines } = parseText(path, text);
  return {
    config: value,
    problems: [...problems, ...configProblems(value, located(lines))],
    lines,
  };
}

/**
 * Find, parse and check the config.
 *
 * @param {(path: string) => string | null | undefined} read a repository
 *   file's text, or null when it is not there
 * @param {{answers?: {path: string, text: string} | null, exists?: (path: string) => boolean}} [options]
 *   `answers`: the answers given in chat, as a JSON object, laid over the
 *   config; `exists`: whether a repository path (file or folder) is there.
 * @returns {{path: string | null, config: Record<string, any>, problems: string[], answers: string | null}}
 *   `path` is null when the repository has no config: not an error, the
 *   readiness check says what to ask for.
 */
export function readConfig(read, { answers = null, exists } = {}) {
  let path = null;
  let parsed = { value: {}, problems: [], lines: new Map() };
  for (const candidate of CONFIG_FILES) {
    let text;
    try {
      text = read(candidate);
    } catch (error) {
      // There but unreadable (a folder, no permission): never skipped as if absent.
      path = candidate;
      parsed.problems = [`${candidate} cannot be read (${error?.code ?? error})`];
      break;
    }
    if (text === null || text === undefined) continue;
    path = candidate;
    parsed = parseText(candidate, text);
    break;
  }
  const where = located(parsed.lines);
  const problems = [...parsed.problems];
  let config = parsed.value;

  if (answers) {
    const answered = parseText(".json", answers.text, "the answers");
    problems.push(...answered.problems.map((problem) => `${answers.path}: ${problem}`));
    // An answered key's location is in the answers file, never the config's.
    for (const key of Object.keys(answered.value)) {
      const replaced =
        isMapping(config[key]) && isMapping(answered.value[key])
          ? Object.keys(answered.value[key]).map((sub) => `${key}.${sub}`)
          : [key];
      for (const path of [...where.keys()])
        if (
          replaced.some((r) => path === r || path.startsWith(`${r}.`) || path.startsWith(`${r}[`))
        )
          where.delete(path);
    }
    // A mapping merged key by key keeps the config's location for itself, so
    // a config value with no line of its own is not placed in the answers file.
    const merged = (key) => isMapping(config[key]) && isMapping(answered.value[key]);
    for (const [key, at] of located(answered.lines, answers.path))
      if (!(merged(key) && where.has(key))) where.set(key, at);
    config = mergeAnswers(config, answered.value);
  }

  const shape = configProblems(config, where);
  problems.push(...shape);
  if (!shape.length && exists) problems.push(...missingPaths(config, where, exists));
  return { path, config, problems, answers: answers?.path ?? null };
}

/**
 * The answers laid over the config: a mapping answered for a mapping is
 * merged key by key, anything else replaces the config's value.
 *
 * @param {Record<string, any>} config
 * @param {Record<string, any>} answers
 */
export function mergeAnswers(config, answers) {
  const merged = { ...config };
  for (const [key, value] of Object.entries(answers))
    setOwn(
      merged,
      key,
      isMapping(config[key]) && isMapping(value) ? { ...config[key], ...value } : value,
    );
  return merged;
}

/** A document a brief sends every Delegation to must be there. */
function missingPaths(config, where, exists) {
  const sink = problemSink(where);
  (config.read_first ?? []).forEach((path, n) => {
    if (!exists(path)) sink.add(`read_first[${n}]`, `\`${path}\` is not in the repository`);
  });
  if (typeof config.triage_labels === "string" && !exists(config.triage_labels))
    sink.add("triage_labels", `\`${config.triage_labels}\` is not in the repository`);
  return sink.problems;
}

/**
 * The values a run uses: the config's own, or CONFIG.md's defaults. `null`
 * means not set and no default: the readiness check asks for it, or the
 * harness's own choice applies. Read a config with no problems.
 *
 * @param {Record<string, any>} config
 */
export function effectiveConfig(config) {
  const section = (key) => (isMapping(config[key]) ? config[key] : {});
  const pick = (map, keys) => Object.fromEntries(keys.map((key) => [key, map[key] ?? null]));
  const routes = section("routes");
  const limits = section("limits");
  const decisions = section("decisions");
  const ready = section("ready_to_merge");
  const spec = section("spec");
  return {
    run_dir: config.run_dir ?? DEFAULTS.run_dir,
    read_first: Array.isArray(config.read_first) ? config.read_first : null,
    routes: pick(routes, ROUTE_KEYS),
    regate: Array.isArray(config.regate) ? config.regate : null,
    skills: pick(section("skills"), SKILL_KEYS),
    triage_labels: triageLabels(config.triage_labels),
    models: pick(section("models"), MODEL_KEYS),
    limits: {
      building: limits.building === undefined ? DEFAULTS.building : Number(limits.building),
      shared: limits.shared ?? [],
    },
    decisions: { to: decisions.to ?? DEFAULTS.decisions, marker: decisions.marker ?? null },
    ready_to_merge: {
      review: ready.review ?? DEFAULTS.review,
      qa: ready.qa ?? DEFAULTS.qa,
      qa_labels: ready.qa_labels ?? [],
    },
    spec: {
      landing: spec.landing ?? DEFAULTS.landing,
      integration_branch: spec.integration_branch ?? DEFAULTS.integration_branch,
    },
  };
}

/**
 * Where each triage role's label comes from: the repository's own mapping
 * document (read at run time), the config's mapping, or the default, where
 * each label is its role's name.
 *
 * @returns {{from: "default" | "config" | "document", document: string | null, labels: Record<string, string> | null}}
 */
function triageLabels(value) {
  if (typeof value === "string") return { from: "document", document: value, labels: null };
  const map = isMapping(value) ? value : {};
  return {
    from: isMapping(value) ? "config" : "default",
    document: null,
    labels: Object.fromEntries(TRIAGE_ROLES.map((role) => [role, map[role] ?? role])),
  };
}

/**
 * What the run still needs before analysis. `needs` are asked for, in one
 * message; a `note` is said, and the run goes on.
 *
 * @param {{path: string | null, config: Record<string, any>, problems: string[]}} read
 * @returns {{ready: boolean, needs: string[], notes: string[]}}
 */
export function readiness({ path, config, problems }) {
  if (problems.length)
    return { ready: false, needs: ["a config with no problems: fix each one listed"], notes: [] };
  const needs = [];
  const notes = [];
  const effective = effectiveConfig(config);
  if (path === null) notes.push(`no ${CONFIG_FILES.join(" / ")} at the repository root`);
  if (effective.read_first === null)
    needs.push(
      "read_first: the documents every Delegation reads before it starts, " +
        "such as the agent instructions, the contributing guide and the glossary (or none)",
    );
  if (effective.routes.commit === null)
    needs.push(
      "routes.commit: how a Delegation commits (the convention, and the command or skill)",
    );
  if (effective.routes.pull_request === null)
    needs.push("routes.pull_request: how a Delegation opens its pull request");
  if (effective.regate === null)
    needs.push("regate: the commands that re-check a finished branch locally (or none)");
  else if (!effective.regate.length)
    notes.push("no re-gate commands: a finished branch is checked by its CI alone");
  for (const key of SKILL_KEYS)
    if (effective.skills[key] === null) notes.push(`no \`skills.${key}\`: ${SKILL_NOTES[key]}`);
  for (const key of MODEL_KEYS)
    if (effective.models[key] === null)
      notes.push(`no \`models.${key}\`: that work runs on the harness's default model`);
  if (effective.triage_labels.from === "default")
    notes.push("no `triage_labels`: each triage role's label is taken to be the role's own name");
  if (effective.triage_labels.from === "document")
    notes.push(
      `the triage roles' labels are read from \`${effective.triage_labels.document}\` at the start of the run`,
    );
  return { ready: needs.length === 0, needs, notes };
}

const SKILL_NOTES = {
  implement: "a building brief names no skill to implement with",
  triage: "an issue that is not ready for an agent is analysed with no named skill",
  review: "a building brief's code-review phase names no skill to review with",
};

// ── CLI ─────────────────────────────────────────────────────────────────────

/** A repository file's text, or null when it is not there; any other failure throws. */
function repoReader(repo) {
  return (path) => {
    try {
      return readFileSync(join(repo, path), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
      throw error;
    }
  };
}

const inside = (dir, path) => {
  const rel = relative(dir, path);
  return rel !== "" && !/^\.\.(?:[\\/]|$)/.test(rel) && !isAbsolute(rel);
};

const USAGE = "usage: node config.mjs check [--answers <file.json>] [--repo <dir>]\n";

/**
 * @param {string[]} argv the arguments after the script
 * @param {{read?: (path: string) => string | null, exists?: (path: string) => boolean, cwd?: string}} [io]
 * @returns {{code: number, out: string}}
 */
export function main(argv, io = {}) {
  const usage = { code: 2, out: USAGE };
  const [command, ...rest] = argv;
  if (command !== "check") return usage;
  const options = {};
  for (let n = 0; n < rest.length; n += 2) {
    const [name, value] = [rest[n], rest[n + 1]];
    if (!["--answers", "--repo"].includes(name) || value === undefined || value.startsWith("--"))
      return usage;
    if (Object.hasOwn(options, name)) return usage;
    options[name] = value;
  }
  const repo = resolve(io.cwd ?? process.cwd(), options["--repo"] ?? ".");
  const read = io.read ?? repoReader(repo);
  const exists = io.exists ?? ((path) => existsSync(join(repo, path)));

  let answers = null;
  if (options["--answers"] !== undefined) {
    // Read and contained against the same path: relative to the repository.
    const file = relative(repo, resolve(repo, options["--answers"])).split("\\").join("/");
    let text;
    try {
      text = read(file);
    } catch (error) {
      return {
        code: 2,
        out: `the answers file \`${file}\` cannot be read (${error?.code ?? error})\n`,
      };
    }
    if (text === null || text === undefined)
      return { code: 2, out: `no answers file at \`${file}\`\n` };
    answers = { path: file, text };
  }
  const loaded = readConfig(read, { answers, exists });
  if (answers && !loaded.problems.length) {
    // Answers are kept in the run folder, which is gitignored, so they are
    // never committed by mistake and `--resume` finds them again.
    const runDir = effectiveConfig(loaded.config).run_dir;
    if (!inside(resolve(repo, runDir), resolve(repo, answers.path)))
      return {
        code: 2,
        out: `the answers file \`${answers.path}\` must be inside the run folder \`${runDir}\`\n`,
      };
  }
  const result = {
    path: loaded.path,
    answers: loaded.answers,
    problems: loaded.problems,
    effective: loaded.problems.length ? null : effectiveConfig(loaded.config),
    readiness: readiness(loaded),
  };
  return { code: loaded.problems.length ? 1 : 0, out: `${JSON.stringify(result, null, 2)}\n` };
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
