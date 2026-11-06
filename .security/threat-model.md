# FastAPI RBAC threat model

This is the threat pack for the Agent-kit security audit (`.github/workflows/agent-kit-security-audit.yml`). It covers the Hub runtime (the FastAPI backend, Celery worker and Beat, Postgres, Redis), the admin UI, and the CI/CD and agent automation in this repository. This repository is public, and so is this file. It describes design intent and where to look. It never describes a live weakness.

Canonical behaviour lives in [`docs/reference/architecture.md`](../docs/reference/architecture.md) and the ADRs under [`docs/adr/`](../docs/adr/). Terms in **bold** are defined in [`CONTEXT.md`](../CONTEXT.md).

> Draft, seeded from the architecture page and ADRs 0006, 0007, 0010, 0011 and 0013. Review it before the first audit run.

## Assets

| Asset | Where | Why it matters |
| --- | --- | --- |
| User credentials | `User` rows (bcrypt hashes), password history | Takeover of any account; reuse elsewhere |
| Superuser and admin authority | Roles and permissions on protected routes; first-superuser bootstrap settings | Full control of every **user**, **role** and **permission** |
| JWT signing keys | `SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`, `JWT_RESET_SECRET_KEY` | Forging access, refresh or reset tokens bypasses authentication |
| Other application secrets | `ENCRYPT_KEY`, database, Redis and SMTP credentials in the runtime environment | Data access, mail sending as the product |
| The token **Allowlist** | Redis `user:{id}:{token_type}` sorted sets (`backend/app/utils/token.py`) | The sole session revocation mechanism (ADR 0011). Write access mints or keeps sessions alive |
| Refresh tokens | HttpOnly cookie scoped to `{API_V1_STR}/auth` (ADR 0006) | Long-lived **session** takeover |
| Verification and reset tokens | Emailed links; Redis entries checked by verify-email and reset-confirm | Account activation or password change for another person's address |
| Audit log | `AuditLog` rows written by `log_security_event` | The only record of which uniform-rejection branch ran (ADR 0010). Compliance trail that outlives users (ADR 0013) |
| Account-existence secrecy | Registration, resend, verify-email and password-reset responses | The **uniform registration response** and **uniform token-flow rejection** invariants (ADR 0007, ADR 0010) |
| **Client address** integrity | `backend/app/utils/client_address.py`, `TRUSTED_PROXIES` | Feeds the **HTTP rate limit**, security events and **origin network** detection at once |
| Release and deploy credentials | `DOCKERHUB_*`, `FTP_*`, `UI_FTP_*`, `CODECOV_TOKEN`, `GRAPHIFY_PR_TOKEN` Actions secrets | Publish a poisoned image or admin UI build |
| Release tags and published images | `v*` tags trigger `docker-publish.yml`; Docker Hub images are the Hub runtime | Whoever pushes a tag ships to every operator |
| Agent credentials | `CLAUDE_CODE_OAUTH_TOKEN`, `AGENT_KIT_ADVISORIES_TOKEN` | Model spend; draft-advisory writes. The advisories token must never reach an agent |
| Security findings | Private draft advisories only | Public-log rule: never in Actions logs, artifacts, issues, PRs, or the findings ledger |

## Trust boundaries

1. **Browser and API client → backend.** Everything in a request is untrusted: body, headers, cookies, path and query. Identity is established only by a signed, allowlisted token.
2. **Reverse proxy → backend.** `X-Forwarded-For` and `X-Real-IP` are believed only from a **trusted proxy**. A wildcard cannot be configured (ADR 0011, decision 8).
3. **Admin UI host → Hub runtime.** The SPA is served from a different origin and calls the API cross-origin with credentials. CORS origins, cookie `SameSite`/`Secure`/`Domain` and CSRF together decide whether another site can drive a logged-in browser.
4. **Authenticated user → privileged operation.** RBAC checks on each route decide which **permission** is required. Role and permission management routes are the escalation surface.
5. **Backend → Redis.** Redis is trusted storage for the Allowlist, abuse counters, reset and verification state, and the Celery broker. If Redis is unreachable, the allowlist check must fail closed (ADR 0011).
6. **Backend → Celery worker and Beat.** Tasks run with database access. Beat entries must name registered tasks (ADR 0009). The pending-user sweep deletes rows.
7. **Backend → SMTP and the user's mailbox.** Email links carry tokens. Holding the mailbox is the proof of ownership for verify and reset.
8. **Pull request and issue text → CI and agents.** Untrusted. Fork PRs get no secrets. Agent-kit agents treat issue and PR text as data, never as instructions.
9. **Maintainer → `main`, `release/**` and `v*` tags.** `main` requires a PR and status checks. Tags start publish jobs.

