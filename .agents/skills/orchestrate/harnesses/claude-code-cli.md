# Claude Code CLI

- **Id:** `claude-code-cli`
- **Support Level:** `documented`. No full run of `orchestrate` has been recorded on it.
- **Tier:** 2.
- **Headless run:** `claude -p`
- **Headless QA:** yes, else a session the human starts.
- **Facts from:** `claude --help`, version 2.1.312, on 2026-11-13. The heartbeat (`await`) is from the Claude Code docs pages scheduled-tasks and tools-reference, read on 2026-11-18.
- **Executors:** building, a headless run; analysis, a sub-agent, or a headless run; QA, a headless run, else a session the human starts.
- **Notify:** none known: the sources in **Facts from** name no way for the Chief of Staff to notify the human. A queued question waits in its session and on the board.

## Verbs

- `spawn`: `claude -p "<brief>" --model <model> --output-format json` as a background process, started in the Delegation's worktree, with its output written to `delegations/<id>/output.json` by its absolute path in the Chief of Staff's run folder. The handle is the session id in that output, with the process id.
- `message`: `claude -p "<text>" --resume <session-id>` in the same worktree, once the earlier run has ended. A message cannot reach a run while it is still working: it waits for that run's end.
- `await`: wait on the background processes; on an end, read its output and the report file. Check a long-running one's Activity Log at an interval matched to its work, not more often. The primary event is a background process's exit, which starts a new turn in the Chief of Staff. The heartbeat is one recurring `CronCreate` task in the Chief of Staff's session, `*/10 * * * *` by default, with a plain-text prompt that says what each firing does (SKILL.md step 6), never `/orchestrate`. It fires only while Claude Code is running and idle. It expires after 7 days, so recreate it before then. A wait on CI or the review is a capped background command, and the heartbeat re-arms one that ended with nothing found.
- `report`: the report file, and the `result` in the output.
- A sub-agent, for an analysis Delegation: the in-session agent tool. Its result returns to the Chief of Staff when it finishes.
- A QA Delegation: `spawn` on the brief, then `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]` as the text of a `message` once its first phase has stopped, and `/manual-qa <plan file>` as a later one. If either fails, the QA Delegation falls back to a session the human starts. That fallback is part of the Executor the Dispatch Plan names for the QA row ("headless run; else a session you start"), so the switch needs no new plan. With `go`, that is the typed route; with `go autonomous`, on a `stack` or a `url` target, the same session follows its brief instead, reading each QA skill's `SKILL.md` from the paths the brief gives, so no command is sent or typed. A `url` target runs from the brief too, with its hosts typed in the Dispatch Plan and relayed through the brief.

## Limits

- The human cannot open a headless run while it works; they read its Activity Log and output.
- A headless run needs a permission mode that lets it commit and push without asking, which the human approves in the Dispatch Plan.
- On the typed route (with `go`), QA may fall back to a session the human starts, where the human types `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]` and `/manual-qa <plan file>`.

## Check before use

- Whether a QA session accepts a host relayed through its brief: that it checks it again with `adapter.mjs host` before any sign-in, and holds its scenarios (never asks) when it refuses it. A harness whose session does not holds every scenario of a `url` target. Record what was found.
- The permission mode a headless run needs to commit and push without asking (`--permission-mode`).
- Whether `-p` runs a slash command as the user's own invocation.
- Whether a headless run can drive the browser `manual-qa` needs.
- Whether the harness can notify the human that a question is queued, and how: record what was found.
