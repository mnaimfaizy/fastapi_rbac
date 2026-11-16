// Agent selection and credentials. Exactly one credential, for the selected
// agent, reaches the sandbox, through that agent provider's own env.
//
// Credentials come from, highest first: a 1Password Environment (when
// OP_ENVIRONMENT_ID is set), the shell, then the gitignored
// .sandcastle/secrets.env. Only this host code reads them. Never use
// .sandcastle/.env for secrets: Sandcastle forwards every key in it into the
// sandbox, whichever agent runs.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { release } from "node:os";
import { resolve } from "node:path";
import { claudeCode, copilot, cursor } from "@ai-hero/sandcastle";

export type AgentKind = "claude" | "cursor" | "copilot";
export const AGENT_KINDS: readonly AgentKind[] = ["claude", "cursor", "copilot"];

export const DEFAULT_MODELS: Record<AgentKind, string> = {
  claude: "claude-opus-5-5",
  cursor: "composer-2.5",
  copilot: "claude-sonnet-5.5",
};

/** Every credential name any agent may use; none of them may sit in .sandcastle/.env. */
export const CREDENTIAL_KEYS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "CURSOR_API_KEY", "COPILOT_GITHUB_TOKEN"];

type Env = Record<string, string | undefined>;

const parseDotenv = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
      }),
  );

export type RunOp = (bin: string, args: string[]) => string;
const runOp: RunOp = (bin, args) =>
  execFileSync(bin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 });

/**
 * Which 1Password CLI to call. Under WSL the Linux `op` cannot use the Windows
 * desktop app, so 1Password's docs say to call the Windows `op.exe`; with a
 * service-account token the Linux `op` works. OP_CLI overrides both.
 */
export function opBinary(env: Env, wsl = /microsoft/i.test(release())): string {
  if (env.OP_CLI) return env.OP_CLI;
  return wsl && !env.OP_SERVICE_ACCOUNT_TOKEN ? "op.exe" : "op";
}

/**
 * Read every variable of a 1Password Environment, in memory, with
 * `op environment secret list <id> --reveal --format=dotenv` (CLI 2.42.0+).
 * Nothing is written to disk and no value is printed.
 */
export function readOpEnvironment(id: string, env: Env, run: RunOp = runOp): Record<string, string> {
  const bin = opBinary(env);
  let out: string;
  try {
    out = run(bin, ["environment", "secret", "list", id, "--reveal", "--format=dotenv"]);
  } catch (err) {
    const detail = String((err as { stderr?: unknown }).stderr ?? (err as Error).message ?? err).trim();
    const hint = /unknown command|unknown flag/i.test(detail)
      ? " It needs 1Password CLI 2.42.0 or later: `winget upgrade AgileBits.1Password.CLI` on Windows."
      : /couldn't be found|not found|no environment/i.test(detail)
        ? " Check OP_ENVIRONMENT_ID: copy it from Developer → View Environments → Manage environment."
      : /ENOENT/.test(detail)
        ? ` \`${bin}\` was not found. Install the 1Password CLI, or set OP_CLI to its path.`
        : " Is the 1Password desktop app unlocked, with Settings → Developer → Integrate with 1Password CLI on?";
    throw new Error(`Could not read 1Password Environment ${id} with ${bin}.${hint}\n${detail.split("\n")[0]}`);
  }
  return parseDotenv(out);
}

/**
 * The host's credentials and settings: a 1Password Environment (OP_ENVIRONMENT_ID)
 * over the shell over .sandcastle/secrets.env. The Environment wins, the same
 * order `op run` uses.
 */
export function loadHostEnv(
  sandcastleDir: string,
  env: Env = process.env,
  readEnvironment: (id: string, env: Env) => Record<string, string> = readOpEnvironment,
): Env {
  const file = resolve(sandcastleDir, "secrets.env");
  const fromFile = existsSync(file) ? parseDotenv(readFileSync(file, "utf8")) : {};
  const merged: Env = { ...fromFile, ...Object.fromEntries(Object.entries(env).filter(([, v]) => v)) };
  const id = merged.OP_ENVIRONMENT_ID?.trim();
  return id ? { ...merged, ...readEnvironment(id, merged) } : merged;
}

