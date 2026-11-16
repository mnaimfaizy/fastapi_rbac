# Gemini CLI

- **Id:** `gemini-cli`
- **Support Level:** `documented`.
- **Tier:** 2.
- **Headless run:** `gemini -p`
- **Headless QA:** none: `-p` does not run a skill command.
- **Facts from:** `google-gemini/gemini-cli` v0.68.0 and its docs, read on 2026-11-14. Gemini CLI was not run with a prompt. Since 2026-06-18 it serves only paid API keys and Code Assist licences; free and Google AI Pro or Ultra accounts moved to Antigravity ([antigravity.md](antigravity.md)).
- **Executors:** building, a headless run in a worktree the Chief of Staff makes ([HARNESSES.md](../HARNESSES.md#a-headless-run-in-a-worktree)); analysis, a sub-agent; QA, a session the human starts.

## Verbs

- `spawn`: `gemini -p "<brief>" -m <model> -o stream-json --include-directories <run folder>` in the worktree, in the background, with the approval mode the human approved (`--approval-mode yolo` to commit and push unasked), and output to `delegations/<id>/output.jsonl`. The handle is the session id in its `init` event.
- `message`: `gemini -r <session-id> -p "<text>"` from the worktree.
- `await`: the process's end.
- `report`: the report file, which `--include-directories` makes reachable.
- Analysis: a `codebase_investigator` or `generalist` sub-agent, which blocks until it returns.
- A QA Delegation: a session the human starts with `gemini` in its worktree, where the human types `/qa-plan <n>` and later `/manual-qa <plan file>`.

## Limits

- Gemini CLI reads `.agents/skills`, not `.claude/skills`: the skills need a copy there, which the Dispatch Plan names for the human to approve.
- `-p` does not run a skill command, so every QA Delegation is a session the human starts and types the two commands in.
- Its sub-agents block the Chief of Staff until they return, and cannot run side by side.
- The human cannot open a headless run while it works.

## Check before use

- Whether Gemini CLI honours `disable-model-invocation`.
- Whether `-w` worktrees, which it makes under `.gemini/worktrees/` inside the checkout, can be kept out of the Chief of Staff's checkout; until then, make the worktree by hand.
