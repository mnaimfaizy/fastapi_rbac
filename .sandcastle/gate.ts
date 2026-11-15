// Gate a finished local branch in a fresh hardened sandbox. Use this, or PR
// CI, instead of running gates.sh in a host shell: the gates run code the
// agent wrote.
//
//   npm run gate -- --branch feat/279-some-slug
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createSandbox } from "@ai-hero/sandcastle";
import { assertNoForwardedEnvFile } from "./agents.ts";
import {
  GATES, REPO_DIR, SANDCASTLE_DIR, assertLocalBranchName, ensureServices, removeWorktree, sandbox,
} from "./config.ts";

assertNoForwardedEnvFile(SANDCASTLE_DIR);
const { values } = parseArgs({ options: { branch: { type: "string" } } });
if (!values.branch) throw new Error("--branch is required");
assertLocalBranchName(values.branch);

// createSandbox would create a missing branch from HEAD; refuse instead.
try {
  execFileSync("git", ["-C", REPO_DIR, "rev-parse", "--verify", "--quiet", `refs/heads/${values.branch}`], { stdio: "ignore" });
} catch {
  throw new Error(`No local branch ${values.branch}`);
}

ensureServices();
const box = await createSandbox({ branch: values.branch, sandbox: sandbox(), cwd: REPO_DIR });
let code = 1;
try {
  const t = Date.now();
  const r = await box.exec("bash -s 2>&1", { stdin: GATES, onLine: (l) => console.log(`  ${l}`) });
  code = r.exitCode;
  console.log(`\ngates ${code === 0 ? "passed" : "FAILED"} on ${values.branch} (${Math.round((Date.now() - t) / 1000)}s)`);
} finally {
  await box.close();
  // Gate files (node_modules, build output) are not work; the branch keeps the commits.
  removeWorktree(box.worktreePath);
}
process.exit(code === 0 ? 0 : 1);
