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

### Knowledge graph (graphify)

If `graphify-out/graph.json` exists, query it first for architecture questions. See `docs/agents/graphify.md` for install, build (`--code-only`), update, and git policy.

## Project conventions

When working in this repository, follow conventions in:

- `.github/copilot-instructions.md`
- `.github/instructions/pre-commit.instructions.md`
- `.github/instructions/resolve-issue.instructions.md`
