# Admin UI host

Deploy the **admin UI** as a static SPA on a static host. This package is **not** part of the [Hub runtime](../hub-runtime/index.md).

| Piece | Maintainer dogfood |
| --- | --- |
| Host | cPanel shared hosting (Apache / LiteSpeed) |
| Public UI | `https://rbac.mnfprofile.com` |
| API (cross-origin) | `https://rbac-api.mnfprofile.com` |
| Build | GitHub Actions on `v*` release tags + manual `workflow_dispatch` |
| Serve | Static `dist/` + SPA `.htaccess` (not Node.js on cPanel) |

## Contents

| Artifact | Purpose |
| --- | --- |
| [cPanel setup](./cpanel-setup.md) | Subdomain, docroot, secrets, first deploy |
| [`.github/workflows/admin-ui-cpanel-deploy.yml`](../../../.github/workflows/admin-ui-cpanel-deploy.yml) | Named jobs: build → upload → smoke |
| `react-frontend/public/.htaccess` | Copied into `dist/` for SPA route fallback |

## Quick mental model

```text
Browser  →  https://rbac.mnfprofile.com     (Admin UI host, static)
         →  https://rbac-api.mnfprofile.com  (Hub runtime API, CORS + cookies)
```

Build-time env (dogfood):

```bash
VITE_API_BASE_URL=https://rbac-api.mnfprofile.com/api/v1
```

On the Hub runtime host, set at least:

```bash
FRONTEND_URL=https://rbac.mnfprofile.com
EMAIL_VERIFICATION_URL=https://rbac.mnfprofile.com/verify-email
PASSWORD_RESET_URL=https://rbac.mnfprofile.com/reset-password
BACKEND_CORS_ORIGINS=["https://rbac.mnfprofile.com"]
```

Then recreate/restart the API container so CORS and email links pick up the new values.

## Adopter options (secondary)

1. **Any static host** (Vercel, Cloudflare Pages, Netlify, other cPanel): same build env + CORS/FRONTEND_URL on your API.
2. **Hub image** `mnaimfaizy/fastapi-rbac-frontend`: nginx container with same-origin `/api` proxy — use when you want UI next to the API in Compose/k8s, not the default Admin UI host path.

## Related

- ADR: [0004 — Admin UI host on cPanel](../../adr/0004-admin-ui-host-cpanel.md)
- Hub runtime: [index](../hub-runtime/index.md) · [env.example](../hub-runtime/env.example)
- React deployment notes: [frontend/react/deployment.md](../../frontend/react/deployment.md)