## Attack paths to walk

- **Authentication bypass.** A JWT accepted without a signature, expiry, issuer, audience or `token_type` check, or a token that is valid but not allowlisted being accepted. Also: refresh tokens accepted as access tokens or the reverse, and reset or verification tokens accepted outside their own flow.
- **Revocation gaps.** Logout, logout-all, change-password, admin password set, disable, or delete leaving a usable session behind. The **concurrent session limit** eviction leaving access tokens from the evicted session alive. A second revocation mechanism that disagrees with the Allowlist.
- **Authorization and privilege escalation.** Routes missing a permission dependency. IDOR on user, role or group IDs. A non-superuser granting itself or others roles or permissions. Escalation through role groups or permission groups. Mass assignment of `is_superuser`, `is_active`, verification or role fields through schemas.
- **Account enumeration oracles.** Any difference in status, body, header, timing (the response-time floor), rate-limit behaviour (the shared **abuse counter**) or UI affordance between unknown, **pending**, **established** and **disabled** users on registration, resend, verify-email, password-reset request and confirm, and login.
- **Pending-user takeover.** Re-registration changing a pending user's password or names (ADR 0007, decision 4). Reuse of a verification link after the **verification window**. The sweep racing a verification.
- **Password reset abuse.** Token replay after use. A reset token for one user applied to another. A reset that does not revoke sessions. Reset links built from attacker-controlled host or frontend URL values.
- **Cookie, CSRF and CORS.** State-changing cookie-authenticated routes without CSRF. A permissive `BACKEND_CORS_ORIGINS` combined with credentials. A refresh cookie that is not HttpOnly, or is scoped wider than the auth path. `SameSite=None` without `Secure`.
- **Client-address forgery.** Forwarded headers honoured from an untrusted peer, which skews the HTTP rate limit, security events and origin-network detection.
- **Rate-limit and abuse-counter bypass.** Case or Unicode variants of an email address. Rotating client addresses. Endpoints missing a limit. Brute-forcing login or lockout state.
- **Injection.** SQL through raw queries or ordering and filter parameters. Header and CRLF injection into email (there is an existing guard; check it still covers every field). Template injection in email templates. Log injection into security events.
- **Sensitive data exposure.** Password hashes, tokens or secrets in API responses, logs, error bodies or the audit log. Debug or docs endpoints exposed in production mode.
- **Data deletion integrity.** User delete or the pending-user sweep removing audit history, or leaving orphaned grants (ADR 0013).
- **Supply chain and CI.** Third-party actions not pinned. Workflows using `pull_request_target`, or interpolating `${{ }}` attacker-influenced values into `run:`. Secrets reachable from fork PRs. Tag pushes able to publish images without review. Dependency confusion in `requirements.txt` or `package.json`.
- **Frontend.** XSS sinks (`dangerouslySetInnerHTML`, unsanitised markdown, URL-derived redirects). The access token persisted anywhere other than memory. Open redirects after login.

## Out of scope

- Operator infrastructure outside this repository: the host OS, nginx/Caddy configuration on the server, managed Postgres or Redis provider settings.
- Agent-kit's own workflows and scripts. They are audited in [mnaimfaizy/agent-kit](https://github.com/mnaimfaizy/agent-kit). Only this repository's Caller inputs and copied files are in scope here.
- Historical design notes under `docs/SESSION_SECURITY_*.md` and `docs/internal/`, except where code still follows them.
- GitHub platform, Docker Hub and Anthropic service vulnerabilities.
