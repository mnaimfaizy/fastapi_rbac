# ADR 0007: Uniform registration response

## Status

Accepted

## Context

Registration answered a duplicate email with `400 "Unable to process registration request."` — deliberately vague, padded with a fixed sleep to equalise timing, to avoid confirming that an account exists. Issue [#113](https://github.com/mnaimfaizy/fastapi_rbac/issues/113) reported the resulting UX as broken: the message explains nothing, offers no recovery, and a user whose verification email never arrived hits it on every retry.

Triage found the mitigation did not actually hold. Resend-verification answered `"This email is already verified."` for an established user and a generic message for an unknown one, so any verified user's existence was confirmable in a single request. Registration was paying the full UX cost of a property the system did not have. The two endpoints implemented the same policy independently and drifted apart — the drift *is* the defect.

Two failure modes hid behind the same message. A verification email that fails to send is rolled back and the user deleted, so it self-heals. A verification email that sends but never lands leaves a pending user that nothing clears — the cleanup task is an in-process sleep that does not survive a restart ([#136](https://github.com/mnaimfaizy/fastapi_rbac/issues/136)) — so registration is permanently blocked for that address with no route to the resend flow, which is linked from the success and verify pages but not from the error.

## Decision

1. **One response for every address.** Registration returns `200` with a null data payload whether the address is new, a pending user, an established user, or a disabled user. Resend-verification likewise returns one fixed response for all four. Neither confirms nor denies that a user exists.
2. **State selects the email, not the response.** Registration creates only when no user exists. A pending user is sent a fresh verification email; an established or disabled user is sent a **notice email** — a new template stating that an account already exists, with login and password-reset links. Resend behaves identically except that it never creates.
3. **An address with no user receives nothing** from resend. Emailing it was rejected: it would make the endpoint an open relay for unsolicited signup mail to arbitrary addresses. Nobody is waiting on mail at an address we hold no user for, so the honesty argument that justifies the notice email does not extend here.
4. **Re-registration never mutates a pending user** — not the password, not the name fields. Otherwise an attacker re-registers against a victim's unverified address with their own password, and the victim activates an attacker-controlled account by clicking the link in their own inbox. The cost is that a mistyped password cannot be fixed by re-registering; the user verifies and resets instead.
5. **One abuse counter for dispatched email**, keyed on the address and scoped to the action rather than the endpoint. Both email kinds increment it. Counting only verification emails would make the presence of a `429` after three attempts reveal whether the address is a pending user — the oracle would simply move into the rate limiter. The IP-scoped registration counter stays separate; it tracks the requester, not the target.
6. **Timing is equalised by a constant response-time floor** on both endpoints, replacing the sleep placed on selected branches. A hand-placed pad is what went stale here.
7. **The property is enforced in one shared operation** that both endpoints call, differing only in whether creating an absent user is permitted.
8. **Client affordance is unconditional.** The register form carries a resend-verification link on first paint. It must not appear or change in response to a failed registration: an element rendered only on the duplicate branch is the same oracle as the old error string.

## Considered options

**State the truth plainly** — "this email is already registered". Simplest and best UX, and defensible given the oracle already existed via resend. Rejected because the cheaper fix was to close resend's leak rather than widen registration's, and because the reporter's stuck-account case is solved better by reissuing the email than by telling the user to go find the resend page.

**Keep the `400` and fix only the frontend.** Rejected: it leaves recovery as a second manual action the user must notice, and an established user who forgot they had an account still gets a wall.

## Consequences

- Registration reports success for an address it did not register. This is only honest because every path dispatches an email — the notice email is not optional decoration, it is what makes the response true.
- A future reader will find registration returning `200` for a duplicate and may try to "fix" it. That reversal is the specific thing this ADR exists to prevent.
- Registration's response body no longer carries the created user. The client already discarded it.
- Reissuing replaces the previous verification token, so older links stop working; they land on the verify page, which offers resend.
- The narrow `"Account is inactive"` oracle in verify-email and password reset was left open here and closed by [#137](https://github.com/mnaimfaizy/fastapi_rbac/issues/137), which extends this decision to the token-bearing flows — see [ADR 0010](0010-uniform-token-flow-rejection.md). The every-verified-user oracle is what this ADR closes.
- Vocabulary for the three user states is recorded in `CONTEXT.md`; the code previously tested `verified` and `is_active` inline at each site with no shared name, which enabled the drift.
