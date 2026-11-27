# Skills and agents layout

How this repository lays out agent skills and sub-agents, and why. Decided in [#438](https://github.com/mnaimfaizy/fastapi_rbac/issues/438).

## Layout

| Path | What it is | Edit it? |
| --- | --- | --- |
| `.agents/skills/<name>/` | Every project skill: the 11 Agent-kit skills, `release`, `commit-change`, `create-pull-request`, `resolve-issue`, `architect`, `manager`, `implementor`, `troubleshooting` | Yes, except the 11 kit skills (see [Agent-kit integration](agent-kit.md)) |
| `.claude/skills` | A tracked relative symlink (git mode `120000`) to `../.agents/skills` | No. Never replace it with a copy |
| `.github/agents/<name>.agent.md` | The canonical sub-agent file. Copilot reads it as it is | Yes |
| `.claude/agents/<name>.md`, `.cursor/agents/<name>.md` | Sub-agent files generated from the canonical file | No. Edit the canonical file, then run the sync |
| `.github/copilot-instructions.md` | Copilot's repository instructions | Yes |

Cursor and Copilot read `.agents/skills/` natively. Claude Code reads only `.claude/skills/`, so that path is the link.

The Copilot prompts and instructions that used to sit in `.github/prompts/` and `.github/instructions/` are skills now. `architect`, `manager`, `implementor` and `troubleshooting` were explicit prompts, so they carry `disable-model-invocation: true` and run only when invoked by name. `resolve-issue` can be picked by the model. The `/commit` prompt and the pre-commit instructions were removed without a copy: [`commit-change`](../../.agents/skills/commit-change/SKILL.md) and the [commit pipeline](commit-pipeline.md) own that workflow.

## The link check

`python scripts/development/check_skills_link.py` fails unless all of these hold:

- the git index holds exactly one symlink, `.claude/skills`, and its blob is `../.agents/skills`;
- on disk `.claude/skills` is a link to `../.agents/skills` that resolves to `.agents/skills`;
- `.agents/skills` is a real directory.

pre-commit runs it on every commit (hook `skills-link`), the `destroyed-symlinks` hook catches a link turned into a file, and CI runs it in the `changes` job, which `CI gate` needs. On Windows a clone made without `core.symlinks` turns the link into a text file. The check then prints the repair; the steps are in [Developer setup](../development/DEVELOPER_SETUP.md#windows-repo-skills-not-loading).

## The sub-agent sync

`python scripts/development/sync_agents.py --apply` rewrites the generated files; `--check` (pre-commit hook `agents-sync`, and a CI step) exits 1 on any drift, a missing target, or a target with no canonical file.

- The body is shared. Text for some harnesses only sits between `<!-- harness:claude -->` (or `cursor`, `copilot`, or a comma list) and `<!-- /harness -->`.
- `name` and `description` come from the canonical file. Every other frontmatter key in a target (Claude `tools`, `model`, `hooks`; Cursor `model`, `readonly`) is kept as it is, because model pins and tool grants differ by harness. The canonical file may also carry a `tools` list (`read`, `search`) for GitHub Copilot; sync does not copy it, and any other canonical key is an error.
- A target that does not exist is created with `name` and `description` only. Add the harness keys by hand.

## Research and sources

Checked on 2026-11-27. Each claim names where it comes from.

1. **Claude Code does not read `.agents/skills/`.** The project location is `.claude/skills/<name>/SKILL.md`; a skill folder can be a symlink, and Claude Code loads it once even if several locations point at the same target ([Claude Code skills docs](https://code.claude.com/docs/en/skills), "Choose where skills load" and "Symlinked folders"). The skills CLI maps `claude-code` to `.claude/skills` and `cursor` to `.agents/skills` ([`src/agents.ts`](https://github.com/vercel-labs/skills/blob/main/src/agents.ts)).
2. **A directory link works in Claude Code 2.1.329.** Probe: `.agents/skills/<probe>/SKILL.md` plus `.claude/skills -> ../.agents/skills` in a throwaway repo and in a linked worktree, then `claude -p "Reply with the single word OK." --output-format stream-json --verbose --max-turns 1`. The `system/init` event's `skills` list held the probe skill. A control repo without the link did not list it. Open upstream reports (anthropics/claude-code [#37435](https://github.com/anthropics/claude-code/issues/37435), [#68318](https://github.com/anthropics/claude-code/issues/68318), [#72631](https://github.com/anthropics/claude-code/issues/72631)) concern a link for each skill, and Desktop and IDE menus; none reports a failure with a linked `.claude/skills` directory. The Desktop and IDE `/` menu was not probed.
3. **Cursor reads `.agents/skills/` natively and collapses duplicates.** [Cursor skills docs](https://cursor.com/docs/context/skills) list `.agents/skills/` and, for compatibility, `.claude/skills/`. A Cursor staff reply on the [forum](https://forum.cursor.com/t/excessive-token-usage-cursor-auto-loads-too-many-skills-from-claude-skills-at-conversation-start/160677) says the duplicate-loading fix landed in Cursor 3.17. Not probed locally.
4. **`skills-lock.json` is not edited.** In the skills CLI, `skillPath` is the path of the skill's `SKILL.md` inside the source repository, and `skillFolderHash` describes the source tree ([`src/local-lock.ts`](https://github.com/vercel-labs/skills/blob/main/src/local-lock.ts)). Agent-kit `v1.0.0-beta.9` keeps its skills under `.claude/skills/<name>/`, so every `skillPath` here (`.claude/skills/<name>/SKILL.md`) is still the right source path. Each `skillFolderHash` equals `git rev-parse v1.0.0-beta.9:.claude/skills/<name>` in Agent-kit, and the move did not change any tree: `git rev-parse HEAD:.agents/skills/<name>` equals it for all 11 entries.
5. **The Agent-kit CLI refuses to write through the link.** At `v1.0.0-beta.9`, `cli/src/local-writes.mjs` throws "is a symbolic link or junction; the CLI does not delete or write through links" for any path that is, or sits under, a link, and `upgrade` calls it for each kit-owned path. So `npx @mnaimfaizy/agent-kit upgrade` stops here. The by-hand route is in [Agent-kit integration, Upgrading](agent-kit.md#upgrading). The kit's own scripts already handle the layout: orchestrate, qa-plan and manual-qa compare real paths over `.claude/skills` and `.agents/skills`, and `instruction-drift-audit` names `.claude/skills -> .agents/skills`.
6. **Nothing else reads the path.** Docker build contexts are `backend/` and `react-frontend/`, no workflow `paths:` filter names `.claude`, and skill links to `docs/` use `../../../`, the same depth under `.agents/skills/<name>/`.

### Lock file finding

`skills-lock.json` uses the schema of the skills CLI's global lock (`version: 3`, `skillFolderHash`). The CLI's project lock reader accepts only versions 1 and 2. `npx skills@1.9.0 list` on a copy of the file printed `[SKILLS_INVALID_LOCAL_LOCK] ... unsupported lock version 3 (expected 2)` and found no project skills. So `npx skills update -p` cannot use this lock, whatever paths it holds, and no tool in this repository reads it. That predates #438 and is a separate follow-up: regenerate a version-2 lock, or drop the file and rely on the Agent-kit CLI for upgrades.
