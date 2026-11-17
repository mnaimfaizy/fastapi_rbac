# ADR 0015: Uniform login failure

## Status

Accepted

## Context

[ADR 0007](0007-uniform-registration-response.md) and [ADR 0010](0010-uniform-token-flow-rejection.md) made registration, resend-verification, verify-email and password reset answer the same way whatever the account's state, and take the same time. The two password login routes, `POST /auth/login` (JSON, the SPA) and `POST /auth/access-token` (OAuth2 form, Swagger), did neither.

A failed login was worded for the state the route found. An unknown address got a plain message. An existing account got the same message plus a lockout countdown. A locked account got a message with the time left on the lock, and on the form route a different status (400 instead of 422). An unknown address also skipped the bcrypt check every known one paid for, so it answered sooner. The form route's countdown assumed 3 attempts while the limit is `MAX_LOGIN_ATTEMPTS` (5 by default), and both routes turned the success message into a "last attempt" warning when the account was one failure short of a lock.

Configuration had the same kind of drift. Beside `MAX_LOGIN_ATTEMPTS` and `ACCOUNT_LOCKOUT_MINUTES`, which govern the lock ([#275](https://github.com/mnaimfaizy/fastapi_rbac/issues/275)), Settings and the example env files carried `LOCKOUT_DURATION_MINUTES`, `ACCOUNT_LOCKOUT_DURATION` and an `ENABLE_ACCOUNT_LOCKOUT` switch. No code read any of the three.

## Decision

1. **One refusal for every failure that does not prove the password.** An unknown address, a wrong password in any account state (verified, unverified, inactive, locked), an account with no password set, and any attempt on a locked account all return `422` with the same body:

   ```json
   {"detail": {"field_name": "email", "message": "Email or password is incorrect, or the account is temporarily locked. Try again later or reset your password."}}
   ```

   Both routes return it. It comes from `refuse_login()` in `app/utils/login_refusal.py`, so a branch added later has no wording to invent. Which failure it was is recorded as a security event, as in 0007 and 0010. The message names every condition it covers so it is true for each of them, the same approach as the password-reset request message.

2. **422, not 401.** The SPA's response interceptor treats a 401 as an expired session and tries a refresh, then logs out. The login form already shows a 422's `detail.message`. Keeping 422 keeps both clients working without a special case for the login URL.

3. **Only a correct password learns the account's state.** With the right password, an unverified account gets `422 "Email is not verified."` and an inactive one `403 "Inactive user"`, as before. Only the password holder can reach them.

4. **A locked account is not told apart, even with the right password.** Revealing the lock to a correct password tells the owner nothing new, but it tells a guesser that the guess was right: the lock would stop counting guesses and start confirming them. So a locked account is refused before its hash is consulted. The lock is neither lifted nor reset, the attempt count does not change, and no session is opened. The owner learns from the message that a lock is possible, and a password reset lifts it (`password_policy` clears the lock on every password change).

5. **Lockout counting is unchanged.** `crud.user.authenticate` still counts each wrong password and locks at `MAX_LOGIN_ATTEMPTS` for `ACCOUNT_LOCKOUT_MINUTES`. An expired lock is lifted on the next attempt. No response reports a count or a time.

6. **Timing.** Both routes run inside `response_time_floor()`, the floor from 0007 and 0010. The paths that have no hash worth checking (an unknown address, no password set, a locked account) call `spend_password_check()`, which runs one bcrypt check against a hash generated at import from a random secret. No hash is committed, and every failure path pays for one bcrypt check.

7. **The unread lockout settings are removed.** `LOCKOUT_DURATION_MINUTES`, `ACCOUNT_LOCKOUT_DURATION` and `ENABLE_ACCOUNT_LOCKOUT` are gone from Settings and the example env files. Settings uses `extra="ignore"`, so an environment that still sets them starts normally and the values are unused, as with `REFRESH_TOKEN_EXPIRE_DAYS` (#274). Lockout cannot be switched off. It never could; the switch only said it could.

## Considered options

**Reveal the lock after a correct password.** Better for the owner, who would see why a right password failed. Rejected for the reason in decision 4. The uniform message mentions the lock and the reset instead.

**401 for the refusal.** The conventional status for bad credentials. Rejected for the SPA reason in decision 2. Changing it would also break any API client that already handles the 422.

**Keep the countdown and show it to everyone, including unknown addresses.** A fake countdown for an unknown address would have to track attempts per unknown address to stay consistent, and it would still go wrong when the real account locks. Rejected as more state for a worse property.

## Consequences

- API clients must not rely on the countdown, the lock duration or the locked-account messages, nor on `400` from `/access-token` for a locked account. This is a breaking change.
- A user who mistypes a password, a user whose account is locked, and a caller trying an address with no account all see the same message. Operators tell them apart in the audit log (`failed_login`, `oauth2_failed_login`, `locked_account_attempt`, `oauth2_locked_account_attempt`).
- Every login, including a successful one, takes at least `UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS` (0.5 s by default). Each process spends one bcrypt hash at import to build the dummy hash.
- The rate limit (5 per minute per IP on each route) and the lockout remain the brute-force controls. Neither is changed here.
- A future reader may try to make login errors "more helpful". That reversal is what this ADR, 0007 and 0010 exist to prevent.
