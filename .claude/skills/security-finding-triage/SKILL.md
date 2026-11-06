---
name: security-finding-triage
description: Stress-check one security finding, confirm or reject with evidence, and produce a durable triage outcome for the Consumer ledger/advisory workflow.
disable-model-invocation: true
---

# Security finding triage

One finding at a time. Discovery is `security-audit`; broader backlog management belongs to `security-response`.

Outcome shape: [OUTCOME-FORMAT.md](OUTCOME-FORMAT.md)

## Hard rules

1. Never produce weaponized exploit instructions or PoCs.
2. Keep private detail out of public channels.
3. Prefer current-tree evidence (`file:line`) over stale advisory text.
4. Do not open fix PRs unless explicitly requested.

## Process

1. Identify target finding (`concept-id` preferred).
2. Verify the current code path still matches the claim.
3. Decide outcome:
   - `confirmed`
   - `rejected`
   - `accepted-risk`
   - `duplicate`
4. Emit triage output using `OUTCOME-FORMAT.md`.
5. If a Consumer ledger is in use, update only fingerprint-safe fields there.
