# The run folder

Where a run keeps its state, so that `--status` can print it and `--resume` can continue it. Load it before opening, updating or resuming a run.

## Layout

A run lives in its own folder inside the config's `run_dir`, which is gitignored:

```text
<run_dir>/<run>/
  board.md                  the board: one row per Delegation
  activity.md               the Chief of Staff's Activity Log
  answers.json              the answers given in chat, when the config did not say
  qa-readiness.json         the QA readiness answers the Dispatch Plan asked for, the JSON object qa-plan's --answers takes
  qa-readiness-<base>.json  the same, for a pull request with another base branch, once the human has answered for it
  rulings.md                the Ruling Ledger, in an autonomous run
  evidence/                 command output a Ruling cites, one file each: R<n>-<k>.txt
  delegations/<id>/
    brief.md                the brief, as spawned
    activity.md             the Delegation's Activity Log
    report.md               its latest report
    decisions.md            its Decision Requests, appended, each marked answered when it is (by the human, or by a Ruling's id)
    qa-plan.md              a QA Delegation's QA Plan, as drafted, then as delivered
    qa-report.md            a QA Delegation's QA Report
```

`<run>` is the date and the issue numbers, `2026-11-13-12-34`, with `.2`, `.3` added when that folder is already there (a dot, so a second run for #12 is never read as a run for #12 and #2). A spec run's `<run>` is the date and the spec, `2026-11-13-spec-50`, with the same `.2`. A Delegation's `<id>` is `d<issue>`, `d12`; a second Delegation for the same issue adds `-2`, a third `-3`, and so on: the next suffix not yet used in the run, so a restart never reuses a folder. A phase of a spec with no tickets is `d<spec>-p<k>`, `d50-p2` for its second phase ([SPEC.md](SPEC.md#phases)), and a fix Delegation on an integration branch is `d<spec>-fix<k>`. A QA Delegation is `d<issue>-qa` for the first QA of that issue's pull request, then `d<issue>-qa2`, `-qa3` for each later one, on a new head or the same one.

Nothing in a run folder is committed. A brief or a log can quote issue text and command output the human has not chosen to publish.

## Board

```markdown
# Run <run>

Started <date>. Plan approved <date>. Approved routine writes: <list, or none>. Decision authority: <relay, or autonomous>.

QA readiness: <none needed; or for <base>, this run only, or saved to <config> (uncommitted); and each other base answered>.

Heartbeat: <id, interval, made <time>; `foreground watch`, where the harness has no scheduler; none yet; deleted <time>; or none on tier 3>.

Default branch: <name> at <SHA>, checked <time>; passed: <Delegation>@<head>, …, or none.

Spec #<n>, <shape>. Landing: <landing>. Integration branch: <name> at <SHA>, pushed: <no, or why>.

| Delegation | Issue | Kind     | Executor     | Handle   | Model | Wave      | Branch | Pull request | State    | Decision Requests |
| ---------- | ----- | -------- | ------------ | -------- | ----- | --------- | ------ | ------------ | -------- | ----------------- |
| d12        | #12   | building | Live Session | <handle> | <m>   | 1         | <b>    | <URL>        | verified | R1 unreviewed     |
| d12-qa     | #12   | qa       | Live Session | <handle> | <m>   | after d12 | <SHA>  | <URL>        | running  | none              |

## Not delegated

- #34: `ready-for-human`, listed for the human.
```

The `QA readiness` line is there only when the run has a QA Delegation. It names the base branch the answers in `qa-readiness.json` hold for, so a QA brief for a pull request with another base gives no answers file ([SKILL.md](SKILL.md) step 4). In `qa-readiness-<base>.json`, a `/` in the branch name is written `-`.

The `Heartbeat` line is the check that re-arms itself while the run waits on a Delegation (SKILL.md step 6), so `--status` shows whether one is armed and `--resume` knows what to arm again.

The `Default branch` line is the default branch's tip at the last check of it: written at SKILL.md step 8 the first time, once every verified branch has been test-merged into that tip, and after that only at each [default-branch check](SKILL.md#the-default-branch-check). It is the baseline for "the tip has moved since", which decides whether the check re-gates the merge result. Its `passed` list names each row that passed at that tip, with the head it passed at: step 8 names only a verified branch whose head already contains the tip, and each check names only the rows that passed it. A row it does not name at its current head (one taken off the list, verified since, or pushed to since it passed) is re-gated at its next check, even when the tip has not moved. Before step 8 it reads `none yet`.

The `Spec` line is there only in a spec run, and its integration branch only with that landing. In that landing, a ticket's **Branch** cell also gives the commit it was cut at, and once it has landed, its landed commit, and its **Pull request** cell is `none`: its work lands through the integration branch, which has a row of its own once its pull request is open ([SPEC.md](SPEC.md#on-an-integration-branch)).

The **Decision Requests** cell lists each open question by its heading, and in an autonomous run each Ruling for the Delegation by its id and verdict (`R1 unreviewed`, `R3 needs re-review`), so the board shows what still waits on the human: a queued question, or a Ruling not yet upheld.

A QA Delegation's **Branch** cell is the full head it is pinned to, and its **Pull request** cell is the pull request it tests. Its earlier rows stay on the board, `void` or `failed`, so each QA run on the issue is visible.

The **Handle** is what `message` and `await` need to reach the Executor again: a session id, a process id with its output file, or a sub-agent's name ([HARNESSES.md](HARNESSES.md)). The board is rewritten whole on each change, never edited in part, so an interrupted write leaves the last whole board in place: write the new board beside the old one, then rename it over the old one.

## States

| State                    | Means                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned`                | In the approved plan; not started.                                                                                                                                                                                                                                                                                                                                                 |
| `parked`                 | Waits for another Delegation's branch to be merged, or landed on an integration branch (an overlap or a blocker), then starts from there.                                                                                                                                                                                                                                          |
| `running`                | Spawned, and working.                                                                                                                                                                                                                                                                                                                                                              |
| `waiting`                | Stopped on an open Decision Request; a row the default-branch check found `BEHIND`, or whose re-gate on the merge result failed, included.                                                                                                                                                                                                                                         |
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

## Activity Logs

Each Activity Log is append-only Markdown, one entry per thing done, newest last: the time, what was done, and why. The Chief of Staff's log records each plan, spawn, relayed Decision Request and its answer, verification result and write made in the human's name. A Delegation's log records its phases, its stop points and the commands it ran. Neither is ever rewritten: when a log is wrong, a later entry says so.

## Resume

`--resume <run>` continues a run from its folder, after a usage limit, a closed laptop or a pause for merges.

1. Read the config again (`check`, with the run's `answers.json` when there is one). A config that changed since the run started is said, and its new values apply from here. A changed `run_dir` does not move a run: check that the folder the run is in is still inside the effective `run_dir`, and still ignored (`git check-ignore -q <that folder>/board.md`), whether or not the run has an `answers.json`. If it is not, stop, say so, and ask the human to move the run folder into the new `run_dir` or to put the old value back, then resume.
2. Read the board and both kinds of Activity Log. A board with a `Spec` line is a spec run: load [SPEC.md](SPEC.md). Its landing and its integration branch's name are the board's, not the config's: a run never changes how it lands part way through.
3. Check each Delegation not `merged` or `dropped` against the source, not the board: its branch and head, its pull request and whether it is merged, CI on its head, the review workflow's run on its head and any review comment newer than its verification (SKILL.md step 7), and whether its Executor still answers its handle. With an integration branch, check the branch's head too, and which tickets' heads it contains: a ticket has landed, whatever the board says, when its landed commit is in it, or, when the board records none (an interruption between the move and the board's update), when the commit its verified report names is in it and is not the commit the ticket was cut at (a ticket cut but never committed to is in it too, and has not landed). Judge by those commits, never by the ticket branch's current head, which may have moved on since. Check the integration branch's own pull request the same way: when it is merged, so is every ticket it landed. Check each QA Delegation that has a head pinned in its row and is not `failed` or `void` against its pull request: when the pull request's head is not that head, it is `void`, a `passed` one included, and its building row goes back to `reported`, for SKILL.md step 7 on the new head. A `planned` QA Delegation has no head yet: it waits for its building Delegation, as before. For one whose `qa-plan.md` exists, check that it names the pinned head as its **Head**, and look where the plan was delivered for a posted QA Report for that head, whatever its report says: a QA Delegation interrupted between posting and reporting has posted one its report does not name. A board written before an interruption can be out of date.
4. Update the board to what was found, and log each change. Then run the [default-branch check](SKILL.md#the-default-branch-check) on each `ready to merge` row before listing any: the default branch may have moved while the run was paused.
5. In an autonomous run, open with the Rulings still awaiting review: each `unreviewed` or `needs re-review` entry in the Ruling Ledger, grouped by Delegation as SKILL.md step 10 shows them, and with the questions still queued for the human. The human may answer them now, or later in the session.
6. Start each `parked` Delegation whose wait is over, from the default branch as it now is, or, with an integration branch, from that branch's head. Arm the heartbeat again (SKILL.md step 6), unless the only thing left to wait for is the human's merges, or the run is on tier 3. A `reported` or `waiting` row with a wait on CI or a review still needs it. The board's id may name a task that is gone, or one that outlived the old session, so check it first with the harness's own list of scheduled tasks, and make a new one only when it is gone. Then re-arm each wait the old session held, such as a subscription on a Delegation or a capped wait on CI: a background command does not survive a resume. Record the new id on the board, and continue the loop from SKILL.md step 6.

A Delegation whose Executor no longer answers, and whose work did not finish, is `crashed`: its branch is the handoff, and the human decides whether a new Delegation picks it up.

## Status

`--status [<run>]` prints the board of the run named, or of the run in `run_dir` whose board was written last, with each open Decision Request in full, and, in an autonomous run, the Ruling Ledger. Before printing, it runs the [default-branch check](SKILL.md#the-default-branch-check) on each `ready to merge` row, since the human has come back to the run and may be about to merge. It prints that check's result with the board. It writes nothing: not the board, its `Default branch` line or any row's state, and no other file in the run folder. It messages no Delegation, voids no QA, re-arms nothing, and raises no Decision Request. That is because a live Chief of Staff session may still hold the run: it may be invoked in another session while the run goes on, and a second writer to the board would lose one side's change. It is also why the run in `run_dir` whose board was written last stays the run the human was working on. A row the check would send back to step 7, whose head moved, or that needs a Decision Request is printed with what was found, and nothing records it. `--resume` step 4 runs the check again on every `ready to merge` row and acts on what it finds. Because the `Default branch` line is unchanged, it re-gates the same rows `--status` would have.

## Run Summary

After the human has merged, the Chief of Staff may offer a Run Summary on the umbrella issue the run's issues share, if they share one. It lists each Delegation with its pull request, each decision the human made and where it was recorded, in an autonomous run each Ruling with its verdict, what was not delegated, and anything left open. Posting it is a write as the human: it is drafted, shown, and posted only on a yes.