/** Where credentials were read from, for the run header. Never includes values. */
export function credentialSources(sandcastleDir: string, env: Env = process.env): string {
  const sources = [];
  const id = env.OP_ENVIRONMENT_ID?.trim();
  if (id) sources.push(`1Password Environment ${id} via ${opBinary(env)}`);
  sources.push("shell");
  if (existsSync(resolve(sandcastleDir, "secrets.env"))) sources.push(".sandcastle/secrets.env");
  return sources.join(" > ");
}

/** Refuse to run when .sandcastle/.env holds any key: Sandcastle would forward all of them. */
export function assertNoForwardedEnvFile(sandcastleDir: string): void {
  const file = resolve(sandcastleDir, ".env");
  if (!existsSync(file)) return;
  const keys = Object.keys(parseDotenv(readFileSync(file, "utf8")));
  if (keys.length > 0) {
    throw new Error(
      `.sandcastle/.env sets ${keys.join(", ")}. Sandcastle forwards every key in it into the sandbox. ` +
        `Move secrets to .sandcastle/secrets.env or your shell, and delete .sandcastle/.env.`,
    );
  }
}

export function resolveAgentKind(flag: string | undefined, env: Env): AgentKind {
  const raw = (flag ?? env.SANDCASTLE_AGENT ?? "cursor").trim().toLowerCase();
  if (!AGENT_KINDS.includes(raw as AgentKind)) {
    throw new Error(`Unknown agent "${raw}". Use one of: ${AGENT_KINDS.join(", ")}`);
  }
  return raw as AgentKind;
}

export function resolveModel(kind: AgentKind, flag: string | undefined, env: Env): string {
  return flag ?? env[`SANDCASTLE_${kind.toUpperCase()}_MODEL`] ?? DEFAULT_MODELS[kind];
}

/**
 * The single credential for this agent, as { NAME: value }.
 * Claude: CLAUDE_CODE_OAUTH_TOKEN wins over ANTHROPIC_API_KEY unless
 * SANDCASTLE_CLAUDE_AUTH forces "subscription" or "api" (same rule as myorganiser).
 */
export function resolveCredential(kind: AgentKind, env: Env): Record<string, string> {
  const need = (name: string, hint: string): Record<string, string> => {
    const value = env[name];
    if (!value) throw new Error(`${kind} needs ${name}. ${hint}`);
    return { [name]: value };
  };
  switch (kind) {
    case "cursor":
      return need("CURSOR_API_KEY", "Create one at cursor.com/dashboard → Integrations.");
    case "copilot": {
      const cred = need(
        "COPILOT_GITHUB_TOKEN",
        "Use a fine-grained token (github_pat_…) with only the Copilot Requests permission and no repository access.",
      );
      if (!cred.COPILOT_GITHUB_TOKEN.startsWith("github_pat_")) {
        throw new Error(
          "COPILOT_GITHUB_TOKEN must be a fine-grained token (github_pat_…). Classic (ghp_) and gh login (gho_) " +
            "tokens usually carry repository access, which the sandbox must not have.",
        );
      }
      return cred;
    }
    case "claude": {
      const forced = (env.SANDCASTLE_CLAUDE_AUTH ?? "").trim().toLowerCase();
      if (forced && forced !== "subscription" && forced !== "api") {
        throw new Error(`SANDCASTLE_CLAUDE_AUTH must be "subscription" or "api" (got "${forced}").`);
      }
      const tokenHint = "Run `claude setup-token` on the host.";
      if (forced === "subscription") return need("CLAUDE_CODE_OAUTH_TOKEN", tokenHint);
      if (forced === "api") return need("ANTHROPIC_API_KEY", "Metered API billing.");
      if (env.CLAUDE_CODE_OAUTH_TOKEN) return { CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN };
      if (env.ANTHROPIC_API_KEY) return { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
      throw new Error(`claude needs CLAUDE_CODE_OAUTH_TOKEN (${tokenHint}) or ANTHROPIC_API_KEY.`);
    }
  }
}

export function buildAgent(kind: AgentKind, model: string, credential: Record<string, string>) {
  switch (kind) {
    case "claude":
      return claudeCode(model, { env: { ...credential, DISABLE_AUTOUPDATER: "1" } });
    case "cursor":
      return cursor(model, { env: credential });
    case "copilot":
      return copilot(model, { env: credential });
  }
}
