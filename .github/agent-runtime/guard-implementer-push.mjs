#!/usr/bin/env node
// PreToolUse hook for the implementer's Bash calls. It refuses a push whose
// branch changes a workflow file or a local action, and any command that could
// put a file or a secret from the agent's environment into output the agent
// can publish (see decideBash).
//
// Why before the push, not after the agent: the implementer pushes and opens
// its draft PR inside its own session, and a same-repository PR runs the
// branch's own workflow files with repository secrets. A check in a later step
// runs after those workflows have started. The Claude GitHub App holds
// `workflows: write`, so GitHub itself does not refuse the push.
//
// The agent pushes only through the action's wrapper (`git-push.sh origin
// <ref>`), so this judges that command. It must run on its own: a commit
// chained before the push would land after this hook has already diffed.
//
// The base branch is read from a file staged beside this script, outside the
// workspace, so the agent cannot point the diff at a different base.
//
// git reads the checkout's .git/config, which can name commands git runs, and
// this hook holds the agent's credentials. So before running git it checks
// that config against the staged allowlist (check-git-config.mjs), and runs
// git with fsmonitor and hooks turned off on the command line, which wins over
// any config file. A checkout that fails the check refuses the push.
//
// Contract: stdin is the PreToolUse hook JSON. Print a deny decision as JSON on
// stdout to refuse; print nothing (exit 0) to let the normal permission flow
// proceed. The settings run this with `|| exit 2`, so a guard that cannot load
// or finish blocks the call instead of allowing it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { checkGitDir } from "./check-git-config.mjs";

// Passed before every git subcommand here: `-c` wins over the config files.
export const GIT_HARDENING = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"];

const GUARDED = /^\.github\/(workflows|actions)\//;
// Path and ref characters only: no shell operator can sit in either.
const PUSH = /^\s*(?:[A-Za-z0-9._/-]*\/)?git-push\.sh\s+origin\s+([A-Za-z0-9._/-]+)\s*$/;

function deny(reason) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })}\n`,
  );
}

/** The ref a standalone wrapper push sends, or null for anything else. */
export function pushRef(command) {
  const match = PUSH.exec(String(command ?? ""));
  return match ? match[1] : null;
}

/**
 * Decide on one hook payload. `listChanged(ref)` returns the paths the branch
 * changes against its base, or null when they cannot be listed. Returns a deny
 * reason, or null to allow.
 */
export function decidePush(payload, listChanged) {
  if (payload?.tool_name !== "Bash") return null;
  const command = String(payload?.tool_input?.command ?? "");
  if (!command.includes("git-push.sh")) return null;

  const ref = pushRef(command);
  if (ref === null) {
    return "push guard: run the push on its own, exactly `git-push.sh origin <branch>`, after committing";
  }
  const files = listChanged(ref);
  if (files == null) {
    return "push guard: could not list the branch's changes against its base; push refused";
  }
  const guarded = files.filter((file) => GUARDED.test(file));
  if (guarded.length > 0) {
    return `push guard: the implementer cannot push changes under .github/workflows or .github/actions (${guarded.join(", ")})`;
  }
  return null;
}

// claude-code-action grants `git add`, `git commit`, and `git rm` by command
// prefix, so any arguments pass the rule. These options read a file the caller
// names into a commit message or an error message. git accepts any unambiguous
// prefix of a long option, so a prefix of one of these counts too.
const FILE_READING_LONG = ["file", "template", "pathspec-from-file"];
const FILE_READING_SHORT = new Set(["F", "t"]);
// Short options whose value follows, attached or as the next word.
const VALUE_SHORT = new Set(["m", "C", "c", "S", "u"]);
const VALUE_LONG = new Set([
  "message",
  "reuse-message",
  "reedit-message",
  "author",
  "date",
  "trailer",
  "cleanup",
  "fixup",
  "squash",
  "chmod",
]);
const JUDGED_SUBCOMMANDS = new Set(["add", "commit", "rm", "status"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const EXPANSION =
  "implementer Bash guard: refused shell expansion or input redirection ($, backticks, <) outside single-quoted text, which could put the job's secrets or a runner file into output. Quote commit messages in single quotes, and repeat -m for more paragraphs.";
const UNPARSED = "implementer Bash guard: the command cannot be parsed (unclosed quote); refused";

/**
 * Split a command into segments of words, as the shell would before running
 * it, or return a deny reason. `$`, backticks, and `<` are refused outside
 * single quotes, where the shell would expand or redirect them; `>` is only
 * output. `;`, `&`, `|`, newlines, and parentheses end a segment.
 */
function shellSegments(command) {
  const segments = [];
  let words = [];
  let word = null;
  const pushWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endSegment = () => {
    pushWord();
    if (words.length > 0) segments.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === "'") {
      const close = command.indexOf("'", i + 1);
      if (close < 0) return { reason: UNPARSED };
      word = (word ?? "") + command.slice(i + 1, close);
      i = close;
    } else if (c === '"') {
      let j = i + 1;
      let text = "";
      for (; j < command.length && command[j] !== '"'; j++) {
        if (command[j] === "$" || command[j] === "`") return { reason: EXPANSION };
        if (command[j] === "\\" && j + 1 < command.length) j++;
        text += command[j];
      }
      if (j >= command.length) return { reason: UNPARSED };
      word = (word ?? "") + text;
      i = j;
    } else if (c === "\\") {
      if (i + 1 < command.length) word = (word ?? "") + command[++i];
    } else if (c === "$" || c === "`" || c === "<") {
      return { reason: EXPANSION };
    } else if (";&|\n()".includes(c)) {
      endSegment();
    } else if (c === " " || c === "\t" || c === "\r" || c === ">") {
      pushWord();
    } else {
      word = (word ?? "") + c;
    }
  }
  endSegment();
  return { segments };
}

