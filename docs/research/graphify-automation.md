# Research: Automating graphify output refresh

**Date:** 2026-07-23
**Question:** How should this repo regenerate graphify knowledge-graph output when PRs are opened/merged or when relevant code changes — GitHub Actions, git hooks, pre-commit, or something else?

## Verdict

**Recommended: hybrid, with a batched maintenance PR (not push-to-main, not one bot PR per feature PR).**

Decisions locked in (2026-07-23):

- **Do not** push to protected `main`.
- **Do not** open a fresh graphify bot PR for every feature PR (overkill / noise).
- **Full-repo** `extract --code-only` + `cluster-only --no-label` is fine for CI.
- **Cadence:** weekly cron **and** manual `workflow_dispatch`.

1. **Canonical committed artifact** (`graphify-out/GRAPH_REPORT.md`): regenerate in CI on a **schedule and/or `workflow_dispatch`**, then upsert **one** long-lived branch/PR (e.g. `chore/graphify-report`). If that PR already exists, update it; never stack N report PRs.
2. **Local queryable graph** (`graph.json`, gitignored): optional `graphify hook install` or existing update scripts — **not** a blocking pre-commit hook.
3. **Do not** make graph freshness a required PR check.

---

## Findings (with sources)

### Current project policy

| Artifact | Git | Source |
| --- | --- | --- |
| `GRAPH_REPORT.md`, `graphify-out/README.md` | Committed | `.gitignore`, `docs/agents/graphify.md`, `graphify-out/README.md` |
| `graph.json`, `graph.html`, `cache/`, etc. | Gitignored | same |

Build defaults already documented:

- Full: `graphify extract . --code-only --out .` then `graphify cluster-only . --no-label`
- Incremental: `graphify update .`
- Helpers: `scripts/development/graphify/update-graphify.sh`, `Update-Graphify.ps1`

Explicit v1 **non-goals** in [`docs/agents/graphify.md`](../agents/graphify.md):

- CI that **blocks** on graph freshness
- Auto post-commit hooks (noted as “optional later via `graphify hook install`”)

