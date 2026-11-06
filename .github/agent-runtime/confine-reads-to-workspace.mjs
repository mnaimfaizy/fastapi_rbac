#!/usr/bin/env node
// PreToolUse hook: confine the built-in Read / Grep / Glob tools to the job's
// workspace ($GITHUB_WORKSPACE).
//
// Why a hook, not an --allowedTools scope: `--allowedTools` accumulates onto the
// action's base Read/Glob/Grep grant, and an allow entry only pre-approves a
// call — it cannot revoke the base grant, so `Read(./**)` does NOT confine these
// tools. Only a deny decides a call. A PreToolUse hook sees the resolved path
// and denies anything outside the workspace, so a runner file (/etc/*,
// /proc/self/environ, ~/.config/*) cannot be read and funnelled to a public
// comment.
//
// Paths are resolved with POSIX rules. These jobs run on Linux; using the
// platform path module would make the same input depend on the machine running
// the contract test.
//
// Glob is judged on its pattern as well as its path: the pattern alone can
// name an absolute or climbing location.
//
// A lexical check alone is not enough: the checkout is untrusted, and a symlink
// inside it passes a string comparison while the kernel follows it out of the
// tree on open. So a path that passes is also resolved on disk, and the real
// path must pass the same containment test.
//
// Contract: stdin is the PreToolUse hook JSON. Print a deny decision as JSON on
// stdout to refuse an out-of-tree read; print nothing (exit 0) to let the normal
// permission flow proceed. Malformed input that we cannot judge is allowed
// through — except a missing workspace, or a path that exists but cannot be
// resolved, where we fail closed. A hook error on its own is not a deny, so the
// settings run this with `|| exit 2`: if node cannot load or finish the script,
// the call is blocked.
import { realpathSync } from "node:fs";
import { isAbsolute, posix, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);

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

/**
 * The path the tool will open, with every symlink followed. The raw target is
 * joined, not normalized, and resolved with the native realpath(3): `link/..`
 * must step up from the link's target as the kernel does, not lexically (the JS
 * realpathSync normalizes first). Returns undefined when nothing exists there —
 * the tool has nothing to read — and null when the path cannot be resolved.
 */
function realTarget(workspace, target) {
  const joined = isAbsolute(target) ? target : `${workspace}/${target}`;
  try {
    return realpathSync.native(joined);
  } catch (error) {
    return error?.code === "ENOENT" || error?.code === "ENOTDIR" ? undefined : null;
  }
}

function within(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function hasGitSegment(rel) {
  return rel.split(/[\\/]/).includes(".git");
}

const GLOB_MAGIC = /[*?[\]{}!()]/;

/**
 * Glob matches its pattern from the filesystem, not from `path`: an absolute
 * pattern, one that climbs with `..`, or one whose literal leading directories
 * pass through a symlink lists names outside the tree whatever `path` says. So
 * refuse the first two outright, and judge the literal prefix as a path under
 * `path` with the same on-disk resolution as every other target.
 */
function decideGlobPattern(pattern, path, workspace) {
  if (pattern == null || pattern === "") return null;
  const p = String(pattern);
  const segments = p.split(/[\\/]/);
  if (/^([\\/~]|[A-Za-z]:)/.test(p) || segments.includes("..")) {
    return `read confined to the workspace; refused a Glob pattern outside GITHUB_WORKSPACE: ${p}`;
  }
  if (segments.includes(".git")) {
    return `read confined to the working tree; refused a Glob pattern inside .git: ${p}`;
  }
  const literal = [];
  for (const segment of segments) {
    if (GLOB_MAGIC.test(segment)) break;
    literal.push(segment);
  }
  if (literal.length === 0) return null;
  const base = path == null || path === "" ? "." : String(path);
  return decide(
    { tool_name: "Glob", tool_input: { path: `${base}/${literal.join("/")}` } },
    workspace,
  );
}

/** Decide on one hook payload. Returns a deny reason, or null to allow. */
export function decide(payload, workspace) {
  const tool = payload?.tool_name;
  if (!READ_TOOLS.has(tool)) return null; // other tools: their own rules

  if (tool === "Glob") {
    const reason = decideGlobPattern(
      payload?.tool_input?.pattern,
      payload?.tool_input?.path,
      workspace,
    );
    if (reason) return reason;
  }

  // Read uses file_path; Grep and Glob use path. Absent → the tool defaults to
  // the working directory, which is the workspace, so allow.
  const target = payload?.tool_input?.file_path ?? payload?.tool_input?.path;
  if (target == null || target === "") return null;

  if (!workspace) return "read confinement hook: GITHUB_WORKSPACE is unset";

  // resolve() canonicalizes `.`/`..` against the workspace and yields an
  // absolute path; a path already absolute is kept. It does not follow symlinks,
  // so pair it with the containment check below rather than trusting the string.
  const abs = posix.resolve(workspace, String(target));
  const ws = posix.resolve(workspace);
  const inside = abs === ws || abs.startsWith(`${ws}/`) || abs.startsWith(`${ws}\\`);
  if (!inside) {
    return `read confined to the workspace; refused a path outside GITHUB_WORKSPACE: ${abs}`;
  }
  // The --disallowedTools `Read(./.git/**)` rule is applied to Grep and Glob
  // only best-effort. Refuse `.git` here for all three read tools.
  if (hasGitSegment(posix.relative(ws, abs))) {
    return `read confined to the working tree; refused a path inside .git: ${abs}`;
  }

  const real = realTarget(workspace, String(target));
  if (real === undefined) return null;
  let realWs;
  try {
    realWs = realpathSync.native(workspace);
  } catch {
    realWs = null;
  }
  if (real === null || realWs === null || !within(realWs, real)) {
    return `read confined to the workspace; refused a path that resolves outside GITHUB_WORKSPACE: ${abs}`;
  }
  if (hasGitSegment(relative(realWs, real))) {
    return `read confined to the working tree; refused a path that resolves inside .git: ${abs}`;
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

  const reason = decide(payload, process.env.GITHUB_WORKSPACE);
  if (reason) deny(reason);
}

// Only run when invoked as the hook, so the unit test can import `decide`.
const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  main();
}
