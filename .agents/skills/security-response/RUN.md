# The run folder

Where a Security Response Run keeps its state, so that `status` can print it and a later session can resume it. Load it before opening, updating or resuming a run.

A Security Response Run is one pass of the maintainer's response to every open draft security advisory, tracked in a private local board with one row per concept id, and closed by writing the findings ledger once every row and every advisory is final. `security-response` is the only skill that writes the run folder. `security-audit` and `security-finding-triage` produce output only, and never read or write it.

## Where the run folder lives

Each run lives in its own folder, `tmp/security-response/<run>/`, inside the repository. `<run>` is the date, `YYYY-MM-DD`, with `.2`, `.3` added when that folder is already there: `2026-11-07`, then `2026-11-07.2`. There is no config key, and no dependency on orchestrate or its config: the path is fixed, so the skill works in a repository that has only the security skills installed.

Before the first write of a run, check that the path is ignored, from the repository root: `git check-ignore -q tmp/security-response/`. When it is not ignored, offer to add `tmp/security-response/` to the root `.gitignore`, and write nothing without a yes. The folder holds advisory bodies and triage detail, so it must never be committable. With a yes, add the line and check again before writing.

When a run opens, warn the human once:

- `git clean -x` deletes the folder, and the run with it.
- A worktree cannot see it: the folder lives only in the checkout that opened the run. Run `security-response` from that checkout.

## Open, resume, or nothing to respond to

Every mode starts here, before it does its own work:

1. Look for the open run. A run is open until its board's header carries `Closed <date>`; a run that reads `Closing: ledger PR #n` is still open. The folder under `tmp/security-response/` whose board is open is the open run.
2. **An open run:** the mode resumes the open run. Opening while a run is open always resumes it, and never starts a second one. At most one run is open at a time. If more than one board is open, which should never happen, resume none and write nothing: name the folders and ask the human which one is current.
3. **No open run, and draft advisories exist:** the mode opens a run. List the drafts with `gh api --paginate "repos/<owner>/<repo>/security-advisories?state=draft"`. Pass the ignore gate above, make the folder (the next free `<run>` name), save each draft to `originals/<GHSA-id>.json`, give each finding its provisional concept id ([Concept ids](#concept-ids)) and each draft with no `F<n>` its no-findings line ([No-findings advisories](#no-findings-advisories)), and write the board and the first `activity.md` entry.
4. **No draft advisories and no open run:** report "nothing to respond to", and stop. The mode writes nothing: no folder, no board, no log.

When no run is open and the advisory list cannot be read (no access, no network), say so and write nothing. A run is never opened, or "nothing to respond to" reported, on a list the run could not read. An open run is still resumed, and reconcile shows its board with the advisory API not checked ([An unavailable source](#an-unavailable-source)).

A closed run is read-only, and stays on disk until the human deletes it. The next invocation after a close opens a new run.

## Reconcile

Reconcile is step one of every mode: after the run is opened or resumed, and before the mode does its own work, the run is checked against GitHub and git, so the board the human reads shows the sources as they are now, and a session days later picks up exactly where the last one stopped. The `reconcile` mode runs it alone. On every reconcile the header's `checked <time>` updates, and the board is rewritten whole with what changed.

### Sources

Each fact on the board is checked against the source that owns it:

| Board fact                   | Source                                                  | Check                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisory list, state, CVE id | advisory API                                            | `gh api --paginate "repos/<owner>/<repo>/security-advisories?state=draft"`, plus `gh api repos/<owner>/<repo>/security-advisories/<GHSA-id>` for each advisory on the board |
| `fix PR open`                | private fork, or the repository for a `below-floor` row | `gh pr list` and `gh pr view` on the advisory's private fork, until publish deletes it; on the repository for a `below-floor` row's public PR                               |
| `merged`                     | `origin/main`                                           | `git fetch`, then `git merge-base --is-ancestor <fix SHA> origin/main`                                                                                                      |
| `released`                   | tags                                                    | `git tag --contains <fix SHA>` lists the recorded tag                                                                                                                       |
| `fixed` (no code)            | the API, where it can                                   | the setting through `gh api` where there is an endpoint for it (a ruleset, say); otherwise the human's report stands                                                        |
| Concept ids already recorded | the findings ledger                                     | read only, to flag a concept id already there; the Caller's `findings_ledger_path`, otherwise `.security/findings-ledger.md`                                                |

### Who wins

When the board and a source disagree:

- **The source wins** for the facts it owns: advisory state, CVE id, fix PR state (on the fork, or on the repository for a `below-floor` row), the fix SHA on `main`, and the tag.
- **The board wins** for the facts only it holds: Evidence, fork PR numbers and fix SHAs after the fork is gone, a CVE request, and accepted-risk. A source that no longer shows them (publish deletes the fork, `cve_id` stays empty until a CVE is assigned) changes nothing.

### Moves

Verified moves happen on their own, with no human report:

- `fix PR open` → `merged`, once the fix PR is merged (the fork PR, or a `below-floor` row's public PR) and its fix SHA is an ancestor of `origin/main`. The fix SHA goes into the row's Record.
- `merged` → `released`, once a release tag contains the fix SHA. The tag goes into the row's Record.

A source may also take a row that is not final backward: a fix PR closed without merging takes its row back to `open`, and a `merged` row whose fix SHA is no longer on `origin/main` goes back to `open`, its Record keeping the SHA. An advisory's state and CVE id follow the advisory API.

Judgements never happen on their own: Evidence, Severity, accepted-risk, `fixed` with no check behind it, and approving a publish, a close or a CVE request come only from triage or the human. A human's report of a merge or a release only prompts the check above.

### An unavailable source

When a source cannot be reached (no advisory access, a draft advisory's private fork unreachable, no network for `git fetch`), the board is still shown. The header's `checked <time>` covers the sources the run did read, and the header adds `not checked: <source> unavailable` for each one it could not: `Default branch: main@<sha>, checked <time>; not checked: advisory API unavailable.` Reconcile moves no row on that source. A fork that publish has deleted is not unavailable: it is no longer a source, and the board keeps what it recorded. A row is never moved, and an advisory never dropped, on a source the run could not read.

### Final rows and advisories

Final rows and advisories are not checked again. A source the run reads for something else can still contradict one: a `published` advisory back in the draft list, or a `released` fix SHA no longer on `origin/main`. A contradicted final row stays final, and so does a contradicted final advisory: it goes to the top of Waiting on you, naming what the source now shows, and is logged in `activity.md`. Final values stay final for the run; the entry stays at the top of Waiting on you until the human acknowledges it with `record ack <concept-id|GHSA>` ([Ack](#ack)).

### Rows are never deleted

Reconcile never deletes a row. It only adds rows, and moves them as above:

- A new draft advisory joins the open run, unless the run is closing ([While closing](#while-closing)), and each of its findings gets a provisional concept id and an `untriaged` row, as on open ([Concept ids](#concept-ids)); a new draft with no `F<n>` gets its no-findings line ([No-findings advisories](#no-findings-advisories)). Its original is saved to `originals/<GHSA-id>.json`.
- A draft the human made for a row with advisory `none yet` is matched to that row by the concept id in its title or body. A draft with no concept id to match is raised in Waiting on you, for the human to confirm the match with `record match <GHSA> <concept-id>` ([Match](#match)).
- An advisory's findings are compared with `originals/<GHSA-id>.json`: a new `F<n>` with no row gets an `untriaged` row. A missing `F<n>` keeps its row, and is raised in Waiting on you, unless it is a folded row's finding the human removed from an advisory that is not its canonical one ([Publish](#publish)).
- A finding whose concept id is already in the findings ledger gets its row as [Concept ids](#concept-ids) says.

### The log

Each correction is logged in `activity.md` as `reconciled: <old> → <new>, checked <how>`, with the row or advisory it is about: `reconciled: fix PR open → merged, checked git merge-base --is-ancestor c2d0bd5 origin/main`. A new row, a contradicted final row and an unavailable source are logged too. One change is not logged: a reconcile that changes nothing but the header's `checked <time>` logs nothing.

## Layout

```text
tmp/security-response/<run>/
  board.md                  the board: the findings and advisories tables, with every transition record
  activity.md               append-only: each transition, with its time, who made it (agent or human), and what was verified
  triage/<concept-id>.md    the security-finding-triage output for one row, saved verbatim
  originals/<GHSA-id>.json  the advisory as first fetched
```

`activity.md` is append-only: an entry is never edited or removed. Each entry starts with the time and `agent` or `human`.

Each advisory is saved to `originals/<GHSA-id>.json` when the run first reads it, and always before any PATCH that rewrites it publicly. A saved original is never overwritten, so it shows what CI or the reporter first filed. Advisory originals live only here: an older copy kept elsewhere by a harness stays where it is as history, and is not moved.

A private-fork clone is not kept in the run folder. The advisory's row on the board records the clone's path, and the clone is removed after the advisory is published.

Nothing in the run folder is committed or sent anywhere: it holds advisory bodies and triage detail. The findings ledger, written when the run closes, is the run's only public projection.

The board is rewritten whole on each change, never edited in part: write the new board beside the old one, then rename it over the old one, so an interrupted write leaves the last whole board in place.

## Concept ids

A draft advisory filed by the audit numbers its findings `F<n>`, each under a `### F<n> — <short title>` heading. When the run opens, and when a new draft joins it, each `GHSA:F<n>` gets a provisional concept id from its title: the title in lowercase kebab-case, the way the findings ledger writes concept ids. Findings with the same id fold into one row, and that row's Advisory cell lists both advisories, short id and finding: `hg89 F2, xmp7 F1`. Findings with different ids stay separate rows, even when they look alike: triage decides whether one is a duplicate.

A folded row has one **canonical advisory**: the earliest created of its advisories, by the advisories table's Created date, then by GHSA id. It is the advisory that publishes the row, so one concept gets one public advisory. Under each of its other advisories, the folded row counts as a `duplicate` row ([Advisory actions](#advisory-actions)): that advisory is published only for its other rows, and an advisory with nothing else to publish is closed like a duplicate advisory, once its other rows are final and the canonical advisory is final. The findings ledger names the canonical advisory ([Row to line](#row-to-line)).

A provisional id may be renamed until triage. It is final at triage, and stable from then on: a later change of mind is a new concept id, never a rename.

A finding whose concept id is already in the findings ledger still gets its row, `untriaged`, with Record `in ledger: <status>`. The run reads the ledger only; it never edits it before close.

## No-findings advisories

A draft with zero parsed `F<n>` is a **no-findings advisory**: one line in the advisories table, with Rows `0` and its kind, and never a finding row, because it has no concept id. It is not left outside the run either, because then it would never be closed. The run counts each draft's `F<n>` when it opens and when a new draft joins it ([Concept ids](#concept-ids)).

A no-findings advisory stays one while no row is joined to it. Once a row is (`record match`, or reconcile matching a draft that names a concept id), it has finding rows and follows the rules for any advisory: its Rows cell counts them, and no longer names a kind. When a `format mismatch` turns out to hold real findings, the human files them in a new draft or edits this one, and reconcile adds a row for each new `F<n>` ([Rows are never deleted](#rows-are-never-deleted)).

### Kinds

| Kind              | Recognised by                                                                 | Advisories-table Next                    |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `clean run`       | CI title `[Security audit] <date> — clean run (0 Medium+ findings)`           | `you: clean run, read and approve close` |
| `format mismatch` | CI title `[Security audit] <date> — FORMAT MISMATCH (header=<n>, headings=0)` | `you: read; findings may be hidden`      |
| `failed run`      | CI title `[Security audit] <date> — failed run: empty report`                 | `you: read transcript, approve close`    |
| `other`           | anything else with no `F<n>`: a human-made draft, a probe                     | `you: match or close`                    |

The parsed `F<n>` count, with no row joined to the draft, decides whether a draft is a no-findings advisory; the title only names its kind. The run matches the title's text after the date (`clean run (0 Medium+ findings)`, `FORMAT MISMATCH`, `failed run: empty report`), as the audit workflow writes it. A draft whose title matches none of them is `other`. A `format mismatch` may hide findings: its report's header counts findings that no `F<n>` heading carries. A `failed run` holds only the session transcript. An `other` draft may be one the human made for a found-in-triage row: match it with `record match <GHSA> <concept-id>` ([Match](#match)), or close it.

### Waiting on you

No-findings advisories get one numbered item per kind, naming each draft by its full GHSA id: `Read and approve close 4 clean-run drafts: <GHSA-id>, <GHSA-id>, <GHSA-id>, <GHSA-id>`. The `format mismatch` item comes first, then `failed run`, then `other`, and the `clean run` item last: format mismatches and failed runs come before clean runs, so a draft that may hide findings is read before routine ones. These items sit below any contradicted-final entry, which stays at the top ([Final rows and advisories](#final-rows-and-advisories)). An `other` draft that reconcile raises for `record match` ([Rows are never deleted](#rows-are-never-deleted)) is named in the `other` item, not in a second one. The advisories table keeps one line per draft.

### Closing

`record approve close <GHSA…>` takes a list of GHSAs, each named: `record approve close <GHSA-id> <GHSA-id> <GHSA-id>`. There is no wildcard: no `clean`, no `all`, no pattern. The human names each draft, because the draft exists so that it gets read. Within the list, the run refuses any GHSA with non-final rows, and a duplicate whose canonical row is not final, or a folded row whose canonical advisory is not final: its canonical row's advisory must be final, as [Close](#close) says. A no-findings advisory has no rows, so it passes while it is `draft`.

Its only final state is `closed`. It is never published, and staying a draft is not final, so the run cannot close while one is still a draft. Closing it writes no findings-ledger line, because the ledger holds concept ids only; `activity.md` logs the close.

### A run of only no-findings drafts

A run whose drafts are all no-findings advisories opens like any other: drafts exist ([Open, resume, or nothing to respond to](#open-resume-or-nothing-to-respond-to)). Its board has zero rows, an empty findings table and only advisories lines. It can close once every one is `closed`, and writes no ledger line.

## Landing a triage outcome

`security-response triage <target>` runs the `security-finding-triage` skill on one row, then lands its outcome on the board, so each judgement is kept with its reasons. A standalone `security-finding-triage` run is not picked up: the run lands only the output of a triage it ran itself, and never looks for one elsewhere. To land a judgement made in a standalone run, run `security-response triage <target>`.

Triage lands on a row that is not final. A final row stays final for the run ([Final](#final)).

To land an outcome:

1. The concept id becomes final: it is the output's **Concept id**, the triaged finding's own id (a `duplicate` names the canonical id in **Duplicate of**). While the row's id is provisional and the output's differs, the row is renamed, and the rename is logged; a regression of a concept id already in the findings ledger takes the new id triage chose. Once a row's id is final it is never renamed: a later triage of the row that gives a different id lands nothing. Nor does an output whose id is already another row's. Either is raised in Waiting on you for the human.
2. The output is saved verbatim to `triage/<concept-id>.md`, under the final concept id: one file per row. A later triage of a row that is not final replaces the file; `activity.md` keeps each move.
3. Map the Outcome to Evidence and Delivery ([Outcome to Evidence](#outcome-to-evidence)). **Severity (after triage)** becomes the row's Severity, with no `?`; a `duplicate` row's reads `—`.
4. Add the outcome's record to the row's Record: for `rejected`, one public-safe line from the Decision on why, or on what would reopen it; for `duplicate`, `of <canonical id>`. A `rejected` or `duplicate` row's Next reads `final`.
5. Add a row for each finding the output found in triage ([Found in triage](#found-in-triage)), rewrite the row's Next, Waiting on you and Next (agent), and log the move in `activity.md`: `triaged: <old evidence> → <new evidence>, saved triage/<concept-id>.md`.

The output's Proposed ledger row is kept in the saved file and goes nowhere else: the run's `close` drafts the ledger from it. Triage never edits the findings ledger.

### Outcome to Evidence

| Outcome         | Evidence      | Delivery                                                      |
| --------------- | ------------- | ------------------------------------------------------------- |
| `confirmed`     | `confirmed`   | unchanged: `open` until a fix                                 |
| `rejected`      | `rejected`    | `—`                                                           |
| `below-floor`   | `below-floor` | unchanged: `open` until its hardening lands                   |
| `duplicate`     | `duplicate`   | `—`                                                           |
| `accepted-risk` | `confirmed`   | unchanged: a recommendation ([Accepted risk](#accepted-risk)) |

### Duplicates

A finding triage shows to be the same concept as another row, or as a concept id already in the findings ledger, is kept as a `duplicate` row with Record `of <canonical id>`. It keeps its own concept id, its Severity and Delivery read `—`, and its Next reads `final`. It is never deleted or folded into the canonical row, because its advisory still needs closing once the canonical row's advisory is final.

### Accepted risk

An `accepted-risk` outcome is only a recommendation. Its Evidence lands as above, and its Delivery stays as it is until the human records it: Waiting on you gets one item, to accept the risk on the row with `record accepted-risk <concept-id>: <reason>` or to ask for a fix, and the row's Next reads `you: decide accepted risk`. Recording it: [Accepted risk, recorded](#accepted-risk-recorded). The run never sets the Delivery `accepted-risk` from a triage outcome.

### Found in triage

Each finding in the output's **Found in triage** section enters as a new `untriaged` row, with advisory `none yet`, the severity claimed with a `?`, and Record `found in triage of <concept-id>, <date>`: the triaged row's concept id and the triage date. A concept id already in the findings ledger also gets `in ledger: <status>`, as [Concept ids](#concept-ids) says. Its own judgement comes from its own triage, `security-response triage <its concept-id>`. When its concept id is already a row on the board, no row is added, and the run raises it in Waiting on you.

A found-in-triage row confirmed at Medium or above needs a draft advisory before `fix PR open`, because the private fork that holds the fix lives on the advisory. Until reconcile matches a draft to the row ([Rows are never deleted](#rows-are-never-deleted)), Waiting on you asks the human to create a draft advisory for it, and `fix` refuses the row. A found-in-triage row triaged `below-floor` needs no draft: its Advisory becomes `n/a`, and its fix is an ordinary public pull request.

## Record

`security-response record <what>` lands a step only the human can take, or a judgement only the human can make, and the run verifies whatever it can. A judgement never happens on its own ([Moves](#moves)): accepting risk, a `fixed` with no check behind it, and approving a publish, a close or a CVE request come only from one of these commands.

### The set

`record` takes exactly these:

- `merged <fix PR>`: the human merged a fix pull request, on a private fork or, for a `below-floor` row, on the repository; the run checks the fix SHA is on `main` ([Merged and released](#merged-and-released))
- `released <tag>`: the human cut a release; the run checks the tag contains the fix SHA ([Merged and released](#merged-and-released))
- `fixed <concept-id>: <how>`: the row is done with a change that needs no release ([Fixed](#fixed))
- `accepted-risk <concept-id>: <reason>`: the human accepts the risk on the row ([Accepted risk, recorded](#accepted-risk-recorded))
- `approve publish|close|cve <GHSA…>`: the run then publishes, closes, or requests a CVE for each named advisory ([Advisory actions](#advisory-actions))
- `match <GHSA> <concept-id>`: joins a human-made draft to a row with advisory `none yet` ([Match](#match))
- `ack <concept-id|GHSA>`: clears a contradicted-final entry from Waiting on you ([Ack](#ack))

Anything else is refused, with the list shown, and records nothing. A misspelt form, a missing argument, or a concept id or GHSA id that is not on the board is refused the same way; the run never guesses which step was meant. A `<GHSA>` is always the full GHSA id (`GHSA-hg89-9pp4-v549`), never the board's short id.

### Merged and released

Merging a fix PR is the human's step: in the advisory's web UI for a fork PR, in the repository's own pull request for a public PR, with the admin bypass where the branch rules ask for it, and the run never merges one. A fix may go through more than one fix PR, one per fix branch, and one fix PR may fix more than one row; each row's Record names its own. `record merged <fix PR>` names a pull request on an advisory's private fork by the advisory's short id and the pull request's number, as Waiting on you names it (`hg89#2`, which a row's Record writes `fork PR #2`), or by its URL; or a `below-floor` row's public pull request on the repository, by `#<n>` or its URL (`#7`, which a row's Record writes `PR #7`). The run then runs the same checks reconcile runs ([Sources](#sources)): `gh pr view` on the fork, or on the repository for a public PR, as Waiting on you names it (`#7`), shows the pull request merged, and after `git fetch`, `git merge-base --is-ancestor <fix SHA> origin/main` passes for its fix SHA, the commit that carries the fix onto `main`. When both pass, each row whose Record names that fix PR moves `fix PR open` → `merged`, and the fix SHA goes into its Record. Reconcile, run first, may already have made the move on its own: then `record merged` finds the rows `merged`, says so, and logs the report with what reconcile verified.

`record released <tag>` checks each `merged` row: after `git fetch --tags`, `git tag --contains <fix SHA>` lists the tag. Each row whose fix SHA the tag contains moves `merged` → `released`, and the tag goes into its Record. A `merged` row whose fix SHA the tag does not contain stays `merged`, and the reply names it.

The report alone moves nothing. When a check fails, or its source cannot be reached ([An unavailable source](#an-unavailable-source)), no row moves on it: the run says which check failed, and Waiting on you keeps the merge or the release. A final row is never moved.

### Fixed

`record fixed <concept-id>: <how>` lands a change that needs no release (a ruleset or a setting, say) on a row that is not final, whose Evidence is `confirmed` or `below-floor`. The run first checks the change through `gh api` where there is an endpoint for it; otherwise the human's report stands, logged with `verified: nothing to check`. A check that contradicts the report, or an endpoint that cannot be reached, moves nothing, and the reply says what the source shows or that it was not checked. The Delivery becomes `fixed`, and `<how>` goes into the Record as one public-safe line.

### Accepted risk, recorded

`record accepted-risk <concept-id>: <reason>` lands the human's decision to accept the risk, on a row that is not final, whose Evidence is `confirmed` or `below-floor`. The Delivery becomes `accepted-risk`, the reason goes into the Record as one public-safe line, and the item that triage's recommendation raised in Waiting on you is cleared ([Accepted risk](#accepted-risk)). The human may accept the risk on such a row whether or not triage recommended it. There is nothing to verify: it is a judgement.

### Match

`record match <GHSA> <concept-id>` joins a draft that names no concept id, which the human made for a found-in-triage row, to a row with advisory `none yet`: the case reconcile raises in Waiting on you ([Rows are never deleted](#rows-are-never-deleted)). The run checks that the GHSA is a draft it has read and saved to `originals/`, joined to no row, and that the row's advisory reads `none yet`; otherwise the match is refused. The row's Advisory becomes the draft's short id, the draft's line in the advisories table counts the row and takes the Next of an advisory with finding rows, and the item in Waiting on you is cleared.

A draft that names the concept id in its title or body is matched by reconcile on its own, and needs no `record match`.

### Ack

`record ack <concept-id|GHSA>` clears the contradicted-final entry from Waiting on you for that row or advisory ([Final rows and advisories](#final-rows-and-advisories)). The row or advisory stays final, its values unchanged: the ack says the human has seen what the source now shows, and nothing more. The same contradiction is not raised again in this run; a new one is. With no such entry for it, the ack is refused.

### What each transition records

Each transition leaves its record in the row's Record, so nothing the API later loses is lost:

| Transition      | Record                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `fix PR open`   | the fork PR number (`fork PR #2`), or a `below-floor` row's public PR (`PR #7`), written when `fix` opens it |
| `merged`        | the fix SHA (`fix c2d0bd5`), written before publish deletes the fork                                         |
| `released`      | the release tag                                                                                              |
| `fixed`         | how, in one public-safe line                                                                                 |
| `duplicate`     | `of <canonical id>`                                                                                          |
| `accepted-risk` | one public-safe line on why                                                                                  |
| `rejected`      | one public-safe line on why, or on what would reopen it                                                      |

The Record collects these as the row moves: a later record is added after the earlier ones, never written over them (`fork PR #2, fix 763af3a, v1.0.0-alpha.9`).

An advisory's CVE request is recorded in its CVE column, not in a row's Record ([CVE request](#cve-request)).

### Logging a record

Each `record` is logged in `activity.md` as a human report, with what was verified: `<time> human: record <what>; verified: <check and result>`, or `verified: nothing to check` for a judgement. A `record` the set refuses (not one of its forms, or naming what is not on the board) writes nothing, not even a log entry. A form the set accepts is logged even when its check fails or its gate refuses it, with why.

## Advisory actions

Only `record approve` lets the run publish, close, or request a CVE for an advisory, and the run then does it itself, through `gh api` ([SKILL.md](SKILL.md#advisory-actions) names the calls). `<GHSA…>` is one or more full GHSA ids, each one named: there is no wildcard. Each advisory is gated on its own, after reconcile: the run acts on each one that passes its gate and refuses each one that does not, naming why, and a refusal does not stop the others.

An approval is for that one action on that advisory. A refused or failed action needs a new `record approve`, and an approval never carries over to a later action.

After each call, the run reads the advisory back with `gh api repos/<owner>/<repo>/security-advisories/<GHSA-id>`, and moves the board only on what the read shows. A call that fails moves nothing: the reply gives GitHub's error. Each action is logged in `activity.md`: the human's approval ([Logging a record](#logging-a-record)), then the call and what the read showed.

A no-findings advisory ([No-findings advisories](#no-findings-advisories)) is taken by `close` only: publish and a CVE request refuse it. A **duplicate advisory** is one whose every row is `duplicate` or a folded row whose canonical advisory is another ([Concept ids](#concept-ids)). An advisory whose every row is `rejected`, `duplicate` or `below-floor` has nothing to publish: it is closed, not published, once its rows are final. A `below-floor` row keeps the advisory it came from ([Board](#board)), so the run can tell when an advisory whose findings all fell under the Medium floor may close.

### Publish

`record approve publish <GHSA…>` publishes each advisory. Publish is refused while any row under the advisory is not final, a `below-floor` row excepted, or while the advisory is not `draft`. A duplicate advisory is never published: the run refuses it, and says to close it once its canonical row's advisory is final ([Close](#close)). Nor is an advisory whose every row is `rejected`, `duplicate` or `below-floor`: the run refuses it, and says to close it. A `below-floor` row does not hold the publish of an advisory with other rows: its hardening goes on as an ordinary public pull request, and the run still cannot close until the row is final. A no-findings advisory is never published: the run refuses it, and says to close it.

An advisory that holds a folded row whose canonical advisory is another, beside rows of its own to publish, is published only for its own rows: Waiting on you asks the human to remove the folded finding from its body, naming the canonical advisory, and publish is refused while its body still holds the folded finding's `### F<n>` heading. So one concept gets one public advisory.

Publishing deletes the private fork, and its pull requests with it. So the run checks that the fork PR numbers and fix SHAs are in the Record of every row under it that went through the fork, before the publish; a `below-floor` row's public PR is not on the fork. For a row that went through the fork and lacks either, the run reads them from the fork (`gh pr list` and `gh pr view`), writes them into the row's Record, and logs it, before it publishes. When a record is missing and the fork cannot be read, the run refuses the publish.

Once the read shows `published`, the advisory's State becomes `published` and its Next `final`. The run then offers to remove the private-fork clone named in its Fork clone cell, and removes it only on a yes.

### Close

`record approve close <GHSA…>` closes each advisory without publishing it. It takes a list of full GHSA ids, each one named, with no wildcard ([Closing](#closing)). Close is refused while any row under the advisory is not final, or while the advisory is not `draft`.

A duplicate advisory is closed, not published, once its canonical row's advisory is final. For each of its rows, the row named in its `of <canonical id>` record must have an advisory that is `published` or `closed`; for a folded row, its canonical advisory must be `published` or `closed`; a canonical row with advisory `n/a` must itself be final, and a canonical id that is only in the findings ledger counts as final. Until then the close is refused, and the advisory's Next reads `close once <canonical advisory> is final`.

What closing does to the private fork is not documented, so before a close the run records fork PR numbers and fix SHAs as it does before a publish. Once the read shows `closed`, the advisory's State becomes `closed` and its Next `final`.

### CVE request

`record approve cve <GHSA…>` requests a CVE for each advisory. The run requests it only after a row under the advisory is `confirmed`, and a folded row counts only under its canonical advisory ([Concept ids](#concept-ids)), so one concept gets one CVE. It refuses the request when no row is, when the advisory is `closed`, and when the CVE column already reads `requested <date>` or a CVE id. GitHub answers `202 Accepted`, for a public repository only, and its `cve_id` stays empty until a CVE is assigned. So on that answer the run writes `requested <date>` in the advisory's CVE column, and the request is logged in `activity.md`; the board keeps the request until the advisory API shows the CVE id, which then replaces it ([Who wins](#who-wins)). Any other answer records nothing.

## Close and the findings ledger

`security-response close` writes the findings ledger once, through one public pull request the human merges, and the run closes only when those lines are on `main`. The ledger is the run's only public projection: nothing else in the run folder leaves the machine.

### Closable

A run is closable only when every row and every advisory is final ([Final](#final)). `next` then recommends `close`: Waiting on you holds one item, `Run security-response close to preview the ledger lines`, below any contradicted-final entry not yet acknowledged ([Final rows and advisories](#final-rows-and-advisories)), and Next (agent) reads `nothing until one of the above lands`. Nothing closes on its own.

`close` reconciles first, like every mode, and then `close` checks again. When any row or advisory is not final, it refuses, and lists each row and advisory that is not final, with its Evidence and Delivery or its state. A refused close writes nothing.

### Preview

Before anything is written, `close` shows the exact ledger lines it would append ([Row to line](#row-to-line)), in the ledger's five columns, with the ledger's path and each row that adds no line and why. Nothing is written without a yes. The human may edit the Notes of any line; the other four columns come from the board and are not edited. After an edit the run checks the Notes for what it never copies ([Notes](#notes)), shows the preview again, and asks again.

### Ledger path

The ledger is the Consumer's: the Caller's `findings_ledger_path`, otherwise `.security/findings-ledger.md`. The Caller is the workflow under `.github/workflows/` that uses `security-audit-reusable.yml`. This is the same lookup `security-audit` uses, and the one reconcile reads ([Sources](#sources)). When the run has lines to write and no ledger is at that path, `close` says so and writes nothing: the human adds the ledger, and runs `close` again.

### Row to line

Each row on the board gives one ledger line, unless [Ledger rules](#ledger-rules) say it adds none:

| Column     | Value                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concept id | the row's final concept id                                                                                                                                                                                                                                                                                                                                                                                                       |
| Status     | `rejected` when the row's Evidence is `rejected` or `duplicate`; otherwise its Delivery: `released <tag>` with the tag from its Record, `fixed`, or `accepted-risk`                                                                                                                                                                                                                                                              |
| First seen | the Created date of the row's canonical advisory for a finding from a draft advisory ([Concept ids](#concept-ids)); the triage date for a finding found in triage, from its Record                                                                                                                                                                                                                                               |
| Advisory   | the full GHSA id of the row's canonical advisory ([Concept ids](#concept-ids)); for a row folded from two advisories that is not `below-floor`, the preview names the other, for the human to add to Notes if they choose; `n/a` for a `below-floor` row, which keeps its advisory on the board ([Board](#board)), and for any row with no advisory (`none yet`), such as a found-in-triage row that reached final with no draft |
| Notes      | drafted from the Notes of the Proposed ledger row in `triage/<concept-id>.md`, plus the public parts of the Record ([Notes](#notes)); the human may edit it in the preview                                                                                                                                                                                                                                                       |

### Notes

The Notes cell is one public-safe line. From the Record, it takes only these, in this form:

- `fixed in <sha>`, from the row's fix SHA;
- duplicate of `<id>`, from the Record `of <canonical id>`;
- `below the Medium floor`, for a `below-floor` row;
- `found in triage of <GHSA>`, from the Record `found in triage of <concept-id>, <date>`: the full GHSA id of that concept id's row's canonical advisory ([Concept ids](#concept-ids)), or the concept id itself when that row's own ledger line writes Advisory `n/a` (a `below-floor` row, or one with no advisory), so a note never names an advisory its parent's line keeps out of the ledger;
- the one public-safe line a `fixed`, `accepted-risk` or `rejected` record gives.

Everything else in the Record is never copied: fork PR numbers, clone paths, `in ledger: <status>`, and anything private. Nor is anything else from the triage output: never the attack path, evidence, file location or exploit detail.

### Ledger rules

- A `duplicate` of a concept id already in the ledger adds no line: the existing line stays as it is, and `activity.md` records the repeat. A `duplicate` of another row in this run keeps its own line, with Status `rejected` and Notes duplicate of `<id>`, because its concept id is not yet in the ledger. A regression, which triage gives a new concept id, gets its own line. No concept id gets a second line.
- Append only: the new lines go at the end of the ledger's table, ordered by first seen, then by advisory (`n/a` last), then by `F<n>`, then by concept id, so every preview of the same board gives the same order. Close never edits, reorders or removes an existing line. Only the padding a Markdown formatter re-aligns may change on an existing line, never its cells.
- The ledger format is unchanged: the same header text and the same five columns.

### No ledger lines

A run with no ledger lines, because it held only no-findings drafts, or only duplicates of concept ids already in the ledger, needs no ledger PR. Once the preview shows that it writes no line, and why, `close` goes straight to `closed`, with no ledger PR: the header gets `Closed <date>, no ledger PR` ([Closed](#closed)).

### The ledger PR

One ledger PR per run. On a yes, the run runs `git fetch`, cuts the branch `chore/security-ledger-<run>` from `origin/main` in a temporary `git worktree` outside the run folder, so the human's checkout is left as it was, appends the previewed lines to the ledger in one commit, pushes the branch, and opens one public pull request with `gh pr create`. Never a direct push to the default branch, and never one pull request per advisory. The commit message and the pull request's title and body name the run and the concept ids, and carry nothing the ledger lines do not: no advisory body, fork PR number or clone path. Once the pull request is open, the run removes its temporary worktree. A step that fails moves nothing on the board: the reply says which step failed, and `close` may be run again.

Before it cuts the branch, the run looks for the branch's pull request with `gh pr list --head chore/security-ledger-<run> --state all`. When there is an open or merged one, it is the run's ledger PR, and no second one is opened. When the branch is already pushed with no pull request (a step failed after the push), the run reuses it: it opens the pull request from the branch once its one commit holds the previewed lines, and otherwise names the branch and stops for the human.

The human merges it, with the admin bypass where the branch rules ask for it, after CI, like every other pull request; the run never merges it.

### While closing

Once the ledger PR is open, the run is `closing`: the header gains `Closing: ledger PR #n`, Waiting on you holds only `Merge ledger PR #n` (below any contradicted-final entry not yet acknowledged, and above the new drafts waiting for the next run, below), and Next (agent) reads `nothing until ledger PR #n is merged`. `activity.md` logs the pull request. Nothing else on the board changes: every row and advisory is final.

Reconcile checks the ledger PR with `gh pr view <n>`. Once it shows merged, the run runs `git fetch` and checks that the lines are on `origin/main`: each appended line is in the ledger as `git show origin/main:<ledger path>` reads it. Only then is the run `closed` ([Closed](#closed)). A ledger PR closed without merging leaves the run `closing`, and its merge item asks the human to reopen it, or to run `close` again: that previews the lines again and opens a replacement ledger PR from the same branch, which the header then names. A run never has more than one open ledger PR, and only one is ever merged. A ledger PR or a ledger the run cannot read moves nothing ([An unavailable source](#an-unavailable-source)).

A draft advisory that appears while the run is closing does not join the run, because every row is final: it gets no row and no saved original, and Waiting on you lists it below the merge, as `new draft waiting for the next run: <GHSA-id>`. It opens the next run once this one is closed.

### Closed

When the run closes, the header gets `Closed <date>, ledger PR #n` in place of its `Closing:` line (`Closed <date>, no ledger PR` for a run with no ledger lines), and `activity.md` logs the close with what was verified. The folder stays: nothing is deleted automatically, and `originals/` still holds the bodies of advisories that were closed and never published. The close message names the folder, and says the folder is private and the human's to delete: it holds advisory bodies and triage detail, and is never committed or shared.

A closed run is read-only: no mode writes to it again. The invocation whose reconcile closes the run stops after the close message, and the next invocation starts a new run when draft advisories exist, a draft that waited while the run was closing among them ([Open, resume, or nothing to respond to](#open-resume-or-nothing-to-respond-to)).

## Board

```markdown
# Security Response Run <run>

Started <date> <time>. Default branch: main@<sha>, checked <time>.

**Waiting on you:**

1. <a human step, naming its pull request, setting or release>

**Next (agent):** <one action, or `nothing until one of the above lands`>

## Findings

| Concept id                                   | Advisory | Severity | Evidence  | Delivery | Record                  | Next             |
| -------------------------------------------- | -------- | -------- | --------- | -------- | ----------------------- | ---------------- |
| `implementer-git-config-write-executes-code` | hg89 F1  | high     | confirmed | merged   | fork PR #1, fix c2d0bd5 | you: cut release |
| `glob-brace-expansion-escapes-pattern-check` | hg89 F2  | medium?  | untriaged | open     |                         | agent: triage    |

## Advisories

| Advisory            | Created    | Rows | State | CVE           | Fork clone             | Next                   |
| ------------------- | ---------- | ---- | ----- | ------------- | ---------------------- | ---------------------- |
| GHSA-hg89-9pp4-v549 | 2026-10-12 | 2    | draft | not requested | ../agent-kit-ghsa-hg89 | wait: 2 rows not final |
```

The header names the run and when it started. While the run is closing, the header adds `Closing: ledger PR #n`; once it is closed, `Closed <date>, ledger PR #n`, or `Closed <date>, no ledger PR` ([Close and the findings ledger](#close-and-the-findings-ledger)). Its `Default branch` line is the default branch's name and tip, and when it was last checked; every invocation checks it again. When a source cannot be reached, the line for it reads `not checked: <source> unavailable` (for the default branch, `Default branch: not checked: git unavailable`), and nothing on the board moves on that source.

**Waiting on you:** is a numbered list of the human's steps, each naming the pull request, setting, release or draft advisory it is about, or reads `nothing`. **Next (agent):** is one action, or `nothing until one of the above lands`. Both are rewritten on every update: they are what the human reads first, so nobody has to scan the Next column of every row.

The findings table has one row per concept id:

| Column     | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concept id | The row's concept id, provisional until triage.                                                                                                                                                                                                                                                                                                                                                                                       |
| Advisory   | Each advisory finding in the row, short id and `F<n>` (`hg89 F2, xmp7 F1`), oldest advisory first: the first is the row's canonical advisory ([Concept ids](#concept-ids)); `none yet` for a finding found in triage with no draft yet. A `below-floor` row keeps the advisory it came from; `n/a` for a `below-floor` row with no draft (found in triage). At close, the findings ledger still writes `n/a` for a `below-floor` row. |
| Severity   | Before triage, the severity the advisory claims, with a `?` (`high?`); after triage, the triaged severity. `—` for a `duplicate` row.                                                                                                                                                                                                                                                                                                 |
| Evidence   | One of the [Evidence](#evidence) values.                                                                                                                                                                                                                                                                                                                                                                                              |
| Delivery   | One of the [Delivery](#delivery) values; `—` for a row whose Evidence is `rejected` or `duplicate`.                                                                                                                                                                                                                                                                                                                                   |
| Record     | One free-text cell that collects the row's transition records as it moves: the fork PR number or a `below-floor` row's public PR number, the fix SHA, the release tag, `of <canonical id>`, a one-line reason, `in ledger: <status>`.                                                                                                                                                                                                 |
| Next       | The row's next step, prefixed `agent:` or `you:`, or `final`.                                                                                                                                                                                                                                                                                                                                                                         |

Rows are ordered by severity, highest first (`critical`, `high`, `medium`, then anything below), then by advisory. Final rows stay in place, so the table keeps its shape as the work moves.

The advisories table has one line per draft advisory in the run:

| Column     | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Advisory   | The full GHSA id.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Created    | The date the advisory was created.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rows       | How many finding rows it has; `0 (<kind>)` for a no-findings advisory ([Kinds](#kinds)).                                                                                                                                                                                                                                                                                                                                                                 |
| State      | One of the [Advisory state](#advisory-state) values.                                                                                                                                                                                                                                                                                                                                                                                                     |
| CVE        | `not requested`, `requested <date>`, or the CVE id once assigned.                                                                                                                                                                                                                                                                                                                                                                                        |
| Fork clone | The local path of the private fork's clone, or `—`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Next       | Why it is not yet publishable (`wait: 3 rows not final`), `you: approve publish` once every row under it is final, `close once <canonical advisory> is final` for a duplicate advisory, a folded row's other advisory among them, `you: approve close` once a duplicate's canonical advisory is final or when every row is `rejected`, `duplicate` or `below-floor` and final, its kind's Next for a no-findings advisory ([Kinds](#kinds)), or `final`. |

`status` prints the board as it is after the run is opened or resumed and then reconciled, in the local terminal only.

## States

### Evidence

What is known about the finding: `untriaged | confirmed | rejected | duplicate | below-floor`.

- `untriaged`: not yet triaged against the current tree.
- `confirmed`: repeatable, safe evidence supports a reachable finding at or above the Medium floor.
- `rejected`: a false positive, or out of the threat model. Its Record gives one public-safe line on why, or on what would reopen it.
- `duplicate`: the same concept as another finding, or as a concept id already in the findings ledger. Its Record names the canonical concept id, `of <canonical id>`. The row stays on the board, because its advisory still needs closing.
- `below-floor`: real, but under the Medium floor, so it gets hardening rather than an advisory. Its severity is `low`. It is not `rejected`, which means false.

`accepted-risk` is not evidence: it is a Delivery ending.

### Delivery

What has been shipped: `open → fix PR open → merged → released`, plus `fixed` and `accepted-risk`.

- `open`: no fix yet.
- `fix PR open`: a fix pull request is open on the advisory's private fork, or, for a `below-floor` row, an ordinary public pull request on the repository. Its Record gives the PR number.
- `merged`: the fix is on the default branch and its release is pending. Its Record gives the fix SHA, written before publishing deletes the fork.
- `released`: a release tag contains the fix. Its Record gives the tag.
- `fixed`: done with a change that needs no release (a ruleset or a setting, say).
- `accepted-risk`: the human has decided to accept the risk. Its Record gives one public-safe line on why.

A `below-floor` row uses the same values, through its public pull request: reconcile and `record merged #<n>` check it on the repository ([Sources](#sources)), and it reaches `merged` and `released` as a fork PR's row does. It needs no fork, so it needs no draft advisory ([Found in triage](#found-in-triage)).

### Advisory state

Each advisory in the advisories table: `draft → published | closed`.

- `draft`: open, and private.
- `published`: published, through `gh api`, once the human approves it.
- `closed`: closed without publishing, once the human approves it.

A CVE request is recorded beside the state, in the CVE column. GitHub's `cve_id` stays empty until a CVE is assigned, so the board keeps the request itself.

### Final

- **A row** is final when its Evidence is `rejected` or `duplicate`, or its Delivery is `released`, `fixed` or `accepted-risk`.
- **An advisory** is final when its state is `published` or `closed`.
- **The run** can close only when every row and every advisory is final.

A no-findings advisory is final only once `closed` ([No-findings advisories](#no-findings-advisories)).

A row that is not final may move backward: a closed fix pull request takes it back to `open`, and new evidence takes it back to `untriaged`. Final values stay final for the run: reopening a final row means a new concept id, or the next run.
