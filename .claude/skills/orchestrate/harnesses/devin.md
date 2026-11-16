# Devin CLI and Devin Desktop

- **Id:** `devin`
- **Support Level:** `documented`.
- **Tier:** 2.
- **Headless run:** `devin -p`
- **Headless QA:** none, until a run shows `-p` takes a QA skill.
- **Facts from:** docs.devin.ai, Devin CLI v3000.12.57 and Devin Desktop 3.12.59, read on 2026-11-14. Devin was not run with a prompt. Windsurf is now Devin Desktop; Cascade was removed in Desktop 3.9.19, and its agent is now the Devin CLI's.
- **Executors:** building, a headless run in a worktree the Chief of Staff makes ([HARNESSES.md](../HARNESSES.md#a-headless-run-in-a-worktree)); analysis, a sub-agent; QA, a Desktop session the human starts.

## Verbs

- `spawn`: `devin -p --prompt-file <brief> --model <model> --permission-mode <approved mode> --respect-workspace-trust false` in the worktree, in the background, with stdout to `delegations/<id>/output.txt`. The handle is the worktree path, the session id from `devin list --format json` there, and the process id.
- `message`: `devin -r <session-id> -p "<text>"` in that worktree, once the run has ended.
- `await`: the process's end; nothing announces it.
- `report`: the absolute path, when the approved permission mode lets it write there; else its last message.
- Analysis: a background `subagent_explore`, or a custom read-only profile with `model:` set; its end is announced. It shares the Chief of Staff's checkout.
- A QA Delegation: a Desktop session the human starts in the worktree on the brief, where the human types `/qa-plan <n>` and later `/manual-qa <plan file>`.

## Limits

- Every QA Delegation is a session the human starts and types the two commands in, until a run shows a headless run can take them.
- Devin documents `.claude/skills` in the project, not `~/.claude/skills`.
- Desktop sessions in their own worktree can be opened and talked to, but only the human can start one.
- The human cannot open a headless run while it works.
- Devin Cloud sessions answer comments on their own pull requests, but cannot reach the run folder or the local QA Stack. One is offered only when the human asks.

## Check before use

- That `-p` combines with `-r` for a follow-up, and how a run reports its session id.
- What `-p` does when a tool call needs approval.
- Whether Devin honours `disable-model-invocation` (its own field is `triggers`); if it does not, the agent could load `qa-plan` itself.
- Whether `devin -p "/qa-plan <n>"` runs the skill as the user's own invocation.
