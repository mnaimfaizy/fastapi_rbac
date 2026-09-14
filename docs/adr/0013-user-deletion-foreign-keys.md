# ADR 0013: User deletion foreign-key policy

## Status

Accepted

## Context

`DELETE /api/v1/users/{id}` returned 500 for any user who had changed their password. `UserPasswordHistory.user_id` (and every other foreign key pointing at `User`) was `NO ACTION`, so the delete reached the database as an `IntegrityError` and the generic handler turned it into `{"detail": "Database error"}`.

That is a family, not a single row. The seven references are:

| Table | Column | Meaning |
| --- | --- | --- |
| `UserPasswordHistory` | `user_id` | Passwords the user used to have |
| `UserRole` | `user_id` | Roles currently assigned |
| `AuditLog` | `actor_id` | Who performed a security event |
| `AuditLog` | `created_by_id` | Row provenance |
| `Permission` | `created_by_id` | Who created the permission |
| `PermissionGroup` | `created_by_id` | Who created the group |
| `Role` | `created_by_id` | Who created the role |
| `RoleGroup` | `created_by_id` | Who created the group |

`remove_user` already refused assigned roles with 409. The other references had no equivalent, so they failed as 500. A generic `IntegrityError` → 409 handler would stop the 500 without saying which reference blocked the delete; it is a safety net, not the policy.

The references do not share one answer. Password history is meaningless without the user. Assigned roles are a caller mistake that can be undone. Audit events are a compliance record and must outlive the account. RBAC artifacts outlive their creator.

## Decision

1. **`UserPasswordHistory.user_id` cascades.** The rows belong to the user. Deleting the user deletes the history. Schema `ON DELETE CASCADE` and `CRUDUser.remove` both delete the rows so application and database agree.

2. **`UserRole.user_id` is `ON DELETE RESTRICT` and is refused with 409.** The existing message stands: remove the roles first. The check lives in `CRUDUser.remove` (counting `UserRole` rows, not a possibly stale `user.roles` collection) so every deletion path sees it, including callers that skip the endpoint. The constraint is the schema twin of that refusal.

3. **`AuditLog.actor_id` keeps the UUID and drops the foreign key.** Nulling the actor rewrites the trail ("unknown did this"). Cascading the row destroys it. Refusing the delete because of audit rows would block exactly the accounts an operator most wants to remove. Retaining the id without a constraint preserves who acted after the user is gone. This is a compliance choice, not a schema preference.

4. **`created_by_id` on `Permission`, `PermissionGroup`, `Role`, `RoleGroup`, and `AuditLog` is `ON DELETE SET NULL`.** Those artifacts outlive their creator; the columns were already nullable. Application code nulls the same columns before deleting the user.

5. **Application and schema must agree.** `CRUDUser.remove` does not depend on the database to enforce the policy. The models declare the same `ondelete` values so a future `alembic revision --autogenerate` cannot revert them. An `IntegrityError` during the final delete is translated to 409 as a safety net for a reference this policy does not yet know about.

6. **Soft delete is out of scope.** Deactivation as an alternative to deletion is a different design.

## Consequences

Deleting a user who has changed their password succeeds. Deleting a user who created roles, permissions, or groups succeeds and leaves those rows with `created_by_id = NULL`. Deleting a user who appears in the audit log succeeds and leaves the log row with the original `actor_id`. Deleting a user who still has roles continues to 409.

Pending-account cleanup (`unverified_cleanup`) uses the same `clear_user_delete_references` helper for history and creator FKs. It still deletes `UserRole` rows itself: that sweep is allowed to remove a pending user who has roles, which admin delete is not.

## Alternatives considered

**`ON DELETE SET NULL` for `AuditLog.actor_id`.** Rejected: it preserves the row but erases who acted, which is the fact the log exists to record.

**Refuse deletion while audit rows exist.** Rejected: it makes the most-used admin accounts undeletable.

**Cascade the audit log with the user.** Rejected: deleting an audit trail on user deletion defeats its purpose.

**A generic IntegrityError handler as the only fix.** Rejected: it stops the 500 without deciding per-table behaviour, which is how this became a 500 rather than a 409 in the first place.

## References

- Issue [#238](https://github.com/mnaimfaizy/fastapi_rbac/issues/238) — deleting a user with password history returns 500
- `backend/app/crud/user_crud.py` — `CRUDUser.remove` and `clear_user_delete_references`
- `backend/alembic/versions/2026_09_09_0000_user_delete_foreign_keys.py`
