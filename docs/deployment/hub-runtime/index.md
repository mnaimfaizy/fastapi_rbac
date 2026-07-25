# Hub runtime

Deploy the published Docker Hub **API package** (not the admin UI):

- `mnaimfaizy/fastapi-rbac-backend`
- `mnaimfaizy/fastapi-rbac-worker` (Celery **worker** and **beat** processes)

plus Postgres, Redis, and external SMTP, behind Caddy HTTPS.

This is the same topology for staging and production-style validation. Frontend hosting is out of scope here.

## Contents

| Artifact | Purpose |
| --- | --- |
| [`compose.yml`](./compose.yml) | One-package Compose: `caddy`, `api`, `worker`, `beat`, `db`, `redis` |
| [`env.example`](./env.example) | Copy to `.env` on the host (never commit `.env`) |
| [`bootstrap.sh`](./bootstrap.sh) | Generate empty secrets, pull images, start stack, wait for health |
| [`Caddyfile`](./Caddyfile) | TLS for `DOMAIN` → `api:8000` |
| [Oracle Always Free first-time setup](./oracle-always-free-setup.md) | Free VM path for maintainers |

## Quick start (VM already prepared)

```bash
cd docs/deployment/hub-runtime
cp env.example .env
# Edit .env: IMAGE_TAG, DOMAIN, SMTP_*, FIRST_SUPERUSER_EMAIL
chmod +x bootstrap.sh
./bootstrap.sh
```

- Pin `IMAGE_TAG=vX.Y.Z` by default; set `IMAGE_TAG=latest` only for a quick check.
- Default public host: `https://rbac-api.mnfprofile.com`
- API health: `https://rbac-api.mnfprofile.com/api/v1/health`

## Related

- Research: [Hosting Docker Hub images](../../internal/research/hosting-docker-hub-images.md)
- ADR: [0003 — Hub runtime on Oracle Always Free](../../adr/0003-hub-runtime-oracle-compose.md)
- Issue: [#96](https://github.com/mnaimfaizy/fastapi_rbac/issues/96)
