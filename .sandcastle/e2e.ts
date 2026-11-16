// End-to-end check of the pipeline with no API keys: two fixture issues run in
// parallel through real sandboxes, with fake agents (shell commands) standing
// in for Claude, Cursor or Copilot. Cleans up its branches afterwards.
//   npm run e2e            (from .sandcastle/)
//   npm run e2e -- --gates (also gate both branches, a few minutes more)
import { existsSync, readFileSync, rmSync } from "node:fs";
import type { AgentProvider } from "@ai-hero/sandcastle";
import { CREDENTIAL_KEYS } from "./agents.ts";
import { FORBIDDEN_ENV, git, removeWorktree, worktreeFor } from "./config.ts";
import { type Issue, branchFor } from "./issues.ts";
import { REVIEW_FILE, REVIEW_RESULT_FILE, TASK_FILE, ok, pool, runIssue, summary } from "./pipeline.ts";

const withGates = process.argv.includes("--gates");
const base = git("rev-parse", "HEAD");
const secrets = [...FORBIDDEN_ENV, ...CREDENTIAL_KEYS].join("|");

// Fails (non-zero exit, no commit) if its input is missing or a secret is in its env.
const fake = (name: string, script: string): AgentProvider => ({
  name,
  env: {},
  captureSessions: false,
  buildPrintCommand: () => ({ command: `bash -c '${`set -euo pipefail\n${script}`.replace(/'/g, `'\\''`)}'` }),
  parseStreamLine: (line: string) => [{ type: "text" as const, text: line }],
});
const noSecrets = `if env | cut -d= -f1 | grep -Eqx '${secrets}'; then echo "secret in env"; exit 3; fi`;
const implementer = fake("fake-implementer", `
${noSecrets}
grep -q '^# Task: issue #' ${TASK_FILE}
echo "implemented $(head -1 ${TASK_FILE})" >> SANDCASTLE_E2E.txt
git add SANDCASTLE_E2E.txt
git commit -q -m "test(e2e): fake implementer commit"
echo "<promise>COMPLETE</promise>"`);
const reviewer = fake("fake-reviewer", `
${noSecrets}
grep -q '^## Diff' ${REVIEW_FILE}
grep -q 'SANDCASTLE_E2E.txt' ${REVIEW_FILE}
echo "reviewed" >> SANDCASTLE_E2E.txt
git add SANDCASTLE_E2E.txt
git commit -q -m "test(e2e): fake reviewer fix"
printf 'Verdict: approve\\n\\nFake review: diff received, one fix committed.\\n' > ${REVIEW_RESULT_FILE}
echo "<promise>COMPLETE</promise>"`);

const fixture = (n: number, title: string): Issue => ({
  number: n, title, body: `Fixture issue ${n} for the Sandcastle e2e check.`, author: { login: "e2e" }, labels: [{ name: "maintenance" }],
});
const issues = [fixture(990001, "Sandcastle e2e fixture A"), fixture(990002, "Sandcastle e2e fixture B")];
const branches = issues.map(branchFor);
const cleanup = () => {
  for (const b of branches) {
    const wt = worktreeFor(b);
    if (wt) removeWorktree(wt);
    try { git("branch", "-D", b); } catch {}
  }
};
cleanup();

const started = Date.now();
const results = await pool(issues, 2, (issue) =>
  runIssue(issue, branchFor(issue), { base, implementer, reviewer, gates: withGates, idleTimeoutSeconds: 120 }, (l) =>
    console.log(`[#${issue.number}] ${l}`),
  ),
);
console.log(`\n${summary(results)}\n`);

let failed = false;
const check = (label: string, pass: boolean) => {
  failed ||= !pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
};
for (const r of results) {
  const commits = r.error ? [] : git("log", "--format=%s", `${base}..${r.branch}`).split("\n").filter(Boolean);
  check(`#${r.issue} no error${r.error ? `: ${r.error}` : ""}`, !r.error);
  check(`#${r.issue} implementer committed on ${r.branch}`, r.implementCommits === 1);
  check(`#${r.issue} reviewer committed a fix in its own sandbox`, r.reviewCommits === 1);
  check(`#${r.issue} branch has both commits`, commits.length === 2);
  check(`#${r.issue} verdict read from the sandbox`, r.verdict === "approve");
  check(`#${r.issue} review saved on the host`, !!r.reviewPath && existsSync(r.reviewPath) &&
    readFileSync(r.reviewPath, "utf8").includes("Verdict: approve"));
  check(`#${r.issue} no leftover worktree`, !r.leftoverWorktree);
  if (withGates) check(`#${r.issue} gates passed`, r.gates?.passed === true);
  check(`#${r.issue} overall ok`, ok(r));
  if (r.reviewPath) rmSync(r.reviewPath, { force: true });
}
check("both issues ran", results.length === 2);
console.log(`\ne2e ${failed ? "FAILED" : "passed"} in ${Math.round((Date.now() - started) / 1000)}s`);
cleanup();
process.exit(failed ? 1 : 0);
