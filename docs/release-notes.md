# Release Notes

This document provides a chronological record of all releases and major changes for the FastAPI RBAC project. Each release entry includes version information, release date, and a summary of features, bug fixes, and breaking changes.

This file serves as the single source of truth for release history and versioning across the entire monorepo.

## Version History

### v0.6.0-beta (2026-11-17)

_Pre-release._

**Breaking Changes:**

- Every failed login on `POST /auth/login` and `POST /auth/access-token` now returns the same `422` with one body: `{"detail": {"field_name": "email", "message": "Email or password is incorrect, or the account is temporarily locked. Try again later or reset your password."}}`. This covers an unknown address, a wrong password in any account state, an account with no password set, and any attempt on a locked account. API clients must not rely on these any more:
  - the attempts-remaining countdown and the "last attempt" warning on a successful login;
  - the locked-account messages and the time left on a lock;
  - the separate `400` that `/auth/access-token` returned for a locked account.
- An unverified or inactive account is reported only after a correct password: `422 "Email is not verified."` or `403 "Inactive user"`, as before. A locked account is never reported, even with the right password. It gets the uniform refusal, the lock stays in place, and no session opens. A password reset clears the lock.
- Every login, successful ones included, now takes at least the response-time floor (`UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS`, 0.5 s by default).
- The unused settings `LOCKOUT_DURATION_MINUTES`, `ACCOUNT_LOCKOUT_DURATION` and `ENABLE_ACCOUNT_LOCKOUT` are removed from Settings and the example env files. An environment that still sets them starts normally and the values are ignored. Lockout is still controlled by `MAX_LOGIN_ATTEMPTS` and `ACCOUNT_LOCKOUT_MINUTES`, which work as before.

**Security:**

- Both password login routes now give every failure that does not prove the password the same response and the same minimum response time. Paths with no usable password hash still run one bcrypt check. A locked account is refused before its password is checked, so its lock is not lifted or reset and its attempt count does not change. Lockout counting and the per-IP rate limit are unchanged. The audit log still records which kind of failure each refusal was (`failed_login`, `oauth2_failed_login`, `locked_account_attempt`, `oauth2_locked_account_attempt`).

**Documentation:**

- ADR 0015 records the uniform login failure. The auth API reference lists the uniform refusal body and the two responses that need a correct password, and the architecture page links the ADR.
- `SECURITY_FEATURES.md` now names the real lockout settings and their default duration.

**Technical Details:**

- Third-party GitHub Actions are pinned to the full commit SHA of a release, with the release named beside it. The MkDocs build installs an exact-version `docs/requirements.txt`, and the Agent-kit workflows run a pinned uv version. A new check (`.github/scripts/check-action-pins.py`) fails CI and pre-commit when a third-party action is not pinned to a SHA. Dependabot now updates the pins and the docs requirements.
- CI now runs through one workflow, `ci.yml`. It runs only the backend, frontend and docs jobs a change can affect, and falls back to running all of them when it cannot tell. It ends in one required `CI gate` check, so Backend Integration Test and Backend Coverage now block a merge. The frontend lint, format, build and unit tests now run in one `Frontend Checks` job. The backend integration image reuses cached layers, and backend installs use uv. A new push cancels a pull request's run that is still in progress, Codecov carries coverage forward for areas a change does not touch, and Dependabot runs skip the Codecov upload.
- Backend and frontend dependencies were updated, combining the open Dependabot updates. Among them, vitest and `@vitest/coverage-v8` move to 5.1 together. For fastapi-pagination 0.16, the CRUD layer now calls the async `apaginate`. For sqlmodel 0.0.49, table-model datetime fields now state `sa_type=DateTime`, which keeps their existing column type, so there is no schema change or migration.

### v0.5.0-beta (2026-11-17)

_Pre-release._

**Breaking Changes:**

- Production no longer seeds the demo accounts `manager@example.com` and `user@example.com`. It seeds only the superuser, roles and permissions. Development and testing still seed both demo accounts, so local sign-in and the tests are unchanged. Start-up never changes existing users, so if you are upgrading a production database first seeded by v0.4.0-beta or earlier, run `python -m app.db.retire_demo_accounts` once in the production API container after the upgrade. It deactivates any demo accounts that exist. See "Upgrading from v0.4.0-beta or earlier: retire the demo accounts" in `docs/deployment/production-deployment-guide.md`. For other accounts, use real accounts, or the QA Accounts seeder on a local database for fixture users.