Issue [#28](https://github.com/mnaimfaizy/fastapi_rbac/issues/28) closed the initial integration and listed these as **out-of-scope follow-ups**:

- “CI job to refresh graph on main”
- “Auto post-commit `--update` hook”

So this research is exactly those follow-ups.

### Upstream graphify: what hooks actually do

Upstream CLI ([README](https://github.com/safishamsi/graphify/blob/HEAD/README.md), [`hooks.py` on v8](https://github.com/safishamsi/graphify/blob/v8/graphify/hooks.py)):

| Command | Behavior |
| --- | --- |
| `graphify hook install` | Installs **post-commit** + **post-checkout** hooks (not pre-commit) |
| post-commit | After a successful commit, **detached background** AST rebuild via `_rebuild_code` (no LLM) |
| post-checkout | On branch switch, full local rebuild if `graphify-out/` exists |
| `GRAPHIFY_SKIP_HOOK=1` | Opt out for one run ([#1018](https://github.com/safishamsi/graphify/issues/1018)) |
| Skip when only `graphify-out/` changed | Avoids dirty-tree loops when outputs are tracked |
| Skip during rebase/merge/cherry-pick | Avoids blocking `--continue` |

Important mismatches with **this** repo’s policy:

- Upstream’s “team workflow” expects committing **most of** `graphify-out/` (including `graph.json`) and using a merge driver for conflict-free `graph.json` ([README team workflow](https://github.com/safishamsi/graphify/blob/HEAD/README.md)).
- This repo intentionally **does not** commit `graph.json`. Local hooks still help developers keep a local queryable graph fresh, but they **do not** publish `GRAPH_REPORT.md` to shared history unless someone commits it.
- Hooks **do not** auto-commit. They leave the working tree dirty (or only refresh gitignored files).

Also available locally: `graphify watch` / `--watch` for folder watching (dev machine only; not CI).

### Upstream graphify: official CI pattern

Upstream’s own workflow [`.github/workflows/release-graph.yml`](https://github.com/safishamsi/graphify/blob/HEAD/.github/workflows/release-graph.yml):

- Triggers: `release` published + `workflow_dispatch` (not every PR)
- Installs via `uv`, runs AST `extract` + `cluster-only --no-label`
- Uploads a tarball as a **release asset / workflow artifact**
- Does **not** commit back into the default branch

That is a strong signal: upstream treats CI as **artifact generation**, not as a merge gate.

### This repo’s existing automation

Workflows under `.github/workflows/` (from GitHub API / raw files):

| Workflow | Trigger pattern |
| --- | --- |
| `backend-ci.yml` | `push`/`pull_request` to `main`, paths `backend/**` |
| `react-frontend-ci.yml` | path-filtered frontend CI |
| `docs.yml` | `push` to `main`, paths `docs/**`, `mkdocs.yml`; `contents: write` for deploy |
| `docker-publish.yml` | publish flow |

Shared conventions we should mirror:

- Path filters (cheap, scoped runs)
- `actions/checkout@v7` + `actions/setup-python@v7`
- Pip-based installs today (uv is fine to add for graphifyy only)

`.pre-commit-config.yaml` already has trailing-whitespace, black, isort, flake8, mypy — all **blocking**, scoped mostly to `backend/`. No graphify hook.

Helpers already exist for local/CI reuse: `scripts/development/graphify/update-graphify.sh` (`--full` for extract + cluster).

---

## Options compared

| Option | What it refreshes | Pros | Cons | Fit for this repo |
| --- | --- | --- | --- | --- |
| **A. GHA on every PR** (path-filtered), commit report onto PR branch | Committed `GRAPH_REPORT.md` | Report stays current before merge | Fork PRs can’t push; `GITHUB_TOKEN` push may skip re-running required checks; report churn / merge conflicts on busy PRs | Weak as default |
| **B. GHA on merge / push to `main`** | Committed `GRAPH_REPORT.md` | Matches #28 follow-up; one canonical report; no PR friction; path filters keep cost down | Report lags until merge; needs `contents: write` + branch protection bypass or bot token if main is locked | **Strong** |
| **C. `graphify hook install` (local)** | Local `graphify-out/` (mostly gitignored) | Official, AST-only, non-blocking (detached), Windows-aware | Per-machine opt-in; does not update shared git history; Windows PATH/pin quirks (re-run install after upgrades) | **Good optional** |
| **D. pre-commit framework hook** | Would try to refresh before commit | Familiar if already using pre-commit | Blocks commits; full-repo AST can be slow (>500 files noted in docs); fights “don’t block on freshness” | **Poor** |
| **E. Hybrid (B + optional C)** | Shared report via CI; local `graph.json` via hooks/scripts | Aligns policy + upstream tools | Two mechanisms to document | **Best** |
| **F. `graphify watch` only** | Local only | Great while coding | Never updates committed report | Local QoL only |
| **G. Upstream-style release artifact** | Upload `graph.json` as artifact, don’t commit | Matches upstream CI; no report merge noise | Agents on clone still lack `graph.json` unless they download/build; we already commit the human summary | Optional later |

---

## Recommendation

### Primary: batched maintenance PR (not push-to-main)

**Why not “PR per merge”:** opening a graphify bot PR after every feature merge would spam the queue. **Why not push to `main`:** branch protection — bot must not write protected `main`.

**Pattern:** keep at most **one** open PR on a fixed branch (e.g. `chore/graphify-report`).

| Trigger | Behavior |
| --- | --- |
| `workflow_dispatch` (manual) | Full-repo extract → if `GRAPH_REPORT.md` changed, push branch + create-or-update the single PR |
| `schedule` (e.g. weekly) | Same as above — absorbs many merges into one report refresh |
| Optional later: `push` to `main` | Still only **updates the same branch/PR** (no new PR each time); usually unnecessary if weekly + manual is enough |

Create something like `.github/workflows/graphify-report.yml`:

```yaml
name: Refresh graphify report

on:
  schedule:
    - cron: "0 6 * * 1"   # weekly Monday 06:00 UTC — tune as needed
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  refresh-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: main

      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"

      - name: Install graphify
        run: pip install graphifyy

      - name: Full-repo code-only rebuild
        run: ./scripts/development/graphify/update-graphify.sh --full
        env:
          PYTHONHASHSEED: "0"  # deterministic communities (upstream hook does this)

      - name: Create or update single maintenance PR
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          BRANCH: chore/graphify-report
        run: |
          if git diff --quiet -- graphify-out/GRAPH_REPORT.md; then
            echo "GRAPH_REPORT.md unchanged; nothing to PR"
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -B "$BRANCH"
          git add graphify-out/GRAPH_REPORT.md
          git commit -m "📝 docs(graphify-out): refresh GRAPH_REPORT.md"
          git push -u origin "$BRANCH" --force-with-lease
          if gh pr view "$BRANCH" --json number --jq .number >/dev/null 2>&1; then
            echo "Updated existing PR for $BRANCH"
          else
            gh pr create --base main --head "$BRANCH" \
              --title "📝 docs(graphify-out): refresh GRAPH_REPORT.md" \
              --body "Automated full-repo code-only graphify rebuild. Review and merge when convenient. Does not change runtime behavior."
          fi
```

Design rules:

- **Never** push commits onto protected `main`.
- **Never** open more than one graphify maintenance PR (fixed branch + create-or-update).
- **Never** fail other CI / never add as a required status check.
- **Never** commit gitignored heavy artifacts (`graph.json`, `graph.html`).
- Full-repo extract is intentional; no LLM / no API keys (`--code-only`, `--no-label`).
- Bot commit/PR title must follow repo Angular+emoji style from [`.github/prompts/commit.prompt.md`](../../.github/prompts/commit.prompt.md) (e.g. `📝 docs(graphify-out): …`).
- Human reviews and merges the maintenance PR like any other chore.

### Secondary: optional local hooks (option C)

Document for contributors who want live `graphify query`:

```bash
uv tool install graphifyy
graphify hook install   # post-commit + post-checkout
# opt out: GRAPHIFY_SKIP_HOOK=1
```

Or keep using the existing scripts without hooks. Do **not** wire this into `.pre-commit-config.yaml` as a required hook.

### Explicitly defer / avoid

| Idea | Why not (now) |
| --- | --- |
| Required PR check “graph up to date” | Contradicts documented non-goal; slows merges |
| pre-commit graphify hook | Wrong lifecycle (blocking); expensive |
| Commit `graph.json` in CI | Policy change; large diffs; merge pain (upstream merge driver only helps if tracked) |
| Rebuild on every PR open/sync by default | Noise + fork/permission issues; use `workflow_dispatch` or a later “comment graph impact” job if needed |

### Suggested path filters

Trigger rebuild when structure agents care about changes:

- `backend/app/**` (or whole `backend/**`)
- `react-frontend/src/**` (or whole `react-frontend/**`)
- Optionally `docs/reference/architecture.md`, `docs/agents/**` — only if you later drop `--code-only` or run a second docs pass (needs LLM keys; out of scope for v1 automation)

### Permissions / secrets

- `permissions.contents: write` — push the maintenance branch only
- `permissions.pull-requests: write` — create/update the single PR
- Default `GITHUB_TOKEN` is enough (no push to protected `main`)
- No graphify API keys for code-only path

### Risks

| Risk | Mitigation |
| --- | --- |
| PR spam (one bot PR per feature PR) | Fixed branch + create-or-update; prefer schedule/manual over per-merge |
| Protected `main` | Never push to `main`; humans merge the maintenance PR |
| Stale report between weekly runs | Acceptable; `workflow_dispatch` for on-demand; local rebuild always available |
| `GRAPH_REPORT.md` conflicts when merging maintenance PR | Rebase/update branch from latest `main` before recreate; keep report machine-generated |
| Long CI runtime on full extract | Accepted for now; pin `PYTHONHASHSEED`; revisit scope only if wall time hurts |
| Local hooks leave dirty tree if someone tracks more artifacts | Keep heavy outputs gitignored (current policy) |

---

## Implementation status

Implemented in-repo:

1. [`.github/workflows/graphify-report.yml`](../../.github/workflows/graphify-report.yml) — weekly + `workflow_dispatch`, single maintenance PR on `chore/graphify-report`
2. [`docs/agents/graphify.md`](../agents/graphify.md) — automation section + optional local hooks

After merge to `main`, smoke-test once via Actions → **Refresh graphify report** → **Run workflow**.

---

## Open questions (remaining)

1. **Docs in graph:** Stay code-only forever in CI, or later add a keyed semantic docs pass?
2. **Policy change?** Would we ever commit `graph.json` (upstream team model) for zero-setup agent clones? Separate decision.
3. **PR preview:** Later non-committing “graph impact” comment on feature PRs? Optional, unrelated to report commits.

---

## References

- Project guide: [`docs/agents/graphify.md`](../agents/graphify.md)
- Git ignore policy: [`.gitignore`](../../.gitignore)
- Helper scripts: [`scripts/development/graphify/`](../../scripts/development/graphify/)
- Origin issue: [#28](https://github.com/mnaimfaizy/fastapi_rbac/issues/28)
- Upstream README / hooks / release workflow:
  - <https://github.com/safishamsi/graphify>
  - <https://github.com/safishamsi/graphify/blob/v8/graphify/hooks.py>
  - <https://github.com/safishamsi/graphify/blob/HEAD/.github/workflows/release-graph.yml>
  - <https://github.com/safishamsi/graphify/issues/1018>
- Commit-back Action pattern: <https://github.com/stefanzweifel/git-auto-commit-action>
- Path filters: existing `backend-ci.yml` / docs patterns; <https://github.com/dorny/paths-filter>
