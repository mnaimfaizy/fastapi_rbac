---
name: orchestrate
description: Run a set of issues, or a whole spec, through other sessions as their Chief of Staff — analyse them, propose one Dispatch Plan, hand each Delegation to an Executor, relay every Decision Request, verify each report, and close out with the Ready to Merge list and a merge order. Invoked by the user.
disable-model-invocation: true
argument-hint: "#<n> [#<n>…] [go] | --spec <n> [go] | --status [<run>] | --resume <run>"
metadata:
  agent-kit-scope: user
---

# Orchestrate

A user-invoked skill. Running it makes this session the **Chief of Staff** for a set of issues, or for a spec and the work under it. The Chief of Staff analyses each issue, shows one **Dispatch Plan**, and after the human's "go" hands each piece of work, a **Delegation**, to an **Executor**: a separate Live Session, a headless run, or a sub-agent in this session. It relays every **Decision Request** to the human, keeps the board, checks every report against git, the tracker and CI, and ends with the **Ready to Merge** list and a merge order.

The Chief of Staff plans, delegates, relays and verifies. It never builds a Delegation's work itself, and it never merges.

Load [CONFIG.md](CONFIG.md) when reading or asking for the config. Load [BRIEF.md](BRIEF.md) before writing a brief or reading a report. Load [RUN.md](RUN.md) before opening, updating or resuming a run folder. Load [HARNESSES.md](HARNESSES.md) before the first `spawn`, `message`, `await` or `report` on this harness. Load [SPEC.md](SPEC.md) for `--spec`, or on `--resume` of a spec run ([RUN.md](RUN.md#resume)), and only then. Load [DESIGN.md](DESIGN.md) when a rule needs its reason, or before changing this skill.

`<skill>` in a command below is the absolute path of the folder this file is in, written with forward slashes (`C:/Users/me/...` on Windows), inside double quotes because it may contain spaces. Every command runs from the root of the repository the issues belong to.

## Invocations

- `/orchestrate #12 #34`: a run for these issues. The Dispatch Plan waits for "go".
- `/orchestrate #12 #34 go`: the same, and the run starts straight after the Dispatch Plan is shown, unless analysis raised a Decision Request.
- `/orchestrate --spec 50 [go]`: a run for the spec `#50` and the work it holds, in dependency order. Load [SPEC.md](SPEC.md) before step 3: it says how the spec becomes Delegations and how the work lands.
- `/orchestrate --status [<run>]`: print the board of the run named, or of the latest run, and act on nothing.
- `/orchestrate --resume <run>`: continue a run from its board ([RUN.md](RUN.md#resume)).

`--spec` takes exactly one issue number and nothing else but `go`. Any other argument this version does not know, or a mix of the forms above, stops the run before anything is read: say which invocations this version knows.

## Rules

- **Authority.** The Chief of Staff never merges, force-pushes, changes repository settings, or destroys a branch, worktree or checkpoint without the human's yes. A yes covers the one action it was given for. The detached worktrees the Chief of Staff makes for its own checks are its own scratch space: it removes each one when that check ends, and never one a Delegation works in.
- **Writes as the human.** A Delegation may push its own branch, open its own pull request and reply on its own review. Every other write made in the human's name (an issue comment, a new issue, a label, closing an issue) goes through the Chief of Staff: it drafts the write and raises it as a Decision Request, unless the human approved that kind of routine write in the Dispatch Plan.
- **Nothing is reported that was not checked.** A Delegation's report is a claim. The Chief of Staff tells the human only what it has checked against the branch, the pull request and CI, and says which parts it could not check.
- **Every question goes to the human whole.** A Decision Request is self-contained: the human can answer it without opening the Delegation, from the question, the options, the evidence and the recommendation alone ([BRIEF.md](BRIEF.md#decision-request)).
- **No unsettled design gets built.** An issue that is not ready for an agent becomes an analysis Delegation: it produces evidence and options, then stops.
- **Two Delegations that touch the same files never share a wave**, and a named shared resource has one holder at a time.
- **No repository fact is guessed.** Every command route, re-gate command, model, skill, label and limit comes from the config, or from the human's answer when the config does not say.

## Workflow

### 1. Read the config

```bash
node "<skill>/config.mjs" check
```

- Exit 1: the config has **problems**. Show each one with its line, and stop until it is fixed. A misread config would send every Delegation down the wrong route.
- Exit 2: the command or the answers file is wrong; its message says how. Fix that and run it again.
- `readiness.needs` not empty: ask for everything it lists in one message. Check that `run_dir` is ignored (below), make the run folder ([RUN.md](RUN.md#layout)), and write the answers there as `answers.json`, the JSON object [CONFIG.md](CONFIG.md#answers-given-in-chat) describes. Run `check` again with `--answers <run_dir>/<run>/answers.json` until it exits 0 with no needs. Offer to write them into a config file; write one only on a yes.
- `readiness.notes`: say each one, and go on.

Before anything is written to `run_dir`, check that it is ignored: `git check-ignore -q <run_dir>/x`. Nothing in a run folder is committed. If it is not ignored, say so, and offer to add `<run_dir>/` as a line of its own to the `.gitignore` at the repository root. On a yes, add it and leave the change uncommitted for the human to commit with their next change; then check again. Without a yes, write nothing to `run_dir` and stop.

When `triage_labels.from` is `document`, read that document now: it maps each triage role to the repository's label.

**Done when:** `check` exits 0 with `readiness.ready` true, `run_dir` is ignored, and each triage role's label is known.

### 2. Open the run

Make the run folder, unless step 1 made it for the answers, then the board and the Chief of Staff's Activity Log, as [RUN.md](RUN.md) lays them out. Every later step updates the board as its state changes, and appends what it did and why to the Activity Log.

**Done when:** the run folder exists inside `run_dir`, with a board listing each issue named.

### 3. Analyse each issue

For each issue, read its body, its comments, its labels, the issues and pull requests it links, and any open blockers. Then place it in the readiness table by its triage role, read through the label mapping from step 1:

| Triage role       | Becomes                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ready-for-agent` | A building Delegation.                                                                                                   |
| `needs-triage`    | An analysis Delegation: evidence and options, then a Decision Request. Nothing is built.                                 |
| `needs-info`      | An analysis Delegation, scoped to what the issue is waiting on. Nothing is built.                                        |
| `ready-for-human` | No Delegation. Listed on the board for the human.                                                                        |
| `wontfix`         | No Delegation. Listed as skipped.                                                                                        |
| no role, or two   | A Decision Request: say which labels the issue carries, and recommend a role. Nothing is delegated until it is answered. |

An issue that is closed, or that an open pull request already closes, is a Decision Request too: say what is there, and recommend skipping it or continuing that work.

For each building Delegation, write down the paths it is likely to touch and the shared resources (named in `limits.shared`) it will hold, read from the issue and the code it names. These are its scope fence, and they decide its wave.

**Done when:** every issue has a row in the readiness table, and every building Delegation has a scope fence.

### 4. Show the Dispatch Plan

One table, one row per Delegation: its issue, its kind (building or analysis), its Executor, its model (from `models`), its wave, its scope fence and its shared resources. Then the lists: the issues with no Delegation and why, the open Decision Requests from step 3, and the kinds of routine write the human may approve for the whole run (for example, moving an issue's label from one triage role to another when its Delegation starts).

Choose waves so that:

- no two Delegations in one wave overlap in scope fence or shared resource;
- a Delegation whose issue is blocked by another issue in the run is in a later wave than its blocker;
- no wave holds more building Delegations than `limits.building`, or than one on a harness that runs sequentially ([HARNESSES.md](HARNESSES.md#tier-3-harnesses-that-run-sequentially)).

A Delegation in a later wave because of an overlap or a blocker starts only once the Delegation it waits for is merged, so it is built on the merged work, not beside it. Until then it is parked ([RUN.md](RUN.md#states)).

Choose each Executor from what this harness offers ([HARNESSES.md](HARNESSES.md)): a Live Session for a building Delegation where the harness has one, so the human can open it; a headless run or a sub-agent for an analysis Delegation, or where the harness has no Live Sessions; a session the human starts where the harness can start neither.

The human's "go" approves the whole plan: every row, and the routine writes they tick. A change to any row is a new plan, shown again. With `go` in the invocation, start as soon as the plan is shown, unless step 3 raised a Decision Request: then wait for its answer and the human's "go".

**Done when:** the human has said "go" to this plan, and the board records it.

### 5. Dispatch a wave

For each Delegation in the wave, write its brief to its folder in the run, carrying every item of the Brief Contract ([BRIEF.md](BRIEF.md)), and `spawn` its Executor with that brief. Record the Executor's handle, its branch and its start time on the board.

**Done when:** every Delegation in the wave is running, with its handle on the board.

### 6. Run the loop

`await` the running Delegations. For each event:

- **A Decision Request:** relay it to the human, whole. When the human answers, `message` the answer to the Delegation, and log it. Then record it where `decisions.to` says ([CONFIG.md](CONFIG.md#decisions)), starting with `decisions.marker` when one is set: for `pull-request`, the message tells the Delegation to add it to its own pull request's body; for `issue-comment`, the Chief of Staff drafts the comment, and posts it as a write as the human.
- **A drafted write as the human:** an approved routine kind goes ahead and is logged; any other kind is relayed as a Decision Request, and made only on a yes.
- **A report:** verify it (step 7).
- **No sign of progress** for longer than the work explains: read the Delegation's Activity Log and its branch. If it is stuck, `message` it once with what you see. If it is still stuck at the next check, raise it to the human as a Decision Request.
- **A crash:** keep its branch and worktree as they are: they are its handoff. Record what was done and what is left on the board, and raise it to the human with a recommendation (start a new Delegation from the branch, or stop).

When a Delegation leaves the wave, start the next Delegation whose wait is over, within `limits.building`, or one on a harness that runs sequentially.

**Done when:** every Delegation is Ready to Merge, stopped with its analysis delivered, parked until a merge, landed on a spec run's integration branch ([SPEC.md](SPEC.md#on-an-integration-branch)), or raised to the human.

### 7. Verify each report

Check each claim the report makes ([BRIEF.md](BRIEF.md#report)) against the source:

- **git:** the branch exists, its head is the commit the report names, and it is pushed;
- **the tracker:** the pull request exists, targets the default branch, and its body closes the issue;
- **CI:** every check on that head has passed;
- **re-gate:** each `regate` command passes on that head, run in a detached worktree of the branch, never in the Delegation's;
- **review:** every review comment is fixed or answered, and with `ready_to_merge.review: approved`, an approving review exists;
- **QA:** with `ready_to_merge.qa: report` (for every issue, or for those carrying a `qa_labels` label), a QA Report exists for that head. Writing one is the `qa-plan` and `manual-qa` skills' work, not this run's.

A claim that does not hold goes back to the Delegation with what was found. Tell the human only what held.

An analysis Delegation's report is checked the same way: every piece of evidence it cites must be where it says. Then relay its options as a Decision Request.

**Done when:** each report is verified, or sent back with what did not hold.

### 8. Find conflicts between finished branches

For each pair of verified branches, and for each against the default branch, check whether they merge cleanly in the order proposed, without touching any checkout (`git merge-tree --write-tree`). A pair that conflicts goes back into the plan: propose an order that merges one first and has the other's Delegation merge the default branch into its own branch afterwards, resolving the conflict in a new commit, as a Decision Request. A rebase would need a force-push.

**Done when:** an order exists in which every Ready to Merge branch merges cleanly.

### 9. Close out

Print the Ready to Merge list, one row per Delegation with its pull request and head, and the merge order from step 8. With `routes.merge` set, print the command for each, in order. Never run it.

Also print what is not on the list and why: parked Delegations, analysis results waiting on a decision, issues for the human, and anything raised and unanswered.

After the human says they have merged, offer a **Run Summary** on the umbrella issue the run's issues share, if they share one ([RUN.md](RUN.md#run-summary)). It is a write as the human: draft it, show it, and post it only on a yes. If parked Delegations are waiting on the merges, offer to resume the run.

**Done when:** the human has the Ready to Merge list and the merge order, and the board says where every Delegation ended.
