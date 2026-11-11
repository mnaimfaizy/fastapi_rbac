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
<!-- qa-plan format=1 subject=#118 pr=#130 -->

# QA Plan: <the subject issue's title>
```

The marker is how a revision finds the plan it replaces (on a tracker issue or a PR comment) and how `manual-qa` recognises a plan. `format` is this file's version; `subject` and `pr` are the anchors below.

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

- **Target:** `stack` (a local QA Stack the tester starts) or `url` (a hosted test environment someone else deployed). For `url`, also the expected test-environment label in its hostname (`staging`, `qa`, `preview`, …), never a full production-looking address.
- **Surface:** `web`, `desktop`, `mobile` or `api`.
- **Build:** the head SHA, and the version endpoint (`/version`) when the app has one, so the tester can check they are testing the build this plan is about.
- **Roles:** each role the scenarios sign in as, by id and purpose (`admin`: manages members). At most a role's email beside it; never a password or token.
- **Credentials:** where the role values come from. With the repository: the config's `accounts.print` command. Without it: ask the developer, and paste them into chat, never into the plan.
- **Capture rules:** the _Capture rules_ of every matching Hazard pack, inlined under the pack's path, so the tester obeys them without opening the pack. `None.` when no pack matched.

### No credentials travel with a plan

Not even a public QA Account's values, which are fixtures anyone with the repository can print. A plan is copied into trackers, chats and other teams' tools, so its text is public. It carries **role ids, at most their emails, and where the values come from**, and nothing a sign-in form would accept as a secret: no password, token, API key, session cookie, one-time code or recovery code. `manual-qa` refuses a plan that carries one.

## Setup

What the tester does once before the first scenario, in order: data to put in place, flags to set, the account state to restore (`accounts.restore` for a role, when a scenario changes it). Steps only; the Run brief already says how to reach the build.

## Scenarios

The **Residue**: only what a passing CI run does not establish. One `###` heading per scenario, numbered from `S1` with no gaps: `### S1: <what is verified>`. Each carries these labels, in this order:

- **Why only a human can prove it:** what no suite in _What automation already proves_ covers, and why automation cannot or does not.
- **Signs in as:** a role id from the Run brief, or `nobody` (signed out).
- **Steps:** a numbered list. Each step quotes the real label, button text or copy from the source (`Click **Save changes**`), never an imagined one.
- **Expected result:** what the tester sees when it works, in the product's own words.
- **A failure means:** what is broken if the expected result does not appear, so a failure is reported as a finding and not a symptom.
- **If this fails, first rule out:** only in a scenario a Hazard pack matches. The pack's _Rule out first_ list, copied in under the pack's path.

A plan with no scenarios is not written: an empty Residue means merge without a plan.

## Sign-off checklist

One unticked box per scenario (`- [ ] S1: <what is verified>`), plus one per Setup step a person must confirm. Ticked by whoever runs the plan.

## Stop and do not merge if

The outcomes that block the merge whatever else passes: a regression against the merge-base, data loss, a role reaching what it must not, a failed scenario the plan marks blocking. One bullet each.

## Execution record

Empty after compose: exactly the line `_Not run yet._`. Whoever runs the plan replaces it with one row per scenario (scenario, result, evidence, notes), the build they ran against, and when. `manual-qa` writes the full QA Report beside it; this section is the short record that stays with the plan.
