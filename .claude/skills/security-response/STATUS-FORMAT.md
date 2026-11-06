# Security response status format

Use this public-safe shape. Do not include advisory bodies, exploit steps, tokens, or private transcript text.

```markdown
## Security response status

- **Advisory access:** available | blocked
- **Canonical advisory:** GHSA-… (or `mixed`)
- **Default branch:** <branch>@<short-sha>
- **Date:** YYYY-MM-DD

| Concept        | Severity | Evidence  | Delivery state | Bucket        | Next action |
| -------------- | -------- | --------- | -------------- | ------------- | ----------- |
| `<concept-id>` | high     | confirmed | fix PR open    | ci-maintainer | merge PR #… |

### Reconciliation

- Ledger corrections made or stale states found
- Merged/open PR relationships
- Shipped fixes still awaiting a Release

### Recommendation

**Next:** `<concept-id>` — triage | fix | merge | release follow-through

Why this outranks alternatives.

### Human action

Exact approval/secret/configuration/release action needed, or `None`.
```

Evidence values:

- `untriaged`: claim not yet reproduced against current tree
- `confirmed`: repeatable safe evidence supports a reachable Medium+ finding
- `rejected`: false positive, duplicate, out of threat model, or below Medium

Delivery states:

- `open`
- `fix PR open`
- `fixed`
- `fixed; Release pending`
- `released`
- `accepted-risk`
