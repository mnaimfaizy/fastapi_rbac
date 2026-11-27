# Claude Code Guidance

@AGENTS.md

`AGENTS.md` is the single operating guide for every agent harness: skills, commit rules, branch names, the commit and pull request pipelines, Agent-kit, release and project conventions. Do not restate any of it here. This file holds only what is specific to Claude Code.

## Claude Code specifics

- User-level engineering skills live in `~/.agents/skills` and reach Claude Code through `~/.claude/skills`. Update them with `npx skills update -g`.
- Project skills live in `.agents/skills/`. Claude Code reads only `.claude/skills/`, which is a tracked symlink to `../.agents/skills`, so it loads them through the link. Project sub-agents are in `.claude/agents/`, generated from `.github/agents/*.agent.md` (edit those, then run `python scripts/development/sync_agents.py --apply`). `AGENTS.md` lists which are project-owned and which are Agent-kit files.
- The `commit-drafter` sub-agent (`.claude/agents/commit-drafter.md`) has a read-only tool grant enforced by a `PreToolUse` hook. See `docs/agents/commit-pipeline.md`.
- The `pr-drafter` sub-agent (`.claude/agents/pr-drafter.md`) is read-only the same way, through `scripts/development/pr-drafter-guard.sh`. See `docs/agents/pr-pipeline.md`.
- The `release` skill is user-invoked from Claude Code as `.agents/skills/release` (a `/release` command through the link).
