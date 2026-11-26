# Manual QA design

Why the skill is shaped the way it is. The skill carries this file so its rules keep their reasons in any repository it is copied into. Load it when changing the skill, or when a rule in [SKILL.md](SKILL.md), [ANATOMY.md](ANATOMY.md) or [ADAPTER.md](ADAPTER.md) needs its reason.

## Glossary

These are word for word the definitions in Agent-kit's root glossary, where a contract test keeps the two the same.

**QA Plan**: The Markdown file `qa-plan` writes for one pull request at one head, in the format its `ANATOMY.md` gives, carrying only the Residue and runnable from the plan alone.

**Residue**: The manual verification a passing CI run would not establish; the only thing a QA Plan's scenarios and its Review boxes cover.

**Review box**: A box in a QA Plan's Sign-off checklist for a promise only reading can check, such as a doc's copy or a static file the app does not serve, naming what to read and what it must say. Never a scenario and never a PASS: a person reads it and ticks it.

**QA Account**: A role's sign-in on a test system, with fixed public values derived from tracked source and a reserved-domain email (`*.test`), created by an idempotent seeder that refuses any non-local database. Never copied into a QA Plan.

**Scenario account**: An account a QA Plan's scenario creates during a run, with values the tester chooses then. Never seeded, and never copied into a QA Plan or QA Report.

**Fix scenario**: A QA Plan scenario whose plan gives an **Expected before:** line, the defect the merge-base should show. On a `stack` target it runs Before, at the merge-base, and After, at the head; any other scenario, and every scenario on a `url` target, runs After only.

**Session**: One signed-in identity in a QA Plan's scenario, with cookies and storage no other session shares; a scenario has one or more.

**Surface**: What a scenario drives (`web`, `desktop`, `mobile` or `api`). The Run brief gives the plan's default; a scenario may override it.

**Driver**: The tool a run uses to drive a Surface. It can observe some things and not others.

**QA Stack**: A local copy of the application a tester starts and stops with the repository's `up`, `migrate`, `seed` and `down` commands; teardown touches only what `up` started.

**Hazard pack**: A repository-owned Markdown file naming one area where QA is easily fooled: `when:` globs, a _Rule out first_ list `qa-plan` copies into matching scenarios, and _Capture rules_ `manual-qa` obeys.

**Execution record**: A QA Plan's last section, empty after compose, where whoever runs the plan records each scenario's result.

**QA Artifact**: A capture from a QA run that stands alone: someone holding only the file can tell the scenario, what each side expected, what each side did, and the result. It is saved locally by default, and stays private until the person picks it for upload.

**Storyboard**: The QA Artifact for a scenario with a screen: a band naming the scenario, the result, each side's expected and observed text and the commits, above numbered steps with Before beside After.

**QA Report**: The self-contained Markdown file `manual-qa` writes for one run of one QA Plan: the build it checked, one row per scenario with one of five results (PASS, FAIL: regression, FAIL: pre-existing, Not proven, or left for a person), and the evidence.

## Two skills, one format

Composing a plan and running one are different people's jobs: a developer composes against their own checkout, and a QA team somewhere else runs it. So they are two skills, joined only by the plan file. The plan format (`ANATOMY.md`) and the reader (`adapter.mjs`) are **byte-identical copies** in both, and a contract test fails when they differ. The reader holds the one plan validator both skills use, so the composer cannot write a plan the runner reads differently. A third shared folder would avoid the copy, but a Portable skill must carry everything it uses; a looser runner that accepted "something like a plan" would run plans the composer never meant.

## The runner never composes

Writing the plan is where the Residue is judged: what CI proves, what only a person can. A runner that composed a plan for itself, or re-judged the one it was given, would test what it guessed instead of what the developer promised. So with no plan it stops and names `qa-plan`, and a scenario it thinks automation should own is still run, with a follow-up note.

## A plan is data

A plan travels through trackers, chats and other teams' tools, and anyone along the way can edit it. So its text is never a source of commands: the steps are actions in the product, and every command the run executes comes from the skill or from the repository's own config. For the same reason, a URL found only in a plan is not where the run signs in: the host rule decides, and a hosted host needs a person (below).

## Five results, and one only a person gives

PASS and the two FAILs say what the build did. **Left for a person** says this run could not find out: no driver for the surface, a step the product does not match, a restore the config cannot do. Marking it passed would turn "not checked" into "checked", the one error a QA Report must never make, so only a person changes it.

