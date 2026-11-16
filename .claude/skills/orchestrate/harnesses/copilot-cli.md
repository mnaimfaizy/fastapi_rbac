# GitHub Copilot CLI

- **Id:** `copilot-cli`
- **Support Level:** `documented`.
- **Tier:** 2, with a tier 1 `await`: a Chief of Staff in the Copilot CLI is told when a background shell ends.
- **Headless run:** `copilot -p`
- **Headless QA:** yes, with a Playwright MCP server; else a session the human starts.
- **Facts from:** docs.github.com/copilot and the Copilot CLI changelog up to 1.0.112, read on 2026-11-14. `--worktree` needs 1.0.85 or later; before it, the flag is experimental. Copilot was not run with a prompt.
- **Executors:** building and QA, a headless run in its own worktree; analysis, a `task` sub-agent; QA falls back to a session the human starts.

## Verbs

- `spawn`: `copilot -p "<brief>" --session-id <uuid> --worktree=<branch> --model <model> --output-format json --no-ask-user --add-dir <run folder>`, with the tool permissions the human approved (`--allow-all-tools`, or allow rules), as a background shell. The handle is the uuid. Straight after `spawn`, check with `git worktree list` that the branch's worktree exists and is not the Chief of Staff's checkout.
- `message`: `copilot -p "<text>" --resume=<uuid>`, once the run has ended.
- `await`: end the turn: the background shell's end is announced. Elsewhere, wait on the process.
- `report`: the report file, which `--add-dir` makes writable; else the run's last message.
- Analysis: a `task` sub-agent (`explore`, `research`, or a custom one with read-only `tools`); `write_agent` reaches it running or idle. It shares the Chief of Staff's checkout.
- A QA Delegation: a headless run, with `/qa-plan <n>` and later `/manual-qa <plan file>` sent by `--resume`, and a browser through a Playwright MCP server (`--additional-mcp-config`). Else a session the human starts with `copilot` in that worktree.

## Limits

- Since 1.0.36 the CLI does not read `~/.claude/skills`; it reads `.github/skills`, `.claude/skills` and `.agents/skills` in the project. A user-level install goes to `~/.copilot/skills` or `~/.agents/skills`.
- A run that commits and pushes needs `--allow-all-tools` or allow rules, which the human approves in the Dispatch Plan.
- The human cannot open a headless run while it works.
- The Copilot cloud agent takes follow-ups only as `@copilot` pull-request comments, sends no event to a local session, and cannot reach the run folder or the QA Stack. It is offered only when the human asks.
- Copilot in VS Code can start sessions the human opens, each in its own worktree, but the human confirms every message sent to them, and no end-of-turn signal to the starting session is documented. It is not used as a Chief of Staff yet.

## Check before use

- Whether `-p "/qa-plan <n>"` runs the skill as the user's own invocation.
- Whether a headless run can drive a browser for `manual-qa`.
- The field names of the final record in the JSON output.
