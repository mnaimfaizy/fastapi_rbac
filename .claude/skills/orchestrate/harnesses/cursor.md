# Cursor

- **Id:** `cursor`
- **Support Level:** `tried`. The first run (on `mnaimfaizy/fastapi_rbac`, pull request 339) found the gaps in mnaimfaizy/agent-kit#189 to #192: it had no Executor to follow, its building sub-agent shared the checkout, QA ran inside the building sub-agent, and a stale user-level copy of the skill was loaded.
- **Tier:** between 1 and 2. It starts sub-agents in the background and tells the Chief of Staff when one ends, but the human cannot talk to a sub-agent while it works.
- **Headless run:** `agent -p`
- **Headless QA:** yes, else a session the human starts.
- **Facts from:** cursor.com/docs, the Subagents, Worktrees, Skills, Headless and Run modes pages, read on 2026-11-14 with Cursor 3.28; and the first run.
- **Executors:** building and analysis, a background sub-agent in its own worktree; QA, a headless run of the Cursor CLI (`agent`), else a session the human starts.

## Verbs

- `spawn`, for a building or analysis Delegation: a background Task sub-agent on the brief, with the plan's model, and a brief that opens by asking for its own isolated worktree on the Delegation's branch. Straight after `spawn`, check that the sub-agent's working directory is a worktree under `~/.cursor/worktrees/` on that branch. If it is the Chief of Staff's checkout, stop the sub-agent and raise it to the human before it writes anything. The handle is the agent id the Task tool returns.
- `message`: "Resume agent `<id>`: <text>", once the sub-agent has ended.
- `await`: end the turn. A background sub-agent's end is announced with its final message. Never poll. If the editor does not announce it, read `~/.cursor/subagents/` at an interval matched to the work.
- `report`: the report file, by its absolute path; a Delegation whose write is refused ends with its report as its last message instead.
- A QA Delegation: the Chief of Staff makes its worktree, `git worktree add --detach <path> <head>`, with `<path>` outside `~/.cursor/worktrees/`, which Cursor cleans up. Then `agent -p "<brief>" --model <model> --output-format json` in that worktree, as a background process, with `message` as `agent -p "<text>" --resume <session-id>` there. Print mode refuses every write outside the workspace, so the QA run ends with its report as its last message, unless the human approved `--force` in the Dispatch Plan. If `-p` does not run `/qa-plan <n>`, or has no browser, fall back to a session the human starts in a worktree, where the human types `/qa-plan <n>` and later `/manual-qa <plan file>`.

## Limits

- A sub-agent shares the Chief of Staff's checkout unless the brief asks for isolation, and no Task parameter forces it. Each `spawn` is checked, and a sub-agent found in the checkout is stopped.
- The human can read a sub-agent's transcript, but cannot talk to it while it works.
- Cursor asks before an agent writes outside its workspace, so the human may be asked to approve each report written to the run folder.
- A sub-agent cannot subscribe to CI (refused in the first run), and a CI subscription does not deliver review comments. The Chief of Staff watches each pull request's checks and comments itself, with `gh`.
- Cursor deletes the oldest worktrees under `~/.cursor/worktrees/` once there are more than `cursor.worktreeMaxCount` (25 by default), including ones made by hand there. A Delegation pushes its branch as soon as it has a commit, and the Chief of Staff makes its own scratch worktrees outside that folder.
- QA may fall back to a session the human starts, where the human types the two QA commands.
- A Cursor Cloud Agent can subscribe to its own pull request, but cannot reach the run folder or the local QA Stack, and needs a cloud plan; it is offered only when the human asks.
- Cursor Projects (beta) is never an Executor or the Chief of Staff. Its coordinator rewrites each brief, and no API setting picks a worker's model, branch or brief. Its local workers run in the existing checkout, with no isolation. Nothing it does reaches a local session as an event (read 2026-11-14).

## Check before use

- Whether text can reach a sub-agent while it is still working.
- That the editor, and not only the CLI, announces a background sub-agent's end.
- Whether a worktree sub-agent's workspace is its worktree or the Chief of Staff's folder, and so whether its report write needs approval.
- Whether `-p` runs `/qa-plan <n>` as the user's own invocation, and whether a headless run has a browser.
- Which copy wins when both `~/.claude/skills` and `.claude/skills` hold `orchestrate`: Cursor loads both.
