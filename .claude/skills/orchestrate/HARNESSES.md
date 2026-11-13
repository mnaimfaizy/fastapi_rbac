# The four verbs on each harness

The skill body speaks of four verbs only. This file says how each one works on the harness running the Chief of Staff. Load it before the first verb of a run, and pick the tier this harness is in.

| Verb      | What it does                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `spawn`   | Start an Executor on one brief, with the Dispatch Plan's model, in its own branch and working copy. Returns a handle. |
| `message` | Send text to a running or finished Executor by its handle: an answer, a nudge, a report sent back.                    |
| `await`   | Wait for the next event from any running Executor: a report, a Decision Request, an end, or no sign of life.          |
| `report`  | How a Delegation's report reaches the Chief of Staff.                                                                 |

**`report` is a file on every harness.** A Delegation writes its report to `delegations/<id>/report.md` in the run folder ([RUN.md](RUN.md)), by the absolute path its brief gives (the run folder is gitignored, so it exists only in the Chief of Staff's checkout), and appends each Decision Request to `delegations/<id>/decisions.md`, then stops. The verbs only carry the signal that something was written. An Executor that cannot reach the run folder (one working from a clone somewhere else) ends its turn with the report or the Decision Request as its last message instead, and the Chief of Staff writes that into `report.md` or `decisions.md` before reading it.

**Every Executor works in its own branch and working copy**, never in the Chief of Staff's checkout: a separate worktree on the same machine, or a clone. Two Executors in one working copy overwrite each other.

## Where each fact comes from

Each fact below was read on 2026-11-13, from the harness's own documentation or its `--help` output, as noted. An item marked **check before use** was not confirmed there. The first run that relies on it checks it, and records what it found in its Activity Log; the next change to this file moves it into the confirmed list or corrects it.

## Tier 1: harnesses with Live Sessions

The harness can start a separate session the human can open, read and talk to while it works, and tells the starting session when that session ends a turn.

**Claude Code desktop app** (from the session tools the app gives a session, as offered on 2026-11-13):

- `spawn`: start a new session with the brief as its first message, in its own worktree, with the plan's model. The handle is the session's id.
- `message`: send a message to the session by its id.
- `await`: end the turn. The app continues the Chief of Staff when a started session ends a turn, quoting the start of its latest report. Never poll.
- `report`: the session's report file, and its final message.
- A sub-agent, for an analysis Delegation: the in-session agent tool. Its result returns to the Chief of Staff when it finishes. **Check before use:** whether a sub-agent can be sent a follow-up message after it finishes.
- A user-invoked skill in a Live Session, for a QA Delegation: start the session on its brief, and once its first phase has stopped, `message` it `/qa-plan <n>`; later, `/manual-qa <plan file>`. **Check before use:** whether the app runs a slash command sent this way as the user's own invocation. In the first run of `orchestrate` (2026-11-13) it was not tried: the QA session could not invoke `qa-plan` itself, and the human typed `/qa-plan <n>` there. So try it, and if the session does not run it, the human types it; record which happened in the Activity Log, and correct this line.

A tier 1 harness may also run tier 2 Executors, and a Live Session is preferred for a building Delegation: the human can open it to watch or steer.

## Tier 2: harnesses that start and poll

The harness can start a headless run in the background and resume it later, but the human cannot open it while it works.

**Claude Code CLI** (from `claude --help`, version 2.1.312, on 2026-11-13):

- `spawn`: `claude -p "<brief>" --model <model> --output-format json` as a background process, started in the Delegation's worktree, with its output written to `delegations/<id>/output.json` by its absolute path in the Chief of Staff's run folder. The handle is the session id in that output, with the process id. **Check before use:** the permission mode a headless run needs to commit and push without asking (`--permission-mode`), which is the human's choice to approve in the Dispatch Plan.
- `message`: `claude -p "<text>" --resume <session-id>` in the same worktree, once the earlier run has ended. A message cannot reach a run while it is still working: it waits for that run's end.
- A user-invoked skill, for a QA Delegation: `spawn` on the brief, then `/qa-plan <n>` as the text of a `message` once its first phase has stopped, and `/manual-qa <plan file>` as a later one. **Check before use:** whether `-p` runs a slash command as the user's own invocation, and whether a headless run can drive the browser `manual-qa` needs. Try it; if either fails, the QA Delegation falls back to a session the human starts, as on tier 3. That fallback is part of the Executor the Dispatch Plan names for the QA row ("headless run; else a session you start"), so the switch needs no new plan. Record which happened in the Activity Log.
- `await`: wait on the background processes; on an end, read its output and the report file. Check a long-running one's Activity Log at an interval matched to its work, not more often.
- `report`: the report file, and the `result` in the output.
- A sub-agent: the in-session agent tool, as in tier 1.

**Codex CLI** and **Gemini CLI**: **check before use.** Each documents a non-interactive mode that takes a prompt and exits (`codex exec`, `gemini -p`), which would serve as `spawn`; how to resume a finished run as `message` was not confirmed.

## Tier 3: harnesses that run sequentially

The harness has no way to start another agent, in the background or otherwise.

- `spawn`: the Chief of Staff writes the brief to the run folder and asks the human to start a new session on it, in a new worktree, with the plan's model. The handle is the human's name for that session. One building Delegation runs at a time, whatever `limits.building` says.
- `message`: the Chief of Staff writes the text for the human to paste into that session.
- `await`: the human says when the session has written its report.
- `report`: the report file.

The Chief of Staff still never does a Delegation's work itself, here least of all: running a Delegation in its own session would mix the work it must verify with the session that verifies it.

## Choosing an Executor

| Delegation | Tier 1                                 | Tier 2                                          | Tier 3                     |
| ---------- | -------------------------------------- | ----------------------------------------------- | -------------------------- |
| building   | A Live Session                         | A headless run                                  | A session the human starts |
| analysis   | A sub-agent, or a Live Session if long | A sub-agent, or a headless run                  | A session the human starts |
| QA         | A Live Session                         | A headless run; else a session the human starts | A session the human starts |

The Dispatch Plan names the Executor for every Delegation, and the human's "go" approves it.

A QA Delegation is never a sub-agent, on any tier: a sub-agent cannot take a user-invoked skill, and QA needs a working copy and a browser of its own. On every tier, the QA Delegation's session starts on its brief, never on a skill command, so the head is pinned before `qa-plan` runs. Where the way a QA skill starts is still **check before use**, the Dispatch Plan says the human may be asked to type `/qa-plan <n>`, and later `/manual-qa <plan file>`, in that session.
