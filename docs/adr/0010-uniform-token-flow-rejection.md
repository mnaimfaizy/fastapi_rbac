# ADR 0010: Uniform rejection in the token-bearing account flows

## Status

Accepted

## Context

[ADR 0007](0007-uniform-registration-response.md) closed the account-enumeration oracle on registration and resend-verification and recorded what it left open: verify-email and both password-reset confirm endpoints still answered `"Account is inactive. Cannot …"` for a disabled user. Issue [#137](https://github.com/mnaimfaizy/fastapi_rbac/issues/137) tracked it. Each of those three sites confirmed, in a single request, that an account exists at the submitted address — a narrower oracle than the one 0007 closed, but the same defect.

The neighbouring failure branches were no better. Verify-email answered `"Invalid verification token or user not found."` when the address was unknown and `"Verification token is invalid, expired, or has already been used."` when the token did not match, so an attacker could separate "no account here" from "an account here with a different token" without the disabled message at all. Password-reset confirm split the same way, across `"Invalid token payload."`, `"Invalid token or user not found."` and `"Invalid token"`. Fixing only the disabled string would have left the property still false.

`/password-reset/request` was uniform in intent but not in fact: its absent and disabled branches ended with a full stop and its active branch did not. One character separated an active account from every other state.

## Decision

1. **One rejection per flow, not one per branch.** Every failure that required looking an account up returns a single fixed message — one for verify-email, one for both reset-confirm endpoints. Which failure it actually was is recorded as a distinct security event, as in 0007.
2. **The message is produced by a call, not written at the branch.** `reject_verification` and `reject_password_reset` take the security event and raise the uniform `400`. A branch added later cannot invent its own wording, because there is no wording at the call site to invent. This is the same reasoning as 0007's shared dispatch operation: the drift between sites *was* the defect.
3. **The `is_active` check moves behind the allow-list check** in both reset-confirm endpoints. Ordering matters more than wording here: with the check second, the disabled branch is reachable only by a caller who already holds a live reset token — the mailbox owner, to whom the account's existence is not a secret. Everyone else is turned away one step earlier.
4. **The response-time floor from 0007 extends to all four endpoints.** A uniform body still leaks when one branch returns sooner: an unknown address skips the Redis lookup a disabled account pays for, and every rejection skips the write a success pays for. Issue #137 asked for this decision explicitly; the answer is yes, and for the same reason 0007 gave — a hand-placed pad covers the branches someone remembered.
5. **The security event is awaited, not queued.** FastAPI attaches an endpoint's `BackgroundTasks` to the response the endpoint returns; an `HTTPException` is answered by a fresh response from the exception handler, which carries none. Every task queued on a raising path was therefore discarded — so the events these branches emitted did not, in fact, reach anywhere. That was survivable while the response body still said which branch ran. It is not survivable once the body says nothing, because the log becomes the only record. `reject_verification` and `reject_password_reset` await the call instead. The floor absorbs the latency.
6. **What stays distinct.** JWT decode failures answer `401` before any account is consulted; they describe the caller's own token. Password complexity failures are checked before any lookup. Password-history failures are reachable only with a valid allow-listed token. None of the three is a function of account state.

## Considered options

**Fix only the `"Account is inactive"` string.** The literal reading of #137. Rejected: the surrounding branches already distinguished an unknown address from a known one, so the disabled message was not the whole oracle and removing it alone would not have made the acceptance criterion true.

**Make the reset-confirm endpoints return `200` for a disabled account**, on the argument that any observable failure is a signal. Rejected: it would mean lying to the mailbox owner about whether their password changed, and the ordering change in decision 3 already limits that branch to the mailbox owner.

**Merge `/password-reset/confirm` and `/reset_password`.** They are near-identical handlers, and 0007's argument against duplicated policy applies. Deferred rather than rejected: the enumeration policy they share now lives in one function, which is the part that was drifting. Merging the routes is a separate change with its own client-compatibility question.

## Consequences

- A user who genuinely mistyped a verification link and a user whose account an administrator disabled see the same message and the same recovery route. The second user's real problem — a disabled account — is visible only to an operator reading the audit log. This is the intended trade, and the reason the security events stay distinct.
- Verify-email and both reset-confirm endpoints now take at least `UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS`. These are once-per-account operations; the floor is not on any hot path.
- Reordering the `is_active` check means a disabled account with a live token now consumes the allow-list lookup before being refused. The refusal itself is unchanged.
- A future reader will find four endpoints returning the same string from unrelated branches and may try to make the errors "more helpful". That reversal is the specific thing this ADR and 0007 exist to prevent.
- Decision 5 fixes the discard only for the branches these two helpers own. Every other `background_tasks.add_task(log_security_event, …)` placed before a `raise HTTPException` elsewhere in `auth.py` is still dropped, and `_log_security_event_task` is a stub outside production, so no audit row is written anywhere yet. Both are pre-existing and out of scope here.
