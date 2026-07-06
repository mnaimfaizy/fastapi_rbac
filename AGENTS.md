# Agent Operating Guide

This repository includes Matt Pocock engineering skills in `.claude/skills`.

Use these skills as available workflows:

- User-invoked: `ask-matt`, `grill-with-docs`, `triage`, `improve-codebase-architecture`, `setup-matt-pocock-skills`, `to-issues`, `to-prd`
- Model-invoked: `prototype`, `diagnosing-bugs`, `research`, `tdd`, `domain-modeling`, `codebase-design`, `code-review`

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `mnaimfaizy/fastapi_rbac`. External pull requests are also part of the triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the label vocabulary defined in `docs/agents/triage-labels.md`.

### Domain docs

Use domain docs guidance in `docs/agents/domain.md` for terminology and architectural decision context.

## Notes

- Canonical skill location is `.claude/skills`.
- Keep skills under `.claude/skills` in sync with upstream when needed.
- Prefer project conventions from `.github/copilot-instructions.md` when there is a conflict.
