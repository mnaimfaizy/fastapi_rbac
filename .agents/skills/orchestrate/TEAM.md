# Team Run

`/orchestrate --spec <n> --team [go] [autonomous]` runs a spec as a **Team Run**: teammates who split a spec's tickets each run their own Chief of Staff, on their own machine and harness, over the tickets assigned to them, and every one of them reads one **Shared Board** on the issue tracker. Load this file only for `--team`, after [SPEC.md](SPEC.md), on `--resume` or `--status` of a run whose board says it is a Team Run, or for `--status --spec <n>`, which reads the Shared Board with no run of its own ([RUN.md](RUN.md#--status---spec-n)). A run without `--team` never reads it. It changes SPEC.md and steps 1 to 4 of [SKILL.md](SKILL.md#workflow) where it says so, adds the Shared Board's writes, the check against teammates' branches and the Ruling line to the steps after them, and leaves every other rule and step as written there. Why it is shaped this way: [DESIGN.md](DESIGN.md#team-run).

A Team Run is federated. No Chief of Staff drives another person's machine, and there is nothing to join: each teammate starts their own run. Each keeps its own run folder, exactly as a single-person run does ([RUN.md](RUN.md#layout)); the Shared Board is a projection of it, never a store. A Chief of Staff never assigns, unassigns or reassigns a ticket: the tracker's assignee is the human's to set, and the only sign of whose ticket it is.

## Find the tracker

