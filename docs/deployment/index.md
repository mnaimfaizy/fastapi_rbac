# Deployment Guide

This section covers how to deploy the application to production.

- **[Hub runtime](./hub-runtime/index.md):** Pull published Docker Hub API images (backend + worker/beat) with Postgres, Redis, Caddy, and external SMTP. Start here for production-shaped validation.
- **[Oracle Always Free setup](./hub-runtime/oracle-always-free-setup.md):** First-time free OCI environment for the Hub runtime (dated; re-verify when stale).
- **[Hub runtime split + managed data](./hub-runtime/split-managed-data.md):** Optional: AMD micro API+Caddy, second micro worker+Beat (stop when idle), Neon + Upstash.
- **[Admin UI host](./admin-ui/index.md):** Static admin UI on cPanel (`rbac.mnfprofile.com`), release-only GitHub Actions deploy, cross-origin to the Hub runtime API.
- **[cPanel Admin UI setup](./admin-ui/cpanel-setup.md):** First-time subdomain, FTP secrets, and smoke checks (dated; re-verify when stale).
- **[Production Deployment](./production-deployment-guide.md):** A step-by-step guide for deploying the application.
