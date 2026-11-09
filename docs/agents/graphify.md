# Knowledge Graph (graphify)

[graphify](https://github.com/safishamsi/graphify) (PyPI package `graphifyy`) builds an AST-based graph of this repository's code and serves it to agents over MCP. It is an **opt-in, per-developer supplement** to grep and reading code, not a replacement for either.

Nothing about it is committed except configuration. Each developer who opts in builds the graph once, and git hooks keep it current after commits and pulls. There is no CI job.

Runtime auth and RBAC behavior are unaffected.

## What it is good for

- **`get_neighbors <symbol>`**: direct callers, callees and importers of a function or class, each with `file:line`. It lists one edge per calling function, not one per call site, so use grep when you need every call line.
- **`god_nodes`**: the most-connected nodes. A good first look at an unfamiliar area.
- **`query_graph "<question>"`**: broad "what relates to X" context.
- **`shortest_path A B`**: how two symbols connect through calls and imports.
- **`graphify-out/GRAPH_REPORT.md`**: a community map of the codebase. Communities are unnamed (`Community N`) because the build makes no LLM call.

## What it must not be used for

These fail **silently**: the graph returns a plausible but incomplete or wrong answer with no warning.

| Question | Why the graph gets it wrong | Use instead |
| --- | --- | --- |
| Which endpoints use a dependency, or require permission X | Calls inside `Depends(...)` defaults are not edges. `get_neighbors get_current_user` shows tests and `deps.py` but none of the ~40 `Depends(deps.get_current_user(...))` route guards | `grep -rn "Depends(deps.get_current_user" backend/app` |
| Anything across the HTTP boundary (React client to FastAPI route) | The graph is AST-only; there is no edge from an `axios` call to the route handling it | Grep the URL path in both `react-frontend/src` and `backend/app/api` |
| A symbol whose name exists in more than one file (`create`, `get`, `upgrade`) | It cannot tell same-named symbols apart and may answer for a different one | Grep, then read the file |
| Database schema or migrations | `backend/alembic/versions/` and `*.sql` are excluded on purpose (see `.graphifyignore`) | `backend/app/models/` |
| Code changed since the last refresh | The graph only knows what the last refresh saw | Read the file |

Always confirm a graph answer against the actual file before relying on it.

## Setup (once per machine)

Requires [uv](https://docs.astral.sh/uv/). Install the pinned version **with the `mcp` extra**:

```bash
uv tool install "graphifyy[mcp]==0.9.43"
```

The `mcp` extra provides `graphify-mcp`. Without it, the MCP server fails to start (`ModuleNotFoundError: No module named 'mcp'`, or `MCP error -32000: Connection closed` in Claude Code) while the CLI and the refresh hooks keep working, so nothing else looks broken. Because the extra is recorded in uv's receipt, `uv tool upgrade graphifyy` keeps it. Reinstalling plain `graphifyy` drops it.

After any install or upgrade, resync the user-level `/graphify` skill, which is pinned to the version that wrote it:

```bash
graphify install --platform claude
```

If the install fails with `Access is denied` on Windows, a running `graphify-mcp` (from an open agent session in any repo) is locking the files. Close that session, or stop the `graphify-mcp` process, and install again.

## Opt in for this repository

1. Build the graph (about two minutes, no LLM, no network):

   ```bash
   bash scripts/development/graphify/build-graph.sh
   ```

   ```powershell
   .\scripts\development\graphify\Build-Graph.ps1
   ```

2. Install the git hooks. `.pre-commit-config.yaml` sets `default_install_hook_types`, so this one command installs the pre-commit, post-commit, post-merge and post-rewrite hooks. Run it again even if you installed pre-commit before, since older installs only set up the pre-commit hook:

   ```bash
   pre-commit install
   ```

3. Restart your agent session so it picks up the `graphify` MCP server, and approve the project server if prompted. In Claude Code, `claude mcp list` should report `graphify: … ✔ Connected`.

To check the server by hand: `graphify god-nodes` (CLI) should list hubs such as `User`, `cn()` and `TokenType`.

## How the graph stays current

Three pre-commit hooks at the `post-commit`, `post-merge` and `post-rewrite` stages call `scripts/development/graphify/graphify-refresh.sh`:

| Hook | Fires on | Changed files |
| --- | --- | --- |
| `graphify-refresh-commit` | `git commit`, including a merge commit you make after resolving a conflict | `git diff HEAD^1 HEAD` |
| `graphify-refresh-merge` | `git merge`, and so a merging `git pull` | `git diff ORIG_HEAD HEAD` |
| `graphify-refresh-rewrite` | the end of a rebase, and so `git pull --rebase` | `git diff ORIG_HEAD HEAD` |

`post-merge` is needed because `git merge` never fires `post-commit`: not for a fast-forward, where no commit is created, and not for the merge commit it writes itself. `post-rewrite` is needed because a rebase fires neither: the `post-commit` calls for each replayed commit hit the rebase guard below, and only `post-rewrite` runs once the rebase finishes. The rewrite hook ignores `git commit --amend`, which `post-commit` already covers.

When a changed file is Python under `backend/` or TS/JS under `react-frontend/src/`, the script queues those files in `graphify-out/.hook-refresh.pending` and starts a background worker, and the git command returns immediately. The worker re-parses only the queued files and makes no LLM call; a typical refresh takes under a minute. Output is appended to `~/.cache/graphify-rebuild-<repo folder>.log`.

Two implementation details are deliberate:

- **Incremental by changed files.** `graphify update .` re-parses every file on each run (over five minutes here with one worker). The worker instead calls `graphify.watch._rebuild_code(changed_paths=...)`, the entry point graphify's own git hooks use. It is a private API, which is one reason the version is pinned. If graphify's Python cannot be located, the worker falls back to `graphify update .`.
- **Its own lock.** graphify's rebuild lock uses `fcntl` and does nothing on Windows, so two quick commits would rebuild concurrently and race on `graphify-out/`. The worker takes a `mkdir` lock instead (`graphify-out/.hook-refresh.lock`). A hook that finds it held leaves its files in the queue for the running worker, which drains the queue until it is empty. A lock older than 30 minutes is treated as left behind by a killed refresh and removed.

The script does nothing, and never fails the git command, when:

| Condition | Why |
| --- | --- |
| `GRAPHIFY_SKIP_HOOK=1` is set | Explicit opt-out for one command |
| `graphify` is not on `PATH` or in `~/.local/bin` | You have not installed graphify |
| `graphify-out/graph.json` does not exist | You have not opted in with a first build |
| You are in a linked git worktree | `graphify-out/` belongs to the primary checkout; a worktree would write a partial graph and race it |
| A rebase is replaying commits | The `post-rewrite` call at the end of the rebase refreshes everything in one batch |
| No backend or frontend source file changed | Docs and config changes do not affect the code graph |

`PYTHONHASHSEED=0` is set in the hook and in the build scripts. graphify's community clustering iterates sets whose order is otherwise randomised per process, so without it a refresh with no code changes still reshuffles communities.

### What the hooks do not cover

- **Branch switches.** `git checkout` fires none of the refresh hooks, so after switching branches the graph describes whichever branch was last refreshed. Rerun the build script if it matters.
- **A fast-forward `git rebase`.** When you have no local commits, `git rebase origin/main` fast-forwards, and git fires only `post-checkout`, which these hooks don't use. `git pull --rebase` is not affected: in that case git fast-forwards through a merge, which fires `post-merge`. After a fast-forward `git rebase`, rerun the build script, or use `git pull --rebase` or `git merge --ff-only` instead.
- **Changes to `.graphifyignore`.** `update` keeps nodes from files that left the scan. Rebuild with the build script.
- **Linked worktrees** (including `.claude/worktrees/`). There is no `graphify-out/` there, so the MCP server answers `graph.json not found`. Pass `project_path` with the primary checkout's absolute path on the tool call; the answer then describes the primary checkout's branch, not the worktree's.

## Harness registration

The MCP server is plain stdio, so the same command is registered for each harness. The config formats are not interchangeable.

| Harness | Config | Top-level key |
| --- | --- | --- |
| Claude Code | `.mcp.json` | `mcpServers` |
| Copilot / VS Code | `.vscode/mcp.json` | `servers` |
| Cursor | `.cursor/mcp.json` | `mcpServers` |

`.claude/settings.json` pre-approves the read-only graph tools. `list_prs`, `get_pr_impact` and `triage_prs` are deliberately not pre-approved: they rank a changed file by the size of its own community, not by what depends on it, which inverts the risk of hub files such as `backend/app/api/deps.py`.

Without graphify installed, an agent simply has no graphify tools and falls back to grep. That is the expected path, not an error.

## Version pin

`0.9.43` is pinned here and in the install commands in the build scripts. graphify is pre-1.0 and its on-disk graph format is not guaranteed stable across versions, so to bump it: change the pin everywhere it appears, reinstall, rerun `graphify install --platform claude`, and rebuild the graph.

## Optional: named communities

The build leaves communities as `Community N` to stay free of LLM calls. To name them once, through your local Claude CLI:

```bash
graphify label . --backend claude-cli
```

Pass `--backend` explicitly. Without it graphify uses whichever API key it finds in the environment, which can send source to an external endpoint.

## Non-goals

- A CI job, or any committed graph output
- Graph freshness as a merge requirement
- Docs, images or other non-code content in the graph

## References

- Upstream: <https://github.com/safishamsi/graphify>
- Issue: [#28](https://github.com/mnaimfaizy/fastapi_rbac/issues/28)
- Previous CI-based design (retired): [`docs/research/graphify-automation.md`](../research/graphify-automation.md)
