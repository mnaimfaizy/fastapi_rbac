# ADR 0014: A temporary password restricts the account

## Status

Accepted

## Context

`User.needs_to_change_password` was written by admin create and by an admin password set ([#271](https://github.com/mnaimfaizy/fastapi_rbac/issues/271)), cleared by a self-service change or a reset, returned by `serialize_user`, and shown as a badge in the admin UI. Nothing else read it. Login, the `get_current_user` dependency and the SPA routing ignored it, so a user holding a password an administrator chose kept full access to the account ([#273](https://github.com/mnaimfaizy/fastapi_rbac/issues/273)).

That is the state [ADR 0011](./0011-session-security-model.md) decision 4 objects to: a field whose name asserts a control that does not exist. An administrator who hands out a password reasonably expects the user to be made to change it.

Two smaller faults went with it. The `User` model defaulted the flag to `True`, and the create schema inherited that default, so self-registered users were stored flagged too. Admin create set the flag only when `ADMIN_CREATED_USERS_AUTO_VERIFIED` was off, tying password ownership to email verification.

## Decision

1. **The flag is enforced, not deleted.** A user whose `needs_to_change_password` is set holds a **temporary password**. Until they replace it they can change their password, read their own profile, and log out. Nothing else.

2. **Enforcement lives in `get_current_user`, and restriction is the default.** The dependency checks the flag on the `User` row it already loads, before the superuser early return, so superusers are restricted too. A route opts in with `get_current_user(allow_pending_password_change=True)`. Exactly four routes do: `POST /auth/change_password`, `POST /auth/logout`, `POST /auth/logout/all` and `GET /users/me`. A route added later is restricted unless it opts in.

3. **The refusal is a stable contract.** `403` with `detail = {"code": "password_change_required", "message": "Password change required."}`. Clients match on `code`. The message must not contain "token" or "csrf": the SPA's 403 handler treats those words as a CSRF retry or a logout. No security event is recorded for each refused request.

4. **The check reads the database row, not a token claim.** Clearing the flag takes effect on the next request, with no token to reissue.

5. **Login is unchanged.** A flagged user authenticates and receives tokens. The `needs_to_change_password` field already in the login response is the signal.

6. **Only an administrator sets the flag.** Admin create sets it to `True` whatever `ADMIN_CREATED_USERS_AUTO_VERIFIED` says: verification and password ownership are separate. Admin set turns it on. A self-service change or a reset clears it. The `User` model default is `False`.

8. **Every existing flag is cleared when enforcement ships.** The model used to default the flag to `True`, and `IUserCreateFields` inherited that default, so self-registration stored `True` for every user who never changed or reset their password. Nothing on the row tells those users apart from ones an administrator flagged. Migration `2026_11_10_0000` sets the flag to `False` on every row; from the deploy on, only admin create and admin set turn it on. The downgrade changes nothing, since which rows were flagged is not recoverable.

7. **The SPA routes a flagged user to one page.** `ProtectedRoute` sends an authenticated, flagged user from every protected route to `/change-password-required`, a standalone page under `AuthLayout` with the change-password form and a Logout button. The page sends an unflagged user to `/dashboard` and an unauthenticated one to `/login`. The axios interceptor turns a `password_change_required` 403 into a flag on the stored user, without logging out. A successful change stores the user and access token from the `change_password` response and goes to `/dashboard` without asking the user to log in again.

## Considered options

**Put the flag in the access token as a claim.** Rejected: a second source of truth for one property, which ADR 0011 decision 1 forbids. The claim would outlive the change that cleared it until the token expired, and every password path would have to reissue tokens to keep the two in step.

**Refuse login outright for a flagged user.** Rejected: the user already holds the password. Refusing login would force them through a reset flow, by email, for a credential they can type, and an account with no working mailbox could not recover at all.

**Delete the field.** Rejected: an administrator who sets a password expects the user to be made to change it. Deleting the column documents the absence of the control rather than providing it, and ADR 0011 decision 4 is the reason to provide it.

**Keep the stored flags.** Rejected: they were mostly the old default, not an administrator's choice, so every self-registered user who never changed their password would be forced to replace one they chose. The brief for #273 assumed no migration was needed because it read the create schema's default as `False`; only the login schema's is.

**Clear only flags with no admin audit event.** Rejected: admin create is not reliably audited, admin set only since #271, and audit retention varies, so the heuristic would be wrong in both directions.

**Opt routes out of the restriction instead of in.** Rejected: a route added later would be open to a flagged user unless its author remembered the flag. Restriction by default makes forgetting safe.

## Consequences

- No existing user is restricted by the upgrade: decision 8 clears every flag. A temporary password an administrator issued before the upgrade is not enforced, as it never was. To enforce one, set the password again after the upgrade.
- Every admin-created user now has to change their password on first use, including on deployments with auto-verification on, where the flag used to stay off.
- A superuser holding a temporary password cannot administer anything until they change it. Seeded superusers are created with the flag off.
- Non-SPA clients that call a restricted route with a flagged user receive the 403 above and must call `POST /auth/change_password` first.
- Temporary passwords do not expire by time. That, and expiry or rotation of ordinary passwords, are out of scope.
