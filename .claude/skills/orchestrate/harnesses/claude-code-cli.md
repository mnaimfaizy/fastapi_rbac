# Claude Code CLI

- **Id:** `claude-code-cli`
- **Support Level:** `documented`. No full run of `orchestrate` has been recorded on it.
- **Tier:** 2.
- **Headless run:** `claude -p`
- **Headless QA:** yes, else a session the human starts.
- **Facts from:** `claude --help`, version 2.1.312, on 2026-11-13.
- **Executors:** building, a headless run; analysis, a sub-agent, or a headless run; QA, a headless run, else a session the human starts.

## Verbs

- `spawn`: `claude -p "<brief>" --model <model> --output-format json` as a background process, started in the Delegation's worktree, with its output written to `delegations/<id>/output.json` by its absolute path in the Chief of Staff's run folder. The handle is the session id in that output, with the process id.
- `message`: `claude -p "<text>" --resume <session-id>` in the same worktree, once the earlier run has ended. A message cannot reach a run while it is still working: it waits for that run's end.
- `await`: wait on the background processes; on an end, read its output and the report file. Check a long-running one's Activity Log at an interval matched to its work, not more often.
- `report`: the report file, and the `result` in the output.
- A sub-agent, for an analysis Delegation: the in-session agent tool. Its result returns to the Chief of Staff when it finishes.
- A QA Delegation: `spawn` on the brief, then `/qa-plan <n>` as the text of a `message` once its first phase has stopped, and `/manual-qa <plan file>` as a later one. If either fails, the QA Delegation falls back to a session the human starts. That fallback is part of the Executor the Dispatch Plan names for the QA row ("headless run; else a session you start"), so the switch needs no new plan.

## Limits

- The human cannot open a headless run while it works; they read its Activity Log and output.
- A headless run needs a permission mode that lets it commit and push without asking, which the human approves in the Dispatch Plan.
- QA may fall back to a session the human starts, where the human types `/qa-plan <n>` and `/manual-qa <plan file>`.

## Check before use

- The permission mode a headless run needs to commit and push without asking (`--permission-mode`).
- Whether `-p` runs a slash command as the user's own invocation.
- Whether a headless run can drive the browser `manual-qa` needs.
