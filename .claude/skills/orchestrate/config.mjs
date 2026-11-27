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
//       applied, answers merged in), the harness and tracker reports, and
//       readiness: what the run still needs to ask for, and notes to say.
//       Prints JSON; exits 1 on any problem, 2 on bad usage.
//   node config.mjs regate <sha> --out <file> [--repo <dir>]
//       runs the config's `regate` commands in a detached worktree at <sha>
//       (made beside <file>, which must be inside the run folder, and removed
//       after), writes each command's result to <file>, and exits 1 when any
//       failure is not on `regate.allowed_failures`, naming it.
//   node config.mjs land <branch> --cut <sha> --onto <integration>
//       --fence <glob>... [--repo <dir>]
//       the checks before a ticket lands on a spec's integration branch, then
//       `git update-ref refs/heads/<integration> <new> <old>`. Never merges,
//       rebases or pushes. Prints JSON; exits 1 naming the cause of a refusal.
//   node config.mjs where orchestrate [--repo <dir>]
//       whether this copy of the skill is the repository's own, or the
//       repository has its own copy to load instead (`whichCopy`). Prints
//       JSON; exits 0, 2 on bad usage.

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
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
export const MODEL_KEYS = /** @type {const} */ (["analysis", "build", "review", "qa"]);
export const LIMIT_KEYS = /** @type {const} */ (["building", "shared"]);
export const DECISION_KEYS = /** @type {const} */ (["to", "marker"]);
export const DECISION_TARGETS = /** @type {const} */ (["pull-request", "issue-comment"]);
export const READY_KEYS = /** @type {const} */ (["review", "qa", "qa_labels", "review_workflow"]);
export const REVIEW_RULES = /** @type {const} */ (["settled", "approved"]);
export const QA_RULES = /** @type {const} */ (["none", "report"]);
/**
 * `ready_to_merge.review_workflow`'s two words. Any other value is the path
 * of the Caller of Agent-kit's review workflow, under `.github/workflows/`.
 */
export const REVIEW_WORKFLOW_RULES = /** @type {const} */ (["detect", "none"]);
const CALLER_PATH = /^\.github\/workflows\/[^/]+\.ya?ml$/;
/**
 * The QA config the `qa-plan` and `manual-qa` skills read, in their lookup
 * order. Its presence is a sign the repository runs QA, so `readiness` asks
 * about `ready_to_merge.qa` when it is there and that key was never set.
 */
export const QA_CONFIG_FILES = /** @type {const} */ ([
  "qa.config.yml",
  "qa.config.yaml",
  "qa.config.json",
]);
export const EXECUTOR_KEYS = /** @type {const} */ (["build", "analysis", "qa"]);
export const SUPPORT_LEVELS = /** @type {const} */ (["verified", "tried", "documented"]);

/**
 * The harnesses this skill has a file for, read from `harnesses/<id>.md`
 * beside this script (HARNESSES.md, "A harness file"): each one's Support
 * Level, whether it has a headless run another harness's Chief of Staff can
 * start, and whether that run can carry a QA Delegation. A harness file is the
 * one source of all three; this reader only finds them. A file it cannot read
 * them from is a **problem**, named, never a crash: `check` must still print
 * JSON for step 1.
 *
 * @param {string} [dir]
 * @returns {{harnesses: Record<string, {level: string, headless: boolean, headlessQa: boolean}>, problems: string[]}}
 */
export function harnessCatalog(dir = fileURLToPath(new URL("./harnesses/", import.meta.url))) {
  const harnesses = {};
  const problems = [];
  let names;
  try {
    names = readdirSync(dir).sort();
  } catch (error) {
    return {
      harnesses,
      problems: [`the skill's \`harnesses/\` folder cannot be read (${error?.code ?? error})`],
    };
  }
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const id = name.slice(0, -3);
    let text;
    try {
      text = readFileSync(join(dir, name), "utf8");
    } catch (error) {
      problems.push(`harnesses/${name} cannot be read (${error?.code ?? error})`);
      continue;
    }
    const line = (label) => new RegExp(`^- \\*\\*${label}:\\*\\* (.*)$`, "m").exec(text)?.[1];
    const level = /^`([a-z]+)`/.exec(line("Support Level") ?? "")?.[1];
    const headless = line("Headless run");
    const headlessQa = line("Headless QA");
    const missing = [
      line("Id") === `\`${id}\`` ? null : `\`- **Id:** \`${id}\`\``,
      SUPPORT_LEVELS.includes(level)
        ? null
        : "`- **Support Level:**` with one of " + SUPPORT_LEVELS.join(", "),
      headless === undefined ? "`- **Headless run:**`" : null,
      headlessQa === undefined ? "`- **Headless QA:**`" : null,
    ].filter(Boolean);
    if (missing.length) {
      problems.push(
        `harnesses/${name}: not a harness file; it needs ${missing.join(", ")} (HARNESSES.md, "A harness file")`,
      );
      continue;
    }
    harnesses[id] = {
      level,
      headless: !headless.startsWith("none"),
      headlessQa: !headlessQa.startsWith("none"),
    };
  }
  return { harnesses, problems };
}

const CATALOG = harnessCatalog();
export const HARNESSES = Object.freeze(CATALOG.harnesses);
/** Problems in the skill's own harness files: every `check` reports them. */
export const HARNESS_FILE_PROBLEMS = Object.freeze(CATALOG.problems);

/**
 * The environment variables a harness sets in the shells its agent runs, read
 * from each harness's own documentation or source, cited beside each rule. A
 * match makes the harness a **candidate** only: the Chief of Staff confirms it
 * against the tools it has, since a terminal inside an editor can carry the
 * editor's variables too.
 *
 * @type {ReadonlyArray<{harness: string, when: (env: Record<string, string | undefined>) => boolean}>}
 */
