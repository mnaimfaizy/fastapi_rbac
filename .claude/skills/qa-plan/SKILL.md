---
name: qa-plan
description: Write a QA Plan for an open pull request — only the manual verification a passing CI run would not establish — and deliver it where the team runs QA.
disable-model-invocation: true
argument-hint: "[pull request number or URL]"
metadata:
  agent-kit-scope: user
---

# QA Plan

A user-invoked compose skill. For one open pull request it writes a **QA Plan**: the **Residue**, the manual verification a passing CI run would not establish, in a format a person or an agent elsewhere can run from the plan alone. The `manual-qa` skill runs it. This skill composes; it runs no scenario and commits nothing.

Load [ANATOMY.md](ANATOMY.md) before writing the plan: it is the format, section by section. Load [ADAPTER.md](ADAPTER.md) when reading or writing `qa.config.yml`, or when a Hazard pack is involved. Load [DESIGN.md](DESIGN.md) when a rule needs its reason, or before changing this skill.

`<skill>` in a command below is the absolute path of the folder this file is in, written with forward slashes (`C:/Users/me/...` on Windows), inside double quotes because it may contain spaces. Every command runs from the root of the repository the pull request belongs to.

## Rules

- **Residue only.** A scenario earns its place by naming what no passing suite establishes. Re-testing what CI proves wastes the tester and hides the scenarios that matter.
- **Every coverage claim is tagged** `[observed]` or `[reconstructed]` ([ANATOMY.md](ANATOMY.md#what-automation-already-proves)). A claim `two-point.mjs` saw test by test, at the merge-base and at the head, is `[observed]`; one it could only compare by exit code, or one read from CI results, the diff and the issue history, is `[reconstructed]`.
- **Read the UI from source.** Every step quotes the real label, button text or copy from the code or templates the pull request ships. When the source does not say, write that the step needs the label confirmed, rather than a guess.
- **No credentials in the plan**, not even a public QA Account's values: role ids, at most emails, and where the values come from ([ANATOMY.md](ANATOMY.md#no-credentials-travel-with-a-plan)).
- **Compose in `working_dir`, commit nothing**, and deliver only after the person has seen the draft and said yes.

## Workflow

### 1. Check the precondition

A QA Plan is about one pull request at one head. Find it: the pull request the person named, or `gh pr view --json number,url,state,isDraft,baseRefName,headRefName,headRefOid,closingIssuesReferences` for the current branch.

Stop and name the next step when:

- the checkout is on the default branch or a detached head: _create a branch for the change, push it and open a pull request, then run `/qa-plan` again_;
- the branch has no open pull request: _push it and open one (`gh pr create --draft`), then run `/qa-plan` again_;
- the local `HEAD` is not the pull request's head commit: _push (or pull) so the two agree; the plan is pinned to the head the tester will get_.

Without `gh`, ask the person for the pull request's URL and the issue it closes; never compose a provisional plan for a change that has no pull request.

**Done when:** one open pull request is identified, and its head SHA equals the local `HEAD`.

### 2. Read the config

```bash
node "<skill>/adapter.mjs" check --for plan
```

- Exit 1: the config has **problems**. Show each one, with its line, and stop until the config is fixed. A misread config composes against the wrong base or the wrong suites.
- `readiness.needs` not empty: list exactly what is missing, and ask for it in one message. Compose goes on with the answers given in chat. Then offer to save them in the config. Put the answers in a JSON file in `working_dir`: the one the answers give, or the config's when they give none. Then run `node "<skill>/adapter.mjs" render < <answers.json>`, and show the person the result: the config the lookup found (or a new `qa.config.yml`) with the answers merged in, every other key kept, and YAML comments dropped. Only on a yes, run it again with `--write` ([ADAPTER.md](ADAPTER.md#readiness-check)). If that exits 3, the file has comments: tell the person which lines would be lost, and only if they agree, run it with `--write --drop-comments`.
- `readiness.notes`: say each one, and go on.

Check that `working_dir` is ignored: `git check-ignore -q <working_dir>/x`. If it is not, say so and ask before writing there: everything in it must stay out of commits.

**Done when:** the base ref, the suites, `working_dir`, the publish rules and the Hazard packs are known, each from the config or from an answer the person gave.

### 3. Fix the anchors and the subject

- **Merge-base:** `git fetch` the base ref, then `git merge-base <base_ref> HEAD`.
- **Head:** the pull request's head SHA from step 1.
- **Subject issue:** the issue the pull request closes (`closingIssuesReferences`, or a `Closes #n` in its body). Several: ask which one is the subject. None: ask the person; compose no plan without one.
- **Child issues:** the subject's GitHub sub-issues (`gh api repos/{owner}/{repo}/issues/<n>/sub_issues`). With none, the branch's commits (`git log --reverse <merge-base>..HEAD`) are the breakdown of the change instead.

Read the subject, each child, and their comments: their acceptance criteria are what the change promises.

**Done when:** all four anchors are known, and every promise the subject and its children make is listed.

### 4. Establish what automation already proves

Run the configured suites at both points:

```bash
node "<skill>/two-point.mjs" --base <base_ref>
```

When step 2 used answers given in chat and the person did not save them, pass the answers file step 2 wrote: add `--answers <working_dir>/<answers.json>`. The runner merges it over the config, or over none, as `render` does, and writes no config. It takes the file only from inside the `working_dir` the merge gives, so an answer that sets `working_dir` moves where the file must be. Never write a config, even a temporary one, to run it ([ADAPTER.md](ADAPTER.md#readiness-check)).

It runs each `plan.suites` command in the platform's default shell (`cmd.exe` on Windows, `/bin/sh` elsewhere; [ADAPTER.md](ADAPTER.md#which-shell-runs-command)), in the checkout, at the head, then in a detached worktree at the merge-base under `working_dir`, which it removes afterwards, whether the run succeeds or fails. It compares the two runs' JUnit XML test by test and prints a table. It takes as long as the suites, twice: say so before it starts. To run fewer, pass `--suite <name>` once for each suite whose `surfaces` cover the changed paths.

- **Exit 1: a regression.** A test that passes at the merge-base, or a new test, fails at the head. Stop: show the person those rows, and tell them to fix it before a plan is worth writing.
- **Exit 2:** nothing was compared (a config problem, a ref git cannot find, an interrupted run). Show the message. When it cannot be fixed, go on without the runner, and tag every claim `[reconstructed]`.
- **Exit 0:** read the table, row by row:
  - `covered`, `covered (new)`, `covered (unskipped)`, `covered (fixed at head)`: a claim, with the tag the row prints. Name each new or unskipped test.
  - `expected red herring`: it fails at both points; it goes in _Expected red herrings_, with its tag.
  - `unknown`: it fails at the head, and the merge-base did not build or run, so it cannot be told from a red herring. Ask the person which it is before going on.
  - `removed at head`: coverage the change took away; the promise that test proved may now be Residue.
  - `skipped at head`: proves nothing.
  - _Degraded suites_: say each one and why. A suite with no JUnit, or with a merge-base that will not build, is compared by exit code only, and its claims stay `[reconstructed]`.

Then, for each promise, find what proves it: the rows for the tests the diff adds or changes (`git diff --stat <merge-base> HEAD`), the suites whose `surfaces` cover the changed paths, and what the issue history says was tested. A CI check on the head (`gh pr checks`) that is not a configured suite gives a `[reconstructed]` claim; so does a failure on it, which is a red herring only when it also fails at the merge-base.

Optional, when a claim carries the plan: perturb the code it covers (comment out the guard, invert the condition) and run the suite. A green suite that stays green is not a proving suite; the promise moves to the Residue. Revert the change before going on.

**Done when:** no regression is left, every `unknown` row has the person's answer, and every promise is either covered by a named claim or left for the Residue.

### 5. Match the Hazard packs

```bash
git diff --name-only <merge-base> HEAD | node "<skill>/adapter.mjs" hazards
```

Each pack it prints matched at least one changed path. Exit 1 means a pack in `hazards` is missing or malformed: show the problem and stop.

**Done when:** every matching pack is known, with the paths it matched.

### 6. Compose the Residue

Each promise step 4 left uncovered becomes a scenario ([ANATOMY.md](ANATOMY.md#scenarios)). For each one, read the code and templates it exercises and quote their real labels in the steps. A scenario that touches a path a Hazard pack matched gets that pack's _Rule out first_ list; every matching pack's _Capture rules_ go into the Run brief.

When a promise needs two people signed in at once, compose a multi-session scenario. For example, an `admin`'s action ends a `user`'s session elsewhere. Give it **Sessions:** (`A = user, B = admin`) in place of **Signs in as:**, and start every step `In session <name>,` ([ANATOMY.md](ANATOMY.md#sessions)). Never fold the second person into a step's prose: the run would sign in once and could not carry the scenario out.

**An empty Residue is a valid outcome.** When every promise is covered, write no plan: tell the person the change is proved by automation, name the claims that prove it, and recommend merging without one. Stop here.

**Done when:** every uncovered promise is a scenario with every field [ANATOMY.md](ANATOMY.md#scenarios) requires, or the Residue is empty and the person has been told.

### 7. Write the draft and show it

Write the plan to `<working_dir>/qa-plan-pr-<n>.md`, in the shape [ANATOMY.md](ANATOMY.md) gives, with the _Execution record_ exactly `_Not run yet._`. Read it back against [ANATOMY.md](ANATOMY.md): nine sections in order, the marker on line 1, every claim tagged, no credentials. `node "<skill>/adapter.mjs" plan <file>` must exit 0: it is the check `manual-qa` runs before it accepts a plan. Show the person the draft and where it would be delivered (step 8), and ask them to confirm or correct it.

**Done when:** the person has confirmed the draft, as written or after the corrections they asked for.

### 8. Deliver

```bash
node "<skill>/adapter.mjs" delivery --label <label> --label <label> …
```

Pass each of the subject issue's labels. It prints `to`, and the rule that chose it:

- **`working-copy`:** the file from step 7 is the plan. Give the person its path to hand on.
- **`tracker-issue`:** one issue per subject. Find the one already there before creating one, in this order, and accept a candidate only when its body's first line starts with `<!-- qa-plan format=1 subject=#<n> `:
  1. the issue named in the pull request's link comment (the comment whose body starts with `<!-- qa-plan-link -->`);
  2. with a rule `label`, each issue carrying it: `gh issue list --state all --label <label> --limit 200 --json number,body`;
  3. otherwise a search, `gh issue list --state all --search "qa-plan subject=#<n> in:body" --json number,body`, which can lag behind an issue created minutes ago.

  Edit the issue found (`gh issue edit <m> --body-file <plan>`). Create one only when none is found (`gh issue create --title "QA Plan: #<n> <title>" --body-file <plan>`, with `--label <label>` when the rule names one), then post the link comment on the pull request: `<!-- qa-plan-link -->` on its first line, then `QA Plan: #<m>`.

- **`pr-comment`:** one comment on the pull request. Find the comment whose body starts with the plan's marker and edit it; post a new one only when there is none.

A revision of the plan replaces the delivered one; it never adds a second. With `tracker: none`, the plan stays in the working copy whatever the rules say.

**Done when:** the plan is at the target the rules chose, the person has its path or URL, and nothing was committed.
