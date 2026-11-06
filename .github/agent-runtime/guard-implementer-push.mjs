#!/usr/bin/env node
// PreToolUse hook: refuse an implementer push whose branch changes a workflow
// file or a local action.
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
// Contract: stdin is the PreToolUse hook JSON. Print a deny decision as JSON on
// stdout to refuse; print nothing (exit 0) to let the normal permission flow
// proceed. The settings run this with `|| exit 2`, so a guard that cannot load
// or finish blocks the call instead of allowing it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

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

function git(args) {
  return execFileSync("git", args, {
    cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function listChanged(ref) {
  try {
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
    const out = git(["diff", "--name-only", "--no-renames", `${baseRef}...${ref}`, "--"]);
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

  const reason = decidePush(payload, listChanged);
  if (reason) deny(reason);
}

// Only run when invoked as the hook, so the unit test can import `decidePush`.
const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  main();
}
