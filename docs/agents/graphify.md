# Knowledge Graph (graphify)

[graphify](https://github.com/safishamsi/graphify) (PyPI package `graphifyy`) builds a persistent knowledge graph of this repository so agents and humans can answer architecture questions without re-exploring the tree every session.

This guide is **project-level** adoption. Runtime auth/RBAC behavior is unchanged.

## What it is for

Use the graph when asking:

- How auth/token lifecycle connects (JWT + Redis)
- How RBAC domain entities relate (`user` → `role` → `permission`, role/permission groups)
- Where API deps → CRUD → models seams sit
- How the React auth layer talks to `/api/v1` auth endpoints

Prefer **raw code search** when you need exact line edits, new files that are not in the graph yet, or string literals / config values.

## Install

Requires Python 3.10+.

### Windows (PowerShell)

```powershell
# Preferred
uv tool install graphifyy

# Or
pip install graphifyy
# If `graphify` is not on PATH, add your Python Scripts folder, e.g.:
#   %APPDATA%\Python\Python313\Scripts
# Or use: pipx install graphifyy
```

### Unix (macOS / Linux)

```bash
uv tool install graphifyy
# or: pipx install graphifyy
# or: pip install graphifyy
```

Verify:

```bash
graphify --help
```

Optional: sync the local skill copy after upgrades:

```bash
graphify install
```

## Git policy for `graphify-out/`

**Decision (v1): partial commit.**

| Artifact | Git | Reason |
| --- | --- | --- |
| `GRAPH_REPORT.md` | **Committed** | Stable human/agent summary (god nodes, surprises, suggested questions) |
| `graphify-out/README.md` | **Committed** | Points maintainers at this guide |
| `graph.json`, `graph.html`, `manifest.json`, `cache/`, `.graphify_*` | **Gitignored** | Large / high-churn; rebuild locally |

After clone, generate queryable artifacts with the build commands below before using `graphify query` / `path` / `explain`.

Sensitive paths (`.env`, credentials, etc.) are skipped by graphify detect; if detect reports `skipped_sensitive`, that is expected.

## Build / update

Default v1 scope: **code AST only** (`--code-only`). No API key required. Docs/images need a semantic LLM pass (`graphify extract` without `--code-only` plus a configured backend) — optional follow-up.

### Windows (PowerShell)

```powershell
# From repo root — initial or full rebuild (AST, no LLM)
graphify extract . --code-only --out .

# Name communities + refresh report (no LLM labels)
graphify cluster-only . --no-label

# After code changes (incremental AST, no LLM)
graphify update .
```

Or use the helper:

```powershell
.\scripts\development\graphify\Update-Graphify.ps1
.\scripts\development\graphify\Update-Graphify.ps1 -Full
```

### Unix

```bash
graphify extract . --code-only --out .
graphify cluster-only . --no-label
graphify update .
```

Or:

```bash
./scripts/development/graphify/update-graphify.sh
./scripts/development/graphify/update-graphify.sh --full
```

Corpus note: a full-repo detect is typically **>500 files**. Prefer `--code-only` for the free AST path, or scope to `backend/app`, `react-frontend/src`, and `docs` if you need a smaller semantic extract.

## Query / path / explain

Requires local `graphify-out/graph.json` (gitignored — build first).

```bash
graphify query "How does login connect to Redis token storage?"
graphify query "Where are permission checks enforced before CRUD?" --dfs --budget 1500
graphify path "login()" "add_token_to_redis()"
graphify explain "User"
```

Open `graphify-out/graph.html` in a browser for interactive exploration (local only).

## When agents should use the graph

If `graphify-out/graph.json` exists, **query it first** for architecture / relationship / “how does X connect to Y” questions. Fall back to README, `docs/agents/domain.md`, and code search when the graph is missing, stale, or insufficient.

Domain vocabulary to keep consistent: `user`, `role`, `permission`, `role group`, `permission group` — see [`domain.md`](./domain.md).

## Community labels (optional)

Default rebuilds use `--no-label` (placeholder `Community N` names, zero LLM cost). To rename communities with an LLM backend:

```bash
graphify label . --backend gemini   # requires GEMINI_API_KEY / GOOGLE_API_KEY (or another supported backend)
```

### Maintainer notes from the initial code-only build

God-node / surprise highlights worth keeping in mind:

- Domain hubs: `User`, `Role`, `Permission` rank among highest-degree nodes (alongside utilities like `UUID` / test helpers).
- Auth → Redis: `login()` has an inferred `calls` edge to `add_token_to_redis()` (`auth.py` → `token.py`).
- Frontend import cycles through `api.ts` ↔ Redux slices ↔ `*.service.ts` are real structural loops; treat them as navigation signals, not necessarily bugs.
- Community 0 hubs include frontend auth UI (`LoginForm`, `ProtectedRoute`, `InitAuth`); permission/role model communities cluster around the RBAC models package.

Re-read `graphify-out/GRAPH_REPORT.md` after each full rebuild — numbers and community IDs drift.

## Automation (committed report)

CI keeps the **committed** summary fresh without pushing to protected `main` and without opening one bot PR per feature PR.

| Trigger | Workflow |
| --- | --- |
| Weekly (Monday 06:00 UTC) | [`.github/workflows/graphify-report.yml`](../../.github/workflows/graphify-report.yml) |
| Manual | Actions → **Refresh graphify report** → **Run workflow** |

Behavior:

1. Full-repo `extract --code-only` + `cluster-only --no-label` (no API key).
2. If `graphify-out/GRAPH_REPORT.md` changed, push fixed branch `chore/graphify-report`.
3. Create **or update** a single maintenance PR into `main` (never stacks multiple graphify PRs).
4. A human reviews and merges; the bot does **not** push to `main`.

This job is **not** a required status check and must not block feature PRs.

Design notes: [`docs/research/graphify-automation.md`](../research/graphify-automation.md).

### Optional local hooks

For a live local `graph.json` while developing (gitignored; not published by CI):

```bash
graphify hook install    # post-commit + post-checkout, AST only
# GRAPHIFY_SKIP_HOOK=1   # opt out for one command
graphify hook uninstall
```

Prefer the update scripts above if you do not want git hooks.

## Non-goals

- Replacing MkDocs / human docs
- CI that **blocks** merges on graph freshness
- Committing heavy `graphify-out/` artifacts (`graph.json`, `graph.html`, cache)
- One automated graphify PR per feature PR

## References

- Upstream: <https://github.com/safishamsi/graphify>
- Package: `graphifyy` on PyPI (CLI remains `graphify`)
- Issue: [#28](https://github.com/mnaimfaizy/fastapi_rbac/issues/28)
- Automation research: [`docs/research/graphify-automation.md`](../research/graphify-automation.md)
