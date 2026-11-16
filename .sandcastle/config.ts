// Shared settings and plumbing for main.ts, gate.ts, smoke.ts and e2e.ts.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSandbox, type Sandbox } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

export const SANDCASTLE_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_DIR = resolve(SANDCASTLE_DIR, "..");
// Read from the host and piped in on stdin, so the agent cannot edit its own gates.
export const GATES = readFileSync(resolve(SANDCASTLE_DIR, "gates.sh"), "utf8");
export const IMAGE = "sandcastle:fastapi-rbac";
const PREFIX = "sandcastle-fastapi-rbac";

// GitHub tokens that must never reach the sandbox. (Copilot's own
// COPILOT_GITHUB_TOKEN is handled in agents.ts: forwarded only on copilot runs.)
export const FORBIDDEN_ENV = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"];

export type Log = (line: string) => void;

const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).trim();
const quiet = (cmd: string, args: string[]) => {
  try {
    sh(cmd, args);
  } catch {
    // best effort
  }
};
export const git = (...args: string[]) => sh("git", ["-C", REPO_DIR, ...args]);

export interface Services {
  readonly network: string;
  readonly redis: string;
}

/**
 * A private network with its own Redis, one per run, so parallel runs never
 * share Redis state. Containers on it reach Redis as host "redis".
 */
export function startServices(id: string): Services {
  const safe = id.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
  const s = { network: `${PREFIX}-${safe}`, redis: `${PREFIX}-${safe}-redis` };
  quiet("docker", ["rm", "-f", s.redis]);
  quiet("docker", ["network", "create", s.network]);
  sh("docker", [
    // --user: the image's entrypoint otherwise needs SETUID to drop root.
    "run", "-d", "--name", s.redis, "--network", s.network, "--network-alias", "redis", "--user", "redis",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "256m",
    "redis:7.2-alpine",
  ]);
  return s;
}

export function stopServices(s: Services): void {
  quiet("docker", ["rm", "-f", s.redis]);
  quiet("docker", ["network", "rm", s.network]);
}

/** Hardened Docker sandbox. Sandcastle 0.14 has no memory or pids option. */
export const sandbox = (network: string) =>
  docker({
    imageName: IMAGE,
    network,
    capDrop: ["ALL"],
    cpus: 2,
    env: { REDIS_HOST: "redis" },
  });

// Parallel `git worktree add` calls on one repository can collide on git's
// lock files, so sandbox creation is serialised. Runs themselves overlap.
let chain: Promise<unknown> = Promise.resolve();
export function openSandbox(branch: string, network: string, baseBranch?: string): Promise<Sandbox> {
  const next = chain.then(() => createSandbox({ branch, baseBranch, sandbox: sandbox(network), cwd: REPO_DIR }));
  chain = next.catch(() => undefined);
  return next;
}

export function branchExists(branch: string): boolean {
  try {
    git("rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

/** Path of the worktree that has `branch` checked out, if any. */
export function worktreeFor(branch: string): string | undefined {
  let path: string | undefined;
  for (const line of git("worktree", "list", "--porcelain").split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    if (line === `branch refs/heads/${branch}`) return path;
  }
  return undefined;
}

/**
 * Remove a worktree Sandcastle kept after close() (it keeps dirty ones).
 * Only for throwaway smoke and gate worktrees: the branch and its commits stay.
 */
export function removeWorktree(path: string): void {
  quiet("git", ["-C", REPO_DIR, "worktree", "remove", "--force", path]);
}

/**
 * Gate a local branch in a fresh sandbox with its own Redis. A worktree that
 * already existed (an agent's uncommitted leftovers) is kept, not removed.
 */
export async function runGates(branch: string, log: Log): Promise<{ passed: boolean; seconds: number }> {
  const existing = worktreeFor(branch);
  if (existing) log(`note: gating the existing worktree ${existing}, uncommitted changes included`);
  const svc = startServices(`gate-${branch}`);
  const started = Date.now();
  try {
    const box = await openSandbox(branch, svc.network);
    try {
      const r = await box.exec("bash -s 2>&1", { stdin: GATES, onLine: (l) => log(`  ${l}`) });
      return { passed: r.exitCode === 0, seconds: Math.round((Date.now() - started) / 1000) };
    } finally {
      await box.close();
      if (!existing) removeWorktree(box.worktreePath);
    }
  } finally {
    stopServices(svc);
  }
}

/** Local-only branch the agent commits to. Never pushed by these scripts. */
export function assertLocalBranchName(branch: string): void {
  if (!/^(feat|fix|docs|test|refactor|chore)\/[a-z0-9][a-z0-9-]*$/.test(branch)) {
    throw new Error(`Branch "${branch}" does not follow docs/agents/branch-names.md`);
  }
}
