# Oracle Always Free — first-time Hub runtime setup

**Created:** 2026-07-25
**Last verified:** 2026-07-25

Free, start/stop path to run the [Hub runtime](./index.md) package on Oracle Cloud Infrastructure (OCI) Always Free compute. Same Compose package can later run on any Docker VPS.

Primary sources for limits and Console flows (re-check when this guide ages):

- [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Creating an Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)
- [Virtual Networking Wizards](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/quickstartnetworking.htm)
- [Security Lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm)

## Staleness checklist — re-verify if any apply

Re-check this guide and bump **Last verified** when:

- [ ] This document is older than **6 months** since **Last verified**
- [ ] OCI Always Free shapes, home-region rules, or Ampere OCPU/memory hours change
- [ ] The Create Instance Console sections rename or reorder (Basic / Security / Networking / Storage)
- [ ] Hub image tags, required env vars, or health paths change
- [ ] Caddy / Docker Engine install steps fail on a fresh Ampere image
- [ ] Default security-list or NSG behavior for ports 22/80/443 changes

If several boxes apply, treat the guide as **out of date** until someone walks through a clean bring-up and updates the dates above.

---

## What you will end up with

| Piece | Choice |
| --- | --- |
| Compute | Always Free **`VM.Standard.A1.Flex`** (Ampere / `arm64`), **2 OCPU / 12 GB** in the tenancy **home region** |
| Package | [compose.yml](./compose.yml) — api, worker, beat, Postgres, Redis, Caddy |
| DNS | `rbac-api.mnfprofile.com` → instance **public IPv4** |
| TLS | Caddy + Let’s Encrypt |
| SMTP | Your external provider (required for full email flows) |

Frontend is not part of this package. Hub images are multi-arch (`linux/amd64` + `linux/arm64`), so Ampere is supported.

### Always Free limits that matter for this guide (as of Last verified)

Confirm live numbers on [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) before you click Create.

| Resource | Always Free envelope (home region) |
| --- | --- |
| Ampere A1 | First **1,500 OCPU-hours** + **9,000 GB-hours** / month ≈ **2 OCPU + 12 GB** for Always Free–only tenancies (`VM.Standard.A1.Flex`) |
| AMD micros | Up to **two** `VM.Standard.E2.1.Micro` (fallback if Ampere has no capacity) |
| Block storage | **200 GB** total (boot + data volumes combined) |
| Default boot volume | **50 GB** (counts toward the 200 GB) |
| Idle reclaim | Always Free VMs may be reclaimed if underused for **7 days** (CPU / network / memory thresholds — see Oracle’s Idle Compute Instances note) |

**Recommendation for Hub runtime:** one Ampere VM at **2 OCPU / 12 GB**, boot volume **100 GB** (leaves 100 GB headroom in the 200 GB pool). Do not create extra Always Free VMs you do not need.

---

## Prerequisites

- Oracle Cloud account that still has Always Free eligibility
- Work in the tenancy **home region** (Always Free compute must be created there)
- Ability to create a DNS `A` record for `rbac-api.mnfprofile.com` (or your `DOMAIN`)
- SMTP credentials for production-like email
- A local SSH client (OpenSSH on Windows / macOS / Linux)
- Optional but recommended: your own SSH key pair (`ssh-keygen -t ed25519`)

Console tip: set the **region** selector (top right) to your **home region** before any of the steps below.

---

## 0. Compartment and region

