# Dependency Upgrades

How we keep FastAPI RBAC dependencies current without “bump everything” PRs.

Parent tracking issue: [#30](https://github.com/mnaimfaizy/fastapi_rbac/issues/30).

## Source of truth

| Surface | Manifest | Notes |
|---------|----------|--------|
| Backend runtime + many tools | [`backend/requirements.txt`](../../backend/requirements.txt) | Fully pinned (`==`). **Authoritative** for install and CI. |
| Backend tooling config | [`backend/pyproject.toml`](../../backend/pyproject.toml) | black / pytest / mypy / isort settings. Poetry package metadata is incomplete — do **not** treat Poetry as the lock source. |
| Frontend | [`react-frontend/package.json`](../../react-frontend/package.json) + `package-lock.json` | npm; Semver ranges (`^` / `~`). |
| Infra | Dockerfiles / compose | Python, Node, Postgres, Redis base images. |

A follow-up may align Poetry with `requirements.txt`; until then, always pin and install from `requirements.txt`.

## Principles

1. **Lane by risk** — never one mega-PR.
2. **Dev/test first**, then security-critical patch/minor clusters, then related runtime clusters; majors last (spike first).
3. **One cluster per PR** (or a tightly related cluster).
4. Every PR must keep CI green: Backend CI + React Frontend CI (and auth e2e when touching auth clients).
5. After meaningful code-touching upgrades, optionally run `graphify update .` locally and note concerning `GRAPH_REPORT.md` god-node shifts on the PR.

## Lanes and gates

| Lane | Cluster | Typical packages | Gates |
|------|---------|------------------|-------|
| 0 | Inventory & automation | Dependabot, this doc, CVE snapshot | Docs review; valid Dependabot config |
| 1 | Dev / test tooling | pytest*, black, isort, flake8*, mypy, coverage, pre-commit, factory_boy, Faker; eslint*, prettier, vitest*, testing-library*, Playwright | Backend unit + lint; frontend lint/build/e2e; local `npm run test:run` |
| 2 | Backend security / auth | FastAPI, Starlette, Pydantic, PyJWT, python-jose, passlib, bcrypt, cryptography, redis, CSRF/limiter, bleach | Backend tests; login/refresh/logout smoke; CSRF if middleware touched |
| 3 | Backend data / async DB | SQLAlchemy, sqlmodel, asyncpg, aiosqlite, alembic, greenlet, sqlakeyset | Migrations on empty DB; CRUD-heavy tests; keep `AsyncSession` + `.exec()` |
| 4 | Backend workers / ops | celery, kombu, flower, gunicorn, uvicorn, sentry-sdk, httpx, tenacity | Worker import smoke; Docker health if images change |
| 5 | Frontend runtime (non-major) | axios, Redux Toolkit, react-hook-form, zod, Radix, lucide-react, recharts | lint, `test:run`, build; Playwright auth if HTTP client touched |
| 6 | Frontend majors / framework | React, Vite, Tailwind, react-router majors | Spike branch + changelog review before bulk bump |
| 7 | Base images / Docker | Python/Node/Postgres/Redis image tags | Compose bring-up smoke; align CI service images with compose when changing |

## Hard stops

Upgrade carefully (changelog review; prefer split PRs if needed):

- SQLModel / SQLAlchemy API (`AsyncSession` + `.exec()`, not `.execute()`)
- FastAPI middleware affecting CSRF / rate limiting (`fastapi-csrf-protect`, `fastapi-limiter` / `slowapi`)
- Redis client + token utilities
- Celery / kombu / broker compatibility
- PyJWT / python-jose / passlib / bcrypt
- Frontend axios interceptors + react-router + Redux auth slice

## Automation

[Dependabot](https://docs.github.com/en/code-security/dependabot) is configured in [`.github/dependabot.yml`](../../.github/dependabot.yml):

- Weekly updates for `pip` (`/backend`), `npm` (`/react-frontend`), and `github-actions`
- Grouped patch/minor PRs per ecosystem
- Major bumps ignored for high-blast packages until the matching lane runs

Dependabot PRs are starting points; still apply the lane gates before merge. Prefer folding Dependabot bumps into the active lane PR when a human-owned upgrade is already in progress.

## Manual audit loop

```bash
# Backend (from repo root or backend/)
python -m pip install pip-audit
python -m pip_audit -r backend/requirements.txt

# Frontend
cd react-frontend && npm audit
```

Record dispositions on the parent issue or in the active lane PR: **fix now** (assign to a lane), **accept** (document why), or **false positive**.

CI does **not** currently fail on audit findings; that may be added later.

## CVE audit snapshot (2026-07-16)

Snapshot from `pip-audit` against `backend/requirements.txt` and `npm audit` in `react-frontend`. Counts change over time; re-run before each lane.

### Backend (`pip-audit`)

About **76** advisory hits across pinned packages (many packages have multiple advisories). High-priority dispositions:

| Package (pinned) | Disposition | Target lane |
|------------------|-------------|-------------|
| `starlette` | **Fixed in Lane 2** → `1.3.1` (with `fastapi==0.139.1`) | Lane 2 |
| `PyJWT` | **Fixed in Lane 2** → `2.13.0` | Lane 2 |
| `cryptography` | **Fixed in Lane 2** → `49.0.0` (requires `cffi>=2`) | Lane 2 |
| `bleach` | **Fixed in Lane 2** → `6.4.0` | Lane 2 |
| `python-multipart` | **Fixed in Lane 2** → `0.0.32` | Lane 2 |
| `ecdsa` | **Fixed in Lane 2** → `0.19.2` (with `python-jose==3.5.0`) | Lane 2 |
| `redis` | Patched in Lane 2 → `5.3.1` (no OSV hits on 5.2.1; **major 6+/8 deferred** — hard-stop) | Lane 2 / later |
| `fastapi-limiter` | Kept `0.1.6` — `0.2.0` is a breaking rewrite (drops Redis `FastAPILimiter`) | Lane 2 follow-up |
| `bcrypt` / `passlib` | No OSV hits; left on `4.3.0` / `1.7.4` | Lane 2 |
| `gunicorn==21.2.0` | Fix now — request smuggling (needs ≥22) | Lane 4 |
| `black` / `pytest` | Tooling majors deferred after Lane 1 patch/minor | Lane 1 majors later |
| `tornado` (transitive via flower) | Fix with flower/ops cluster | Lane 4 |
| `urllib3` / `requests` / `idna` | Fix with ops/http client cluster when convenient | Lane 4 |
| Remaining transitive (filelock, virtualenv, pygments, …) | Accept or fold into nearest lane | Lane 1 / 4 |

### Lane 2 notes (2026-07-16)

- Starlette Host-header advisories require **≥1.0.1**, so FastAPI moved to **0.139.x** (allows `starlette>=0.46.0`).
- Companion pins: `pydantic` / `pydantic-settings` / `pydantic_core`, `fastapi-csrf-protect`, `slowapi`, `annotated-doc`, `typing_extensions`, `pyasn1`.
- Re-run `pip-audit` after merge; do not treat this table as live CVE status.

### Frontend (`npm audit`)

**22** vulnerabilities reported: 3 critical, 12 high, 5 moderate, 2 low.

| Package | Severity | Disposition | Target lane |
|---------|----------|-------------|-------------|
| `vitest` / `@vitest/coverage-v8` | critical | Fix now (dev tooling; UI server / related) | Lane 1 |
| `form-data` (transitive) | critical | Fix via lockfile / parent bump | Lane 1 or 5 |
| `axios` | high | Fix now | Lane 5 |
| `react-router` / `react-router-dom` | high | Fix carefully (auth routes) | Lane 5 / 6 |
| `vite` | high | Fix carefully (dev server middleware) | Lane 1 (if within major) or 6 |
| `eslint` plugin-kit / related | low–high | Fix with tooling | Lane 1 |
| Other transitive (lodash, minimatch, rollup, tar, ws, …) | high | Prefer lockfile refresh in Lane 1 / 5 | Lane 1 / 5 |

## Per-PR checklist

1. Backend: pytest suite green; `import app.main` smoke if relevant.
2. Frontend: lint + `test:run` + production build.
3. Auth-touched: login, refresh, logout; CSRF if middleware changed.
4. DB-touched: Alembic heads apply cleanly on empty DB.
5. Optional: `graphify query` on a path that crosses upgraded modules still makes sense.
