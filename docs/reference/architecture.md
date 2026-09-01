# System Architecture

Canonical architecture narrative for FastAPI RBAC. AI harness files and agent guides should **link here** instead of duplicating this content.

Related:

- [Project Overview](../getting-started/PROJECT_OVERVIEW.md) — product/tech-stack summary
- [Frontend Architecture](../development/FRONTEND_ARCHITECTURE.md) — React patterns and conventions
- [Authentication API](./api/auth.md) — endpoint contracts
- [Security Features](./SECURITY_FEATURES.md) — security controls
- [Domain docs](../agents/domain.md) — vocabulary and ADR conflict handling
- [ADR 0001](../adr/0001-pyjwt-sole-jwt-library.md) — PyJWT + Redis allowlist decision
- [ADR 0006](../adr/0006-httponly-refresh-token-cookies.md) — HttpOnly refresh-token cookies for the SPA
- [ADR 0009](../adr/0009-celery-registration-single-entrypoint.md) — single Celery entrypoint; beat entries must name registered tasks

## High-level architecture

```
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  React Frontend   │◄────►│  FastAPI Backend  │◄────►│  PostgreSQL       │
└───────────────────┘      └─────────┬─────────┘      └───────────────────┘
                                     │
                                     ▼
                           ┌───────────────────┐
                           │  Redis            │
                           │  (token allowlist │
                           │   + Celery broker)│
                           └───────────────────┘
```

The project is a user-management microservice: authentication and authorization for other services.

| Layer | Stack |
| --- | --- |
| Backend | FastAPI, SQLAlchemy/SQLModel, Redis, Celery |
| Frontend | React, TypeScript, Redux Toolkit, ShadCN UI |
| Data | PostgreSQL (persistent), Redis (sessions / cache / broker) |

## Backend layers

### API layer

- Route handlers: `backend/app/api/v1/endpoints/`
- Shared dependencies: `backend/app/api/deps.py`
- Request/response validation: Pydantic schemas in `backend/app/schemas/`
- Versioned under `/api/v1`

### Persistence and domain

- Models: `backend/app/models/` (SQLModel)
- CRUD: `backend/app/crud/`
- Migrations: `backend/alembic/`
- Resource-specific deps: `backend/app/deps/`

### Security and infrastructure

- JWT + password helpers: `backend/app/core/security.py` (PyJWT)
- Settings: `backend/app/core/config.py`
- Redis session **allowlist**: `backend/app/utils/token.py`
- Celery: `backend/app/celery_app.py`, workers, beat schedule

## Frontend layers

- Feature modules: `react-frontend/src/features/` (auth, users, roles, permissions, …)
- Shared UI: `react-frontend/src/components/` (auth, layout, ShadCN `ui/`)
- API clients: `react-frontend/src/services/`
- Redux store: `react-frontend/src/store/`
- Types: `react-frontend/src/models/`
- Hooks: `react-frontend/src/hooks/` (`useAuth`, `usePermissions`, …)

See [Frontend — React architecture](../frontend/react/architecture.md) for patterns.

## Key directory layout

High-level trees only. Prefer the repo (or `graphify`) over copying leaf-level trees into harness files.

### Backend

```
backend/
├── alembic/                 # Migrations
├── app/
│   ├── api/                 # deps + v1 endpoints
│   ├── core/                # config, security, celery config
│   ├── crud/                # DB operations
│   ├── db/                  # session, init
│   ├── deps/                # resource dependencies
│   ├── models/              # SQLModel entities
│   ├── schemas/             # Pydantic API schemas
│   ├── utils/               # token allowlist, email, audit, …
│   ├── main.py              # FastAPI entry
│   └── …                    # celery, email templates, startup
└── test/                    # unit + integration suite
```

### Frontend

```
react-frontend/
├── src/
│   ├── components/          # auth, layout, ui
│   ├── features/            # domain feature modules
│   ├── hooks/
│   ├── lib/
│   ├── models/              # TypeScript interfaces
│   ├── pages/
│   ├── services/            # Axios API layer
│   └── store/               # Redux Toolkit
├── package.json
└── vite.config.ts
```

