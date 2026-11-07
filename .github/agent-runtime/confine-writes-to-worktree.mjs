#!/usr/bin/env node
// PreToolUse hook: confine the implementer's file-writing tools (Edit, Write,
// MultiEdit, NotebookEdit) to the working tree, outside .git, and away from
// Claude Code's project settings (.claude/settings.json,
// .claude/settings.local.json, .mcp.json), whose permission rules a running
// session can pick up.
//
// Why: git runs commands that its configuration names, and runs the scripts in
// .git/hooks. The implementer holds the Claude GitHub App token, and the
// action's commit and push plumbing, the push guard, and the checks after the
// agent all run git in this checkout. A write to .git/config, .git/hooks, or a
// global git config outside the workspace would let text the agent read pick a
// command that runs with those credentials. The `Edit(./.git/**)` deny covers
// the same ground by pattern; this hook judges the resolved path.
//
// A lexical check alone is not enough: the checkout is untrusted, and a symlink
// in it passes a string comparison while the write follows it. A target that
// does not exist yet is judged by its nearest existing ancestor, with symlinks
// resolved; a dangling symlink anywhere on the way is refused, because the
// write would create its target.
//
// Paths are resolved with POSIX rules, as in confine-reads-to-workspace.mjs.
//
// Contract: stdin is the PreToolUse hook JSON. Print a deny decision as JSON on
// stdout to refuse; print nothing (exit 0) to let the normal permission flow
// proceed. The settings run this with `|| exit 2`, so a hook that cannot load
// or finish blocks the call instead of allowing it.
import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, posix, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

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

function within(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function hasGitSegment(rel) {
  return rel.split(/[\\/]/).includes(".git");
}

// Claude Code reads permission rules and MCP servers from these, and a running
// session can pick up a changed permission rule. Skills and other files under
// .claude/ stay writable: a plan may ask the implementer to change them.
const PROJECT_SETTINGS = new Set([
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".mcp.json",
]);

function isProjectSettings(rel) {
  return PROJECT_SETTINGS.has(rel.split(/[\\/]/).join("/"));
}

/**
 * Where a write to `abs` lands, with every existing symlink followed. Walks up
 * to the nearest path that exists and resolves that. Returns null when the
 * path cannot be resolved, or passes through a dangling symlink.
 */
function resolveForWrite(abs) {
  let current = abs;
  const rest = [];
  for (;;) {
    try {
      const real = realpathSync.native(current);
      return rest.length ? `${real}/${rest.join("/")}` : real;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") return null;
    }
    try {
      lstatSync(current);
      return null; // it exists but cannot be resolved: a dangling symlink
    } catch {
      // nothing here yet; judge the parent
    }
    const parent = posix.dirname(current);
    if (parent === current) return null;
    rest.unshift(posix.basename(current));
    current = parent;
  }
}

/** Decide on one hook payload. Returns a deny reason, or null to allow. */
export function decideWrite(payload, workspace) {
  const tool = payload?.tool_name;
  if (!WRITE_TOOLS.has(tool)) return null;

  const input = payload?.tool_input;
  const target = tool === "NotebookEdit" ? input?.notebook_path : input?.file_path;
  if (target == null || target === "") return null; // nothing to write to

  if (!workspace) return "write confinement hook: GITHUB_WORKSPACE is unset";

  const abs = posix.resolve(workspace, String(target));
  const ws = posix.resolve(workspace);
  const inside = abs === ws || abs.startsWith(`${ws}/`) || abs.startsWith(`${ws}\\`);
  if (!inside) {
    return `writes confined to the workspace; refused a path outside GITHUB_WORKSPACE: ${abs}`;
  }
  if (hasGitSegment(posix.relative(ws, abs))) {
    return `writes confined to the working tree; refused a path inside .git: ${abs}`;
  }
  if (isProjectSettings(posix.relative(ws, abs))) {
    return `the implementer cannot edit Claude Code project settings: ${abs}`;
  }

  const real = resolveForWrite(
    isAbsolute(String(target)) ? String(target) : `${workspace}/${target}`,
  );
  let realWs;
  try {
    realWs = realpathSync.native(workspace);
  } catch {
    realWs = null;
  }
  if (real === null || realWs === null) {
    return `writes confined to the workspace; refused a path that cannot be resolved: ${abs}`;
  }
  if (!within(realWs, real)) {
    return `writes confined to the workspace; refused a path that resolves outside GITHUB_WORKSPACE: ${abs}`;
  }
  if (hasGitSegment(relative(realWs, real))) {
    return `writes confined to the working tree; refused a path that resolves inside .git: ${abs}`;
  }
  if (isProjectSettings(relative(realWs, real))) {
    return `the implementer cannot edit Claude Code project settings; refused a path that resolves to one: ${abs}`;
  }
  return null;
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

  const reason = decideWrite(payload, process.env.GITHUB_WORKSPACE);
  if (reason) deny(reason);
}

// Only run when invoked as the hook, so the unit test can import `decideWrite`.
const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  main();
}
