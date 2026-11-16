// Smoke test with no agent: starts the hardened sandbox on a throwaway local
// branch, checks isolation, then runs the gates.
//   npm run smoke            (from .sandcastle/)
//   npm run smoke -- --skip-gates
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { Sandbox } from "@ai-hero/sandcastle";
import { CREDENTIAL_KEYS, assertNoForwardedEnvFile } from "./agents.ts";
import {
  FORBIDDEN_ENV, LOGS_DIR, REPO_DIR, SANDCASTLE_DIR, execGates, openSandbox, removeWorktree, startServices,
  stopServices,
} from "./config.ts";

assertNoForwardedEnvFile(SANDCASTLE_DIR);

const BRANCH = "chore/sandcastle-smoke";
const skipGates = process.argv.includes("--skip-gates");

// The smoke branch holds no work. Delete it before and after, so a stale one
// from a crashed run never pins the test to an old commit, and none is pushed.
const deleteBranch = () => {
  try { execFileSync("git", ["-C", REPO_DIR, "branch", "-D", BRANCH], { stdio: "ignore" }); } catch {}
};
deleteBranch();

const svc = startServices("smoke");
let box: Sandbox;
try {
  box = await openSandbox(BRANCH, svc.network);
} catch (err) {
  deleteBranch(); // createSandbox makes the branch before it starts the container
  stopServices(svc);
  throw err;
}
let failed = false;

const check = async (label: string, cmd: string, ok: (out: string) => boolean) => {
  const r = await box.exec(cmd);
  const out = (r.stdout + r.stderr).trim();
  const pass = r.exitCode === 0 && ok(out);
  failed ||= !pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}\n      ${out.split("\n").join("\n      ")}`);
};

try {
  console.log(`sandbox ${box.sandboxId} on ${box.branch} at ${box.worktreePath}\n`);
  await check("runs as non-root", "id -u", (o) => o !== "0");
  await check("all capabilities dropped", "grep -E '^Cap(Eff|Prm|Bnd)' /proc/self/status",
    (o) => o.split("\n").every((l) => /0000000000000000$/.test(l)));
  await check("no GitHub tokens in env", "env | cut -d= -f1 | sort",
    (o) => !o.split("\n").some((k) => FORBIDDEN_ENV.includes(k)));
  await check("no host gh or cursor login", "ls -A ~/.config/gh ~/.cursor/cli-config.json 2>&1 || true",
    (o) => /No such file/.test(o));
  await check("python 3.10 venv", "python --version", (o) => o.startsWith("Python 3.10"));
  await check("cursor CLI present", "agent --version", () => true);
  await check("claude CLI present", "claude --version", () => true);
  await check("copilot CLI present", "copilot --version", () => true);
  await check("no agent credential baked into env", "env | cut -d= -f1",
    (o) => !o.split("\n").some((k) => CREDENTIAL_KEYS.includes(k)));
  await check("redis reachable", "python -c \"import redis; print(redis.Redis(host='redis').ping())\"",
    (o) => o === "True");
  const git = "git -c safe.directory='*'";
  await check("git hooks dir not writable",
    `d="$(${git} rev-parse --path-format=absolute --git-common-dir)/hooks"; test -d "$d" && { touch "$d/x" 2>/dev/null && echo "WRITABLE $d" || echo "blocked $d"; }`,
    (o) => o.startsWith("blocked"));
  await check("git config not writable",
    `f="$(${git} rev-parse --path-format=absolute --git-common-dir)/config"; test -f "$f" && { (echo >> "$f") 2>/dev/null && echo "WRITABLE $f" || echo "blocked $f"; }`,
    (o) => o.startsWith("blocked"));
  await check("worktree is not the live checkout", `${git} rev-parse --abbrev-ref HEAD`, (o) => o === BRANCH);

  if (!skipGates) {
    console.log("\nrunning gates.sh ...");
    const g = await execGates(box, resolve(LOGS_DIR, "smoke--gates.log"), (l) => console.log(l));
    console.log(`${g.passed ? "PASS" : "FAIL"}  gates (${g.seconds}s, log: ${g.logPath})`);
    failed ||= !g.passed;
  }
} finally {
  await box.close();
  removeWorktree(box.worktreePath);
  deleteBranch();
  stopServices(svc);
}
process.exit(failed ? 1 : 0);
