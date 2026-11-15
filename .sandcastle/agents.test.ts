// npm test (from .sandcastle/)
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertNoForwardedEnvFile, loadHostEnv, resolveAgentKind, resolveCredential, resolveModel,
} from "./agents.ts";

const all = {
  CLAUDE_CODE_OAUTH_TOKEN: "oauth",
  ANTHROPIC_API_KEY: "sk-ant",
  CURSOR_API_KEY: "cur",
  COPILOT_GITHUB_TOKEN: "github_pat_x",
  GH_TOKEN: "gho_x",
};

test("each agent gets exactly its own credential", () => {
  assert.deepEqual(resolveCredential("cursor", all), { CURSOR_API_KEY: "cur" });
  assert.deepEqual(resolveCredential("copilot", all), { COPILOT_GITHUB_TOKEN: "github_pat_x" });
  assert.deepEqual(resolveCredential("claude", all), { CLAUDE_CODE_OAUTH_TOKEN: "oauth" });
});

test("claude auth: forced api, fallback to api key, bad mode", () => {
  assert.deepEqual(resolveCredential("claude", { ...all, SANDCASTLE_CLAUDE_AUTH: "api" }), { ANTHROPIC_API_KEY: "sk-ant" });
  assert.deepEqual(resolveCredential("claude", { ANTHROPIC_API_KEY: "sk-ant" }), { ANTHROPIC_API_KEY: "sk-ant" });
  assert.throws(() => resolveCredential("claude", { ANTHROPIC_API_KEY: "k", SANDCASTLE_CLAUDE_AUTH: "subscription" }));
  assert.throws(() => resolveCredential("claude", { ...all, SANDCASTLE_CLAUDE_AUTH: "both" }));
  assert.throws(() => resolveCredential("claude", {}));
});

test("copilot refuses classic and gh-login tokens", () => {
  for (const t of ["ghp_x", "gho_x", "ghu_x"]) {
    assert.throws(() => resolveCredential("copilot", { COPILOT_GITHUB_TOKEN: t }), /fine-grained/);
  }
});

test("agent and model selection", () => {
  assert.equal(resolveAgentKind(undefined, {}), "cursor");
  assert.equal(resolveAgentKind(undefined, { SANDCASTLE_AGENT: "Claude" }), "claude");
  assert.equal(resolveAgentKind("copilot", { SANDCASTLE_AGENT: "claude" }), "copilot");
  assert.throws(() => resolveAgentKind("codex", {}));
  assert.equal(resolveModel("claude", undefined, {}), "claude-opus-5-5");
  assert.equal(resolveModel("cursor", undefined, { SANDCASTLE_CURSOR_MODEL: "m" }), "m");
  assert.equal(resolveModel("cursor", "flag", { SANDCASTLE_CURSOR_MODEL: "m" }), "flag");
});

test("secrets.env is read, shell wins; .env with keys is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "sc-"));
  writeFileSync(join(dir, "secrets.env"), "# c\r\nCURSOR_API_KEY='file'\r\nANTHROPIC_API_KEY=file\r\n");
  const env = loadHostEnv(dir, { ANTHROPIC_API_KEY: "shell", EMPTY: "" });
  assert.equal(env.CURSOR_API_KEY, "file");
  assert.equal(env.ANTHROPIC_API_KEY, "shell");
  assertNoForwardedEnvFile(dir); // no .env: fine
  writeFileSync(join(dir, ".env"), "# only comments\n");
  assertNoForwardedEnvFile(dir);
  writeFileSync(join(dir, ".env"), "CURSOR_API_KEY=x\n");
  assert.throws(() => assertNoForwardedEnvFile(dir), /CURSOR_API_KEY/);
});