**Security:**

- A caller who is not a superuser can no longer change or remove a superuser, or a user who holds a permission the caller does not hold. This applies to `PUT /users/{user_id}`, `PUT /users/bulk-update`, `DELETE /users/{user_id}` and `POST /users/{user_id}/roles`. Admins who are not superusers now get a 403 on these routes for such targets. The response names the rule, not the target's permissions. Every target in a bulk update is checked before any write, so a refused bulk update changes nobody. Users whose permissions the caller all holds, peers included, can still be edited. The caller's own record and superusers are not affected.
- Added `python -m app.db.retire_demo_accounts`, an opt-in, one-off command. It runs only when `MODE=production`. It deactivates each demo account that exists, ends its sessions and revokes its pending verification and password-reset links. It deletes nothing, skips a superuser, prints one line per address and no password, and changes nothing if you run it again.

**Documentation:**

- The Users API reference now explains which users a caller can change or remove and when the API refuses with a 403. The update, bulk update, delete and role-assignment routes link to that explanation.
- The production deployment guide has a new upgrade step for retiring the demo accounts. The database initialization guide and the Hub runtime quick start link to it.

### v0.4.0-beta (2026-11-17)

_Pre-release._

**Bug Fixes:**

- The hub-runtime bootstraps (`bootstrap.sh` and both split bootstraps) generate a `FIRST_SUPERUSER_PASSWORD` that meets the password policy, so a freshly bootstrapped stack seeds its superuser instead of stopping. A value that is already set is kept.

**Breaking Changes:**

- Development and testing modes no longer return password-reset tokens or verification codes in API responses. To get them back for local testing, set `EXPOSE_TOKENS_IN_RESPONSES=true`. The test compose stacks, the QA stack override and `.env.test.example` already set it. The setting is refused when `MODE=production`. The production images (`Dockerfile.prod`, `queue.dockerfile.prod` and the production stage of `Dockerfile`) now set `MODE=production`, and a container with `FASTAPI_ENV=production` refuses to start unless `MODE=production`. If you override `MODE` in a production deployment, set it to `production` before upgrading.
- With `MODE=production`, the API refuses to start unless `SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`, `JWT_RESET_SECRET_KEY`, `JWT_VERIFICATION_SECRET_KEY` and `ENCRYPT_KEY` are each set, at least 32 characters long and different from the other four. It also refuses a key that matches a value published in the repository's example or template files, or that contains a placeholder word. A deployment that never set `JWT_VERIFICATION_SECRET_KEY` now refuses to start too. Before upgrading, generate a separate key for each of the five, running this once per key: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. The startup error names every key that fails, by name only. Changing `SECRET_KEY` or `JWT_REFRESH_SECRET_KEY` ends every existing session, so users sign in again.
- `JWT_SECRET_KEY` is removed because nothing was signed with it. If it is still set, the value is ignored.

**Security:**

- Tokens are returned in API responses only when the operator explicitly opts in with `EXPOSE_TOKENS_IN_RESPONSES`, and never in production. The API logs a startup warning when `MODE` is not `production`, and another when the opt-in is on. With the opt-in on, a password-reset request gets the same uniform response as every other request.
- Production refuses missing, short, shared, placeholder and example signing and encryption keys. Every production settings check now raises an error instead of using `assert`, so the checks still run under `python -O`. Settings validation errors no longer echo input values.

**Documentation:**

- The security configuration reference, the auth API reference, the production setup guides and the backend env examples now document `EXPOSE_TOKENS_IN_RESPONSES`, the `MODE` checks, the five production keys and the command that generates them.

**Technical Details:**

- `backend/.env.example` ships a different placeholder for each key, and development and testing accept them. The hub-runtime bootstraps no longer generate `JWT_SECRET_KEY`, and they add any of the five keys missing from an older `.env`.
- Upgraded Agent-kit to v1.0.0-beta.7 and added its review response flow. It stays off until `CLAUDE_REVIEW_RESPONSE_ENABLED` is true.

### v0.3.0-beta (2026-11-17)

_Pre-release._

**New Features:**

