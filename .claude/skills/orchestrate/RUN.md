# The run folder

Where a run keeps its state, so that `--status` can print it and `--resume` can continue it. Load it before opening, updating or resuming a run.

## Layout

A run lives in its own folder inside the config's `run_dir`, which is gitignored:

```text
<run_dir>/<run>/
  board.md                  the board: one row per Delegation
  activity.md               the Chief of Staff's Activity Log
  answers.json              the answers given in chat, when the config did not say
  delegations/<id>/
    brief.md                the brief, as spawned
    activity.md             the Delegation's Activity Log
    report.md               its latest report
    decisions.md            its Decision Requests, appended, each marked answered when it is
    qa-plan.md              a QA Delegation's QA Plan, as drafted, then as delivered
    qa-report.md            a QA Delegation's QA Report
```

`<run>` is the date and the issue numbers, `2026-11-13-12-34`, with `.2`, `.3` added when that folder is already there (a dot, so a second run for #12 is never read as a run for #12 and #2). A spec run's `<run>` is the date and the spec, `2026-11-13-spec-50`, with the same `.2`. A Delegation's `<id>` is `d<issue>`, `d12`; a second Delegation for the same issue adds `-2`. A phase of a spec with no tickets is `d<spec>-p<k>`, `d50-p2` for its second phase ([SPEC.md](SPEC.md#phases)), and a fix Delegation on an integration branch is `d<spec>-fix<k>`. A QA Delegation is `d<issue>-qa` for the first QA of that issue's pull request, then `d<issue>-qa2`, `-qa3` for each later one, on a new head or the same one.

Nothing in a run folder is committed. A brief or a log can quote issue text and command output the human has not chosen to publish.

## Board

```markdown
# Run <run>

Started <date>. Plan approved <date>. Approved routine writes: <list, or none>.

Spec #<n>, <shape>. Landing: <landing>. Integration branch: <name> at <SHA>, pushed: <no, or why>.

| Delegation | Issue | Kind     | Executor     | Handle   | Model | Wave      | Branch | Pull request | State    | Decision Requests |
| ---------- | ----- | -------- | ------------ | -------- | ----- | --------- | ------ | ------------ | -------- | ----------------- |
| d12        | #12   | building | Live Session | <handle> | <m>   | 1         | <b>    | <URL>        | verified | none              |
| d12-qa     | #12   | qa       | Live Session | <handle> | <m>   | after d12 | <SHA>  | <URL>        | running  | none              |

## Not delegated

- #34: `ready-for-human`, listed for the human.
```

The `Spec` line is there only in a spec run, and its integration branch only with that landing. In that landing, a ticket's **Branch** cell also gives the commit it was cut at, and once it has landed, its landed commit, and its **Pull request** cell is `none`: its work lands through the integration branch, which has a row of its own once its pull request is open ([SPEC.md](SPEC.md#on-an-integration-branch)).

A QA Delegation's **Branch** cell is the full head it is pinned to, and its **Pull request** cell is the pull request it tests. Its earlier rows stay on the board, `void` or `failed`, so each QA run on the issue is visible.

The **Handle** is what `message` and `await` need to reach the Executor again: a session id, a process id with its output file, or a sub-agent's name ([HARNESSES.md](HARNESSES.md)). The board is rewritten whole on each change, never edited in part, so an interrupted write leaves the last whole board in place: write the new board beside the old one, then rename it over the old one.

## States

| State            | Means                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned`        | In the approved plan; not started.                                                                                                                                                              |
| `parked`         | Waits for another Delegation's branch to be merged, or landed on an integration branch (an overlap or a blocker), then starts from there.                                                       |
| `running`        | Spawned, and working.                                                                                                                                                                           |
| `waiting`        | Stopped on an open Decision Request.                                                                                                                                                            |
| `reported`       | Has written a report; not verified yet.                                                                                                                                                         |
| `sent back`      | Its report did not hold, or its QA failed and the human chose to send it back; the Delegation has been told what was found.                                                                     |
| `verified`       | A building Delegation whose report held and whose branch merges cleanly (step 8), waiting on its QA.                                                                                            |
| `stalled`        | Nudged once, still stuck, and raised to the human.                                                                                                                                              |
| `crashed`        | Its Executor ended without a report; its branch and worktree are kept as the handoff.                                                                                                           |
| `analysed`       | An analysis Delegation whose evidence and options are verified and relayed.                                                                                                                     |
| `landed`         | A spec run on an integration branch: verified, and fast-forwarded into the integration branch.                                                                                                  |
| `passed`         | A QA Delegation whose QA Report for its head is verified, with every scenario passed, or each left for a person passed or waived; or whose `qa-plan` found no Residue, with its claims checked. |
| `failed`         | A QA Delegation whose verified QA Report has a FAIL or a _Stop and do not merge if_ outcome.                                                                                                    |
| `void`           | A QA Delegation whose pull request's head moved before or after it ran; its result says nothing about the new head.                                                                             |
| `ready to merge` | Ready to Merge: CI green, review settled (with a review workflow, its run on this head included), QA requirement met on its current head, merges cleanly.                                       |
| `merged`         | The human has merged it.                                                                                                                                                                        |
| `dropped`        | Taken out of the run on the human's yes.                                                                                                                                                        |

## Activity Logs

Each Activity Log is append-only Markdown, one entry per thing done, newest last: the time, what was done, and why. The Chief of Staff's log records each plan, spawn, relayed Decision Request and its answer, verification result and write made in the human's name. A Delegation's log records its phases, its stop points and the commands it ran. Neither is ever rewritten: when a log is wrong, a later entry says so.

## Resume

`--resume <run>` continues a run from its folder, after a usage limit, a closed laptop or a pause for merges.

1. Read the config again (`check`, with the run's `answers.json` when there is one). A config that changed since the run started is said, and its new values apply from here. A changed `run_dir` does not move a run: check that the folder the run is in is still inside the effective `run_dir`, and still ignored (`git check-ignore -q <that folder>/board.md`), whether or not the run has an `answers.json`. If it is not, stop, say so, and ask the human to move the run folder into the new `run_dir` or to put the old value back, then resume.
2. Read the board and both kinds of Activity Log. A board with a `Spec` line is a spec run: load [SPEC.md](SPEC.md). Its landing and its integration branch's name are the board's, not the config's: a run never changes how it lands part way through.
3. Check each Delegation not `merged` or `dropped` against the source, not the board: its branch and head, its pull request and whether it is merged, CI on its head, the review workflow's run on its head and any review comment newer than its verification (SKILL.md step 7), and whether its Executor still answers its handle. With an integration branch, check the branch's head too, and which tickets' heads it contains: a ticket has landed, whatever the board says, when its landed commit is in it, or, when the board records none (an interruption between the move and the board's update), when the commit its verified report names is in it and is not the commit the ticket was cut at (a ticket cut but never committed to is in it too, and has not landed). Judge by those commits, never by the ticket branch's current head, which may have moved on since. Check the integration branch's own pull request the same way: when it is merged, so is every ticket it landed. Check each QA Delegation that has a head pinned in its row and is not `failed` or `void` against its pull request: when the pull request's head is not that head, it is `void`, a `passed` one included, and its building row goes back to `reported`, for SKILL.md step 7 on the new head. A `planned` QA Delegation has no head yet: it waits for its building Delegation, as before. For one whose `qa-plan.md` exists, check that it names the pinned head as its **Head**, and look where the plan was delivered for a posted QA Report for that head, whatever its report says: a QA Delegation interrupted between posting and reporting has posted one its report does not name. A board written before an interruption can be out of date.
4. Update the board to what was found, and log each change.
5. Start each `parked` Delegation whose wait is over, from the default branch as it now is, or, with an integration branch, from that branch's head. Continue the loop from SKILL.md step 6.

A Delegation whose Executor no longer answers, and whose work did not finish, is `crashed`: its branch is the handoff, and the human decides whether a new Delegation picks it up.

## Status

`--status [<run>]` prints the board of the run named, or of the run in `run_dir` whose board was written last, with each open Decision Request in full. It reads nothing else and changes nothing.

## Run Summary

After the human has merged, the Chief of Staff may offer a Run Summary on the umbrella issue the run's issues share, if they share one. It lists each Delegation with its pull request, each decision the human made and where it was recorded, what was not delegated, and anything left open. Posting it is a write as the human: it is drafted, shown, and posted only on a yes.
