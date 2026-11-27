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
- **Outcome:** confirmed | rejected | below-floor | accepted-risk | duplicate
- **Severity (after triage):** none | low | medium | high | critical
- **Duplicate of:** `<canonical concept-id>` (duplicate only)
- **Bucket:** shipped-product | ci-maintainer | duplicate
- **Date:** <YYYY-MM-DD>
```

The **Concept id** is the triaged finding's own id, final from this triage on. A regression of a concept id already in the findings ledger gets a new concept id here.

### Outcomes

- `confirmed`: repeatable, safe evidence supports a reachable finding at or above the Medium floor.
- `rejected`: a false positive, or out of the threat model.
- `below-floor`: real, but under the Medium floor, so it gets hardening rather than an advisory. Its severity is `low`. It is not `rejected`, which means false.
- `accepted-risk`: real, and the triager recommends accepting the risk rather than fixing it. It is a recommendation, not a decision: it maps to the Delivery ending `accepted-risk`, which only the human records.
- `duplicate`: the same concept as another finding, or as a concept id already in the findings ledger. **Duplicate of** names the canonical concept id.

### Evidence

- What was checked (`path:line`) and whether claim still holds
- Who can trigger it / preconditions (narrative only)
- For a finding from a deep scan: its `Reproduced` value and, with `yes`, its Observation, weighed as evidence. `yes` shows the path was triggered in a running copy of the code. `no` and `not attempted` are weak evidence that the bug is absent, so check the code path as for any static finding. Quote an Observation only in prose: never add a payload or a step to it.

### Decision

Why this outcome. For `rejected` or `accepted-risk`, state what would reopen it.

### Fix direction (confirmed only)

Concrete remediation direction (not a full patch unless trivial).

### Agent brief (optional, confirmed only)

- Goal
- Likely files
- Acceptance checks
- Out of scope

### Found in triage

Only when triage turns up a new finding, separate from this one. One line each: a provisional concept id, its own concept id rather than this one's, a short public-safe title, and the severity claimed. Leave the section out when there are none.

### Proposed ledger row

The line this outcome proposes for the findings ledger, in the ledger's five columns:

```markdown
| Concept id | Status | First seen | Advisory | Notes |
| ---------- | ------ | ---------- | -------- | ----- |
```

Status is `rejected` for `rejected` and `duplicate`, and otherwise the ending expected (`released <tag>`, `fixed` or `accepted-risk`). A `duplicate` of a concept id already in the ledger proposes no row: write `none`. Notes is one public-safe line: never the attack path, evidence, file location or exploit detail. Triage never writes it to the ledger: a Security Response Run's `close` applies it, and outside a run the maintainer edits the ledger by hand.

### Notes

- Related concepts / duplicates
- Maintainer follow-ups
