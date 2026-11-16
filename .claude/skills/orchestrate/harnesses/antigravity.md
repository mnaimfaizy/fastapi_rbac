# Google Antigravity

- **Id:** `antigravity`
- **Support Level:** `documented`.
- **Tier:** 2, until a run confirms more. Its documentation describes tier 1: sub-agents in worktrees of their own, which the human can type into while they work.
- **Headless run:** `agy -p`
- **Headless QA:** yes, else a session the human starts.
- **Facts from:** antigravity.google docs, App 2.32.0 and CLI `agy` 1.5.8, read on 2026-11-14. Antigravity was not run with a prompt.
- **Executors:** building and analysis, a sub-agent in its own worktree; QA, a headless `agy` run in a worktree the Chief of Staff makes ([HARNESSES.md](../HARNESSES.md#a-headless-run-in-a-worktree)), else a session the human starts.

## Verbs

- `spawn`, for building: ask for a sub-agent (`invoke_subagent`) with workspace `branch`, so it gets a worktree of its own, and a brief whose first step is `git switch -c <branch>`. Straight after `spawn`, check that its working directory is not the Chief of Staff's checkout. The handle is its name and conversation id.
- `message`: send to the sub-agent by id; that wakes it if idle, and interrupts it if running.
- `await`: end the turn on its result message; if that does not wake the Chief of Staff, a `/schedule` timer keyed on the sub-agent's id.
- `report`: the absolute path, which needs a `write_file(<run folder>)` allow rule; else the result message.
- Analysis: the `research` sub-agent, which is read-only, or `self` with workspace `branch` for anything that runs code.
- A QA Delegation: `agy -p "<brief>" --model <model> --output-format json --add-dir <run folder>` in the worktree, then `agy -p "/qa-plan <n>" --conversation <id>`, and later `/manual-qa <plan file>`; print mode expands skill commands. Else a session the human starts in that worktree.

## Limits

- Models are tiers (`flash`, `pro`), not model ids: `models` names a tier.
- The generated worktree path and branch name are not documented, so each brief moves its work onto the Delegation's branch first.
- Ending a sub-agent deletes its worktree, so it pushes before it reports.
- `git push` needs a `command(git push)` allow rule, because the sandbox has no network; the human approves the rules in the Dispatch Plan.
- Antigravity reads `.agents/skills` and `~/.gemini/config/skills`: the QA skills need a copy there, which the Dispatch Plan names.
- Its browser drives the human's running Chrome after an **Allow** click, so the human is present for `manual-qa`.
- Remote Agents have no API or print mode and cannot reach local files or skills: never an Executor here.

## Check before use

- Where a sub-agent's worktree is made, and what its branch is named.
- Whether a sub-agent's result wakes an idle Chief of Staff.
- Whether `invoke_subagent` takes an exact model id.
- Whether Antigravity honours `disable-model-invocation`, and whether it reads `.claude/skills` at all.
- Whether the human can type into a running sub-agent, which would make it a tier 1 harness.
