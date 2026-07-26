# Oracle Always Free — split Hub runtime across VMs (private VCN)

**Date:** 2026-07-26
**Repo:** [mnaimfaizy/fastapi_rbac](https://github.com/mnaimfaizy/fastapi_rbac)
**Related:** [Hub runtime](../../deployment/hub-runtime/index.md), [ADR 0003](../../adr/0003-hub-runtime-oracle-compose.md), prior [hosting research](./hosting-docker-hub-images.md)
**Status:** Research complete — **locked** as optional alternative (2026-07-26): two AMD micros + Neon + Upstash; see [split-managed-data.md](../../deployment/hub-runtime/split-managed-data.md) and [ADR 0005](../../adr/0005-hub-runtime-split-managed-data.md). Single-VM Compose remains the default.

**Primary sources**

- [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) (Oracle docs; Ampere allocation as published mid‑2026)
- [Private IP Addresses](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingIPaddresses.htm)
- [VCN FAQ](https://www.oracle.com/cloud/networking/virtual-cloud-network/faq/)
- Community confirmation of Ampere cut to 2 OCPU / 12 GB: [Cloud Customer Connect](https://community.oracle.com/customerconnect/discussion/970310/oci-always-free-updated-ampere-a1-compute-allocation) (secondary; numbers match official docs)

---

## Question

Can we host **Postgres, Redis, and workers on separate machines** from the API on Oracle Always Free, with the API connecting over a **private VCN** “as one network”? Is that feasible given instance limits? What should an alternative procedure look like?

---

## Always Free compute budget (home region)

| Resource | Always Free envelope (official docs) |
| --- | --- |
| **Ampere A1** (`VM.Standard.A1.Flex`) | **2 OCPU + 12 GB RAM total** per tenancy (1,500 OCPU-hours / 9,000 GB-hours per month). Split as **one** 2‑OCPU instance **or up to two** 1‑OCPU instances. |
| **AMD micro** (`VM.Standard.E2.1.Micro`) | **Up to two** instances (separate from Ampere pool). ~1/8 OCPU, **1 GB RAM** each (shape fixed). |
| **Block volume** | **200 GB total** boot + data (all instances combined). Default boot ~50 GB each → four boots ≈ full quota. |
| **VCN** | Free Tier–only tenancies: up to **2 VCNs**. Private + public subnets supported. |
| **Idle reclaim** | Always Free VMs may be reclaimed if CPU/network/(A1) memory stay under ~20% for 7 days. |

**Implication:** You cannot honestly run four full-size VMs (API / worker / Postgres / Redis) each with comfortable RAM on Always Free. You get at most **~4 VMs** if you use **2× A1 (1 OCPU each) + 2× AMD micro**, but the micros are **1 GB RAM** — poor homes for Postgres or Celery under load — and disk fills quickly.

---

## Private networking — is it possible?

**Yes.** OCI VCNs are designed for this:

- Every instance gets a **private IP** in its subnet.
- Instances in the same VCN communicate on private IPs when **security lists / NSGs** allow the ports (OCI is allow-list; same-subnet traffic is not automatically open for every port).
- Data-plane VMs (DB/Redis/worker) can omit public IPs; use a **private subnet** + **NAT gateway** for outbound (image pulls, apt) if needed.
- Only the API/edge VM (or a load balancer) needs a public IP + Internet Gateway for HTTPS.

This matches “one network” for Hub runtime env vars: `DATABASE_HOST=<private-ip-or-dns>`, `REDIS_HOST=…`, Celery broker URL pointing at Redis private address.

**Caveat:** Host firewalls (`ufw`) and NSG rules must allow **5432**, **6379**, and any app ports between CIDRs. Do not publish Postgres/Redis on `0.0.0.0/0`.

---

## Managed Always Free alternatives (usually a bad fit here)

| Service | Always Free? | Fit for Hub runtime |
| --- | --- | --- |
| **Autonomous AI Database** | Yes — **2×**, 20 GB each | **Wrong engine** for this product (app is **PostgreSQL**). Not a drop-in. |
| **OCI Cache (Redis-compatible)** | **Not** Always Free (paid) | Good architecture later; not $0. |
| **Flexible / Network LB** | One Always Free LB each (bandwidth-limited) | Optional front for API; does not replace Redis/Postgres. |

So “split” on Always Free still means **self-hosted Postgres + Redis on compute**, not managed Redis + Postgres on Free Tier.

---

## Realistic topologies on Always Free

### A. Keep single-VM Hub Compose (current path)

Leave as-is: API + worker + beat + Postgres + Redis + Caddy on one A1.
**Pros:** Documented, simplest, one IP.
**Cons:** Memory pressure / SSH flakiness under load (what you hit).

### B. Two Ampere VMs (recommended split if staying on Always Free)

Resize/split the **2 OCPU / 12 GB** pool into two **1 OCPU / ~6 GB** A1 instances in the **same VCN**:

| VM | Public IP? | Runs |
| --- | --- | --- |
| **edge-api** | Yes | Caddy + `fastapi-rbac-backend` |
| **data-worker** | No (private) preferred | Postgres + Redis + worker + beat |

API `.env`: `DATABASE_HOST` / `REDIS_HOST` = private DNS or IP of **data-worker**.
Security lists: VCN CIDR → 5432, 6379; internet → 22/80/443 only on **edge-api**.

**Pros:** Isolates DB/Redis/worker CPU/RAM from API; still $0; true private backend.
**Cons:** Two boots eat ~100 GB of 200 GB; capacity errors on create; more ops; idle reclaim on both.

### C. Add AMD micros as tiny sidecars

Use **2× E2.1.Micro** for Redis-only and/or a tiny utility host.
**Pros:** Extra free boxes.
**Cons:** **1 GB RAM** — Postgres on a micro is fragile; Celery worker on a micro is fragile. Use micros only for Redis (maybe) or bastion, not primary DB.

### D. Hybrid “three roles” without four fat VMs

Example: **edge-api** (A1) + **data** (A1: Postgres+Redis) + **worker** on same data VM (not separate). That is still topology **B**, not four machines.

True four-way split (API | worker | Postgres | Redis) needs **paid** OCPUs or leaving Always Free.

### E. Leave Oracle Compose; paid small VPS for “split feel”

Same Compose or split on Hetzner/etc. when Always Free friction dominates. Out of scope for “is Always Free capable?” but valid product decision later.

---

## App / package implications (if we document path B)

Hub runtime today assumes Compose DNS names `db` / `redis` on one network. A multi-VM alternative would need:

- Compose overlays or separate unit files per role
- `.env` with private hosts (not `db` / `redis` service names unless using an overlay network product — on OCI use private IP or VCN DNS)
- Security-list runbook
- Optional: stop publishing Redis/Postgres ports publicly (already true in single Compose)

No code change required if env points at reachable Postgres/Redis; Celery worker must share broker Redis with API.

---

## Verdict

| Question | Answer |
| --- | --- |
| Possible on Always Free? | **Yes, partially** — private VCN multi-VM is supported. |
| Separate machine per Postgres, Redis, worker, API? | **Not realistically** within Free limits (RAM + disk + A1 cap). |
| Sensible alternative? | **Two A1 VMs**: edge (API+Caddy) + data-worker (Postgres+Redis+Celery), private links. |
| Keep current single-VM path? | **Yes** — still the simplest dogfood; treat split as optional hardening. |

---

## Suggested next decision (for grill / ADR later)

1. **Document topology B** as “Hub runtime — split Always Free (optional)” beside single-VM Compose.
2. Or **defer** until single-VM SSH/OOM is stable.
3. Or **exit Always Free** for multi-node if four-way isolation is a hard requirement.

Do not replace Autonomous DB for Postgres without an explicit product decision (different database).
