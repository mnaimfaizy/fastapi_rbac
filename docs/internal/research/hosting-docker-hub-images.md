# Hosting the FastAPI RBAC Docker Hub images (staging + adopter path)

**Date:** 2026-07-25
**Issue:** [#96 — host microservices for production-feel testing](https://github.com/mnaimfaizy/fastapi_rbac/issues/96)
**Repo:** [mnaimfaizy/fastapi_rbac](https://github.com/mnaimfaizy/fastapi_rbac)
**Sources:** Primary only — Docker Hub READMEs, first-party platform docs/pricing, Oracle Always Free docs. Pricing is subject to change; figures below are as published on 2026-07-25 (or the page’s own “effective” date).
**Status:** Research complete. Decisions locked in grill session (2026-07-25); see [ADR 0003](../../adr/0003-hub-runtime-oracle-compose.md) and [Hub runtime](../../deployment/hub-runtime/index.md).

---

## Scope and non-goals

**In scope**

- Easiest and free/cheapest ways (mid/late 2026) to run the three **published** Docker Hub production images:
  - [`mnaimfaizy/fastapi-rbac-backend`](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-backend)
  - [`mnaimfaizy/fastapi-rbac-frontend`](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-frontend)
  - [`mnaimfaizy/fastapi-rbac-worker`](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-worker)
- Two audiences: **maintainer staging** (public/staging dogfood) and **adopter “start here”** (cheap or preferred host).
- Score platforms on Hub-image pull/run, Postgres/Redis/email supply, HTTPS/domain, free/cheap cost, ops complexity, staging vs adopter fit.

**Locked decisions (do not re-litigate)**

- Outcome shape C: both staging + adopter docs/scripts later.
- Primary artifact = the three Hub images.
- Redis/Postgres/Mailhog are **not** project product images ([#96](https://github.com/mnaimfaizy/fastapi_rbac/issues/96) handoff).

**Out of scope**

- Implementing hosting, Terraform, or CI deploy pipelines in this note.
- Shipping official Postgres/Redis/SMTP images under the project namespace.
- Choosing a production SLA topology for paying customers (staging-first).

---

## Runtime dependency model

| Layer | Source | Role |
| --- | --- | --- |
| Backend | Hub `fastapi-rbac-backend` | FastAPI API (~port **8000**); needs `DATABASE_*`, `REDIS_*`, `SECRET_KEY`, CORS, optional SMTP ([Hub README](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-backend)) |
| Frontend | Hub `fastapi-rbac-frontend` | React SPA served by **Nginx on port 80**; `VITE_API_BASE_URL` is typically **bake-time** ([Hub README](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-frontend)) |
| Worker | Hub `fastapi-rbac-worker` | Celery; Redis broker/backend; same DB/Redis/SMTP access as backend ([Hub README](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-worker)) |
| Postgres | **Not** a project Hub image | Postgres **12+** (managed or compose sidecar) |
| Redis | **Not** a project Hub image | Redis **5+** — Celery + token allowlist/blacklist ([backend Hub README](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-backend)) |
| SMTP | External or sidecar | Optional but required for password-reset email flows (`EMAILS_ENABLED`, `SMTP_*`) |

```text
[browser] --> frontend:80 (Nginx)
                 |
                 | API URL baked or proxied
                 v
              backend:8000 ----+---- Postgres
                 |             |
                 +---- Redis <-+---- Celery worker
                 |
              SMTP (optional but needed for resets)
```

---

## Platform shortlist (viability)

| Platform | Viability (1–2 sentences) |
| --- | --- |
| **Hetzner Cloud + Docker Compose** | Strongest cost/control fit: pull all three Hub images + official Postgres/Redis sidecars on one always-on VM; HTTPS via Caddy/Traefik/Let’s Encrypt. CX23 from **€5.49 / $6.49 per month excl. IPv4** (DE/FI, post–15 Jun 2026 adjustment) ([Hetzner price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)). |
| **DigitalOcean Droplet + Compose** | Same topology as Hetzner; clearer US docs/branding. Basic Droplets from **$4/mo** (512 MiB — too small) / practical staging from **$12–24/mo** (2–4 GiB) ([DO Droplet pricing](https://www.digitalocean.com/pricing/droplets)). |
| **Oracle Cloud Always Free + Compose** | Still real: Ampere A1 **1,500 OCPU-hours + 9,000 GB-hours/mo** (≈ **2 OCPU / 12 GB** for Always Free tenancies) plus two AMD micros ([OCI Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)). Viable **$0** path: Hub `:latest` is **multi-arch (`amd64` + `arm64`)** (verified 2026-07-25), so Ampere is image-compatible; account capacity and ops friction remain. |
| **Coolify on a VPS** | Self-hosted PaaS control plane on *your* server; free OSS, Cloud add-on from **$5/mo**; Docker-compatible services + Let’s Encrypt ([Coolify intro](https://coolify.io/docs/get-started/introduction)). Eases adopter UX without abandoning VPS economics. |
| **Railway** | Native **public Docker Hub** deploy + Postgres/Redis templates + auto SSL ([quick start](https://docs.railway.com/quick-start), [Postgres](https://docs.railway.com/databases/postgresql), [Redis](https://docs.railway.com/databases/redis), [public networking](https://docs.railway.com/networking/public-networking)). Free/$1 credit is **not** enough for this stack; Hobby **$5/mo** + usage is the realistic floor ([plans](https://docs.railway.com/pricing/plans)). |
| **Render** | Excellent Hub-image support for web/worker ([deploy image](https://render.com/docs/deploying-an-image)) and managed Postgres/Key Value, but **free web sleeps**, **no free workers**, free Postgres **expires in 30 days**, free Redis **non-persistent** ([free docs](https://render.com/docs/free)) — poor for Celery + allowlist. Paid staging ≈ tens of USD/mo. |
| **Fly.io** | Can deploy Hub images via `[build].image` / `fly deploy --image` ([deploy](https://fly.io/docs/launch/deploy/)); Machines PAYG (~**$2+/mo** per tiny always-on VM) ([pricing](https://fly.io/docs/about/pricing/)). Managed Postgres starts at **$38/mo** ([MPG](https://fly.io/docs/mpg/)) — expensive for staging unless you self-host Postgres on Machines + Upstash Redis. |
| **Briefly dismissed / optional** | **Google Cloud Run / Azure Container Apps / AWS Lightsail-ECS**: can run containers but multi-service + always-on worker + Redis/Postgres wiring is more complex/costly than VPS or Railway for this stack. **Kamal**: deploy tool onto a VPS you already own — orthogonal to “where to host.” **Northflank / Zeabur / Porter**: not required for cheapest/easiest defaults; evaluate later if a template marketplace is desired. |

---

## Comparison table

Ease / suitability scored **High / Med / Low** for *this* three-image + Postgres + Redis + always-on worker stack. Costs are **rough monthly floors** for small staging (3 app containers + Postgres + Redis); VAT, domains, and SMTP extra. **Subject to change.**

| Platform | Ease | Free/cheap cost | Hub-image fit | Managed Postgres/Redis | HTTPS | Staging suitability | Adopter suitability | Notes / caveats |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Hetzner + Compose** | Med | **~€6–10/mo** (CX23 €5.49 + Primary IPv4 **€0.50**/mo; excl. VAT) | **High** — `docker pull` public Hub | Sidecars (you run official images) or external managed | DIY (Caddy/Traefik + LE) | **High** | **High** (clear compose runbook) | Best $/always-on; you own ops. IPv4 is an add-on ([servers overview](https://docs.hetzner.com/cloud/servers/overview/)) |
| **DO Droplet + Compose** | Med | **~$12–24/mo** practical | **High** | Sidecars or DO Managed DB (extra) | DIY or DO LB | **High** | **High** | Similar to Hetzner; more $ |
| **Oracle Always Free + Compose** | Low–Med | **$0** (Always Free limits) | **High** (`arm64` + `amd64` on Hub) | Sidecars on free VM | DIY | Med (capacity/friction) | Med (account + ops) | Ampere now **2 OCPU / 12 GB** ([docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)); not “easy” |
| **Coolify + VPS** | Med–High UI | VPS cost (+ optional Coolify Cloud **$5/mo**) | **High** (Docker-compatible) | App-managed containers or external | Built-in LE ([intro](https://coolify.io/docs/get-started/introduction)) | **High** | **High** if docs lead with Coolify | Control-plane worth it for less YAML |
| **Railway** | **High** | Trial **$5** once; Free **$1**/mo useless for stack; Hobby **$5** + usage often **~$10–25+** | **High** public Hub ([quick start](https://docs.railway.com/quick-start)) | Yes (templates; usage-billed) | Auto SSL + custom domain ([networking](https://docs.railway.com/networking/public-networking)) | **High** (Hobby+) | **High** for PaaS preferrers | Free: 0.5 GB RAM/svc, 1 vol/project, peak-hour deploy limits ([plans](https://docs.railway.com/pricing/plans), [volumes](https://docs.railway.com/volumes/reference), [deploys](https://docs.railway.com/deployments/reference)) |
| **Render** | High UI | Free unsuitable; paid floor ~**$30–40+**/mo (2× Starter web/worker + Basic-256 Postgres + Starter KV) | **High** ([image deploy](https://render.com/docs/deploying-an-image)) | Yes ([pricing](https://render.com/pricing)) | Auto TLS + custom domains | Med (cost) | Med | Free web **spins down 15 min**; workers **not free**; free PG **30-day**; free KV **memory-only**; free web **blocks SMTP 25/465/587** ([free](https://render.com/docs/free)) |
| **Fly.io** | Med | Machines ~**$6–15** for 3 small VMs; MPG **$38+**; Upstash Redis free/PAYG | **High** (`image` in fly.toml) | MPG expensive; Upstash Redis ([docs](https://fly.io/docs/upstash/redis/)); self-host PG on Machines | Shared IPv4 + certs (first 10 hostnames free) ([pricing](https://fly.io/docs/about/pricing/)) | Med | Med | Celery polling can burn Upstash PAYG — prefer fixed Redis plan ([Fly Redis note](https://fly.io/docs/upstash/redis/)) |

---

## Recommended default for maintainer staging

**Primary recommendation: Hetzner Cloud CX23 (or CX33 if RAM is tight) + Docker Compose pulling the three Hub images + official `postgres` / `redis` sidecars + a reverse proxy for HTTPS.**

**Rationale**

1. **Always-on by default** — Celery worker and Redis-backed auth allowlists need processes that do not sleep. Render’s free web **spins down after 15 minutes idle** and **background workers have no Free instance type** ([Render free](https://render.com/docs/free); worker pricing starts at Starter **$7/mo** on [Render pricing](https://render.com/pricing)).
2. **Cheapest realistic always-on envelope** — CX23 is **€5.49 / $6.49 per month excl. IPv4** in DE/FI after the 15 Jun 2026 adjustment ([Hetzner docs](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)). Primary IPv4 adds **€0.50/mo** excl. VAT ([servers overview](https://docs.hetzner.com/cloud/servers/overview/)). Community/spec sheets describe CX23 as **2 vCPU / 4 GB / 40 GB** (confirm in Hetzner Console at order time). That is enough for a small staging compose stack; upgrade to CX33 (**€8.49 / $9.99** excl. IPv4) if memory pressure appears.
3. **Hub images are first-class** — staging exercises the same artifacts adopters pull (`docker pull mnaimfaizy/...`), matching [#96](https://github.com/mnaimfaizy/fastapi_rbac/issues/96) and Hub READMEs.
4. **Postgres/Redis as sidecars** — aligns with the locked decision not to publish those as product images; use upstream official images or later swap to managed DB without changing Hub app images.
5. **HTTPS** — terminate TLS on Caddy or Traefik with Let’s Encrypt on a staging domain you control (e.g. `staging.example.com`).

**Optional staging UX upgrade:** install **Coolify** on the same VPS (self-host free) for UI deploys, Hub image pulls, and automated certificates ([Coolify intro](https://coolify.io/docs/get-started/introduction)) — still recommend Compose/Coolify *on Hetzner* rather than a multi-$ PaaS for maintainer dogfood budget.

**SMTP for staging:** use a free transactional provider with SMTP relay (e.g. Resend Free: **3,000 emails/mo**, **100/day**, SMTP included on all plans — [Resend pricing](https://resend.com/pricing)), or disable email features and document that password reset is unverified on that environment.

---

## Recommended default for adopter cheapest clear start

**Primary recommendation (cheapest + clearest): same path as staging — “one small VPS + Compose file that pulls Hub images.”**

Lead adopters with a short runbook:

1. Create a VPS (≥ **2 vCPU / 4 GB**; Hetzner CX23-class or DigitalOcean **$12–24** Droplet).
2. Install Docker Engine + Compose plugin.
3. Copy a project-provided `compose` (future artifact) that references:
   - `mnaimfaizy/fastapi-rbac-backend:latest` (or pinned `vX.Y.Z`)
   - `mnaimfaizy/fastapi-rbac-frontend:…` (**rebuild or pin a tag baked for their API URL** — see constraints)
   - `mnaimfaizy/fastapi-rbac-worker:…`
   - `postgres:16` (or 12+) and `redis:7` (or 5+)
4. Set env from Hub / `backend/.env.example` placeholders.
5. Point DNS + enable HTTPS via Caddy/Traefik (or Coolify).

**Why not lead with “free PaaS”?** Render Free and Railway Free/$1 credit **cannot** honestly host this full stack always-on (sleeping web, no free workers, free PG expiry, free Redis non-persistence, $1 credit, 1 volume on Railway Free — sources in table). Marketing “free” would set adopters up to fail on Celery + Redis auth.

**Secondary adopter path (if they refuse SSH/VPS):** **Railway Hobby** — deploy three public Hub images + Postgres + Redis templates, generate domains, set variables ([Railway quick start — Docker image](https://docs.railway.com/quick-start), [plans](https://docs.railway.com/pricing/plans)). Expect **at least $5/mo** subscription and often **more** once five always-on services burn past the included **$5** usage credit (RAM **$10/GB-mo**, CPU **$20/vCPU-mo**, egress **$0.05/GB** — [plans](https://docs.railway.com/pricing/plans)).

---

## Alternative paths

| If you want… | Path | Rough cost | Caveat |
| --- | --- | --- | --- |
| **Fully managed PaaS** | Railway Hobby (or Render paid: web + worker + Postgres + Key Value) | Railway ~**$10–25+**/mo; Render ~**$30–40+**/mo | Frontend bake-time URL still friction; watch usage |
| **$0 compute** | Oracle Always Free Ampere (≤ **2 OCPU / 12 GB**) + Compose | **$0** | Account approval, capacity, higher ops (images are `arm64`-capable); limits reduced vs older 4/24 folklore ([OCI Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Free Tier overview](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)) |
| **PaaS UX on cheap metal** | Coolify (self-host) on Hetzner/DO | VPS only, or +**$5** Coolify Cloud | Still a server to patch |
| **Fly-native** | Three Fly apps from Hub images + self-hosted Postgres Machine + Upstash Redis | Highly variable; MPG alone **$38+** | Prefer fixed Upstash plan if Celery polls aggressively ([Fly Redis](https://fly.io/docs/upstash/redis/)) |
| **US-branded VPS** | DigitalOcean Droplet + Compose | **$12–24**/mo | Same runbook as Hetzner |

---

## Hosting constraints specific to this product

### 1. Frontend bake-time API URL

Hub frontend README states `VITE_API_BASE_URL` is used at **docker build** for Nginx/app config; runtime override may need “a more complex setup or a custom entrypoint,” otherwise **rebuild** with the correct build-arg ([frontend Hub](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-frontend)).

**Hosting implication:** platforms that only inject runtime env vars do **not** fix a published `latest` image built for `localhost` or a wrong API host. Staging/adopter docs must either:

- pin/rebuild frontend per environment API URL, or
- document a reverse-proxy same-origin layout (`/api` → backend) and an image built for that, or
- ship a future runtime-config entrypoint (open product decision — not in this research).

### 2. Always-on Celery worker

Worker has **no public HTTP port**; it must stay running and share Redis/DB with the API ([worker Hub](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-worker)). Platforms that sleep free web tiers or omit free background workers (Render Free) are a bad fit ([Render free](https://render.com/docs/free)).

### 3. Redis for auth allowlist / blacklist + Celery

Backend Hub documents Redis for token blacklisting; worker uses Redis as Celery broker/backend. Free Key Value on Render is **in-memory only** and **loses data on restart** ([Render free](https://render.com/docs/free)) — unsuitable for auth token state. Prefer persistent Redis (compose volume, Railway Redis, Upstash paid/fixed, etc.).

### 4. SMTP

Password reset and similar flows need `EMAILS_ENABLED` + `SMTP_*` ([backend Hub](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-backend)). Render Free web services **cannot send outbound traffic on ports 25, 465, or 587** ([Render free](https://render.com/docs/free)). Prefer HTTP-based email APIs or SMTP on paid/VPS hosts. Resend Free includes SMTP with daily caps ([Resend pricing](https://resend.com/pricing)).

### 5. CORS + dual public hostnames

If frontend and API are on different origins, `BACKEND_CORS_ORIGINS` must list the frontend origin ([backend Hub](https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-backend)). Same-origin proxy reduces CORS pain and can simplify frontend API URL.

### 6. Image platform / size

Render requires `linux/amd64` and compressed image ≤ **10 GB** ([deploying an image](https://render.com/docs/deploying-an-image)). Railway Free/Trial image size cap **4 GB** ([plans](https://docs.railway.com/pricing/plans)). All three published Hub `:latest` tags expose **`linux/amd64` and `linux/arm64`** (verified 2026-07-25 with `docker manifest inspect` for backend, frontend, and worker) — Oracle Ampere and Hetzner CAX are image-compatible; still confirm digest/tag at deploy time.

---

## Open decisions (for the next grill session)

1. **Managed vs compose sidecars for Postgres/Redis on staging** — sidecars keep cost ~VPS-only; managed improves backups/ops at higher $.
2. **Staging topology** — single VPS compose vs Railway project vs Coolify-on-VPS; one public staging URL vs separate API + web hostnames.
3. **Domain / HTTPS** — which domain for maintainer staging; Caddy vs Traefik vs Coolify LE; wildcard vs single host.
4. **SMTP provider** — Resend Free vs other; whether staging enables email at all.
5. **Frontend config strategy** — rebuild-per-env vs same-origin Nginx proxy vs invest in runtime config in the published image.
6. **Doc / script entrypoint** — single “Deploy Hub images” guide under `docs/deployment/` with VPS Compose first and Railway appendix; version-pin tags vs `:latest`.
7. **Coolify worth it?** — extra moving part for maintainers vs much better adopter UX.
8. **Oracle Always Free as documented “$0 path”** — document with hard caveats, or omit from primary path to avoid support burden.
9. **Worker scaling / Beat** — single worker enough for staging? Celery Beat container needed?
10. **Secrets & first superuser** — how staging seeds `SECRET_KEY` / `FIRST_SUPERUSER_*` without committing secrets.

---

## Sources appendix

### Product / issue

- Issue #96: https://github.com/mnaimfaizy/fastapi_rbac/issues/96
- Backend image: https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-backend
- Frontend image: https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-frontend
- Worker image: https://hub.docker.com/r/mnaimfaizy/fastapi-rbac-worker

### Hetzner / DigitalOcean / Oracle (VPS)

- Hetzner price adjustment (15 Jun 2026), CX23 **€5.49 / $6.49** excl. IPv4 (DE/FI): https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- Hetzner Cloud product: https://www.hetzner.com/cloud/
- Hetzner Cloud FAQ (shared vs dedicated): https://docs.hetzner.com/cloud/servers/faq/
- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets
- DigitalOcean Droplet billing docs: https://docs.digitalocean.com/products/droplets/details/pricing/
- Oracle Always Free resources: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Free Tier overview: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm

### Coolify

- Introduction (self-host free / Cloud from $5): https://coolify.io/docs/get-started/introduction

### Railway

- Plans & resource prices: https://docs.railway.com/pricing/plans
- Free trial ($5 / 30 days → Free $1/mo): https://docs.railway.com/pricing/free-trial
- Deploy from Docker image: https://docs.railway.com/quick-start
- Services / Hub images: https://docs.railway.com/services
- PostgreSQL template: https://docs.railway.com/databases/postgresql
- Redis template: https://docs.railway.com/databases/redis
- Public networking / SSL: https://docs.railway.com/networking/public-networking
- Volume limits (Free: 1 volume/project): https://docs.railway.com/volumes/reference
- Free-tier peak-hour deploy restriction: https://docs.railway.com/deployments/reference

### Render

- Pricing (web/worker/Postgres/Key Value): https://render.com/pricing
- Free instance limitations (sleep, PG 30-day, KV non-persistent, SMTP ports): https://render.com/docs/free
- Deploy prebuilt Docker image: https://render.com/docs/deploying-an-image

### Fly.io / Upstash / email

- Fly resource pricing: https://fly.io/docs/about/pricing/
- Fly deploy / image: https://fly.io/docs/launch/deploy/
- Fly Managed Postgres pricing: https://fly.io/docs/mpg/
- Upstash Redis on Fly: https://fly.io/docs/upstash/redis/
- Upstash Redis pricing (Free 256 MB / 500K commands): https://upstash.com/pricing/redis
- Resend pricing (Free 3,000/mo, SMTP): https://resend.com/pricing

---

## Confidence / source gaps

| Gap | Impact |
| --- | --- |
| Exact **maintainer** monthly Railway/Fly bill for *this* image set not measured live | Cost bands are rate-card estimates, not invoices |
| Hetzner Console live SKU page did not expose CX23 RAM in the fetched marketing HTML; **2 vCPU / 4 GB** taken from Hetzner ecosystem listings + price-adjustment SKU — **confirm in Console** before buying | Sizing risk |
| Linode/Akamai pricing page blocked from this research environment | Omitted from table; treat as DO-class VPS alternative |
| Hub `:latest` **multi-arch** verified (`amd64` + `arm64`) for all three images on 2026-07-25 | Oracle Ampere / Hetzner CAX are image-OK; pin digests in runbooks |
| Coolify “deploy Docker Hub image” wizard specifics not deeply fetched (intro confirms Docker-compatible deploy) | Coolify steps should be validated hands-on before docs |
| Product may later add runtime frontend config — would change PaaS friction | Track as open decision #5 |

**Do not implement hosting from this note until open decisions are grilled and a doc/script entrypoint is chosen.**
