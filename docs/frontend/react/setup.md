# React setup

Local development for the Vite React app in `react-frontend/`.

Related: [Architecture](./architecture.md), [Deployment](./deployment.md), [Developer Setup](../../development/DEVELOPER_SETUP.md).

## Prerequisites

- Node.js **20+** (see `engines` in `react-frontend/package.json`)
- npm (or a compatible package manager)
- Backend API reachable (default `http://localhost:8000`) for authenticated flows

## Install

```bash
cd react-frontend
npm install
```

## Environment files

Copy the template and adjust per environment:

```bash
cp .env.example .env.development
```

| File | Purpose |
| --- | --- |
| `.env.example` | Template (committed) |
| `.env.development` | Local Vite dev server |
| `.env.test` | Unit / integration / e2e test runs |
| `.env.production` | Production build |

Vite only exposes variables prefixed with `VITE_`. Restart the dev server after changing env files.

### Important variables

| Variable | Role |
| --- | --- |
| `VITE_API_BASE_URL` | Backend API base (for example `http://localhost:8000/api/v1`) |
| `VITE_AUTH_TOKEN_NAME` | Access-token storage key name |
| `VITE_REFRESH_TOKEN_NAME` | Refresh-token storage key name |
| `VITE_APP_NAME` / `VITE_APP_VERSION` | Display / build metadata |
| `VITE_ENABLE_*` | Optional feature flags |

## Run locally

```bash
cd react-frontend
npm run dev
```

Default Vite URL: `http://localhost:5173` (confirm in the terminal output).

Ensure the FastAPI backend is running and `BACKEND_CORS_ORIGINS` includes the frontend origin. See [CORS troubleshooting](../../troubleshooting/CORS_TROUBLESHOOTING.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) + production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest (watch-oriented) |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | Playwright e2e |

Full testing detail: [Testing](./testing.md).

## Code location

All frontend source lives under `react-frontend/`. Prefer editing there; do not invent a second app root unless you are adding a new framework under `docs/frontend/` as described in the [Frontend overview](../index.md).
