---
name: orchestrate
description: Run a set of issues, or a whole spec, through other sessions as their Chief of Staff — analyse them, propose one Dispatch Plan, hand each Delegation to an Executor, relay every Decision Request, verify each report, QA each finished head where the repository requires it, and close out with the Ready to Merge list and a merge order. Invoked by the user.
disable-model-invocation: true
argument-hint: "#<n> [#<n>…] [go] [autonomous] | --spec <n> [go] [autonomous] | --spec <n> --team [go] [autonomous] | --status [<run>] | --status --spec <n> | --resume <run>"
metadata:
  agent-kit-scope: user
---

# Orchestrate

A user-invoked skill. Running it makes this session the **Chief of Staff** for a set of issues, or for a spec and the work under it. The Chief of Staff analyses each issue, shows one **Dispatch Plan**, and after the human's "go" hands each piece of work, a **Delegation**, to an **Executor**: a separate Live Session, a headless run, or a sub-agent in this session. It relays every **Decision Request** to the human, keeps the board, checks every report against git, the tracker and CI, has each finished head QA'd where the repository requires it, and ends with the **Ready to Merge** list and a merge order.

The Chief of Staff plans, delegates, relays and verifies. It never builds a Delegation's work itself, and it never merges.

Load [CONFIG.md](CONFIG.md) when reading or asking for the config. Load [BRIEF.md](BRIEF.md) before writing a brief or reading a report. Load [RUN.md](RUN.md) before opening, updating or resuming a run folder. Load [HARNESSES.md](HARNESSES.md) at step 1, to find this run's **Harness**; then load that harness's own file under [harnesses/](harnesses/), and only that one, before the first `spawn`, `message`, `await` or `report`. Load [SPEC.md](SPEC.md) for `--spec` (not for `--status --spec <n>`, which reads the tracker alone), or on `--resume` of a spec run ([RUN.md](RUN.md#resume)), and only then. Load [TEAM.md](TEAM.md) for `--spec <n> --team`, after SPEC.md, on `--resume` or `--status` of a run whose board says it is a Team Run, or for `--status --spec <n>`, and only then: it says how a Team Run's plan changes, adds the Shared Board's writes after "go", and says how the Shared Board is read. Load [DESIGN.md](DESIGN.md) when a rule needs its reason, or before changing this skill.

`<skill>` in a command below is the absolute path of the folder this file is in, written with forward slashes (`C:/Users/me/...` on Windows), inside double quotes because it may contain spaces. Every command runs from the root of the repository the issues belong to.

## Which copy runs

A harness can load this skill from a user-level folder (under the home folder) while the repository keeps its own copy, pinned to the version the repository was set up with. The user-level copy can be older, and would then follow rules the repository no longer uses. So before anything else, check which copy this is:

```bash
node "<skill>/config.mjs" where orchestrate
```

It finds the repository from the folder it runs in, and lists the copies of `orchestrate` the repository keeps in the folders harnesses read skills from: `.claude/skills`, `.agents/skills`, `.github/skills` and `.cursor/skills`.

- `use` is `this`: go on. This copy is inside the repository, or the repository keeps none of its own.
- `use` is `repository`: stop, and run nothing more from this copy. Read the `SKILL.md` that `load` names and follow it from its start instead, with `<skill>` its folder. Tell the human that the copy at `this_copy` was not used, and that the repository's copy at `load` was.
- Exit 2, or no such script: compare by hand. When this file is outside the repository's root (`git rev-parse --show-toplevel`) and one of those folders in the repository holds `orchestrate/SKILL.md`, do as for `repository`.

## Invocations

- `/orchestrate #12 #34`: a run for these issues. The Dispatch Plan waits for "go".
- `/orchestrate #12 #34 go`: the same, and the run starts straight after the Dispatch Plan is shown, unless analysis raised a Decision Request.
- `/orchestrate #12 #34 go autonomous`, or `/orchestrate #12 #34 autonomous`: the same, with the Dispatch Plan's **Decision authority** line filled in as `autonomous` ([Autonomous runs](#autonomous-runs)). The word only fills the line in: the run is autonomous only once the plan is approved with that line, as step 4 says.
- `/orchestrate --spec 50 [go] [autonomous]`: a run for the spec `#50` and the work it holds, in dependency order. Load [SPEC.md](SPEC.md) before step 3: it says how the spec becomes Delegations and how the work lands. `autonomous` fills in the Decision authority line, as for issues.
- `/orchestrate --spec 50 --team [go] [autonomous]`: a **Team Run** of the spec `#50`. Each teammate runs their own Chief of Staff, and this one builds only the spec's tickets assigned to this teammate alone, listing the rest. Load [TEAM.md](TEAM.md) with SPEC.md before step 3 for `--team`: it says how the plan changes, and adds the Shared Board's writes after "go". `go` and `autonomous` are this teammate's own.
- `/orchestrate --status [<run>]`: print the board of the run named, or of the latest run, with the [default-branch check](#the-default-branch-check)'s result, and act on and write nothing ([RUN.md](RUN.md#status)). In a Team Run, it also prints the whole spec from the tracker ([RUN.md](RUN.md#in-a-team-run)).
- `/orchestrate --status --spec 50`: print the Shared Board of the Team Run on the spec `#50` from the tracker alone, with no run of your own, and write nothing ([RUN.md](RUN.md#--status---spec-n)). For a reviewer, the spec's owner, or a teammate with no tickets.
- `/orchestrate --resume <run>`: continue a run from its board ([RUN.md](RUN.md#resume)).

`--spec` takes exactly one issue number and nothing else but `--team`, `go` and `autonomous`, except in `--status --spec <n>`. `--team` is taken only with `--spec <n>`, once, straight after its number: anywhere else, or twice, it is a mix this version does not take. `--status --spec <n>` takes exactly one issue number and nothing else: no run name, `--team`, `go` or `autonomous`, and `--status` comes first. `autonomous` is taken once, last, and only in a run for issues or a spec, after `go` when both are given. With `--status` or `--resume`, on its own, before `go`, or twice, it is a mix this version does not take. Any other argument this version does not know, or a mix of the forms above, `autonomous` included, stops the run before anything is read: say which invocations this version knows.

## Rules

- **Authority.** The Chief of Staff never merges, force-pushes, changes repository settings, or destroys a branch, worktree or checkpoint without the human's yes. A yes covers the one action it was given for. The detached worktrees the Chief of Staff makes for its own checks are its own scratch space: it removes each one when that check ends, and never one a Delegation works in.
- **Writes as the human.** A Delegation may push its own branch, open its own pull request and reply on its own review. Every other write made in the human's name (an issue comment, a new issue, a label, closing an issue) goes through the Chief of Staff: it drafts the write and raises it as a Decision Request, unless the human approved that kind of routine write in the Dispatch Plan.
- **Nothing is reported that was not checked.** A Delegation's report is a claim. The Chief of Staff tells the human only what it has checked against the branch, the pull request and CI, and says which parts it could not check.
- **Every question goes to the human whole.** A Decision Request is self-contained: the human can answer it without opening the Delegation, from the question, the options, the evidence and the recommendation alone ([BRIEF.md](BRIEF.md#decision-request)). In an autonomous run, the kinds of question the human handed over at "go" are answered by Rulings instead ([Autonomous runs](#autonomous-runs)). Each Ruling is self-contained in the same way, so the human can review it from the Ruling Ledger alone. Every other question still goes to the human whole.
- **No unsettled design gets built.** An issue that is not ready for an agent becomes an analysis Delegation: it produces evidence and options, then stops.
- **Two Delegations that touch the same files never share a wave**, and a named shared resource has one holder at a time. The **QA Stack** is one, held by every QA Delegation that runs against it, whether or not `limits.shared` names it.
- **QA holds for one head.** A QA result is about the commit it ran on. Any push to the branch after it, a review fix or a conflict merge alike, voids it, and the new head goes through QA again.
- **No repository fact is guessed.** Every command route, re-gate command, model, skill, label and limit comes from the config, or from the human's answer when the config does not say.

## Autonomous runs

A run whose Dispatch Plan was approved with **Decision authority: autonomous** (step 4) is an autonomous run. In it, the Chief of Staff answers some Decision Requests itself, as **Rulings**, and keeps them in the run's **Ruling Ledger** ([RUN.md](RUN.md#ruling-ledger)). The human reviews each one in the **Ruling Review** before anything is Ready to Merge. Why: [DESIGN.md](DESIGN.md#rulings-under-review). A run approved with plain `go` is not autonomous: every Decision Request goes to the human, and nothing in this section applies.

**The split is fixed, all or nothing.** The human hands over every kind in the first list, or none.

- **The Chief of Staff rules on:** a building Delegation's question about how to do the work within its issue's goal; a stalled or crashed Delegation (nudge it, or restart it from its branch as a new Delegation, `d<issue>-<k>` with the next suffix not yet used in the run ([RUN.md](RUN.md#layout)), on the same Executor and model), once per issue in the run; the merge order between conflicting branches (step 8); merging the default branch into a row's branch (step 10), when its re-gate on the merge result failed; a QA FAIL (send it back, or run QA again, step 9); the delivery of a QA Plan (step 9); while a QA Plan is composed, its subject issue, an `unknown` row, and a test `qa-plan` finds could prove a promise (send it back to the building Delegation to add the test, or keep the scenario), each under the evidence bar (step 9).
- **The human keeps:** the QA readiness answers, which the Dispatch Plan asks for and which are never a Ruling (step 4); a hosted (`url`) QA target's host and role test values; widening a scope fence; accepting a QA FAIL or waiving a manual scenario; merging a row as it is with the admin bypass (step 10); an analysis Delegation's options; any write as the human not approved as routine; everything under Authority. So do the questions the Chief of Staff raises before "go", such as a missing triage role or a closed issue at step 3.

**QA runs from the brief.** The handover includes the QA skills' own waits, all or nothing with the rest of the split. A QA Delegation on a `target: stack` plan composes, delivers and runs QA from its brief: its session reads each QA skill's `SKILL.md` and follows it, and the skill's "Run from an autonomous brief" section says what replaces each place it would wait on the person. Nobody types `/qa-plan` or `/manual-qa` ([BRIEF.md](BRIEF.md#the-qa-brief)). The skills stay invoked by a person everywhere else ([DESIGN.md](DESIGN.md#qa-on-the-head-that-merges)). A QA Delegation on a `target: url` plan takes the typed route instead, as in a run approved with plain `go`: the human types each command in its session, and confirms the host and gives the role test values there. It is `waiting` until they do, and the run goes on.

**The evidence bar.** The Chief of Staff rules only when its evidence picks one option: the issue or spec text, the glossary, an ADR, code, CI output, or an earlier Ruling. Each piece is cited so that it can still be checked after the branch has moved: `path:line` at a commit SHA, command output saved to a file in the run folder's `evidence/` ([RUN.md](RUN.md#layout)), a tracker permalink, or an earlier Ruling by its id. "It seemed reasonable" does not meet the bar. When the evidence is split or missing, or when an option cannot be undone by a later commit, it does not rule: it treats the question as one the human keeps.

**A question it does not rule on** sets only its own Delegation to `waiting`. The run goes on: the other Delegations keep working, and the next one whose wait is over starts. The question is queued for the human, whole, on the board and in the Chief of Staff's session, and the Chief of Staff notifies the human where the harness can ([HARNESSES.md](HARNESSES.md#notifying-the-human)).

**Making a Ruling:**

1. Give it the next run-wide id, `R<n>`: `R1`, `R2`, and so on, never reused. A new Team Run after a lost machine starts one past the highest `R<n>` on the old run's pull requests instead ([RUN.md](RUN.md#after-a-lost-machine)).
2. Append it to the Ruling Ledger, `unreviewed`, with its question, options, choice and reason, evidence, and the earlier Rulings it cites. Mark the Decision Request in the Delegation's `decisions.md` as answered by the Chief of Staff, as `R<n>`.
3. `message` it to the Delegation that asked, in the Ruling form ([BRIEF.md](BRIEF.md#ruling)), or for a stall, a crash or a merge order, to the Delegation it acts on. Record it where `decisions.to` says, labelled "Chief of Staff ruling, not yet reviewed". With `pull-request`, the line goes in the building Delegation's own pull request body: for a building Delegation's Ruling, its Ruling form tells it to add the line; for a QA Delegation's, whose brief allows no such write, the QA Delegation's form says `Record: none`, and the Chief of Staff sends the line to the building Delegation whose pull request it tests. With `issue-comment`, the Chief of Staff drafts the comment, a write as the human handled as step 6 says. The Delegation goes on with the Ruling while that write waits.
4. Log it in the Activity Log, then act on it as on the human's answer: the nudge or restart, the merge order, the send back, the new QA run, or the delivery.

A Ruling may cite an earlier one by its id, and the ledger shows the link.

A Ruling **concerns** a branch and its pull request, not one Delegation: the branch of the Delegation it was sent to, or, for a QA Delegation, the branch whose pull request it tests. So it concerns every Delegation that works on that branch, before or after it: a restart, an overturn's new Delegation, and the building Delegation a QA Ruling's pull request belongs to. That Delegation's Ready to Merge waits for it. A Delegation started from another's branch (a restart, or an overturn's new Delegation) gets, in its brief's **Read first**, every Ruling already concerning that branch, from the ledger: its id, its choice, its verdict, and its **Commits** line. Where the earlier Delegation left no verified report, the Chief of Staff fills that line from the branch (`git log <merge-base>..<head>`) and the earlier Delegation's Activity Log, and marks each commit `(read from the branch, not reported)`, as the ledger form shows ([RUN.md](RUN.md#ruling-ledger)). A Delegation that has ended can no longer change its pull request: a line it would add or update is sent to the Chief of Staff instead, who drafts the edit to that pull request's body as a write as the human, handled as step 6 says. The Dispatch Plan of an autonomous run offers that edit as a routine kind the human may approve.

**The Ruling Review.** The human may uphold or overturn a Ruling at any time in the Chief of Staff's session, and must before a Delegation it concerns is Ready to Merge (step 10). The answer names Rulings by id, `upheld: R1 R2; overturned: R3 → option 2`, or is "uphold all". `--status` prints the ledger, and `--resume` opens with the Rulings still awaiting review ([RUN.md](RUN.md#resume)). There is no other invocation for it.

- **Upheld:** the ledger says `upheld`. The building Delegation whose pull request carries the Ruling line updates it to upheld, or, when it has ended, the Chief of Staff drafts that edit, as above; with `issue-comment`, that update is a write as the human, drafted as usual.
- **Overturned:** the ledger says `overturned`, with the option the human chose. It becomes an ordinary human answer to the Decision Request, recorded where `decisions.to` says, and the Ruling line is updated to overturned in the same way. It is sent to the Delegation, or, when that one has ended, to a new Delegation started from its branch, `d<issue>-<k>` with the next unused suffix, on the same Executor and model. The rework is a push: the head goes back to step 7, and QA on the old head is `void` (step 6). An overturned merge order changes only the order step 10 prints.
- **Every Ruling that cited an overturned one** is marked `needs re-review` in the ledger, and is reviewed again. It is not overturned with it.

A Delegation is Ready to Merge only when every Ruling it concerns is `upheld`, or `overturned` with its rework verified. Until then, a Delegation that otherwise meets Ready to Merge is `awaiting Ruling Review` ([RUN.md](RUN.md#states)).

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

Then find the harness, from `check`'s `harness` output and this session's own tools, as [HARNESSES.md](HARNESSES.md#finding-the-harness) says: never guessed, and a pinned `harness` that disagrees is a Decision Request. Load its file. For each harness `executors` names, check its CLI answers `--version`, and load its file too.

**Done when:** `check` exits 0 with `readiness.ready` true, `run_dir` is ignored, each triage role's label is known, and the harness is named, with its Support Level, in the Activity Log.

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

Then decide which building Delegations need QA: all of them with `ready_to_merge.qa: report` and no `qa_labels`, or those whose issue carries one of the `qa_labels`; none with `qa: none`. Each one that does gets a **QA Delegation** of its own, `d<issue>-qa`, run after it (step 9). A spec run decides its QA rows with its landing ([SPEC.md](SPEC.md#qa-in-the-dispatch-plan)). When `check` named a `qa_config`, read its `run.target` there: a QA Delegation for a `stack` target holds the **QA Stack**; one for a `url` target holds nothing. A target the file does not give counts as `stack`. That target also decides how its QA skills start in an autonomous run (step 4).

**Done when:** every issue has a row in the readiness table, every building Delegation has a scope fence, and each one that needs QA has its QA Delegation.

### 4. Show the Dispatch Plan

It opens with the harness, its tier and its **Support Level**. Below `verified`, it says what that level means for this run ([HARNESSES.md](HARNESSES.md#support-level)), and the plan waits for the human's "go" even when the invocation carried `go`. On an unlisted harness, it says no harness file exists, and that the run goes one Delegation at a time, on tier 3.

Then one table, one row per Delegation: its issue, its kind (building, analysis or QA), its Executor, the harness that Executor runs on when `executors` moves it off this one, its model (from `models`), its wave, its scope fence and its shared resources. A QA Delegation's wave is "after `d<issue>` is verified", its scope fence is "none: commits nothing", and its shared resources are the QA Stack or nothing. Then **Harness limits**: each limit from the harness files loaded at step 1 that bears on this run's Delegations, with what the human will see because of it ([HARNESSES.md](HARNESSES.md#the-harness-limits-section)), and each persistent change the harness needs, such as a copy of the QA skills where it reads skills. Then each check or reminder a harness file's verbs say the Dispatch Plan gives, such as whether messages between sessions would be held. Then the lists: the issues with no Delegation and why, the open Decision Requests from step 3, and the kinds of routine write the human may approve for the whole run (for example, moving an issue's label from one triage role to another when its Delegation starts).

When the run has a QA Delegation, the plan also says:

- **QA readiness, asked once.** Run `node "<qa-plan>/adapter.mjs" check --for plan` in this checkout, with `<qa-plan>` the folder of the `qa-plan` copy the QA Delegations will run: the one beside this skill (`<skill>/../qa-plan`), or the folder that its `where qa-plan` names in `load`. With no QA config, or with `readiness.needs` not empty, the plan asks the readiness question here, once, beside the "go": each need, and whether the answers are for this run only or to save a config. It waits for the answers as it waits for a Decision Request from step 3. Write them to the run folder as `qa-readiness.json`, the JSON object `qa-plan`'s `--answers` takes ([RUN.md](RUN.md#layout)), and log them. Then check that they answer every need: copy the file into this checkout's `working_dir` and run `check --for plan --answers` on that copy, and ask again, in the same message, for anything its `readiness.needs` still lists, so no QA session has a need left to ask. Delete the copy afterwards. With "save a config", also write them into the QA config with `qa-plan`'s `render --write`, in this checkout, uncommitted for the human to commit with their next change; the QA Delegations still get the file, since the heads they test do not carry that config. No QA brief asks it again, and the question is never a mid-run Decision Request or a Ruling: readiness answers are facts about the repository, and only the human knows them. The answers hold for the base branch they were given for: the branch the merged config's `effective.plan.base_ref` names, in the output of that `check --for plan --answers` (`origin/main` names `main`), whether the answers or the config set it; or the default branch, when it is null. The board's `QA readiness` line records it. A QA Delegation whose pull request has another base gets no answers file: its `qa-plan` asks, as it does with none, and the Chief of Staff writes the human's answers for that base to `qa-readiness-<base>.json`, for any later QA Delegation on the same base.
- **How each QA skill starts.** The QA Delegation's session always starts on its brief, and its first phase pins the head. What follows depends on the Decision authority line and the plan's target:
  - **`relay`: the typed route.** `qa-plan` and `manual-qa` are invoked only by a person. After that phase stops, `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]` is sent to it as a message, with the `--answers` part only when the run has an answers file for its pull request's base, and `/manual-qa <plan file>` later, where [HARNESSES.md](HARNESSES.md#choosing-an-executor) says this harness may run a message as the user's invocation. If the session does not run it (it says it cannot invoke the skill, or asks for it), the human types each command there, and the Chief of Staff gives them the exact command, with its `--answers` path or without it, by the same rule. The plan says this up front, so the human knows they may be asked.
  - **`autonomous`, on `target: stack`: from the brief.** The session reads `qa-plan`'s `SKILL.md`, then `manual-qa`'s, from the paths its brief gives, and follows each as a phase of the brief, by the skill's "Run from an autonomous brief" section ([Autonomous runs](#autonomous-runs)). No command is sent, and the human types none.
  - **`autonomous`, on `target: url`: the typed route,** as for `relay`. Confirming a hosted address and giving role test values stay with the human, typed in that session, so that QA Delegation is `waiting` from when its first phase stops until they have done it, and the run goes on.

  Where HARNESSES.md names a fallback Executor for QA, the QA row names it with the first (for example, "headless run; else a session you start"), so the "go" covers the switch.

- **The QA writes.** Delivering each QA Plan is always a Decision Request carrying the draft, so the human sees what will be tested before it is run. Posting the QA Report where the plan was delivered is a routine kind the human may approve for the run. Uploading a QA Artifact is never routine: each file is a Decision Request. In an autonomous run, a QA Delegation on the brief route uploads nothing, and a post the human did not approve waits as a queued write.
- **That "go" covers re-QA.** When a head moves and is QA'd again, the new QA Delegation (`d<issue>-qa2`, then `-qa3`) runs on the same Executor and model without a new plan. A different Executor, or QA for an issue the plan gave none, is a new plan.

Choose waves so that:

- no two Delegations in one wave overlap in scope fence or shared resource;
- a Delegation whose issue is blocked by another issue in the run is in a later wave than its blocker;
- no wave holds more building Delegations than `limits.building`, or than one on a harness that runs sequentially ([HARNESSES.md](HARNESSES.md#tiers)). QA Delegations do not count toward `limits.building`, as analysis Delegations do not; a QA Delegation on the QA Stack still never runs beside another holder of it.

A Delegation in a later wave because of an overlap or a blocker starts only once the Delegation it waits for is merged, so it is built on the merged work, not beside it. Until then it is parked ([RUN.md](RUN.md#states)).

Choose each Executor from what this harness's file offers (its **Executors** line), or from what `executors` names: a Live Session for a building Delegation where the harness has one, so the human can open it; a headless run or a sub-agent for an analysis Delegation, or where the harness has no Live Sessions; a session the human starts where the harness can start neither. A QA Delegation is never a sub-agent: it needs a working copy and a browser of its own, and outside an autonomous run it runs user-invoked skills.

Last, the **Decision authority** line: `relay`, the default, where every Decision Request goes to the human, or `autonomous`, where the Chief of Staff rules on the kinds [Autonomous runs](#autonomous-runs) lists, and the human reviews each Ruling before anything is Ready to Merge. The line lists both halves of the split, so the human sees what they would hand over. When the run has a QA Delegation, its `autonomous` half also says that QA on a `stack` target runs from the brief, with no command typed, and that a `url` target stays on the typed route. An `autonomous` word in the invocation fills it in as `autonomous`; without one, it reads `relay`.

The human's "go" approves the whole plan: every row, the routine writes they tick, and the Decision authority line as shown. `go autonomous` approves it with the line set to `autonomous`. A change to any row, or setting the line back to `relay` on a harness at `verified`, is a new plan, shown again. With `go` in the invocation, start as soon as the plan is shown, unless step 3 raised a Decision Request, or a harness the plan uses is below `verified`: then wait for the answer and the human's "go". Below `verified`, the line an `autonomous` word fills in reads `autonomous, on a typed go autonomous`, and the plan says that Rulings would be made on a harness whose limits are not fully known. That line, as shown, offers two answers: `go autonomous`, typed after seeing the plan, starts the run autonomous; a plain `go` approves the plan as shown with the line at `relay`. Neither is a change to the plan, so neither shows it again.

**Done when:** the human has said "go" to this plan, and the board records it, with its Decision authority.

### 5. Dispatch a wave

For each Delegation in the wave, write its brief to its folder in the run, carrying every item of the Brief Contract ([BRIEF.md](BRIEF.md)), and `spawn` its Executor with that brief. Record the Executor's handle, its branch and its start time on the board.

Where the harness file says its `spawn` can only propose a session for the human to start (on Claude Code desktop, a turn the app started), the Delegation is `waiting` on the human to start it, with what the human must do queued as a Decision Request. Step 6 checks `waiting` rows on every wake-up, so the turn that finds the session records its handle and start time, sets the row to `running`, and arms its waits, as the harness file says.

**Done when:** every Delegation in the wave is running, with its handle on the board, or is `waiting` on the human to start it, as above.

### 6. Run the loop

`await` the Delegations the run waits on, on the harness's event and the heartbeat ([HARNESSES.md](HARNESSES.md#waiting-an-event-and-a-heartbeat)). A wake-up means something may have changed, never that a report is final. So on each one, check every Delegation the run waits on, not only the one the wake-up named: any that is `running`, `waiting`, `reported` or `sent back`, and a QA Delegation still in progress ([HARNESSES.md](HARNESSES.md#waiting-an-event-and-a-heartbeat)). For each event:

- **A Decision Request:** in an autonomous run, first decide whether it is a kind the Chief of Staff rules on, with evidence that meets the bar ([Autonomous runs](#autonomous-runs)). If it is, make a Ruling. If not, set only that Delegation to `waiting`, queue the question, notify the human where the harness can, and go on with the run. In any other run, relay it to the human, whole. When the human answers, `message` the answer to the Delegation, and log it. Then record it where `decisions.to` says ([CONFIG.md](CONFIG.md#decisions)), starting with `decisions.marker` when one is set: for `pull-request`, the message tells the Delegation to add it to its own pull request's body; for `issue-comment`, the Chief of Staff drafts the comment, and posts it as a write as the human.
- **A drafted write as the human:** an approved routine kind goes ahead and is logged; any other kind is relayed as a Decision Request, and made only on a yes.
- **A report:** when its **Final:** line says `yes`, verify it (step 7), or for a QA Delegation, step 9. When it says `no, waiting on <what>`, it is not verified yet and not sent back: re-arm the wait on that Delegation, and let the heartbeat check it again. Where the Executor is a process that has exited (a headless run ends its process when its turn ends), nothing will rewrite that report on its own. An exited process whose report says `no` is not a crash: it waits on what it named. Once that has finished (CI on its head, a review run), `message` it to finish the work and rewrite its report. It is a crash only when it exited with no report at all.
- **A push to a branch that has passed step 7:** its head moved. Its verification and any QA for the old head no longer hold: set its building row back to `reported`, whether it was `verified`, `awaiting Ruling Review` or `ready to merge`, mark a running or `passed` QA Delegation for it `void` (a `failed` one stays `failed`, as the record of that run), and verify the new head from step 7.
- **No sign of progress** for longer than the work explains: read the Delegation's Activity Log and its branch. If it is stuck, `message` it once with what you see. If it is still stuck at the next check, raise it to the human as a Decision Request.
- **A crash:** keep its branch and worktree as they are: they are its handoff. Record what was done and what is left on the board, and raise it to the human with a recommendation (start a new Delegation from the branch, or stop).
- **In an autonomous run**, a Delegation still stuck after the nudge, or a crashed one, is a Ruling instead of a question to the human: nudge it again, or restart it from its branch. The Chief of Staff makes one such Ruling per issue in the run. When the nudged or restarted Delegation stalls or crashes again, that is a question the human keeps: it is queued and notified as a question not ruled on ([Autonomous runs](#autonomous-runs)). Stopping it, or dropping it from the run, stays the human's.
- **A Ruling overturned in the Ruling Review:** act on it as on any human answer ([Autonomous runs](#autonomous-runs)).

**The heartbeat.** Arm it at the first `spawn` of the run, in the form the harness file gives, and record its id on the board, with the time it was made ([RUN.md](RUN.md#board)). Where the heartbeat is the foreground watch, the board says `foreground watch` in place of an id. On tier 3 there is none: the human is the event. Delete it at close-out (step 10), or when the run parks with nothing running and only the human's merges to wait for, in the form the harness file gives, a marker file included, and record that on the board. `--resume` arms it again ([RUN.md](RUN.md#resume)). Where the harness's heartbeat expires, recreate it before then and record the new id. On each firing, the Chief of Staff:

1. reads the board;
2. compares each Delegation the run waits on, by its `report.md` and `decisions.md`, with what it last handled. On every wake-up, the Chief of Staff logs the time and size of each `report.md` and `decisions.md` it handles in its Activity Log, so this comparison has a baseline, after `--resume` too;
3. checks each Delegation's session or process where nothing new was written, the pull request's checks (`gh pr checks <pr>`), and the review run ([step 7](#the-review-workflow));
4. acts on what changed, as the events above say, and re-arms any wait that ended or timed out, such as a subscription on one Delegation or a capped wait on CI or the review. When nothing changed, it logs one line in the Activity Log and ends the turn at once, or, on a foreground watch, runs the watch again.

A question already queued and notified is not notified again at each firing: it waits on the board, as before.

When a Delegation leaves the wave, start the next Delegation whose wait is over, within `limits.building`, or one on a harness that runs sequentially.

**Done when:** every building Delegation is Ready to Merge or `awaiting Ruling Review`, stopped with its analysis delivered, parked until a merge, landed on a spec run's integration branch ([SPEC.md](SPEC.md#on-an-integration-branch)), or raised to the human.

### 7. Verify each report

Only a final report is verified: one that says `**Final:** yes`. A report that says `no, waiting on <what>` is not sent back, since the Delegation said what it waits for. It waits for the heartbeat (step 6). A report with no **Final:** line is sent back, as a blank line would be.

Check each claim the report makes ([BRIEF.md](BRIEF.md#report)) against the source:

- **git:** the branch exists, its head is the commit the report names, and it is pushed;
- **the tracker:** the pull request exists, targets the default branch, and its body closes the issue;
- **CI:** every check on that head has passed;
- **re-gate:** each `regate` command passes on that head, run in a detached worktree of the branch, never in the Delegation's;
- **review:** where the repository runs Agent-kit's review workflow, that review has run on that head ([below](#the-review-workflow)); every review comment is fixed or answered; and with `ready_to_merge.review: approved`, an approving review exists;
- **Rulings:** in an autonomous run, the report's commit-to-Ruling map ([BRIEF.md](BRIEF.md#report)): each commit it maps is on the branch, each Ruling it names is in the ledger, and every Ruling that concerns its branch is in this map, or in the verified report of an earlier Delegation on the same branch (one it was restarted from); a Ruling its brief listed from an earlier Delegation is carried into the map with the commits the brief gave, and checked against the ledger entry the brief was written from, and, with `pull-request`, its pull request's body carries the line of each Ruling it concerns, with its current verdict. A ticket on a spec run's integration branch has no pull request: its lines are checked on the `<integration>` row instead ([SPEC.md](SPEC.md#on-an-integration-branch));
- **scope fence:** every path the branch changes from the default branch (`git diff --name-only <merge-base> <head>`) is inside its scope fence, or was answered as a Decision Request. A change outside it that no Decision Request answered, a fix a reviewer or CI prompted included, is raised to the human as a Decision Request: the fence was approved in the Dispatch Plan, and only the human widens it.

#### The review workflow

The review workflow's Caller is the repository's workflow with a job that `uses:` Agent-kit's `agent-review-reusable.yml`. With `ready_to_merge.review_workflow: detect` (the default), look for it under `.github/workflows/`; when more than one workflow there has such a job, ask the human which one is the review Caller, and suggest setting its path in the config, rather than picking one. With a path, that file is the Caller. With `none`, or when `detect` finds no Caller, there is no review workflow to wait for, and the review claim is the comments alone.

With a Caller, green CI and no review comments is not a settled review: the review workflow posts its comments after CI is green, minutes later. Base the claim on the Caller's run for the verified head, never on whether comments exist yet. Find it with `gh run list --workflow <Caller> --commit <head>`, or the review job's check in `gh pr checks <pr>`. A run started by a manual dispatch is recorded against the commit it was dispatched on, usually the default branch's, not the pull request's head, so neither of those finds it: list the Caller's dispatched runs since the head was pushed (`gh run list --workflow <Caller> --event workflow_dispatch`), and read which head each reviewed from its log once it has finished: the review job's "Build review brief" step shows the head it was given as `HEAD_SHA` (`gh run view <run-id> --log`; `gh` gives no log for a run still going). A dispatched run still queued or running, started since the head was pushed, counts as a review running for this head until its finished log says otherwise. A finished dispatched run, started since the head was pushed, whose log shows no `HEAD_SHA` (its gate refused the dispatching actor, or it was cancelled while it waited) is a failed or cancelled review: raise it as below, with its link. A run whose review job was skipped is not a review, and neither is a run for an earlier head. The review claim holds once a run's review job has finished on this head and every comment it posted is fixed or answered, or once the human has said no review is coming for this head, recorded where `decisions.to` says.

- **The review is running or queued:** the row stays `reported`. Check it again at the pace the review takes, minutes apart: at each wake-up, the heartbeat's included, or with a capped wait the harness file names, such as `gh run watch <run-id> --interval 60`. Never tighter than that. A capped wait that ends with nothing found is re-armed at the next heartbeat, never left ended. Where the harness delivers the pull request's events to this session, wait for them instead. Where it does not, as on harnesses with no CI or pull request subscription, these checks are the only way the comments reach the run.
- **No run on this head:** the review starts on a trigger the human owns, such as a label (Agent-kit's example Caller runs on `agent:review`) or a manual dispatch. Raise a Decision Request: start the review on this head, or say no review is coming. Adding the label is a write as the human, drafted unless the human approved that kind in the Dispatch Plan.
- **The review job failed or was cancelled:** it is not a review. Raise it to the human, with the run's link, with the same two options.

A review can also land later on a head that has already passed this step: someone runs the review again, or a reviewer comments. The head did not move, so the push rule in step 6 does not apply. Set the building row back to `reported`, send each new comment to its Delegation, and check the review claim again. QA for that head holds, a `passed` QA Delegation included: if the comment is answered without a push, the row goes back to where it was without new QA. A fix is a push, and voids it as any push does. Before the close-out prints a row as Ready to Merge, check its head once more for a review run or a comment newer than its verification (step 10).

QA is not checked here: it runs on the head this step verified (step 9).

A claim that does not hold goes back to the Delegation with what was found. Tell the human only what held. A building Delegation whose report holds goes on to step 8.

An analysis Delegation's report is checked the same way: every piece of evidence it cites must be where it says. Then relay its options as a Decision Request, in an autonomous run too: an analysis Delegation's options stay the human's.

**Done when:** each report is verified, or sent back with what did not hold.

### 8. Find conflicts between finished branches

For each pair of verified branches, and for each against the default branch, check whether they merge cleanly in the order proposed, without touching any checkout (`git merge-tree --write-tree`). A pair that conflicts goes back into the plan: propose an order that merges one first and has the other's Delegation merge the default branch into its own branch afterwards, resolving the conflict in a new commit, as a Decision Request, or, in an autonomous run, as a Ruling. A rebase would need a force-push. That new commit is a new head: the branch goes back to step 7, and any QA for its old head is `void`.

Fetch first, and test against the default branch's tip on the remote (`<remote>/<default>`). When the board's `Default branch` line reads `none yet`, write it, once every verified branch has been checked against that tip, with the tip's SHA and the time, naming as passed, each with its head, only a verified branch whose head already contains that tip (`git merge-base --is-ancestor <tip> <head>`): its merge result is its head, which step 7 re-gated. Step 8 runs no re-gate on a merge result, so every other branch is left unnamed, and the first default-branch check re-gates it ([RUN.md](RUN.md#board)). The line is the baseline the [default-branch check](#the-default-branch-check) compares with. After that, only the default-branch check rewrites it, since it checks every Ready to Merge row against the new tip; a later step 8 that rewrote it would hide a move from a row verified before it.

This runs before QA so that the head QA tests is the head that merges. A branch whose report held and that merges cleanly is Ready to Merge when it needs no QA, but listed as Ready to Merge only once it has passed the [default-branch check](#the-default-branch-check). One that needs QA is `verified`, and goes to step 9.

**Done when:** an order exists in which every verified branch merges cleanly.

### 9. QA each finished head

For each building Delegation that is `verified` and merges cleanly in the order from step 8 (on a spec run with an integration branch, the `<integration>` row, [SPEC.md](SPEC.md#on-an-integration-branch)), with `<head>` the commit step 7 verified:

1. **Dispatch its QA Delegation.** Write the QA brief ([BRIEF.md](BRIEF.md#the-qa-brief)), pinned to `<head>`, and `spawn` it on the plan's Executor with `models.qa`, once no other holder of the QA Stack is running, when it holds the QA Stack. Record it on the board as `running`, with `<head>` in its Branch cell. When it reports a mismatch at its phase 1, the head moved: handle it as a push (step 6). When it reports that the head is pinned, on the typed route ([step 4](#4-show-the-dispatch-plan)), send `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]` to it as the plan says (the `--answers` part only when the run has an answers file for its pull request's base), and log whether the session ran it as an invocation; if it did not, tell the human which session to type it in, and the exact command. On the brief route there is nothing to send: the session goes on to compose from its brief. The first run that relies on a message for this records the result in its Activity Log, for [HARNESSES.md](HARNESSES.md) to be corrected.
2. **Relay the QA Plan.** The QA Delegation raises its draft QA Plan as a Decision Request: relay it whole. In an autonomous run, its delivery is a Ruling instead, when the evidence meets the bar: each scenario follows from a promise in the issue, and none needs a write the human keeps. When `qa-plan` found no Residue, it wrote no plan, and the QA Delegation reports that instead: go to 3. The human's answer is `qa-plan`'s yes, or the correction it asks for. When the human is in the QA session and answered `qa-plan` there, its Activity Log says so, and there is nothing to relay. While it composes, `qa-plan` may raise other questions, each a Decision Request: in an autonomous run, its subject issue and an `unknown` row are Rulings under the evidence bar, or, when the evidence does not settle one, questions the human keeps, with the QA Delegation `waiting`; and when it asks whether a test could prove a promise, **Add the test** is a send-back Ruling: `message` the building Delegation what the test must assert. It writes and pushes the test, so its head moves and goes back to step 7 (step 6), and this QA Delegation is `void`; the new head is QA'd again. When `qa-plan` stops on a regression, the QA Delegation reports its rows: handle them as a FAIL (4). Once the plan is delivered, start `manual-qa` in that session the way the plan says: on the typed route, `message` it `/manual-qa <plan file>`, or tell the human to type it there; on the brief route, there is nothing to send.
3. **Verify its report** against the source: the QA Plan and QA Report it copied into its Delegation folder, the plan's **Head** is `<head>`, the report has one row per scenario in the plan, the pull request's head is still `<head>`, and wherever the report says the plan was delivered or the report posted, it is there. With no Residue there is no plan or QA Report: check instead that each claim the report names as proving a promise is a test or CI check that passed on `<head>`. A claim that does not hold goes back to the QA Delegation.
4. **Act on the result.** Each outcome below that makes the building Delegation Ready to Merge lists it as such only once it has passed the [default-branch check](#the-default-branch-check), since the default branch may have moved while QA ran.
   - **Every scenario passed:** the QA Delegation is `passed`, and the building Delegation is Ready to Merge.
   - **No Residue:** `qa-plan` found every promise covered by automation and wrote no plan. Once its claims are checked, the QA Delegation is `passed`, the building Delegation is Ready to Merge, and the close-out says it needed no manual QA, with the claims.
   - **Scenarios left for a person, and no FAIL:** one Decision Request lists them, each with its steps from the plan. The human runs each and gives its result, or waives it, and the answer is recorded where `decisions.to` says. The building Delegation is Ready to Merge once each has passed or been waived. A FAIL the human reports is handled as below.
   - **A FAIL, or an outcome under the plan's _Stop and do not merge if_:** the QA Delegation is `failed`. One Decision Request carries each failing row with its evidence, and three options: send it back to the building Delegation (recommended), run QA again on the same head (when the failure looks like the QA Stack, not the change), or accept it as it is. On send back, `message` the building Delegation the failing rows: it is `sent back`, and its fix's new head starts again at step 7. On accept, record the decision where `decisions.to` says, and the building Delegation is Ready to Merge. In an autonomous run, send back or run again is a Ruling; accepting the FAIL stays the human's, and so does waiving a scenario left for a person.

Each QA run after the first, on a new head or on the same one, is a new QA Delegation, `d<issue>-qa2`, then `-qa3`, under the same "go". Its QA Plan replaces the one delivered before.

**Done when:** every building Delegation that needs QA has a `passed` QA Delegation for its current head, a result the human accepted or waived, or has been sent back.

### 10. Close out

In an autonomous run, the Ruling Review comes first. List each Delegation that is `awaiting Ruling Review`. Show the Ruling Ledger grouped by Delegation: each Ruling with its question, its options, the choice and its reason, its evidence, the commits that followed from it, and the Rulings it cited, `needs re-review` ones first. The human answers per Ruling, `upheld: R1 R2; overturned: R3 → option 2`, or with "uphold all". An overturn sends its Delegation back to work, as [Autonomous runs](#autonomous-runs) says, and its row leaves this close-out until its new head is verified. Once no Ruling for a row is `unreviewed` or `needs re-review`, and, with `pull-request`, its pull request's body shows each Ruling it concerns with its verdict (sent to the Delegation, or drafted by the Chief of Staff, as [Autonomous runs](#autonomous-runs) says), it is Ready to Merge.

Then check each Ready to Merge row's head for a review run or comment newer than its verification ([step 7](#the-review-workflow)); a row with one goes back to step 7. Then run the [default-branch check](#the-default-branch-check) on each row still Ready to Merge; a row it takes off the list is printed with what is not on it, below. Then print the Ready to Merge list, one row per Delegation with its pull request and head, and for one that needed QA, its QA result for that head, and for one the human chose to merge as it is, that choice; then the merge order from step 8. With `routes.merge` set, print the command for each, in order. Never run it.

When the list has more than one row, each merge moves the tip under the rows after it: where the repository requires branches to be up to date, they become `BEHIND`, and where it does not, they would merge into code they were not re-gated with. So the merge order opens with: merge one at a time, and say "merged <pr>" after each, so the Chief of Staff checks the next row against the new tip before you merge it.

Also print what is not on the list and why: parked Delegations, Delegations awaiting Ruling Review, analysis results waiting on a decision, issues for the human, and anything raised and unanswered.

Once the list is printed, delete the heartbeat (step 6), with anything the harness file says goes with it, such as a hook's marker file, and record that on the board. Anything that sends a Delegation back to work after that, such as an overturned Ruling, arms it again.

Then one line for the harness: each **check before use** item this run settled, and what it found, so the harness file can be corrected; and, on an unlisted harness, an offer to draft a harness file from what the run learned. Writing either is a change to this skill, made only on the human's yes.

After the human says they have merged, offer a **Run Summary** on the umbrella issue the run's issues share, if they share one ([RUN.md](RUN.md#run-summary)). It is a write as the human: draft it, show it, and post it only on a yes. If parked Delegations are waiting on the merges, offer to resume the run.

**Done when:** the human has the Ready to Merge list and the merge order, and the board says where every Delegation ended.

#### The default-branch check

The default branch moves while rows wait for the human, on merges from inside the run and outside it. This check makes sure a row is still Ready to Merge against the default branch as it is now. It runs at step 10 before the list is printed, and again whenever the human comes back to the run: on `--status`, on `--resume` ([RUN.md](RUN.md#resume)), and when the human says "merged <pr>". No heartbeat is armed for it ([DESIGN.md](DESIGN.md#the-default-branch-checked-on-the-humans-return)).

It checks each row that has a pull request of its own: in a spec run on an integration branch, the `<integration>` row, since a landed ticket has none ([SPEC.md](SPEC.md#on-an-integration-branch)). First fetch, and read the default branch's current tip, `<tip>` (`git rev-parse <remote>/<default>`). Then, for each row:

1. **Its pull request:** `gh pr view <pr> --json headRefOid,mergeStateStatus`. A `headRefOid` other than the row's head is a push: handle it as step 6 says, and check nothing more on that row. `mergeStateStatus` is GitHub's own reading of the repository's rules, from a ruleset or branch protection, so nothing is guessed: `BEHIND` means the repository requires branches to be up to date and this one is not; `UNKNOWN` means GitHub has not worked it out yet, so read it again a minute later, and while it stays `UNKNOWN` the row is off the list, set back to `reported`, shown as "merge state unknown". No other value changes what this check does.
2. **The merge:** `git merge-tree --write-tree <tip> <head>`. A conflict is handled as step 8 handles one: the Delegation merges the default branch into its branch, as a Decision Request, or in an autonomous run a Ruling. That is the row's one question from this check: nothing more is checked on it.
3. **Its checks:** `gh pr checks <pr>`. A failing check, required or not, sends the row back to step 7, which holds every check on the head to green: it is `reported` again. A check still pending keeps the row off the list, set back to `reported` and shown as "checks running": step 7 verifies it again once its checks finish.
4. **The re-gate on the merge result,** when `<tip>` has moved since the board's `Default branch` line, or when the line does not name the row, at its current head, as passed at that tip (a row that failed or was taken off the list at the last check, was verified since, or has a new head since it passed), strict rule or not: two changes that each pass can fail together. Make the merge result a commit without touching any checkout (`git commit-tree <tree> -p <tip> -p <head>`, with `<tree>` from item 2), run each `regate` command on it in a detached worktree, as step 7's re-gate is run, and remove the worktree afterwards.

A row that is `BEHIND`, or whose re-gate fails, is a Decision Request, and the row is `waiting` with the request in its Decision Requests cell ([RUN.md](RUN.md#states)). It says what the check found: the row's head, `<tip>`, the `mergeStateStatus`, whether the merge is clean, and the re-gate's result with its output. Its options:

1. **Merge it as it is**, with the human's admin bypass where the repository requires branches to be up to date. The Chief of Staff never merges, so the human does. The row is Ready to Merge again, and the list says it is to be merged as it is. The choice holds for that head while later re-gates on the merge result pass; one that fails raises the request again.
2. **The Delegation merges the default branch in**: it merges `<tip>` into its own branch, in a new commit, and pushes. That is a new head: the row goes back to step 7, and any QA for the old head is `void` (step 6).

Recommend 1 when the re-gate passed (or did not need to run); otherwise 2. In an autonomous run, option 2 may be a Ruling, when the re-gate failed and the evidence meets the bar ([Autonomous runs](#autonomous-runs)); option 1 is always the human's. So a row that is `BEHIND` with a passing re-gate is a question the human keeps: it goes to them whole, queued as a question not ruled on, with option 1 listed as theirs to take and what option 2 would cost (a new head, step 7 again, QA again).

When the human says "merged <pr>", check that the pull request is merged (`gh pr view <pr> --json state`), mark its row `merged`, and run the default-branch check on each row still Ready to Merge before naming the next one in the order.

On `--status`, the check acts on nothing and writes nothing, the `Default branch` line included: it prints what it found, and `--resume` step 4, which runs the check on each `ready to merge` row against the same line, finds it again and acts on it ([RUN.md](RUN.md#status)).

A row with nothing found stays Ready to Merge. Once every row is checked, except on `--status`, rewrite the board's `Default branch` line with `<tip>` and the time, naming as passed only the rows that passed this check, each with the head it passed at, and log each row's result in the Activity Log. A row the line does not name at its current head is re-gated at its next check, whether or not the tip has moved by then.
