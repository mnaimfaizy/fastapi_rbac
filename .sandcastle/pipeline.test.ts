// npm test (from .sandcastle/)
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Issue, assertTrusted, branchFor, branchPrefix } from "./issues.ts";
import { type IssueResult, ok, parseVerdict, pool, reviewPrompt, taskPrompt } from "./pipeline.ts";

const issue = (title: string, labels: string[] = [], login = "mnaimfaizy"): Issue => ({
  number: 279, title, body: "Body text.", author: { login }, labels: labels.map((name) => ({ name })),
});

test("branch prefix follows the Agent-kit label rule", () => {
  assert.equal(branchPrefix(["bug", "documentation"]), "fix");
  assert.equal(branchPrefix(["documentation"]), "docs");
  assert.equal(branchPrefix(["dependencies"]), "chore");
  assert.equal(branchPrefix(["enhancement"]), "feat");
});

test("branch names: slug, length cap, fallback", () => {
  assert.equal(branchFor(issue("Add rate limit to /auth/login!")), "feat/279-add-rate-limit-to-auth-login");
  assert.equal(branchFor(issue("Crash", ["bug"])), "fix/279-crash");
  const long = branchFor(issue("Refuse pending and inactive users on access token refresh endpoints"));
  assert.ok(long.length <= "feat/279-".length + 40, long);
  assert.ok(!long.endsWith("-"));
  assert.equal(branchFor(issue("!!!")), "feat/279-issue");
});

test("untrusted authors are refused", () => {
  assert.doesNotThrow(() => assertTrusted(issue("x")));
  assert.throws(() => assertTrusted(issue("x", [], "someone-else")), /not a trusted author/);
});

test("verdict parsing needs the exact first line", () => {
  assert.equal(parseVerdict("Verdict: approve\n\nLooks fine."), "approve");
  assert.equal(parseVerdict("  verdict: Changes Needed\r\n- a.py:3"), "changes needed");
  assert.equal(parseVerdict("I think approve"), "none");
  assert.equal(parseVerdict(""), "none");
});

test("prompts carry the issue and the review diff, and cut huge diffs", () => {
  assert.match(taskPrompt(issue("Title")), /^# Task: issue #279: Title/);
  const p = reviewPrompt(issue("Title"), "feat/279-title", "main", "abc123 feat: x", "+line");
  assert.match(p, /```diff\n\+line\n```/);
  assert.match(p, /Verdict: approve/);
  const big = reviewPrompt(issue("Title"), "b", "main", "", "x".repeat(200_000));
  assert.match(big, /cut at 150000 characters/);
  assert.ok(big.length < 160_000);
});

test("pool keeps order and never exceeds the limit", async () => {
  let running = 0;
  let peak = 0;
  const out = await pool([5, 1, 4, 2, 3], 2, async (n) => {
    peak = Math.max(peak, ++running);
    await new Promise((r) => setTimeout(r, n * 5));
    running--;
    return n * 10;
  });
  assert.deepEqual(out, [50, 10, 40, 20, 30]);
  assert.equal(peak, 2);
});

test("ok needs commits, no error, and passing gates when gated", () => {
  const base: IssueResult = { issue: 1, branch: "b", implementCommits: 1, reviewCommits: 0, verdict: "none", logs: [] };
  assert.equal(ok(base), true);
  assert.equal(ok({ ...base, implementCommits: 0 }), false);
  assert.equal(ok({ ...base, error: "x" }), false);
  assert.equal(ok({ ...base, gates: { passed: false, seconds: 1 } }), false);
});
