// Shared settings for smoke.ts and main.ts.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

export const SANDCASTLE_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_DIR = resolve(SANDCASTLE_DIR, "..");
// Read from the host and piped in on stdin, so the agent cannot edit its own gates.
export const GATES = readFileSync(resolve(SANDCASTLE_DIR, "gates.sh"), "utf8");
export const IMAGE = "sandcastle:fastapi-rbac";
export const NETWORK = "sandcastle-fastapi-rbac";
export const REDIS = "sandcastle-fastapi-rbac-redis";

// GitHub tokens that must never reach the sandbox. (Copilot's own
// COPILOT_GITHUB_TOKEN is handled in agents.ts: forwarded only on copilot runs.)
export const FORBIDDEN_ENV = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"];

const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** Private network plus a Redis container for the unit tests. Idempotent. */
export function ensureServices(): void {
  try {
    sh("docker", ["network", "inspect", NETWORK]);
  } catch {
    sh("docker", ["network", "create", NETWORK]);
  }
  try {
    sh("docker", ["inspect", REDIS]);
    sh("docker", ["start", REDIS]);
  } catch {
    sh("docker", [
      // --user: the image's entrypoint otherwise needs SETUID to drop root.
      "run", "-d", "--name", REDIS, "--network", NETWORK, "--network-alias", "redis", "--user", "redis",
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "256m",
      "redis:7.2-alpine",
    ]);
  }
}

/** Hardened Docker sandbox. Sandcastle 0.14 has no memory or pids option. */
export const sandbox = () =>
  docker({
    imageName: IMAGE,
    network: NETWORK,
    capDrop: ["ALL"],
    cpus: 2,
    env: { REDIS_HOST: "redis" },
  });

/**
 * Remove a worktree Sandcastle kept after close() (it keeps dirty ones).
 * Only for throwaway smoke and gate worktrees: the branch and its commits stay.
 */
export function removeWorktree(path: string): void {
  try {
    execFileSync("git", ["-C", REPO_DIR, "worktree", "remove", "--force", path], { stdio: "ignore" });
  } catch {
    // already gone
  }
}

/** Local-only branch the agent commits to. Never pushed by these scripts. */
export function assertLocalBranchName(branch: string): void {
  if (!/^(feat|fix|docs|test|refactor|chore)\/[a-z0-9][a-z0-9-]*$/.test(branch)) {
    throw new Error(`Branch "${branch}" does not follow docs/agents/branch-names.md`);
  }
}
