# Agent Operating Guide

Engineering skills are installed at user level (`~/.agents/skills`) rather than vendored into this repository. Update them with `npx skills update -g`.

Project-owned agent assets that do live here:

- `.claude/skills/release`: Release PR workflow (see Release below)
- `.claude/agents/release-notes.md`: release-notes sub-agent
- `docs/agents/`: repo-side configuration the installed skills read

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `mnaimfaizy/fastapi_rbac`. External pull requests are also part of the triage surface. See `docs/agents/issue-tracker.md`.

### Domain docs

Use domain docs guidance in `docs/agents/domain.md` for terminology and architectural decision context.

### Architecture (canonical)

System architecture, directory layout, domain model overview, and Redis allowlist auth flow: `docs/reference/architecture.md`. Do not reintroduce long architecture manuals into harness files.

### Knowledge graph (graphify)

If `graphify-out/graph.json` exists, **query it first** for architecture and module-relationship questions (`graphify query` / `path` / `explain`). Build and update instructions: `docs/agents/graphify.md`. `GRAPH_REPORT.md` is committed; heavy artifacts are gitignored and rebuilt locally.

### Commit messages (mandatory)

Commit messages must follow [`docs/agents/commit-messages.md`](docs/agents/commit-messages.md). This is not optional: plain conventional commits, no emoji, component/domain scopes. Release-note generation depends on consistent history.

### Release

User-invoked [`release`](.claude/skills/release/SKILL.md) skill: propose version → release-notes sub-agent → Release PR → return PR URL. Notes agent SSOT: [`docs/agents/release-notes-agent.md`](docs/agents/release-notes-agent.md).

## Notes

- Engineering skills come from the user-level install; do not re-vendor them into this repository.
- `.claude/skills/release` is project-owned and is maintained here.
- Prefer project conventions from `.github/copilot-instructions.md` when there is a conflict.
