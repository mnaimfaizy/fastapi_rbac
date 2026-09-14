# slowapi as the sole HTTP rate limit library; keep Redis abuse counters

_Renumbered from 0002, which collided with [0002-docker-publish-job-dag](./0002-docker-publish-job-dag.md); that one was added first and kept the number._

## Status

Accepted

## Context

Auth carried two overlapping stacks: scaffold `fastapi-limiter` (Redis `FastAPILimiter` init in lifespan, never applied to routes) and `slowapi` (live `@limiter.limit` on auth endpoints, default in-memory storage). We consolidated on **slowapi only**, removed `fastapi-limiter`, unified on one shared `Limiter` in `app/core/rate_limit.py`, and use Redis `storage_uri` from `service_settings.redis_url` outside testing so HTTP rate limits are shared across workers. Hand-rolled Redis **abuse counters** for registration/resend-verification stay as a separate control. Dual libraries and a phantom Redis limiter path were higher risk than keeping the already-enforcing slowapi stack; folding abuse counters into slowapi remains a follow-up, not part of this change.

The shared limiter originally keyed every request by client address. Users behind a shared NAT then competed for one quota, and an authenticated account could rotate addresses to evade limits. Issue [#100](https://github.com/mnaimfaizy/fastapi_rbac/issues/100) asked to key by authenticated user when the request already has one. [ADR 0011](./0011-session-security-model.md) decision 8 / [#203](https://github.com/mnaimfaizy/fastapi_rbac/issues/203) had to land first, so the address fallback is a real per-client bucket rather than the proxy's address.

## Decision

1. **slowapi is the only HTTP rate limit library.** Unused `fastapi-limiter` init is not restored. Abuse counters stay separate.
2. **The shared limiter's `key_func` (`rate_limit_key`) is the single place the key is chosen.** It returns `user:{id}` when the request already carries an authenticated identity, and `ip:{client address}` otherwise. The prefixes keep a user identifier and a raw address from producing the same string.
3. **Identity comes from already-established authentication state.** `get_current_user` records the user on `request.state` after the existing token and allowlist checks succeed. The key function reads that attribute; it does not decode or validate tokens. A Bearer header with no established identity is treated as anonymous.
4. **The address fallback uses the same client-address reader as the rest of the application** (`get_client_ip`, corrected by `ProxyHeadersMiddleware` for `TRUSTED_PROXIES` members). A second notion of client address is how rate limiting, the audit trail, and origin-network detection would drift apart.
5. **Existing limit strings stay as they are.** Anonymous auth endpoints (login, access-token, register, password-reset request) do not call `get_current_user`, so they remain address-keyed at `5/minute` / `3/hour`.
6. **Redis `storage_uri` is unchanged.** Workers share whatever keys `rate_limit_key` returns.

## Consequences

- Users behind a shared NAT no longer share one HTTP rate-limit quota once they are authenticated.
- An abusive authenticated account cannot reset its quota by rotating addresses.
- Changing the key namespace resets in-flight Redis buckets once (a one-time cutover).
- Route-level `@limiter.limit` runs after FastAPI dependencies, which is what makes established identity visible to the key function. Default limits applied by `SlowAPIMiddleware` would not see it; this project does not set default limits.

## Smoke (manual)

With the API up (non-testing mode), burst six `POST /api/v1/auth/access-token` form requests from the same client within one minute. Expect **HTTP 429**, JSON `status: "error"`, `message: "Rate limit exceeded"`, error code `rate_limit`, and slowapi rate-limit response headers when injected (`X-RateLimit-*` / `Retry-After` as applicable).
