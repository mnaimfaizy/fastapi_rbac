# Agent Operating Guide

Engineering skills are installed at user level (`~/.agents/skills`) rather than vendored into this repository. Update them with `npx skills update -g`.

Project-owned agent assets that do live here:

- `.claude/skills/release`: Release PR workflow (see Release below)
- `.claude/agents/release-notes.md`: release-notes sub-agent
- `docs/agents/`: repo-side configuration the installed skills read

Kit-owned files are copied from one pinned [Agent-kit](docs/agents/agent-kit.md) tag. They are an exception to "no vendoring". Never edit them by hand; re-copy them from a new tag instead:

- `.claude/skills/{code-review,security-audit,security-finding-triage,security-response,explainer,instruction-drift-audit,qa-plan,manual-qa,plain-prose,orchestrate}` (in this repo, the kit's `code-review` replaces the user-level one)
- `.github/{agent-runtime,agent-pipeline,security-audit}`

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `mnaimfaizy/fastapi_rbac`. External pull requests are also part of the triage surface. See `docs/agents/issue-tracker.md`.

### Domain docs

Use domain docs guidance in `docs/agents/domain.md` for terminology and architectural decision context.

### Architecture (canonical)

System architecture, directory layout, domain model overview, and Redis allowlist auth flow: `docs/reference/architecture.md`. Do not reintroduce long architecture manuals into harness files.

### Knowledge graph (graphify)

Optional and per-developer. When the `graphify` MCP server is connected, use `get_neighbors` for "what directly calls or imports X" and `god_nodes` for orientation, then confirm against the file. Never use it for FastAPI `Depends(...)` wiring, client-to-route links, or same-named symbols: it fails silently there. Setup, refresh hooks and the full do/don't table: `docs/agents/graphify.md`. Nothing under `graphify-out/` is committed.

### Commit messages (mandatory)

Commit messages must follow [`docs/agents/commit-messages.md`](docs/agents/commit-messages.md). This is not optional: plain conventional commits, no emoji, component/domain scopes. Release-note generation depends on consistent history.

### Branch names (mandatory)

Branch names must follow [`docs/agents/branch-names.md`](docs/agents/branch-names.md). This is not optional: allowed prefixes only; include the issue number and a short slug when the work is for a numbered issue; no harness or vendor prefixes.

### Release

User-invoked [`release`](.claude/skills/release/SKILL.md) skill: propose version → release-notes sub-agent → Release PR → return PR URL. Notes agent SSOT: [`docs/agents/release-notes-agent.md`](docs/agents/release-notes-agent.md).

### Agent-kit

The CI security audit and the plan → implement → review pipeline run through Agent-kit. The integration's single source of truth is [`docs/agents/agent-kit.md`](docs/agents/agent-kit.md). In this repo, the kit's "Allowlist" is always called the **actor allowlist**, because **Allowlist** means the Redis token allowlist.

## Notes

- Engineering skills come from the user-level install; do not re-vendor them into this repository. The only exception is the Agent-kit kit-owned files listed above.
- `.claude/skills/release` is project-owned and is maintained here.
- Prefer project conventions from `.github/copilot-instructions.md` when there is a conflict.