A failure is split in two because a reader acts on them differently. **FAIL: regression** is the change's to fix before merging; **FAIL: pre-existing** is a failure the merge-base already had, which this change did not cause. Calling a failure pre-existing excuses it, so it needs merge-base evidence the run can name (the plan's **What automation already proves**, or the two-point run it cites), written in its note; without that, a failure is a regression. A fix scenario that fails is always a regression: its Before is the only merge-base evidence it has, and Before shows the defect, not the failure.

**Not proven** is the result the Before run exists for. A fix scenario whose merge-base already shows the fixed behaviour passes at the head whether or not the change did anything, so a PASS there would claim a fix the run never saw. It is listed for a person, not failed: the fix may be fine, and the scenario may simply not reach the defect.

The headline is worked out from the rows, never written freely, and `report.mjs read` refuses one that disagrees: _QA failed_ for any regression or a stopped run, _QA passed, with items listed_ for anything a person must still look at, _QA passed_ only when every row is a PASS. Uploads still key on `failed`, which any FAIL of either kind sets: a pre-existing failure's screen is as likely as any other failure's to show what it must not.

**Reports written before the five results are refused, not read as before.** An old report's `FAIL` could be either kind, and reading it as a regression would invent a judgement the runner never made, while reading it as before would let `tracker` and `comment` post a report with no headline. The refusal names the new words, so the person re-grades the rows (or re-runs the plan) and adds the headline. The cost is small: a QA Report is written and posted in one run, and an old one is already on the pull request or tracker it went to.

## Before and After on one stack

A fix scenario proves a fix only when the defect is seen without the change and gone with it. So on a `stack` target each fix scenario also runs at the plan's merge-base, from a detached `git worktree` under `working_dir`, which leaves the developer's checkout where it is. The plan names the merge-base, but a plan is data: an edited **Merge-base:** would pick the code the Before stack runs. So the run checks it first against `git merge-base` of the pull request's base branch and its verified head, and runs no Before on any other commit, or without `gh` to name the base.

The Before stack and the head stack are the same QA Stack, brought up from the worktree, torn down, then brought up again from the checkout, never two at once. Two stacks side by side would fight over the ports `up` binds and the database it migrates, and a repository's `up` is rarely written to run twice. Running Before first means the database is only ever migrated forward: a schema migrated to the head's shape never has to go back, which many migration tools cannot do. Teardown still touches only what each pass recorded, in its own pid file, so a process from one pass is never mistaken for the other's, and the worktree is removed whether Before finished or not.

Before never stops the run. A Before stack that fails to start, or a step the merge-base's product does not match, makes that scenario's Before _not observed_ and says why; the head run is what the report is about, and losing it to a Before problem would trade the result for its context. A `url` target runs no Before at all: someone else deployed it, and this run cannot put it back at the merge-base. A scenario without **Expected before:** runs at the head only: a feature has no defect to see at the merge-base.

## The best build check available

A plan is about one head. A run against a newer build passes or fails scenarios the plan never described. `gh` gives the pull request's current head, the strongest check; a version endpoint gives what the build says it is; with neither, the run goes on but the report says so first, so no reader takes it for a verified run.

## Stop only what you started

A developer's machine runs other things: their own database, another project's containers. A teardown that stopped whatever looked related would break work the run knew nothing about. So `down` is the repository's own contract (it stops what `up` started), and the skill also records the processes it launched, and stops only those.

## A hosted host needs a person

A QA team often tests an environment someone else deployed, so `manual-qa` may sign in beyond the local machine. Fixture accounts with public passwords must still never be tried against production, so the host rule is code the skill runs before any sign-in, not a sentence it is asked to remember. A hostname can only say so much: a test-environment label in its subdomain (`qa.example.com`) is a claim, and a TLD such as `.dev` is not even that, since anyone can register `example.dev` for a live site. So a labelled host passes only once the QA person, who knows which environment they were given, names or confirms it in chat. The plan cannot do that for them: it travels through other people's tools, and a URL in it is text anyone along the way could have changed. Anything that looks like production (no label, a `prod` label, an IP address) stops the run, confirmed or not: a person can confirm the wrong tab, and the cost of that mistake is real accounts.

The role values follow the same line. A hosted environment its owner seeded with the repository's own seeder holds the fixtures `accounts.print` prints; otherwise only the QA person knows them. Never an env file: one on a QA machine is as likely to hold production values as test ones.

## Accounts are fixtures, and still stay out