/** The deny reason for a git invocation's words after `git`, or null. */
function judgeGit(args) {
  if (args.length === 0) return null;
  if (args[0].startsWith("-")) {
    return "implementer Bash guard: git global options (-c, -C, --git-dir, ...) are not allowed";
  }
  if (!JUDGED_SUBCOMMANDS.has(args[0])) return null;
  const readsFile = `implementer Bash guard: \`git ${args[0]}\` with an option that reads a file is not allowed (-F/--file, -t/--template, --pathspec-from-file); use -m with single-quoted text`;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break; // the rest are paths
    if (arg.startsWith("--")) {
      const [name, value] = arg.slice(2).split(/=(.*)/s);
      if (FILE_READING_LONG.some((option) => option.startsWith(name))) return readsFile;
      if (value === undefined && VALUE_LONG.has(name)) i++;
    } else if (arg.startsWith("-") && arg.length > 1) {
      for (let k = 1; k < arg.length; k++) {
        if (FILE_READING_SHORT.has(arg[k])) return readsFile;
        if (VALUE_SHORT.has(arg[k])) {
          // The value is the rest of this word, or the next word.
          if (k === arg.length - 1 && "mCc".includes(arg[k])) i++;
          break;
        }
      }
    }
  }
  return null;
}

/**
 * Decide on one Bash call, apart from the push check. Returns a deny reason,
 * or null to allow. Every segment of the command is judged: a git invocation
 * anywhere in it (after `{`, `!`, or a path to git) counts, and so does an
 * environment assignment in front of one.
 */
export function decideBash(payload) {
  if (payload?.tool_name !== "Bash") return null;
  const command = String(payload?.tool_input?.command ?? "");
  const parsed = shellSegments(command);
  if (parsed.reason) return parsed.reason;
  for (const words of parsed.segments) {
    const at = words.findIndex((w) => w === "git" || w.endsWith("/git"));
    if (at < 0) continue;
    if (words.slice(0, at).some((w) => ASSIGNMENT.test(w))) {
      return "implementer Bash guard: an environment assignment before git is not allowed";
    }
    const reason = judgeGit(words.slice(at + 1));
    if (reason) return reason;
  }
  return null;
}

function workspace() {
  return process.env.GITHUB_WORKSPACE || process.cwd();
}

function git(args) {
  return execFileSync("git", [...GIT_HARDENING, ...args], {
    cwd: workspace(),
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function listChanged(ref) {
  try {
    // Run no git in a checkout whose git config or hooks are not as expected.
    if (checkGitDir(`${workspace()}/.git`).length > 0) return null;
    const base = readFileSync(
      `${process.env.RUNNER_TEMP}/read-confinement/push-guard-base`,
      "utf8",
    ).trim();
    if (!base) return null;
    // Prefer the remote-tracking ref: the agent cannot move it without a fetch.
    let baseRef = null;
    for (const candidate of [`origin/${base}`, base]) {
      try {
        git(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`]);
        baseRef = candidate;
        break;
      } catch {
        // try the next candidate
      }
    }
    if (baseRef === null) return null;
    const out = git([
      "diff",
      "--name-only",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      `${baseRef}...${ref}`,
      "--",
    ]);
    return out.split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return; // unparseable input is not something we can judge — allow through
  }

  const reason = decidePush(payload, listChanged) ?? decideBash(payload);
  if (reason) deny(reason);
}

// Only run when invoked as the hook, so the unit tests can import the deciders.
const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  main();
}
