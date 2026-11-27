# Devin CLI and Devin Desktop

- **Id:** `devin`
- **Support Level:** `documented`.
- **Tier:** 2.
- **Headless run:** `devin -p`
- **Headless QA:** none, until a run shows `-p` takes a QA skill.
- **Facts from:** docs.devin.ai, Devin CLI v3000.12.57 and Devin Desktop 3.12.59, read on 2026-11-14. Devin was not run with a prompt. Windsurf is now Devin Desktop; Cascade was removed in Desktop 3.9.19, and its agent is now the Devin CLI's.
- **Executors:** building, a headless run in a worktree the Chief of Staff makes ([HARNESSES.md](../HARNESSES.md#a-headless-run-in-a-worktree)); analysis, a sub-agent; QA, a Desktop session the human starts.
- **Notify:** none known: the sources in **Facts from** name no way for the Chief of Staff to notify the human. A queued question waits in its session and on the board.

## Verbs

- `spawn`: `devin -p --prompt-file <brief> --model <model> --permission-mode <approved mode> --respect-workspace-trust false` in the worktree, in the background, with stdout to `delegations/<id>/output.txt`. The handle is the worktree path, the session id from `devin list --format json` there, and the process id.
- `message`: `devin -r <session-id> -p "<text>"` in that worktree, once the run has ended.
- `await`: the process's end; nothing announces it. The heartbeat is the foreground watch ([HARNESSES.md](../HARNESSES.md#waiting-an-event-and-a-heartbeat)): while the run waits on a Delegation, the Chief of Staff does not end its turn, and the process's end is one more change the watch sees.
- `report`: the absolute path, when the approved permission mode lets it write there; else its last message.
- Analysis: a background `subagent_explore`, or a custom read-only profile with `model:` set; its end is announced. It shares the Chief of Staff's checkout.
- A QA Delegation: a Desktop session the human starts in the worktree on the brief, where the human types `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]` and later `/manual-qa <plan file>`. With `go`, that is the typed route; with `go autonomous`, on a `stack` or a `url` target, the same session follows its brief instead, reading each QA skill's `SKILL.md` from the paths the brief gives, so no command is sent or typed. A `url` target runs from the brief too, with its hosts typed in the Dispatch Plan and relayed through the brief.

## Limits

- On the typed route (with `go`), every QA Delegation is a session the human starts and types the two commands in, until a run shows a headless run can take them.
- Devin documents `.claude/skills` in the project, not `~/.claude/skills`.
- Desktop sessions in their own worktree can be opened and talked to, but only the human can start one.
- The human cannot open a headless run while it works.
- Devin Cloud sessions answer comments on their own pull requests, but cannot reach the run folder or the local QA Stack. One is offered only when the human asks.

## Check before use

- Whether a QA session accepts a host relayed through its brief: that it checks it again with `adapter.mjs host` before any sign-in, and holds its scenarios (never asks) when it refuses it. A harness whose session does not holds every scenario of a `url` target. Record what was found.
- How long a foreground shell command, and a turn, may run, since the foreground watch depends on both. A shell tool's own time limit could cut the watch short (not yet confirmed).
- That `-p` combines with `-r` for a follow-up, and how a run reports its session id.
- What `-p` does when a tool call needs approval.
- Whether Devin honours `disable-model-invocation` (its own field is `triggers`); if it does not, the agent could load `qa-plan` itself.
- Whether `devin -p "/qa-plan <n>"` runs the skill as the user's own invocation.
- Whether the harness can notify the human that a question is queued, and how: record what was found.
