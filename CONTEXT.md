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

**Pending user**:
A user that exists but has not completed email verification.
_Avoid_: Unverified account, pending account, unconfirmed user

**Established user**:
A verified, active user.
_Avoid_: Verified account, confirmed user

**Disabled user**:
A user an administrator has deactivated, regardless of verification state.
_Avoid_: Inactive account, banned user, locked user (locking is the separate, temporary failed-attempt state)

**Uniform registration response**:
The invariant that registration and resend-verification return one fixed response for every email address, so neither confirms nor denies that a user exists.
_Avoid_: Generic error, anti-enumeration

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

**Hub runtime**:
The deployable API package: published Docker Hub backend and worker images (including the Beat scheduler process), plus Postgres, Redis, and external SMTP. Does not include the admin UI. Default topology is one Compose host; an optional split uses separate Always Free VMs and hobby managed Postgres/Redis.
_Avoid_: Microservices (when meaning this package), full stack (when including the React frontend)

**Hub runtime split**:
Optional Hub runtime topology: Oracle Always Free AMD micro for Caddy+API, a second micro for Celery worker+Beat (stop when idle), and free hobby Neon Postgres + Upstash Redis via env. Alternative to single-VM Compose.
_Avoid_: Microservices (when meaning this topology), full stack

**Admin UI host**:
The deployable admin UI package: a static SPA build served from a static host (maintainer dogfood: cPanel at `rbac.mnfprofile.com`), calling the Hub runtime API cross-origin. Does not include the Hub runtime.
_Avoid_: Hub runtime (when meaning the UI), frontend container (when meaning the static host path), full stack