## Domain model

Core RBAC terms (see [domain docs](../agents/domain.md)): **user**, **role**, **permission**, **role group**, **permission group**.

| Concept | Backend model | Notes |
| --- | --- | --- |
| User | `user_model.py` | Credentials, profile, lockout / verification fields; roles via `UserRole` |
| Role | `role_model.py` | Named roles; permissions via `RolePermission`; optional role group |
| Permission | `permission_model.py` | Granular actions (`user.create`, …); belongs to a permission group |
| Role group | `role_group_model.py` | Hierarchical grouping via `RoleGroupMap` |
| Permission group | `permission_group_model.py` | Logical grouping of permissions |
| Password history | `password_history_model.py` | Reuse prevention / audit |
| Audit log | `audit_log_model.py` | Security / activity events |

Mapping tables: `UserRole`, `RolePermission`, `RoleGroupMap`.

Frontend mirrors these in `react-frontend/src/models/` (`user.ts`, `role.ts`, `permission.ts`, `roleGroup.ts`, `auth.ts`, …).

## Authentication flow

Session invalidation uses a Redis **allowlist** (`user:{id}:{token_type}` sorted sets in `app/utils/token.py`, scored by each member's expiry), not a JWT `jti` blacklist. Live membership ignores expired entries. A login that would exceed `CONCURRENT_SESSION_LIMIT` evicts the oldest session (refresh token plus access tokens derived from it); a limit of `0` or less disables that cap. See [ADR 0001](../adr/0001-pyjwt-sole-jwt-library.md), [ADR 0006](../adr/0006-httponly-refresh-token-cookies.md), and [ADR 0011](../adr/0011-session-security-model.md).

1. **Login** — `POST /api/v1/auth/login` validates credentials, returns the access token in JSON, sets the refresh token as an HttpOnly cookie, and records both on the Redis allowlist.
2. **Authenticated requests** — client sends `Authorization: Bearer <access_token>` (and cookies via credentials); backend verifies signature/expiry and that the token remains allowlisted.
3. **Refresh** — on 401, frontend calls `POST /api/v1/auth/new_access_token` with CSRF; backend reads the HttpOnly refresh cookie (optional JSON body fallback for non-browser clients), validates the allowlist, and returns a new access token. Failed refresh → logout. (Refresh rotation is not implemented; see session-security follow-ups.)
4. **Logout** — `POST /api/v1/auth/logout` removes allowlist entries and clears the refresh cookie; frontend clears in-memory access token and session hint.

**Pending accounts** — a registration whose email is never verified leaves a pending user row. Celery Beat sweeps those hourly (`app.worker.cleanup_unverified_users_task` → `app/utils/unverified_cleanup.py`), deleting active, non-superuser, unverified rows created longer ago than `UNVERIFIED_ACCOUNT_CLEANUP_HOURS` (default 72). The delete repeats the predicate, so a user who verifies while the sweep runs is kept. The sweep reads its work from the database rather than holding a timer, so a worker restart costs one tick rather than every pending row. Beat and the workers both boot from `app.celery_app`, which imports the task and schedule modules; see [ADR 0009](../adr/0009-celery-registration-single-entrypoint.md).

Frontend storage strategy:

- Access token: memory (Redux) only
- Refresh token: HttpOnly cookie (not readable by JavaScript)

## Security architecture (summary)

- JWT access/refresh with Redis allowlist invalidation
- bcrypt passwords, history, lockout
- RBAC via roles and permissions on protected routes
- CSRF, rate limiting, input sanitization, security headers

Details: [Security Features](./SECURITY_FEATURES.md). Deep session analysis lives under `docs/SESSION_SECURITY_*.md` (historical / design notes; prefer this page + ADR for current behavior).

## Deployment sketch

Docker Compose for local and environment-scoped production layouts; Alembic for schema; Celery workers for email and background work. See [Deployment](../deployment/index.md).
