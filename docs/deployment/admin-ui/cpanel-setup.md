# Admin UI host — cPanel setup

**Created:** 2026-07-25
**Last verified:** 2026-07-25

First-time path to serve the Admin UI host on cPanel at `rbac.mnfprofile.com`, deployed by GitHub Actions on product releases.

## Staleness checklist — re-verify if any apply

- [ ] This document is older than **6 months** since **Last verified**
- [ ] cPanel subdomain / FTP UI labels change
- [ ] Release trigger or required GitHub secrets/variables change
- [ ] Vite build env names or SPA rewrite needs change

---

## 1. Create the subdomain

In cPanel → **Domains** / **Subdomains**:

| Field | Value |
| --- | --- |
| Subdomain | `rbac` |
| Domain | `mnfprofile.com` |
| Document root | e.g. `rbac.mnfprofile.com` or `public_html/rbac` (note the path) |

Ensure AutoSSL (or equivalent) issues HTTPS for `rbac.mnfprofile.com`.

DNS: if the subdomain is not auto-created, add an `A` (or `CNAME`) record for `rbac` to your shared-hosting target.

```bash
nslookup rbac.mnfprofile.com
```

---

## 2. GitHub configuration

### Repository variables

| Name | Example |
| --- | --- |
| `ADMIN_UI_VITE_API_BASE_URL` | `https://rbac-api.mnfprofile.com/api/v1` |
| `ADMIN_UI_PUBLIC_URL` | `https://rbac.mnfprofile.com` |

### Repository secrets

Create an FTP (or FTPS) account in cPanel that can write to the subdomain document root.

| Name | Purpose |
| --- | --- |
| `UI_FTP_SERVER` | Host (often your domain or a host like `ftp.mnfprofile.com`) |
| `UI_FTP_USERNAME` | FTP username |
| `UI_FTP_PASSWORD` | FTP password |
| `UI_FTP_SERVER_DIR` | Remote directory for the docroot (e.g. `/rbac.mnfprofile.com/` — trailing slash recommended) |

These are separate from the MkDocs deploy secrets (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, …). Do not commit these values.

---

## 3. Align Hub runtime env

On the Oracle (or other) Hub runtime host, update `.env` as in [Admin UI host overview](./index.md), then:

```bash
cd ~/fastapi_rbac/docs/deployment/hub-runtime   # or your path
docker compose --env-file .env -f compose.yml up -d api
```

---

## 4. Deploy

**Automatic after Release PR merge:** `release-tag-on-merge` dispatches this workflow with `ref=vX.Y.Z` (same reason Docker Publish is dispatched: `GITHUB_TOKEN` tag pushes do not start other workflows).

**Also:** a human-pushed `v*` tag starts this workflow directly.

**Manual:** Actions → **Admin UI cPanel Deploy** → **Run workflow** (optional `ref`).

Jobs (separate names):

1. `build-admin-ui-assets` — `npm ci` + production build + artifact
2. `upload-admin-ui-cpanel` — FTP sync of `dist/`
3. `smoke-admin-ui-https` — HTTPS check of `ADMIN_UI_PUBLIC_URL`

---

## 5. Smoke-test

```bash
curl -fsSI "https://rbac.mnfprofile.com/"
# Log in against the live API; confirm no CORS errors in the browser
# Trigger a password-reset email and confirm the link uses rbac.mnfprofile.com
```

Client-side routes (e.g. `/reset-password`) must not 404 on refresh — that is what `.htaccess` is for.

---

## Manual upload fallback

If Actions secrets are not ready:

```bash
cd react-frontend
export VITE_API_BASE_URL=https://rbac-api.mnfprofile.com/api/v1
npm ci --legacy-peer-deps
npm run build
# Upload contents of dist/ into the subdomain document root (include .htaccess)
```
