# Google Antigravity

- **Id:** `antigravity`
- **Support Level:** `verified`. It rests on `/orchestrate #378 #389` on `mnaimfaizy/agent-kit`, 2026-11-26 (run `2026-11-26-378-389`, autonomous): two sequential waves of `self` sub-agents on model `flash` in isolated `branch` worktrees built, fixed and reported through it (`d389` landed pull request 540 after three review rounds and one scope-fence Decision Request; `d378` landed pull request 542 after two review rounds), both merged by the maintainer, with the Run Record derived and uploaded to the `github` sink. Its Activity Log is in that run's folder, which is not committed.
- **Tier:** 2. Its documentation also describes tier 1 behaviour (sub-agents in worktrees of their own that the human can type into while they work), not yet confirmed.
- **Headless run:** `agy -p`
- **Headless QA:** yes, else a session the human starts.
- **Facts from:** antigravity.google docs, App 2.32.0 and CLI `agy` 1.5.8, read on 2026-11-14. Each fact marked "(seen in the 378-389 run)" was seen in `/orchestrate #378 #389` on `mnaimfaizy/agent-kit`, 2026-11-26 (run `2026-11-26-378-389`, PRs 540 and 542), and is recorded in its Activity Log.
- **Executors:** building and analysis, a sub-agent in its own worktree; QA, a headless `agy` run in a worktree the Chief of Staff makes ([HARNESSES.md](../HARNESSES.md#a-headless-run-in-a-worktree)), else a session the human starts.
- **Notify:** none known: the sources in **Facts from** name no way for the Chief of Staff to notify the human. A queued question waits in its session and on the board.

## Verbs

- `spawn`, for building: call `invoke_subagent` with `TypeName: "self"`, `Workspace: "branch"`, and `Model` set to the plan's tier (`flash`, `pro`, or `inherit`). Antigravity creates an isolated worktree under `<appDataDir>/worktrees/<parent-conv-id>/subagent-<sanitized-role>-<type>-<hash>` on a branch of the same name, separate from the Chief of Staff's checkout (seen in the 378-389 run). The brief's first step is still `git switch -c <branch>` so the work lives on the Delegation's named branch. The handle is its role name and `conversationId`.
- `message`: call `send_message` with the sub-agent's `conversationId`; that wakes an idle sub-agent cleanly for send-backs and review rounds (seen in the 378-389 run).
- `await`: end the turn with two parts armed:
  1. **Sub-agent result message:** a sub-agent's message wakes an idle Chief of Staff immediately (seen in the 378-389 run).
  2. **The heartbeat:** one recurring `schedule` task (`CronExpression: "*/10 * * * *"`), which fires in an idle Chief of Staff, self-re-arms across long waits, and is cancelled when parked for merge or at close-out via `manage_task` `kill` (seen in the 378-389 run). Record its task id on the board.

  A wait on CI or a review workflow run can use `gh run watch <id> --exit-status` as a background `run_command` (with `NotificationTimeoutSeconds`), which wakes the Chief of Staff as soon as the run finishes (seen in the 378-389 run).

- `report`: sub-agents can write directly to `<run folder>/delegations/<id>/` (`report.md`, `decisions.md`, `activity.md`, `events.jsonl`) by absolute path without fallback, and also deliver their report as their final message (seen in the 378-389 run).
- Analysis: the `research` sub-agent, which is read-only, or `self` with workspace `branch` for anything that runs code.
- A QA Delegation: `agy -p "<brief>" --model <model> --output-format json --add-dir <run folder>` in the worktree, then `agy -p "/qa-plan <n> [--answers <working_dir>/qa-readiness.json]" --conversation <id>`, and later `/manual-qa <plan file>`; print mode expands skill commands. Else a session the human starts in that worktree. With `go`, that is the typed route; with `go autonomous`, on a `stack` or a `url` target, the same session follows its brief instead, reading each QA skill's `SKILL.md` from the paths the brief gives, so no command is sent or typed. A `url` target runs from the brief too, with its hosts typed in the Dispatch Plan and relayed through the brief.

## Limits

- Models are tiers (`flash`, `pro`, `flash_lite`, `inherit`), not model ids: `models` names a tier.
- Ending a sub-agent (`manage_subagents` `kill` or `kill_all`) deletes its worktree permanently, so it pushes before it reports and the Chief of Staff leaves finished sub-agents idle until the human approves cleanup.
- The standard sandbox blocks network access and, on Windows, blocks `gh` config reads, `.git/` writes (`git fetch`, `git push`, `git merge --ff-only`, `git merge-tree --write-tree`), `bash.exe` in pytest, localhost socket/process-kill Node tests, and `records.mjs derive`/`upload`/`dashboard` (which call `gh`) (seen in the 378-389 run). Run each command that needs network, `gh`, or `.git/` writes as its own standalone `BypassSandbox: true` call; defer platform-blocked local test suites to CI where needed and state that honestly in the report.
- A sub-agent paused on a `BypassSandbox: true` approval prompt wakes nobody. When the call runs standalone, `manage_subagents list` reports `state: "waiting_for_input"`; when called in parallel with `write_file`, `manage_subagents list` masks it as `state: "running", stateDetail: "write_file"` (seen in the 378-389 run). Instruct Delegations to run `BypassSandbox: true` calls standalone, and have the heartbeat check `manage_subagents list` (and the sub-agent's `transcript.jsonl` if quiet) to surface permission waits.
- Antigravity did not auto-discover `.claude/skills` by default: adding `.agents/skills.json` pointing to `.claude/skills` (or copying skills to `.agents/skills` / `~/.gemini/config/skills`) enables discovery. Once discovered, it honours `disable-model-invocation: true` by keeping those skills off the model-invoked list while allowing explicit slash-command invocation (`/orchestrate`) (seen in the 378-389 run).
- Its browser drives the human's running Chrome after an **Allow** click, so the human is present for `manual-qa`.
- Remote Agents have no API or print mode and cannot reach local files or skills: never an Executor here.

## Check before use

- Whether a QA session accepts a host relayed through its brief: that it checks it again with `adapter.mjs host` before any sign-in, and holds its scenarios (never asks) when it refuses it. A harness whose session does not holds every scenario of a `url` target. Record what was found.
- Headless `agy -p` QA Delegations (the 378-389 run had no QA Delegations).
- Whether `invoke_subagent` takes an exact model id (the 378-389 run used tier `flash`).
- Whether the human can type into a running sub-agent, which would make it a tier 1 harness.
- Whether the harness can notify the human that a question is queued, and how: record what was found.
