# Security audit report format

Emit **markdown only**, starting with exactly:

```markdown
## Security audit report
```

Then:

```markdown
- **Mode:** full | pr
- **Scope:** <brief>
- **Date:** <YYYY-MM-DD>
- **Max severity:** none | medium | high | critical
- **Finding count:** <n>
```

If zero Medium+ findings:

```markdown
### Findings

None.
```

Otherwise, for each finding (severity descending):

```markdown
### F<n> — <short title>

- **Severity:** Critical | High | Medium
- **Evidence class:** dependency-advisory | code-path | missing-control
- **Asset:** <token | store | IPC | CI | dependency | ...>
- **Location:** `path/to/file.ext:line` (additional locations as bullets)
- **Attack path:** who -> how -> impact (no exploit payload)
- **Evidence:** what the code/config does wrong (quote or paraphrase briefly)
- **Preconditions:** what must be true for this to matter
- **Fix direction:** concrete remediation idea (not a full patch unless trivial)
- **Concept id:** `<kebab-case>` (stable id for a Consumer findings ledger)
```

For `dependency-advisory`, include the advisory id from a workspace grounding file.

Optional closing section:

```markdown
### Notes

- Scanner hits considered/discarded
- Existing ledger concepts skipped (if Consumer ledger available)
- Areas not covered (time/scope)
```
