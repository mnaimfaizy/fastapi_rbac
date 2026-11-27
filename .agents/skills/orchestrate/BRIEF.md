# The brief, the Decision Request and the report

What the Chief of Staff hands an Executor, and what comes back. Load it before writing a brief or reading a report.

## The Brief Contract

Every brief carries these eight items, in this order, as its own headed sections. An Executor reads only its brief: anything it needs and the brief leaves out, it will guess. Fill each item from the config's effective values (`node "<skill>/config.mjs" check`) and the issue, never from memory of another repository.

1. **Read first.** Each document in `read_first`, then the issue, its comments, and the issues and pull requests it links. The Delegation reads them before it plans anything. In an autonomous run, a Delegation started from another's branch also gets the Rulings already concerning that branch, each with its id, choice, verdict and commits ([SKILL.md](SKILL.md#autonomous-runs)).
2. **Goal, and what done means.** One sentence of goal, then the issue's acceptance criteria, each as a check the Delegation can run or show. For an analysis Delegation, done is the evidence and the options, and nothing built.
3. **Phases, with explicit stop points.** Numbered phases, each ending in a **Stop:** line that says what the Delegation reports, and whether it waits for an answer before going on. A building brief's last phases are always: a code review of its own diff (with `skills.review` when the config names one, on `models.review` where the harness lets a phase run on its own model), fixes for what the review found, then the final commit. Those fixes, and every later one a reviewer, CI or an automated fixer prompts, stay inside the scope fence (item 4). A building brief whose ticket changes a rule also carries a **stale-wording list** in its review phase: the old wording of each rule the ticket changes, one phrase each. The Delegation searches the repository for each phrase (code, skills, docs), reports every hit, and fixes each stale one inside the scope fence or raises the ones outside it as a Decision Request. An analysis brief stops after its evidence and options. A QA brief's phases are its own ([below](#the-qa-brief)).
4. **Scope fences.** The paths and shared resources the Delegation may change (its scope fence from the Dispatch Plan), and what it must not touch: other Delegations' fences, files outside the issue's subject, the default branch. Write the fence as globs as well as prose: one list of repository-relative globs (`**` crosses folders, `*` stays in one, a trailing `/` is a whole folder), which the Chief of Staff passes to `land --fence` verbatim when the branch lands. A path the globs do not match cannot land. The fence binds every change on the branch, whoever asked for it: a fix prompted by a code review, a CI failure or an automated fixer included. A change outside the fence is a Decision Request first, not a judgement call, and is made only once it is answered.
5. **Command routes.** How to commit (`routes.commit`), how to open the pull request (`routes.pull_request`), and the commands that re-gate the branch (`regate`). The skill to implement with (`skills.implement`) in a building brief, or to analyse with (`skills.triage`) in an analysis brief, when the config names one. The branch name the Dispatch Plan gave it.
6. **Rules for writes.** The Delegation may push its own branch, open its own pull request and reply on its own review. It never merges, force-pushes, changes repository settings, or deletes a branch, worktree or checkpoint. Any other write in the human's name (an issue comment, a new issue, a label, closing an issue) it drafts and raises as a Decision Request, unless the brief lists that kind as approved for the run.
7. **The Decision Request form.** The form below, verbatim, and the rule: when the Delegation cannot settle a question from its brief and the documents it read, it raises a Decision Request and stops that line of work until it is answered. In an autonomous run, the brief adds that an answer may arrive as a Ruling `R<n>`, in the [Ruling form](#ruling) below, to be acted on as an answer and recorded in its pull request labelled "Chief of Staff ruling, not yet reviewed", then updated to its verdict after the Ruling Review.
8. **Report and log files.** The paths of its Activity Log, its report and its Decision Requests file in the run folder ([RUN.md](RUN.md)), each as an absolute path into the Chief of Staff's checkout: the run folder is gitignored, so the Delegation's own worktree has no copy of it, and a relative path would land in that worktree, where the Chief of Staff never looks. Then the report form below, which in an autonomous run carries the commit-to-Ruling map: each Ruling it followed, with the commits that followed from it. Then its **events file**, `events.jsonl` beside them, as an absolute path too, and the `records.mjs event` commands that write its Run Events with its own values already filled in: its `delegation` id, issue, kind, Executor kind, model and start route. It writes a Run Event for each step as it happens, with `--actor delegation`, never afterwards and never with a time of its own ([RUN.md](RUN.md#run-events-and-the-run-record)): `delegation-started` as its very first act, before it reads anything; `delegation-landed` each time it pushes work it reports as landed, or commits it as landed on an integration branch, with the head; `write` for each write it makes to the tracker; and `delegation-ended` as the last thing it does, once its final report says `**Final:** yes`, with its outcome. A Run Event holds ids, numbers and enum values and never a sentence: a reason in words goes in its Activity Log. A Delegation never writes the Chief of Staff's events file or another Delegation's. It writes no `decision-request`: when it raises a Decision Request, the Chief of Staff writes that event as it queues the request, with the next run-wide id `dr<n>`. It appends to its Activity Log as it works, and writes its report when it reaches a stop point. It never ends its turn while work its report depends on is still running, such as a re-gate, a test run or a wait on CI: it waits for that work in the same turn. So it runs the re-gate and the review sub-agents in the foreground, waiting for each in the same turn, and only then writes its report: work started in the background and left running while the turn ends wakes the Chief of Staff with nothing to verify, turn after turn. If it must end the turn anyway, it first writes the report with `**Final:** no, waiting on <what>`, and writes it again with `**Final:** yes` when that work has finished. A turn that ends early wakes the Chief of Staff with nothing to verify.

## The QA brief

A QA Delegation's brief carries the same eight items, filled for QA. It tests one pull request at one head, `<head>`, the commit SKILL.md step 7 verified, and builds nothing.

**A parked QA brief.** Where the harness starts every QA session at the `go` turn ([harnesses/claude-code-desktop.md](harnesses/claude-code-desktop.md)), the head is not known yet. The brief is then written without `<head>`: it names the pull request, the QA config and the other items below, and says "your head comes in a message from the Chief of Staff: until it does, do nothing and stay idle". The session is parked. When SKILL.md step 9 has a head to test, the Chief of Staff messages the session `<head>`, the pull request's number and, where the run has them, the paths of the answers files. That message is the brief's missing `<head>`: everything below that names `<head>` reads it from the message.

**A scoped QA brief.** When the human answers a scenarios-left-for-a-person Decision Request (or `"QA held for you"` entry) by choosing **a new QA Delegation**, `d<issue>-qa<k>` (next unused suffix) runs on a scoped QA brief on the Executor the human named in the answer (one that has the missing driver, such as a Live Session with a browser). It is not a re-QA of a new head and never re-composes the QA Plan. Instead, it runs only the listed scenarios (`S<n>`, …) on the **same `<head>`** and the **same delivered QA Plan**:

- **Read first** includes the earlier QA Delegation's `qa-plan.md` and `qa-report.md` in the run folder.
- **Phase 1 (Pin the head)** pins `<head>` as below, copies the earlier Delegation's delivered `qa-plan.md` into `<working_dir>/qa-plan-pr-<n>.md` (and `qa-run.json` on the brief route), and skips composing the QA Plan.
- **Phase 2 (Run the listed scenarios)** runs `manual-qa` on `<working_dir>/qa-plan-pr-<n>.md` for only the listed scenarios (leaving every other scenario from the earlier QA Report untouched), holding the QA Stack only if those scenarios use a `stack` target.
- **Phase 3 (Merge and report)** merges its scoped rows into the earlier QA Report for `<head>` with `node "<manual-qa>/report.mjs" merge "<earlier-qa-report>" --with "<scoped-qa-report>" --delegation <d<issue>-qa<k>> --scenarios <S-list> --plan "<delivered-qa-plan>"` (replacing only the listed scenarios' `"left for a person"` rows and writing the `- **Scoped runs:**` provenance line naming `d<issue>-qa<k>`), verifies with `report.mjs read --plan`, copies the merged QA Report to `qa-report.md` in its Delegation folder, uploads eligible new QA Artifacts only as item 6 allows, and where posting is approved runs `report.mjs comment` on the merged report and edits the existing `<!-- qa-report -->` comment in place (`report.mjs find` -> `PATCH`; never posts a second comment).
- **Phase 4 (Report)** writes the QA report form below and is verified like any QA result under SKILL.md step 9 item 3.

Each QA skill starts by one of two routes, which the brief names ([SKILL.md](SKILL.md) step 4):

- **The typed route.** In a run approved with plain `go`. Each skill is a command, sent to the session as a message or typed there by the human: `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]`, then `/manual-qa <plan file>`. The `--answers` part is there only when the brief names an answers file.
- **The brief route.** In a `go autonomous` run with QA approved, for a `target: stack` or a `target: url` plan. The session reads `<qa-plan>/SKILL.md`, and later `<manual-qa>/SKILL.md`, and follows each as a phase of this brief, by its "Run from an autonomous brief" section, with `<skill>` that skill's folder. Nobody types either command.

Either way, the session first has to copy the run's answers file into its `working_dir`, when the brief gives one: `qa-plan` reads it only from there.

1. **Read first.** Each document in `read_first`, the issue, and the pull request with its review.
2. **Goal, and what done means.** Run the QA the repository requires on pull request `#<n>` at `<head>`. Done is a QA Plan and a QA Report for `<head>`, both copied into the run folder, and delivered only as item 6 allows. A FAIL is a result to report, never a thing to fix.
3. **Phases, with explicit stop points.**
   1. **Pin the head.** A parked session first waits for the head message (it ends its turn idle, writes no report, and starts on the message), then pins `<head>` from it. A message for a re-QA (`d<issue>-qa2`) says so: the session copies its earlier QA Plan and QA Report to the run folder if they are not there yet, then throws away its old state (the detached head, the files in `<working_dir>`, the earlier run's answers copies, and any QA Stack it started is already stopped), and pins the new head. In its own working copy, fetch, then `git switch --detach <head>`. `git rev-parse HEAD` and the pull request's `headRefOid` must both be `<head>`. **Stop:** report the pinned head, or, if either is not `<head>`, the mismatch, and run nothing more. Then copy the run's answers files, when item 5 names them, to `<working_dir>/qa-readiness.json` and, on the brief route, `<working_dir>/qa-run.json`. On the typed route, wait for `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]`; on the brief route, go on to phase 2.
   2. **Compose the QA Plan** with `qa-plan`, for pull request `#<n>` with `--answers <working_dir>/qa-readiness.json` when phase 1 copied the file: on the typed route, as the command that reaches this session after phase 1, as item 5 says; on the brief route, by following `<qa-plan>/SKILL.md` from its start. At `qa-plan`'s point of showing the draft, copy it to `qa-plan.md` in its Delegation folder, and raise a Decision Request that carries the draft's scenarios, each with what it checks, where it would be delivered, and the draft's `Readiness answers reused from <file>: <values>` line when it took `--answers`. When the human is in this session and answers `qa-plan` here, log the answer instead. **Stop:** wait for the answer, deliver on a yes, and report. When `qa-plan` finds no Residue and writes no plan, **Stop:** report that, with the claims it named as proving each promise, and skip phases 3 and 4.
   3. **Run it** with `manual-qa` on the delivered plan file, against the target `qa.config` names: on the typed route, as `/manual-qa <plan file>`, which reaches this session after phase 2, as item 5 says; on the brief route, by following `<manual-qa>/SKILL.md` from its start, with `--answers <working_dir>/qa-run.json --answers-base <base> --base <base>` when phase 1 copied the file. On a `stack` target it holds the QA Stack until `manual-qa` has stopped what it started. **Stop:** none of its own: it goes straight on to phase 4, stopping only to raise a Decision Request and wait for its answer: on the typed route, one item 6 needs, such as an upload; on the brief route, any Decision Request the skill's "Run from an autonomous brief" section raises, such as a run need it does not have.
   4. **Report.** Copy the QA Report to `qa-report.md` in its Delegation folder. On the brief route, at `manual-qa`'s step for each open `Review:` box, quote each box's file at `<head>`, save the quotes to `review-quotes.md` in its Delegation folder, and mark each box "literal, quoted" or "needs judgment"; it never ticks a box. At `manual-qa`'s offer to post, post only as item 6 allows. **Stop:** write the QA report below.
4. **Scope fences.** None: it commits nothing, pushes nothing, and changes no tracked file. Its working copy stays detached at `<head>`. The QA Stack is its only shared resource, when it holds it.
5. **Command routes.** The pull request's number and `<head>`, the QA config's path (`qa_config` from `check`), the route each QA skill starts by, and the run's answers file:
   - **The answers file:** the absolute path of the run's `qa-readiness.json` (or `qa-readiness-<base>.json`), and where to copy it, `<working_dir>/qa-readiness.json`, with `<working_dir>` the one the answers give, or else the QA config's (`tmp/qa` by default). A pull request with another base branch than the one the answers were given for gets none: its `qa-plan` asks ([SKILL.md](SKILL.md) step 4).
   - **On the typed route:** how each QA skill starts on this harness (its file under [harnesses/](harnesses/), and [HARNESSES.md](HARNESSES.md#choosing-an-executor)): sent to the session as a message after the phase before it stops, or typed there by the human, as the exact command, `/qa-plan <n> [--answers <working_dir>/qa-readiness.json]`, with the `--answers` part only when the brief names an answers file. `qa-plan` and `manual-qa` are invoked only by a person, so the session never tries to start one itself. When a message names a skill and the session cannot run it as an invocation, it says so in its Activity Log and its last message, and waits for the human to type it.
   - **The run answers file, on the brief route:** the absolute path of the run's `qa-run.json`, copied to `<working_dir>/qa-run.json` the same way, and `<base>`, the branch the answers were given for and the pull request's base branch, so `manual-qa` uses the file only when the two agree. A pull request with another base gets none, and its QA is held, never asked.
   - **The Places:** the Places the run uses and which of them hold a merge, as the Dispatch Plan showed them ([SKILL.md](SKILL.md) step 4): the `report.places` and `report.holds` the readiness answers (or the config) give, with a run-only change already in `qa-readiness.json` as `report`; that change applies to composing the plan only, and the config at `<head>` is the source of truth for posting and for `report.mjs`. Every `Review:` box and every item left for a person is tagged with one of them.
   - **Uploads:** whether the human approved "upload eligible QA Artifacts to `<tag>`" in the Dispatch Plan, and the `<tag>`. Said once, and with no approval the brief says uploads are not approved.
   - **The hosts, on a `url` target:** each host the human typed in the Dispatch Plan, with its `name` and `surface` when it came from a `run.hosts` entry, its verdict (`hosted`, as `adapter.mjs host … --confirmed` gave it), whether the environment's owner ran the seeder there (yes: the session runs `accounts.print` itself; no: the scenarios that sign in there are held), and one provenance line for each: "typed by the human in this run's Dispatch Plan, verdict hosted". This brief is the only route a host reaches the session by, so it is never written to a config, never to `<working_dir>`, and never copied to a file the session writes; each host is deleted at close-out, from this brief and from `qa-hosts.json` ([SKILL.md](SKILL.md) step 10), so the run folder no longer holds it. The session checks each host again with `adapter.mjs host … --target url --confirmed` before any sign-in. A host it refuses, an entry the brief lacks and an unconfirmed entry hold only the scenarios that use it, logged and reported under **Held for close-out:**: held, never typed, and the session is never moved to the typed route mid-run. A harness whose QA session does not accept a host relayed through its brief ([harnesses/](harnesses/), **Check before use**) holds every scenario of the target.
   - **The stale edit:** on the brief route it is never made or asked about; the session logs that it was skipped.
   - **On the brief route:** `<qa-plan>` and `<manual-qa>`, each skill's folder, as absolute paths, from the same install as its helper scripts: the folders whose `adapter.mjs` and runners the session runs, as each skill's `where` names them. The session reads `<qa-plan>/SKILL.md` and `<manual-qa>/SKILL.md` there and follows each; it never invokes either skill.
6. **Rules for writes.** Delivering the QA Plan only on the answer to phase 2's Decision Request. Posting the QA Report only when the brief lists it as an approved routine kind for the run, or on a Decision Request's yes. Uploading a QA Artifact only on a yes for that file, on the typed route. On the brief route, it uploads nothing unless the brief says uploads are approved: then it uploads exactly what `report.mjs evidence` accepts, with no per-file question, never a failed run's media, and the eligibility refusals still apply. It makes no stale edit and asks about none, and logs that it was skipped. A post the brief does not list as routine is not asked for: the report says it is not posted, and the post waits as a queued write for the human. When the human is in this session and answers a QA skill's own question here (to deliver, to post, or to upload a file), that answer counts: log it, and raise no Decision Request for it. No other write.
7. **The Decision Request form.** As in the Brief Contract.
8. **Report and log files.** As in the Brief Contract, with the paths of `qa-plan.md` and `qa-report.md` in its Delegation folder, and the QA report form below in place of the report form. The same rules on ending a turn hold: it runs the re-gate and any review sub-agents in the foreground, waiting for each in the same turn, and only then writes its QA report; a QA report says `**Final:** yes` only once nothing it depends on is still running, and `**Final:** no, waiting on <what>` before a turn that must end sooner.

## Decision Request

```markdown
### Decision Request: <one-line question>

**Delegation:** <id>, for #<issue>
**Context:** <what the human needs to know to answer, in a few sentences: no "see above", no link they must open>
**Options:**

1. <option>: <what follows from it>
2. <option>: <what follows from it>

**Recommendation:** <option number>, because <reason>
**Evidence:** <file:line, command output, or link, for each claim above>
**Blocks:** <what waits on the answer>
```

The Chief of Staff relays it as written, adding only which Delegation it is from. When the answer comes, it is recorded where `decisions.to` says (with `pull-request`, by the Delegation in its own pull request's body), so a reviewer of the pull request can see why the work went the way it did.

## Ruling

In an autonomous run, the Chief of Staff answers some Decision Requests itself ([SKILL.md](SKILL.md#autonomous-runs)), and sends each to the Delegation in this form:

```markdown
### Ruling: R<n>, <one-line question>

**Delegation:** <id>, for #<issue>
**Answers:** <the Decision Request's heading, or the stall, crash, conflict or QA result it acts on>
**Choice:** <option number and what it says>, because <reason>
**Evidence:** <for each claim: `path:line` at a commit SHA, a file in the run folder's `evidence/`, a tracker permalink, or a Ruling id>
**Cites:** <earlier Rulings by id, or none>
**Record:** <with `pull-request`, to a building Delegation that has a pull request: add `R<n> (Chief of Staff ruling, not yet reviewed): <question> → <choice>` to your pull request's body, under "Decisions", or in a Team Run `R<n> (@<login>'s Chief of Staff ruling, not yet reviewed): <question> → <choice>`, with the Chief of Staff's teammate's login ([TEAM.md](TEAM.md#rulings-in-a-team-run)); to a QA Delegation, or a ticket on a spec run's integration branch: none, the Chief of Staff records it; with `issue-comment`: none, the Chief of Staff records it>
```

The Chief of Staff writes `ruling-made` when it sends the Ruling and `ruling-verdict` at the Ruling Review; the Delegation writes neither, and a wait on the human is never its to open. The Delegation acts on a Ruling as on the human's answer, and marks its Decision Request in `decisions.md` answered by `R<n>`. A Ruling stands until the Ruling Review, where the human upholds or overturns it. The Chief of Staff then `message`s the verdict, and a Delegation that added the line changes `not yet reviewed` in it to `upheld`, or to `overturned → option <k>`. An overturn comes with the human's answer, sent like any other: the Delegation redoes the work the Ruling led to, in new commits on its branch, and reports again. Every commit made because of a Ruling goes in the report's **Rulings** line.

## Report

```markdown
### Report: <Delegation id>, #<issue>

**Final:** <yes, or no, waiting on <what>>
**Stop point:** <phase number and its Stop: line>
**Branch:** <name> at <full commit SHA>, pushed: <yes/no>
**Pull request:** <URL, or none yet>
**Done:** <each acceptance criterion, and how it was shown>
**Re-gate:** <each command, and its result>
**Review:** <each review comment, and how it was handled; where the repository runs Agent-kit's review workflow, its run on this head: finished, running, or not started>
**Rulings:** <in an autonomous run, each Ruling followed, as `R<n>: <full commit SHA>, …`, the commits that followed from it, with its pull request line's verdict, and each Ruling the brief listed from an earlier Delegation on the branch, with the commits the brief gave; or none>
**Not done:** <what is left, and why>
**Decision Requests:** <open ones, by heading>
```

Every line is a claim the Chief of Staff checks before it tells the human anything. A line that cannot be filled says so; a report with a blank line is sent back. The **Final:** line tells an early wake-up from a finished report: the Chief of Staff verifies only a report that says `yes`, and keeps checking one that says `no` ([SKILL.md](SKILL.md) step 7).

A QA Delegation reports in this form instead:

```markdown
### QA report: <Delegation id>, #<issue>, pull request #<n>

**Final:** <yes, or no, waiting on <what>>
**Stop point:** <phase number and its Stop: line>
**Head:** <full commit SHA tested>; the pull request's head at the end: <full SHA>
**QA Plan:** <path in the run folder>; delivered: <where, or not yet>; or none: no Residue, with each claim that proves a promise
**QA Report:** <path in the run folder, or none yet>; posted: <where, or no, and why>
**Results:** <how many PASS, FAIL and left for a person; each FAIL and each left for a person by scenario>
**Held for close-out:** <in an approved-QA run, each item held for the human, with its evidence and its options: judgment boxes, scenarios left for a person, after-merge scenarios, a missing address, a `working_dir` not ignored, an unsettled question; or none>
**QA Stack:** <started and stopped by this run, or not used>
**Decision Requests:** <open ones, by heading>
```
