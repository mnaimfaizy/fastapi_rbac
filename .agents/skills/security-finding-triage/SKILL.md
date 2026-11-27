---
name: security-finding-triage
description: Stress-check one security finding, confirm or reject with evidence, and produce a durable triage outcome, with a proposed findings-ledger row, for the advisory workflow.
disable-model-invocation: true
metadata:
  agent-kit-scope: user
---

# Security finding triage

One finding at a time. Discovery is `security-audit`; broader backlog management belongs to `security-response`.

Outcome shape: [OUTCOME-FORMAT.md](OUTCOME-FORMAT.md)

## Hard rules

1. Never produce weaponized exploit instructions or PoCs.
2. Keep private detail out of public channels.
3. Prefer current-tree evidence (`file:line`) over stale advisory text.
4. Do not open fix PRs unless explicitly requested.
5. Never edit the findings ledger. The outcome carries a Proposed ledger row instead, and only a Security Response Run's `close` applies it. Outside a run, the maintainer edits the ledger by hand.

## Process

1. Identify target finding (`concept-id` preferred).
2. Verify the current code path still matches the claim. For a finding from a deep scan, read its `Reproduced` value and Observation as evidence. Triage stays static: never build, run or probe the code to re-check them. Re-attempting a Reproduction on a fix is a Verification run, which the maintainer starts with the `agent-kit deep-scan` launcher, not this skill.
3. Decide outcome:
   - `confirmed`
   - `rejected`
   - `below-floor`
   - `accepted-risk`
   - `duplicate`
4. Emit triage output using `OUTCOME-FORMAT.md`.

The output goes to the chat and nowhere else. Run on its own, this skill writes no file, and a Security Response Run does not pick its output up: `security-response triage <target>` runs this skill and lands the outcome on the run's board.
