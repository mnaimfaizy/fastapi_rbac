# Claude Code desktop app

- **Id:** `claude-code-desktop`
- **Support Level:** `verified`. The first run (`/orchestrate #274 #275` on `mnaimfaizy/fastapi_rbac`, 2026-11-13, ending in pull request 331) built and verified its work through Live Sessions, and stopped short of Ready to Merge only on the QA gaps fixed in `mnaimfaizy/agent-kit#179`. That run did not reach close-out, so this level rests on the maintainer's report of later runs passing end to end, not on a recorded Activity Log: it is held over from before Support Levels existed. The next full run records its run folder's Activity Log here.
- **Tier:** 1.
- **Headless run:** none: a Live Session belongs to the app. This harness can start the Claude Code CLI's (`claude-code-cli`).
- **Headless QA:** none: QA is a Live Session.
- **Facts from:** the session tools the app gives a session, as offered on 2026-11-13. The waiting facts (`await`, `message` and the Limits on them) come from the session tools offered on 2026-11-18 (`start_session`, `SendMessage`, `request_keep_awake`, `CronCreate`) and the Claude Code docs pages scheduled-tasks, desktop-scheduled-tasks, tools-reference, cross-session-messaging and desktop, read on 2026-11-18; Agent-kit's `docs/research/orchestrate-idle-chief-of-staff.md` cites each one.
- **Executors:** building, a Live Session; analysis, a sub-agent, or a Live Session if long; QA, a Live Session.
- **Notify:** a `PushNotification` tool, among the session tools the app offered on 2026-11-17: send it the Delegation's id and that a question is queued. Where the tool is not offered, a queued question waits in the session and on the board.

## Verbs

- `spawn`: start a new session with the brief as its first message, in its own worktree, with the plan's model. The handle is the session's id.
- `message`: send a message to the session by its id. A message is held, not delivered, when the two sessions are in different permission-mode classes (one bypasses permission prompts and the other does not) and the receiving session does not accept inbound messages (`crossSessionInbound`). The desktop app cannot show that dialog, so a held message is always dropped after about five minutes, whether or not the human is there. So before the first `message`, check which permission mode the Chief of Staff and each Delegation run in. The Dispatch Plan says whether messages between them would be held, and how the run avoids it: each Delegation started in the Chief of Staff's class where the app allows it, or the human's yes to accepting inbound messages, a persistent change.
- `await`: end the turn, with three things armed. The first wake-up of the three to come starts the next turn:
  1. **The app's own wake-up.** The app continues the idle Chief of Staff once a session it started, and any sibling still working, has ended its turn, quoting the start of the latest report. This is a turn-end, not a final report.
  2. **A `notify_when_idle` subscription** on each running Delegation: `SendMessage` to its `local_…` session id, with `notify_when_idle: true` and no message, which costs that session nothing. It is one notice, so arm it at `spawn` and again on every wake-up that finds that Delegation's report not final.
  3. **The heartbeat:** one recurring `CronCreate` task in the Chief of Staff's session, `*/10 * * * *` by default (every 10 minutes, starting up to 5 minutes late). Its prompt is plain text that says what each firing does (SKILL.md step 6), never `/orchestrate`, which a scheduled task cannot invoke because the skill is invoked only by the human. A recurring task expires after 7 days, so recreate it before then and record the new id on the board. Its id is what `CronDelete` takes at close-out.

  A wait on CI or the review is a capped background command, such as a loop on `gh pr checks` or `gh run watch` with its own time limit. It starts a turn when it exits. A wait that ends with nothing found is re-armed by that turn or, failing that, by the next heartbeat. It is never left ended.

- `report`: the session's report file, and its final message.
- A sub-agent, for an analysis Delegation: the in-session agent tool. Its result returns to the Chief of Staff when it finishes.
- A QA Delegation: start the session on its brief, and once its first phase has stopped, `message` it `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]`; later, `/manual-qa <plan file>`. With `go`, that is the typed route; with `go autonomous`, on a `stack` target, the same session follows its brief instead, reading each QA skill's `SKILL.md` from the paths the brief gives, so no command is sent or typed. A `url` target stays on the typed route.
- This harness may also run the Claude Code CLI's headless runs ([claude-code-cli.md](claude-code-cli.md)).

## Limits

- QA skills: a slash command sent as a message may not run as the human's own invocation. In the first run (2026-11-13), the QA session could not invoke `qa-plan` itself, and the human typed `/qa-plan <n>` there.
- The app's wake-up waits for sibling sessions still working. With two Delegations running, a short one's report may wait behind a long one, until the heartbeat or its `notify_when_idle` notice comes. Which sessions count as siblings is a check before use item.
- A Delegation stopped on a permission prompt wakes nobody: it has not ended its turn, and it is not idle. The heartbeat finds it as no sign of progress (SKILL.md step 6).
- A `notify_when_idle` subscription is dropped after 12 hours.
- Machine sleep stops every timer: the heartbeat, the capped waits and the app's own wake-ups. A closed lid still sleeps. For a run left unattended, the Dispatch Plan tells the human to turn on **Keep computer awake** (in **Settings > Desktop app**). Changing the setting is the human's to do.
- Every heartbeat firing is a short turn on the Chief of Staff's model over its whole context. A firing with nothing new logs one line and ends.

## Check before use

- Whether every turn-end of a Delegation wakes the Chief of Staff, or only the first. A run saw no second wake-up once a Delegation's first turn had ended (not yet confirmed).
- What "any sibling still working" covers in the app's wake-up: every session the Chief of Staff started, or only those started together (not yet confirmed).
- Whether a message that reaches the Chief of Staff as its own turn ends starts a new turn (not yet confirmed).
- That a session-scoped `CronCreate` task fires while the app is in the background or minimised (not yet confirmed; likely, since the session keeps running).
- That `notify_when_idle` reaches a session started with `start_session`, and that its notice starts a turn in the idle Chief of Staff (not yet confirmed).
- Which permission mode a session started with `start_session` runs in, and whether messages between it and the Chief of Staff are held.
- Whether a sub-agent can be sent a follow-up message after it finishes.
- Whether the app runs a slash command sent as a message as the user's own invocation. Try it; if the session does not run it, the human types it. Record which happened.
- Whether a `PushNotification` reaches the human when the app is in the background or closed.