export const HARNESS_ENV = Object.freeze([
  // Claude Code sets CLAUDECODE=1 in its agent's shells (code.claude.com/docs/en/env-vars);
  // the desktop app adds CLAUDE_CODE_DESKTOP_APP_VERSION (observed, app 5.11492, 2026-11-14).
  // Claude Code's IDE extensions also set CLAUDECODE in integrated terminals.
  {
    harness: "claude-code-desktop",
    when: (env) => env.CLAUDECODE === "1" && nonEmpty(env.CLAUDE_CODE_DESKTOP_APP_VERSION),
  },
  {
    harness: "claude-code-cli",
    when: (env) => env.CLAUDECODE === "1" && !nonEmpty(env.CLAUDE_CODE_DESKTOP_APP_VERSION),
  },
  // Cursor 3.28 sets CURSOR_AGENT=1 on the agent's own terminal only
  // (cursor.com/docs/agent/tools/terminal; the value read in the 3.28.7 build).
  { harness: "cursor", when: (env) => env.CURSOR_AGENT === "1" },
  // Codex rust-v0.169.0 sets CODEX_THREAD_ID on every command it spawns (codex-rs/core/src/exec_env.rs).
  { harness: "codex-cli", when: (env) => nonEmpty(env.CODEX_THREAD_ID) },
  // Copilot CLI sets COPILOT_CLI=1 (its changelog, 0.0.421).
  { harness: "copilot-cli", when: (env) => env.COPILOT_CLI === "1" },
  // Gemini CLI v0.68.0 sets GEMINI_CLI=1 (packages/core/src/services/shellExecutionService.ts).
  { harness: "gemini-cli", when: (env) => env.GEMINI_CLI === "1" },
  // OpenCode sets OPENCODE=1: v2 only in the agent's shell (packages/core/src/tool/plugin/shell.ts),
  // v1 in every child of the process.
  { harness: "opencode", when: (env) => env.OPENCODE === "1" },
  // Antigravity and Devin document none: they are found by their tools alone.
]);

/** The harnesses this environment points to, in HARNESS_ENV's order. */
export function harnessCandidates(env = process.env) {
  return HARNESS_ENV.filter((rule) => rule.when(env)).map((rule) => rule.harness);
}

/** The `refusal` codes `land` prints (CONFIG.md names each one). */
export const LAND_REFUSALS = /** @type {const} */ ([
  "unknown-ref",
  "not-descended",
  "outside-fence",
  "checked-out",
  "not-fast-forward",
  "moved",
]);

/** `regate` as a mapping: the commands, and the tests that fail on the default branch too. */
export const REGATE_KEYS = /** @type {const} */ (["commands", "allowed_failures"]);
export const ALLOWED_FAILURE_KEYS = /** @type {const} */ (["test", "reason"]);
export const SPEC_KEYS = /** @type {const} */ (["landing", "integration_branch"]);
export const LANDINGS = /** @type {const} */ (["ask", "integration-branch", "per-ticket"]);

/** `tracker`'s values: detected from the git remote's host, or pinned (TEAM.md). */
export const TRACKERS = /** @type {const} */ (["detect", "github", "gitlab"]);
/** The hosts detection knows. Any other host, a self-hosted GitLab included, needs the pin. */
export const TRACKER_HOSTS = Object.freeze({ "github.com": "github", "gitlab.com": "gitlab" });
export const TEAM_KEYS = /** @type {const} */ (["labels", "recent_activity"]);
/** `records`' keys (CONFIG.md): the Run Record sink and whether close-out offers an upload. */
export const RECORDS_KEYS = /** @type {const} */ (["repository", "upload", "sink", "raw"]);
/** `records.raw`'s keys: the one sink raw run folders go to, which can only be a bucket. */
export const RAW_KEYS = /** @type {const} */ (["sink"]);
export const RAW_SINK_TYPES = /** @type {const} */ (["s3"]);
const RAW_SINK_ONLY = "`s3` only";
export const RECORDS_UPLOADS = /** @type {const} */ (["offer", "never"]);
/** The Run Record sink types this reader knows. */
export const SINK_TYPES = /** @type {const} */ (["github", "gitlab", "s3"]);
export const SINK_KEYS = /** @type {const} */ ([
  "type",
  "repo",
  "branch",
  "endpoint",
  "bucket",
  "region",
]);
/** The keys only an `s3` sink uses, and the keys only a git sink uses. */
const S3_SINK_KEYS = ["endpoint", "bucket", "region"];
const GIT_SINK_KEYS = ["repo", "branch"];
/** `prune`'s keys (CONFIG.md): local pruning of closed-out run folders, off until `after_days` is set. */
export const PRUNE_KEYS = /** @type {const} */ (["after_days"]);
/** A Team Run's six coarse states, each mirrored by one state label on a ticket. */
export const TEAM_STATES = /** @type {const} */ ([
  "planned",
  "parked",
  "running",
  "waiting",
  "ready_to_merge",
  "merged",
]);

/**
 * The tracker a git remote's URL points to, read from its host:
 * `https://github.com/o/r.git`, `git@gitlab.com:g/r.git`, `ssh://git@host/r`.
 * A host detection does not know, or a URL with no host (a local path), gives
 * `tracker: null`, and the run asks the human; it never guesses.
 *
 * @param {string | null | undefined} url
 * @returns {{host: string | null, tracker: "github" | "gitlab" | null}}
 */
export function trackerFromRemote(url) {
  const text = typeof url === "string" ? url.trim() : "";
  // A drive letter (`C:\repo`, `C:/repo`) is a local path, not `host:path`.
  if (/^[a-z]:[\\/]/i.test(text)) return { host: null, tracker: null };
  const host = (
    /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?(\[[^\]]*\]|[^/:]+)/i.exec(text)?.[1] ??
    /^(?:[^@/:]+@)?([^/:]+):(?!\/)/.exec(text)?.[1] ??
    ""
  )
    .replace(/^\[(.*)\]$/, "$1")
    .toLowerCase();
  if (host === "") return { host: null, tracker: null };
  return { host, tracker: Object.hasOwn(TRACKER_HOSTS, host) ? TRACKER_HOSTS[host] : null };
}

