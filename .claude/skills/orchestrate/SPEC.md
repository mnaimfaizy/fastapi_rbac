# Spec mode

`/orchestrate --spec <n> [go]` runs a whole spec: the issue `#<n>` and the work it holds. Load this file only for `--spec`, or on `--resume` of a run whose board names a spec ([RUN.md](RUN.md#resume)); a run on a set of issues never reads it. It changes steps 3 to 9 of [SKILL.md](SKILL.md#workflow) where it says so, and leaves every rule and every other step as written there.

## Read the spec

After SKILL.md steps 1 and 2 (the run folder is named for the spec, [RUN.md](RUN.md#layout)), read the spec issue: its body, its comments, its labels, its sub-issues, and each sub-issue's own blocking edges. On GitHub, as read from GitHub's REST API on 2026-11-13. **Check before use:** the first run that relies on an endpoint records in its Activity Log what it returned, as [HARNESSES.md](HARNESSES.md#where-each-fact-comes-from) does for harness facts.

- sub-issues: `gh api --paginate --slurp repos/<owner>/<repo>/issues/<n>/sub_issues`;
- an issue's native blockers: `gh api --paginate --slurp repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by`;
- a "Blocked by" section in an issue's body, listing issues by number, is a blocking edge too, read the same as a native one.

Both endpoints serve a list a page at a time. Without `--paginate`, a spec with more sub-issues than one page holds loses the rest silently; without `--slurp`, each page prints as an array of its own, one after another, which is not one JSON document. With both, the output is one array of pages: read every page.

A spec that is closed is a Decision Request before anything else: say what is there, and recommend stopping or going on.

Then decide which of three shapes the spec is. The first that fits is the shape:

| Shape               | When                                                                     | Becomes                                                                   |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [Tickets](#tickets) | It has at least one sub-issue.                                           | One Delegation per open ticket; the waves follow the blocking edges.      |
| [Phases](#phases)   | No sub-issues, and its body is broken into phases or steps, each headed. | One Delegation per phase, in the order written; an offer to publish them. |
| [Neither](#neither) | No sub-issues and no phases.                                             | No Delegations: one Decision Request to break it down.                    |

Record the shape on the board.

## Tickets

Each sub-issue is a ticket. Analyse each open ticket as SKILL.md step 3 analyses an issue: by its triage role, with its own scope fence. Its QA is the landing's: see [QA in the Dispatch Plan](#qa-in-the-dispatch-plan). A closed ticket is done work: it is listed as done, not delegated, and a ticket it blocks is not held for it. A ticket that an open pull request already closes is a Decision Request, as in step 3. A ticket with sub-issues of its own is still one Delegation; say so in the plan, so the human can run it as a spec of its own instead.

Waves follow the blocking edges between tickets: a ticket is in a later wave than every open ticket that blocks it, and the overlap and limit rules of step 4 still hold. Four cases are Decision Requests, raised in the plan, and the tickets they touch are not planned until each is answered:

- a cycle (two tickets that block each other, directly or through others): name the tickets in it, and recommend which edge to drop;
- an open blocker outside the spec: name it, and recommend parking the ticket until it is closed, or taking it out of the run;
- an edge to an issue that cannot be read: name it;
- a blocker that gets no building Delegation (it is analysed, `ready-for-human` or `wontfix`): it will never land or merge in this run, so name it, and recommend dropping the edge, settling the blocker first, or taking the blocked ticket out of the run.

The same holds during the run: a Delegation dropped on the human's yes never lands or merges either. The Decision Request that proposes dropping it names each open Delegation it blocks, and asks for each whether to drop the edge or take it out of the run too, so none is left parked for good.

## Phases

The spec's body is the breakdown: each phase or step, by its heading, is one Delegation. The Delegation's id is `d<n>-p<k>`, for the spec `#<n>` and the phase's place `<k>` in the body.

- **Order.** Phases run in the order written: each is in a later wave than the one before it. Where the spec says otherwise (two phases are independent, or one waits for another that is not just before it), follow what it says, and quote the line in the plan.
- **The phase is the spec.** The phase's own text is the Delegation's goal and its done criteria, carried whole in the brief's "Goal, and what done means". The brief's "Read first" names the spec issue too, for context. A phase with nothing that says when it is done is listed in the plan, so the human can give its criteria before "go".
- **Readiness** is the spec's own: its phases are as ready as it is. A spec whose triage role, read through the label mapping from step 1, is anything but `ready-for-agent` gets no building Delegations: it is a Decision Request, with the role it carries, recommending it be triaged first.
- **No phase closes the spec.** A phase's pull request body says it is part of `#<n>`, never that it closes it. The human closes the spec.

Before the Dispatch Plan, offer to publish the phases as tickets first, so the tracker shows the same breakdown the run uses. Publishing is a write as the human, and needs a yes:

1. Draft one ticket per phase: its title from the phase's heading, its body the phase's own text, a line saying it is part of `#<n>`, and a "Blocked by" section naming the ticket of each phase it waits for.
2. Show the drafts whole, in one Decision Request, with the options: publish them as sub-issues of `#<n>` and plan from the tickets, or plan from the phases as they are.
3. On a yes, create each ticket, add it as a sub-issue of `#<n>`, log each one, and plan again in the [Tickets](#tickets) shape. Without a yes, plan from the phases.

## Neither

A spec with no sub-issues and no phases gets no Delegations. Raise one Decision Request to break it down, with what the spec holds, and the options: break it into tickets under the spec, or write its phases or steps into its body; then run `--spec <n>` again. Recommend tickets when the parts can be reviewed apart, and phases when they cannot. Close the run on the board as waiting on that answer, and stop.

## The landing

The Dispatch Plan also says how the work lands, with what each choice costs. `spec.landing` in the config sets the repository's default ([CONFIG.md](CONFIG.md#spec)). With `ask`, the default, the plan asks, and the human's "go" names the landing. Either way the plan states it and its cost, and the board records it.

| Landing                                           | What the human gets                                                | What it costs                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`integration-branch`](#on-an-integration-branch) | One pull request to the default branch, with the whole spec in it. | One large review at the end. No CI runs on a ticket until that pull request opens: each ticket is checked by the `regate` commands alone, so with `regate: []` nothing checks it. An Executor that works from a clone needs the branch pushed (below). |
| [`per-ticket`](#one-pull-request-per-ticket)      | One pull request per ticket, each reviewed and merged on its own.  | The human merges between waves: a later wave is parked until its blockers are merged, and the run continues with `--resume`. Phases in the order written are a wave each, so that is a merge after every phase. More reviews, each small.              |

### QA in the Dispatch Plan

Which QA rows the plan shows depends on the landing, so they are decided with it:

- **`integration-branch`:** no ticket gets a QA Delegation, since no ticket has a pull request. The plan has one QA row, `d<n>-qa`, for the integration branch's pull request, run after the `<integration>` row is `verified`. With `qa: report` and no labels, it is always required. With `qa_labels`, the plan lists it when any planned ticket carries one, and the requirement is checked again when the pull request opens, against the tickets that landed: when none of them carries one (a labelled ticket was dropped or left out), say so, and drop the QA row on the human's yes.
- **`per-ticket`:** each ticket that needs QA gets its own QA row, as SKILL.md step 3 says for an issue.
- **`ask`:** the plan shows both sets of QA rows, each under its landing, and the "go" that names the landing approves that landing's set.

### On an integration branch

The integration branch is named by `spec.integration_branch`, with `<n>` replaced by the spec's number.

1. **Cut it at "go".** Fetch, then create the branch from the default branch's remote head, as a local branch: `git branch <integration> <remote>/<default>`. Never check it out, here or in any worktree: the Chief of Staff moves it by reference only. If a branch of that name is already there, locally or on the remote, it is a Decision Request (resume the run that made it, or name another), unless it is this run's own on `--resume`. So is any other failure of `git branch` here, such as a branch `orchestrate` that clashes with `orchestrate/spec-50`: say what git said. Record the name and its head on the board.
2. **It stays local.** A Live Session or headless run in a worktree of this repository, and a sub-agent, see the branch without a push. An Executor that works from a clone cannot. Pushing the branch for one is a Decision Request that says the branch is public until it is deleted, and names what it holds, and that the ticket branch of each Executor in a clone is pushed and public too; recommend an Executor that works in a worktree instead, where the harness has one. A yes covers pushing those branches for the rest of the run, the integration branch again after each fast-forward (item 5) so a later Executor in a clone starts from its new head, and is logged. Each of those pushes is a fast-forward, never a force-push.
3. **Cut each ticket branch from it.** Before `spawn`, create the Delegation's branch at the integration branch's current head (`git branch <ticket branch> <integration>`), and record that commit on the board. A failure here (a branch of that name left by an earlier run, a clashing name) is a Decision Request, with what git said; the Chief of Staff never deletes the old branch to make room. The brief's "Command routes" says to work on that branch (switch to it in the Delegation's own working copy, which must not create it again), and that the Delegation commits there but neither pushes it nor opens a pull request: its work lands through the integration branch. An Executor working from a clone pushes its ticket branch, under the yes from item 2.
4. **Verify the report.** SKILL.md step 7, with the branch checked locally (or fetched, for a clone): its head is the commit the report names, and it descends from the commit it was cut at. A ticket has no pull request or CI of its own yet, so those checks wait for the integration branch's pull request, and the re-gate is the ticket's only check.
5. **Fast-forward it back, in plan order.** Take verified tickets one at a time in the plan's order (wave, then row), not in the order they finish. A `dropped` Delegation and an analysis Delegation have nothing to land, and are skipped in that order. One that is `waiting`, `stalled` or `crashed` holds up every ticket after it, so raise that as a Decision Request (wait for it, or land the tickets after it that do not need it, and plan it again later), never a silent wait. For each:
   - **Pin the verified commit**: the commit its verified report names (item 4), never the branch's head read again now. Use that commit, not the branch name, for every check and move below. If the branch has moved past it (its Executor committed after reporting), those commits were never verified: `message` the Delegation for a new report, and verify it before landing anything.
   - If the pinned commit does not descend from the integration branch's head (an earlier ticket landed after it was cut), `message` the Delegation to merge the integration branch into its own branch, resolving any conflict in a new commit, then report again; verify again, and pin the new verified commit. A rebase would rewrite commits the board has recorded.
   - Check that no worktree has the integration branch checked out (`git worktree list --porcelain` names no `branch refs/heads/<integration>`). If one does, it is a Decision Request: moving the branch under it would leave that working copy showing the landed ticket as changes undone.
   - **Re-gate the integration branch** at the head it is about to have. A fast-forward makes the pinned commit the branch's new head, so run each `regate` command on the pinned commit, in a detached worktree the Chief of Staff removes afterwards. If one fails, the branch does not move: stop the landing and raise it as a Decision Request, with what failed and on which commit, recommending the ticket's Delegation fix it on its own branch, or a fix Delegation. A ticket that failed never enters the integration branch, so the branch is never moved back.
   - Then move the integration branch to the pinned commit, only if it is still where it was read: `git update-ref refs/heads/<integration> <pinned commit> <integration head>`. That refuses anything but the expected old value, and the descent check above, made on that same commit, makes it a fast-forward. The branch's new head is the commit just verified and re-gated.
   - Mark the Delegation `landed` on the board, with its **landed commit** (the pinned commit, now the integration branch's head), and log it.
6. **Start the next wave from it.** A Delegation parked behind a blocker or an overlap starts once what it waits for has landed on the integration branch, cut from the head after it. No merge to the default branch is needed between waves.
7. **One pull request at the end.** When every ticket has landed and the last re-gate passed, check each landed ticket's branch against its landed commit. A branch that has moved on holds commits that are not in the integration branch: raise it as a Decision Request (land them as another pass, through items 4 and 5, or leave them out), never a silent drop. Then draft the pull request from the integration branch to the default branch, by `routes.pull_request`: its title, and a body that names each ticket or phase, closes each ticket, and lists each decision recorded in the run. Opening it pushes the branch, so it is a write as the human: raise the draft as a Decision Request, saying the branch becomes public, and push and open it only on a yes. That yes also covers pushing later fixes to that branch for that pull request.
8. **Ready to Merge** is SKILL.md steps 7 to 9 on that one pull request: CI, review, a clean merge, then QA. The run's one QA Delegation, `d<n>-qa` from the plan ([above](#qa-in-the-dispatch-plan)), tests that pull request's head. A review finding goes to a building Delegation cut from the integration branch, landed by item 5, and pushed under item 7's yes. A fix Delegation, here or after a failed re-gate, is `d<n>-fix<k>`, for the spec `#<n>`, its issue.
9. **The board** gives the integration branch's pull request a row of its own, Delegation `<integration>`, with its URL, its head and its state. It takes the building states of SKILL.md steps 7 to 9: `verified` once steps 7 and 8 hold for its head, when it needs QA, and `ready to merge` once `d<n>-qa` has passed; every ticket stays `landed` until that row is `merged`, and then is `merged` with it. A ticket that has `landed` is done for SKILL.md step 6. Close-out (step 10) lists that one pull request, with every ticket it lands.

### One pull request per ticket

Each ticket is a Delegation of its own, as in a run on a set of issues: its branch is cut from the default branch, and it opens its own pull request, whose body closes its ticket (or, for a phase, says it is part of the spec).

1. **Wave by wave.** Dispatch the first wave, and run SKILL.md steps 6 to 9 on it: each ticket's pull request is QA'd on its own head, where its labels require it.
2. **Park the rest.** Every Delegation in a later wave whose blocker is not merged stays `parked`. When the wave's Delegations are Ready to Merge, close out that wave (step 10): its Ready to Merge list and merge order, the Delegations still parked and what each waits for, and the line to type once the merges are done: `/orchestrate --resume <run>`.
3. **Resume.** `--resume` ([RUN.md](RUN.md#resume)) finds what the human merged, and starts each parked Delegation whose blockers are all merged, from the default branch as it now is. Repeat until no Delegation is parked.

## Close-out

The run ends as SKILL.md step 10 says, and the Run Summary goes on the spec issue. No pull request or Delegation closes the spec. Closing it is a write as the human: offer it with the Run Summary, once nothing is left open, and close it only on a yes.
