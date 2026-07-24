# FastAPI RBAC

Role-based access control API and admin UI: users, roles, permissions, and auth session controls.

## Language

**HTTP rate limit**:
A coarse request quota enforced by the shared slowapi limiter on selected HTTP routes (keyed by client IP today).
_Avoid_: Rate limiting (when referring only to this mechanism), fastapi-limiter, DoS middleware

**Abuse counter**:
A hand-rolled Redis incr/expire guard used for registration and resend-verification abuse (IP and/or email keys), independent of the HTTP rate limit library.
_Avoid_: Rate limiting (when referring only to this mechanism), slowapi limit

**User**:
An account principal that authenticates and is assigned roles.
_Avoid_: Account (when meaning the auth principal), client

**Role**:
A named set of permissions assignable to users.
_Avoid_: Group (when meaning a role)

**Permission**:
An authorization atom granted via roles (and related grouping constructs).
_Avoid_: Entitlement, capability

**Role group**:
A grouping construct for roles in this product's RBAC model.

**Permission group**:
A grouping construct for permissions in this product's RBAC model.
