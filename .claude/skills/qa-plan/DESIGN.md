# QA Plan design

Why the skill is shaped the way it is. The skill carries this file so its rules keep their reasons in any repository it is copied into. Load it when changing the skill, or when a rule in [SKILL.md](SKILL.md), [ANATOMY.md](ANATOMY.md) or [ADAPTER.md](ADAPTER.md) needs its reason.

## Glossary

These are word for word the definitions in Agent-kit's root glossary, where a contract test keeps the two the same.

**QA Plan**: The Markdown file `qa-plan` writes for one pull request at one head, in the format its `ANATOMY.md` gives, carrying only the Residue and runnable from the plan alone.

**Residue**: The manual verification a passing CI run would not establish; the only thing a QA Plan's scenarios cover.

**QA Account**: A role's sign-in on a test system, with fixed public values derived from tracked source and a reserved-domain email (`*.test`), created by an idempotent seeder that refuses any non-local database. Never copied into a QA Plan.

**QA Stack**: A local copy of the application a tester starts and stops with the repository's `up`, `migrate`, `seed` and `down` commands; teardown touches only what `up` started.

**Hazard pack**: A repository-owned Markdown file naming one area where QA is easily fooled: `when:` globs, a _Rule out first_ list `qa-plan` copies into matching scenarios, and _Capture rules_ `manual-qa` obeys.

**Execution record**: A QA Plan's last section, empty after compose, where whoever runs the plan records each scenario's result.

**QA Artifact**: A screenshot, recording or log captured during a QA run, only where a written result is not enough; private by default.

**QA Report**: The self-contained Markdown file `manual-qa` writes for one run of one QA Plan: the build it checked, one row per scenario (PASS, FAIL, or left for a person), and the evidence.

## Two skills, one format

Composing a plan and running one are different people's jobs here: a developer composes against their own checkout, and a QA team somewhere else runs it, perhaps with no repository at all. So they are two skills, `qa-plan` and `manual-qa`, joined only by the plan file.

The risk in splitting them is drift: the composer writes a section the runner no longer reads, or the runner insists on one the composer stopped writing. The plan format (`ANATOMY.md`) and the config reader (`adapter.mjs`) are therefore **byte-identical copies** in both skills, and a contract test fails when they differ. A third shared folder would avoid the copy, but a Portable skill must carry everything it uses, so a skill installed alone would break. A looser runner that parsed "something like a plan" would accept a plan the composer never meant, which is the drift the copy prevents.

## Residue only

A plan that re-tests what CI proves spends the tester's time on the parts least likely to be wrong and buries the scenarios that matter among them. So every scenario must say why only a human can prove it, and the plan says what automation already proves, so the reader can see what was left out and why.

**An empty Residue is a result**, not a failure to find work: the change is proved by automation, and the honest output is "merge without a plan".

## Observed and reconstructed

A claim that a suite proves a promise can come from two places. `[observed]`: a run of the suite at the merge-base and at the head, compared. `[reconstructed]`: reading CI results, the diff and the issue history, which can be wrong in ways a run is not (a test that passes but asserts nothing, a check that never ran on the path). The tag tells the reader how far to trust each claim.

`two-point.mjs` makes the observed claims. It runs each suite at both points, because one run at the head cannot tell a test this change broke from one that was already failing: the first is a regression and stops the plan, the second is a red herring the tester should be told to expect. The merge-base gets a detached worktree, so the person's checkout is never switched, and the worktree is removed even when a run fails, so a broken run leaves nothing for the next suite to collect. The head runs first for the same reason. A timeout, Ctrl-C, `SIGTERM` or a closed terminal stops the suite and every process it started before the worktree goes; only a hard kill of the runner itself (`SIGKILL`) can leave a suite running, and the next run removes what git still lists as a `two-point-*` worktree, never a file that only shares the name. JUnit XML is the only format it parses: almost every test runner can write it, and one parser that fails loudly beats several that guess.

When a run cannot be compared test by test, it says so instead of guessing. A suite with no JUnit is compared by exit code, and its claims are `[reconstructed]`. A merge-base that will not build tells nothing about a test failing at the head, so that failure is `unknown` and the person decides, rather than being filed as a red herring that might be a regression. Each suite's JUnit file is deleted before it runs, so a report from an earlier run is never read as this one's.

A green suite is not necessarily a proving suite: one that stays green when the guarded code is broken proves nothing. The optional perturbation check catches that before a promise is wrongly left out of the Residue.

## Read the UI, do not imagine it

A step that names a button the product does not have makes a correct build fail its plan, and a tester who adapts the step silently tests something else. So steps quote labels and copy from the source the pull request ships.

## Compose in a working copy

A plan is drafted in `working_dir`, which is gitignored, and shown to the person before it goes anywhere. Delivery is outward-facing: an issue or a comment others are notified of. Composing first means a wrong plan costs a redraft, not a retraction, and a plan is never committed to the repository it describes, where it would go stale with the next push.

## Delivery by rule, not by vocabulary

Where a plan goes depends on how the team works: some keep a tracker issue per feature, some comment on the pull request, some hand the file over. The config's `plan.publish` rules decide it (first match wins), so the skill carries no vocabulary for a team's process. Every target is **edited on revision, never duplicated**: one plan per subject, found again by its marker line.

## No credentials travel with a plan

A plan is copied into trackers, chats and other teams' tools, so its text is effectively public. Even a QA Account's values, which are public fixtures to anyone with the repository, stay out: a plan that carries values teaches people to paste values, and the next ones may not be fixtures. The plan says which roles it needs and where their values come from.

## The config reader

Both skills import only Node built-ins, and Node ships no YAML parser, so `adapter.mjs` reads JSON whole and YAML in a small documented subset. Anything outside the subset, any unknown key and any wrong shape is a **problem**, named with its line, never a silent default: a misread config composes against the wrong base or delivers to the wrong place, and nothing would say so. Missing values a step needs are asked for, not assumed, and written to the config only with consent, because the config is the repository's file, not the skill's.
