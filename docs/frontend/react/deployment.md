# React deployment

Build and run the React SPA for Docker and production.

Related: [Setup](./setup.md), [Deployment overview](../../deployment/index.md), [Production setup](../../deployment/PRODUCTION_SETUP.md).

## Production build

```bash
cd react-frontend
npm run build
```

This runs TypeScript project references (`tsc -b`) then Vite. Artifacts land in the configured `dist/` output. Preview locally:

```bash
npm run preview
```

Set production env via `.env.production` (from `.env.example`) so `VITE_API_BASE_URL` points at the live API.

## Docker layout

Modular Compose files:

| Scope | Files |
| --- | --- |
| Root stack | `docker-compose.dev.yml`, `docker-compose.test.yml`, `docker-compose.prod-test.yml` (repo root) |
| Frontend-only | `react-frontend/docker-compose.dev.yml`, `docker-compose.test.yml`, `docker-compose.prod.yml` |

Frontend images use `Dockerfile` / `Dockerfile.prod` and serve static assets with **Nginx** (`nginx.conf`).

### Frontend only

```bash
cd react-frontend
docker compose -f docker-compose.dev.yml up -d
# or the prod compose file for a production-like image
```

### Full stack

From the repository root, use the root Compose files documented under [Deployment](../../deployment/index.md).

## Nginx SPA notes

- Configure fallback to `index.html` so client-side routes work on refresh.
- Keep CORS / proxy headers consistent with the backend.
- See [Frontend Issues — Build / Docker / Nginx](../../troubleshooting/frontend-issues.md#build--docker--nginx).

## Checklist before release

- [ ] `npm run build` succeeds
- [ ] `VITE_API_BASE_URL` targets the correct API
- [ ] CORS allows the deployed frontend origin
- [ ] Container health / static asset paths verified
- [ ] Smoke-test login + token refresh against the deployed API
