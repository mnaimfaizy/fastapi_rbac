# The brief, the Decision Request and the report

What the Chief of Staff hands an Executor, and what comes back. Load it before writing a brief or reading a report.

## The Brief Contract

Every brief carries these eight items, in this order, as its own headed sections. An Executor reads only its brief: anything it needs and the brief leaves out, it will guess. Fill each item from the config's effective values (`node "<skill>/config.mjs" check`) and the issue, never from memory of another repository.

1. **Read first.** Each document in `read_first`, then the issue, its comments, and the issues and pull requests it links. The Delegation reads them before it plans anything.
2. **Goal, and what done means.** One sentence of goal, then the issue's acceptance criteria, each as a check the Delegation can run or show. For an analysis Delegation, done is the evidence and the options, and nothing built.
3. **Phases, with explicit stop points.** Numbered phases, each ending in a **Stop:** line that says what the Delegation reports, and whether it waits for an answer before going on. A building brief's last phases are always: a code review of its own diff (with `skills.review` when the config names one, on `models.review` where the harness lets a phase run on its own model), fixes for what the review found, then the final commit. Those fixes, and every later one a reviewer, CI or an automated fixer prompts, stay inside the scope fence (item 4). An analysis brief stops after its evidence and options. A QA brief's phases are its own ([below](#the-qa-brief)).
4. **Scope fences.** The paths and shared resources the Delegation may change (its scope fence from the Dispatch Plan), and what it must not touch: other Delegations' fences, files outside the issue's subject, the default branch. The fence binds every change on the branch, whoever asked for it: a fix prompted by a code review, a CI failure or an automated fixer included. A change outside the fence is a Decision Request first, not a judgement call, and is made only once it is answered.
5. **Command routes.** How to commit (`routes.commit`), how to open the pull request (`routes.pull_request`), and the commands that re-gate the branch (`regate`). The skill to implement with (`skills.implement`) in a building brief, or to analyse with (`skills.triage`) in an analysis brief, when the config names one. The branch name the Dispatch Plan gave it.
6. **Rules for writes.** The Delegation may push its own branch, open its own pull request and reply on its own review. It never merges, force-pushes, changes repository settings, or deletes a branch, worktree or checkpoint. Any other write in the human's name (an issue comment, a new issue, a label, closing an issue) it drafts and raises as a Decision Request, unless the brief lists that kind as approved for the run.
7. **The Decision Request form.** The form below, verbatim, and the rule: when the Delegation cannot settle a question from its brief and the documents it read, it raises a Decision Request and stops that line of work until it is answered.
8. **Report and log files.** The paths of its Activity Log, its report and its Decision Requests file in the run folder ([RUN.md](RUN.md)), each as an absolute path into the Chief of Staff's checkout: the run folder is gitignored, so the Delegation's own worktree has no copy of it, and a relative path would land in that worktree, where the Chief of Staff never looks. Then the report form below. It appends to its Activity Log as it works, and writes its report when it reaches a stop point.

## The QA brief

A QA Delegation's brief carries the same eight items, filled for QA. It tests one pull request at one head, `<head>`, the commit SKILL.md step 7 verified, and builds nothing.

1. **Read first.** Each document in `read_first`, the issue, and the pull request with its review.
2. **Goal, and what done means.** Run the QA the repository requires on pull request `#<n>` at `<head>`. Done is a QA Plan and a QA Report for `<head>`, both copied into the run folder, and delivered only as item 6 allows. A FAIL is a result to report, never a thing to fix.
3. **Phases, with explicit stop points.**
   1. **Pin the head.** In its own working copy, fetch, then `git switch --detach <head>`. `git rev-parse HEAD` and the pull request's `headRefOid` must both be `<head>`. **Stop:** report the pinned head, or, if either is not `<head>`, the mismatch, and run nothing more. Then wait for `/qa-plan <n>`.
   2. **Compose the QA Plan** with `/qa-plan <n>`, which reaches this session as a message after phase 1, as item 5 says. At `qa-plan`'s point of showing the draft, copy it to `qa-plan.md` in its Delegation folder, and raise a Decision Request that carries the draft's scenarios, each with what it checks, and where it would be delivered. When the human is in this session and answers `qa-plan` here, log the answer instead. **Stop:** wait for the answer, deliver on a yes, and report. When `qa-plan` finds no Residue and writes no plan, **Stop:** report that, with the claims it named as proving each promise, and skip phases 3 and 4.
   3. **Run it** with `/manual-qa <plan file>`, which reaches this session as a message after phase 2, as item 5 says, against the target `qa.config` names. On a `stack` target it holds the QA Stack until `manual-qa` has stopped what it started. **Stop:** none of its own: it goes straight on to phase 4, stopping only to raise a Decision Request item 6 needs, such as an upload, and waiting for its answer.
   4. **Report.** Copy the QA Report to `qa-report.md` in its Delegation folder. At `manual-qa`'s offer to post, post only as item 6 allows. **Stop:** write the QA report below.
4. **Scope fences.** None: it commits nothing, pushes nothing, and changes no tracked file. Its working copy stays detached at `<head>`. The QA Stack is its only shared resource, when it holds it.
5. **Command routes.** The pull request's number and `<head>`, the QA config's path (`qa_config` from `check`), and how each QA skill starts on this harness ([HARNESSES.md](HARNESSES.md#choosing-an-executor)): sent to the session as a message after the phase before it stops, or typed there by the human. `qa-plan` and `manual-qa` are invoked only by a person, so the session never tries to start one itself. When a message names a skill and the session cannot run it as an invocation, it says so in its Activity Log and its last message, and waits for the human to type it.
6. **Rules for writes.** Delivering the QA Plan only on the answer to phase 2's Decision Request. Posting the QA Report only when the brief lists it as an approved routine kind for the run, or on a Decision Request's yes. Uploading a QA Artifact only on a yes for that file. When the human is in this session and answers a QA skill's own question here (to deliver, to post, or to upload a file), that answer counts: log it, and raise no Decision Request for it. No other write.
7. **The Decision Request form.** As in the Brief Contract.
8. **Report and log files.** As in the Brief Contract, with the paths of `qa-plan.md` and `qa-report.md` in its Delegation folder, and the QA report form below in place of the report form.

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

## Report

```markdown
### Report: <Delegation id>, #<issue>

**Stop point:** <phase number and its Stop: line>
**Branch:** <name> at <full commit SHA>, pushed: <yes/no>
**Pull request:** <URL, or none yet>
**Done:** <each acceptance criterion, and how it was shown>
**Re-gate:** <each command, and its result>
**Review:** <each review comment, and how it was handled>
**Not done:** <what is left, and why>
**Decision Requests:** <open ones, by heading>
```

Every line is a claim the Chief of Staff checks before it tells the human anything. A line that cannot be filled says so; a report with a blank line is sent back.

A QA Delegation reports in this form instead:

```markdown
### QA report: <Delegation id>, #<issue>, pull request #<n>

**Stop point:** <phase number and its Stop: line>
**Head:** <full commit SHA tested>; the pull request's head at the end: <full SHA>
**QA Plan:** <path in the run folder>; delivered: <where, or not yet>; or none: no Residue, with each claim that proves a promise
**QA Report:** <path in the run folder, or none yet>; posted: <where, or no, and why>
**Results:** <how many PASS, FAIL and left for a person; each FAIL and each left for a person by scenario>
**QA Stack:** <started and stopped by this run, or not used>
**Decision Requests:** <open ones, by heading>
```