At SKILL.md step 1, `check` prints a `tracker` report beside the `harness` one: `pinned`, the config's `tracker` value, or null for `detect` ([CONFIG.md](CONFIG.md#tracker)); `remote`, the name of the repository's git remote (`origin`, or its only remote under whatever name), or null when it has none, or several and none named `origin`; `remote_host`, that remote's host; and `detected`, the tracker that host points to, or null for a host detection does not know. `<remote>` is the remote `check` reports in its `remote` field (on `--resume`, the one the board's `Team Run:` line names): the one in a tracker file's commands, and the one a Team Run fetches and pushes a branch on. When `remote` is null, the run has no `<remote>`, so it is a Decision Request before anything else, whatever `pinned` says: name the remotes there are, or say there is none, and ask which one the team's branches and pull requests are on (and, when `pinned` is null too, which tracker the spec's tickets are on). `--status --spec <n>` fetches and pushes nothing, so it does not ask this ([RUN.md](RUN.md#--status---spec-n)), and `--resume` reads `<remote>` from the board, so it asks this only when that remote is gone ([RUN.md](RUN.md#resuming-a-team-run)). The remote the human names is `<remote>`, and the tracker its host points to is `detected` in the table below.

| `pinned`  | `detected`             | The tracker                                                                                                                                                                                                                               |
| --------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| null      | a tracker              | That tracker.                                                                                                                                                                                                                             |
| a tracker | null, or the same one  | The pinned one. An unknown host, such as a self-hosted GitLab on its own domain, is what the pin is for.                                                                                                                                  |
| a tracker | another tracker        | The two disagree: a Decision Request before anything else, never a silent choice. Say the pin, the remote's host and what it points to. Recommend the remote's, and setting the pin to match, since the remote is where the tickets live. |
| null      | null (an unknown host) | A Decision Request: say the remote's host, and ask which tracker the spec's tickets are on. Recommend pinning `tracker` in the config, so the next run does not ask.                                                                      |

Then load [TRACKERS.md](TRACKERS.md), which names the operations a Team Run reads the tracker through, and that tracker's own file under [trackers/](trackers/), and only that one. A tracker with no file there stops the run before anything else is read: say which trackers this version has a file for.

The tracker file gives its **Support Level**, in the words harness files use ([HARNESSES.md](HARNESSES.md#support-level)). Below `verified`, the Dispatch Plan says so with what it means for this run, and waits for the human's "go" even when the invocation carried `go`, as for a harness.

Read this teammate's login with the `viewer` operation. Record on the board, under the spec's line, `Team Run: <tracker>, as <login>, on <remote>`, with the tracker file's Support Level, and log the tracker, the login, the remote and the Support Level in the Activity Log. The line is where a resumed run reads `<remote>` from, so a remote the human named is not lost ([RUN.md](RUN.md#resuming-a-team-run)).

**Done when:** the tracker is named, its file is loaded, and the board says this is a Team Run, for whom, and on which remote.

## Whose tickets

Read the spec as SPEC.md says. On a tracker other than GitHub, SPEC.md's reading is `gh`'s, so it is not used: the spec's tickets are read through the tracker file, with the `spec-tickets` operation (on GitLab, the task list `- [ ] #<n>` in the spec's description, [trackers/gitlab.md](trackers/gitlab.md#spec-tickets)), and each ticket's blocking edges with the `blockers` operation. The spec is in the Tickets shape when `spec-tickets` lists any ticket, whatever its body holds, and SPEC.md's Tickets rules then hold as written: a closed ticket is done work, and the four Decision Requests (a cycle, an open blocker outside the spec, an edge that cannot be read, a blocker that gets no building Delegation) are raised as there. When it lists none, the spec is as **Neither** below, and the Decision Request asks for the tickets in the form the tracker file reads.

A Team Run is planned in the [Tickets](SPEC.md#tickets) shape only, since a ticket's assignee is what says whose run builds it:

- **Phases:** a phase has no assignee. Make SPEC.md's offer to publish the phases as tickets; on a yes, the tickets are made unassigned, so the plan has no tickets of this teammate's ([below](#no-tickets-of-your-own)) until the team assigns them. Without a yes, stop, and say that `--spec <n>` without `--team` runs phases.
- **Neither:** as SPEC.md says.

List the spec's tickets with the `spec-tickets` operation. A closed ticket is done work, as in SPEC.md. Each open ticket goes in exactly one group, by its assignees:

| Assignees                                    | Group                                 | In this run                                                                                                                   |
| -------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| only this teammate                           | this teammate's tickets               | Analysed and planned as SPEC.md's [Tickets](SPEC.md#tickets) says, each by its triage role.                                   |
| one other person                             | **Teammates' tickets (not run here)** | Listed with its assignee and its state. That teammate's own Team Run builds it.                                               |
| nobody                                       | `unassigned`                          | Listed. Nobody runs it, and nothing is written on it, until someone is assigned.                                              |
| two or more, this teammate among them or not | needs one assignee                    | Listed, with its assignees. Nobody runs it until exactly one remains: two runs building one ticket would race for one branch. |

A ticket's **state** is the one state label it carries, read through the config's `team.labels` ([CONFIG.md](CONFIG.md#team)): `planned`, `parked`, `running`, `waiting`, `ready to merge` or `merged`. A ticket with none says `no state yet`. One with two or more says which it carries: only its assignee's run writes it, and that run puts it right.

### Blocking across teammates

SPEC.md's waves hold for this teammate's tickets, with the blockers each one has, read with the `blockers` operation, which reads the tracker's own blocking links ([TRACKERS.md](TRACKERS.md)). A blocker that is another ticket of the spec, but not this teammate's, is not SPEC.md's "blocker that gets no building Delegation" Decision Request: it is built in someone else's run, or in nobody's yet. The ticket it blocks is `parked`, and a teammate's blocker counts as cleared only when its pull request is merged, read with the `merged` operation, so the ticket is built on the code it will merge into. A blocker that is closed, or whose ticket is closed, with no merged pull request, is not cleared: it is a Decision Request to this teammate, since only a person knows why it was closed. The plan names, beside the parked ticket, whose ticket it waits on, or that nobody runs it yet when it is `unassigned` or needs one assignee. A blocker outside the spec is as SPEC.md says.

While a ticket is parked, its row's **Parked on** line says on what ([The row](#the-row)). Each time the Chief of Staff wakes, on an `await` event or a heartbeat, and on `--resume`, it reads `merged` for every blocker of each parked ticket. When the last one is merged, the ticket is unparked: its Delegation is spawned from the default branch as it is then, and its row gets the milestone `unparked: #<blocker> merged`. A ticket picked up or restarted from a branch, which the board records beside it ([Picking up a handed-off ticket](#picking-up-a-handed-off-ticket), [RUN.md](RUN.md#after-a-lost-machine)), is spawned from that branch instead, at the remote's head, never from the default branch, so the work on it is kept: its brief says what the branch carries, and the Delegation first merges the default branch into it, as it is then. A conflict in that merge is the Delegation's Decision Request.

## The Dispatch Plan

SKILL.md step 4, with SPEC.md's additions, changed as follows. What is not named here is as written there.

- **It opens** with the harness, as step 4 says, then the tracker, its Support Level ([above](#find-the-tracker)) and this teammate's login.
- **The table** has a row for only this teammate's tickets: one building or analysis Delegation for each, and its QA Delegation where it needs one, as SPEC.md says for one pull request per ticket.
- **Landing:** a Team Run always lands one pull request per ticket: there is no integration branch shared between teammates, and a teammate's ticket that blocks yours lands by its own merge. The plan says `**Landing:** per-ticket`. When the config's `spec.landing` is `integration-branch` or `ask`, it adds that `spec.landing: <value>` is overridden in a Team Run, with the value filled in. SPEC.md's [one pull request per ticket](SPEC.md#one-pull-request-per-ticket) is the landing, from wave to wave.
- **The lists**, after SKILL.md step 4's own:
  - **Teammates' tickets (not run here)**: each with its number, title, assignee and state, and the tickets of this teammate's it blocks.
  - **`unassigned`**: each with its number and title. Nobody runs these.
  - **Needs one assignee**: each with its assignees. Nobody runs these until exactly one remains.
- **Routine writes:** the kinds step 4 lists, and "Shared Board: row comment and state labels on my assigned tickets". It covers only this teammate's own tickets, never a teammate's or an `unassigned` one, and is approved once, at "go". When the `public` operation says the repository is public, that section opens with the line: "This repository is **public**: row comments and state labels are readable by anyone." Each write is as [The Shared Board](#the-shared-board) says, and the approval is recorded on the board.
- **Decision authority** is per teammate: the line covers this teammate's run only, and this teammate's `go` or `go autonomous` sets it. Each teammate chooses their own in their own run, and an `autonomous` run makes Rulings only on its own Delegations.

The board records the three lists beside the plan's rows.

A new Team Run of a teammate whose earlier run folder is gone, after a lost machine, finds their old rows carrying the old run id: its plan asks to take each row over, restarts each unfinished ticket from its branch head, and asks again about each Ruling of the old run not yet reviewed ([RUN.md](RUN.md#after-a-lost-machine)). On `--resume`, a ticket newly assigned to this teammate is shown in an amended Dispatch Plan of its own ([RUN.md](RUN.md#resuming-a-team-run)).

### Missing state labels

Read the repository's labels with the `labels` operation, and compare them with the six names in `team.labels`, ignoring case and spaces at either end, as GitHub compares label names (for GitLab, its tracker file's **Check before use**): a repository label `Team: Planned` is the `team: planned` label, so it is not missing. When any are missing, the plan lists them with one ask to create them all with the `create-label` operation. Creating a label is a write as the human, never routine: it is a Decision Request in the plan, answered with the "go" or before it, and the labels are made only on a yes. A no leaves them uncreated, says so on the board, and the run goes on: a missing label is shown as such, never made without the yes.

### No tickets of your own

When no open ticket's only assignee is this teammate, the plan has no rows. It says that no ticket of spec `#<n>` is assigned to this teammate alone, by their login, shows the three lists, and points to `--status` to follow where the spec stands. There is nothing to "go" on: close the run on the board as having no tickets, and stop. Once a ticket is assigned to them, they start a new Team Run.

**Done when:** the human has said "go" to the plan, or the plan said there are no tickets of their own; the board records which, with the three lists.

## The Shared Board

From "go" until this teammate's run closes, each of this teammate's tickets carries one **Shared Board row**: a comment on the ticket that is a status card, plus one state label. The row is a projection of the ticket's row on the local board, never a store of its own ([ADR 0015](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/adr/0015-the-shared-board-is-a-published-projection-of-each-local-run-folder.md)): `--resume` and verification still read the run folder, never the row. Only this teammate's Chief of Staff writes the rows of this teammate's tickets, and it writes no other ([ADR 0014](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/adr/0014-a-team-runs-shared-board-is-one-single-writer-row-per-ticket.md)).

A row is published, on a public repository to the open web, so it is held to three rules:

- **Every free-text piece is written for publication**: the headline, each question in the "Waiting on" box, and each milestone are written by the Chief of Staff, for this row, from the row's own fields. Each is never copied from a brief, a report, a log or an evidence file, and never quotes command output, a path in the run folder, or a secret.
- **It carries only the fields below**: never the Handle, the Executor kind, the Model or the Wave. Those say how this teammate's machine runs the work, which is theirs.
- **No line starts with `/`**: GitLab runs a note's line that starts with `/` as a quick action, and the same row is written on every tracker. Every line of the row starts with the form's own text, so a value, such as a branch name, never opens a line.

### The row

```markdown
**<headline>**

`<state label>` · <fine state>

> **Waiting on @<login>:** <question>

- **Assignee:** @<login>
- **Branch:** `<branch>` at `<head>`
- **Pull request:** #<pr>
- **Parked on:** #<blocker> (@<teammate>) merged
- **Decision authority:** <relay, or autonomous>
- **Rulings: <N> awaiting @<login>'s review**
- **Conflicts with:** #<pr> (@<teammate>), first merged wins

**Recent activity**

- <MM-DD HH:MMZ> <milestone>

Updated <YYYY-MM-DD HH:MMZ>.

<sub>Maintained by orchestrate for @<login>'s Team Run. Edits here are overwritten.</sub>

<!-- orchestrate:shared-board-row ticket=<n> run=<run> author=@<login> -->
```

`<login>` is this teammate's, read with the `viewer` operation. A tracker file may say how its references differ: on GitLab, where the row says `#<pr>`, it writes the merge request as `!<mr>`, its `iid`, since `#<n>` there links an issue ([trackers/gitlab.md](trackers/gitlab.md#writing-the-row-on-gitlab)). Each part:

| Part                       | What it says                                                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headline                   | One sentence: where the ticket stands, in the words [States and labels](#states-and-labels) gives for its fine state.                                                                                                                                                                       |
| State label and fine state | The ticket's state label, as `team.labels` names it, and its fine state, the state of its building or analysis Delegation on the local board ([RUN.md](RUN.md#states)).                                                                                                                     |
| Waiting on                 | One `>` line for each open Decision Request that waits on this teammate: its question, in one line, written for publication from its heading. In an autonomous run, only the ones the Chief of Staff does not rule on. Left out when there is none.                                         |
| Assignee                   | This teammate.                                                                                                                                                                                                                                                                              |
| Branch                     | The Delegation's branch and its head's short SHA, or `none yet` before it is spawned.                                                                                                                                                                                                       |
| Pull request               | Its number, or `none yet`.                                                                                                                                                                                                                                                                  |
| Parked on                  | While the ticket is `parked`, what it waits on: each blocker that is not merged yet, with whose ticket it is, or `nobody runs it yet` for one `unassigned` or needing one assignee ([Blocking across teammates](#blocking-across-teammates)). Left out when it is not parked.               |
| Decision authority         | `relay` or `autonomous`: this teammate's own, from their "go".                                                                                                                                                                                                                              |
| Rulings                    | In an autonomous run, the number of Rulings concerning this ticket's branch that are `unreviewed` or `needs re-review` in the Ruling Ledger, shown only while <N> is not zero. Only the count: the Rulings themselves stay in the ledger ([Rulings in a Team Run](#rulings-in-a-team-run)). |
| Conflicts with             | Each open pull request of a teammate's ticket that this ticket's branch conflicts with ([Conflicts with a teammate's branch](#conflicts-with-a-teammates-branch)). Left out when there is none.                                                                                             |
| Recent activity            | The last `team.recent_activity` milestones, newest first, each with its time in UTC, from the list in [Milestones](#milestones).                                                                                                                                                            |
| Updated                    | The time of the row's last change, in UTC. Readers tell a row's age from it: nothing in the row says whether the run is alive.                                                                                                                                                              |
| Footer                     | Says who keeps the row, and that a person's edit is overwritten on the next write.                                                                                                                                                                                                          |
| Marker                     | Hidden when the comment is rendered: the ticket's number, this run's id (its run folder's name) and the author's login. The `row` operation finds a row by it.                                                                                                                              |

### States and labels

A ticket's fine state is the state of its building or analysis Delegation on the local board ([RUN.md](RUN.md#states)); a QA Delegation's own states show on its ticket's row only as milestones. Its coarse state is one of the six that `team.labels` names, and its headline is the sentence below, with the row's own fields filled in:

| Fine state               | Coarse state                                             | Headline                                                                                                                                |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `planned`                | `planned`                                                | Planned in @<login>'s Team Run, not started yet.                                                                                        |
| `parked`                 | `parked`                                                 | Parked until #<blocker> is merged, then built on the default branch as it is then, or on the branch it was picked up or restarted from. |
| `running`                | `running`                                                | Being built on `<branch>`, with no pull request yet; or, once there is one, #<pr> is being worked on.                                   |
| `waiting`                | `waiting`                                                | Waiting on @<login> to answer <k> question(s); work on it is paused until then.                                                         |
| `reported`               | `running`                                                | Its work is reported, and @<login>'s Chief of Staff is checking it.                                                                     |
| `sent back`              | `running`                                                | Sent back to be fixed after its check.                                                                                                  |
| `verified`               | `running`                                                | #<pr> is checked and waits on its QA.                                                                                                   |
| `stalled`                | `waiting`                                                | Stalled, and raised to @<login>.                                                                                                        |
| `crashed`                | `waiting`                                                | Its session ended without a report; its branch is kept, and it waits to be restarted from it.                                           |
| `analysed`               | `waiting`                                                | Its options are with @<login>, waiting on a choice.                                                                                     |
| `landed`                 | none: a Team Run has no integration branch               | Never shown.                                                                                                                            |
| `passed`                 | none: a QA Delegation's state, a milestone on its ticket | Never shown.                                                                                                                            |
| `failed`                 | none: a QA Delegation's state, a milestone on its ticket | Never shown.                                                                                                                            |
| `void`                   | none: a QA Delegation's state, a milestone on its ticket | Never shown.                                                                                                                            |
| `awaiting Ruling Review` | `waiting`                                                | Waiting on @<login> to review <N> Ruling(s) before it can merge.                                                                        |
| `ready to merge`         | `ready to merge`                                         | Ready to merge: #<pr> passed every check and merges cleanly into the default branch.                                                    |
| `merged`                 | `merged`                                                 | Done: #<pr> was merged on <YYYY-MM-DD>.                                                                                                 |
| `dropped`                | none: its state label is removed                         | Taken out of @<login>'s Team Run; nobody runs it here now.                                                                              |

The state label changes only when the coarse state changes, with the `set-state` operation: it adds the coarse state's label and removes any other of the six the ticket carries, so the ticket carries exactly one. A `dropped` ticket's label is removed, and its last row write says it was dropped, except on a hand-off, where the label is left for the new owner ([Handing a ticket off](#handing-a-ticket-off)). A state label the repository does not have, because the human said no to creating it ([Missing state labels](#missing-state-labels)), is not written, and the row is written as usual.

`set-state` reads the ticket's labels back after each write, since a tracker can drop a label change silently, with no error (the tracker file says when). When the read-back does not show the new label, its name compared ignoring case and spaces at either end, as in [Missing state labels](#missing-state-labels), the label write did not hold, and the row comment stays the record. Log it once in the Activity Log, and put `Shared Board labels: not held, <why>` on the board, under the `Team Run:` line. It is not a Decision Request, and it is not retried until the next coarse state change.

### When a row is written

Rows and labels are written under the routine write "Shared Board: row comment and state labels on my assigned tickets", approved once at "go", and only on this teammate's own tickets: those the plan put in this teammate's group. Never on a teammate's ticket, an `unassigned` one, or one that needs one assignee, and never before "go" or after the run is closed. The one exception is the last row write of a ticket handed off on the human's yes ([Handing a ticket off](#handing-a-ticket-off)).

A row is written only when its text would change, so only when one of its parts changes: the fine state, a Decision Request opened or answered, the branch's head, the pull request, what it is parked on, the Rulings count, a conflict found or gone, or a new milestone. Each time, the Chief of Staff renders the row from the local board into the run folder, `shared-board/<n>.md`, and compares it with the copy it last wrote. When nothing changed, nothing is written, so a heartbeat that finds nothing new writes nothing (and `--status` writes nothing at all). The **Updated** time is part of the change, never a reason for one.

The first write, right after "go", is the `planned` or `parked` row of each of this teammate's tickets, with its state label. Each write, that one included, is made only while the ticket's single assignee is this teammate, re-read just before it ([Who writes](#who-writes)). Then:

1. Read the ticket's row comments with the `row` operation. The row to edit is the one whose marker carries this run's id and this teammate's login. A row of this teammate's with another run's id is never edited ([Two runs of one teammate](#two-runs-of-one-teammate)).
2. Write it with the `write-row` operation: edit that comment by its id, or create one when there is none, as for a row a person deleted ([A person's edits](#a-persons-edits)), and record its comment id on the board, beside the ticket's row: `Shared Board row: #<n> comment <id>`.
3. When the coarse state changed, write the state label with `set-state`, after the row, so a label never runs ahead of the row it mirrors.

These add to the run folder ([RUN.md](RUN.md#layout)) a `shared-board/` folder holding the copy of each row as last written, `<n>.md`, and to the board ([RUN.md](RUN.md#board)) the `Shared Board row:` line of each ticket and, when a label write did not hold, the `Shared Board labels:` line under `Team Run:`.

A write that fails is logged with what the tracker printed, and the run goes on; the next change writes the row again whole. The Shared Board never holds up the work.

### Milestones

The **Recent activity** list keeps the last `team.recent_activity` milestones (default 5), each with its time in UTC, `MM-DD HH:MMZ`. A milestone is one of these lines, with only its fields filled in:

- `planned`
- `parked on #<blocker>` and `unparked: #<blocker> merged`
- `spawned from <branch>@<head>`
- `reported`, `verified`, `sent back` and `stalled`
- `pull request #<pr> opened`, and `pushed <head>`
- `stopped on a Decision Request` and `question answered`
- `QA passed on <head>` and `QA failed on <head>`
- `crashed, branch kept at <head>` and `restarted from <head>`
- `ready to merge`, `merged` and `dropped`
- `` handed off to @<login> at `<branch>@<head>` ``, or `handed off to @<login>, not started`, the old owner's last milestone when a ticket is reassigned ([Handing a ticket off](#handing-a-ticket-off))
- `` picked up from @<login> at `<branch>@<head>` ``, the new owner's first milestone on a ticket handed off to them ([Picking up a handed-off ticket](#picking-up-a-handed-off-ticket))

## Ownership

A ticket's row has one writer: the Chief of Staff of its current assignee ([ADR 0014](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/adr/0014-a-team-runs-shared-board-is-one-single-writer-row-per-ticket.md)). Neither tracker locks a comment or a label against a second writer, so the rules below keep any two runs from ever writing the same row: a teammate's, and another run of this teammate's own. People change things mid-run, by reassigning a ticket or editing its row, and none of that is ever answered by stopping work unasked.

### Who writes

Just before every `write-row` and every `set-state`, the Chief of Staff re-reads the ticket's assignees with the `spec-tickets` operation, and writes only while the ticket's single assignee is this teammate. The assignee read at "go", or at the last write, is never enough: the tracker's assignee is the only sign of whose ticket it is, and the human sets it at any time. It also re-reads them each time it wakes, on an `await` event or a heartbeat, and on `--resume` ([RUN.md](RUN.md#resuming-a-team-run)), so a ticket that has no row change pending is not reassigned unseen.

When the re-read shows any other assignees, or none, nothing is written on the ticket, neither the row nor its label, and the work is not stopped: the ticket has been assigned away ([Reassignment](#reassignment)). Writing resumes only when a re-read shows this teammate as its single assignee again. The one write made on a ticket assigned away is the hand-off's last row write, on the human's yes ([Handing a ticket off](#handing-a-ticket-off)).

### Reassignment

A ticket of this teammate's whose Delegation is running or parked, or waits on anything in the run, and whose re-read shows it assigned away, is a Decision Request to this teammate, its old owner, raised as soon as the re-read sees it. It is never a Ruling, in an autonomous run too: whether to give up a ticket is the human's, as stopping or dropping a Delegation is ([SKILL.md](SKILL.md#autonomous-runs)). It says who the ticket is assigned to now (one person, nobody, or several), the branch and its head, and what is done and left, and gives two options:

1. **Hand it off**: the branch is pushed, the row says where, and this run drops the ticket ([Handing a ticket off](#handing-a-ticket-off)). The new owner's run carries on from that branch.
2. **Ask for it back**: the ticket stays in this run, and the human asks whoever reassigned it to assign it back. A Chief of Staff never sets an assignee. The run writes nothing on the ticket until a re-read shows this teammate as its single assignee again.

Recommend the hand-off when the ticket now has one assignee, since the team has said whose it is; when it has none or several, recommend asking for it back, since there is nobody yet to hand it to, and a hand-off waits until a re-read shows exactly one.

While the question waits, the Delegation is never stopped unasked: it goes on with its work, and stops only on the human's answer. Only the Shared Board writes on that ticket pause. A ticket that is `planned` and not yet spawned is not spawned while the question waits.

### Handing a ticket off

On the yes to hand it off, in this order, each step done before the next:

1. The Delegation pushes its branch, as it stands, and reports its head; the Chief of Staff `message`s it to, and then stops it. A Delegation that no longer answers is not waited on: the Chief of Staff pushes its branch from its worktree as it is.
2. The Chief of Staff makes one final row write, the last on this ticket: its row, with the fine state `dropped`, the headline "Handed off to @<new>; @<new>'s Team Run carries it on.", and, as its newest milestone, the line "handed off to @<new> at `<branch>@<head>`", with the head just pushed. This write is made although the ticket is no longer this teammate's, on the human's yes, and it is never repeated.
3. The ticket's row on the local board becomes `dropped`, with `` handed off to @<new> at `<branch>@<head>` `` beside it, and the ticket leaves this run: no more writes on it, and its worktree is kept as it is.

The state label is left as it is, not removed as for another `dropped` ticket: it is the new owner's to set now, and its next `set-state` puts it right. A ticket handed off before its Delegation was spawned has no branch to push: step 1 is skipped, and its final row line says `handed off to @<new>, not started`.

### Picking up a handed-off ticket

A ticket newly assigned to this teammate is planned by their own run: in the Dispatch Plan of a new Team Run, or in the amended Dispatch Plan `--resume` shows for it ([RUN.md](RUN.md#resuming-a-team-run)). Before it is planned, read its row comments with the `row` operation. When a row comment by another author has as its newest milestone `` handed off to @<this login> at `<branch>@<head>` `` (the newest such comment, when there are several), its author is the previous owner, and the plan says, beside the ticket, `` picked up from @<previous> at `<branch>@<head>` ``, and the board records it beside the ticket's row. On "go" the Chief of Staff starts a new Delegation from that branch, as a crashed Delegation's branch is picked up ([SKILL.md](SKILL.md#6-run-the-loop)): it fetches the branch from the remote, the new Delegation works on it from that head, and its brief says the branch carries the previous owner's work, to be read before it builds on it. The Executor and model are this run's own choice. When the remote's head of that branch is not the head the milestone names, or the milestone says `not started`, the plan says so, and the Delegation starts from the head the remote has, or from the default branch for `not started`.

A ticket that has another author's row but none handed off to this teammate, because the previous owner's run never answered, is a Decision Request in the plan: the plan names the newest such row's author, branch, head and age, and asks whether to start from that branch as the remote has it or from the default branch. Recommend the branch when the remote has it. On the branch, the board records `` picked up from @<author> at `<branch>@<head>` `` beside the ticket's row, as for a hand-off, and a parked ticket is unparked from it.

The new owner's first write is a **new** row comment, made with `write-row` and carrying this run's id and this teammate's login in its marker. It never edits the previous owner's comment, which keeps its hand-off milestone: editing another person's comment needs write access, and that row is the previous owner's record. Its first milestone is `` picked up from @<previous> at `<branch>@<head>` ``, and `spawned from <branch>@<head>` follows when its Delegation is spawned, at once or, for a parked ticket, when it is unparked.

### Which comment is the row

A ticket can carry several row comments, one for each owner it has had. A row comment counts only when its marker's `author` is the login of the comment's own author, as the `row` operation reads it. Whoever reads the Shared Board, `--status`, a teammate's Dispatch Plan, or an observer, takes as the ticket's row the row comment written by the ticket's current assignee, the newest of theirs when there are several. Here, and wherever this file or RUN.md takes the newest of several row comments, the newest is the one with the latest `updated_at`, as the `row` operation reads it: the one changed last, not the one created last. So after a take-over ([Two runs of one teammate](#two-runs-of-one-teammate)), the row is the comment the run goes on writing, even when the other run created its own later. When there is none, because the new owner's run has not written yet or the ticket has no single assignee, the reader takes the newest row comment and shows it as stale: `stale: written by @<author>, who is not the assignee`. The older comments stay as they are: nothing deletes them.

### Two runs of one teammate

One teammate can have two Team Runs on one spec: a second session started by mistake, a run on another machine, or a new run after a lost one. Each run's id is in its rows' markers, and it is the only thing that tells the two apart, since both write as the same login. So a row comment of this teammate's, its marker's `author` and its comment author both this teammate's login, that carries another run id is never overwritten, and no second row is created beside it. When the `row` read before a write finds one, whether or not this run has its own row there too (two runs that both wrote first, right after their "go"), nothing is written on that ticket, a ticket not yet spawned is not spawned, and the Chief of Staff raises a Decision Request to this teammate. It is never a Ruling. It names the other run's id, the row's fine state, branch and head, and when it last changed, and gives two options:

1. **Resume that run**: this run drops the ticket, writing nothing on the tracker, and the human carries it on with `--resume` of the run named in the row, where its run folder is.
2. **Take the row over**: from now on this run writes the ticket's row with this run's id in its marker: its own row comment when it has one, or else that comment, edited by its id. The other run, if it still runs, finds a row with an id not its own at its next write, and asks the same question there, so neither ever overwrites the other unasked.

Recommend resuming that run when its run folder is on this machine and not closed, and taking the row over when it is not, as after a lost machine ([RUN.md](RUN.md#after-a-lost-machine)). With several such rows, the newest is the one taken over; the older stay as they are.

### A person's edits

A row is the Chief of Staff's, and its footer says a person's edits are overwritten. What a person changes on the tracker is put right by the next write, never fought over as it happens:

- **An edited row** is overwritten on the next write: the row is rendered whole from the local board and compared with the run folder's own copy, `shared-board/<n>.md`, never with the comment, so an edit alone causes no write, and the next change replaces the comment's whole body.
- **A deleted row**, or one whose marker was edited away, is re-created on the next write: the `row` read finds no comment with this run's id, so `write-row` creates a new one, and its new comment id replaces the old on the board. An edit that fails because the comment is gone is answered the same way.
- **A removed state label**, or another state label added beside it, is restored on the next state change: `set-state` adds the coarse state's label and removes every other of the six. Until that change, the row stays the record, and nothing is written for the label alone.

A person's edit never changes who writes the row: only the assignee does ([Who writes](#who-writes)).

## Conflicts with a teammate's branch

A Chief of Staff rules only on its own branches. At SKILL.md step 8, beside the conflicts between this run's own branches, it test-merges each of this teammate's verified branches against the head of every open pull request of a teammate's ticket of the spec: found with `merged`, which lists each ticket's pull requests and their state, and read with the `pull-head` operation. It never changes, merges or comments on a teammate's branch or pull request, and a merge order between this teammate's branch and a teammate's is not its to set, nor a Ruling.

A conflict is shown on the row instead, in its **Conflicts with** line: the teammate's pull request and whose it is. It is not a Decision Request. First merged wins: whichever pull request merges first lands as it is, and the other merges the default branch in and re-gates, as SKILL.md step 10 says for a branch the default branch has moved past. The line is removed when the conflict is gone, or when either pull request is merged.

## Rulings in a Team Run

In a Team Run approved with `go autonomous`, the Chief of Staff rules only on this teammate's own Delegations, and only this teammate reviews its Rulings: the Ruling Ledger, and the evidence each Ruling cites, never leave this teammate's run folder. A Ruling line recorded where `decisions.to` says names whose Chief of Staff made it, in the place of the `Chief of Staff ruling, not yet reviewed` line of BRIEF.md's [Ruling form](BRIEF.md#ruling):

```text
R<n> (@<login>'s Chief of Staff ruling, not yet reviewed): <question> → <choice>
```

After the Ruling Review ([SKILL.md](SKILL.md#autonomous-runs)), `not yet reviewed` in it is updated as BRIEF.md's [Ruling](BRIEF.md#ruling) section says. A teammate, reading the pull request, sees whose ruling it is and that it is not theirs to review. The row carries only how many await review ([The row](#the-row)).

## What stays local

The Shared Board publishes only the row and the state label. Everything else stays in this teammate's run folder, exactly as in a single-person run ([RUN.md](RUN.md#layout)): the briefs, the reports, the full Decision Requests and their answers, the Ruling Ledger, the evidence, both kinds of Activity Log, and the QA Plans and QA Reports. A QA Report reaches a pull request only through the QA skills' own post-on-a-yes route. Decision answers and Ruling lines are recorded where `decisions.to` says, as in any run. The copies of the rows in `shared-board/` are the run's own, too.
