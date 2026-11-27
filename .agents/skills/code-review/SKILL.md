---
name: code-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along three axes — Standards (repo conventions), Spec (requested behavior), and Correctness (runtime behavior). Use when a user asks to review work-in-progress, a branch, or a PR.
metadata:
  agent-kit-scope: user
---

# Code review

Run a three-axis review for `git diff <fixed-point>...HEAD`:

- Standards: conventions and documented repository rules
- Spec: requested requirements vs implementation
- Correctness: concrete failure scenarios

## Process

1. Resolve fixed point and gather:
   - `git rev-parse <fixed-point>`
   - `git diff <fixed-point>...HEAD`
   - `git log <fixed-point>..HEAD --oneline`
2. Identify the spec source:
   - linked issue/PR text
   - user-supplied spec path
   - docs/spec files in-repo
3. Run three independent review passes (or parallel sub-agents where available) and keep findings separated by axis. The Standards pass includes the checks under [Standards pass](#standards-pass).
4. Report with headings:
   - `## Standards`
   - `## Spec`
   - `## Correctness`
5. End with one line summarizing finding counts per axis.

## Standards pass

Check the diff against the repository's documented conventions and rules, then run the docs-impact check below.

### Docs impact

Run this check whenever the diff adds, renames, changes or removes something a doc describes: a variable, input, flag, command, label, path, setting, default or limit a reader could look up.

1. List each such name or behaviour, with its old and new form.
2. Find the pages that describe it. Look for the repository's **Docs map**: a file pairing areas of the code with the doc pages that describe them, which `AGENTS.md` or `CLAUDE.md` names, or else a file named `docs-map.md` in the repository. Read the pages it lists for each changed path. For a changed path the map does not cover, or when the repository has no Docs map, search the docs for each changed name (its old form too, when renamed or removed). The docs are the prose a reader follows: the README, the docs folder, contributor guides, examples and comments meant for readers. Skip history (changelog, release notes, ADRs), which keeps old names on purpose.
3. Read each hit in context. Keep each page that still describes the old thing, and each page that lists the peers of something added but leaves the new one out.

Report each as a **Docs-impact finding**: a Standards finding that names each doc page and line that still says the old thing, as `path:line`, with what it says and what the diff made true. It does not block the change: a search can match a page that is still right, so say what to check and leave the call to the author.

Also report, as a Docs-impact finding, a hand-written list or table that the diff adds or edits in a doc and that copies a constant from the code (a set of names, paths, labels or defaults), when it sits outside a **Generated block**: a marked part of a page the repository writes from the code and checks. Name the constant it copies. A copy typed by hand drifts the next time the constant changes.

## Rules

- Do not rerank findings across axes.
- Prefer concrete evidence with file references.
- Keep recommendations actionable and scoped to the diff.
