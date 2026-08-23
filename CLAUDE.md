# Claude Guidance

Engineering skills are installed at user level (`~/.agents/skills`, surfaced to Claude via `~/.claude/skills`) and are no longer vendored into this repository. Update them with `npx skills update -g`.

## Project-owned agent assets

Only these live in the repo; every other skill comes from the user-level install.

- `.claude/skills/release`: Release PR workflow (see Release below)
- `.claude/agents/release-notes.md`: release-notes sub-agent
- `docs/agents/`: repo-side configuration the installed skills read

## Agent skills

### Issue tracker

Use GitHub Issues in `mnaimfaizy/fastapi_rbac` as the primary tracker and include external PR triage. See `docs/agents/issue-tracker.md`.

### Domain docs

Read and maintain shared terminology and ADR guidance from `docs/agents/domain.md`.

### Architecture (canonical)

System architecture and auth-flow narrative: `docs/reference/architecture.md`. Harness files should link there rather than duplicating architecture manuals.

### Knowledge graph (graphify)

If `graphify-out/graph.json` exists, query it first for architecture questions. See `docs/agents/graphify.md` for install, build (`--code-only`), update, and git policy.

### Commit messages (mandatory)

Commit messages must follow [`docs/agents/commit-messages.md`](docs/agents/commit-messages.md). This is not optional: plain conventional commits, no emoji, component/domain scopes.

### Release

User-invoked skill: `.claude/skills/release`. Opens a Release PR (notes via release-notes sub-agent). Canonical notes behavior: [`docs/agents/release-notes-agent.md`](docs/agents/release-notes-agent.md).

## Project conventions

When working in this repository, follow conventions in:

- `.github/copilot-instructions.md`
- `docs/agents/commit-messages.md` (commit message SSOT)
- `.github/instructions/pre-commit.instructions.md`
- `.github/instructions/resolve-issue.instructions.md`
