# The run folder

Where a run keeps its state, so that `--status` can print it and `--resume` can continue it. Load it before opening, updating or resuming a run.

## Layout

A run lives in its own folder inside the config's `run_dir`, which is gitignored:

```text
<run_dir>/<run>/
  board.md                  the board: one row per Delegation
  board.html                the live board, written beside board.md each time it is rewritten (private prose: never shared or hosted)
  activity.md               the Chief of Staff's Activity Log
  answers.json              the answers given in chat, when the config did not say
  qa-readiness.json         the QA readiness answers the Dispatch Plan asked for, the JSON object qa-plan's --answers takes, with a run-only change to the Places as its `report` key
  qa-readiness-<base>.json  the same, for a pull request with another base branch, once the human has answered for it
  qa-run.json               the run answers manual-qa's check --for run listed, asked in the same message, the JSON object manual-qa's --answers takes (approved QA only)
  events.jsonl              the Chief of Staff's Run Events, appended as each step happens
  rulings.md                the Ruling Ledger, in an autonomous run
  qa-hosts.json             the hosts the human typed in the Dispatch Plan, each with its `host` verdict and its environment's seeder answer, for a `url` target (approved QA only); never written to a config, and deleted at close-out
  qa-held.md                the QA held for you list, in an approved-QA run: each held item, with its row, evidence and options, and its answer once given (not Rulings, so not in the Ledger)
  evidence/                 command output a Ruling cites, one file each: R<n>-<k>.txt
  shared-board/<n>.md       in a Team Run, ticket <n>'s Shared Board row as this run last wrote it
  watch.gen                 on foreground-watch harnesses, monotonic generation id fencing the active watch; incremented before each watch and on --resume, deleted at close-out or park
  watch.pid                 optional PID of the active foreground watch process, cleaned up before a new watch and at close-out or park
  delegations/<id>/
    brief.md                the brief, as spawned
    activity.md             the Delegation's Activity Log
    events.jsonl            the Delegation's own Run Events
    report.md               its latest report
    decisions.md            its Decision Requests, appended, each marked answered when it is (by the human, or by a Ruling's id)
    qa-plan.md              a QA Delegation's QA Plan, as drafted, then as delivered
    qa-report.md            a QA Delegation's QA Report
    review-quotes.md        a QA Delegation's quote of each open Review box's file at its pinned head, each box marked literal, quoted or needs judgment
```

