# React Frontend for FastAPI Auth Backend

Secure React + TypeScript UI for the FastAPI RBAC backend.

## Documentation (MkDocs)

Canonical frontend docs live on the documentation site — prefer those over duplicating long guides here:

| Topic | Doc |
| --- | --- |
| Overview + future frameworks | [`docs/frontend/index.md`](../docs/frontend/index.md) |
| Setup & env | [`docs/frontend/react/setup.md`](../docs/frontend/react/setup.md) |
| Architecture | [`docs/frontend/react/architecture.md`](../docs/frontend/react/architecture.md) |
| Authentication | [`docs/frontend/react/auth.md`](../docs/frontend/react/auth.md) |
| Redux state | [`docs/frontend/react/state.md`](../docs/frontend/react/state.md) |
| ShadCN UI | [`docs/frontend/react/ui.md`](../docs/frontend/react/ui.md) |
| Testing | [`docs/frontend/react/testing.md`](../docs/frontend/react/testing.md) |
| Deployment | [`docs/frontend/react/deployment.md`](../docs/frontend/react/deployment.md) |
| Troubleshooting | [`docs/troubleshooting/frontend-issues.md`](../docs/troubleshooting/frontend-issues.md) |

Package-local e2e runbooks remain under [`E2E_TESTING.md`](./E2E_TESTING.md) and [`e2e/`](./e2e/).

## Quick start

```bash
cd react-frontend
npm install
cp .env.example .env.development
npm run dev
```

Requires Node.js 20+. Point `VITE_API_BASE_URL` at a running API. Full steps: [Setup](../docs/frontend/react/setup.md).

## Features (summary)

- JWT auth with in-memory access token + refresh token handling
- Redux Toolkit, React Router, ShadCN UI / Tailwind
- CSRF integration with the backend
- Vitest + Playwright test suites
- Docker / Nginx deployment layouts

## Commands

See [Setup — Common commands](../docs/frontend/react/setup.md#common-commands) for the full list (`dev`, `build`, `lint`, `test`, `test:e2e`, …).
