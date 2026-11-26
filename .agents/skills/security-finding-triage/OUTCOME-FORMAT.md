# Security finding triage — outcome format

Emit **markdown only**, starting with exactly:

```markdown
## Security finding triage
```

Then:

```markdown
- **Concept id:** `<kebab-case>`
- **Finding:** F<n> — <short title> (or ledger title)
- **Advisory:** GHSA-… (or `n/a`)
- **Outcome:** confirmed | rejected | accepted-risk | duplicate
- **Severity (after triage):** none | medium | high | critical
- **Bucket:** shipped-product | ci-maintainer | duplicate
- **Date:** <YYYY-MM-DD>
```

### Evidence

- What was checked (`path:line`) and whether claim still holds
- Who can trigger it / preconditions (narrative only)

### Decision

Why this outcome. For `rejected` or `accepted-risk`, state what would reopen it.

### Fix direction (confirmed only)

Concrete remediation direction (not a full patch unless trivial).

### Agent brief (optional, confirmed only)

- Goal
- Likely files
- Acceptance checks
- Out of scope

### Ledger update

- Previous evidence/status -> new evidence/status
- Confirm row update (or say blocked)

### Notes

- Related concepts / duplicates
- Maintainer follow-ups
