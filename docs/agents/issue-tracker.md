# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues for `mnaimfaizy/fastapi_rbac`.

## Conventions

- Use one issue for each vertical slice of work.
- Keep acceptance criteria as a checklist in the issue body.
- Link implementation pull requests back to the issue.
- Treat external pull requests as part of the triage surface.

## Triage labels versus Agent-kit trigger labels

`ready-for-agent` and `ready-for-human` are triage **states**. Agent-kit's `agent:plan`, `agent:implement` and `agent:review` are **Trigger labels**: adding one starts a run, and the run removes it. A maintainer adds `agent:plan` by hand to an issue that is `ready-for-agent`; nothing links the two automatically. See [`agent-kit.md`](agent-kit.md).

## When a skill says "publish to the issue tracker"

Create or update a GitHub issue in `mnaimfaizy/fastapi_rbac` with clear scope, acceptance criteria, and dependencies.

## When a skill says "fetch the relevant ticket"

Read the referenced GitHub issue directly and use linked pull requests and comments for context.
