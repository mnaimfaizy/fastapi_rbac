# slowapi as the sole HTTP rate limit library; keep Redis abuse counters

Auth carried two overlapping stacks: scaffold `fastapi-limiter` (Redis `FastAPILimiter` init in lifespan, never applied to routes) and `slowapi` (live `@limiter.limit` on auth endpoints, default in-memory storage). We consolidated on **slowapi only**, removed `fastapi-limiter`, unified on one shared `Limiter` in `app/core/rate_limit.py`, and use Redis `storage_uri` from `service_settings.redis_url` outside testing so HTTP rate limits are shared across workers. Hand-rolled Redis **abuse counters** for registration/resend-verification stay as a separate control. Dual libraries and a phantom Redis limiter path were higher risk than keeping the already-enforcing slowapi stack; folding abuse counters into slowapi remains a follow-up, not part of this change.

## Smoke (manual)

With the API up (non-testing mode), burst six `POST /api/v1/auth/access-token` form requests from the same client within one minute. Expect **HTTP 429**, JSON `status: "error"`, `message: "Rate limit exceeded"`, error code `rate_limit`, and slowapi rate-limit response headers when injected (`X-RateLimit-*` / `Retry-After` as applicable).
