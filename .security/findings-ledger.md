# Findings ledger

Fingerprints of known findings from the Agent-kit security audit, so repeat runs dedupe. This repository is public, and so is this file. Record **only** the concept id, status and dates. Never record the attack path, evidence or location. Full detail lives in the private draft advisory.

| Concept id | Status | First seen | Advisory | Notes |
| --- | --- | --- | --- | --- |
| `user-role-assign-privilege-escalation` | released (v0.3.0-beta) | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Also reported as `user-role-assignment-privilege-escalation` (GHSA-33c4-299h-9xc7). Triaged 2026-11-16; fixed by #356 |
| `user-superuser-mass-assignment` | released (v0.3.0-beta) | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Triaged 2026-11-16; fixed by #356 |
| `pending-user-self-verify-bypass` | released (v0.3.0-beta) | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Fixed by #339; follow-up hardening open |
| `prod-seeded-demo-accounts-shared-password` | released (v0.5.0-beta) | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Fixed by #378 |
| `prod-accepts-example-secrets` | released (v0.4.0-beta) | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Fixed by #371 |
| `login-account-enumeration-oracle` | fixed; Release pending | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Re-reported in GHSA-33c4-299h-9xc7; fixed by #385 |
| `ci-third-party-actions-unpinned` | confirmed; open | 2026-11-07 | GHSA-9p2m-g4cr-xqmx | Partly mitigated |
| `non-production-mode-token-disclosure` | released (v0.4.0-beta) | 2026-11-09 | GHSA-33c4-299h-9xc7 | Fixed by #367 |
| `role-permission-edit-ceiling` | released (v0.3.0-beta) | 2026-11-16 | pending | Manual triage; fixed by #360 |
| `user-edit-target-ceiling` | released (v0.5.0-beta) | 2026-11-17 | pending | Manual triage; fixed by #377 |
