# Release Notes

This document provides a chronological record of all releases and major changes for the FastAPI RBAC project. Each release entry includes version information, release date, and a summary of features, bug fixes, and breaking changes.

This file serves as the single source of truth for release history and versioning across the entire monorepo.

## Version History

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
