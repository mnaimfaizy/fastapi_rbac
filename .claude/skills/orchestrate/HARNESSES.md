# The four verbs on each harness

The skill body speaks of four verbs only. This file says what they mean, how a run finds its **Harness**, and what every harness shares. How each verb works on one harness is in that harness's own file under [harnesses/](harnesses/): load only the file for the harness this run is on, once step 1 has named it.

| Verb      | What it does                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `spawn`   | Start an Executor on one brief, with the Dispatch Plan's model, in its own branch and working copy. Returns a handle. |
| `message` | Send text to a running or finished Executor by its handle: an answer, a nudge, a report sent back.                    |
| `await`   | Wait for the next event from any running Executor, on a primary event and a heartbeat, never on one signal alone.     |
| `report`  | How a Delegation's report reaches the Chief of Staff.                                                                 |

**`report` is a file on every harness.** A Delegation writes its report to `delegations/<id>/report.md` in the run folder ([RUN.md](RUN.md)), by the absolute path its brief gives (the run folder is gitignored, so it exists only in the Chief of Staff's checkout), and appends each Decision Request to `delegations/<id>/decisions.md`, then stops. The verbs only carry the signal that something was written. An Executor that cannot reach the run folder (one working from a clone somewhere else, or one whose harness refuses the write) ends its turn with the report or the Decision Request as its last message instead, and the Chief of Staff writes that into `report.md` or `decisions.md` before reading it.

**Every Executor works in its own branch and working copy**, never in the Chief of Staff's checkout: a separate worktree on the same machine, or a clone. Two Executors in one working copy overwrite each other.

## Waiting: an event and a heartbeat

The events `await` waits for are a report, a Decision Request, an end, or no sign of life. A harness's own signal for them is not enough on its own. It comes when a Delegation ends a turn, and a Delegation can end a turn before its report is final. It does not come at all for a Delegation stopped on a prompt, or for a wait on CI or a review that ends with nothing found. So every harness's `await` has two parts:

- **A primary event:** the harness's own signal, as its file names it: a session ending a turn, a process ending, a sub-agent's end announced.
- **A heartbeat:** a check that re-arms itself, every 10 minutes by default, whatever the turns between did. It catches what the event misses. SKILL.md step 6 says when it is armed and removed, and what each firing does.

A wake-up, from either part, means "something may have changed", never "a report is final". On each wake-up the Chief of Staff checks every Delegation the run waits on, not only `running` ones: any that is `running`, `waiting`, `reported` or `sent back`, and a QA Delegation still in progress, since a `reported` row can still be waiting on CI or a review run. For each it checks its `report.md` and `decisions.md`, its session or process, its pull request's checks and the review run. It does not stop at the one the wake-up named. A report is final only when its **Final:** line says `yes` ([BRIEF.md](BRIEF.md#report)).

Each harness file's `await` names its primary event and its heartbeat. On Claude Code (desktop and CLI) the heartbeat is a recurring scheduled task in the Chief of Staff's own session. On a harness whose file names no scheduler, the heartbeat is the **foreground watch**: the Chief of Staff does not end its turn while the run waits on a Delegation. Instead it runs a shell loop in the foreground that checks every 60 seconds. The loop returns as soon as any Delegation's `report.md` or `decisions.md` changes, or a pull request the run waits on changes state, or else at a cap of 10 to 15 minutes. The Chief of Staff acts on what changed, or on nothing, writes the board, and runs the watch again. The harness's own event, where it has one, is one more change the watch sees. How long a shell command or a turn may run on that harness is a **check before use** item until a run records it.

While the watch runs, the turn stays open, so the human has no prompt to answer at. A question for the human (every Decision Request in a relay run, or one queued in an autonomous run on a harness whose **Notify** is `none known`) is written whole in the Chief of Staff's session between two watches, and on the board. Then the watch runs again, and the other Delegations go on. To answer, the human stops its turn and answers there; the Chief of Staff acts on the answer and runs the watch again. The Dispatch Plan says so under **Harness limits**.

## The harnesses

| Id                    | Harness                                        | Tool signature: the session has…                                 | File                                                       |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `claude-code-desktop` | Claude Code, in the Claude desktop app         | a session tool that starts another session (`start_session`)     | [claude-code-desktop.md](harnesses/claude-code-desktop.md) |
| `claude-code-cli`     | Claude Code, in a terminal                     | Claude Code's tools, and no session tool                         | [claude-code-cli.md](harnesses/claude-code-cli.md)         |
| `cursor`              | Cursor, the editor or its `agent` CLI          | a Task tool whose sub-agent types include `best-of-n-runner`     | [cursor.md](harnesses/cursor.md)                           |
| `codex-cli`           | OpenAI Codex CLI                               | `spawn_agent`, `send_input` and `wait_agent`                     | [codex-cli.md](harnesses/codex-cli.md)                     |
| `copilot-cli`         | GitHub Copilot CLI                             | a `task` tool and `write_agent`                                  | [copilot-cli.md](harnesses/copilot-cli.md)                 |
| `gemini-cli`          | Gemini CLI                                     | `codebase_investigator` among its sub-agents                     | [gemini-cli.md](harnesses/gemini-cli.md)                   |
| `antigravity`         | Google Antigravity, the app or its `agy` CLI   | `invoke_subagent`                                                | [antigravity.md](harnesses/antigravity.md)                 |
| `devin`               | Devin CLI or Devin Desktop (formerly Windsurf) | `subagent_explore`                                               | [devin.md](harnesses/devin.md)                             |
| `opencode`            | OpenCode 2                                     | a `subagent` tool and a `shell` tool that runs in the background | [opencode.md](harnesses/opencode.md)                       |

The id is the value `harness:` and `executors.*` take in the config ([CONFIG.md](CONFIG.md#harness)).

### A harness file

`harnesses/<id>.md` opens with these bullets, each on its own line in this form, because `config.mjs` reads `Id`, `Support Level`, `Headless run` and `Headless QA`. A file without them is a problem every `check` reports, so the run stops until it is fixed:

- `- **Id:** \`<id>\``, the file's own name.
- `- **Support Level:** \`<level>\``, then what it rests on.
- `- **Tier:**`
- `- **Headless run:**` the command, or `none: …` when another harness cannot start one.
- `- **Headless QA:**` `yes` when that headless run can carry a QA Delegation, or `none: …`.
- `- **Facts from:**` where and when each fact was read.
- `- **Executors:**` building, analysis and QA.
- `- **Notify:**` how the Chief of Staff can tell the human a question is queued, or `none known`, with a **check before use** item ([below](#notifying-the-human)).

Then the sections `## Verbs`, `## Limits` and `## Check before use`. A draft for an unlisted harness follows the same form.

### Finding the harness

At step 1, `config.mjs check` prints `harness`: the candidates its environment variables point to (each harness's documented variable, in `HARNESS_ENV` there; Antigravity and Devin document none), and the harness the config pins, if any. A variable can leak into a terminal inside an editor, or into a harness started by another, so a candidate is only a candidate. Then:

1. Compare each candidate with the tool signature above, against the tools this session actually has. The harness is the one candidate whose signature holds. With no candidate from the environment, the harness is the one row whose signature holds.
2. With `harness:` set in the config: when it names the harness found, go on. When it names another, raise a Decision Request with both and what each rests on, and go on only on the answer.
3. When no row holds, or more than one does, ask the human which harness this is, naming the candidates. Never guess: a wrong harness sends every Delegation down the wrong route.
4. When the human names a harness that has no file here, the run is on an **unlisted harness**: it runs on tier 3, at Support Level `documented`, and the Dispatch Plan says no harness file exists. The close-out offers to write one from what the run learned. Never invent an Executor for it.

State the harness, its Support Level and its tier in the Activity Log and the Dispatch Plan.

### Support Level

How far `orchestrate` has been proven on a harness. Each harness file gives its level, and what it rests on.

| Level        | Means                                                                |
| ------------ | -------------------------------------------------------------------- |
| `verified`   | A full run, from Dispatch Plan to close-out, passed on it.           |
| `tried`      | A run happened on it, and found gaps, named in the file.             |
| `documented` | Written from the harness's documentation alone; no run has tried it. |

Below `verified`, the Dispatch Plan opens with the level and what it means for this run, and waits for the human's "go" even when the invocation carried `go`. A level moves up only when a run's Activity Log records the evidence, and the change to the harness file cites that run.

### Facts and check before use

Each fact in a harness file is dated, with the version it was read at and where it was read. An item marked **check before use** was not confirmed there. The first run that relies on it checks it, and records what it found in its Activity Log; the close-out lists each one the run settled, so the harness file can be corrected.

## Tiers

**Tier 1: harnesses with Live Sessions.** The harness can start a separate session the human can open, read and talk to while it works, and tells the starting session when that session ends a turn. A tier 1 harness may also run tier 2 Executors, and a Live Session is preferred for a building Delegation: the human can open it to watch or steer.

**Tier 2: harnesses that start and poll.** The harness can start a headless run in the background and resume it later, but the human cannot open it while it works.

**Tier 3: harnesses that run sequentially.** The harness has no way to start another agent, in the background or otherwise. An unlisted harness is run as tier 3.

- `spawn`: the Chief of Staff writes the brief to the run folder and asks the human to start a new session on it, in a new worktree, with the plan's model. The handle is the human's name for that session. One building Delegation runs at a time, whatever `limits.building` says.
- `message`: the Chief of Staff writes the text for the human to paste into that session.
- `await`: the human says when the session has written its report. There is no heartbeat: the human is the event.
- `report`: the report file.

The Chief of Staff still never does a Delegation's work itself, here least of all: running a Delegation in its own session would mix the work it must verify with the session that verifies it.

## A headless run in a worktree

Most harnesses run a building or QA Delegation as a headless run of their CLI. Where a harness file says so, the run takes this shape:

- **The Chief of Staff makes the worktree itself**, `git worktree add -b <branch> <path> <base>`, outside any folder the harness cleans up, and starts the headless run inside it. That names the branch and the path, which a harness's own worktree flag may not.
- **Its output goes to the run folder**, `delegations/<id>/output.*` by its absolute path, and its handle is the session id that output carries, with the process id.
- **Push early, and write the report by its absolute path.** The harness file names the flag or allow rule that lets the run write to the run folder, and the permission it needs to commit and push; both are the human's choice, in the Dispatch Plan.
- **A sub-agent that shares the Chief of Staff's checkout** serves only an analysis Delegation that writes nothing but its report. A Delegation that runs code or edits files is a headless run.
- **The Chief of Staff watches CI and review comments itself**, with `gh`, unless the harness file says the harness delivers them.
- **The skills must be where the harness looks.** Where the harness needs a copy of `qa-plan` and `manual-qa` somewhere else, or a setting that keeps them user-invoked, installing it is a persistent change: the Dispatch Plan names it and the human's "go" approves it.

## Executors on another harness

By default every Executor runs on the Chief of Staff's own harness. The config's `executors` may name another harness for one kind of Delegation (`build`, `analysis` or `qa`), for example a Cursor Chief of Staff whose building Delegations run as Claude Code CLI headless runs. Then:

- The Delegation uses that harness's headless run, from that harness's file, started from the Chief of Staff's shell. Only a harness with a headless run can be named: a sub-agent or a Live Session belongs to the session that starts it.
- That harness's CLI must be installed and signed in: check it (`<cli> --version`) at step 1, and treat a failure as a config problem.
- `models` for that kind of work names a model on that harness. The Dispatch Plan shows each Delegation's harness beside its model, for the human to confirm.
- Its Support Level and Limits join the Dispatch Plan's, and the lower Support Level of the two decides the warning.

## Cloud agents

Codex Cloud, the Copilot cloud agent, Devin Cloud, Cursor Cloud Agents and Antigravity Remote Agents can neither reach the run folder nor the local QA Stack, and none tells a local Chief of Staff when it ends. They are never a default Executor. A Dispatch Plan offers one for a building Delegation only when the human asks for it, to answer its own pull request's review. Jules, Google's cloud agent, closes on 2026-12-31 and is never one.

## Choosing an Executor

| Delegation | Tier 1                                 | Tier 2                                          | Tier 3                     |
| ---------- | -------------------------------------- | ----------------------------------------------- | -------------------------- |
| building   | A Live Session                         | A headless run                                  | A session the human starts |
| analysis   | A sub-agent, or a Live Session if long | A sub-agent, or a headless run                  | A session the human starts |
| QA         | A Live Session                         | A headless run; else a session the human starts | A session the human starts |

A harness file's **Executors** line wins over this table where they differ. The Dispatch Plan names the Executor for every Delegation, and the human's "go" approves it.

A QA Delegation is never a sub-agent, on any harness: QA needs a working copy and a browser of its own, and outside an autonomous run, a sub-agent cannot take a user-invoked skill either. On every harness, the QA Delegation's session starts on its brief, never on a skill command, so the head is pinned before `qa-plan` runs. Then its QA skills start by one of two routes ([SKILL.md](SKILL.md) step 4):

- **With `go`, and for a `url` target in any run:** typed. Each command is sent to the session as a message where the harness runs that as the user's invocation, or typed there by the human. Where that is still **check before use**, the Dispatch Plan says the human may be asked to type `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]` (the `--answers` part only with an answers file for its base, [SKILL.md](SKILL.md) step 4), and later `/manual-qa <plan file>`, in that session.
- **With `go autonomous`, for a `stack` target:** from the brief. The session reads each skill's `SKILL.md` from the paths its brief gives and follows it, so how this harness runs a slash command does not matter, and nobody types one.

## Notifying the human

In an autonomous run, a question the Chief of Staff may not rule on is queued, and the run goes on ([SKILL.md](SKILL.md#autonomous-runs)). The human may be away, so the Chief of Staff tells them a question is waiting where the harness can, by the way its file's **Notify** line names. The notification says only that a question is queued, for which Delegation, and in which session: the question itself stays whole on the board and in the Chief of Staff's session, because a notification may be shown where others can read it.

Where the line is `none known`, the queued question waits in the Chief of Staff's session and on the board, and `--status` prints it. The Dispatch Plan for an autonomous run says so under **Harness limits**, so the human knows to look. A way to notify that a run finds is recorded in its Activity Log, and the close-out lists it with the other **check before use** items the run settled.

## The Harness limits section

Each harness file ends with its **Limits**: what the harness cannot do that a run would otherwise expect. Step 4 copies into the Dispatch Plan's **Harness limits** only the ones that bear on this run's Delegations (a QA limit only when the run has a QA Delegation), each with what the human will see because of it.
