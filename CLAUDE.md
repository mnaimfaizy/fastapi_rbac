# Claude Guidance

This repository includes Matt Pocock engineering skills under `.claude/skills`.

## Skill buckets

- `.claude/skills`: engineering workflows and reusable coding disciplines

## Usage

- Use user-invoked skills when the user explicitly asks for a workflow.
- Use model-invoked skills when the task naturally matches the discipline.
- Keep skill behavior consistent with the source files copied into this repo.

## Agent skills

### Issue tracker

Use GitHub Issues in `mnaimfaizy/fastapi_rbac` as the primary tracker and include external PR triage. See `docs/agents/issue-tracker.md`.

### Triage labels

Apply the triage role labels configured in `docs/agents/triage-labels.md`.

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
