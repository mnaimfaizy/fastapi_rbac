# The brief, the Decision Request and the report

What the Chief of Staff hands an Executor, and what comes back. Load it before writing a brief or reading a report.

## The Brief Contract

Every brief carries these eight items, in this order, as its own headed sections. An Executor reads only its brief: anything it needs and the brief leaves out, it will guess. Fill each item from the config's effective values (`node "<skill>/config.mjs" check`) and the issue, never from memory of another repository.

1. **Read first.** Each document in `read_first`, then the issue, its comments, and the issues and pull requests it links. The Delegation reads them before it plans anything.
2. **Goal, and what done means.** One sentence of goal, then the issue's acceptance criteria, each as a check the Delegation can run or show. For an analysis Delegation, done is the evidence and the options, and nothing built.
3. **Phases, with explicit stop points.** Numbered phases, each ending in a **Stop:** line that says what the Delegation reports, and whether it waits for an answer before going on. A building brief's last phases are always: a code review of its own diff (with `skills.review` when the config names one, on `models.review` where the harness lets a phase run on its own model), fixes for what the review found, then the final commit. An analysis brief stops after its evidence and options.
4. **Scope fences.** The paths and shared resources the Delegation may change (its scope fence from the Dispatch Plan), and what it must not touch: other Delegations' fences, files outside the issue's subject, the default branch. A change outside the fence is a Decision Request, not a judgement call.
5. **Command routes.** How to commit (`routes.commit`), how to open the pull request (`routes.pull_request`), and the commands that re-gate the branch (`regate`). The skill to implement with (`skills.implement`) in a building brief, or to analyse with (`skills.triage`) in an analysis brief, when the config names one. The branch name the Dispatch Plan gave it.
6. **Rules for writes.** The Delegation may push its own branch, open its own pull request and reply on its own review. It never merges, force-pushes, changes repository settings, or deletes a branch, worktree or checkpoint. Any other write in the human's name (an issue comment, a new issue, a label, closing an issue) it drafts and raises as a Decision Request, unless the brief lists that kind as approved for the run.
7. **The Decision Request form.** The form below, verbatim, and the rule: when the Delegation cannot settle a question from its brief and the documents it read, it raises a Decision Request and stops that line of work until it is answered.
8. **Report and log files.** The paths of its Activity Log, its report and its Decision Requests file in the run folder ([RUN.md](RUN.md)), each as an absolute path into the Chief of Staff's checkout: the run folder is gitignored, so the Delegation's own worktree has no copy of it, and a relative path would land in that worktree, where the Chief of Staff never looks. Then the report form below. It appends to its Activity Log as it works, and writes its report when it reaches a stop point.

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
