# Sandcastle runbook

[Sandcastle](https://github.com/mattpocock/sandcastle) (`@ai-hero/sandcastle`, pinned to `0.14.0`) runs coding agents on GitHub issues inside locked-down Docker containers, several issues at once if you like. For each issue, an implementer agent commits to a **local** branch, then a reviewer agent in a fresh container checks the work and may commit fixes. Nothing is pushed: you read the review and the diff, gate the branch, and push and open the PR yourself.

Everything lives in `.sandcastle/`. It is separate from the [Agent-kit pipeline](agent-kit.md), which runs Claude in GitHub Actions on issue labels. Use Agent-kit for work you want done in the cloud from a label. Use Sandcastle for local runs, with Claude Code, Cursor or GitHub Copilot, billed to your own plans.

## Rules

- No agent gets a GitHub credential that can touch repositories. The host fetches the issue with `gh`, and only issues written by a trusted author (`TRUSTED_AUTHORS` in `issues.ts`) become prompts.
- The implementer, the reviewer and the gates each run in their own fresh container. Each container holds only its own agent's credential, and parallel issues each get their own Redis.
- The reviewer is a second pair of eyes, not a replacement for yours. It can commit fixes; you still read the whole branch.
- Commits go to a named local branch through Sandcastle's `branch` strategy, never into your checked-out branch.
- Nothing in `.sandcastle/` pushes. You push after reviewing the diff.
- Never run `gates.sh` in a host shell. It runs code the agent wrote. Gate a branch in a fresh sandbox (`npm run gate`) or in PR CI.
- Only the selected agent's one credential enters the sandbox.

## Files

| File | Purpose |
| --- | --- |
| `.sandcastle/main.ts` | Runs one or more issues, in parallel: `npm run build` |
| `.sandcastle/pipeline.ts` | One issue start to finish: implement, review, gate. Also the prompts and the summary |
| `.sandcastle/issues.ts` | Fetching issues on the host, the trusted-author check, branch names |
| `.sandcastle/gate.ts` | Gates a finished local branch in a fresh sandbox: `npm run gate` |
| `.sandcastle/smoke.ts` | Checks the sandbox's isolation, with no agent: `npm run smoke` |
| `.sandcastle/e2e.ts` | Runs two fixture issues in parallel through the real pipeline with fake agents, no API keys: `npm run e2e` |
| `.sandcastle/agents.ts` | Agent choice, models and credential rules |
| `.sandcastle/config.ts` | Container hardening, per-run network and Redis, the gate runner, branch-name check |
| `.sandcastle/*.test.ts` | Unit tests for credentials, branch names, verdicts and the parallel pool: `npm test` |
| `.sandcastle/gates.sh` | The fast gates. Keep in step with `verify_commands` in `.github/workflows/agent-kit-pipeline.yml` |
| `.sandcastle/Dockerfile` | The `sandcastle:fastapi-rbac` image |
| `.sandcastle/secrets.env.example` | Template for credentials, settings and the 1Password Environment ID |

## What the sandbox enforces

`npm run smoke` checks each of these:

- The agent runs as a non-root user, with every Linux capability dropped (`--cap-drop ALL`) and at most 2 CPUs.
- No `GH_TOKEN` or `GITHUB_TOKEN`, and no host `gh` or Cursor login, inside the container.
- The repository's `.git` config and hooks are read-only.
- The agent works in its own git worktree under `.sandcastle/worktrees/`, on its own branch.
- Redis for the unit tests runs on a private Docker network, a new one per run (`sandcastle-fastapi-rbac-<run>`), removed afterwards.
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

Credentials come from these, highest first. Whichever holds a key, only the selected agent's one key goes into its sandbox, and no value is printed.

1. **A 1Password Environment** (recommended), when `OP_ENVIRONMENT_ID` is set.
2. **Your shell**, including `op run --env-file .sandcastle/op.env -- …` with `op://` references in the gitignored `op.env`.
3. **`.sandcastle/secrets.env`**, gitignored and read only by the host scripts. Copy it from `secrets.env.example`.

#### 1Password Environment

The host script reads the Environment itself, in memory, with `op environment secret list <ID> --reveal --format=dotenv`. Nothing is written to disk, and the values never pass through the shell. This is also how myorganiser keeps its keys, but myorganiser wraps the run in `op run --environment`. That doesn't work from WSL: the Linux `op` there can't use the desktop app, and the Windows `op.exe` would start the wrapped command on Windows, not in WSL.

1. **CLI 2.42.0 or later on Windows.** `op environment secret list` arrived in 2.42.0, and the older `op environment read` is deprecated from 2026-11-17 and removed on 2027-01-20.

   ```bash
   winget upgrade AgileBits.1Password.CLI
   ```

2. **Desktop app integration.** In the 1Password app: unlock it, turn on Windows Hello, then **Settings → Developer → Integrate with 1Password CLI**. On a business account, an owner or admin must also turn on the Environments policy (**Policies → Sharing and permissions → Developer permissions → Environments**).
3. **Create the Environment.** **Developer → View Environments → New environment**, name it (for example `fastapi_rbac sandcastle`), then add the keys you use: `CURSOR_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, `COPILOT_GITHUB_TOKEN`. `SANDCASTLE_*` settings can go there too.
4. **Copy its ID.** **View environment → Manage environment → Copy environment ID**. The ID is not a secret. Put `OP_ENVIRONMENT_ID=<id>` in `.sandcastle/secrets.env`, or export it in your WSL shell.
5. **Check it** without starting anything. The 1Password app asks you to approve the read:

   ```bash
   npm run build -- --issue 336 --dry-run
   ```

   The first line names the source, for example `credentials from: 1Password Environment <id> via op.exe > shell`, and each agent line names the key it will use.

Under WSL the script calls the Windows `op.exe`, which WSL finds on its `PATH`. With `OP_SERVICE_ACCOUNT_TOKEN` set (a service account scoped to this Environment), it calls the Linux `op` instead. `OP_CLI` overrides both. The Environment wins over the shell, the same order `op run` uses.

| Agent | Credential | Notes |
| --- | --- | --- |
| `claude` | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` | Exactly one is sent. The OAuth token (`claude setup-token`, Pro/Max plan) wins when both are set. `SANDCASTLE_CLAUDE_AUTH=subscription` or `api` forces one |
| `cursor` | `CURSOR_API_KEY` | From the Cursor dashboard |
| `copilot` | `COPILOT_GITHUB_TOKEN` | Must be a fine-grained token (`github_pat_…`) with only the Copilot Requests permission and no repository access. Classic `ghp_` and `gh` login `gho_` tokens are refused |

A missing or refused credential stops the run before any worktree or container is created. When the reviewer is a different agent from the implementer, both credentials are needed, and each goes only into its own container.

### Check the sandbox

```bash
npm run smoke -- --skip-gates
```

Every line should say `PASS`. Without `--skip-gates` it also runs the full gates. The smoke branch `chore/sandcastle-smoke` is deleted afterwards.

To check the whole pipeline without API keys, run two fixture issues in parallel with fake agents (about 20 seconds; add `-- --gates` to gate both branches in parallel too):

```bash
npm run e2e
```

## Running agents

From `.sandcastle/`, preview first. A dry run fetches the issues, shows each branch name, and reports missing credentials without starting anything:

```bash
npm run build -- --issue 337 --issue 336 --agent cursor --review-agent claude --dry-run
```

Then run it for real by dropping `--dry-run`.

| Flag | Default | Meaning |
| --- | --- | --- |
| `--issue` | required, repeatable | GitHub issue number. Its author must be in `TRUSTED_AUTHORS` |
| `--concurrency` | `2` | How many issues run at once, 1 to 4. Each sandbox takes 2 CPUs |
| `--agent` | `SANDCASTLE_AGENT`, else `cursor` | Implementer: `claude`, `cursor` or `copilot` |
| `--model` | `SANDCASTLE_<AGENT>_MODEL`, else the default below | Implementer model |
| `--review-agent` | same as `--agent` | Reviewer. A different agent gives a more independent read |
| `--review-model` | the implementer's model if the same agent, else that agent's default | Reviewer model |
| `--skip-review` | off | No review step |
| `--branch` | from the issue | Only with a single `--issue`. Otherwise each branch is `<prefix>/<number>-<slug>` from the issue's labels and title, using the same label rule as Agent-kit (`bug` → `fix/`, `documentation` → `docs/`, `cleanup`/`maintenance`/`dependencies` → `chore/`, else `feat/`) |
| `--base` | `main` | Branch to start from when the branch does not exist yet. An existing branch is continued |
| `--gates` | off | Gate each branch in a fresh sandbox after the review |
| `--dry-run` | off | Show the plan, start nothing |

Default models: `claude-opus-5-5` (Claude), `composer-2.5` (Cursor), `claude-sonnet-5.5` (Copilot).

For each issue, in its own lane:

1. **Implement.** The implementer gets the issue as `/home/agent/TASK.md` and commits to the branch.
2. **Review.** Skipped if the implementer made no commits. In a fresh container, the reviewer gets `/home/agent/REVIEW.md`: the issue, the commit list and the diff against `--base` (cut at 150,000 characters). It checks correctness, tests, security (permission checks, tokens, injection, secrets in logs) and the repo's rules. It may commit fixes, and writes its review to a file whose first line is `Verdict: approve` or `Verdict: changes needed`. The host saves it to `.sandcastle/reviews/<branch>.md` (gitignored).
3. **Gates**, with `--gates`, in another fresh container.

Output lines are prefixed with the issue number. At the end a summary shows, per issue, the commits (implementer + reviewer), the verdict, the gates and a status, followed by the review and log paths. The run exits non-zero if any issue errored, made no commits, or failed its gates. A `changes needed` verdict does not fail the run; it is for you to read.

## After a run

1. Read the review: `.sandcastle/reviews/<branch>.md`.
2. Read the whole diff, including the reviewer's fix commits:

   ```bash
   git log --stat main..feat/279-some-slug
   ```

3. Gate it in a fresh sandbox, if the run did not:

   ```bash
   npm run gate -- --branch feat/279-some-slug
   ```

4. If it passes and the diff is what the issue asked for, push the branch and open the PR yourself. PR CI runs the full suites. Anything an agent wrote is untrusted until you have read it, reviewer fixes included.

## Recovering

- **A container is left running** after a crash or a hard kill: `docker ps --filter ancestor=sandcastle:fastapi-rbac`, then `docker rm -f <name>`.
- **A worktree is left behind**: `git worktree list`, then `git worktree remove --force .sandcastle/worktrees/<name>`. An aborted run keeps its worktree on purpose, so check for uncommitted work first.
- **A Redis container or network is left behind** after a hard kill: `docker ps -a --filter name=sandcastle-fastapi-rbac` and `docker network ls --filter name=sandcastle-fastapi-rbac`, then `docker rm -f` and `docker network rm` them. Each run makes its own and removes it when it ends.

## Gotchas

- **The format gate is `npm run format:check`, not `npm run format -- --check`.** The `format` script is `prettier --write .`, so the second form rewrites files first and can never fail. CI uses `format:check` too.
- **Sandcastle keeps a worktree that has uncommitted changes** when a sandbox closes. The smoke test and the gate runner remove worktrees they created, but never one that already existed. An agent's leftover worktree is kept so you can see what it did not commit, and the summary names it. The reviewer and the gates then run in that same worktree, uncommitted changes included, and the run says so.
- **Sandbox creation is serialised.** Parallel `git worktree add` calls can collide on git's lock files, so containers start one after another, then run side by side.
- **Redis needs `--user redis`.** Its entrypoint drops root with `setpriv`, which fails once all capabilities are dropped. `config.ts` starts it as the `redis` user for that reason.
- **Claude Code reports that the graphify MCP server failed to connect.** `.mcp.json` declares it, but the image does not include it. This is harmless.
- **Multi-line prompts break the Cursor CLI on Windows** ([sandcastle#1291](https://github.com/mattpocock/sandcastle/issues/1291)). The pipeline avoids this by keeping each prompt to one line and putting the issue in `/home/agent/TASK.md` (and the review brief in `/home/agent/REVIEW.md`).
- **The image is about 2.3 GB.** Check disk space before rebuilding.
- **Sandcastle is pre-1.0.** Read its release notes before raising the pin in `.sandcastle/package.json`, and run `npm test`, `npm run smoke` and `npm run e2e` after.
