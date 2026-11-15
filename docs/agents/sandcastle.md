# Sandcastle runbook

[Sandcastle](https://github.com/mattpocock/sandcastle) (`@ai-hero/sandcastle`, pinned to `0.14.0`) runs a coding agent on one GitHub issue inside a locked-down Docker container. The agent commits to a **local** branch. Nothing is pushed: you review the branch, gate it, and push and open the PR yourself.

Everything lives in `.sandcastle/`. It is separate from the [Agent-kit pipeline](agent-kit.md), which runs Claude in GitHub Actions on issue labels. Use Agent-kit for work you want done in the cloud from a label. Use Sandcastle for local runs, with Claude Code, Cursor or GitHub Copilot, billed to your own plans.

## Rules

- The agent never gets a GitHub credential that can touch repositories. The host fetches the issue with `gh`, and only issues written by a trusted author (`TRUSTED_AUTHORS` in `main.ts`) become prompts.
- Commits go to a named local branch through Sandcastle's `branch` strategy, never into your checked-out branch.
- Nothing in `.sandcastle/` pushes. You push after reviewing the diff.
- Never run `gates.sh` in a host shell. It runs code the agent wrote. Gate a branch in a fresh sandbox (`npm run gate`) or in PR CI.
- Only the selected agent's one credential enters the sandbox.

## Files

| File | Purpose |
| --- | --- |
| `.sandcastle/main.ts` | Runs one agent on one issue: `npm run build` |
| `.sandcastle/gate.ts` | Gates a finished local branch in a fresh sandbox: `npm run gate` |
| `.sandcastle/smoke.ts` | Checks the sandbox's isolation, with no agent: `npm run smoke` |
| `.sandcastle/agents.ts` | Agent choice, models and credential rules. Tested by `agents.test.ts` (`npm test`) |
| `.sandcastle/config.ts` | Container hardening, the private network and Redis, branch-name check |
| `.sandcastle/gates.sh` | The fast gates. Keep in step with `verify_commands` in `.github/workflows/agent-kit-pipeline.yml` |
| `.sandcastle/Dockerfile` | The `sandcastle:fastapi-rbac` image |
| `.sandcastle/secrets.env.example` | Template for credentials and settings |

## What the sandbox enforces

`npm run smoke` checks each of these:

- The agent runs as a non-root user, with every Linux capability dropped (`--cap-drop ALL`) and at most 2 CPUs.
- No `GH_TOKEN` or `GITHUB_TOKEN`, and no host `gh` or Cursor login, inside the container.
- The repository's `.git` config and hooks are read-only.
- The agent works in its own git worktree under `.sandcastle/worktrees/`, on its own branch.
- Redis for the unit tests runs on a private Docker network (`sandcastle-fastapi-rbac`).
- The gates script is piped in from the host, so the agent cannot edit its own gates.
- The issue text is written to a file in the container, not passed on the command line.

**Not enforced yet:**

- **Outbound network.** The agent can reach the whole internet, so a prompt-injected agent could leak its own API key. Sandcastle's `network` option makes a proxy allowlist possible. It is not built.
- **Memory and process limits.** Sandcastle 0.14 has no option for them. Set an overall limit in Docker Desktop → Settings → Resources.

## One-time setup

### Requirements

- Docker Desktop running (`docker info` prints a server version).
- Node 22 or later.
- `gh auth status` signed in, on the host only.

### Where to run it

Run Sandcastle from a repository on a Linux filesystem. On Windows, that means a clone inside WSL2, not `D:\`. Measured on the same machine and image:

| | `D:\` checkout | WSL2 clone (ext4) |
| --- | --- | --- |
| Isolation checks (`--skip-gates`) | about 1 minute | 13 seconds |
| Full gates | 19 minutes, failed | 1.5 to 3 minutes (slower right after an image rebuild) |
| Line endings | CRLF: Git for Windows sets `core.autocrlf=true`, so Prettier reports tens of thousands of `␍` errors | LF |

On `D:\` most of the time goes to `npm ci` writing through Docker Desktop's Windows bind mount.

To set up WSL2:

1. In Docker Desktop: **Settings → Resources → WSL Integration**, turn on your distro (for example `Ubuntu`), then **Apply & Restart**. In the distro, `docker info` should print a server version.
2. Install Node 22 in the distro:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```

   ```bash
   exec bash && nvm install 22 && nvm alias default 22
   ```

3. Run `gh auth login` in the distro.
4. Clone onto the Linux filesystem (under `~`, never under `/mnt/d`):

   ```bash
   git clone git@github.com:mnaimfaizy/fastapi_rbac.git ~/projects/fastapi_rbac
   ```

Keep the `D:\` checkout for editing. Use the WSL2 clone only for Sandcastle runs.

Run `wsl` commands from PowerShell, not Git Bash. Git Bash rewrites `/mnt/c/...` paths and `$` variables before WSL sees them.

The image's `agent` user is UID 1000, the usual first WSL user. If `id -u` in your distro prints something else, build with `--build-arg AGENT_UID=$(id -u) --build-arg AGENT_GID=$(id -g)`.

### Install and build the image

From `.sandcastle/`:

```bash
npm ci
```

```bash
npm run image
```

The image holds Python 3.10 with `backend/requirements.txt`, an offline npm cache for the frontend, and the Claude Code, Cursor and Copilot CLIs. Dependencies are installed at build time, so a run needs no PyPI or npm access.

**Rebuild the image** (`npm run image`) after changing `.sandcastle/Dockerfile`, `backend/requirements.txt` or `react-frontend/package-lock.json`. Nothing rebuilds it for you.

### Credentials

**Never create `.sandcastle/.env`.** Sandcastle forwards every key in it into the sandbox, whichever agent runs. All the scripts refuse to start if it holds any keys.

Put credentials in one of these. The first one wins:

1. Your shell environment, or `op run` from 1Password.
2. `.sandcastle/secrets.env`, which is gitignored and read only by the host scripts. Copy it from `secrets.env.example`.

With 1Password, put `op://` references in `.sandcastle/op.env` (gitignored), then run through `op run`:

```bash
op run --env-file .sandcastle/op.env -- npm --prefix .sandcastle run build -- --issue 279 --branch feat/279-some-slug --agent claude
```

| Agent | Credential | Notes |
| --- | --- | --- |
| `claude` | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` | Exactly one is sent. The OAuth token (`claude setup-token`, Pro/Max plan) wins when both are set. `SANDCASTLE_CLAUDE_AUTH=subscription` or `api` forces one |
| `cursor` | `CURSOR_API_KEY` | From the Cursor dashboard |
| `copilot` | `COPILOT_GITHUB_TOKEN` | Must be a fine-grained token (`github_pat_…`) with only the Copilot Requests permission and no repository access. Classic `ghp_` and `gh` login `gho_` tokens are refused |

A missing or refused credential stops the run before any worktree or container is created.

### Check the sandbox

```bash
npm run smoke -- --skip-gates
```

Every line should say `PASS`. Without `--skip-gates` it also runs the full gates. The smoke branch `chore/sandcastle-smoke` is deleted afterwards.

## Running an agent

From `.sandcastle/`:

```bash
npm run build -- --issue 279 --branch feat/279-some-slug --agent claude
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--issue` | required | GitHub issue number. Its author must be in `TRUSTED_AUTHORS` |
| `--branch` | required | Local branch for the agent's commits. Must follow [branch-names.md](branch-names.md) |
| `--agent` | `SANDCASTLE_AGENT`, else `cursor` | `claude`, `cursor` or `copilot` |
| `--model` | `SANDCASTLE_<AGENT>_MODEL`, else the default below | Model id for that agent |
| `--base` | `main` | Branch to start from when `--branch` does not exist yet |
| `--gates` | off | Also run the gates in the agent's sandbox when it finishes |

Default models: `claude-opus-5-5` (Claude), `composer-2.5` (Cursor), `claude-sonnet-5.5` (Copilot).

The run prints the agent and the credential name it uses, the number of commits, and the log path under `.sandcastle/logs/`. It exits non-zero when the agent made no commits, or when `--gates` was given and the gates failed.

## After a run

1. Read the diff:

   ```bash
   git log --stat main..feat/279-some-slug
   ```

2. Gate it in a fresh sandbox:

   ```bash
   npm run gate -- --branch feat/279-some-slug
   ```

3. If it passes and the diff is what the issue asked for, push the branch and open the PR yourself. PR CI runs the full suites. Anything an agent wrote is untrusted until you have read it.

## Recovering

- **A container is left running** after a crash or a hard kill: `docker ps --filter ancestor=sandcastle:fastapi-rbac`, then `docker rm -f <name>`.
- **A worktree is left behind**: `git worktree list`, then `git worktree remove --force .sandcastle/worktrees/<name>`. An aborted run keeps its worktree on purpose, so check for uncommitted work first.
- **Redis is stopped or broken**: `docker rm -f sandcastle-fastapi-rbac-redis`. The next run recreates it.

## Gotchas

- **The format gate is `npm run format:check`, not `npm run format -- --check`.** The `format` script is `prettier --write .`, so the second form rewrites files first and can never fail. CI uses `format:check` too.
- **Sandcastle keeps a worktree that has uncommitted changes** when a sandbox closes. `smoke.ts` and `gate.ts` remove their own worktrees afterwards. `main.ts` leaves the agent's worktree, so you can look at anything the agent did not commit.

- **Redis needs `--user redis`.** Its entrypoint drops root with `setpriv`, which fails once all capabilities are dropped. `config.ts` starts it as the `redis` user for that reason.
- **Claude Code reports that the graphify MCP server failed to connect.** `.mcp.json` declares it, but the image does not include it. This is harmless.
- **Multi-line prompts break the Cursor CLI on Windows** ([sandcastle#1291](https://github.com/mattpocock/sandcastle/issues/1291)). `main.ts` avoids this by keeping the prompt to one line and putting the issue in `/home/agent/TASK.md`.
- **The image is about 2.3 GB.** Check disk space before rebuilding.
- **Sandcastle is pre-1.0.** Read its release notes before raising the pin in `.sandcastle/package.json`, and run `npm run smoke` and `npm test` after.