- Logout now ends only the calling session; the new `POST /auth/logout/all` ends every session, and the Admin UI adds a confirmed "Log out everywhere" action
- Allowlist entries carry their own expiry, and `CONCURRENT_SESSION_LIMIT` is enforced by evicting the oldest session
- Refresh from a different origin network (IPv4 /24 or IPv6 /64) revokes that one session and records a security event, controlled by `VALIDATE_TOKEN_IP`
- Authenticated requests are rate-limited per user; anonymous auth routes stay keyed by client address
- Outgoing emails include a plain-text part alongside the HTML
- QA Accounts seeder (`python -m app.qa_accounts`) creates one verified fixture user per role for local and QA stacks, and refuses to run in production or against non-local databases

**Bug Fixes:**

- Login and `POST /auth/access-token` are refused until the email is verified and while the account is inactive
- One password policy and one reuse policy now apply to every path that sets a password, including registration and admin-set passwords; the last two frontend forms use the shared policy schema
- Sessions are revoked when an administrator sets a password, and change-password revokes old sessions before issuing new ones, so a successful change no longer logs the user out
- Change-password sessions use `REFRESH_TOKEN_EXPIRE_MINUTES`, the same lifetime as `/login`
- Account lockout is applied once, for `ACCOUNT_LOCKOUT_MINUTES`; locked users no longer get a 500 from the login routes
- Security events are stored as audit log rows, including on failed requests and when a password-reset lookup fails
- User endpoints check the `user.*` permissions the seed creates, so non-superuser roles can manage users again
- Paginated list endpoints and user delete after a password change no longer return 500
- Admin-created users get a verification link that works, and a second visit to a valid verification link reports the account as already verified
- Verification and password-reset emails state the real link lifetime, and emailed links are built from `FRONTEND_URL`
- Outgoing SMTP data uses CRLF line endings
- Unverified accounts are cleaned up by a Celery Beat sweep that survives restarts
- Allowlist Redis keys are pinned to `TokenType` values, so live sessions survive the Python 3.11+ upgrade
- Forwarded client addresses are trusted only from proxies listed in the new `TRUSTED_PROXIES` setting (loopback by default; wildcards are rejected), so rate limits, audit logs and origin-network checks use the real client address
- Admin UI shows the change-password success alert and keeps structured API error messages that have no `field_name`
- Local database, Redis and pgAdmin data and non-dev `.env` files are kept out of the backend Docker build context

**Breaking Changes:**

- Users whose password was set by an administrator (on create or later) must change it before doing anything else. Until they do, they can only change their password, read `GET /users/me` and log out; every other route returns 403 with `detail.code` `password_change_required`, so API clients must call `POST /auth/change_password` first. Admin-created users are flagged even when `ADMIN_CREATED_USERS_AUTO_VERIFIED` is on. The upgrade clears all existing flags, so no current user is restricted.
- `REFRESH_TOKEN_EXPIRE_DAYS` is removed and ignored if still set; `REFRESH_TOKEN_EXPIRE_MINUTES` controls every refresh-token lifetime

**Security:**

- Refresh tokens are delivered only in HttpOnly Secure cookies, not in browser storage
- Verify-email, password-reset and registration/resend flows return the same response for every outcome
- Callers who are not superusers can grant or remove only roles whose permissions they already hold, cannot change their own roles, and cannot set or clear `is_superuser`
- Callers who are not superusers can add or remove only permissions they already hold and cannot change the permissions of a role they hold; system roles cannot be renamed or have their permissions changed through `PUT /roles/{role_id}`
- Test helpers no longer print tokens, passwords or auth responses

**Documentation:**

- Session security model and vocabulary, a session lifecycle explainer with a CI drift check, and ADRs for uniform registration responses and temporary passwords
- Role-grant and role-permission rules documented on the user and role API routes
- Branch naming convention

**Technical Details:**

- Sessions, emailed links and password changes each go through one module (`app/utils/sessions.py`, the emailed-links module, `app/utils/password_policy.py`)
- User creation accepts only a password that passed the policy; seeding refuses a `FIRST_SUPERUSER_PASSWORD` that fails the policy, and the default is now compliant
- Removed the unused `password_version` column (migration included), the session control settings that were never implemented (ignored if still set), and the account-lockout Celery task
- CI: backend and frontend coverage are sent to Codecov under separate flags with per-flag patch-coverage gates; backend CI runs on every pull request; every job has a timeout; the integration suite runs in Docker only and is gated in CI
- Test database is built once per session; test suites are split by environment, with pyproject.toml as the only pytest config
- Adopted the Agent-kit security audit and plan, implement and review pipeline (now at v1.0.0-beta.6), plus QA suite and QA Stack configuration
- Release tags are pushed with a deploy key
- Upgraded Vite to 8.2.2, plugin-react to 6.1.0, pytest to 9.1.1, pytest-asyncio to 1.4.0 and TypeScript to 6.0.3, moved frontend CI to Node 22, and applied Dependabot updates across the backend, frontend and GitHub Actions

