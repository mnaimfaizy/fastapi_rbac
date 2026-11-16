// Gate a finished local branch in a fresh hardened sandbox. Use this, or PR
// CI, instead of running gates.sh in a host shell: the gates run code the
// agent wrote.
//
//   npm run gate -- --branch feat/279-some-slug
import { parseArgs } from "node:util";
import { assertNoForwardedEnvFile } from "./agents.ts";
import { SANDCASTLE_DIR, assertLocalBranchName, branchExists, runGates } from "./config.ts";

assertNoForwardedEnvFile(SANDCASTLE_DIR);
const { values } = parseArgs({ options: { branch: { type: "string" } } });
if (!values.branch) throw new Error("--branch is required");
assertLocalBranchName(values.branch);
// createSandbox would create a missing branch from HEAD; refuse instead.
if (!branchExists(values.branch)) throw new Error(`No local branch ${values.branch}`);

const { passed, seconds, logPath, failedGate } = await runGates(values.branch, (l) => console.log(l));
console.log(`\ngates ${passed ? "passed" : `FAILED at ${failedGate}`} on ${values.branch} (${seconds}s). Log: ${logPath}`);
process.exit(passed ? 0 : 1);