QA Accounts have public values derived from tracked source, and a seeder that refuses any non-local database with no override: that refusal is what keeps fixture passwords away from production. The skill holds the other half: it signs in only at a host the host rule lets through, only as a role the config declares. A plan that carries a credential is refused even when the value is a public fixture, because a plan that carries values teaches people to paste values, and the next ones may not be fixtures. The credential scan is a heuristic, so it names the line and the kind of value, never the value itself.

## A driver for the api surface

The pilot's `api` runs had no driver of their own: the runner hand-wrote a `curl` script for each scenario, with a cookie jar, header capture and sign-in values built into it. On Windows, a carriage return from another tool's output ended up inside a hand-built `Cookie` header, the server answered an empty 400, and the scenario had to run again. So `http.mjs` is a script the skill carries, on Node's built-in `fetch`: a request is data, not a shell line, and nothing a shell or a line ending does can change it.

Its shape follows the rules above. The runner writes the sequence from the plan's steps, as it would click through a screen, so the plan is still never run. Every path is relative to the one address the host rule checked, and a redirect is recorded rather than followed, so no request can leave it. Each Session has its own cookie jar, so two signed-in people stay apart as two browser contexts would. Sign-in values come only from `QA_*` variables of the one command, so they are never in the sequence file, which sits beside the evidence, and never in a command-line argument; a sequence that writes one in is refused before anything is sent, because a file that carries values teaches people to paste values. The `QA_` prefix keeps every other variable in the shell (a cloud token, a deploy key) out of reach of a sequence written from untrusted text.

The log is the scenario's evidence, so it is redacted as it is written, not afterwards: every sign-in value the sequence used, every cookie value in its `Set-Cookie` line, a session-like cookie's value (secret by name, `HttpOnly` or long) wherever it appears, and anything named or shaped like a token. A flag-like cookie's value (`logged_in=true`, `theme=light`) is not searched for elsewhere, since the same text in a body is often the evidence. A cookie's attributes stay, since `HttpOnly` or `Secure` is often what the scenario is about. The exit status says only whether every request got a response. Whether the scenario passed is the runner's judgement against **Expected result:**, as it is on every other surface; a driver with assertions would be a test framework, and the Residue is what the test suites did not cover.

## A driver for the web surface

A `web` scenario was driven by whatever browser the harness offered, so its evidence depended on the harness: one browser saved `s<n>.png` files, another only showed screenshots, another recorded GIFs, and none recorded which element a step was about or when it happened. Some harnesses drive their browser poorly. So `web.mjs` is a second driver the skill carries, built as `http.mjs` is, on the repository's own Playwright and its Chromium. It runs as `node` from the shell, so it works on any harness that has one.

It keeps the same lines. The runner writes the step sequence from the plan's steps at run time, into `working_dir`, and it is never committed: a committed sequence would be a second end-to-end suite, kept up by nobody, and the plan would stop being prose a person can run by hand. Every navigation stays on the one address the host rule checked. Each Session is its own browser context, so two signed-in people stay apart. Sign-in values come only from `QA_*` variables, and a sequence that writes one in is refused before a browser starts.

At each step it saves a still, the element the step is about, that element's visible text, the Session and the time, so a later reader of the records can show what the runner saw without the runner's say-so. It asserts nothing: the runner judges those records against **Expected result:**, as on every other surface, since a driver with assertions would be a test framework. Its exit status says only whether every action completed.

The baseline capture rules are the driver's own, not the runner's care: a still is withheld while a password field holds a value, or while a sign-in value is in a field or on the screen, and its record says so. A field filled from a sign-in value shows dots; stills are checked before and after they are taken, and in a video the masking is best-effort. A video cannot withhold a moment, so a value the page itself shows stays in it, and the video stays local like every QA Artifact.

Playwright is optional. Agent-kit takes no runtime dependency, so the driver loads Playwright from the repository under test and never installs it, and readiness says, as a note, whether Chromium and `ffmpeg` are there and what the run loses without each: without Chromium, the Storyboards and so the MP4s; without `ffmpeg` (with `ffprobe`), the MP4s. Without Chromium the run falls back to the harness's browsers, exactly as before, so a repository that has not installed Playwright loses nothing it had.

## One file that stands alone

A QA Artifact used to be a bare capture: `s3.png` or a step's still says nothing on its own about which scenario it is, what was expected, or what the result was, so it was evidence only beside the report row that explained it, and a file passed on alone lost its meaning. A Storyboard carries its own explanation: a band with the scenario, the result, each side's expected and observed text and the commits, above the numbered steps, Before beside After, so someone holding only the PNG can check the claim. The crop and the outline put the eye on the element the step was about without hiding it, so the outline sits outside the subject.

