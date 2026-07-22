# Agent Operating Guide

This repository includes Matt Pocock engineering skills in `.claude/skills`.

Use these skills as available workflows:

- User-invoked: `ask-matt`, `grill-with-docs`, `triage`, `improve-codebase-architecture`, `setup-matt-pocock-skills`, `to-issues`, `to-prd`, `implement`
- Model-invoked: `prototype`, `diagnosing-bugs`, `research`, `tdd`, `domain-modeling`, `codebase-design`, `code-review`

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `mnaimfaizy/fastapi_rbac`. External pull requests are also part of the triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the label vocabulary defined in `docs/agents/triage-labels.md`.

### Domain docs

Use domain docs guidance in `docs/agents/domain.md` for terminology and architectural decision context.

### Architecture (canonical)

System architecture, directory layout, domain model overview, and Redis allowlist auth flow: `docs/reference/architecture.md`. Do not reintroduce long architecture manuals into harness files.

### Knowledge graph (graphify)

If `graphify-out/graph.json` exists, **query it first** for architecture and module-relationship questions (`graphify query` / `path` / `explain`). Build and update instructions: `docs/agents/graphify.md`. `GRAPH_REPORT.md` is committed; heavy artifacts are gitignored and rebuilt locally.

## Notes

- Canonical skill location is `.claude/skills`.
- Keep skills under `.claude/skills` in sync with upstream when needed.
- Prefer project conventions from `.github/copilot-instructions.md` when there is a conflict.
