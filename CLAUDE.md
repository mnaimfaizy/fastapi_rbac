# Claude Guidance

Engineering skills are installed at user level (`~/.agents/skills`, surfaced to Claude via `~/.claude/skills`) and are no longer vendored into this repository. Update them with `npx skills update -g`.

## Project-owned agent assets

Only these live in the repo; every other skill comes from the user-level install.

- `.claude/skills/release`: Release PR workflow (see Release below)
- `.claude/agents/release-notes.md`: release-notes sub-agent
- `docs/agents/`: repo-side configuration the installed skills read

### Kit-owned files (Agent-kit, pinned to a tag)

These files are copied from one pinned Agent-kit tag. They are an exception to "no vendoring". Never edit them by hand; re-copy them from a new tag instead. The full list, the pin and the upgrade steps are in [`docs/agents/agent-kit.md`](docs/agents/agent-kit.md).

- `.claude/skills/{code-review,security-audit,security-finding-triage,security-response,explainer,instruction-drift-audit,qa-plan,manual-qa}` (in this repo, the kit's `code-review` replaces the user-level one)
- `.github/{agent-runtime,agent-pipeline,security-audit}`

## Agent skills

### Issue tracker

Use GitHub Issues in `mnaimfaizy/fastapi_rbac` as the primary tracker and include external PR triage. See `docs/agents/issue-tracker.md`.

### Domain docs

Read and maintain shared terminology and ADR guidance from `docs/agents/domain.md`.

### Architecture (canonical)

System architecture and auth-flow narrative: `docs/reference/architecture.md`. Harness files should link there rather than duplicating architecture manuals.

### Knowledge graph (graphify)

Optional and per-developer. When the `graphify` MCP server is connected, use `get_neighbors` for "what directly calls or imports X" and `god_nodes` for orientation, then confirm against the file. Never use it for FastAPI `Depends(...)` wiring, client-to-route links, or same-named symbols: it fails silently there. Setup, refresh hooks and the full do/don't table: `docs/agents/graphify.md`.

### Commit messages (mandatory)

Commit messages must follow [`docs/agents/commit-messages.md`](docs/agents/commit-messages.md). This is not optional: plain conventional commits, no emoji, component/domain scopes.

### Branch names (mandatory)

Branch names must follow [`docs/agents/branch-names.md`](docs/agents/branch-names.md). This is not optional: allowed prefixes only; include the issue number and a short slug when the work is for a numbered issue; no harness or vendor prefixes.

### Release

User-invoked skill: `.claude/skills/release`. Opens a Release PR (notes via release-notes sub-agent). Canonical notes behavior: [`docs/agents/release-notes-agent.md`](docs/agents/release-notes-agent.md).

### Agent-kit

The CI security audit and the plan → implement → review pipeline run through Agent-kit. The integration's single source of truth is [`docs/agents/agent-kit.md`](docs/agents/agent-kit.md). In this repo, the kit's "Allowlist" is always called the **actor allowlist**, because **Allowlist** means the Redis token allowlist.

## Project conventions

When working in this repository, follow conventions in:

- `.github/copilot-instructions.md`
- `docs/agents/commit-messages.md` (commit message SSOT)
- `docs/agents/branch-names.md` (branch name SSOT)
- `.github/instructions/pre-commit.instructions.md`
- `.github/instructions/resolve-issue.instructions.md`
