# Findings ledger

Fingerprints of known findings from the Agent-kit security audit, so repeat runs dedupe. This repository is public, and so is this file. Record **only** the concept id, status and dates. Never record the attack path, evidence or location. The Advisory column names the public advisory once one is published; until then it names the private draft, which holds the detail. From Agent-kit v1.0.0-beta.10, only a Security Response Run's `close` (the `security-response` skill) or the maintainer, by hand, writes this file; `security-finding-triage` proposes a row and never edits it. `close` only appends lines.

| Concept id | Status | First seen | Advisory | Notes |
| --- | --- | --- | --- | --- |
| `user-role-assign-privilege-escalation` | released (v0.3.0-beta) | 2026-11-07 | GHSA-f7f2-qgg6-rjrr | Also reported as `user-role-assignment-privilege-escalation` (GHSA-33c4-299h-9xc7). Triaged 2026-11-16; fixed by #356 |
| `user-superuser-mass-assignment` | released (v0.3.0-beta) | 2026-11-07 | GHSA-f7f2-qgg6-rjrr | Triaged 2026-11-16; fixed by #356 |
| `pending-user-self-verify-bypass` | released (v0.3.0-beta) | 2026-11-07 | GHSA-fr5q-xw6q-q8g8 | Fixed by #339; follow-up hardening open |
| `prod-seeded-demo-accounts-shared-password` | released (v0.5.0-beta) | 2026-11-07 | GHSA-rvj8-7398-rqw9 | Fixed by #378 |
| `prod-accepts-example-secrets` | released (v0.4.0-beta) | 2026-11-07 | GHSA-3v3w-53cx-mw57 | Fixed by #371 |
| `login-account-enumeration-oracle` | released (v0.6.0-beta) | 2026-11-07 | GHSA-m98q-jp2v-93w5 | Re-reported in GHSA-33c4-299h-9xc7; fixed by #385 |
| `ci-third-party-actions-unpinned` | released (v0.6.0-beta) | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Fixed by #393 |
| `non-production-mode-token-disclosure` | released (v0.4.0-beta) | 2026-11-09 | GHSA-7983-x632-p8jv | Fixed by #367 |
| `role-permission-edit-ceiling` | released (v0.3.0-beta) | 2026-11-16 | GHSA-f7f2-qgg6-rjrr | Manual triage; fixed by #360 |
| `user-edit-target-ceiling` | released (v0.5.0-beta) | 2026-11-17 | GHSA-9q8m-5q2m-rmfv | Manual triage; fixed by #377 |
