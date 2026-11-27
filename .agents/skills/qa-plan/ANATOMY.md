# QA Plan anatomy

The format of a **QA Plan**: the file `qa-plan` writes and `manual-qa` runs. The two skills share nothing else, so this file is the contract between them. `qa-plan` owns it; `manual-qa` carries a byte-identical copy, and a contract test fails when the two differ. Change it here, copy it there, in the same change.

A plan must be runnable **from the plan alone**, by someone who has never seen the repository: a remote QA team, or an agent acting as a tester. Anything a run needs that is not in the plan is a defect in the plan.

## Shape

A plan is one Markdown file. Its first line is the marker, then the title, then these sections, as `##` headings with exactly these names, in this order:

1. `## Anchors`
2. `## What automation already proves`
3. `## Expected red herrings`
4. `## Run brief`
5. `## Setup`
6. `## Scenarios`
7. `## Sign-off checklist`
8. `## Stop and do not merge if`
9. `## Execution record`

No other `##` section. A section with nothing to say says so in one line (`None.`); it is never dropped.

```markdown
<!-- qa-plan format=4 subject=#118 pr=#130 -->

# QA Plan: <the subject issue's title>
```

The marker is how a revision finds the plan it replaces (on a tracker issue or a PR comment) and how `manual-qa` recognises a plan. `format` is this file's version; `subject` and `pr` are the anchors below.

The composer writes `format=4`. This copy reads `format=1`, `format=2`, `format=3` and `format=4`, and refuses any other `format`, so a stale copy stops on a newer plan rather than ignoring a field it does not know. A `format=1` plan carries no per-scenario field: a scenario's [**Surface:**](#scenarios) and **Observes:** are `format=2` or later. A `format=2` plan carries no **Capture:** or **Expected before:**: they are `format=3` or later. A `format=3` plan carries no **Story:**: it is `format=4` or later. The plan check refuses a field in a plan whose format is older than the field, naming the field and the format it needs.

### First-word values

