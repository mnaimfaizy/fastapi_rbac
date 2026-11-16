// npm test (from .sandcastle/)
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertNoForwardedEnvFile, credentialSources, loadHostEnv, opBinary, readOpEnvironment, resolveAgentKind,
  resolveCredential, resolveModel,
} from "./agents.ts";

test("1Password Environment wins over shell and secrets.env, and is only read when set", () => {
  const dir = mkdtempSync(join(tmpdir(), "sc-op-"));
  writeFileSync(join(dir, "secrets.env"), "CURSOR_API_KEY=file\nOP_ENVIRONMENT_ID=env-from-file\n");
  const seen: string[] = [];
  const read = (id: string) => {
    seen.push(id);
    return { CURSOR_API_KEY: "from-1password", SANDCASTLE_AGENT: "claude" };
  };
  const env = loadHostEnv(dir, { CURSOR_API_KEY: "shell" }, read);
  assert.deepEqual(seen, ["env-from-file"]);
  assert.equal(env.CURSOR_API_KEY, "from-1password");
  assert.equal(env.SANDCASTLE_AGENT, "claude");
  const noOp = mkdtempSync(join(tmpdir(), "sc-op-"));
  assert.equal(loadHostEnv(noOp, { CURSOR_API_KEY: "shell" }, () => assert.fail("read without an id")).CURSOR_API_KEY, "shell");
  assert.match(credentialSources(dir, env), /^1Password Environment env-from-file via op(\.exe)? > shell > \.sandcastle\/secrets\.env$/);
});

test("op binary: op.exe under WSL unless a service account or OP_CLI is set", () => {
  assert.equal(opBinary({}, true), "op.exe");
  assert.equal(opBinary({}, false), "op");
  assert.equal(opBinary({ OP_SERVICE_ACCOUNT_TOKEN: "ops_x" }, true), "op");
  assert.equal(opBinary({ OP_CLI: "/opt/op" }, true), "/opt/op");
});

test("readOpEnvironment calls secret list and explains failures", () => {
  let args: string[] = [];
  const vars = readOpEnvironment("abc", { OP_CLI: "op" }, (_bin, a) => {
    args = a;
    return "CURSOR_API_KEY=k\r\nANTHROPIC_API_KEY=\"q\"\n";
  });
  assert.deepEqual(args, ["environment", "secret", "list", "abc", "--reveal", "--format=dotenv"]);
  assert.deepEqual(vars, { CURSOR_API_KEY: "k", ANTHROPIC_API_KEY: "q" });
  const fail = (stderr: string) => () =>
    readOpEnvironment("abc", { OP_CLI: "op" }, () => { throw Object.assign(new Error("x"), { stderr }); });
  assert.throws(fail('[ERROR] unknown command "environment" for "op"'), /2\.42\.0/);
  assert.throws(fail("spawn op ENOENT"), /was not found/);
  assert.throws(fail("[ERROR] 2026/11/16 12:04:44 environment couldn't be found"), /Check OP_ENVIRONMENT_ID/);
  assert.throws(fail("[ERROR] authorization prompt dismissed"), /desktop app unlocked/);
});

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
