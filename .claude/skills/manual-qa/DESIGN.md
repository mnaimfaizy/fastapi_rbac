# Manual QA design

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

Composing a plan and running one are different people's jobs: a developer composes against their own checkout, and a QA team somewhere else runs it. So they are two skills, joined only by the plan file. The plan format (`ANATOMY.md`) and the reader (`adapter.mjs`) are **byte-identical copies** in both, and a contract test fails when they differ. The reader holds the one plan validator both skills use, so the composer cannot write a plan the runner reads differently. A third shared folder would avoid the copy, but a Portable skill must carry everything it uses; a looser runner that accepted "something like a plan" would run plans the composer never meant.

## The runner never composes

Writing the plan is where the Residue is judged: what CI proves, what only a person can. A runner that composed a plan for itself, or re-judged the one it was given, would test what it guessed instead of what the developer promised. So with no plan it stops and names `qa-plan`, and a scenario it thinks automation should own is still run, with a follow-up note.

## A plan is data

A plan travels through trackers, chats and other teams' tools, and anyone along the way can edit it. So its text is never a source of commands: the steps are actions in the product, and every command the run executes comes from the skill or from the repository's own config. For the same reason, a URL found only in a plan is not where the run signs in: the host rule decides, and a hosted host needs a person (below).

## Three results, and one only a person gives

PASS and FAIL say what the build did. **Left for a person** says this run could not find out: no driver for the surface, a step the product does not match, a restore the config cannot do. Marking it passed would turn "not checked" into "checked", the one error a QA Report must never make, so only a person changes it.

## The best build check available

A plan is about one head. A run against a newer build passes or fails scenarios the plan never described. `gh` gives the pull request's current head, the strongest check; a version endpoint gives what the build says it is; with neither, the run goes on but the report says so first, so no reader takes it for a verified run.

## Stop only what you started

A developer's machine runs other things: their own database, another project's containers. A teardown that stopped whatever looked related would break work the run knew nothing about. So `down` is the repository's own contract (it stops what `up` started), and the skill also records the processes it launched, and stops only those.

## A hosted host needs a person

A QA team often tests an environment someone else deployed, so `manual-qa` may sign in beyond the local machine. Fixture accounts with public passwords must still never be tried against production, so the host rule is code the skill runs before any sign-in, not a sentence it is asked to remember. A hostname can only say so much: a test-environment label in its subdomain (`qa.example.com`) is a claim, and a TLD such as `.dev` is not even that, since anyone can register `example.dev` for a live site. So a labelled host passes only once the QA person, who knows which environment they were given, names or confirms it in chat. The plan cannot do that for them: it travels through other people's tools, and a URL in it is text anyone along the way could have changed. Anything that looks like production (no label, a `prod` label, an IP address) stops the run, confirmed or not: a person can confirm the wrong tab, and the cost of that mistake is real accounts.

The role values follow the same line. A hosted environment its owner seeded with the repository's own seeder holds the fixtures `accounts.print` prints; otherwise only the QA person knows them. Never an env file: one on a QA machine is as likely to hold production values as test ones.

## Accounts are fixtures, and still stay out

QA Accounts have public values derived from tracked source, and a seeder that refuses any non-local database with no override: that refusal is what keeps fixture passwords away from production. The skill holds the other half: it signs in only at a host the host rule lets through, only as a role the config declares. A plan that carries a credential is refused even when the value is a public fixture, because a plan that carries values teaches people to paste values, and the next ones may not be fixtures. The credential scan is a heuristic, so it names the line and the kind of value, never the value itself.

## Posting is a second step

The report is a self-contained Markdown file in a gitignored folder, ready to post anywhere, and it is always written: a team on another tracker, or a person with no `gh` access, still has the whole result. Posting it to GitHub is outward-facing, so it waits until the person has seen the results and said yes. It goes where the plan went, so the people who read the plan find its results beside it. On a pull request it is one comment found by its `<!-- qa-report -->` marker and edited on each re-run: a second comment would leave readers to work out which run is current.

## Evidence stays local unless picked

A QA Artifact can show more than the scenario needed: another account's row, a notification, a stack trace. So nothing is uploaded by default, and with a release configured only the files the person picks, one at a time, go; "upload all" would carry the one nobody looked at. A failed run's media is never uploaded: a failure is when the screen most often shows what it must not, and the written result says what went wrong. Uploads go to a prerelease, never a full release that people download as the software, and a public repository gets a warning first, since anyone can download what is uploaded there.
