// Run coding agents (Claude Code, Cursor or Copilot) on one or more GitHub
// issues, in parallel, each in hardened sandboxes. Per issue: an implementer
// commits to a local branch, then a reviewer in a fresh sandbox checks the
// work and may commit fixes, then (with --gates) the gates run in another
// fresh sandbox. Nothing is pushed: review the branches, then push yourself.
//
//   npm run build -- --issue 279 --issue 281 [--concurrency 2]
//     [--agent claude|cursor|copilot] [--model <id>]
//     [--review-agent <kind>] [--review-model <id>] [--skip-review]
//     [--branch <name>  (one issue only)] [--base main] [--gates] [--dry-run]
import { parseArgs } from "node:util";
import {
  type AgentKind, assertNoForwardedEnvFile, buildAgent, credentialSources, loadHostEnv, resolveAgentKind,
  resolveCredential, resolveModel,
} from "./agents.ts";
import { FORBIDDEN_ENV, SANDCASTLE_DIR, assertLocalBranchName, branchExists } from "./config.ts";
import { type Issue, assertTrusted, branchFor, fetchIssue } from "./issues.ts";
import { ok, pool, runIssue, summary } from "./pipeline.ts";

const { values } = parseArgs({
  options: {
    issue: { type: "string", multiple: true },
    branch: { type: "string" },
    base: { type: "string", default: "main" },
    agent: { type: "string" },
    model: { type: "string" },
    "review-agent": { type: "string" },
    "review-model": { type: "string" },
    "skip-review": { type: "boolean", default: false },
    gates: { type: "boolean", default: false },
    concurrency: { type: "string", default: "2" },
    "dry-run": { type: "boolean", default: false },
  },
});

const numbers = [...new Set((values.issue ?? []).map(Number))];
if (numbers.length === 0 || numbers.some((n) => !Number.isInteger(n) || n <= 0)) {
  throw new Error("Pass one or more --issue <number>");
}
if (values.branch && numbers.length > 1) throw new Error("--branch only works with a single --issue");
const concurrency = Number(values.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error("--concurrency must be 1 to 4 (each sandbox takes 2 CPUs)");
}
const dryRun = values["dry-run"];

for (const k of FORBIDDEN_ENV) delete process.env[k];
assertNoForwardedEnvFile(SANDCASTLE_DIR);
const hostEnv = loadHostEnv(SANDCASTLE_DIR);
console.log(`credentials from: ${credentialSources(SANDCASTLE_DIR, hostEnv)}`);

// Credentials are resolved up front, so a missing one stops the run before
// any worktree or container exists. A dry run reports instead of stopping.
function agentFor(role: string, kind: AgentKind, modelFlag: string | undefined) {
  const model = resolveModel(kind, modelFlag, hostEnv);
  try {
    const credential = resolveCredential(kind, hostEnv);
    console.log(`${role}: ${kind}:${model} with ${Object.keys(credential).join(", ")}`);
    return buildAgent(kind, model, credential);
  } catch (err) {
    if (!dryRun) throw err;
    console.log(`${role}: ${kind}:${model} — MISSING CREDENTIAL: ${(err as Error).message}`);
    return undefined;
  }
}
const kind = resolveAgentKind(values.agent, hostEnv);
const implementer = agentFor("implementer", kind, values.model);
const reviewKind = values["skip-review"] ? undefined : resolveAgentKind(values["review-agent"] ?? kind, hostEnv);
const reviewer = reviewKind
  ? agentFor("reviewer", reviewKind, values["review-model"] ?? (reviewKind === kind ? values.model : undefined))
  : undefined;
if (!reviewKind) console.log("reviewer: skipped");

// Fetch and check every issue before starting any of them.
const jobs: { issue: Issue; branch: string }[] = numbers.map((n) => {
  const issue = fetchIssue(n);
  assertTrusted(issue);
  const branch = values.branch ?? branchFor(issue);
  assertLocalBranchName(branch);
  return { issue, branch };
});
if (new Set(jobs.map((j) => j.branch)).size !== jobs.length) throw new Error("Two issues map to the same branch");

console.log(`\n${jobs.length} issue(s), up to ${concurrency} at a time, base ${values.base}, gates ${values.gates ? "on" : "off"}`);
for (const j of jobs) {
  console.log(`  #${j.issue.number} → ${j.branch}${branchExists(j.branch) ? " (exists: the agent continues on it)" : ""}  ${j.issue.title}`);
}
if (dryRun) process.exit(implementer && (reviewer || !reviewKind) ? 0 : 1);

const results = await pool(jobs, concurrency, ({ issue, branch }) =>
  runIssue(issue, branch, { base: values.base!, implementer: implementer!, reviewer, gates: values.gates }, (l) =>
    console.log(`[#${issue.number}] ${l}`),
  ),
);

console.log(`\n${summary(results)}`);
for (const r of results) {
  if (r.reviewPath) console.log(`review #${r.issue}: ${r.reviewPath}`);
  for (const l of r.logs) console.log(`log    #${r.issue}: ${l}`);
}
const ungated = results.filter((r) => r.implementCommits > 0 && !r.gates).map((r) => `--branch ${r.branch}`);
if (ungated.length) console.log(`\nGate before pushing: ${ungated.map((b) => `npm run gate -- ${b}`).join("; ")}`);
console.log("All branches are local only. Nothing was pushed.");
process.exit(results.every(ok) ? 0 : 1);