### v0.2.0-beta (2026-07-26)

_Pre-release._

**New Features:**

- Hub bootstrap CLI subcommands (up, down, status, logs, health, env) shared across one-box and split API/worker deployments; running bootstrap with no arguments still performs a full stack up

**Bug Fixes:**

- Celery workers that discarded tasks (e.g. `log_security_event_task`) and async tasks that failed across asyncio loops (e.g. `cleanup_tokens_task`) by registering tasks through `app.worker:celery_app` and recreating the Redis pool when the owning event loop changes
- Hub Celery worker and beat containers reporting unhealthy in Docker Compose by targeting the correct app module for worker healthchecks and using a process check for beat
- Celery beat unable to write its schedule file on named volumes by chowning the schedule directory for the application user at startup
- Hub bootstrap exiting silently when optional environment keys were missing by reading env safely, stripping CRLF from `.env` values, printing a startup banner, and accepting `--up`-style flags
- Admin UI deep links and hard refreshes on LiteSpeed by hardening SPA `.htaccess` (disable MultiViews, relative index fallback, 404 fallback, cache disable); `.htaccess` is always shipped with UI deploys and smoke-tested on `/login`

**Breaking Changes:**

- None

### v0.1.1-beta (2026-07-26)

_Pre-release._

**New Features:**

- Hub runtime split Compose package and bootstraps for Neon + Upstash deployments
- Admin UI host cPanel release deploy workflow

**Bug Fixes:**

- Hub runtime deployment fixes: required JWT env defaults, host CA bundle for Upstash TLS, and SSLConnection for async Redis TLS
- Dispatch Docker Publish workflow after release tag creation (GITHUB_TOKEN tag pushes do not start dependent workflows)

**Breaking Changes:**

- None

**Documentation:**

- Hub runtime package with Oracle Always Free setup guide and .env-only secrets bootstrap
- Hub runtime split requirements for Neon, Upstash, and hostname-only REDIS_HOST
- Document UI_FTP_* secrets in the release checklist

**Technical Details:**

- Consolidate HTTP rate limits onto slowapi with shared Redis-backed limiter; remove unused fastapi-limiter scaffold
- Split Docker publish into parallel matrix job DAG; promote :latest only after all builds succeed (ADR 0002)
- Rename Admin UI FTP CI secrets to UI_FTP_*

### v0.1.0-beta (2026-07-24)

_Pre-release._

**New Features:**

- Release PR flow as the default path, with tag-on-merge and an updated release skill for publishing
- Playwright end-to-end testing suite with environment validation and operator docs
- Enhanced Redis SSL/TLS connection management with dedicated documentation and examples
- Consolidated environment variables into a single `.env.example` (removed `production.env.example`) with a migration guide
- Modular Docker Compose, entrypoints, and environment scripts for dev/test/prod, plus improved connectivity checks with retries
- MCP server configuration and docs for GitHub Copilot integration
- Global prune option in `cleanup-environments.ps1` for fuller Docker resource cleanup

**Bug Fixes:**

- Enforce Redis JWT allowlist checks and restore typed JWT security audit events
- Align PowerShell release scripting with bash; repair Docker Publish worker image builds and release-triggered image tagging
- Resolve Dockerfile `FROM`/`AS` casing warnings and build-and-push network/command issues
- Stabilize backend dev runtime for the dependency upgrade track (CORS origin coercion, SQLModel `ScalarResult` usage, tooling pins)

**Breaking Changes:**

- None

**Documentation:**

- Expand MkDocs with a dedicated Frontend section, fuller API reference (including roles, permissions, role groups, permission groups, and dashboard), and a clearer architecture narrative outside AI harnesses
- Add dependency upgrade policy and Dependabot guidance; integrate graphify for codebase navigation
- Add Redis SSL, session-security analysis, E2E quick-reference, and release-process docs; refresh README status badges

**Technical Details:**

- Consolidate JWT handling onto PyJWT
- Multi-lane dependency upgrades across backend, frontend, workers/ops, GitHub Actions, and Docker/CI base images
- Docker publish builds once from `v*` tags on release; skip frontend Playwright in CI until full-stack CI is wired
- Reorganize backend scripts, harden Redis TLS defaults, enforce LF line endings for shell scripts, and add a project LICENSE
- Add weekly graphify report refresh workflow (maintenance PRs enabled)