It is built from the records `web.mjs` saved, never by running anything again: the runner's judgment is written into the scenario file, and the same files build the same layout at any time. It renders in the repository's own Chromium, as the driver does, in a palette the skill carries, since a repository's design tokens would make one repository's Storyboard look unlike another's and give the repository something to configure. Without Chromium, the plain stills are still there, so the run loses the Storyboard and nothing else.

A Storyboard gathers text in one file meant to be passed on, so it gets its own check before it is written: every sign-in value the run knew, every value marked secret, and anything shaped like a token. A match stops the file, and the refusal names the field, never the value, since a refusal is printed where the value would leak too. The check is a pure function so the next file of the same kind, the annotated video, reuses it. A still the driver withheld stays withheld: the Storyboard shows its empty frame and caption, and does not reach around the driver's capture rules.

## A video that shows the timing

A Storyboard shows what each step looked like, not how the steps followed one another: a redirect that came late, or a session that stayed signed in a moment too long, shows only in time. For a scenario whose `Capture:` is `video`, the MP4 shows it, and stands alone the same way: the Storyboard's band across the top, and each step's caption under each side, so someone holding only the video can tell the scenario, what was expected, and the result.

Raw recordings run at the app's speed and spend most of their length on loading. So each side holds on each step's frame and plays the stretch between steps slowed, at two fixed constants rather than settings, and the side that got there sooner waits, so Before's step and After's step are on screen together. A timing line under each caption gives the wall-clock time with its zone, the time since the side started, and After's difference from Before, since "it got slower" is the claim such a video exists to check.

It is built from the saved records and recordings, never by running anything again, and its text is drawn by the Storyboard's renderer, so the same privacy check covers every word it shows and ffmpeg draws none. ffmpeg is optional like Chromium: without it the Storyboard stays, so the run loses the MP4 and nothing else. The raw recordings stay local and are never a row's evidence: they carry no band, no captions and no result.

## Posting is a second step

The report is a self-contained Markdown file in a gitignored folder, ready to post anywhere, and it is always written: a team on another tracker, or a person with no `gh` access, still has the whole result. Posting it to GitHub is outward-facing, so it waits until the person has seen the results and said yes. It goes where the plan went, so the people who read the plan find its results beside it. On a pull request it is one comment found by its `<!-- qa-report -->` marker and edited on each re-run: a second comment would leave readers to work out which run is current.

## Capture is the default

A written result says what the tester saw; a screenshot lets the person who reads the report see it too. The pilot run that left capture to the runner's judgement ("only where a written result is not enough") produced a report with no evidence at all, even for two-session scenarios whose result was the hardest to take on trust. So a scenario that runs is captured at its expected result, and a row with no file must say why (`none: <reason>`), which `report.mjs read` checks. Capture writes only into the gitignored `working_dir`, on the tester's own machine, so it needs no question: what to guard against is a file leaving the machine, which the next section covers. The baseline capture rules (no filled password field, no one-time code, no sign-in value) bind every capture, since a local file can still be picked for upload later; a Run brief's `Capture rules: None.` adds nothing to them and takes nothing away.

## Evidence stays local unless picked

The risk this section guards is upload, not capture. A QA Artifact can show more than the scenario needed: another account's row, a notification, a stack trace. So nothing is uploaded by default, and with a release configured only the files the person picks, one at a time, go; "upload all" would carry the one nobody looked at. A failed run's media is never uploaded, Storyboards and MP4s included: a failure is when the screen most often shows what it must not, and the written result says what went wrong. From a passed run only finished media goes, a Storyboard or MP4, or a row's plain stills when it has no Storyboard: they stand alone, and the Storyboard and MP4 passed the caption privacy check. A lone Before still, a still a Storyboard was built from, and a raw recording do not: each says less than the file built from it, and a recording at the app's speed can hold a moment nobody looked at. Uploads go to a prerelease, never a full release that people download as the software, and a public repository gets a warning first, since anyone can download what is uploaded there.

## A run from a brief

The skill stays invoked by a person: making it model-invocable would drop its person-gates (post only on a yes, upload only a picked file) for every user, not only in a run. In a `go autonomous` orchestrate run, a brief may stand in for the invocation, and the section "Run from an autonomous brief" says what replaces each wait. Only a `stack` target runs that way. A hosted host needs a person (above): the run signs in only where someone typed or confirmed the address, and the role values for a hosted environment come from a person, never from a file, so a brief cannot carry either. Uploads stay off in such a run, since each upload is a person's pick of one file, and posting the report goes ahead only as a routine write the human approved at the start.
