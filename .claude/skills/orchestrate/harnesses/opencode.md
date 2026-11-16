# OpenCode

- **Id:** `opencode`
- **Support Level:** `documented`.
- **Tier:** 2, until a run confirms more. On OpenCode 2.3 or later it may be tier 1: each headless run is a session the human can open from the TUI, the desktop app or the web.
- **Headless run:** `opencode run`
- **Headless QA:** yes, else a session the human opens.
- **Facts from:** opencode.ai/docs and `anomalyco/opencode` (formerly `sst/opencode`) v2.3.0, source at commit `cbe7159`, read on 2026-11-14. OpenCode was not run with a prompt.
- **Executors:** building and QA, a headless run in its own worktree; analysis, the `subagent` tool; QA falls back to a session the human opens.

## Verbs

- `spawn`: from the repository root, `opencode run --worktree <id> --model <provider/model> --format json --title <id> "<brief>"` in the background, with stdout to `delegations/<id>/output.jsonl` and stderr, which names the worktree's path, to `delegations/<id>/run.log`. The worktree starts detached at the Chief of Staff's HEAD, so the brief opens with `git switch -c <branch> <base>`; then check `git -C <worktree> branch --show-current`. The handle is the `sessionID` in the first JSON line, with the worktree path.
- `message`: `opencode run --session <id> --format json "<text>"`, in the background.
- `await`: end the turn: a Chief of Staff in OpenCode is told when a background shell ends. Elsewhere, wait on the process.
- `report`: the absolute path; OpenCode allows writes outside the worktree by default.
- Analysis: the `subagent` tool with `explore` or a read-only custom agent; it takes messages running or ended, and tells the parent each time it goes idle. It shares the Chief of Staff's checkout.
- A QA Delegation: a headless run as for building, then a message that names the skill ("Load the `qa-plan` skill and run it for #<n>"), and later `manual-qa <plan file>`. Else a session the human opens (`opencode --session <id>`, or the desktop app), where the human types the two commands.

## Limits

- `--worktree`, its detached start and its startup script are in the source, not the documentation, so they may change without notice.
- On OpenCode 1 there is no worktree flag and `disable-model-invocation` is ignored: make the worktree by hand and run `opencode run --dir <worktree>`.
- OpenCode has no cloud agent, and nothing in it delivers CI results or review comments.

## Check before use

- Whether the human can type into a session while `run` drives it. If they can, OpenCode is a tier 1 harness for building.
- Whether a `--session` message to a session still working steers it or fails.
- Whether the background shell's end wakes an idle Chief of Staff.
- Whether naming a skill in a prompt, or attaching it through the API, loads it; in OpenCode 2, `disable-model-invocation` only hides a skill from the model's list.
- Whether the browser tool exists without the desktop app attached.
