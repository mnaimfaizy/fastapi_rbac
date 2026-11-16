# OpenAI Codex CLI

- **Id:** `codex-cli`
- **Support Level:** `documented`.
- **Tier:** 2.
- **Headless run:** `codex exec`
- **Headless QA:** yes, with a browser MCP server; else a session the human starts.
- **Facts from:** `openai/codex` rust-v0.169.0 and its docs at learn.chatgpt.com/docs, read on 2026-11-14. Codex was not run with a prompt.
- **Executors:** building and QA, a headless run in a worktree the Chief of Staff makes ([HARNESSES.md](../HARNESSES.md#a-headless-run-in-a-worktree)); analysis, a sub-agent; QA falls back to a session the human starts.

## Verbs

- `spawn`: `codex exec -C <worktree> -m <model> --json --add-dir <run folder> "<brief>"` in the background, with stdout to `delegations/<id>/output.jsonl`. The handle is the `thread_id` in its `thread.started` event, with the process id.
- `message`: `codex exec resume <thread_id> "<text>"` from inside the worktree, once the run has ended.
- `await`: the process's end.
- `report`: the report file, which `--add-dir` makes writable.
- Analysis: a sub-agent (`spawn_agent`); `send_input` reaches it running or ended, and its end is announced. It shares the Chief of Staff's checkout.
- A QA Delegation: a headless run, with `$qa-plan <n>` and later `$manual-qa <plan file>` sent by `resume`, and a browser through an MCP server. Else a session the human starts: a Codex desktop-app chat in that worktree, which has a browser.

## Limits

- The `workspace-write` sandbox makes `.git` read-only and has no network, so a building run needs full access, or allow rules for its git and `gh` commands. The human chooses, in the Dispatch Plan.
- Codex reads `.agents/skills` and `~/.agents/skills`, not `.claude/skills`. `qa-plan` and `manual-qa` need a copy there, with `agents/openai.yaml` setting `policy.allow_implicit_invocation: false`, since Codex ignores `disable-model-invocation`. The Dispatch Plan names the copy for the human to approve.
- The CLI has no browser; `manual-qa` needs a browser MCP server, or falls back to a session the human starts.
- The human cannot open a headless run while it works.
- Codex Cloud has no follow-up command from the CLI, no completion event and no CI or review subscription: never an Executor here.

## Check before use

- Whether `$qa-plan` in a resumed prompt counts as the user's own invocation.
- Whether `--approve-for-me`, or an allow rule, approves a `git push`.
- Whether `codex queue` reaches a running `exec` run, which would let a `message` arrive while it works.
