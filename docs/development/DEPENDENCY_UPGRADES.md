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
| `gunicorn` | **Fixed in Lane 4** → `26.0.0` (request-smuggling advisories needed ≥22) | Lane 4 |
| `tornado` | **Fixed in Lane 4** → `6.5.7` (flower still requires `<7`) | Lane 4 |
| `urllib3` / `requests` / `idna` | **Fixed in Lane 4** → `2.7.0` / `2.34.2` / `3.18` | Lane 4 |
| `celery` / `kombu` | Currency bump in Lane 4 → `5.6.3` / `5.6.2` (hard-stop; verify worker import) | Lane 4 |
| `black` / `pytest` | Tooling majors deferred after Lane 1 patch/minor | Lane 1 majors later |
| Remaining transitive (filelock, virtualenv, pygments, …) | Accept or fold into nearest lane | Lane 1 / 4 |

### Lane 2 notes (2026-07-16)

- Starlette Host-header advisories require **≥1.0.1**, so FastAPI moved to **0.139.x** (allows `starlette>=0.46.0`).
- Companion pins: `pydantic` / `pydantic-settings` / `pydantic_core`, `fastapi-csrf-protect`, `slowapi`, `annotated-doc`, `typing_extensions`, `pyasn1`.
- Re-run `pip-audit` after merge; do not treat this table as live CVE status.

### Lane 3 notes (2026-07-17)

- Currency bump (no OSV hits on prior pins): `SQLAlchemy==2.0.51`, `sqlmodel==0.0.39`, `alembic==1.18.5`, `asyncpg==0.31.0`, `aiosqlite==0.22.1`, `greenlet==3.5.3`, `sqlakeyset==2.0.1775222100`, `SQLAlchemy-Utils==0.42.1`.
- Confirmed `AsyncSession.exec` still present; do not migrate call sites to `.execute()`.
- Alembic `upgrade head` / `downgrade -1` / re-upgrade verified on empty Postgres.

### Lane 4 notes (2026-07-17)

- CVE-driven: `gunicorn==26.0.0`, `tornado==6.5.7`, `urllib3==2.7.0`, `requests==2.34.2`, `idna==3.18`.
- Workers/ops currency: `celery==5.6.3` + `kombu==5.6.2` (+ `billiard`, `tzlocal`), `uvicorn==0.51.0`, `sentry-sdk==2.66.0`, `tenacity==9.1.4`; `flower` already latest `2.0.1`; `httpx` already latest `0.28.1`.
- Companion pins: `click`, `httptools`, `watchfiles`, `websockets`, `prometheus_client`, `exceptiongroup`, `types-requests`.
- Dockerfiles unchanged (install from `requirements.txt`); worker import smoke verified (`app.celery_app`).

### Frontend (`npm audit`)

Initial snapshot (2026-07-16): **22** vulnerabilities. After Lane 1 tooling + Lane 5 runtime refresh: **`npm audit` reports 0**.

| Package | Severity | Disposition | Target lane |
|---------|----------|-------------|-------------|
| `vitest` / `@vitest/coverage-v8` | critical | Addressed in Lane 1 | Lane 1 |
| `form-data` (transitive) | critical | Cleared via Lane 5 lockfile refresh | Lane 5 |
| `axios` | high | **Fixed in Lane 5** → `^1.18.1` | Lane 5 |
| `react-router` / `react-router-dom` | high | **Fixed in Lane 5** → `^7.18.1` (within major 7) | Lane 5 |
| `vite` | high | **Patched in Lane 5** → `^6.4.3` (within major 6; Vite 7/8 deferred) | Lane 5 / 6 |
| `eslint` plugin-kit / related | low–high | Addressed in Lane 1 | Lane 1 |
| Other transitive (lodash, minimatch, rollup, tar, ws, …) | high | Cleared via Lane 5 `npm audit fix` | Lane 5 |

### Lane 5 notes (2026-07-17)

- Runtime (non-major): axios, RTK, react-redux, react-hook-form, zod 3.x, Radix, lucide-react `0.577`, recharts `2.15.4` (v3 deferred), date-fns, sonner, tailwind-merge, postcss.
- Majors deferred to Lane 6: React, Vite 7+/8, Tailwind, lucide-react 1.x, recharts 3.x, zod 4.x.

### Lane 6 notes (2026-07-17)

Spike landed in one PR (stack was already on React 19 / Tailwind 4 / RR7):

| Package | From → To | Notes |
|---------|-----------|--------|
| `react` / `react-dom` | `19.0` → `19.2.7` | Same major currency |
| `tailwindcss` / `@tailwindcss/vite` | `4.1` → `4.3.3` | Same major currency |
| `vite` | `6.4` → `7.3.6` | With `@vitejs/plugin-react` `5.x` |
| `vitest` / coverage | `3.2` → `4.1.10` | Peer-aligned with Vite 7 |
| `lucide-react` | `0.577` → `1.24.0` | Icon import API unchanged here |
| `zod` | `3.25` → `4.4.3` | Existing `message` args still work (deprecated); prefer `error` later |
| `recharts` | `2.15` → `3.9.2` | Dashboard `AreaChart` OK |

**Deferred (narrower follow-ups):** Vite 8 + `@vitejs/plugin-react` 6 (Rolldown/Babel compiler peers), TypeScript 7. Playwright e2e remains gated until full-stack CI (#37).

## Per-PR checklist

1. Backend: pytest suite green; `import app.main` smoke if relevant.
2. Frontend: lint + `test:run` + production build.
3. Auth-touched: login, refresh, logout; CSRF if middleware changed.
4. DB-touched: Alembic heads apply cleanly on empty DB.
5. Optional: `graphify query` on a path that crosses upgraded modules still makes sense.
