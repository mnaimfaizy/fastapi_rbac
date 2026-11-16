#!/usr/bin/env node
// The config reader: one place that turns `address-pr-review.config.*` into
// the effective settings for a Response round (ADAPTER.md).
//
// WHY A PARSER, AND WHY THIS SMALL
//   The skill imports only Node built-ins (DESIGN.md, Boundary), and Node
//   ships no YAML parser. The pattern is the `instruction-drift-audit` skill's
//   reader: JSON is read whole, YAML only in the subset ADAPTER.md documents,
//   and anything outside that subset, or of the wrong shape, is a **problem**
//   reported with its line, never a silent default. Every key here is a scalar
//   or a list of strings, so the subset is smaller than that skill's: no
//   nested mappings at all.
//
// THE YAML SUBSET
//   - one top-level mapping, its keys at column 1;
//   - plain, single- or double-quoted scalars, and a trailing ` # comment`;
//   - a list as a block sequence of scalars (indented, or at the key's own
//     indent) or a one-line flow list (`[a, 'b']`, `[]`);
//   - full-line `#` comments anywhere.
//   `true` and `false` are booleans; every other value is a string.
//
// Usage: node adapter.mjs check [--repo <dir>]
//   Prints `{path, config}` as JSON and exits 0, or prints each problem and
//   exits 1. Exit 2 is a usage error.

import { readFileSync } from "node:fs";
import { isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Lookup order: the first file present is the config (ADAPTER.md). */
export const ADAPTER_FILES = /** @type {const} */ ([
  "address-pr-review.config.yml",
  "address-pr-review.config.yaml",
  "address-pr-review.config.json",
]);

/** Every key ADAPTER.md documents, with its default. */
export const DEFAULTS = Object.freeze({
  reviewer_logins: Object.freeze(["github-actions"]),
  working_dir: "tmp/address-pr-review",
  worktree: true,
  commit_command: null,
  push_command: null,
});

const KEYS = Object.keys(DEFAULTS);

/**
 * @typedef {{line: number, message: string}} Problem
 */

/** `line N: message`, as every command prints a problem. */
export const formatProblem = (problem) => `line ${problem.line}: ${problem.message}`;

const KEY_LINE = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*?)|[ \t]*)$/;
const SEQUENCE_LINE = /^-(?:[ \t]|$)/;
const indentOf = (text) => text.length - text.trimStart().length;

/**
 * One scalar or flow list.
 *
 * @param {string} raw the text after `key:` or `- `
 * @param {(message: string) => void} problem
 * @returns {string | boolean | string[]}
 */