Some labels take a word from a fixed set: **Target:**, **Surface:** (the Run brief's, and a scenario's), **Capture:** and **Signs in as:**, and each id in **Sessions:**. For **Signs in as:** and a session's id, the set is the Run brief's roles, `nobody`, and each [Scenario account](#scenario-accounts) an earlier scenario creates. For these, the value is the first word after the label, read like this:

1. Backticks are dropped.
2. The word ends at the first space, comma, semicolon, colon or parenthesis. Anything after it is prose.
3. `*` and `_` at either end of the word are dropped, so `` `web` ``, `**web**` and `web` are the same word. Inside the word they stay: `team_admin` is read as `team_admin`.
4. Nothing else is stripped. A period or other mark stuck to the word stays part of it.

So `` - **Surface:** `web` `` and `- **Surface:** web, in Chrome` read as `web`. ``- **Surface:** `web`.`` reads as `web.` and fails the check. Put the word first, with nothing stuck to it.

## Anchors

The four facts that pin the plan to one build of one change. A bullet each, with these labels:

- **Subject issue:** `#<n>`, its title, and its child issues (`#<n>`, `#<n>`) or `none`.
- **Pull request:** `#<n>` and its URL.
- **Merge-base:** the full SHA of the commit where the branch leaves its base ref, and the ref (`origin/main`).
- **Head:** the full SHA of the pull request's head commit the plan was composed against.

A plan is about one head. When the head moves, the plan is stale: compose it again.

## What automation already proves

What the passing CI run on the head establishes, so the reader knows what not to spend time on. One bullet per claim: what is proved, by which suite or check, and its tag.

- `[observed]`: seen test by test, from JUnit results of a run made at both the merge-base and the head (passes at both, new or unskipped and passing, fixed at the head, or failing at both as a red herring).
- `[reconstructed]`: compared only by a suite's exit code, or read from CI results, the diff or the issue history.

A failure at the head that could not be told from a red herring (the merge-base did not build) is settled with the person before the plan is composed; a plan never carries one undecided.

Every claim carries exactly one tag. A claim with no tag is not a claim.

## Expected red herrings

Failures the tester will see that are not caused by this change, so they are not reported as regressions: a test that also fails at the merge-base, a known flaky check, a warning the base already prints. One bullet each, with how to recognise it and its tag. `None.` when there are none.

## Run brief

Everything a run needs to start, from the plan alone. A bullet each, with these labels:

- **Target:** `stack` (a local QA Stack the tester starts) or `url` (a hosted test environment someone else deployed). For `url`, also the expected test-environment label in its hostname (`staging`, `qa`, `preview`, …), never a full production-looking address. `stack` or `url` is a [first-word value](#first-word-values).
- **Surface:** exactly one of `web`, `desktop`, `mobile` or `api`, as a [first-word value](#first-word-values). It is the plan's default: the surface most scenarios drive. In a `format=2` or later plan, a scenario's own **Surface:** overrides it for that scenario ([Scenarios](#scenarios)).
- **Build:** the head SHA, and the version endpoint (`/version`) when the app has one, so the tester can check they are testing the build this plan is about.
- **Roles:** each role the scenarios sign in as, by id and purpose (`admin`: manages members). At most a role's email beside it; never a password or token.
- **Credentials:** where the role values come from. With the repository: the config's `accounts.print` command. Without it: ask the developer, and paste them into chat, never into the plan.
- **Capture rules:** the _Capture rules_ of every matching Hazard pack, inlined under the pack's path, so the tester obeys them without opening the pack. `None.` when no pack matched.

### No credentials travel with a plan

Not even a public QA Account's values, which are fixtures anyone with the repository can print. A plan is copied into trackers, chats and other teams' tools, so its text is public. It carries **role ids, at most their emails, and where the values come from**, and nothing a sign-in form would accept as a secret: no password, token, API key, session cookie, one-time code or recovery code. `manual-qa` refuses a plan that carries one.

## Setup

What the tester does once before the first scenario, in order: data to put in place, flags to set, the account state to restore (`accounts.restore` for a role, when a scenario changes it). Steps only; the Run brief already says how to reach the build.

Each line is a product action, never a shell command or a code block: `manual-qa` runs no command from a plan, so the plan check reports a fenced code block here, and a line or backticked span that starts with a `$ ` prompt, or with a command word and an argument (`docker`, `docker-compose`, `kubectl`, `redis-cli`, `psql`, `mysql`, `python`, `python3`, `node`, `npm`, `npx`, `curl`, `wget`, `env`, `export`, `bash`, `sh`). `export`, `node`, `env`, `python` and `sh` also name things in a product, so they count only before a flag (`-c`), a path that starts with `/`, `./`, `../` or `~/`, a script file (`.py`, `.js`, `.mjs`, `.cjs`, `.ts`, `.sh`), or one of `=`, `|`, `$`, `;`, `&`, `<`, `>`: `` `export FOO=1` `` is a command, `` `export` ``, `` `export started` ``, `` `export to CSV/PDF` `` and `` `node v20.x` `` are copy. Give data to type or paste as prose, in a backticked span, not in a code block. A promise that only a command can observe (a setting, a cache entry, internal state) is either observable through the product surface, or it is not Residue.

## Scenarios

The **Residue**: only what a passing CI run does not establish. One `###` heading per scenario, numbered from `S1` with no gaps: `### S1: <what is verified>`. Each carries these labels, in this order:

- **Why only a human can prove it:** why no configured suite could reach the promise, not only that none covers it: what it needs that no test reaches (a real deployment, real infrastructure no suite starts, a real browser), beside what _What automation already proves_ leaves out.
- **Signs in as:** a [first-word value](#first-word-values): a role id the Run brief's **Roles:** names, or `nobody` (signed out), or the id of a [Scenario account](#scenario-accounts) an earlier scenario creates. Prose may follow the word. Write `` `admin`, after S1 creates the new user ``, not `the new user from S1, then admin` (first word `the`), and not `` `manager`. `` (first word `manager.`).
- **Sessions:** in place of **Signs in as:**, only in a scenario that needs two or more people signed in at once: `A = <id>, B = <id>`, one per [Session](#sessions). A scenario carries **Signs in as:** or **Sessions:**, never both and never neither.
- **Creates:** only in a scenario that creates an account during the run, so a later scenario can sign in as it. The id of each [Scenario account](#scenario-accounts) it creates, then prose.
- **Surface:** when this scenario drives another surface than the Run brief's **Surface:** (one that repeats the Run brief's is accepted and changes nothing), chosen from what its expected result must observe: a response header, a cookie's attributes (`HttpOnly`), a status code or a response body is seen on `api`; rendered copy, a flow or a layout on `web`; the app itself on `desktop` or `mobile`. One of `web`, `desktop`, `mobile` or `api`, as a [first-word value](#first-word-values), right after the scenario's sign-in field (Signs in as or Sessions, then Creates when present) and before its steps, once at most. It overrides the Run brief's for this scenario only; a scenario without one drives the Run brief's. `format=2` or later.
- **Service:** only on a scenario for a hosted (`url`) target that tests a named service of its own, such as `billing`, in place of its surface's address. A service name: letters, digits, `_` and `-`, as a [first-word value](#first-word-values). Right after the scenario's **Surface:**, or after its sign-in field (Signs in as or Sessions, then Creates when present) when it has none, and before its steps, once at most. A scenario without one uses the run's entry for its surface. The name is the `name` of an entry in the config's `run.hosts` list or in the hosts the run confirmed; the plan check reads only its shape, and `manual-qa` leaves the scenario for a person when the run has no such service. The plan never holds an address: a URL in a plan is not confirmation. `format=2` or later.
- **Observes:** only when the expected result needs something not every driver of its surface can see: in practice a response header, an `HttpOnly` cookie or a local file. One or more of `headers`, `cookies`, `httponly-cookies`, `status`, `body`, `screen`, `local-file`, read as **Creates:**'s ids are ([Scenario accounts](#scenario-accounts)): joined by commas, and any other space, a semicolon, a colon or a parenthesis ends the list, the rest prose. The plan check refuses any other value, naming it. Right after the scenario's **Surface:**, or after its sign-in field (Signs in as or Sessions, then Creates when present) when it has none, and before its steps, once at most. `manual-qa` leaves the scenario for a person when no one driver here observes all of them. Whether a driver can see a value is checked at run time, against what that run has, not by the plan check: a value no driver of the scenario's surface sees still passes the check, unless no single Surface's drivers can observe all of them (`status` and `screen`, say), which the plan check refuses and says to split into one scenario per Surface. `format=2` or later.
- **Capture:** what evidence the run keeps for this scenario, as a [first-word value](#first-word-values): `screenshot`, `video`, `transcript` or `none`. Prose may follow the word. `transcript` is for a scenario whose surface (its own **Surface:**, else the Run brief's) is `api`; `screenshot` and `video` are for one with a screen, never `api`; `none` is for any. Missing, it means `screenshot` on a screen surface and `transcript` on `api`. Right after the scenario's **Observes:**, or wherever **Observes:** would sit when it has none (after **Surface:**, else after the sign-in field), and before its steps, once at most. The plan check refuses any other value, or one the scenario's surface does not take, naming it. `format=3` or later.
- **Story:** the scenario's story, as a numbered list with one sentence per [Scene](#scenes-and-cuts), in order: the sentence that opens each Scene of its video on a Title card, and heads that Scene's steps in its Storyboard. In the product's own words, under the same public-text rules as **Expected result:**, and read as plain text: the plan reader strips paired inline Markdown, so `**Members**` shows as Members. A single-session scenario is one Scene, so its Story is one sentence. In a multi-session scenario, each step whose `In session <name>,` differs from the previous step's is a Cut and starts a new Scene. A Scene that opens a Session signed in as a [Scenario account](#scenario-accounts) says the person is already signed in, since that sign-in is never on camera. Right after the scenario's **Capture:**, or wherever **Capture:** would sit when it has none, and before its steps, once at most. The plan check refuses a Story whose sentence count differs from the Scenes its steps make, naming the scenario and both counts, and a `Capture: video` scenario without one. `format=4` or later: a `format=3` or older plan's `Capture: video` scenario carries no Story, and still reads.
- **Steps:** a numbered list. Each step quotes the real label, button text or copy from the source (`Click **Save changes**`), never an imagined one. A step is a product action, never a shell command, and the plan check reports one as it does in [Setup](#setup): a promise that only a command can observe is either observable through the product surface, or it is not Residue.
- **Expected result:** what the tester sees when it works, in the product's own words. Write it as a comparison between product outputs, or a value the product itself shows during the run; never a number or default read from source or a config file, since the stack the plan runs on may set it differently. For example: the session lifetime on **Settings** equals the one on **Profile**, not: the session lifetime is `144000` minutes.
- **Expected before:** only in a [fix scenario](#fix-scenarios): what the tester sees at the merge-base, where the change is not yet made. In the product's own words, under the same rules as **Expected result:**. Right after **Expected result:**, once at most. `format=3` or later.
- **A failure means:** what is broken if the expected result does not appear, so a failure is reported as a finding and not a symptom.
- **If this fails, first rule out:** only in a scenario a Hazard pack matches. The pack's _Rule out first_ list, copied in under the pack's path.

A plan with no scenarios and no `Review:` box ([Sign-off checklist](#sign-off-checklist)) is not written: an empty Residue means merge without a plan. A plan whose Residue is only review boxes is still a plan: its Scenarios section says `None.`, and its run has no scenario to drive and starts no stack.

### Fix scenarios

A **fix scenario** proves that a defect is fixed. It is the scenario that carries **Expected before:**, the defect as the merge-base shows it; there is no other fix-or-feature mark. A scenario without one runs at the head only. On a `stack` target, `manual-qa` runs each fix scenario at the merge-base first (its Before), on the same QA Stack, then at the head; a `url` target runs it at the head only. The QA Report grades each scenario with one of five results: **PASS**, **FAIL: regression**, **FAIL: pre-existing** (only a scenario without **Expected before:**, with merge-base evidence), **Not proven** (a fix scenario whose Before already showed **Expected result:**) or **left for a person**.

Write **Expected before:** from the issue's reproduction, or from what the merge-base does, never invented. Like **Expected result:**, it is a product output the tester sees, not a value read from source.

```markdown
### S1: An invite to an address already invited is refused

- **Why only a human can prove it:** …
- **Signs in as:** `admin`
- **Capture:** `screenshot`, of the dialog after **Send invite**
- **Steps:** …
- **Expected result:** the dialog shows **Already invited**, and the list shows the address once.
- **Expected before:** the dialog closes, and the list shows the address twice.
- **A failure means:** a second invitation is saved for the same address.
```

### Scenario accounts

A **Scenario account** is an account a scenario creates during the run, such as a user an `admin` adds with a temporary password. Its values are chosen when it is created, so no seeder knows them, and a later scenario that signs in as it depends on the scenario that made it.

- **Creates:** names each one by an id: letters, digits, `_` and `-`, as a role id is. The ids are [first-word values](#first-word-values) joined by commas; a comma, with any spaces around it, joins the next id. Any other space, a semicolon, a colon or a parenthesis ends the list, and the rest is prose. Put prose after a parenthesis or colon, not a comma: in `temp-user, chosen in S1`, `chosen` is read as a second id. A comma with no id after it (`temp-user,, other-user`) is refused.
- Each id is created by one scenario only, and is neither a Run brief role nor `nobody`.
- A later scenario names it as the first word of **Signs in as:**: `` `temp-user` (created in S1) ``, or as a session's id in **Sessions:**. Only a scenario after its creator may; a scenario never signs in as an account it creates itself.
- The plan carries the id and where the values come from (_chosen when S1 creates it_), never the values. [No credentials travel with a plan](#no-credentials-travel-with-a-plan) holds for them as for a role's.

```markdown
### S1: An admin adds a user with a temporary password

- **Why only a human can prove it:** …
- **Signs in as:** `admin`
- **Creates:** `temp-user` (its values chosen when S1 creates it)
- **Steps:** …

### S2: The new user must change the temporary password

- **Why only a human can prove it:** …
- **Signs in as:** `temp-user` (created in S1)
- **Steps:** …
```

`manual-qa` leaves S2 for a person when S1 does not pass. Only **Signs in as:** and **Sessions:** make one scenario depend on another: an account named in Steps is prose.

### Sessions

A **Session** is one signed-in identity, with cookies and storage no other session shares. A scenario with **Signs in as:** has one. A scenario where two people act at once, such as an `admin` changing the password of a `user` who is signed in elsewhere, has two or more, named in **Sessions:** in place of **Signs in as:**. Do not fold the second person into the steps' prose.

- Each session is `<name> = <id>`, joined by commas, with any spaces around each comma and each `=`. The name is a single capital letter (`A`, `B`, …), used once in the scenario. Two or more sessions; a scenario with one uses **Signs in as:**.
- Each id is a [first-word value](#first-word-values), as **Signs in as:**'s is: a Run brief role, `nobody`, or a [Scenario account](#scenario-accounts) an earlier scenario creates. Two sessions may share an id.
- After an id, any other space, a semicolon, a colon or a parenthesis ends the list, and the rest is prose: ``A = user, B = `admin` (each in its own browser)``.
- Every numbered step starts `In session <name>,` (or `In <name>,`), naming a declared session. The steps run one at a time, in order. A step's own nested list is prose.
- Every session signs in at the one address the run checked. Tabs in one browser profile share cookies, so they are not separate sessions; `manual-qa` leaves the scenario for a person when it has no driver that keeps each session apart.

#### Scenes and Cuts

A multi-session scenario's steps tell one story across its Sessions, and its video follows them in order. A run of consecutive steps in one Session is a **Scene**. A step whose Session is not the previous step's is a **Cut**: the story moves to that Session there, and a new Scene starts. A single-session scenario is one Scene. The scenario's **Story:** carries one sentence per Scene, in order ([Scenarios](#scenarios)).

- **At each Cut, show the new Session's on-screen result before the story moves on.** A Scene ends on what its person sees, never on a click: the admin's confirming screen after the action, the page the user lands on after a reload. Give that result a step of its own, so the Storyboard gives it a row. This is the plan author's judgement; no check reads it.
- **A Scene that opens a Session signed in as a [Scenario account](#scenario-accounts)** has a sentence that says the person is already signed in. A Scenario account's values never go into the evidence, so its sign-in is never on camera, and its Scene opens after it. A role's sign-in plays on camera before the first step, so its sentence may say the person signs in, as S3's first does; the sign-in is never a step of its own.
- **An `api`-shaped promise whose product has a screen gets a sibling.** When a promise reads as an `api` one (a status code, a response body) and a person also meets it on a screen, such as a revoked session the user sees as the sign-in page, keep the `api` scenario and add a sibling `Surface: web`, `Capture: video` multi-session scenario that tells the story on screen. The sibling earns its Residue place only by what the screen shows (the page the user lands on, the copy the admin reads), never by the status code or body the `api` scenario already proves.

Here an admin ends a user's session. The story has four beats: the user is signed in, the admin's confirming screen, the user reloads, and the user lands on the sign-in page. It makes three Scenes (A, B, A), so the Story has three sentences:

```markdown
### S3: An admin's password reset ends the user's session

- **Why only a human can prove it:** …
- **Sessions:** A = `user`, B = `admin`
- **Capture:** `video`
- **Story:**
  1. The user signs in and opens their profile.
  2. The admin signs in, sets a new password for the user, and sees it saved.
  3. The user reloads their profile and lands on the sign-in page.
- **Steps:**
  1. In session A, open **Profile**.
  2. In session B, open **Users**, pick the user, click **Set password**, and see **Password updated**.
  3. In session A, reload **Profile**.
  4. In session A, see the page it lands on.
- **Expected result:** session A shows **Sign in to continue**; session B shows **Password updated**.
- …
```

## Sign-off checklist

One unticked box per scenario (`- [ ] S1: <what is verified>`), plus one per Setup step a person must confirm, plus one `Review:` box per promise only reading can check. Ticked by whoever runs the plan, except a `Review:` box, which the person who reads it ticks.

A promise only reading can check (the copy of a doc, a static file the app does not serve, a code comment) has no surface to drive, so it is not a scenario. It is a box: `- [ ] Review: <what to read, and what it must say>`, such as `- [ ] Review: docs/x.html says the token lasts 30 days`. The text after `Review:` is required, and `Review:` is written exactly, with a space after it: the plan check reports a box that reads as one but is not (`review:`, `**Review:**`, `Review:docs`), since as an ordinary box it would reach no one.

A box also says **where** a person checks it, its Place, drawn from the config's `report.places` (`local`, `staging` and `production` by default; ADR 0033): `- [ ] Review: [<place>] <what to read, and what it must say>`, such as `- [ ] Review: [local] docs/x.html says the token lasts 30 days`. The Place is one lowercase word in brackets right after `Review:`, and the plan check refuses a box whose Place is not in the list. A box with no Place, from a plan made before Places, is read as the first Place that holds a merge; `qa-plan` always writes one. A Place that holds a merge (`local` by default) counts as left for a person in the posted QA Report; the others are deferred and never hold. With Places turned off, the box carries no Place.

- A `Review:` box is no scenario's box: each scenario still needs its own.
- `manual-qa` runs nothing for one. It is never a Results row or a PASS: the QA Report's **Follow-ups** lists each open one for a person.
- No check reads the text it names: the box is the whole of it.

## Stop and do not merge if

The outcomes that block the merge whatever else passes: a regression against the merge-base, data loss, a role reaching what it must not, a failed scenario the plan marks blocking. One bullet each.

## Execution record

Empty after compose: exactly the line `_Not run yet._`. Whoever runs the plan replaces it with one row per scenario (scenario, result, evidence, notes), the build they ran against, and when. A result is one of the five under [Fix scenarios](#fix-scenarios). `manual-qa` writes the full QA Report beside it; this section is the short record that stays with the plan.
