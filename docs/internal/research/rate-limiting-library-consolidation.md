# Rate-Limiting Library Consolidation Research

**Date:** 2026-07-24
**Scope:** Issue [#64](https://github.com/mnaimfaizy/fastapi_rbac/issues/64) — consolidate `fastapi-limiter` vs `slowapi` in `mnaimfaizy/fastapi_rbac`
**Sources:** Primary only — upstream READMEs, PyPI metadata, GitHub compare/API, `limits` / PyrateLimiter docs, and this repo’s git history + internal docs.
**Status (post-#64):** Decision implemented — **slowapi only**; `fastapi-limiter` removed. See [ADR 0008](../../adr/0008-slowapi-sole-http-rate-limit.md). Sections below describe the pre-change investigation unless marked otherwise.

---

## Executive summary

**Before #64:** This repo carried **two rate-limiting libraries**. **`slowapi`** was the only one that **enforced limits on routes** (four auth endpoints via `@limiter.limit`). **`fastapi-limiter` 0.1.6** was **init-only**: `FastAPILimiter.init/close` ran in lifespan but **no route used `RateLimiter`**.

Historical reason: `fastapi-limiter` shipped with the original project scaffold (Apr 2025); `slowapi` was added later (Jun 2025) as an explicit P0 security item without removing the scaffold wiring.

**Recommendation for #64:** Keep **slowapi**, remove **fastapi-limiter**, and **configure slowapi with Redis `storage_uri`** so limits are shared across Gunicorn/Uvicorn workers. Optionally fold bespoke Redis counters in `auth.py` (registration / resend-verification) into slowapi limits in a follow-up.

---

## Feature comparison

| Dimension | fastapi-limiter **0.1.6** (pinned) | fastapi-limiter **0.2.0** (latest) | slowapi **0.1.10** (repo pin) |
|-----------|--------------------------------------|-------------------------------------|-------------------------------|
| **Underlying engine** | Redis Lua script via `redis` ([0.1.6 README](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md)) | [PyrateLimiter](https://github.com/vutran1710/PyrateLimiter) (`pyrate-limiter>=3.9.0`) ([0.2.0 `pyproject.toml`](https://github.com/long2ice/fastapi-limiter/blob/v0.2.0/pyproject.toml), [master README](https://github.com/long2ice/fastapi-limiter/blob/master/README.md)) | [limits](https://limits.readthedocs.io/en/stable/) ([slowapi README](https://github.com/laurentS/slowapi/blob/master/README.md)) |
| **Storage backends** | **Redis required** ([0.1.6 README](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md)) | In-memory default via PyrateLimiter; optional Redis/SQLite/Postgres/multiprocessing ([PyrateLimiter README](https://github.com/vutran1710/PyrateLimiter/blob/master/README.md)) | Memory (default/fallback), Redis, Memcached, MongoDB, Valkey, Redis Cluster/Sentinel/SSL ([limits storage](https://limits.readthedocs.io/en/stable/storage.html), [slowapi README](https://github.com/laurentS/slowapi/blob/master/README.md)) |
| **API style** | `await FastAPILimiter.init(redis)` + `Depends(RateLimiter(times=…, seconds=…))` ([0.1.6 README](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md)) | `Depends(RateLimiter(limiter=Limiter(Rate(…))))` — **no** `FastAPILimiter.init` ([master README](https://github.com/long2ice/fastapi-limiter/blob/master/README.md)) | `@limiter.limit("5/minute")` on routes; `Request` param required ([slowapi docs](https://slowapi.readthedocs.io/en/latest/)) |
| **Middleware vs deps** | Dependency-first; optional `RateLimiterMiddleware` in 0.2 ([master README](https://github.com/long2ice/fastapi-limiter/blob/master/README.md)) | Same | Decorator + `SlowAPIMiddleware` / `SlowAPIASGIMiddleware` ([examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md), [middleware source](https://github.com/laurentS/slowapi/blob/master/slowapi/middleware.py)) |
| **Multi-worker / distributed** | **Yes** when Redis init is used (0.1.x) | **Only if** PyrateLimiter bucket uses Redis/Postgres/etc.; default in-memory is **per-process** ([PyrateLimiter backends table](https://github.com/vutran1710/PyrateLimiter/blob/master/README.md)) | **Only with** `storage_uri` (e.g. `redis://…`); default in-memory is **per-process** ([slowapi examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md)) |
| **Redis integration** | Native, mandatory in 0.1.x | Opt-in via PyrateLimiter `RedisBucket` | `Limiter(..., storage_uri="redis://host:port/n")` ([slowapi examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md)) |
| **WebSocket support** | Yes (`WebSocketRateLimiter`) ([0.1.6 README](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md)) | Yes ([master README](https://github.com/long2ice/fastapi-limiter/blob/master/README.md)) | **Not supported** ([slowapi docs](https://slowapi.readthedocs.io/en/latest/)) |
| **Shared limits / global default** | Multiple `RateLimiter` deps per route | Same + `skip_limiter` / `skip` callable (0.2) | `default_limits`, `shared_limit`, `@limiter.exempt` ([slowapi examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md)) |
| **Maintenance / activity** | Last release **0.2.0** 2026-02-06 ([PyPI](https://pypi.org/project/fastapi-limiter/)); GitHub pushed 2026-02-06 ([API](https://api.github.com/repos/long2ice/fastapi-limiter)) | Same | Last release **0.1.10** 2026-06-13 ([PyPI](https://pypi.org/project/slowapi/)); GitHub pushed **2026-07-23** ([API](https://api.github.com/repos/laurentS/slowapi)) |
| **GitHub stars / issues** | **789** stars, **31** open issues ([API](https://api.github.com/repos/long2ice/fastapi-limiter)) | Same repo | **2,037** stars, **98** open issues ([API](https://api.github.com/repos/laurentS/slowapi)) |
| **Engine stars** | N/A (embedded Redis script) | PyrateLimiter **512** stars ([API](https://api.github.com/repos/vutran1710/PyrateLimiter)) | `limits` — mature, used by Flask-Limiter ecosystem ([limits docs](https://limits.readthedocs.io/en/stable/)) |

---

## fastapi-limiter 0.2.0 breaking changes (vs 0.1.6)

Primary evidence: [GitHub compare `v0.1.6...v0.2.0`](https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...v0.2.0), [0.1.6 vs master README](https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...master), [PyPI 0.1.6 vs 0.2.0 metadata](https://pypi.org/pypi/fastapi-limiter/json).

| Breaking change | Detail | Source |
|-----------------|--------|--------|
| **Removes `FastAPILimiter` class** | `fastapi_limiter/__init__.py` drops ~89 lines including `FastAPILimiter.init/close` | [compare](https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...v0.2.0) — commit `ae102cf` |
| **Redis no longer built-in** | 0.1.6 depends on `redis`; 0.2.0 depends on `pyrate-limiter>=3.9.0` only | [0.1.6 `pyproject.toml`](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/pyproject.toml), [0.2.0 `pyproject.toml`](https://github.com/long2ice/fastapi-limiter/blob/v0.2.0/pyproject.toml) |
| **`RateLimiter` API rewrite** | Was `RateLimiter(times=2, seconds=5)`; now `RateLimiter(limiter=Limiter(Rate(2, Duration.SECOND * 5)))` | [0.1.6 README](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md), [master README](https://github.com/long2ice/fastapi-limiter/blob/master/README.md) |
| **Startup pattern change** | 0.1.x: `await FastAPILimiter.init(redis_connection)` on startup; 0.2.x: no global init — configure `Limiter`/`RateLimiter` per route or use middleware | [0.1.6 README](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md), [master README](https://github.com/long2ice/fastapi-limiter/blob/master/README.md) |
| **Lifespan / `@on_event` migration** | Compare includes `use lifespan` commit replacing deprecated `on_event` | [compare commits](https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...v0.2.0) |
| **CHANGELOG removed at 0.2.0 tag** | `CHANGELOG.md` deleted in 0.2.0 tree; 0.1.6 changelog documents earlier 0.1.x breaks only | [compare](https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...v0.2.0), [0.1.6 CHANGELOG](https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/CHANGELOG.md) |

This repo explicitly deferred 0.2.0 for that rewrite: [`docs/development/DEPENDENCY_UPGRADES.md`](../../development/DEPENDENCY_UPGRADES.md) — *“Kept `0.1.6` — `0.2.0` is a breaking rewrite (drops Redis `FastAPILimiter`)”*.

---

## What this repo uses today

### Dependencies (`backend/requirements.txt`)

| Package | Version | Role |
|---------|---------|------|
| `fastapi-limiter` | `0.1.6` | Declared; **no route enforcement** |
| `slowapi` | `0.1.10` | **Active route limits** |

### fastapi-limiter — **init only**

| Location | Usage |
|----------|--------|
| `backend/app/main.py` | `from fastapi_limiter import FastAPILimiter`; `await FastAPILimiter.init(redis_client, identifier=user_id_identifier)` and `await FastAPILimiter.close()` in lifespan |
| `backend/app/main.py` | Custom `user_id_identifier()` (Bearer `sub`, WebSocket path, `X-Forwarded-For`, IP+path) — **only passed to `FastAPILimiter.init`, unused elsewhere** |

**Grep result:** No `RateLimiter`, `Depends(RateLimiter`, or `@limiter` from fastapi-limiter anywhere under `backend/`.

### slowapi — **enforces limits**

| Location | Usage |
|----------|--------|
| `backend/app/main.py` | `Limiter(key_func=get_remote_address)` → `fastapi_app.state.limiter`; `SlowAPIMiddleware`; duplicate `RateLimitExceeded` handlers (lines ~346 and ~494) |
| `backend/app/api/v1/endpoints/auth.py` | **Separate** module-level `Limiter(key_func=get_remote_address)` (to avoid circular imports per commit `7b115d6`) |

**Routes with `@limiter.limit` (auth.py limiter instance):**

| Route | Limit |
|-------|-------|
| `POST /login` | `5/minute` |
| `POST /register` | `3/hour` |
| `POST /access-token` | `5/minute` |
| `POST /password-reset/request` | `3/hour` |

**Not slowapi — additional Redis counters in `auth.py`:**

- Registration: IP + email counters (`registration_rate_limit:ip:…`, `registration_rate_limit:email:…`) — **Redis-backed**, stricter than decorator alone ([`auth.py`](../../../backend/app/api/v1/endpoints/auth.py) ~424–597).
- Resend verification: `resend_verification_rate_limit:…` — **Redis-backed** (~866–959).

### Multi-worker risk (current slowapi wiring)

Neither `main.py` nor `auth.py` passes `storage_uri` to `Limiter(...)`. Per [slowapi examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md), Redis requires explicit configuration; without it, **limits uses in-memory storage per process** ([slowapi README](https://github.com/laurentS/slowapi/blob/master/README.md) — *“memory as a fallback”*).

Production runs Gunicorn + Uvicorn workers ([`docs/internal/ANALYSIS_FINDINGS.md`](../ANALYSIS_FINDINGS.md) — connection pooling / workers). **Per-worker memory limits multiply effective quota** (e.g. 5/minute × N workers).

Additionally, **two `Limiter` instances** exist (`main.py` vs `auth.py`). [SlowAPI middleware](https://github.com/laurentS/slowapi/blob/master/slowapi/middleware.py) reads `app.state.limiter` (main’s instance) and exempts routes registered on *that* limiter’s `_route_limits`. Auth decorators register on **auth’s limiter**, so middleware and decorators may not share state — limits still run via decorator path but remain **in-memory on the auth limiter instance**.

---

## Why both were introduced (git + docs)

| When | What | Evidence |
|------|------|----------|
| **2025-04-25** | Initial scaffold adds `fastapi-limiter>=0.1.6,<0.2.0` and `FastAPILimiter.init/close` in lifespan | Commit `47627b4` — *“Add initial project configuration and dependencies”*; `75c0586` — *“Initialize FastAPI RBAC project structure with Docker support”* |
| **2025-06-03** | **slowapi** added for P0 rate limiting on auth; **fastapi-limiter not removed** | Commit `7b115d6` — *“feat: restore P0 Item #2 - Rate Limiting implementation”* (adds `slowapi==0.1.9`, `SlowAPIMiddleware`, `@limiter.limit` on auth routes) |
| **2025-06-11** | Docs describe slowapi as the completed rate-limiting story | [`docs/internal/ANALYSIS_FINDINGS.md`](../ANALYSIS_FINDINGS.md) — slowapi on login/register/access-token/password-reset |
| **2026-07-16** | Dependency policy freezes `fastapi-limiter` at 0.1.6 | [`docs/development/DEPENDENCY_UPGRADES.md`](../../development/DEPENDENCY_UPGRADES.md) Lane 2 CVE snapshot |
| **2026-07-24** | Consolidation tracked as #64 | [Issue #64](https://github.com/mnaimfaizy/fastapi_rbac/issues/64) |

**Interpretation:** `fastapi-limiter` came from the **original FastAPI RBAC template** (Redis cache/limit stack). `slowapi` was a **later, deliberate security addition** documented as production-ready, but the scaffold’s `FastAPILimiter` lifespan hook was never deleted and **no route was ever migrated to `RateLimiter`**.

---

## Recommendation for #64

### Preferred path: **Keep slowapi, remove fastapi-limiter**

Aligns with [#64 default](https://github.com/mnaimfaizy/fastapi_rbac/issues/64), current route usage, and [`DEPENDENCY_UPGRADES.md`](../../development/DEPENDENCY_UPGRADES.md) hard-stop note on middleware.

**Implementation checklist:**

1. Remove `fastapi-limiter` from `requirements.txt`.
2. Remove `FastAPILimiter` import, `init/close`, and `user_id_identifier` from lifespan (keep Redis for cache, tokens, bespoke counters).
3. **Single shared `Limiter`** on `app.state.limiter`; inject into auth router or import from a small `app/core/limiter.py` — eliminate duplicate instance in `auth.py`.
4. **Configure Redis storage** for production, reusing existing Redis URL/settings:
   ```python
   limiter = Limiter(
       key_func=get_remote_address,
       storage_uri=settings.REDIS_URL,  # align with app Redis config
   )
   ```
   ([slowapi Redis example](https://github.com/laurentS/slowapi/blob/master/docs/examples.md))
5. Consider `SlowAPIASGIMiddleware` vs `SlowAPIMiddleware` ([examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md)) — optional perf/middleware deprecation note from Starlette.
6. Deduplicate duplicate `RateLimitExceeded` handlers in `main.py`.
7. Update tests (`test_rate_limiting_on_login`, etc.) to assert 429 with Redis-backed limiter in CI (Redis service already in CI per [`ANALYSIS_FINDINGS.md`](../ANALYSIS_FINDINGS.md)).
8. Update [`DEPENDENCY_UPGRADES.md`](../../development/DEPENDENCY_UPGRADES.md) — remove “kept 0.1.6” debt; document slowapi + Redis as the single stack.

### Alternative (not recommended unless new requirements appear)

**Upgrade to fastapi-limiter 0.2.x and remove slowapi** — only if you need its 0.2 middleware/websocket model and accept a full rewrite of all `@limiter.limit` call sites plus PyrateLimiter backend wiring for Redis. Higher migration cost for no clear gain given slowapi already owns auth routes.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **slowapi default in-memory with multiple workers** | **High** | Set `storage_uri` to Redis before/while removing fastapi-limiter ([slowapi examples](https://github.com/laurentS/slowapi/blob/master/docs/examples.md), [limits Redis URI](https://limits.readthedocs.io/en/stable/storage.html)) |
| **Duplicate `Limiter` instances** | **Medium** | Consolidate to `app.state.limiter` used by all `@limiter.limit` decorators |
| **Dual enforcement layers on register/resend** | **Low** | slowapi decorator + bespoke Redis counters — document both; optionally merge into slowapi `key_func` or separate limits later |
| **slowapi websocket gap** | **Low** | No websocket routes use limiters today; use PyrateLimiter/fastapi-limiter 0.2 or custom logic if added |
| **slowapi docs still say “alpha”** | **Low** | README also states production use at scale ([slowapi README](https://github.com/laurentS/slowapi/blob/master/README.md)); treat as doc drift |
| **Removing fastapi-limiter while keeping Redis init assumptions** | **Low** | Redis remains required for tokens/cache/counters — only drop unused limiter init |
| **fastapi-limiter 0.2 migration if chosen instead** | **High** | Full API rewrite; no drop-in from 0.1.6 ([compare](https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...v0.2.0)) |

---

## References

### fastapi-limiter

- Repository: https://github.com/long2ice/fastapi-limiter
- README (0.2 / master): https://github.com/long2ice/fastapi-limiter/blob/master/README.md
- README (0.1.6): https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/README.md
- Compare 0.1.6 → 0.2.0: https://github.com/long2ice/fastapi-limiter/compare/v0.1.6...v0.2.0
- CHANGELOG (0.1.x): https://github.com/long2ice/fastapi-limiter/blob/v0.1.6/CHANGELOG.md
- PyPI: https://pypi.org/project/fastapi-limiter/
- GitHub API (stars/activity): https://api.github.com/repos/long2ice/fastapi-limiter

### slowapi

- Repository: https://github.com/laurentS/slowapi
- Documentation: https://slowapi.readthedocs.io/en/latest/
- Examples (Redis, middleware): https://github.com/laurentS/slowapi/blob/master/docs/examples.md
- Middleware source: https://github.com/laurentS/slowapi/blob/master/slowapi/middleware.py
- PyPI: https://pypi.org/project/slowapi/
- GitHub API: https://api.github.com/repos/laurentS/slowapi

### Underlying engines

- limits: https://limits.readthedocs.io/en/stable/
- limits storage backends: https://limits.readthedocs.io/en/stable/storage.html
- PyrateLimiter: https://github.com/vutran1710/PyrateLimiter

### This repository

- Issue #64: https://github.com/mnaimfaizy/fastapi_rbac/issues/64
- [`docs/development/DEPENDENCY_UPGRADES.md`](../../development/DEPENDENCY_UPGRADES.md)
- [`docs/internal/ANALYSIS_FINDINGS.md`](../ANALYSIS_FINDINGS.md)
- [`backend/app/main.py`](../../../backend/app/main.py)
- [`backend/app/api/v1/endpoints/auth.py`](../../../backend/app/api/v1/endpoints/auth.py)
- Git: `47627b4` (initial fastapi-limiter), `7b115d6` (slowapi P0 implementation)
