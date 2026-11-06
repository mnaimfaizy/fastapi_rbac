---
name: security-response
description: Reconcile private advisory findings against current code, prioritize next work, run triage, and coordinate guarded remediation when explicitly authorized.
argument-hint: "[status | next | triage <concept-id|GHSA:F#> | fix <concept-id|next> | reconcile]"
user-invocable: true
disable-model-invocation: true
---

# Security response

Backlog and remediation orchestrator for security findings.

This skill is portable and does not include product-specific playbooks, threat packs, or ledgers. Consumers provide those assets.

Status output shape: [STATUS-FORMAT.md](STATUS-FORMAT.md)

## Modes

- `status`: reconcile and show backlog status
- `next`: recommend one prioritized next action
- `triage <target>`: run evidence-first triage for one finding
- `fix <target>`: only with explicit authorization; implement and validate fix
- `reconcile`: refresh stale evidence/status after merges/releases

## Guardrails

- Never expose advisory bodies, exploit steps, or secrets publicly.
- Prefer `concept-id` over report-local `F<n>` identifiers.
- `status`/`next`/`triage` do not authorize code fixes by default.
- `fix` still requires safe reproducible evidence before implementation.

## Flow

1. Establish context (repo state, default branch, advisory access, target finding identity).
2. Reconcile finding evidence vs current code state.
3. Prioritize based on evidence, impact, exposure, and blast radius.
4. Triage to confirm/reject before fixing.
5. If authorized and reproducible, implement minimal root-cause fix and validate.
6. Report status with public-safe wording.