### v0.0.3-beta (2025-07-02)

**New Features:**

- Release automation scripts for streamlined publishing and changelog management
- Dry-run option for release scripts to enable safe testing before actual release
- Enhanced documentation with new index page, logo assets, and favicon for improved branding
- Comprehensive documentation for the FastAPI RBAC project
- Contributing guidelines to support community collaboration
- Troubleshooting agent prompt for user support
- Prompt templates for architect, implementor, and manager roles
- Comprehensive testing suite for authentication and basic functionality
- Enhanced admin user creation process with configurable verification settings
- CSRF token management added to API service
- Comprehensive tests for PermissionGroups, RoleGroupList, RoleList, and UsersList components
- Frontend Testing Framework implementation (P0 Item #1)
- Rate Limiting implementation (P0 Item #2)
- Complete separation of Docker environments for development, testing, and production

**Bug Fixes:**

- Correct Docker check logic in `create-release.sh`
- Improved release scripts with better Docker handling, changelog management, and cleanup
- Added `changelog.txt` to `.gitignore` and fixed path resolution in release scripts
- Removed `server-dir` from FTP deployment configuration and updated documentation links to point to the live site
- Fixed frontend build, type, and linting issues
- Resolved authentication tests to accept 429 status code for rate limiting scenarios

**Breaking Changes:**

- None

**Technical Details:**

- Updated linting and formatting processes to use PowerShell scripts for consistency
- Enhanced demo suite to include integration tests
- Updated test environment configuration and improved coverage reporting
- Improved test runner and fixtures for parallel execution
- Enhanced documentation and best practices for dependency management, environment variables, and test runner usage
- Updated user and role handling in tests
- Removed Docker build job from CI workflow
- Removed obsolete scripts for fixing CRUD and factory method calls, test issues, imports, and password requirements
- Comprehensive test suite refactor and API-driven integration test alignment
- Complete test suite restructuring and fixed all 125 unit tests
- Started test suite refactor for comprehensive API/integration testing
- Restructured Docker environment files and enhanced database initialization scripts
- Added troubleshooting scripts for CORS and Docker configuration
- Updated Docker configurations for production and testing environments
- Refactored code for improved readability and consistency
- Comprehensive updates to documentation and frontend security integration
- Updated documentation and security features across the project

### v0.0.2-beta (2025-07-02)

**Pre-release Beta Version**

**New Features:**

- Enhanced FastAPI RBAC backend with comprehensive role and permission management
- React frontend with TypeScript and modern UI components
- Improved Docker containerization and development workflow
- Enhanced testing infrastructure with unit and integration tests

**Bug Fixes:**

- Resolved authentication flow issues
- Fixed permission validation logic
- Improved error handling across the application

**Breaking Changes:**

- None (pre-release version)

**Technical Details:**

- Backend: FastAPI with SQLModel/SQLAlchemy, PostgreSQL, Redis
- Frontend: React 18+ with TypeScript, Redux Toolkit, ShadCN UI
- Infrastructure: Docker Compose, GitHub Actions CI/CD

### v0.0.1-beta (2025-07-01)

**Initial Pre-release Beta Version**

**New Features:**

- Initial release of FastAPI RBAC monorepo
- Basic authentication and authorization system
- User management with role-based access control
- REST API endpoints for user, role, and permission management
- React frontend with authentication flows
- Docker containerization for development and production

**Technical Details:**

- Monorepo structure with backend and frontend separation
- JWT-based authentication with refresh token support
- PostgreSQL database with SQLModel ORM
- Redis for session management and caching
- Comprehensive test suite setup

**Known Issues:**

- Beta version - not recommended for production use
- Some advanced RBAC features still in development

## Release Process

For comprehensive information about the release process, see the [Release Management Guide](../RELEASE.md).

For a quick reference of the original process documentation, see [Release Process Documentation](deployment/RELEASE_PROCESS.md).

## Semantic Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **Pre-releases:** MAJOR.MINOR.PATCH-pre.N (e.g., 1.0.0-beta.1, 1.0.0-rc.1)

**Version Types:**

- **Major:** Breaking changes that require migration
- **Minor:** New features that are backward compatible
- **Patch:** Bug fixes and minor improvements
- **Pre-release:** Beta, alpha, or release candidate versions
