---
name: code-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along three axes — Standards (repo conventions), Spec (requested behavior), and Correctness (runtime behavior). Use when a user asks to review work-in-progress, a branch, or a PR.
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
3. Run three independent review passes (or parallel sub-agents where available) and keep findings separated by axis.
4. Report with headings:
   - `## Standards`
   - `## Spec`
   - `## Correctness`
5. End with one line summarizing finding counts per axis.

## Rules

- Do not rerank findings across axes.
- Prefer concrete evidence with file references.
- Keep recommendations actionable and scoped to the diff.