/** CONFIG.md's defaults. A key with no default here is asked for, or left to the harness. */
export const DEFAULTS = Object.freeze({
  run_dir: "tmp/orchestrate",
  building: 3,
  decisions: "pull-request",
  review: "settled",
  qa: "none",
  review_workflow: "detect",
  landing: "ask",
  integration_branch: "orchestrate/spec-<n>",
  tracker: "detect",
  recent_activity: 5,
  upload: "offer",
  team_labels: Object.freeze(
    Object.fromEntries(TEAM_STATES.map((state) => [state, `team: ${state.replaceAll("_", " ")}`])),
  ),
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

/**
 * `host/owner/repo`, three plain segments, or `host/<group>/…/<project>` for a GitLab project in a subgroup.
 * An owner or group starts with a letter, a digit or `_`, as `records.mjs`'s REPO has it.
 */
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9.-]*(?:\/\w[\w.-]*){1,20}\/[\w.-]+$/;
/** A sink repository: `owner/name`, or `host/owner/name` for another host. */
const SINK_REPO = /^(?:[A-Za-z0-9][A-Za-z0-9.-]*\/)?[\w.-]+\/[\w.-]+$/;
/** A `gitlab` sink project may sit in subgroups: `group/sub/name`, with an optional `host/` in front. */
const GITLAB_SINK_REPO = /^[\w.-]+(?:\/[\w.-]+){1,21}$/;

/**
 * A value shaped like a credential: an AWS access key id or secret, a token,
 * a private key, a password in a URL, or a presigned signature. The check is on
 * shape, never on the key's name, and the value is never echoed. A name
 * (`repo`, `bucket`, `endpoint`) skips the last check, a long mixed-case run,
 * which an ordinary repository or host name can match.
 */
function looksLikeSecret(value, { name = false } = {}) {
  if (typeof value !== "string") return false;
  if (/\b(?:AKIA|ASIA|AGPA|AIDA|AROA)[A-Z0-9]{16}\b/.test(value)) return true;
  if (
    /(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}|glpat-[\w-]{20,}|xox[abprs]-|sk-[A-Za-z0-9]{20,}/.test(
      value,
    )
  )
    return true;
  if (/-----BEGIN [A-Z ]*PRIVATE KEY/.test(value)) return true;
  if (/:\/\/[^/\s@]*@/.test(value)) return true;
  if (/X-Amz-(?:Signature|Credential|Security-Token)=/i.test(value)) return true;
  if (name) return false;
  return (value.match(/[A-Za-z0-9/+=]{40,}/g) ?? []).some(
    (run) => /[a-z]/.test(run) && /[A-Z]/.test(run) && /\d/.test(run),
  );
}

/** The sink keys that hold a name, not a value that could be a credential. */
const NAME_KEYS = ["repo", "bucket", "endpoint"];

/** A bucket name: 3 to 63 lowercase letters, digits, dots and hyphens, as S3 and its compatibles accept. */
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
/** A region: `us-east-1`, `eu-central-1`, R2's `auto`. */
const REGION = /^[a-z][a-z0-9-]{1,30}$/;

/** An endpoint: an https URL with a host, no credentials, no query and no path (`http` only on this machine). */
function validEndpoint(value) {
  if (typeof value !== "string") return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return (
    (url.protocol === "https:" || (url.protocol === "http:" && local)) &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    url.pathname === "/"
  );
}

/** A repository name matching `pattern`, with no `.` or `..` segment. */
const plainRepo = (pattern, v) =>
  typeof v === "string" && pattern.test(v) && v.split("/").every((part) => !/^\.+$/.test(part));

/** A branch name `git check-ref-format --branch` accepts, as far as the reader can tell without git. */
function validBranch(v) {
  if (!nonEmpty(v)) return false;
  return !(
    /[\x00-\x20\x7f~^:?*[\\]/.test(v) ||
    v.startsWith("-") ||
    v.includes("..") ||
    v.includes("@{") ||
    v === "@" ||
    v.endsWith(".") ||
    v.split("/").some((part) => part === "" || part.startsWith(".") || part.endsWith(".lock"))
  );
}

const isCount = (v) =>
  (typeof v === "number" && Number.isSafeInteger(v) && v >= 1) ||
  (typeof v === "string" && /^[1-9]\d{0,8}$/.test(v));

/**
 * Check one sink mapping at `base` (`records.sink` or `records.raw.sink`).
 * `types` are the types allowed there and `expected` is how a problem names them:
 * the raw-folder sink is `s3` only, so a `github` one is a problem even though
 * it is a sink type.
 */
function checkSink(sink, s, base, types, expected) {
  if (!isMapping(s)) return sink.add(base, "expected a mapping");
  unknownKeys(sink, s, base, SINK_KEYS);
  const secret = new Set(
    Object.entries(s)
      .filter(([k, v]) => looksLikeSecret(v, { name: NAME_KEYS.includes(k) }))
      .map(([k]) => k),
  );
  if (!Object.hasOwn(s, "type"))
    sink.add(
      `${base}.type`,
      `missing: ${types === RAW_SINK_TYPES ? RAW_SINK_ONLY : `one of ${expected}`}`,
    );
  // A secret-looking type is reported below as a secret, and never printed back.
  else if (given(sink, s, "type", `${base}.type`) && !secret.has("type") && !types.includes(s.type))
    sink.add(
      `${base}.type`,
      types === RAW_SINK_TYPES
        ? `\`${s.type}\` cannot hold raw run folders: ${RAW_SINK_ONLY}, because only a bucket can expire them`
        : `unknown sink type \`${s.type}\`; expected one of: ${expected}`,
    );
  for (const key of secret)
    sink.add(
      `${base}.${key}`,
      "looks like a secret: credentials come only from ORCHESTRATE_S3_ACCESS_KEY_ID and ORCHESTRATE_S3_SECRET_ACCESS_KEY, never from the config. Remove it",
    );
  const here = (key) => given(sink, s, key, `${base}.${key}`) && !secret.has(key);
  if (s.type === "s3") {
    for (const key of GIT_SINK_KEYS)
      if (here(key)) sink.add(`${base}.${key}`, "not used by an `s3` sink: delete it");
    // A key with no value is reported once, by `here` below; only an absent key is missing.
    for (const key of S3_SINK_KEYS)
      if (!Object.hasOwn(s, key))
        sink.add(
          `${base}.${key}`,
          `missing: ${{ endpoint: "the store's https URL, such as `https://<account>.r2.cloudflarestorage.com`", bucket: "the bucket's name", region: "the bucket's region, such as `us-east-1` (`auto` for R2)" }[key]}`,
        );
    if (here("endpoint") && !validEndpoint(s.endpoint))
      sink.add(
        `${base}.endpoint`,
        "expected an https URL with a host and nothing else: no password, path or query (http only for localhost)",
      );
    if (here("bucket") && !(typeof s.bucket === "string" && BUCKET.test(s.bucket)))
      sink.add(
        `${base}.bucket`,
        "expected a bucket name: 3 to 63 lowercase letters, digits, dots or hyphens",
      );
    if (here("region") && !(typeof s.region === "string" && REGION.test(s.region)))
      sink.add(`${base}.region`, "expected a region, such as `us-east-1` or `auto`");
    return;
  }
  if (types === RAW_SINK_TYPES) return;
  for (const key of S3_SINK_KEYS)
    if (here(key)) sink.add(`${base}.${key}`, "only an `s3` sink uses this: delete it");
  if (!Object.hasOwn(s, "repo"))
    sink.add(`${base}.repo`, "missing: the private repository, `owner/name` or `host/owner/name`");
  else if (here("repo") && !plainRepo(s.type === "gitlab" ? GITLAB_SINK_REPO : SINK_REPO, s.repo))
    sink.add(
      `${base}.repo`,
      s.type === "gitlab"
        ? "expected `group/name` or `host/group/name`, with any subgroups between"
        : "expected `owner/name` or `host/owner/name`",
    );
  if (here("branch") && !validBranch(s.branch))
    sink.add(`${base}.branch`, "expected a valid git branch name");
}

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
    // A list of commands, or a mapping of `commands` and `allowed_failures`.
    if (!isMapping(value))
      return distinctList(sink, value, "regate", nonEmpty, "a command", "commands");
    unknownKeys(sink, value, "regate", REGATE_KEYS);
    if (!Object.hasOwn(value, "commands"))
      sink.add("regate.commands", "expected a list of commands");
    else if (given(sink, value, "commands", "regate.commands"))
      distinctList(sink, value.commands, "regate.commands", nonEmpty, "a command", "commands");
    if (!given(sink, value, "allowed_failures", "regate.allowed_failures")) return;
    const list = value.allowed_failures;
    const path = "regate.allowed_failures";
    if (!Array.isArray(list)) return sink.add(path, "expected a list of failing tests");
    const seen = new Set();
    list.forEach((item, n) => {
      const at = `${path}[${n}]`;
      if (!isMapping(item)) return sink.add(at, "expected a mapping with `test` and `reason`");
      unknownKeys(sink, item, at, ALLOWED_FAILURE_KEYS);
      for (const key of ALLOWED_FAILURE_KEYS)
        if (!nonEmpty(item[key])) sink.add(`${at}.${key}`, "expected a non-empty string");
      if (nonEmpty(item.test)) {
        if (seen.has(item.test)) sink.add(at, `\`${item.test}\` is listed twice`);
        seen.add(item.test);
      }
    });
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
  harness(sink, value) {
    if (!nonEmpty(value)) return sink.add("harness", "expected a harness id");
    if (!Object.hasOwn(HARNESSES, value))
      sink.add(
        "harness",
        `\`${value}\` has no harness file; known: ${Object.keys(HARNESSES).join(", ")}`,
      );
  },
  executors(sink, value, config) {
    stringMapping(sink, value, "executors", EXECUTOR_KEYS);
    if (!isMapping(value)) return;
    for (const key of EXECUTOR_KEYS) {
      const id = value[key];
      if (!nonEmpty(id) || !Object.hasOwn(value, key)) continue;
      if (!Object.hasOwn(HARNESSES, id))
        sink.add(
          `executors.${key}`,
          `\`${id}\` has no harness file; known: ${Object.keys(HARNESSES).join(", ")}`,
        );
      else if (id !== config.harness && !HARNESSES[id].headless)
        sink.add(`executors.${key}`, `\`${id}\` has no headless run another harness can start`);
      else if (id !== config.harness && key === "qa" && !HARNESSES[id].headlessQa)
        sink.add(
          "executors.qa",
          `\`${id}\`'s headless run cannot carry QA (its harness file's Headless QA line): QA there is a session the human starts`,
        );
    }
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
    if (
      given(sink, value, "review_workflow", path("review_workflow")) &&
      !REVIEW_WORKFLOW_RULES.includes(value.review_workflow) &&
      !(typeof value.review_workflow === "string" && CALLER_PATH.test(value.review_workflow))
    )
      sink.add(
        path("review_workflow"),
        "expected `detect`, `none`, or a workflow file directly under `.github/workflows/`",
      );
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
  tracker(sink, value) {
    if (!TRACKERS.includes(value)) sink.add("tracker", `expected one of: ${TRACKERS.join(", ")}`);
  },
  team(sink, value) {
    if (!isMapping(value)) return sink.add("team", "expected a mapping");
    unknownKeys(sink, value, "team", TEAM_KEYS);
    if (
      given(sink, value, "recent_activity", "team.recent_activity") &&
      !isCount(value.recent_activity)
    )
      sink.add("team.recent_activity", "expected a whole number of 1 or more");
    if (!given(sink, value, "labels", "team.labels")) return;
    const labels = value.labels;
    if (!isMapping(labels))
      return sink.add("team.labels", "expected a mapping of the six states to label names");
    unknownKeys(sink, labels, "team.labels", TEAM_STATES);
    // All six or none: a run that mirrors states in labels needs a name for each.
    const names = new Map();
    for (const state of TEAM_STATES) {
      const path = `team.labels.${state}`;
      if (!Object.hasOwn(labels, state)) {
        sink.add(
          path,
          "missing: give a label name for each of the six states, or leave `labels` out",
        );
        continue;
      }
      if (!given(sink, labels, state, path)) continue;
      if (!nonEmpty(labels[state])) {
        sink.add(path, "expected a label name");
        continue;
      }
      // GitHub and GitLab compare label names without case, so two such names are one label.
      const name = labels[state].trim().toLowerCase();
      if (names.has(name))
        sink.add(path, `\`${labels[state]}\` is also the label for \`${names.get(name)}\``);
      else names.set(name, state);
    }
  },
  records(sink, value) {
    if (!isMapping(value)) return sink.add("records", "expected a mapping");
    unknownKeys(sink, value, "records", RECORDS_KEYS);
    if (
      given(sink, value, "repository", "records.repository") &&
      (!plainRepo(REPOSITORY, value.repository) ||
        (/^github\.com\//i.test(value.repository) && value.repository.split("/").length !== 3))
    )
      sink.add(
        "records.repository",
        "expected `host/owner/repo`, such as `github.com/acme/widgets`, or `host/group/sub/project` for a GitLab subgroup",
      );
    if (given(sink, value, "upload", "records.upload") && !RECORDS_UPLOADS.includes(value.upload))
      sink.add("records.upload", `expected one of: ${RECORDS_UPLOADS.join(", ")}`);
    if (given(sink, value, "sink", "records.sink"))
      checkSink(sink, value.sink, "records.sink", SINK_TYPES, SINK_TYPES.join(", "));
    if (!given(sink, value, "raw", "records.raw")) return;
    if (!isMapping(value.raw)) return sink.add("records.raw", "expected a mapping");
    unknownKeys(sink, value.raw, "records.raw", RAW_KEYS);
    if (given(sink, value.raw, "sink", "records.raw.sink"))
      checkSink(sink, value.raw.sink, "records.raw.sink", RAW_SINK_TYPES, RAW_SINK_ONLY);
  },
  prune(sink, value) {
    if (!isMapping(value)) return sink.add("prune", "expected a mapping");
    unknownKeys(sink, value, "prune", PRUNE_KEYS);
    if (given(sink, value, "after_days", "prune.after_days") && !isCount(value.after_days))
      sink.add("prune.after_days", "expected a whole number of 1 or more");
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
 * @returns {{path: string | null, config: Record<string, any>, problems: string[], answers: string | null, qaConfig: string | null}}
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
  problems.push(...HARNESS_FILE_PROBLEMS, ...shape);
  if (!shape.length && exists) problems.push(...missingPaths(config, where, exists));
  return { path, config, problems, answers: answers?.path ?? null, qaConfig: qaConfig(read) };
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

/**
 * The first QA config at the repository root, found the way the config itself
 * is: by reading it. A file that is there but cannot be read still counts.
 *
 * @param {(path: string) => string | null} read
 * @returns {string | null}
 */
function qaConfig(read) {
  const present = (path) => {
    try {
      const text = read(path);
      return text !== null && text !== undefined;
    } catch {
      return true;
    }
  };
  return QA_CONFIG_FILES.find(present) ?? null;
}

/** Every path the config names must be in the repository: the documents a brief sends every Delegation to, and the review Caller. */
function missingPaths(config, where, exists) {
  const sink = problemSink(where);
  (config.read_first ?? []).forEach((path, n) => {
    if (!exists(path)) sink.add(`read_first[${n}]`, `\`${path}\` is not in the repository`);
  });
  if (typeof config.triage_labels === "string" && !exists(config.triage_labels))
    sink.add("triage_labels", `\`${config.triage_labels}\` is not in the repository`);
  const caller = isMapping(config.ready_to_merge) ? config.ready_to_merge.review_workflow : null;
  if (typeof caller === "string" && CALLER_PATH.test(caller) && !exists(caller))
    sink.add("ready_to_merge.review_workflow", `\`${caller}\` is not in the repository`);
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
  const team = section("team");
  const records = section("records");
  const prune = section("prune");
  const sinkValue = isMapping(records.sink) ? records.sink : null;
  return {
    run_dir: config.run_dir ?? DEFAULTS.run_dir,
    read_first: Array.isArray(config.read_first) ? config.read_first : null,
    routes: pick(routes, ROUTE_KEYS),
    regate: regateCommands(config.regate),
    regate_allowed_failures: regateAllowed(config.regate),
    skills: pick(section("skills"), SKILL_KEYS),
    triage_labels: triageLabels(config.triage_labels),
    models: pick(section("models"), MODEL_KEYS),
    harness: config.harness ?? null,
    executors: pick(section("executors"), EXECUTOR_KEYS),
    limits: {
      building: limits.building === undefined ? DEFAULTS.building : Number(limits.building),
      shared: limits.shared ?? [],
    },
    decisions: { to: decisions.to ?? DEFAULTS.decisions, marker: decisions.marker ?? null },
    ready_to_merge: {
      review: ready.review ?? DEFAULTS.review,
      qa: ready.qa ?? DEFAULTS.qa,
      qa_labels: ready.qa_labels ?? [],
      review_workflow: ready.review_workflow ?? DEFAULTS.review_workflow,
    },
    spec: {
      landing: spec.landing ?? DEFAULTS.landing,
      integration_branch: spec.integration_branch ?? DEFAULTS.integration_branch,
    },
    tracker: config.tracker ?? DEFAULTS.tracker,
    records: {
      repository: records.repository ?? null,
      upload: records.upload ?? DEFAULTS.upload,
      sink: sinkValue
        ? sinkValue.type === "s3"
          ? {
              type: "s3",
              endpoint: sinkValue.endpoint ?? null,
              bucket: sinkValue.bucket ?? null,
              region: sinkValue.region ?? null,
            }
          : {
              type: sinkValue.type ?? null,
              repo: sinkValue.repo ?? null,
              branch: sinkValue.branch ?? null,
            }
        : null,
      raw: {
        sink:
          isMapping(records.raw) && isMapping(records.raw.sink) && records.raw.sink.type === "s3"
            ? {
                type: "s3",
                endpoint: records.raw.sink.endpoint ?? null,
                bucket: records.raw.sink.bucket ?? null,
                region: records.raw.sink.region ?? null,
              }
            : null,
      },
    },
    prune: {
      after_days: prune.after_days === undefined ? null : Number(prune.after_days),
    },
    team: {
      // Trimmed, as the tracker trims a label name, so a run names and compares it as `check` did.
      labels: isMapping(team.labels)
        ? Object.fromEntries(Object.entries(team.labels).map(([k, v]) => [k, String(v).trim()]))
        : { ...DEFAULTS.team_labels },
      recent_activity:
        team.recent_activity === undefined
          ? DEFAULTS.recent_activity
          : Number(team.recent_activity),
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
 * @param {{path: string | null, config: Record<string, any>, problems: string[], qaConfig?: string | null}} read
 * @returns {{ready: boolean, needs: string[], notes: string[]}}
 */
export function readiness({ path, config, problems, qaConfig = null }) {
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
  const below = (id) => HARNESSES[id] && HARNESSES[id].level !== "verified";
  if (effective.harness !== null && below(effective.harness))
    notes.push(
      `\`harness\` is \`${effective.harness}\`, at Support Level \`${HARNESSES[effective.harness].level}\`: ` +
        "the Dispatch Plan says so, and waits for the human's go",
    );
  for (const key of EXECUTOR_KEYS) {
    const id = effective.executors[key];
    if (id === null || id === effective.harness) continue;
    notes.push(
      `\`executors.${key}\` runs that work on \`${id}\`` +
        (below(id) ? `, at Support Level \`${HARNESSES[id].level}\`` : "") +
        `: check its CLI is installed and signed in, and that \`models.${key}\` names a model there`,
    );
  }
  if (qaConfig !== null) {
    const qaSet = isMapping(config.ready_to_merge) && config.ready_to_merge.qa !== undefined;
    if (!qaSet)
      needs.push(
        `ready_to_merge.qa: \`${qaConfig}\` is here, so the repository may run QA; ` +
          "`report` to require a QA Report on each pull request's head before Ready to Merge " +
          "(with `qa_labels` to limit it to some issues), or `none`",
      );
    else if (effective.ready_to_merge.qa === "none")
      notes.push(
        `\`${qaConfig}\` is here, but \`ready_to_merge.qa\` is \`none\`: the run plans no QA`,
      );
  }
  if (effective.triage_labels.from === "default")
    notes.push("no `triage_labels`: each triage role's label is taken to be the role's own name");
  if (effective.triage_labels.from === "document")
    notes.push(
      `the triage roles' labels are read from \`${effective.triage_labels.document}\` at the start of the run`,
    );
  return { ready: needs.length === 0, needs, notes };
}

/** The re-gate commands, whether `regate` is a list or a mapping; null when unset. */
function regateCommands(value) {
  const list = isMapping(value) ? value.commands : value;
  return Array.isArray(list) ? list : null;
}

/** The tests the re-gate may see fail, each `{ test, reason }`; none when `regate` is a list. */
function regateAllowed(value) {
  const list = isMapping(value) ? value.allowed_failures : null;
  return Array.isArray(list)
    ? list.filter(isMapping).map(({ test, reason }) => ({ test, reason }))
    : [];
}

const SKILL_NOTES = {
  implement: "a building brief names no skill to implement with",
  triage: "an issue that is not ready for an agent is analysed with no named skill",
  review: "a building brief's code-review phase names no skill to review with",
};

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

// ── Re-gate and landing ─────────────────────────────────────────────────────
//
// What the Chief of Staff typed by hand for every landing (SPEC.md, "On an
// integration branch", item 5): the re-gate in a detached worktree, the
// comparison of its failures to the known ones, and the checks before the
// integration branch moves. Both commands shell out to git in the repository
// they are run from, and touch nothing but the refs and worktrees named below.

const git = (repo, args, options = {}) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

/** The commit `rev` names, or null. */
function commitOf(repo, rev) {
  try {
    return git(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).trim() || null;
  } catch {
    return null;
  }
}

const isAncestor = (repo, ancestor, descendant) => {
  try {
    git(repo, ["merge-base", "--is-ancestor", ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
};

/**
 * Options for a gate command: `single` ones take one value each, `many` ones
 * take every value up to the next `--` option. The positionals come first.
 * Null on any other argument, a repeated single option, or a missing value.
 */
function gateArgs(rest, positionals, single, many = []) {
  const positional = [];
  let n = 0;
  while (n < positionals && rest[n] !== undefined && !rest[n].startsWith("--"))
    positional.push(rest[n++]);
  if (positional.length !== positionals) return null;
  const options = {};
  for (const name of many) options[name] = [];
  while (n < rest.length) {
    const name = rest[n++];
    if (many.includes(name)) {
      const start = n;
      while (n < rest.length && !rest[n].startsWith("--")) options[name].push(rest[n++]);
      if (n === start) return null;
    } else if (single.includes(name)) {
      if (rest[n] === undefined || rest[n].startsWith("--") || Object.hasOwn(options, name))
        return null;
      options[name] = rest[n++];
    } else return null;
  }
  return { positional, options };
}

// ANSI colour codes would hide a name from the patterns below.
const plain = (text) => text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

/**
 * The tests a command's output says failed, and how many it says it counted:
 * `{ failed: [{ name, id }], reported }`, `reported` null when it says none.
 * Reads Node's test runner (the `failing tests:` summary, which lists leaf
 * tests only, and `ℹ fail <n>`) and pytest (`FAILED <id>` and `ERROR <id>`
 * lines, and its `<n> failed` and `<n> errors` count).
 */
export function failedTests(output) {
  const lines = plain(output).split(/\r?\n/);
  const failed = [];
  let reported = null;
  const count = (n) => (reported = (reported ?? 0) + Number(n));
  const summary = lines.findIndex((line) => /^✖ failing tests:\s*$/.test(line));
  if (summary >= 0)
    for (const line of lines.slice(summary + 1)) {
      const m = /^✖ (.+?) \(\d+(?:\.\d+)?ms\)\s*$/.exec(line);
      if (m) failed.push({ name: m[1], id: m[1] });
    }
  for (const line of lines) {
    const node = /^ℹ fail (\d+)\s*$/.exec(line);
    if (node) count(node[1]);
    const py = /^(?:FAILED|ERROR) (\S+?)(?: - .*)?$/.exec(line);
    if (py) failed.push({ name: py[1].split("::").pop(), id: py[1] });
    if (/^=*\s*(?:\d+ \w+, )*\d+ \w+.* in [\d.]+s/.test(line))
      for (const m of line.matchAll(/(\d+) (?:failed|errors?)\b/g)) count(m[1]);
  }
  return { failed, reported };
}

/** A failure line no test name accounts for, such as pytest-cov's `FAIL Required test coverage`. */
const OTHER_FAILURE =
  /^FAIL(?!ED)\b|Required test coverage|coverage .*(?:not reached|below|too low)/im;

/** What one finished command makes of the allowed list: which failures are allowed, and which are not. */
function judge(command, code, output, allowedTests) {
  if (code === 0) return { allowed: [], unallowed: [] };
  const { failed, reported } = failedTests(output);
  // A list excuses named test failures only. A test runner exits 1 when tests failed; any other
  // code (pytest's 2 to 5) or a failure line the tests do not name is a failure the list cannot excuse.
  const other = [];
  if (code !== 1) other.push(`\`${command}\` exited ${code}, not 1: not a test failure`);
  else if (OTHER_FAILURE.test(plain(output)))
    other.push(
      `\`${command}\` printed a failure that is not a named test (such as a coverage threshold)`,
    );
  const found = [...new Map(failed.map((f) => [f.id, f])).values()];
  const listed = (f) => allowedTests.has(f.name) || allowedTests.has(f.id);
  const allowed = found.filter(listed).map((f) => f.id);
  const unallowed = found.filter((f) => !listed(f)).map((f) => f.id);
  if (!found.length) unallowed.push(`\`${command}\` exited ${code}, and named no failing test`);
  else if (reported === null)
    unallowed.push(`\`${command}\` named failing tests but printed no count of them`);
  else if (reported > found.length)
    unallowed.push(
      `\`${command}\`: ${reported} failed, but only ${found.length} named in its output`,
    );
  return { allowed, unallowed: [...unallowed, ...other] };
}

/**
 * `regate <sha> --out <file>`: null on bad arguments. The commands come from
 * this repository's own config, never from the commit under test, so a ticket
 * cannot change what checks it.
 */
function regateCommand(rest, io) {
  const parsed = gateArgs(rest, 1, ["--out", "--repo"]);
  if (!parsed || parsed.options["--out"] === undefined) return null;
  const refuse = (message) => ({ code: 2, out: `${message}\n` });
  const repo = resolve(io.cwd ?? process.cwd(), parsed.options["--repo"] ?? ".");
  const loaded = readConfig(io.read ?? repoReader(repo), {
    answers: null,
    exists: io.exists ?? ((path) => existsSync(join(repo, path))),
  });
  if (loaded.problems.length)
    return refuse(`the config has problems; run \`check\`:\n${loaded.problems.join("\n")}`);
  const effective = effectiveConfig(loaded.config);
  if (effective.regate === null) return refuse("the config sets no `regate`: nothing to run");
  const out = resolve(repo, parsed.options["--out"]);
  const runDir = resolve(repo, effective.run_dir);
  if (!inside(runDir, out))
    return refuse(`\`--out\` must be inside the run folder \`${effective.run_dir}\``);
  const sha = commitOf(repo, parsed.positional[0]);
  if (sha === null) return refuse(`\`${parsed.positional[0]}\` is not a commit in this repository`);

  const allowedTests = new Set(effective.regate_allowed_failures.map((a) => a.test));
  const reasons = new Map(effective.regate_allowed_failures.map((a) => [a.test, a.reason]));
  const results = [];
  mkdirSync(dirname(out), { recursive: true });
  const worktree = join(dirname(out), `regate-${sha.slice(0, 12)}-${process.pid}`);
  try {
    git(repo, ["worktree", "add", "--detach", "--quiet", worktree, sha]);
  } catch (error) {
    return refuse(`cannot make the worktree: ${String(error.stderr ?? error).trim()}`);
  }
  try {
    for (const command of effective.regate) {
      const done = spawnSync(command, {
        cwd: worktree,
        shell: true,
        encoding: "utf8",
        maxBuffer: 1 << 28,
      });
      const output = `${done.stdout ?? ""}${done.stderr ?? ""}${done.error ? `\n${done.error}` : ""}`;
      const code = done.status ?? 1;
      results.push({ command, code, ...judge(command, code, output, allowedTests), output });
    }
  } finally {
    try {
      git(repo, ["worktree", "remove", "--force", worktree]);
    } catch {
      rmSync(worktree, { recursive: true, force: true });
      git(repo, ["worktree", "prune"]);
    }
  }
  const ok = results.every((r) => r.unallowed.length === 0);
  writeFileSync(out, `${JSON.stringify({ sha, ok, results }, null, 2)}\n`);

  const lines = [`re-gate at ${sha}`];
  if (!results.length)
    lines.push("no re-gate commands: a finished branch is checked by its CI alone");
  for (const r of results) {
    if (r.unallowed.length)
      lines.push(`FAILED \`${r.command}\`:`, ...r.unallowed.map((u) => `  ${u}`));
    else if (r.allowed.length)
      lines.push(
        `allowed \`${r.command}\`:`,
        ...r.allowed.map((name) => `  ${name} (${reasons.get(name) ?? "on the allowed list"})`),
      );
    else lines.push(`ok \`${r.command}\``);
  }
  lines.push(`${ok ? "re-gate passed" : "re-gate FAILED"}; results in ${relative(repo, out)}`);
  return { code: ok ? 0 : 1, out: `${lines.join("\n")}\n` };
}

/** A glob as a regular expression: `**` crosses folders, `*` and `?` stay in one; a trailing `/` is the whole folder. */
export function globToRegExp(glob) {
  const pattern = glob.endsWith("/") ? `${glob}**` : glob;
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      const slash = pattern[i + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else source += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

/**
 * `land <branch> --cut <sha> --onto <integration> --fence <glob>...`: null on
 * bad arguments. Moves `refs/heads/<integration>` and nothing else.
 */
function landCommand(rest, io) {
  const parsed = gateArgs(rest, 1, ["--cut", "--onto", "--repo"], ["--fence"]);
  if (!parsed) return null;
  const { options } = parsed;
  if (
    options["--cut"] === undefined ||
    options["--onto"] === undefined ||
    !options["--fence"].length
  )
    return null;
  const repo = resolve(io.cwd ?? process.cwd(), options["--repo"] ?? ".");
  const [branch] = parsed.positional;
  const onto = options["--onto"];
  const refusal = (reason, cause, extra = {}) => {
    if (!LAND_REFUSALS.includes(reason)) throw new Error(`unknown refusal code ${reason}`);
    return {
      code: 1,
      out: `${JSON.stringify({ landed: false, branch, onto, refusal: reason, cause, ...extra }, null, 2)}\n`,
    };
  };

  const head = commitOf(repo, branch);
  if (head === null) return refusal("unknown-ref", `\`${branch}\` is not a branch or commit`);
  const cut = commitOf(repo, options["--cut"]);
  if (cut === null)
    return refusal("unknown-ref", `the cut \`${options["--cut"]}\` is not a commit`);
  const old = commitOf(repo, `refs/heads/${onto}`);
  if (old === null)
    return refusal("unknown-ref", `the integration branch \`${onto}\` is not a local branch`);

  if (!isAncestor(repo, cut, head))
    return refusal("not-descended", `\`${branch}\` (${head}) does not descend from the cut ${cut}`);

  const changed = (from) =>
    git(repo, ["diff", "--name-only", "--no-renames", "-z", from, head])
      .split("\0")
      .filter(Boolean);
  // With the integration branch an ancestor, the move changes exactly diff(old, head): that is
  // what the fence must hold, whatever the merge resolved. Otherwise the move is refused below.
  const paths = isAncestor(repo, old, head) ? changed(old) : changed(cut);
  const fence = options["--fence"].map(globToRegExp);
  const outside = paths.filter((path) => !fence.some((re) => re.test(path))).sort();
  if (outside.length)
    return refusal(
      "outside-fence",
      `${outside.length} changed path${outside.length === 1 ? " is" : "s are"} outside the fence: ${outside.join(", ")}`,
      { paths: outside },
    );

  const holder = git(repo, ["worktree", "list", "--porcelain"])
    .split(/\r?\n\r?\n/)
    .find((block) => block.split(/\r?\n/).includes(`branch refs/heads/${onto}`));
  if (holder)
    return refusal(
      "checked-out",
      `\`${onto}\` is checked out in ${/^worktree (.+)$/m.exec(holder)?.[1]}: moving it would leave that working copy showing the landed work as changes undone`,
    );

  if (!isAncestor(repo, old, head))
    return refusal(
      "not-fast-forward",
      `\`${onto}\` (${old}) is not an ancestor of \`${branch}\` (${head}): it moved after the branch was cut; merge it into the branch first`,
    );

  try {
    git(repo, ["update-ref", `refs/heads/${onto}`, head, old]);
  } catch (error) {
    return refusal(
      "moved",
      `\`update-ref\` refused: \`${onto}\` is no longer at ${old} (${String(error.stderr ?? error).trim()})`,
    );
  }
  return {
    code: 0,
    out: `${JSON.stringify({ landed: true, branch, onto, old, new: head }, null, 2)}\n`,
  };
}

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

const USAGE =
  "usage: node config.mjs check [--answers <file.json>] [--repo <dir>] | where <skill> [--repo <dir>]\n" +
  "       node config.mjs regate <sha> --out <file> [--repo <dir>]\n" +
  "       node config.mjs land <branch> --cut <sha> --onto <integration> --fence <glob>... [--repo <dir>]\n";

/**
 * @param {string[]} argv the arguments after the script
 * @param {{read?: (path: string) => string | null, exists?: (path: string) => boolean, cwd?: string, env?: Record<string, string | undefined>}} [io]
 * @returns {{code: number, out: string}}
 */
export function main(argv, io = {}) {
  const usage = { code: 2, out: USAGE };
  const [command, ...rest] = argv;
  if (command === "where") return whichCopyCommand(argv, io) ?? usage;
  if (command === "regate") return regateCommand(rest, io) ?? usage;
  if (command === "land") return landCommand(rest, io) ?? usage;
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
    qa_config: loaded.qaConfig,
    harness: harnessReport(loaded, io.env ?? process.env),
    tracker: trackerReport(loaded, (io.remote ?? (() => gitRemote(repo)))()),
    readiness: readiness(loaded),
  };
  return { code: loaded.problems.length ? 1 : 0, out: `${JSON.stringify(result, null, 2)}\n` };
}

/**
 * What step 1 needs to find the harness (HARNESSES.md, "Finding the
 * harness"): the candidates the environment points to, the harness the config
 * pins, and each known harness's Support Level.
 */
function harnessReport(loaded, env) {
  const effective = loaded.problems.length ? null : effectiveConfig(loaded.config);
  return {
    candidates: harnessCandidates(env),
    pinned: effective?.harness ?? null,
    executors: effective?.executors ?? null,
    levels: Object.fromEntries(Object.entries(HARNESSES).map(([id, h]) => [id, h.level])),
  };
}

/**
 * What a Team Run needs to find its tracker (TEAM.md): the value the config
 * pins (null for `detect`), the git remote's name (the `<remote>` a tracker
 * file fetches from) and host, and the tracker that host points to. A pin
 * that disagrees with `detected`, or a null `remote`, is the human's question.
 */
function trackerReport(loaded, remote) {
  const effective = loaded.problems.length ? null : effectiveConfig(loaded.config);
  const pinned = effective && effective.tracker !== "detect" ? effective.tracker : null;
  const { host, tracker } = trackerFromRemote(remote?.url ?? null);
  return { pinned, remote: remote?.name ?? null, remote_host: host, detected: tracker };
}

/**
 * The repository's remote, `{ name, url }`: `origin`, or the only remote when
 * there is one under another name. Null when there is none, several with
 * none named `origin`, or git fails.
 */
function gitRemote(repo) {
  const git = (...args) =>
    execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  try {
    const remotes = git("remote").split(/\r?\n/).filter(Boolean);
    const name = remotes.includes("origin") ? "origin" : remotes.length === 1 ? remotes[0] : null;
    return name === null ? null : { name, url: git("remote", "get-url", name) };
  } catch {
    return null;
  }
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