function scalar(raw, problem) {
  const text = raw.trim();
  const quote = text[0];
  if (quote === "'" || quote === '"') {
    const close = text.indexOf(quote, 1);
    if (close === -1) {
      problem(`unterminated ${quote} quote`);
      return text.slice(1);
    }
    const rest = text.slice(close + 1);
    if (rest.trim() !== "" && !/^\s+#/.test(rest))
      problem(`unexpected text after the closing quote: ${rest.trim()}`);
    return text.slice(1, close);
  }

  const value = text.replace(/(^|\s+)#.*$/, "").trim();
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) {
      problem("a flow list must close on the same line with `]`");
      return [];
    }
    return flowItems(value.slice(1, -1), problem);
  }
  if (value.startsWith("{") || value.startsWith("&") || value.startsWith("*"))
    problem(
      `\`${value[0]}\` (flow mapping, anchor, or alias) is outside the YAML subset ` +
        "ADAPTER.md documents — write the config as JSON instead",
    );
  if (/^[|>][+-]?$/.test(value))
    problem("multi-line scalars are outside the YAML subset ADAPTER.md documents");
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

/**
 * The items of a one-line flow list, split on commas outside quotes. An empty
 * item (`[a, , b]`, `[a,]`) is a problem, never silently dropped; `[]` is the
 * empty list.
 *
 * @param {string} inner the text between `[` and `]`
 * @param {(message: string) => void} problem
 * @returns {string[]}
 */
function flowItems(inner, problem) {
  if (inner.trim() === "") return [];
  const raw = [];
  let current = "";
  let quote = null;
  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === ",") {
      raw.push(current);
      current = "";
    } else current += char;
  }
  raw.push(current);
  if (quote) problem(`unterminated ${quote} quote`);
  const items = [];
  for (const item of raw) {
    const text = item.trim();
    if (text === "") problem("an empty list item");
    else items.push(text.replace(/^(['"])(.*)\1$/, "$2"));
  }
  return items;
}

/**
 * Parse the documented YAML subset.
 *
 * @param {string} text
 * @returns {{config: Record<string, unknown>, lines: Record<string, number>, problems: Problem[]}}
 *   `lines` gives the line each top-level key is on.
 */
export function parseConfigYaml(text) {
  /** @type {Problem[]} */
  const problems = [];
  const at = (line, message) => problems.push({ line, message });
  const lines = [];
  String(text)
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const no = index + 1;
      if (raw.trim() === "" || /^\s*#/.test(raw)) return;
      if (/^\s*\t/.test(raw)) return at(no, "indented with a tab; use spaces");
      lines.push({ text: raw.replace(/\s+$/, ""), no });
    });

  /** @type {Record<string, unknown>} */
  const config = {};
  /** @type {Record<string, number>} */
  const keyLines = {};
  let pos = 0;
  if (lines.length && indentOf(lines[0].text) !== 0)
    at(lines[0].no, "the first key must start at column 1");

  while (pos < lines.length) {
    const line = lines[pos];
    pos += 1;
    const indent = indentOf(line.text);
    const body = line.text.slice(indent);
    if (indent > 0 && pos > 1) {
      at(line.no, "unexpected indentation");
      continue;
    }
    const match = body.match(KEY_LINE);
    if (!match) {
      at(line.no, `expected \`key: value\`, found \`${body}\``);
      continue;
    }
    const [, key, rest] = match;
    if (Object.hasOwn(config, key)) at(line.no, `duplicate key \`${key}\``);
    keyLines[key] = line.no;

    if (rest !== undefined && rest !== "" && !rest.startsWith("#")) {
      config[key] = scalar(rest, (message) => at(line.no, message));
      continue;
    }
    // A bare `key:`: a block sequence below it, or nothing (the default).
    const items = [];
    const problemsBefore = problems.length;
    let sequence = false;
    while (pos < lines.length) {
      const next = lines[pos];
      const nextIndent = indentOf(next.text);
      const nextBody = next.text.slice(nextIndent);
      const isItem = SEQUENCE_LINE.test(nextBody);
      if (nextIndent === 0 && !isItem) break;
      pos += 1;
      if (!isItem) {
        at(
          next.no,
          KEY_LINE.test(nextBody)
            ? "nested mappings are outside the YAML subset ADAPTER.md documents"
            : "unexpected indentation",
        );
        continue;
      }
      sequence = true;
      const content = nextBody.replace(/^-[ \t]*/, "");
      if (content === "" || content.startsWith("#")) {
        at(next.no, "an empty list item");
        continue;
      }
      if (KEY_LINE.test(content) && !/^['"]/.test(content)) {
        at(next.no, "nested mappings are outside the YAML subset ADAPTER.md documents");
        continue;
      }
      items.push(scalar(content, (message) => at(next.no, message)));
    }
    // A block with a problem in it is not read: the problem is reported, and
    // the key takes its default, rather than a list missing the bad item.
    config[key] = sequence && problems.length === problemsBefore ? items : null;
  }
  return withShapes(config, keyLines, problems);
}

/**
 * Parse a JSON config.
 *
 * @param {string} text
 * @returns {{config: Record<string, unknown>, lines: Record<string, number>, problems: Problem[]}}
 */
export function parseConfigJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      config: {},
      lines: {},
      problems: [{ line: jsonErrorLine(text, message), message: `not valid JSON: ${message}` }],
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    return {
      config: {},
      lines: {},
      problems: [{ line: 1, message: "the config must be a JSON object" }],
    };
  /** @type {Record<string, number>} */
  const keyLines = {};
  const textLines = String(text).split(/\r?\n/);
  for (const key of Object.keys(parsed)) {
    // The line where the key itself stands (`"key":`), not a value naming it.
    const quoted = JSON.stringify(key);
    const index = textLines.findIndex((line) => {
      const at = line.indexOf(quoted);
      return at !== -1 && /^\s*:/.test(line.slice(at + quoted.length));
    });
    keyLines[key] = index === -1 ? 1 : index + 1;
  }
  return withShapes(parsed, keyLines, []);
}

/** The line a JSON.parse error points at: from `(line N` or `position N`. */
function jsonErrorLine(text, message) {
  const line = /\bline (\d+)/.exec(message);
  if (line) return Number(line[1]);
  const position = /\bposition (\d+)/.exec(message);
  if (position) return String(text).slice(0, Number(position[1])).split("\n").length;
  return 1;
}

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\[bot\])?$/;
/**
 * A token of `push_command` that would force-push, delete or mirror: a
 * short-flag group holding `f` or `d` (`-f`, `-vf`, `-d`), a long option git
 * would expand to `--force*`, `--delete`, `--mirror` or `--prune` (it accepts
 * unambiguous abbreviations), or a refspec starting with `+` or `:`. Quotes
 * are stripped first. An accident guard on a command the repository writes,
 * not a security boundary (ADAPTER.md).
 */
const DESTRUCTIVE = [/^-[A-Za-z]*[fd][A-Za-z]*$/, /^--(?:for|de|mi|pru)/, /^[+:]/];
const destructiveToken = (command) =>
  command
    .split(/\s+/)
    .map((token) => token.replace(/^['"]/, ""))
    .find((token) => DESTRUCTIVE.some((pattern) => pattern.test(token)));

/** One check per documented key: null when the value is fine. */
const SHAPES = {
  reviewer_logins: (v) => {
    if (!Array.isArray(v) || !v.every((item) => typeof item === "string"))
      return "expected a list of logins";
    if (v.length === 0) return "expected a non-empty list of logins";
    const bad = v.find((login) => !LOGIN.test(login));
    return bad === undefined ? null : `\`${bad}\` is not a GitHub login`;
  },
  working_dir: (v) => {
    if (typeof v !== "string" || v === "")
      return "expected a path, relative to the repository root";
    if (isAbsolute(v) || /^[A-Za-z]:/.test(v) || v.startsWith("/"))
      return "expected a path relative to the repository root, not an absolute one";
    const normal = normalize(v).replaceAll("\\", "/");
    if (normal === ".." || normal.startsWith("../")) return "expected a path inside the repository";
    return null;
  },
  worktree: (v) => (typeof v === "boolean" ? null : "expected true or false"),
  commit_command: (v) => {
    if (typeof v !== "string" || v.trim() === "") return "expected a string";
    return v.includes("{message_file}")
      ? null
      : "must contain `{message_file}`, where the commit message file's path goes";
  },
  push_command: (v) => {
    if (typeof v !== "string" || v.trim() === "") return "expected a string";
    if (!v.includes("{branch}"))
      return "must contain `{branch}`, where the pull request's head branch goes";
    const token = destructiveToken(v);
    return token === undefined
      ? null
      : `must never force-push, delete or mirror (\`${token}\`; see ADAPTER.md)`;
  },
};

function withShapes(config, keyLines, problems) {
  const all = [...problems];
  for (const [key, value] of Object.entries(config)) {
    const line = keyLines[key] ?? 1;
    if (!KEYS.includes(key)) {
      all.push({
        line,
        message: `unknown key \`${key}\` (ADAPTER.md documents: ${KEYS.join(", ")})`,
      });
      continue;
    }
    if (value === null || value === undefined) continue;
    const problem = SHAPES[key](value);
    if (problem) all.push({ line, message: `\`${key}\`: ${problem}` });
  }
  all.sort((a, b) => a.line - b.line);
  return { config, lines: keyLines, problems: all };
}

/**
 * Find and read the config, and apply the defaults.
 *
 * @param {(path: string) => string | null | undefined} read a repository
 *   file's text, or null when it is not there
 * @returns {{path: string | null, config: typeof DEFAULTS, problems: Problem[]}}
 *   `path` is null when the repository has no config: not an error. A key
 *   that is absent, empty, unknown or of the wrong shape takes its default;
 *   the problem says which.
 */
export function readConfig(read) {
  for (const path of ADAPTER_FILES) {
    const text = read(path);
    if (text === null || text === undefined) continue;
    const parsed = path.endsWith(".json") ? parseConfigJson(text) : parseConfigYaml(text);
    const wrong = new Set(
      parsed.problems.map((p) => /^`([^`]+)`:/.exec(p.message)?.[1]).filter(Boolean),
    );
    const config = { ...DEFAULTS };
    for (const key of KEYS) {
      const value = parsed.config[key];
      if (value !== null && value !== undefined && !wrong.has(key)) config[key] = value;
    }
    return { path, config, problems: parsed.problems };
  }
  return { path: null, config: DEFAULTS, problems: [] };
}

/** Read `path` under `repo`, or null when it is not there. */
const repoReader = (repo) => (path) => {
  try {
    return readFileSync(join(repo, path), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
};

function main(argv) {
  const [command, ...rest] = argv;
  const repoFlag = rest.indexOf("--repo");
  const repo = repoFlag === -1 ? process.cwd() : rest[repoFlag + 1];
  if (command !== "check" || (repoFlag !== -1 && !repo)) {
    process.stderr.write("usage: adapter.mjs check [--repo <dir>]\n");
    return 2;
  }
  const { path, config, problems } = readConfig(repoReader(repo));
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`${path} ${formatProblem(problem)}\n`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify({ path, config }, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  process.exitCode = main(process.argv.slice(2));