`<run>` is the date and the issue numbers, `2026-11-13-12-34`, with `.2`, `.3` added when that folder is already there (a dot, so a second run for #12 is never read as a run for #12 and #2). A spec run's `<run>` is the date and the spec, `2026-11-13-spec-50`, with the same `.2`. A Delegation's `<id>` is `d<issue>`, `d12`; a second Delegation for the same issue adds `-2`, a third `-3`, and so on: the next suffix not yet used in the run, so a restart never reuses a folder. A phase of a spec with no tickets is `d<spec>-p<k>`, `d50-p2` for its second phase ([SPEC.md](SPEC.md#phases)), the integration review of a spec run is `d<spec>-review` ([SPEC.md](SPEC.md#on-an-integration-branch)), and a fix Delegation on an integration branch, one that review's findings start included, is `d<spec>-fix<k>`. A QA Delegation is `d<issue>-qa` for the first QA of that issue's pull request, then `d<issue>-qa2`, `-qa3` for each later one, on a new head, the same one, or scoped to scenarios left for a person ([BRIEF.md](BRIEF.md#the-qa-brief)).

A Team Run adds `shared-board/`, holding the copy of each of this teammate's ticket rows as last written: a row is written only when its new rendering differs from that copy, and `--status` reads a row's age from it ([TEAM.md](TEAM.md#when-a-row-is-written)).

The Run Record is not in the run folder. It is derived at close-out into `<run_dir>/records/<run-id>.json`, a folder beside the run folders, so deleting or pruning a run folder leaves it ([Run Events and the Run Record](#run-events-and-the-run-record)).

Nothing in a run folder is committed. A brief or a log can quote issue text and command output the human has not chosen to publish.

## Board

```markdown
# Run <run>

Started <date>. Plan approved <date>. Approved routine writes: <list, or none>. Decision authority: <relay, or autonomous>.

QA readiness: <none needed; or for <base>, this run only, or saved to <config> (uncommitted); and each other base answered>.

QA: <none proposed; approved for <rows>; declined in the Dispatch Plan for <rows>; or, in a run with plain `go`, not asked>.

Heartbeat: <id, interval, made <time>; `foreground watch`, where the harness has no scheduler; none yet; deleted <time>; or none on tier 3>.

Default branch: <name> at <SHA>, checked <time>; passed: <Delegation>@<head>, …, or none.

Spec #<n>, <shape>. Landing: <landing>. Integration branch: <name> at <SHA>, pushed: <no, or why>.

Team Run: <tracker>, as <login>, on <remote>. Support Level: <level>.

Shared Board labels: not held, <why>.

| Delegation | Issue | Kind     | Executor     | Handle   | Model | Wave      | Branch | Pull request | State    | Decision Requests |
| ---------- | ----- | -------- | ------------ | -------- | ----- | --------- | ------ | ------------ | -------- | ----------------- |
| d12        | #12   | building | Live Session | <handle> | <m>   | 1         | <b>    | <URL>        | verified | R1 unreviewed     |
| d12-qa     | #12   | qa       | Live Session | <handle> | <m>   | after d12 | <SHA>  | <URL>        | running  | none              |

## Not delegated

- #34: `ready-for-human`, listed for the human.
```

The `QA readiness` line is there only when the run has a QA Delegation. It names the base branch the answers in `qa-readiness.json` hold for, so a QA brief for a pull request with another base gives no answers file ([SKILL.md](SKILL.md) step 4). In `qa-readiness-<base>.json`, a `/` in the branch name is written `-`.

The `QA` line is there only when the run has a QA Delegation proposed by the config, and records the QA yes of a `go autonomous` run ([SKILL.md](SKILL.md) step 4): the rows approved, and the rows that were not, as `QA declined in the Dispatch Plan`. A declined row has no QA Delegation, and the close-out prints the same words beside it, so the board and the close-out both show that no QA ran by the human's choice. `--resume` and `--status` print it.

The `Heartbeat` line is the check that re-arms itself while the run waits on a Delegation (SKILL.md step 6), so `--status` shows whether one is armed and `--resume` knows what to arm again.

The `Default branch` line is the default branch's tip at the last check of it: written at SKILL.md step 8 the first time, once every verified branch has been test-merged into that tip, and after that only at each [default-branch check](SKILL.md#the-default-branch-check). It is the baseline for "the tip has moved since", which decides whether the check re-gates the merge result. Its `passed` list names each row that passed at that tip, with the head it passed at: step 8 names only a verified branch whose head already contains the tip, and each check names only the rows that passed it. A row it does not name at its current head (one taken off the list, verified since, or pushed to since it passed) is re-gated at its next check, even when the tip has not moved. Before step 8 it reads `none yet`.

The `Spec` line is there only in a spec run, and its integration branch only with that landing. In that landing, a ticket's **Branch** cell also gives the commit it was cut at, and once it has landed, its landed commit, and its **Pull request** cell is `none`: its work lands through the integration branch, which has a row of its own once its pull request is open ([SPEC.md](SPEC.md#on-an-integration-branch)).

The `Team Run:` line is there only in a Team Run ([TEAM.md](TEAM.md#find-the-tracker)): the tracker the run reads and writes through, this teammate's login, the remote the run fetches and pushes on (`<remote>`, the one `check` reported or the human named), and the tracker file's Support Level. `--resume` and `--status` load TEAM.md when a board has it. The `Shared Board labels:` line under it is there only once a state label write did not hold ([TEAM.md](TEAM.md#states-and-labels)). A Team Run's board also records, under the table, the plan's three lists (Teammates' tickets, `unassigned`, needs one assignee), and, beside each of this teammate's tickets, the row comment that is its Shared Board row, once written: `Shared Board row: #<n> comment <id>` ([TEAM.md](TEAM.md#when-a-row-is-written)). A re-created row's new id replaces the old.

The **Decision Requests** cell lists each open question by its heading, and in an autonomous run each Ruling for the Delegation by its id and verdict (`R1 unreviewed`, `R3 needs re-review`), so the board shows what still waits on the human: a queued question, or a Ruling not yet upheld.

A QA Delegation's **Branch** cell is the full head it is pinned to, and its **Pull request** cell is the pull request it tests. Its earlier rows stay on the board, `void` or `failed`, so each QA run on the issue is visible.

The **Handle** is what `message` and `await` need to reach the Executor again: a session id, a process id with its output file, or a sub-agent's name ([HARNESSES.md](HARNESSES.md)). The board is rewritten whole on each change, never edited in part, so an interrupted write leaves the last whole board in place: write the new board beside the old one, then rename it over the old one. Each time it is rewritten, `board.html` is written beside it ([The live board](#the-live-board)).

## States

| State                    | Means                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned`                | In the approved plan; not started.                                                                                                                                                                                                                                                                                                                                                 |
| `parked`                 | Waits for another Delegation's branch to be merged, or landed on an integration branch (an overlap or a blocker), then starts from there; or a started QA session waiting for its head, idle until the Chief of Staff messages it.                                                                                                                                                 |
| `running`                | Spawned, and working.                                                                                                                                                                                                                                                                                                                                                              |
| `waiting`                | Stopped on an open Decision Request; at close-out, a row of an approved-QA run with held QA items still unanswered in `qa-held.md`, listing them in its Decision Requests cell; a row the default-branch check found `BEHIND`, or whose re-gate on the merge result failed, included.                                                                                              |
| `reported`               | Has written a report; not verified yet.                                                                                                                                                                                                                                                                                                                                            |
| `sent back`              | Its report did not hold, or its QA failed and the human chose to send it back; the Delegation has been told what was found.                                                                                                                                                                                                                                                        |
| `verified`               | A building Delegation whose report held and whose branch merges cleanly (step 8), waiting on its QA.                                                                                                                                                                                                                                                                               |
| `stalled`                | Nudged once, still stuck, and raised to the human.                                                                                                                                                                                                                                                                                                                                 |
| `crashed`                | Its Executor ended without a report; its branch and worktree are kept as the handoff.                                                                                                                                                                                                                                                                                              |
| `analysed`               | An analysis Delegation whose evidence and options are verified and relayed.                                                                                                                                                                                                                                                                                                        |
| `landed`                 | A spec run on an integration branch: verified, and fast-forwarded into the integration branch.                                                                                                                                                                                                                                                                                     |
| `passed`                 | A QA Delegation whose QA Report for its head is verified, with every scenario passed, or each left for a person passed or waived; or whose `qa-plan` found no Residue, with its claims checked.                                                                                                                                                                                    |
| `failed`                 | A QA Delegation whose verified QA Report has a FAIL or a _Stop and do not merge if_ outcome.                                                                                                                                                                                                                                                                                       |
| `void`                   | A QA Delegation whose pull request's head moved before or after it ran; its result says nothing about the new head.                                                                                                                                                                                                                                                                |
| `awaiting Ruling Review` | An autonomous run: meets every other condition of Ready to Merge, with a Ruling for it still `unreviewed` or `needs re-review` in the Ruling Ledger.                                                                                                                                                                                                                               |
| `ready to merge`         | Ready to Merge: CI green, review settled (with a review workflow, its run on this head included), QA requirement met on its current head, Rulings upheld or overturned with their rework verified, merges cleanly into the default branch as it now is, and is not behind it where the repository requires branches to be up to date, unless the human chose to merge it as it is. |
| `merged`                 | The human has merged it.                                                                                                                                                                                                                                                                                                                                                           |
| `dropped`                | Taken out of the run on the human's yes.                                                                                                                                                                                                                                                                                                                                           |

## Ruling Ledger

In an autonomous run, `rulings.md` is the run's Ruling Ledger: every Ruling, in the order made, newest last ([SKILL.md](SKILL.md#autonomous-runs)). An entry is appended when its Ruling is made, and only its **Verdict** and **Commits** lines change after that, each change logged in the Activity Log. A run with Decision authority `relay` has no ledger.

```markdown
### R<n>: <one-line question>

**Delegation:** <id>, for #<issue>
**Question:** <the Decision Request, whole, or the stall, crash, conflict or QA result it answers>
**Options:**

1. <option>: <what follows from it>
2. <option>: <what follows from it>

**Choice:** <option number>, because <reason>
**Evidence:** <for each claim: `path:line` at a commit SHA, a file under `evidence/`, a tracker permalink, or a Ruling id>
**Cites:** <earlier Rulings by id, or none>
**Commits:** <each commit that followed from it, from the Delegation's verified report; or, where none exists, read from the branch (`git log <merge-base>..<head>`) and its Activity Log, each marked `(read from the branch, not reported)`; or none yet>
**Verdict:** <unreviewed | upheld | overturned → option <k> | needs re-review>, <date, and the human's words when they gave one>
```

The verdicts:

- `unreviewed`: as made; the human has not answered it.
- `upheld`: the human upheld it.
- `overturned`: the human overturned it, and the option they chose is its answer. Every Ruling whose **Cites** line names it becomes `needs re-review`.
- `needs re-review`: it cited a Ruling since overturned, and waits for the human again. It is not overturned with the one it cited.

## The live board

`board.html` is the live view of a run: a page the human opens from the link given at `go` and `go autonomous`, and leaves open. The Chief of Staff writes it each time it rewrites `board.md`, by running `node <skill>/records.mjs board <run-folder> --heartbeat <minutes|none>`, which prints the `file://` link. It writes the page beside the old one and renames it over, as the board is written, so a reader never sees half a page. It is a file, not a server, so it works in every harness, and it reloads itself about every 15 seconds.

- **Columns.** Planned, Needs you, Running, Checking, Landed and Merged. A Delegation is a card in the column its state belongs to; with a wait on the human open on it, it is in Needs you instead. A wait on a teammate's ticket (`teammate-blocker`) waits on nobody in this session: it is never in Needs you, never counted in the banner, the tab title or the favicon, and raises no notification. It parks the card (`parked`, in Planned), which shows it as `Parked on #<n> (@<login>)` with its age, until the blocker merges. A parked Delegation that then opens a wait on the human is `waiting`, in Needs you, and is `parked` again once that wait closes. The card shows its exact board state, how long it has been in it, and a badge for each Ruling (`R1 unreviewed`). A wait of the run, with no Delegation (the plan's approval, a review label, the merge, close-out), is a card of its own in Needs you.
- **What waits on the human.** A banner and the Needs-you column give each open wait its cause chip, its `how` (the chat, a card id, GitHub) and its age. A card that `board.md` puts in Needs you with no wait open (`stalled`, `crashed`) is listed in the banner too, with its state. The banner, the tab title, the favicon and the notifications count the same list, so they never disagree with the column. A Recent Run Events feed sits beside the board.
- **The drawer.** A click on a card opens that Delegation's facts (including whether it started from a card), its states with durations, its waits, its Rulings, its Run Events and its Activity Log. The address `#open=d:<id>` opens it, and `#open=r:<id>` opens a Ruling.
- **Rulings.** In an autonomous run only, a Rulings section counts those still unreviewed, and each Ruling opens in the drawer with its question, options, choice, reason, evidence, cites and verdict history. The board is read-only: a verdict is given in the Chief of Staff chat.
- **Where its data comes from.** The Run Events of this run folder (the Chief of Staff's and each Delegation's), the State column of `board.md`, the Ruling Ledger and the Activity Logs, all from this folder. The page never reads a Sink or the tracker.
- **Stale.** A run that is quiet is not a run that stopped. The page compares the last Run Event, a `heartbeat` event included, with the heartbeat interval, and says so when the last one is older than two intervals (one missed firing is allowed). The interval is the one on the `Heartbeat` line, 10 minutes by default ([HARNESSES.md](HARNESSES.md#waiting-an-event-and-a-heartbeat)). With no heartbeat armed, or once the run is closed, it says nothing. The page checks this against the clock of the browser, so a page left open still warns when the Chief of Staff has stopped writing it.
- **Team Run and closed runs.** In a Team Run the board links to the Shared Board, on the spec's issue, and does not copy it: teammates' state has one source ([TEAM.md](TEAM.md#the-shared-board)). Once the run is closed, it links to the run's page in the dashboard (`<run_dir>/dashboard.html`), once `--dashboard` has built it.
- **Never hosted.** The drawer shows the Activity Logs, which are private prose, so the page says it holds them and carries every credential of the environment redacted. It stays on the machine: a hosted board would be an upload, with its disclosure, and none exists. Do not share the file.

### The optional server

`board.html` moves only when the Chief of Staff writes it. Where a process can run, the human may start a server that updates the board to the second. Nothing needs it: the run never waits on it, no step of the skill starts it unasked, and the file board works without it.

```bash
node "<skill>/records.mjs" serve <run-folder> --heartbeat <minutes|none>   # prints http://127.0.0.1:<port>/
```

Run it from the repository's root. It takes a free port, or the one `--port <n>` names, and runs until it is stopped (Ctrl-C).

- **Local only.** It binds to 127.0.0.1 only, answers `GET` and `HEAD` requests made to that address or to `localhost` and no others, and sends no CORS header, so a page of another site cannot read it. While it runs, any program or account on the machine can open it, and it serves the Activity Logs, with the credentials of the server's own environment and the usual token shapes redacted; a secret only another environment holds, in no such shape, is not. Never forward the port or put the server behind a proxy: the board is never hosted.
- **What it pushes.** It watches the run folder's events files, the Chief of Staff's `events.jsonl` and each Delegation's, including one made after it started, and pushes each newly appended Run Event to the connected page, which reloads. So a Delegation's own steps show between the Chief of Staff's wake-ups, for every Delegation that writes its events into this run folder. The page also reloads about every 15 seconds, for what no event carries: the State column of `board.md`, the Ruling Ledger and the Activity Logs. Staleness is judged with the `--heartbeat` the server was started with.
- **Notifications.** The page offers a button, "Notify me of new waits". Once the human clicks it and the browser allows it, a wait opened afterwards raises a browser notification.
- **`/dashboard`.** The past-runs dashboard, built again on each request from the local records and the Sink's records an earlier `--dashboard` build cached. It reads no Sink and no tracker, so it can lag the Sink and tags no record "not uploaded"; `--dashboard` fetches what is new. It writes no file, and takes neither `--repo` nor `--local-logs`. A closed run's served board links here.
- **When it stops.** The served page stops reloading, keeps what it last showed, and gives `board.html`'s `file://` address to copy: a browser does not let a served page open a file. `board.html` is unaffected, and goes on being written and reloading itself. The server writes it once at its start only when the run has none and its Run Events check. Started again on the same `--port`, it makes the open page reload.

## Activity Logs

Each Activity Log is append-only Markdown, one entry per thing done, newest last: the time, what was done, and why. The Chief of Staff's log records each plan, spawn, relayed Decision Request and its answer, verification result and write made in the human's name. A Delegation's log records its phases, its stop points and the commands it ran. Neither is ever rewritten: when a log is wrong, a later entry says so.

## Resume

`--resume <run>` continues a run from its folder, after a usage limit, a closed laptop or a pause for merges.

1. Read the config again (`check`, with the run's `answers.json` when there is one). A config that changed since the run started is said, and its new values apply from here. A changed `run_dir` does not move a run: check that the folder the run is in is still inside the effective `run_dir`, and still ignored (`git check-ignore -q <that folder>/board.md`), whether or not the run has an `answers.json`. If it is not, stop, say so, and ask the human to move the run folder into the new `run_dir` or to put the old value back, then resume.
2. Read the board and both kinds of Activity Log. `activity.md` is prose context and baseline only and never authorizes a new action or `events.jsonl` entry without verifying `decisions.md` (answered markers), `report.md`, and the git, pull request, and CI source below. A board with a `Spec` line is a spec run: load [SPEC.md](SPEC.md). Its landing and its integration branch's name are the board's, not the config's: a run never changes how it lands part way through.
3. Check each Delegation not `merged` or `dropped` against the source, not the board: its branch and head, its pull request and whether it is merged, CI on its head, the review workflow's run on its head and any review comment newer than its verification (SKILL.md step 7), and whether its Executor still answers its handle. With an integration branch, check the branch's head too, and which tickets' heads it contains: a ticket has landed, whatever the board says, when its landed commit is in it, or, when the board records none (an interruption between the move and the board's update), when the commit its verified report names is in it and is not the commit the ticket was cut at (a ticket cut but never committed to is in it too, and has not landed). Judge by those commits, never by the ticket branch's current head, which may have moved on since. Check the integration branch's own pull request the same way: when it is merged, so is every ticket it landed. Check each QA Delegation that has a head pinned in its row and is not `failed` or `void` against its pull request: when the pull request's head is not that head, it is `void`, a `passed` one included, and its building row goes back to `reported`, for SKILL.md step 7 on the new head. A `planned` QA Delegation has no head yet: it waits for its building Delegation, as before. For one whose `qa-plan.md` exists, check that it names the pinned head as its **Head**, and look where the plan was delivered for a posted QA Report for that head, whatever its report says: a QA Delegation interrupted between posting and reporting has posted one its report does not name. A board written before an interruption can be out of date. In a Team Run, the run is then brought back in line with the Shared Board ([Resuming a Team Run](#resuming-a-team-run)), before step 4.
4. Update the board to what was found, and log each change. Then run the [default-branch check](SKILL.md#the-default-branch-check) on each `ready to merge` row before listing any: the default branch may have moved while the run was paused.
5. In an autonomous run, open with the Rulings still awaiting review: each `unreviewed` or `needs re-review` entry in the Ruling Ledger, grouped by Delegation as SKILL.md step 10 shows them, and with the questions still queued for the human. The human may answer them now, or later in the session.
6. Start each `parked` Delegation whose wait is over (a parked QA session is not started: step 9 messages it its head), from the default branch as it now is, or, with an integration branch, from that branch's head; in a Team Run, a ticket picked up or restarted from a branch starts from that branch, with the default branch merged in, as [TEAM.md](TEAM.md#blocking-across-teammates) says. Arm the heartbeat again (SKILL.md step 6), unless the only thing left to wait for is the human's merges, or the run is on tier 3. A `reported` or `waiting` row with a wait on CI or a review still needs it. The board's id may name a task that is gone, or one that outlived the old session, so check it first with the harness's own list of scheduled tasks, and make a new one only when it is gone. Then re-arm each wait the old session held, such as a subscription on a Delegation or a capped wait on CI: a background command does not survive a resume. Record the new id on the board; on a foreground-watch harness, increment `watch.gen` and clean up any stale `watch.pid` before launching the watch so any orphaned watch exits and late output is dropped; and continue the loop from SKILL.md step 6.

A Delegation whose Executor no longer answers, and whose work did not finish, is `crashed`: its branch is the handoff, and the human decides whether a new Delegation picks it up.

### Resuming a Team Run

A board with a `Team Run:` line is a Team Run ([TEAM.md](TEAM.md#find-the-tracker)): load TEAM.md, [TRACKERS.md](TRACKERS.md) and the tracker file the line names. The run's `<remote>` is the one the `Team Run:` line names, read when step 2 reads the board: before step 3, and before any fetch or push the resumed run makes. So a remote the human named at the start holds, and a null `remote` from `check` is not asked again. When the line's remote is no longer among the repository's remotes (`git remote`), that is the Decision Request of [TEAM.md](TEAM.md#find-the-tracker), raised before anything is fetched or pushed, and the remote the human names replaces it on the line. When `check` reports a remote other than the line's, such as an `origin` added while the run was paused, that is said and logged in the Activity Log, and the line's still holds. People may have changed the tracker while the run was paused, so after step 3, and before step 4 updates the board, the run is brought back in line with the Shared Board. This part only reads the tracker: what it finds is logged in the Activity Log and acted on as below, and every write it leads to is made later, under TEAM.md's rules.

- **Who this is.** Read the login with the `viewer` operation. When it is not the one the `Team Run:` line names, stop and say so: the tracker is signed in as someone else, and no row is read or written until it is this teammate again.
- **Every assignee, again.** Read every ticket in the run and in the spec with `spec-tickets`, with its assignees and its state label: one read, since a ticket may have joined the spec, or been assigned, while the run was paused. Each open ticket goes in the group [TEAM.md](TEAM.md#whose-tickets) gives for its assignees, and step 4 writes the board's three lists again to match.
- **Assigned away while paused.** A ticket of this run, not `merged` or `dropped`, whose single assignee is no longer this teammate raises the hand-off Decision Request, as [TEAM.md](TEAM.md#reassignment) says: hand it off, or ask for it back. One already open for it in its `decisions.md` is not raised twice. Nothing is written on the ticket while it waits, its Delegation is never stopped unasked, and a `planned` one is not spawned. A ticket assigned away and back while paused, whose single assignee is this teammate again, raises nothing.
- **Newly assigned to this teammate.** An open ticket of the spec whose single assignee is now this teammate, and that this run does not hold (not on its board, or there only as `dropped`), is never added silently. It is shown as an **amended Dispatch Plan** for just those tickets: a row each, as [TEAM.md](TEAM.md#the-dispatch-plan) gives the plan's rows, with its wave and what it is parked on, and, for a ticket handed off to this teammate, `picked up from @<previous> at <branch>@<head>`, read as [TEAM.md](TEAM.md#picking-up-a-handed-off-ticket) says. It changes neither the run's landing, its Decision authority nor its approved routine writes, which cover the added tickets. It needs its own "go": until then nothing is spawned and nothing is written on those tickets, and the rest of the run goes on. On "go", they join the board as `planned` or `parked`, and their first row write follows; on a no, they stay out of the run, and the board says so.
- **Another run id on a row.** For each of this teammate's tickets in the run, read its row comments with the `row` operation. A row comment of this teammate's whose marker carries another run id raises the take-over Decision Request, as [TEAM.md](TEAM.md#two-runs-of-one-teammate) says: resume that run, or take the row over. Nothing is written on that ticket, and a ticket not yet spawned is not spawned, until it is answered.
- **A deleted row.** When `row` finds no comment carrying this run's id, and no row of this teammate's with another run id (that one is the take-over question above, and no second row is made beside it), for a ticket the board gives a `Shared Board row:` for, the row was deleted, or its marker edited away, while paused. It is re-created on the next write, as [TEAM.md](TEAM.md#a-persons-edits) says, and the new comment id replaces the old on the board. Nothing is written for that alone.
- **Parked tickets.** For each `parked` ticket, read `merged` for each of its blockers ([TEAM.md](TEAM.md#blocking-across-teammates)), so step 6 starts those whose wait is over.

Each Decision Request raised here is relayed as any other, whole, and is never a Ruling, in an autonomous run too. A run without a `Team Run:` line skips this part: its resume is as the steps above say.

### After a lost machine

When a teammate's run folder is gone, with a lost or wiped machine, there is no run to `--resume`. They start a **new Team Run**, `--spec <n> --team`, on any machine. It has a new run id and a run folder of its own, and plans as [TEAM.md](TEAM.md#the-dispatch-plan) says, reading each of their tickets' rows with the `row` operation before it is planned. Their old rows still carry the old run id, so the new run's plan adds:

- **Take the row over.** For each of their rows carrying the old run id, the plan raises the Decision Request of [TEAM.md](TEAM.md#two-runs-of-one-teammate): resume that run, or **Take the row over**. It recommends the take-over, since that run's folder is not on this machine, and is answered with the "go" or before it. On the take-over, the new run writes that comment, edited by its id, with its own run id in the marker; with several rows of old run ids on one ticket, the newest is the one taken over. On "resume that run", the ticket leaves this plan.
- **Restart from the branch head.** Each unfinished ticket, whose old row's fine state is not `merged` or `dropped`, is restarted as a new Delegation from its branch head, as a crashed Delegation's branch is picked up ([SKILL.md](SKILL.md#6-run-the-loop)): the branch the old row names, fetched and started on as [TEAM.md](TEAM.md#picking-up-a-handed-off-ticket) says for a handed-off branch, with the remote's head. What differs from a hand-off: the plan says beside the ticket `restarted from <branch>@<head>`; the brief says the branch carries the lost run's work, and names the ticket's pull request, when the row has one, to go on with; a branch the remote does not have was never pushed and is lost with the machine, so the plan says so and the Delegation starts from the default branch; a ticket the old row shows `planned` or `parked` is planned as new; and the row's next milestone is `restarted from <head>`.
- **Unreviewed Rulings.** The old run's Ruling Ledger is gone with its run folder, so its Rulings can no longer be reviewed from it. Read each of that teammate's pull requests in the spec, where `decisions.to` records Ruling lines (with `pull-request`, its body under "Decisions"; with `issue-comment`, its ticket's comments), and take every line that names this teammate's login and still says `Chief of Staff ruling, not yet reviewed`. Each is an open question for the human again: a Decision Request in the plan, with the line's id, question and choice, and two options, uphold it, or overturn it with an answer of their own. It is never a Ruling, in an autonomous run too, and the ticket is not Ready to Merge until it is answered. The new run has no ledger entry for the old id, so the answer is the human's ordinary answer to that Decision Request, recorded where `decisions.to` says, as any answer is: with `pull-request`, the Chief of Staff `message`s it to the ticket's new Delegation, which changes `not yet reviewed` in the line to `upheld`, or to `overturned → option <k>` with the human's answer beside it, keeping the old id; with `issue-comment`, the Chief of Staff drafts the updated line as a write as the human. An overturn is sent to the new Delegation as the human's answer, as rework, as [BRIEF.md](BRIEF.md#ruling) says for any overturn. Both runs write as the same login, and no two Ruling lines on one pull request may share an id. So the new run numbers its own Rulings from one past the highest `R<n>` among every Ruling line that names this teammate's login on those pull requests, reviewed or not, in place of SKILL.md's `R1`: with `R1` and `R2` found, its first is `R3`.

The board records the old run id beside each ticket taken over, and `restarted from <branch>@<head>` beside each ticket restarted from its branch, and the Activity Log each answer. Nothing else of the old run comes back: its briefs, reports, logs and evidence were only in its folder.

## Status

`--status [<run>]` prints the board of the run named, or of the run in `run_dir` whose board was written last, with each open Decision Request in full, and, in an autonomous run, the Ruling Ledger. Before printing, it runs the [default-branch check](SKILL.md#the-default-branch-check) on each `ready to merge` row, since the human has come back to the run and may be about to merge. It prints that check's result with the board. It writes nothing: not the board, its `Default branch` line or any row's state, and no other file in the run folder. It messages no Delegation, voids no QA, re-arms nothing, and raises no Decision Request. That is because a live Chief of Staff session may still hold the run: it may be invoked in another session while the run goes on, and a second writer to the board would lose one side's change. It is also why the run in `run_dir` whose board was written last stays the run the human was working on. A row the check would send back to step 7, whose head moved, or that needs a Decision Request is printed with what was found, and nothing records it. `--resume` step 4 runs the check again on every `ready to merge` row and acts on what it finds. Because the `Default branch` line is unchanged, it re-gates the same rows `--status` would have.

In a Team Run, `--status` also prints the whole spec from the tracker ([below](#in-a-team-run)). Someone with no run of their own prints the same from the tracker alone with [`--status --spec <n>`](#--status---spec-n).

### In a Team Run

`--status` of a run whose board says it is a Team Run ([TEAM.md](TEAM.md#find-the-tracker)) prints this teammate's own rows in full, as above: the board, each open Decision Request in full, the Ruling Ledger in an autonomous run, and the default-branch check's result. Then it prints the whole spec, as one blocking tree in merge order, read from the tracker the board's `Team Run:` line names, with the read operations of [TRACKERS.md](TRACKERS.md):

- `spec-tickets`, for every ticket of the spec, open or closed, with its assignees and its state label;
- `row`, for each ticket, with the row taken as [TEAM.md](TEAM.md#which-comment-is-the-row) says: only a row comment whose marker's `author` is its comment's own author counts; of those, the current assignee's newest is the row, or, with none, the newest of all, shown as stale;
- `blockers`, for each open ticket, keeping only the blockers that are tickets of the spec.

A ticket of this teammate's is printed from the local board, never from its row: the board is the record and the row its projection ([ADR 0015](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/adr/0015-the-shared-board-is-a-published-projection-of-each-local-run-folder.md)). Its age is read from the **Updated** time of its copy in the run folder, `shared-board/<n>.md`, which `--status` reads and never writes; with no copy yet, it has `no row yet`.

```text
Team Run · spec #253 · github, as @sam · read 2026-11-18 10:05Z · blocking tree, in merge order

Each teammate's last write: @alex 09:50Z, 15m ago (run 2026-11-17-spec-253) · @sam 10:01Z, 4m ago (this run)

#255 merged           @alex          #271   changed 13h ago
 └─ #258 running      @sam           none   changed 7m ago    yours
#256 ready to merge   @alex          #272   changed 15m ago   merging it unparks #259
 └─ #259 parked       @sam           none   changed 35m ago   yours; picked up from @alex at claude/issue-259-stage-variables@3f1e2aa
#257 waiting          @sam           #270   changed 4m ago    yours; 1 question waits on @sam
#260 no row yet       unassigned     none
#261 no row yet       @alex @sam     none                     needs one assignee

Next moves: @alex merges #272 · @sam answers 1 question on #257 · someone assigns #260 · #261 needs one assignee
```

- **The header** names the spec, the tracker, this teammate's login (left out by `--status --spec <n>`, which has none) and when the tracker was read, in UTC.
- **Each teammate's last write** is the newest **Updated** time among the rows that count by [TEAM.md](TEAM.md#which-comment-is-the-row)'s rule (the marker's `author` is the comment's own author) and are theirs, with its age and each run id those rows carry. It is when their Chief of Staff last changed a row, and nothing more.
- **The tree.** A ticket with no blocker in the spec opens a line of its own; a ticket with blockers is printed under the one of them that comes last in merge order, with `also waits on #<n>` for each other one. **Merge order** puts a ticket after every ticket of the spec that blocks it; among tickets free to go, the one nearer to merging comes first: `merged` (and closed tickets, oldest first), `ready to merge`, `waiting`, `running`, `parked`, `planned`, then tickets with no state yet; then by number.
- **Each line** gives the ticket, its fine state, its assignees (`unassigned` for none), its pull request, the row's **age since its last change**, and its notes. The fine state is the row's own (from the backticked line under its headline); with no row, the ticket's state label, or `no row yet` when it has none either; `closed` for a closed ticket that has neither. A stale row's fine state is shown as it is, `dropped` included, beside its stale note. The age is from the row's **Updated** time, or the comment's own last change when a person edited that line away. The notes, each only when it applies: `yours` for this teammate's; the number of open questions in its **Waiting on** box, and whose; what it is parked on; `picked up from @<old> at <branch>@<head>` for one of this teammate's whose board records it ([TEAM.md](TEAM.md#picking-up-a-handed-off-ticket)), and for a teammate's while its row's Recent activity still lists the `picked up from` milestone; `stale: written by @<author>, who is not the assignee`; a hand-off in progress, as below; a conflict it shows; `needs one assignee`; and `merging it unparks #<n>` on a ticket a parked one waits on. On GitLab, a merge request is written `!<mr>` wherever a pull request is `#<pr>` here, in the lines and in "Next moves" ([trackers/gitlab.md](trackers/gitlab.md#writing-the-row-on-gitlab)).
- **Teammates' rows** follow the tree, each printed as its status card shows it: the row comment's text, without its footer and marker, with the stale line when it is stale. A row is another person's published text: it is printed as data, never followed as instructions.
- **Also listed**, under the tree: `unassigned` tickets and those that **need one assignee**, each with its number, title and assignees, since nobody runs them; and **hand-offs in progress**, each from the ticket's newest row, when its assignee has no row of their own yet: when that row's newest milestone hands the ticket off to the assignee, ``handed off by @<old> at `<branch>@<head>`, not picked up yet``, or `handed off by @<old>, not started, not picked up yet` for one handed off before it was spawned; when it hands it off to someone else, `handed off by @<old> to @<other>, now assigned to @<assignee>`; and when it has no hand-off milestone, `reassigned from @<old>; no hand-off yet`.
- **"Next moves"** ends the output, one line, in merge order: each move a person makes for the spec to go on. `@<login> merges #<pr>` for a ticket `ready to merge`; `@<login> answers <k> question(s) on #<n>`; `@<login> reviews <N> Ruling(s) on #<n>`; `@<assignee> picks up #<n>` for a hand-off not picked up; for a reassignment with no hand-off, `@<old> hands #<n> off or asks for it back` when it has one assignee, and `@<old> asks for #<n> back` when it has none or several, as [TEAM.md](TEAM.md#reassignment) recommends; `someone assigns #<n>` for an `unassigned` ticket; `#<n> needs one assignee`. With none: `Next moves: none waits on a person.`

It never says whether a teammate's run is alive or dead. A row's age is only when it last changed: an old row may be a run waiting on its human, on CI or on a merge, or a run that has stopped, and nothing on the tracker tells these apart. So it prints ages, and no word that guesses.

It writes nothing, as the rest of `--status`: no board, no row, no label, no file (the run folder's `shared-board/` copies included), and no write operation of any kind. What it finds, a ticket assigned away or a row of another run, raises no Decision Request: it is printed, and the live Chief of Staff session, or `--resume`, acts on it ([TEAM.md](TEAM.md#ownership)). A tracker read that fails is printed with what the tracker said, in the place of what it would have shown, and the rest is printed.

### `--status --spec <n>`

`--status --spec <n>` prints the Shared Board of the spec `#<n>` for someone running nothing: a reviewer, the spec's owner, or a teammate with no tickets of their own. It reads only the tracker and needs no local run: it reads no run folder, makes no run folder, and works where its user has never run `orchestrate`.

1. Check which copy runs ([SKILL.md](SKILL.md#which-copy-runs)), and run `check` as SKILL.md step 1 does, for two facts only: its `tracker` report and `team.labels`. Problems stop it, as at step 1. A repository with no config file has none: the defaults hold. Its `readiness.needs` are not asked: nothing is run, and with no run folder there is nowhere to write answers.
2. Find the tracker as [TEAM.md](TEAM.md#find-the-tracker) says, and load [TRACKERS.md](TRACKERS.md) and that tracker's file. When the pin and the remote disagree, or no tracker is known, ask which one as a plain question: there is no run to hold a Decision Request. A null `remote` is not asked about: nothing here fetches or pushes.
3. Read the spec's tickets with the `spec-tickets` operation, each ticket's row with the `row` operation, and each open ticket's blockers with the `blockers` operation. Nothing else is read: no command outside the tracker file's, and no write operation.
4. Print as [In a Team Run](#in-a-team-run) says: the header, without a login, each teammate's last write, the tree in merge order with each row's age, every ticket's row as its status card shows it, the `unassigned` and needs-one-assignee tickets, the hand-offs in progress, and "Next moves" last. No ticket is `yours`, since no run is: there is no local board, no default-branch check and no Ruling Ledger, which stays in each teammate's own run folder.

When `spec-tickets` lists no ticket, it says that the spec has none the tracker file can read, so there is no Shared Board to show; on GitLab the spec lists its tickets as a task list in its description ([trackers/gitlab.md](trackers/gitlab.md#spec-tickets)).

It writes nothing: no row, no label, no file. It never says whether a run is alive or dead, as above.

## Run Events and the Run Record

Every step of a run is written as a **Run Event**, as it happens, to an events file in the run folder: `events.jsonl` for the Chief of Staff and one `delegations/<id>/events.jsonl` for each Delegation. At close-out the Chief of Staff derives one **Run Record** from them. The Activity Log stays as it is: it is the readable prose, and the events are the structured account beside it. Why: [DESIGN.md](DESIGN.md#run-events-and-the-run-record).

Both are written only with the records script, never by hand. It takes the time from the clock, so an event is never given a time and never back-dated, and it refuses a field outside its schema:

```bash
node "<skill>/records.mjs" event --file <run folder>/events.jsonl --kind <kind> --actor <human|chief-of-staff|delegation> [--<field> <value>]...
node "<skill>/records.mjs" derive <run folder>
```

`--file` is an absolute path for a Delegation, because its working copy is not the Chief of Staff's. Fields are written with a hyphen (`--wait-id`), lists are comma-separated (`--covers dr1,dr2`). The table's Flags column names each kind's fields as `event` takes them, a flag in `[]` optional, and `event`'s usage line lists them too: a `write` is `--write-kind`, never a second `--kind`. A value is an enum, a number, a SHA or an id: never a sentence. A reason in words belongs in the Activity Log.

Every event carries an `actor`: `human`, `chief-of-staff` or `delegation`. `gh` and `glab` show the same login for a write the Chief of Staff made in the human's name and one the human made, so the actor is the only record of which it was.

| Kind                 | Written by                                                                                 | When                                                                                                                                                          | Flags                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-opened`         | Chief of Staff                                                                             | Step 2: the repository, tracker, run kind, spec, `team`, `took_over`, tickets, harness, Support Level, Decision authority and landing                         | `[--repo]` `[--tracker]` `--run-kind` `[--spec]` `--team` `[--took-over]` `[--tickets]` `--harness` `--support-level` `--decision-authority` `[--landing]` |
| `plan-approved`      | Chief of Staff, actor `human`                                                              | Step 4: the human's "go", with the Decision authority line as approved                                                                                        | `[--decision-authority]`                                                                                                                                   |
| `delegation-started` | the Delegation                                                                             | Its first act: its `delegation`, issue, kind, Executor kind, model and start route, all given in its brief                                                    | `--delegation` `[--issue]` `--delegation-kind` `--executor` `--model` `--start-route`                                                                      |
| `delegation-landed`  | the Delegation                                                                             | Each time it pushes work it reports as landed, with the head                                                                                                  | `--delegation` `[--head]`                                                                                                                                  |
| `delegation-ended`   | the Delegation                                                                             | When its final report is written, with its outcome                                                                                                            | `--delegation` `--outcome`                                                                                                                                 |
| `send-back`          | Chief of Staff                                                                             | Each time a report is sent back (step 7, step 9)                                                                                                              | `--delegation`                                                                                                                                             |
| `decision-request`   | Chief of Staff                                                                             | When it queues a Decision Request, its own or a Delegation's: the next run-wide id `dr<n>`, and the Delegation when it asked. A Delegation writes none        | `[--delegation]` `--id`                                                                                                                                    |
| `ruling-made`        | Chief of Staff                                                                             | With each Ruling: its `R<n>` and the Delegation it was sent to                                                                                                | `--delegation` `--ruling`                                                                                                                                  |
| `ruling-verdict`     | Chief of Staff, actor `human`                                                              | When the human upholds or overturns it                                                                                                                        | `--ruling` `--verdict`                                                                                                                                     |
| `wait-opened`        | Chief of Staff                                                                             | When something starts waiting on the human, or on a teammate: a `wait-id`, its step kind, its `cause`, and `how` the human answers (`chat`, `card`, `github`) | `--wait-id` `[--delegation]` `--step-kind` `--cause` `--how` `[--card]` `[--issue]` `[--blocker]` `[--blocker-login]`                                      |
| `wait-closed`        | Chief of Staff, actor `human` (`chief-of-staff` when it unparks a `teammate-blocker` wait) | When the human's touch ends it, listing the Decision Requests it `covers`                                                                                     | `--wait-id` `[--covers]`                                                                                                                                   |
| `human-step`         | Chief of Staff, actor `human`                                                              | A touch with no wait before it (a typed command, a close-out answer)                                                                                          | `[--delegation]` `--step-kind` `--cause` `--how` `[--card]` `[--issue]` `[--covers]`                                                                       |
| `write`              | Chief of Staff, or the Delegation                                                          | Each write to the tracker, with its kind and whether it was made in the human's name (`as-human`)                                                             | `[--delegation]` `--write-kind` `--as-human`                                                                                                               |
| `review`             | Chief of Staff                                                                             | Each review round                                                                                                                                             | `--pr` `--round` `[--head]` `--findings` `--fixed` `--answered`                                                                                            |
| `ci`                 | Chief of Staff                                                                             | Each CI result on a head                                                                                                                                      | `--pr` `--head` `--result` `--failed-checks`                                                                                                               |
| `qa-result`          | Chief of Staff                                                                             | Each QA Delegation's result                                                                                                                                   | `--delegation` `--target` `--route` `--result`                                                                                                             |
| `pull-request`       | Chief of Staff                                                                             | When a pull request is opened                                                                                                                                 | `--pr`                                                                                                                                                     |
| `run-closed`         | Chief of Staff                                                                             | At close-out, with the run's outcome and its pull requests                                                                                                    | `--outcome` `[--pull-requests]`                                                                                                                            |
| `heartbeat`          | Chief of Staff                                                                             | At every heartbeat firing, first, with no fields. `derive` ignores it; the board counts it, so a quiet run is not stale                                       | none                                                                                                                                                       |

**A human step is one touch** from the human: one answer, click or typed command, and it lists every Decision Request it covered, so an answer to three questions in one message is one step. A wait has a `wait-opened` and a `wait-closed` sharing one `wait-id`, and the close is the touch the Run Record counts; the time between them is the wait. A wait belongs to a Delegation, or to the run when it is the plan's approval, the review label, posting replies, the merge or the close-out. A card start the harness refused opens a wait with cause `harness-limit` and the card's id. A ticket parked on a teammate's ticket opens a `teammate-blocker` wait carrying the blocker ticket and the teammate's login, and unparking closes it, written with actor `chief-of-staff`: it is by design and is measured, but it is not a human step, since only a `human` actor counts as one. A `harness-limit` wait must name its `card`, and a `teammate-blocker` wait its blocker ticket and the teammate's login: derive refuses either with a field missing. A Ruling is `ruling-made` when it is sent and `ruling-verdict` when the human upholds or overturns it, and the record's `rulings` counts them (`made`, `upheld`, `overturned`). A wait with no `wait-closed` by close-out is not a step: derive reports it as still open, by id and step kind, and counts it in `run.open_waits`. A cause that is by design is never counted as avoidable.

**Each human step carries a `cause`**, from this list, each either avoidable or by design:

| Cause                | Counts as | Meaning                                                                 |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| `harness-limit`      | avoidable | The harness could not start or do it without the human, such as a card. |
| `permission-refusal` | avoidable | A permission rule stopped a write or a command.                         |
| `tool-missing`       | avoidable | A tool or CLI the step needed was not there.                            |
| `skill-bug`          | avoidable | The skill's own rules asked for a step they should not have.            |
| `spec-gap`           | avoidable | The spec or issue left a question that only the human could answer.     |
| `missing-config`     | avoidable | A config key or an approved routine write would have made it needless.  |
| `human-choice`       | avoidable | The human chose to step in where the run did not need them.             |
| `other`              | avoidable | None of the above.                                                      |
| `by-design`          | by design | An expected step: the plan's approval, the merge, the close-out.        |
| `teammate-blocker`   | by design | Waiting on a teammate's ticket in a Team Run.                           |

The plan's approval and the close-out are always `by-design`, and derive refuses a step of either kind with another cause.

**At close-out** the Chief of Staff writes `run-closed`, then derives the record:

```bash
node "<skill>/records.mjs" derive <run_dir>/<run>
```

It reads the Chief of Staff's events and each Delegation's, in time order, and writes `<run_dir>/records/<run-id>.json`. The record holds only counts, ids, SHAs, issue and pull request numbers, times, durations, enum values and outcomes: the repository (`host/owner/repo`), the operator, the run kind and spec, `team`, `took_over`, the harness and its Support Level, each Delegation's Executor kind, model and real start and end, each human step with its kind, cause and wait, the writes with their actors, reviews, CI, Rulings and QA. It never holds issue text, ticket titles, commit messages, command output, file contents or a reason in words.

A **safe-field check** runs on every derive: a field outside the schema, or a value that is free text, is an error that names the field, and nothing is written. It never strips. A stream that does not add up is refused the same way: a wait closed that was never opened, a step covering a Decision Request nobody raised, an event for a Delegation that never started, no `run-closed`. Fix the events file with a new event, and derive again.

`run.operator` is the login of the tracker CLI (`gh api user`, or `glab api user`), and only `ORCHESTRATE_OPERATOR` overrides it; with no login it is `null`. `run.repo` is `host/owner/repo` from the `origin` remote, or the only remote. Records start with the first run that writes events: there is no backfill.

### Uploading the Run Record

The record is local until the human uploads it. With a `records.sink` in the config ([CONFIG.md](CONFIG.md#records)), the close-out offers the upload once the record is derived, unless `records.upload` is `never`; and `--upload <run>` uploads a closed run's record at any later time. Load [SINKS.md](SINKS.md), then the file of the Sink's type under [sinks/](sinks/), before the first upload. Both go through the records script:

```bash
node "<skill>/records.mjs" upload <run>         # shows the disclosure, uploads nothing
node "<skill>/records.mjs" upload <run> --yes   # shows it, then uploads
```

`<run>` is a run id, or the path of its run folder. Run the first form and print its output as the question. The human answers by choosing one of its three buttons:

- **[Show the record]:** print the file the output names (`record: <path>`), then ask again.
- **[Upload]:** run the `--yes` form, and say what it printed: `uploaded`, or `already uploaded`.
- **[Not now]:** do nothing more. The record stays in `<run_dir>/records/`, and the human can run `--upload <run>` later.

The disclosure is this, with the Sink, path, count of people with access and number of human steps filled in by the script:

> **Upload this run's Run Record?** To `acme/run-records` (private GitHub repository, 4 people with access) at `records/github.com/acme/widgets/naim/2026-11-19-spec-344.json`. It holds counts, ids, times, outcomes and 23 human steps with their kind and cause: no issue text, no command output, no prose. It is kept indefinitely (git cannot expire it). [Show the record] [Upload] [Not now]

The count of people with access is left out when the Sink cannot be read for it. The Sink's name in the parentheses is the script's: `private GitHub repository`, `private GitLab project` or `private S3 bucket` (an S3 bucket has no count of people, so none is shown, and its line says the bucket's own rule decides how long the record is kept). The words are the script's; never reword them.

**The Sink's Support Level.** Each Sink's file states its Support Level ([SINKS.md](SINKS.md)). When the Sink's file states a Support Level below `verified` (`gitlab` and `s3` ship at `documented`; `github` is `verified`), the Dispatch Plan says so beside "upload the Run Record", and the close-out repeats it after the disclosure, so the human knows the Sink has not yet been proven by a run. The first run that uploads to it and reads the record back moves the level in that file, citing its Activity Log.

**A routine write.** The Dispatch Plan may list "upload the Run Record" among the kinds of routine write, when the config sets a `records.sink`. Approved with the plan's "go", the close-out runs the `--yes` form without asking again; the script still prints the disclosure, and the close-out repeats it. `--upload <run>` is the human's own command: it asks as above.

**What stops an upload**, each printed by the script and relayed whole, with nothing uploaded:

- the Sink is not private, or its visibility cannot be read: there is no override;
- the record has no login (`run.operator` is `null`): sign in with `gh` or set `ORCHESTRATE_OPERATOR`, then derive again;
- different bytes are already at the path: nothing is overwritten, and the clash is the human's to settle;
- the safe-field check fails on the record;
- exit code `3`: the repository cannot be told (several remotes and none is `origin`). Ask which one, and pin it as `records.repository`.

**The path** is `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, every segment lowercased. `<host>/<owner>/<repo>` is `records.repository`, or the record's own repository, read from the `origin` remote (or the only remote); `<login>` is `run.operator`. A run with no `records` keys writes the local record and offers nothing.

### Uploading the raw run folder

The raw run folder holds the prose the Run Record leaves out: it **may quote private issue text, command output and file contents**. It is offered only when the config sets `records.raw.sink` ([CONFIG.md](CONFIG.md#raw)), an `s3` bucket and nothing else, and only after the Run Record's own line has been answered, at every close-out. Without `records.raw`, nothing is offered and the run behaves as before. Load [sinks/s3.md](sinks/s3.md) before the first one. It goes through the records script:

```bash
node "<skill>/records.mjs" upload-raw <run>          # shows the line, uploads nothing
node "<skill>/records.mjs" upload-raw <run> --list   # also lists every file
node "<skill>/records.mjs" upload-raw <run> --yes    # shows it, then uploads
```

Run the first form and print its output as the question. The script reads the bucket's lifecycle before it prints the line, and quotes the days of the rule it found. The line is this, with the file count, the size, the bucket, the path and the days filled in by the script:

> **Also upload the raw run folder?** 37 files, 1.8 MB, to bucket `acme-run-records` at `raw/github.com/acme/widgets/naim/2026-11-19-spec-344/`. It **may quote private issue text, command output and file contents**. The bucket's own rule deletes it after about 30 days. [List the files] [Upload] [Not now]

The human answers with one button:

- **[List the files]:** run the `--list` form, print it, then ask again.
- **[Upload]:** run the `--yes` form, and say what it printed.
- **[Not now]:** do nothing more. The folder stays on this machine.

**Never a routine write.** The Dispatch Plan cannot list it, and approving the plan at "go" does not answer it: the close-out asks, with this line, at every close-out, and a yes at one close-out is not a yes at the next. The words are the script's; never reword them.

**What stops it**, each printed by the script and relayed whole, with nothing uploaded: no enabled lifecycle rule expires `raw/`, or the lifecycle cannot be read (the skill never writes the bucket's configuration, so it tells the human to set the rule); the bucket is not private; the Run Record has no login; a file that is not UTF-8 text; different bytes already at a path, which nothing overwrites. Raw folders are never shown in the dashboard.

### The past-runs dashboard

`--dashboard [--repo <host/owner/repo>] [--local-logs]` builds one self-contained page from the Run Records in `<run_dir>/records/` and from the config's `records.sink`, so a past run can be reviewed down to a Delegation and a human step, in one repository or in every repository the Sink holds. It runs the records script, and prints what the script prints, the `file://` link of each page it wrote. It never launches a browser, since harnesses differ, and the skill never hosts the page. A team may host `dashboard.html` itself (never `dashboard.local.html`), behind its own access control: it holds every record it was built from, every login included, so its readers should be the Sink's readers.

```bash
node "<skill>/records.mjs" dashboard                # <run_dir>/dashboard.html
node "<skill>/records.mjs" dashboard --repo <host/owner/repo>   # opens on that repository
node "<skill>/records.mjs" dashboard --local-logs   # also <run_dir>/dashboard.local.html
```

The page is built on this machine, and works offline: it holds no credential and makes no request. The Sink is read at build time, through the same Sink operations the upload uses, and the records are inlined. It shows when it was built and the command that rebuilds it, since it does not update itself. A record that is not JSON, fails the safe-field check, or repeats a run id is skipped, with the file named, and the rest is built. With no records it builds nothing and says so.

- **Reading the Sink.** The build checks the Sink is private first (`visibility`), lists `records/` (`list`), and reads only the paths the cache does not hold (`read`). Records are cached forever, in `<run_dir>/records-cache/`, in a folder that mirrors the Sink's paths, since a path in a create-only Sink never changes; a cached record is checked again each build. The reader needs read access only ([sinks/github.md](sinks/github.md#access)). A Sink that cannot be read (a `404` or a `403`) is one warning, and the page is built from the local records. A Sink that has turned public is a warning too, but the read goes ahead.
- **Which records.** `local` and the configured `records.sink`, nothing else. A record that is identical in both counts once. A record only in `local` is tagged "not uploaded" with its `--upload <run>` command, when the Sink was read. When the bytes differ, the Sink's copy is shown, with a warning.
- **Namespaces** are parsed from the Sink's paths alone, as `records/<host>/<owner>/<repo>/<login>/<run-id>.json`, read from the end, so a GitLab subgroup's whole namespace stands in `<owner>`: no index file is read. A path that does not parse is skipped and listed. The Repository switcher offers _All repositories_ and every namespace found, and the page opens on the current repository (`records.repository`, else `origin`), or on `--repo`.
- **All repositories** has the merge rate, human steps per run, the avoidable trend, the top avoidable cause, a chart comparing repositories over time, recent runs and the namespace tree. A **Repository** page has its human steps per run stacked by cause, and its runs.
- **Runs:** every record, newest first, with its human steps and top cause.
- **A Run** has tabs: Summary (what to improve next run, why a human was needed, the plan, the outcome), Timeline (a Human lane, a Chief of Staff lane with writes by `actor`, Reviews and CI, one lane per Delegation), Delegations, Human steps (filterable by cause, kind and actor), Reviews and CI, Log, and Record (JSON). A Delegation and each human step have a page of their own, and the Key page says what each cause, kind and mark means.
- **Colour means `cause`, and nothing else.** Every chip names its cause and says avoidable or by design. States, such as an outcome or a CI result, are grey.
- **The Log tab** gives the Run Events as text, derived from the record alone, and a report of the run, each to copy or download.
- **Prose is never in `dashboard.html`.** With `--local-logs`, `dashboard.local.html` also inlines the prose `activity.md` of each run whose folder is still in `<run_dir>`, under the banner "contains private prose from this machine, don't share this file". A credential the environment holds, and the usual token shapes, are replaced in that prose. Tell the human the `.local` file is not for sharing.

#### Teammates on the dashboard

Teammates sharing a Sink see each other's runs, how each uses the skill and how long their runs take, side by side and without ranking. Everything comes from the Run Records, and the dashboard never reads the tracker.

- **People.** The Repository page has a People table with a row for each login in that repository, and _All repositories_ has the same table grouped by `(host, login)` with a count of repositories. Each row has: runs by kind and the outcome mix; the median and the longest run length; the time waiting on the human (the sum of each wait, from its open and close Run Events); human steps per Delegation; the avoidable share with its top avoidable cause and a trend line; the mix of decision authority, of QA, of harness and of model; and the date of the last record. A date range of 30 days, 90 days or all covers the table and the Person page, and defaults to 90 days.
- **Like with like.** Run counts and run lengths are shown per run kind (`tickets`, `spec`, `team`) and never mixed; only the per-Delegation figures compare across kinds. People are shown by login, sorted by login, with no ranking, score, total, "best" or "worst". No config key hides or totals people.
- **Person.** A Person page per `(repository, login)` shows runs over time, run lengths, human steps by cause, the avoidable trend, and links to the person's Spec pages. A login on two hosts is two people: logins are never merged across hosts, and there is no alias map.
- **Spec.** A Spec page per `(host/owner/repo, run.spec)` where `run.team` is true reads every login's Team Run over the spec on one clock: a lane per run, grouped under its login, with the harness and model of each; the tickets each teammate built; the time parked on a teammate's ticket (the `teammate-blocker` waits, and whose ticket); takeovers, where a run that took over another marks it "superseded by <run-id>"; and the spec's totals (first start to last close, human steps, the listed tickets that landed in merged runs, and apart from them those landed in `partly-merged` runs, since the record holds no per-ticket merge). It points at `--status --spec <n>` for live state and never reads the tracker.
- **Who is not shown.** Every page that shows teammates (the People table on the Repository page and on _All repositories_, and each Spec page) names the Sink it read and says: "Only runs uploaded to `<sink>` are here. Teammates who haven't uploaded, upload elsewhere, or have runs still open aren't shown." There is no roster, and the page never guesses who is missing; a login's last-record date shows that someone has stopped uploading.
- **Who can see it.** Whoever can read the Sink reads every record, with every login's name, so no page setting is privacy. Who uploads (each person's yes at close-out, or a routine write the Dispatch Plan approved) and who can read the Sink are the organization's controls.

The page shell and its one stylesheet are in [`pages/`](pages/), shared by every page the skill builds.

### Pruning old run folders

Local pruning is off until the config sets `prune.after_days` ([CONFIG.md](CONFIG.md#prune)); setting it is the consent to delete. The close-out runs it after deriving the record:

```bash
node "<skill>/records.mjs" prune
```

It deletes a run folder only when the run is **closed out**: its Run Record is in `<run_dir>/records/<run-id>.json` and names that run, and the record's `closed_at` is more than `after_days` days ago. An open run has no record, so it stays, however old. A closed run newer than the setting stays. `<run_dir>/records/`, and every record in it, always stays, and so does anything in `<run_dir>` that is not a run folder. A bad config, or no `prune` key, deletes nothing.

**The ask, once.** With no `prune` key, the close-out asks: "Prune closed-out run folders older than 90 days from now on? Run Records are never deleted." On a yes, write `prune.after_days: 90` into the config file the run read (create `orchestrate.config.yml` if there is none), and run `prune`. On a no, run `node "<skill>/records.mjs" prune --declined`, which writes `<run_dir>/prune-declined` and nothing else, and does not ask again. The key is written only on a yes.

## Run Summary

After the human has merged, the Chief of Staff may offer a Run Summary on the umbrella issue the run's issues share, if they share one. It lists each Delegation with its pull request, each decision the human made and where it was recorded, in an autonomous run each Ruling with its verdict, what was not delegated, and anything left open. Posting it is a write as the human: it is drafted, shown, and posted only on a yes.
