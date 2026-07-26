# Hub runtime — split + managed data (alternative)

**Created:** 2026-07-26
**Last verified:** 2026-07-26
**Status:** Optional alternative to [single-VM Compose](./index.md). Keep Compose when you want one box; use this when the API VM should not share RAM with Postgres/Redis/Celery.

ADR: [0005 — Hub runtime split with managed hobby data](../../adr/0005-hub-runtime-split-managed-data.md)
Research: [oracle-always-free-split-runtime.md](../../internal/research/oracle-always-free-split-runtime.md)

## Topology

```text
Internet
   │
   ▼
Oracle AMD micro #1 (public)     Caddy + fastapi-rbac-backend
   │                                compose.api.yml + bootstrap-api.sh
   ├──── DATABASE_* ────────────► Neon (Postgres, free hobby)
   └──── CELERY / REDIS_* ──────► Upstash (Redis, free hobby)

Oracle AMD micro #2 (start/stop)  fastapi-rbac-worker (worker + beat)
   │                                compose.worker.yml + bootstrap-worker.sh
   └──── same DATABASE_* + Celery/Redis env as API

SMTP                            External provider (unchanged)
Admin UI                        [Admin UI host](../admin-ui/index.md) (unchanged)
```

| Piece | Choice | Notes |
| --- | --- | --- |
| Edge | Always Free **`VM.Standard.E2.1.Micro`** | ~1 GB RAM — API + Caddy; Compose forces **1** Gunicorn worker |
| Worker | Second Always Free **`E2.1.Micro`** | Worker + Beat (`--concurrency=1`); **stop** when not testing |
| Postgres | [Neon](https://neon.tech) free | Scale-to-zero OK for intermittent dogfood |
| Redis / Celery | [Upstash](https://upstash.com) free | TLS `rediss://`; watch monthly command quota |
| Artifacts | [`split/`](./split/) | Separate Compose + bootstrap; parent [`compose.yml`](./compose.yml) unchanged |

## Artifacts (`split/`)

| File | Purpose |
| --- | --- |
| [`split/env.example`](./split/env.example) | Copy to `.env` on **each** VM; fill Neon + Upstash (no `db` / `redis` hosts) |
| [`split/compose.api.yml`](./split/compose.api.yml) | `caddy` + `api` only |
| [`split/compose.worker.yml`](./split/compose.worker.yml) | `worker` + `beat` only |
| [`split/bootstrap-api.sh`](./split/bootstrap-api.sh) | CLI for API edge (`up`/`status`/`logs`/`health`/…); managed hosts required |
| [`split/bootstrap-worker.sh`](./split/bootstrap-worker.sh) | Same CLI for worker + Beat |
| [`split/_common.sh`](./split/_common.sh) | Shared env/CA helpers (sourced by both bootstraps) |
| [`_bootstrap_cli.sh`](./_bootstrap_cli.sh) | Shared subcommands/flags (parent of `split/`) |
| [`Caddyfile`](./Caddyfile) | Shared with single-VM path (mounted as `../Caddyfile`) |

Default single-VM [`bootstrap.sh`](./bootstrap.sh) still forces `CELERY_*` → `redis://redis:6379/0` for Compose Redis. **Split bootstraps never do that** — they require your managed URLs.

## Staleness checklist

- [ ] Document older than **6 months** since **Last verified**
- [ ] Neon / Upstash free-tier limits or connection URL shapes change
- [ ] Always Free AMD micro count or shape changes
- [ ] Hub image entrypoints or required production env vars change

---

## 1. Provision managed data

### Neon (Postgres)

1. Create a free project and database.
2. Copy host, user, password, database (prefer pooled endpoint if offered).
3. Put values into `split/.env` (from `split/env.example`).
4. If SSL errors appear on boot, set `ASYNC_DATABASE_URI` (and related URIs if needed) from Neon’s connection string with `ssl=require`.
5. Set `DATABASE_CELERY_NAME` to the same database name on free tier if you only have one DB.

### Upstash (Redis)

1. Create a free Redis database.
2. Copy the TLS URL into both:

```bash
# Hostname only — never paste the full rediss:// URL into REDIS_HOST
REDIS_HOST=prompt-hippo-xxxxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_UPSTASH_TOKEN
REDIS_SSL=true
# Full TLS URLs for Celery only:
CELERY_BROKER_URL=rediss://default:YOUR_UPSTASH_TOKEN@prompt-hippo-xxxxx.upstash.io:6379
CELERY_RESULT_BACKEND=rediss://default:YOUR_UPSTASH_TOKEN@prompt-hippo-xxxxx.upstash.io:6379
```

If `REDIS_HOST` includes `rediss://…@…:6379`, the app appends `:6379` again and Redis wait fails with `idna` / `label empty or too long`.

Worker logs with an empty `[tasks]` list and `Received unregistered task of type 'app.worker…'` mean the process loaded `app.celery_app` without importing `app.worker`. Use `compose.worker.yml` as shipped (`celery -A app.worker:celery_app`) or a worker image that registers `imports=("app.worker",)`.

Beat `Permission denied: '/var/lib/celery/celerybeat-schedule.db'`: the schedule volume is root-owned while the image runs as `appuser`. Current `compose.worker.yml` chowns that dir on start. After pulling the fix: `./bootstrap-worker.sh up --force-recreate` is not enough if compose is stale — `git pull` then `./bootstrap-worker.sh up beat` (or `docker compose ... up -d --force-recreate beat`).

3. **CA bundle:** production images require `/app/certs/ca.crt`. Split Compose mounts the host trust store (`/etc/ssl/certs/ca-certificates.crt`) there for Upstash public CAs. On the VM:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates
ls -la /etc/ssl/certs/ca-certificates.crt
```

Override with `HOST_CA_BUNDLE=/path/to/bundle.crt` in `.env` if needed.

---

## 2. Oracle micro #1 — API + Caddy

1. Create Always Free **`VM.Standard.E2.1.Micro`** (Ubuntu `x86_64`).
2. Security list: **22, 80, 443** (see [Oracle Always Free setup](./oracle-always-free-setup.md)).
3. DNS `A` for your API host → this instance’s public IP.
4. Install Docker Engine + Compose; clone the repo (or copy `docs/deployment/hub-runtime/` including `split/` and `Caddyfile`).
5. On the VM:

```bash
cd docs/deployment/hub-runtime/split
cp env.example .env
# Edit .env: Neon, Upstash, SMTP, FIRST_SUPERUSER_EMAIL, DOMAIN, IMAGE_TAG
chmod +x bootstrap-api.sh bootstrap-worker.sh
./bootstrap-api.sh --help
./bootstrap-api.sh                 # prepare .env, pull, up caddy+api, wait health
./bootstrap-api.sh status
./bootstrap-api.sh logs -f api
./bootstrap-api.sh up api          # recreate API only
```

6. Smoke:

```bash
./bootstrap-api.sh health
# or: curl -fsS "https://${DOMAIN}/api/v1/health"
```

7. Copy the finished `.env` to the worker VM (same secrets):

```bash
scp .env ubuntu@<worker-private-or-public-ip>:~/hub-split.env
```

---

## 3. Oracle micro #2 — worker + Beat

1. Create the **second** Always Free `E2.1.Micro` (egress to Neon/Upstash/SMTP is enough).
2. Install Docker; clone/copy the same `hub-runtime` tree.
3. Place the API `.env` into `split/.env` (do not invent new JWT secrets).
4. Start:

```bash
cd docs/deployment/hub-runtime/split
chmod +x bootstrap-worker.sh
./bootstrap-worker.sh --help
./bootstrap-worker.sh              # pull + up worker + beat
./bootstrap-worker.sh status
./bootstrap-worker.sh logs -f worker
./bootstrap-worker.sh restart worker
```

5. When finished testing:

```text
OCI Console → Compute → micro #2 → Stop
```

Start it again before password-reset email, Celery tasks, or Beat schedules.

---

## 4. What this path deliberately skips

- Local Docker Postgres/Redis on Oracle
- Mutating parent [`compose.yml`](./compose.yml) / [`bootstrap.sh`](./bootstrap.sh) (single-VM default stays)
- Render / Koyeb as free Celery hosts

---

## 5. When to use which path

| Goal | Path |
| --- | --- |
| Fastest one-box validation | [Compose on one VM](./index.md) (+ [Oracle setup](./oracle-always-free-setup.md)) |
| API micro must not share RAM with DB/Redis/Celery; stop worker when idle | **This document** + [`split/`](./split/) |
| Admin UI | [Admin UI host](../admin-ui/index.md) |
