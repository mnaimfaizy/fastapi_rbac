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
   │
   ├──── DATABASE_* ────────────► Neon (Postgres, free hobby)
   └──── CELERY / REDIS_* ──────► Upstash (Redis, free hobby)

Oracle AMD micro #2 (start/stop)  fastapi-rbac-worker (worker + beat)
   │
   └──── same DATABASE_* + Celery/Redis env as API

SMTP                            External provider (unchanged)
Admin UI                        [Admin UI host](../admin-ui/index.md) (unchanged)
```

| Piece | Choice | Notes |
| --- | --- | --- |
| Edge | Always Free **`VM.Standard.E2.1.Micro`** | ~1 GB RAM — API + Caddy only; use **1** Gunicorn/Uvicorn worker |
| Worker | Second Always Free **`E2.1.Micro`** | Worker + Beat; **stop the instance** when not testing |
| Postgres | [Neon](https://neon.tech) free | Scale-to-zero OK for intermittent dogfood |
| Redis / Celery | [Upstash](https://upstash.com) free | TLS `rediss://`; watch monthly command quota |
| Images | `mnaimfaizy/fastapi-rbac-backend` / `-worker` | Same Hub tags as Compose path |
| TLS / DNS | Caddy on micro #1 | e.g. `rbac-api.mnfprofile.com` → micro #1 public IP |

Ampere A1 can still host the edge if you prefer more RAM; the locked default for this alternative is **two AMD micros** so the API micro is not shared with local Docker Postgres/Redis.

## Staleness checklist

- [ ] Document older than **6 months** since **Last verified**
- [ ] Neon / Upstash free-tier limits or connection URL shapes change
- [ ] Always Free AMD micro count or shape changes
- [ ] Hub image entrypoints or required production env vars change

---

## 1. Provision managed data

### Neon (Postgres)

1. Create a free project and database.
2. Copy the **pooled** connection details (host, user, password, database, SSL).
3. Map into Hub-style env (example — adjust names to match Neon’s dashboard):

```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=ep-xxxx.region.aws.neon.tech
DATABASE_PORT=5432
DATABASE_USER=neondb_owner
DATABASE_PASSWORD=...
DATABASE_NAME=neondb
# If the app supports a full URL in your deploy, prefer the provider’s SSL URL.
```

Ensure SSL is required (Neon expects it). First API boot still runs migrations via the image entrypoint.

### Upstash (Redis)

1. Create a free Redis database.
2. Copy the **Redis URL** (TLS), e.g. `rediss://default:TOKEN@HOST:PORT`.
3. Set broker/result (and Redis settings if your image reads them separately):

```bash
CELERY_BROKER_URL=rediss://default:TOKEN@HOST:PORT
CELERY_RESULT_BACKEND=rediss://default:TOKEN@HOST:PORT
REDIS_HOST=HOST
REDIS_PORT=PORT
REDIS_PASSWORD=TOKEN
REDIS_SSL=true
```

Celery + Beat will consume Upstash **commands**; for intermittent testing this is usually fine. Prefer stopping the worker VM when idle so the quota lasts longer.

---

## 2. Oracle micro #1 — API + Caddy

1. Create Always Free **`VM.Standard.E2.1.Micro`** (Ubuntu, `x86_64` Hub images).
2. Security list: **22, 80, 443** ingress (same idea as [Oracle Always Free setup](./oracle-always-free-setup.md)).
3. DNS `A` record for your API host → this instance’s **public IP** (update after stop/start if ephemeral).
4. Install Docker Engine + Compose plugin (amd64 packages).
5. Minimal Compose (sketch) — no `db` / `redis` / `worker` / `beat` services:

```yaml
# Example only — keep secrets in .env, not in git
services:
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy
  api:
    image: mnaimfaizy/fastapi-rbac-backend:${IMAGE_TAG}
    env_file: [.env]
    environment:
      MODE: production
      # Override any leftover Compose hostnames
      DATABASE_HOST: ${DATABASE_HOST}
      REDIS_HOST: ${REDIS_HOST}
      REDIS_SSL: "true"
    # Reduce memory on 1 GB micro — set via image override if needed:
    # command: [gunicorn, ..., --workers, "1", ...]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 90s
volumes:
  caddy_data:
  caddy_config:
```

6. `.env` must include production JWT fields (`TOKEN_ISSUER`, `TOKEN_AUDIENCE`, `USER_CHANGED_PASSWORD_DATE`), secrets, SMTP, CORS / `FRONTEND_URL` for the Admin UI host, **and** Neon + Upstash settings. Reuse [env.example](./env.example) as a checklist; remove reliance on local `db` / `redis` hostnames.

7. If the published image defaults to **4** Gunicorn workers, override to **1** on the micro (memory). Confirm with `free -h` after boot.

8. Smoke:

```bash
curl -fsS "https://${DOMAIN}/api/v1/health"
```

---

## 3. Oracle micro #2 — worker + Beat

1. Create the **second** Always Free `E2.1.Micro` (same VCN optional; it only needs egress to Neon/Upstash/SMTP).
2. Public IP optional (SSH only). No need to open 80/443.
3. Install Docker; run **two** containers from `mnaimfaizy/fastapi-rbac-worker` (or one Compose file with `worker` + `beat` only), with the **same** `.env` database/Redis/Celery/SMTP secrets as the API (not the Caddy `DOMAIN` binding).
4. Commands match Hub Compose intent:
   - Worker: `/app/scripts/docker/start-worker.sh` (or image default worker entry)
   - Beat: Celery beat with a persistent schedule volume if you care about schedule durability across restarts
5. When you finish a test session:

```text
OCI Console → Compute → micro #2 → Stop
```

Start it again before exercising password-reset email, Celery tasks, or Beat schedules.

---

## 4. What this path deliberately skips

- Local Docker Postgres/Redis on Oracle
- Render / Koyeb / Railway as the “free Celery worker” (not free or not suitable)
- Private VCN-only data plane (Neon/Upstash are TLS over the public internet — fine for staging)
- Replacing [single-VM Compose](./index.md) as the default adopter story

---

## 5. When to use which path

| Goal | Path |
| --- | --- |
| Fastest one-box validation | [Compose on one VM](./index.md) (+ [Oracle setup](./oracle-always-free-setup.md)) |
| API micro must not share RAM with DB/Redis/Celery; stop worker when idle | **This document** |
| Admin UI | [Admin UI host](../admin-ui/index.md) |
