# Claude Code Guidance

@AGENTS.md

`AGENTS.md` is the single operating guide for every agent harness: skills, commit rules, branch names, the commit pipeline, Agent-kit, release and project conventions. Do not restate any of it here. This file holds only what is specific to Claude Code.

## Claude Code specifics

- User-level engineering skills live in `~/.agents/skills` and reach Claude Code through `~/.claude/skills`. Update them with `npx skills update -g`.
- Project skills are under `.claude/skills/` and project sub-agents under `.claude/agents/`. Claude Code reads them from those paths only; `AGENTS.md` lists which are project-owned and which are Agent-kit files.
- The `commit-drafter` sub-agent (`.claude/agents/commit-drafter.md`) has a read-only tool grant enforced by a `PreToolUse` hook. See `docs/agents/commit-pipeline.md`.
- The `release` skill is user-invoked from Claude Code as `.claude/skills/release`.