1. Sign in to the [OCI Console](https://cloud.oracle.com/).
2. Confirm the region is your **home region**.
3. Note the **compartment** you will use (usually the root compartment named like your tenancy, or a child compartment you created).
   On list pages, use **List Scope → Compartment** so you do not create resources in the wrong place.

---

## 1. Create a VCN with internet connectivity (do this first)

Oracle recommends creating the VCN **before** the first instance ([Creating an Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)).

Use the **Create a VCN with Internet Connectivity** wizard ([Virtual Networking Wizards](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/quickstartnetworking.htm)). It creates:

- A VCN
- An **internet gateway**, NAT gateway, and service gateway
- A **regional public subnet** (routed to the internet gateway)
- A regional private subnet (not used for this guide)
- Basic security-list rules (including SSH)

### Steps

1. Open the navigation menu → **Networking** → **Virtual cloud networks** (or **Networking** → **Overview**).
2. Select **Start VCN Wizard** (sometimes under **Actions**).
3. Choose **Create VCN with Internet Connectivity** → **Start VCN Wizard**.
4. Fill in roughly:

   | Field | Suggested value |
   | --- | --- |
   | VCN name | `vcn-hub-runtime` |
   | Compartment | Your working compartment |
   | VCN IPv4 CIDR | Default is fine (often `10.0.0.0/16`) |
   | Public subnet name | `subnet-hub-runtime-public` |
   | Public subnet CIDR | Default is fine (often `10.0.0.0/24`) |
   | Private subnet | Keep defaults (unused for this guide) |
   | Use DNS hostnames in this VCN | Enabled (recommended) |

5. Review → **Create**.
6. Wait until the workflow finishes, then open the new VCN and note:
   - VCN name
   - **Public** subnet name
   - Default **Security List** name for the public subnet

You only need this once. Later instances can reuse the same VCN and public subnet.

---

## 2. Security list: SSH + HTTP/HTTPS

The wizard opens **SSH (22)** by default. Hub runtime also needs **80** and **443** for Caddy / Let’s Encrypt. Do **not** open Postgres `5432`, Redis `6379`, or API `8000` to the internet.

1. Navigation menu → **Networking** → **Virtual cloud networks** → open `vcn-hub-runtime`.
2. Under **Resources**, open **Security Lists** → open the security list attached to the **public** subnet (often **Default Security List for vcn-hub-runtime**).
3. Select **Add Ingress Rules** and add **stateful** rules (leave **Stateless** cleared):

| Description | Source type | Source CIDR | IP protocol | Destination port range |
| --- | --- | --- | --- | --- |
| SSH (prefer lock-down) | CIDR | `YOUR.PUBLIC.IP.0/32` or `0.0.0.0/0` | TCP | `22` |
| HTTP (ACME + redirect) | CIDR | `0.0.0.0/0` | TCP | `80` |
| HTTPS (API) | CIDR | `0.0.0.0/0` | TCP | `443` |

Notes:

- Prefer restricting SSH to your current public IP (`x.x.x.x/32`). If your ISP changes IPs, update the rule or you will lock yourself out.
- Source port range: **All**.
- If the wizard already created an SSH rule from `0.0.0.0/0`, you can edit it to your `/32` instead of adding a duplicate.
- Optional: use a **Network Security Group (NSG)** instead of (or in addition to) the security list when you create the instance; rules are equivalent for this guide. See [Security Lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm).

Egress: default “allow all” is fine so the VM can pull Docker Hub images and talk to SMTP / Let’s Encrypt.

---

## 3. Create the compute instance (granular Console settings)

Navigation menu → **Compute** → **Instances** → set **List Scope** compartment → **Create instance**.

The workflow has four sections matching Oracle’s docs: **Basic information**, **Security**, **Networking**, **Storage**, then review ([Creating an Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)). Console labels can vary slightly; fill every required field even if the order differs.

### 3.1 Basic information

| Setting | Recommended value | Why |
| --- | --- | --- |
| Name | `hub-runtime-af` | Friendly label; OCID is the real id |
| Create in compartment | Same as VCN | Keeps resources together |
| Placement → Availability domain | Prefer **AD-2** or **AD-3** first if AD-1 often fails in your region; rotate on capacity errors | Always Free Ampere capacity is scarce |
| Capacity type | **On-demand capacity** (default) | Do not use preemptible for this stack |
| Fault domain | **Do not pick a fault domain** — leave Oracle to choose | Specifying one can worsen “Out of capacity” errors |

#### Image

1. Select **Change image**.
2. Choose **Ubuntu** (or Oracle Linux if you prefer).
3. Pick a current **Always Free–eligible** image for **aarch64 / Arm** (name usually includes `aarch64` or Arm).
   Example target: recent **Canonical Ubuntu** LTS aarch64 marked Always Free Eligible.
4. Accept Oracle’s terms if prompted → **Select image**.

Do **not** pick an `amd64`/`x86_64`-only image for `VM.Standard.A1.Flex`.

#### Shape

1. Select **Change shape**.
2. Shape series → **Ampere**.
3. Select **`VM.Standard.A1.Flex`** (Always Free–eligible).
4. Set sliders:

   | Resource | Value |
   | --- | --- |
   | Number of OCPUs | **2** |
   | Amount of memory (GB) | **12** |

5. Leave burstable / extended memory **off**.
6. Select **Select shape**.

#### If you see: “Out of capacity for shape VM.Standard.A1.Flex in availability domain …”

This is **regional host shortage**, not a bad image/SSH/VCN setting. Oracle’s own Always Free note: try another AD, or wait and retry ([Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)).

Do this in order:

1. **Clear Fault domain** — in Placement → Advanced options, do **not** pin a fault domain; let OCI choose.
2. **Switch Availability domain** — retry Create with **AD-2**, then **AD-3** (wording varies: `…-AD-2`, `…-AD-3`). Your error was **AD-1**; skip it for a while.
3. **Retry at off-peak times** — capacity often frees overnight / weekends; keep the same form filled and click Create again later.
4. **Shrink temporarily (optional)** — try **1 OCPU / 6 GB** once to grab a slot, then **Edit** → resize toward **2 / 12** when capacity appears (resize can also hit capacity).
5. **AMD fallback (Always Free)** — Shape series → **Specialty and previous generation** → **`VM.Standard.E2.1.Micro`**, with an **x86_64** Always Free Ubuntu/Oracle Linux image. You may run **two** micros; the full Hub Compose stack is tight on ~1 GB RAM — expect swap pressure or a slimmed stack. Prefer Ampere when capacity returns.
6. **Do not** “fix” capacity by picking a paid larger shape unless you accept leaving Always Free (costs apply above Always Free).

Scripted retries (optional): some people poll `LaunchInstance` via OCI CLI/API across ADs; the Console rotate/retry loop above is enough for this guide.

#### Basic advanced options (optional)

Leave defaults unless you know you need them:

- Instance metadata: prefer requiring IMDSv2 / authorization header if the image supports it
- Initialization script: leave empty (we install Docker manually)
- Oracle Cloud Agent plugins: defaults are fine

### 3.2 Security

| Setting | Recommended value |
| --- | --- |
| Shielded instance | **Off** (unless you have a requirement and the shape/image support it) |
| Confidential computing | **Off** |
| Security attributes (ZPR) | Skip unless your tenancy requires them |

### 3.3 Networking (Primary VNIC)

| Setting | Recommended value |
| --- | --- |
| Primary network | **Select existing virtual cloud network** → `vcn-hub-runtime` |
| Subnet | **Select existing subnet** → **public** subnet `subnet-hub-runtime-public` |
| Public IPv4 address | **Assign a public IPv4 address** → **Yes** (required for SSH + Caddy from the internet) |
| Private IPv4 | Automatically assign (default) |
| IPv6 | Off unless you already designed DNS/firewall for it |
| Use NSGs | Optional; if used, attach an NSG that allows 22/80/443 as in §2 |
| DNS record / hostname | Optional; e.g. hostname `hub-runtime` |

**Do not** place this instance only in the **private** subnet for this guide (no public IP without Bastion).

#### SSH keys

Under **Add SSH keys**, pick one:

| Option | When to use |
| --- | --- |
| **Upload public key files (.pub)** or **Paste public keys** | Recommended if you already have `~/.ssh/id_ed25519.pub` |
| **Generate a key pair for me** | Fine for first time — **Save private key** immediately; you cannot download it later |
| **No SSH keys** | Do **not** use — you will not be able to log in |

Private key hygiene: store only on your workstation; never commit it to the repo.

### 3.4 Storage

| Setting | Recommended value |
| --- | --- |
| Boot volume size | Enable **Specify a custom boot volume size** → **100** GB |
| Boot volume performance | **Balanced** (default) |
| Encrypt with your own Vault key | Off (Oracle-managed encryption is enough for this validation host) |
| In-transit encryption | Default / enabled if offered for VMs |
| Additional block volumes | **None** for first bring-up (boot 100 GB is enough for images + Compose volumes) |

Remember: boot size counts against the **200 GB** Always Free block budget.

### 3.5 Review and create

1. Review shape (**A1.Flex / 2 / 12**), image (aarch64), public subnet, **public IP = Yes**, SSH key present, boot **100 GB**.
2. Select **Create**.
3. Wait until lifecycle state is **Running** (can take a few minutes).
4. On the instance details page, copy **Public IP address**.

If creation fails with **Out of host capacity**, change availability domain and retry, wait and retry, or use the AMD micro fallback (see §3.1).

---

## 4. First SSH login

From your workstation (replace IP and key path):

```bash
# Ubuntu images (typical):
ssh -i ~/.ssh/id_ed25519 ubuntu@YOUR.PUBLIC.IP

# Oracle Linux images (typical):
ssh -i ~/.ssh/id_ed25519 opc@YOUR.PUBLIC.IP
```

Accept the host key fingerprint on first connect.

If SSH times out:

1. Instance is **Running**
2. Security list / NSG allows TCP 22 from your IP
3. You used the **public** subnet and assigned a **public** IP
4. You are using the matching private key

---

## 5. Host firewall (inside the VM)

OCI security lists are not the only filter. Configure the guest firewall so 80/443 are open **after** SSH is allowed.

### Ubuntu (`ufw`)

Ubuntu Minimal on OCI often has **no `ufw` package** yet (`ufw: command not found`). Install it first, allow SSH **before** enabling, then open HTTP/HTTPS:

```bash
sudo apt-get update
sudo apt-get install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Oracle Linux (`firewalld` — if active)

```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Some Oracle Linux images also use `iptables`/`nftables` rules from cloud-init; if ports still fail after security-list + firewalld, inspect `sudo iptables -L -n` / `sudo nft list ruleset`.

---

## 6. DNS

Create an **A** record before Let’s Encrypt:

```text
rbac-api.mnfprofile.com  →  <instance public IPv4>
```

Check from your laptop:

```bash
nslookup rbac-api.mnfprofile.com
# or: dig +short rbac-api.mnfprofile.com
```

Wait until it resolves to the instance IP before running `bootstrap.sh` (Caddy needs a matching hostname).

---

## 7. Install Docker Engine + Compose plugin

On the instance, follow Docker’s current docs for your OS/arch:

- [Install Docker Engine](https://docs.docker.com/engine/install/)
- Confirm Compose v2 plugin: `docker compose version`

Then:

```bash
sudo usermod -aG docker "$USER"
# log out and back in (or new SSH session)
docker run --rm hello-world
```

Use the **aarch64** engine packages on Ampere (Docker’s Ubuntu/Debian Arm64 repos).

---

## 8. Fetch the Hub runtime files

```bash
sudo apt-get update && sudo apt-get install -y git   # Ubuntu; use dnf on Oracle Linux
git clone https://github.com/mnaimfaizy/fastapi_rbac.git
cd fastapi_rbac/docs/deployment/hub-runtime
```

---

## 9. Configure and bootstrap

```bash
cp env.example .env
# Set at least:
#   IMAGE_TAG=vX.Y.Z          # pin a release
#   DOMAIN=rbac-api.mnfprofile.com
#   FIRST_SUPERUSER_EMAIL=...
#   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / EMAILS_FROM_EMAIL
# Admin UI host (when rbac.mnfprofile.com is live — see env.example):
#   FRONTEND_URL / EMAIL_VERIFICATION_URL / PASSWORD_RESET_URL
#   BACKEND_CORS_ORIGINS=["https://rbac.mnfprofile.com"]
nano .env   # or vim

chmod +x bootstrap.sh
./bootstrap.sh
```

`bootstrap.sh` fills empty `SECRET_KEY` / DB / Redis / superuser password fields, pulls Hub images, starts Compose, and waits for API health.

The API container entrypoint runs migrations and initial data (including the first superuser).

When the [Admin UI host](../admin-ui/index.md) is deployed, keep those CORS / `FRONTEND_URL` / email link values on the UI origin and recreate the API container after editing `.env`.

---

## 10. Smoke-test the full API flow

```bash
curl -fsS "https://rbac-api.mnfprofile.com/api/v1/health"
# OpenAPI UI: https://rbac-api.mnfprofile.com/docs
```

Exercise login, a password-reset email (SMTP), and confirm worker/beat stay up:

```bash
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs -f worker beat
```

With the Admin UI host live, also open `https://rbac.mnfprofile.com`, confirm login (no CORS errors), and that reset/verify email links use that host.

---

## 11. Stop when you are not testing

```bash
cd ~/fastapi_rbac/docs/deployment/hub-runtime   # or your path
docker compose --env-file .env -f compose.yml down
```

Optional: in Console → instance → **Stop** until the next test (avoids burning Always Free hours while idle; also reduces idle-reclaim risk from low utilization).

Volumes retain Postgres/Redis/Caddy/Beat data until you `docker compose down -v` or delete the boot volume with the instance.

---

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Out of capacity for `VM.Standard.A1.Flex` in AD-* | See §3.1 callout: no fault domain → other AD → retry later → optional 1/6 → AMD `E2.1.Micro` fallback; home region only |
| Create instance: shape disabled | Image arch mismatch (need aarch64 for A1) or limit exhausted |
| SSH timeout | Public IP assigned; public subnet; security list TCP/22; correct user (`ubuntu` / `opc`) |
| ACME / TLS fails | DNS A record; OCI **and** guest firewall allow 80/443; `DOMAIN` matches cert name |
| API unhealthy | `docker compose logs api`; DB/Redis health; `IMAGE_TAG` exists on Docker Hub |
| Email never arrives | `EMAILS_ENABLED`, SMTP_*; provider allowlist for OCI egress IPs |
| Redis auth errors | `REDIS_PASSWORD` in `.env` must match Compose `requirepass` |
| Unexpected bill | Confirm resources stay within Always Free and home region; delete unused volumes |

---

## After first success

1. Update **Last verified** at the top of this file to today’s date.
2. Clear or refresh the staleness checklist.
3. Prefer pinned `IMAGE_TAG` values that match [GitHub Releases](https://github.com/mnaimfaizy/fastapi_rbac/releases) / Docker Hub.

## Related

- [Hub runtime index](./index.md)
- [Hosting research](../../internal/research/hosting-docker-hub-images.md)
- [ADR 0003](../../adr/0003-hub-runtime-oracle-compose.md)
