# Hub runtime

Deploy the published Docker Hub **API package** (not the admin UI):

- `mnaimfaizy/fastapi-rbac-backend`
- `mnaimfaizy/fastapi-rbac-worker` (Celery **worker** and **beat** processes)

plus Postgres, Redis, and external SMTP, behind Caddy HTTPS.

This is the same topology for staging and production-style validation. Admin UI hosting is out of scope here — see [Admin UI host](../admin-ui/index.md).

## Contents

| Artifact | Purpose |
| --- | --- |
| [`compose.yml`](./compose.yml) | One-package Compose: `caddy`, `api`, `worker`, `beat`, `db`, `redis` |
| [`env.example`](./env.example) | Copy to `.env` on the host (never commit `.env`) |
| [`bootstrap.sh`](./bootstrap.sh) | CLI: prepare `.env`, pull/start/stop, status, logs, health (default: `up`) |
| [`_bootstrap_cli.sh`](./_bootstrap_cli.sh) | Shared subcommands/flags (sourced by one-box + split bootstraps) |
| [`Caddyfile`](./Caddyfile) | TLS for `DOMAIN` → `api:8000` |
| [Oracle Always Free first-time setup](./oracle-always-free-setup.md) | Free VM path for maintainers (single-VM Compose) |
| [Split + managed data (alternative)](./split-managed-data.md) | Two AMD micros + Neon + Upstash; stop worker when idle |
| [`split/compose.api.yml`](./split/compose.api.yml) | Edge only: Caddy + API |
| [`split/compose.worker.yml`](./split/compose.worker.yml) | Worker + Beat only |
| [`split/bootstrap-api.sh`](./split/bootstrap-api.sh) / [`bootstrap-worker.sh`](./split/bootstrap-worker.sh) | Same CLI for API edge / worker edge (managed DB/Redis required) |

## Quick start (VM already prepared)

```bash
cd docs/deployment/hub-runtime
cp env.example .env
# Edit .env: IMAGE_TAG, DOMAIN, SMTP_*, FIRST_SUPERUSER_EMAIL
chmod +x bootstrap.sh
./bootstrap.sh --help
./bootstrap.sh                 # same as: ./bootstrap.sh up
./bootstrap.sh status
./bootstrap.sh logs -f api
./bootstrap.sh up api          # single service
./bootstrap.sh health
```

- Pin `IMAGE_TAG=vX.Y.Z` by default; set `IMAGE_TAG=latest` only for a quick check.
- Default public host: `https://rbac-api.mnfprofile.com`
- API health: `https://rbac-api.mnfprofile.com/api/v1/health`
- Global flags: `--env-file`, `--no-pull`, `--no-wait`

## Related

- Admin UI host: [index](../admin-ui/index.md) · [cPanel setup](../admin-ui/cpanel-setup.md)
- Alternative topology: [Split + managed data](./split-managed-data.md)
- Research: [Hosting Docker Hub images](../../internal/research/hosting-docker-hub-images.md) · [Always Free split](../../internal/research/oracle-always-free-split-runtime.md)
- ADR: [0003 — Hub runtime on Oracle Always Free](../../adr/0003-hub-runtime-oracle-compose.md) · [0005 — split + managed data](../../adr/0005-hub-runtime-split-managed-data.md)
- Issue: [#96](https://github.com/mnaimfaizy/fastapi_rbac/issues/96)
