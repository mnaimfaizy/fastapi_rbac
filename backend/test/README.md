# FastAPI RBAC Test Suite

This document provides comprehensive information about the refactored test suite for the FastAPI RBAC backend.

## Test Suite Status and Coverage (June 2025)

- **ALL CORE TESTS PASSING (41 Tests Total)**
- Covers: database, API, authentication, security, edge cases, and workflows
- **Test Types:**
  - Basic Functionality (13 tests)
  - Simplified Authentication (12 tests)
  - Comprehensive Authentication (16 tests)
- **Key Features:**
  - Realistic service dependency handling (Redis, email, etc.)
  - Full async/await and SQLModel `.exec()` idioms for DB access
  - API-driven flows for integration tests. Stack tests must not create rows
    directly: the test runner and the application container hold **different
    databases**, so a directly-inserted row is invisible to the code under test.
    `api/` tests are exempt — they share one process and one database with the app.
    See [ADR 0012](../../docs/adr/0012-test-suites-split-by-environment.md).
  - Pre-seeded users and robust error handling
  - Comprehensive fixture and factory infrastructure (see below)

## Current Test Infrastructure Overview

- **Directory Structure:**
  - `unit/`, `api/` and `integration/` — separated by environment, see ADR 0012
  - `factories/` and `fixtures/` for reusable test data and setup
  - `mocks/` for service mocks (email, celery, external APIs)
- **Fixtures:**
  - Database, app, Redis, and service mocks available and used
  - Factory and auth fixtures available (optimization opportunity)
- **Factories:**
  - AsyncUserFactory, UserFactory, RoleFactory, PermissionFactory, etc.
  - Centralized, maintainable test data creation
- **Best Practices:**
  - All async DB queries use `await db.exec(select(...))` (not `.execute()`)
  - Use API endpoints for user actions in integration tests
  - Use fixtures for DB/session management
  - Use mocks for external services

## Overview

The test suite has been refactored to follow industry best practices with clear separation between unit and integration tests, comprehensive mocking, and proper use of factories and fixtures.

## Directory Structure

```
backend/test/
├── conftest.py                 # Global pytest configuration
├── utils.py                    # Test utilities
├── factories/                  # Test data factories
│   ├── async_factories.py      # Async factory implementations
│   ├── user_factory.py         # User model factory
│   ├── rbac_factory.py         # Role, Permission, Group factories
│   ├── auth_factory.py         # Authentication factories
│   └── audit_factory.py        # Audit log factory
├── fixtures/                   # Pytest fixtures
│   ├── fixtures_app.py         # FastAPI app fixtures
│   ├── fixtures_db.py          # Database fixtures
│   ├── fixtures_redis.py       # Redis fixtures
│   ├── fixtures_auth.py        # Authentication fixtures
│   ├── fixtures_factories.py   # Factory fixtures
│   ├── fixtures_service_mocks.py  # Service mock fixtures
│   └── enhanced_service_mocks.py  # Enhanced mocks for integration tests
├── mocks/                      # Service mocks
│   ├── email_mock.py           # Email service mock
│   ├── celery_mock.py          # Celery mock
│   └── external_api_mock.py    # External API mocks
├── unit/                       # Unit tests
│   ├── test_models_*.py        # Model tests
│   ├── test_crud_*.py          # CRUD operation tests
│   ├── test_security.py        # Security utility tests
│   ├── test_config.py          # Configuration tests
│   └── test_email_send.py      # send_email against the real emails API
└── integration/                # Integration tests
    ├── test_api_auth_comprehensive.py     # Auth flow tests
    ├── test_api_user_flow.py              # User management tests
    ├── test_api_role_flow.py              # Role management tests
    ├── test_api_permission_flow.py        # Permission management tests
    └── test_api_dashboard_flow.py         # Dashboard tests
```

## Running Tests

### Unified Test Runner

All backend test running is now managed through a single script: `test_runner.py`.

- **Run all tests:**
  ```bash
  python test_runner.py all
  ```
- **Run unit tests only:**
  ```bash
  python test_runner.py unit
  ```
- **Run integration tests only:**
  ```bash
  python test_runner.py integration
  ```
- **Run a specific test file:**
  ```bash
  python test_runner.py specific --path test/unit/test_crud_user.py
  ```
- **Run the comprehensive demo suite:**
  ```bash
  python test_runner.py demo
  ```
- **Other options:** See `python test_runner.py --help` for more.

> **Note:** All previous test scripts (`run_tests.py`, `run_comprehensive_tests.py`, `test_all_units.py`, `run_final_tests.py`) have been removed. Use only `test_runner.py` for all test operations.

## Running Integration Tests (Docker/Postgres stack only)

> **IMPORTANT:** The integration suite drives a live server over HTTP against Postgres.
> It has **no supported in-process mode**. Run outside the stack, every test in
> `test/integration/` is skipped at collection with a reason pointing back here — it
> will not fail and will not error, so **a skipped run is not a passing run**. Only the
> unit suite is meant to run locally.

The run mode is selected by the `USE_HTTP_TEST_CLIENT` / `TEST_API_BASE_URL` contract,
which the test compose files set on their test-runner service. `integration_stack.py`
holds the single definition of "inside the stack"; `integration/conftest.py` applies the
skip, and `fixtures/fixtures_app.py` picks its HTTP client from the same predicate.

### One-time setup

`.env.test` is git-ignored. Create it from the tracked template, whose values are
throwaways for the disposable test containers:

```bash
cd backend && cp .env.test.example .env.test
```

### Run the whole suite

```bash
cd backend && docker compose -f docker-compose.test.minimal.yml down -v && docker compose -f docker-compose.test.minimal.yml up --build --exit-code-from fastapi_rbac_test_runner fastapi_rbac_test_runner
```

The leading `down -v` is not optional. `up` reuses an exited runner container from
a previous run and reports its stale exit code without running anything, and the
suite assumes an empty database — rows left behind by an earlier run push a later
one's own rows off the first page of paginated list endpoints. `-v` only removes
the volumes this compose file declares, not the dev stack's.

`--exit-code-from` makes the command exit with pytest's status, which is what the
`integration-test` job in `.github/workflows/backend-ci.yml` relies on to fail CI.

### Run a single file or test

`TEST_PATH` defaults to `test/integration`. Override it to narrow the run — set it in
the environment first, since `docker compose` reads it from there:

```bash
cd backend && docker compose -f docker-compose.test.minimal.yml down -v && TEST_PATH=test/integration/test_api_auth_comprehensive.py docker compose -f docker-compose.test.minimal.yml up --build --exit-code-from fastapi_rbac_test_runner fastapi_rbac_test_runner
```

On PowerShell, set `$env:TEST_PATH` on its own line before the `docker compose` call.

### Tear the stack down

```bash
cd backend && docker compose -f docker-compose.test.minimal.yml down
```

> Every compose file in `backend/` shares the Compose project name `backend`, so
> `--remove-orphans` on one of them removes the *other* stacks' containers — running
> it against the test stack will stop your dev stack. Omit the flag unless that is
> what you want.

`docker-compose.test.yml` runs the same suite with the full set of services (Celery
worker and beat, Flower, pgAdmin) when you need them.

### Run unit tests locally

```bash
pytest backend/test/unit/ backend/test/api/
```

## Test Categories

Suites are separated by **the environment a test needs**, not by whether it speaks
HTTP. Transport is an implementation detail of a test; the environment is what CI
has to provide in order to run it. The reasoning is recorded in
[ADR 0012](../../docs/adr/0012-test-suites-split-by-environment.md).

| Directory | Needs | Gated by |
| --- | --- | --- |
| `unit/` | nothing; no app boot, no database | `test` job |
| `api/` | in-process app via ASGI transport, SQLite session fixtures | `test` job |
| `integration/` | the Docker stack: Postgres, Redis, live server over HTTP | `integration-test` job |

`unit/` and `api/` run in the same CI job (`pytest test/unit/ test/api/`). The split
says what to expect from a directory; it is not a reason to run them separately.

**Deciding where a new test goes:** ask what it needs to run, not what it calls. A
test that boots the app belongs in `api/` even if it asserts on one function. A test
that mocks everything belongs in `unit/` even if it exercises a whole workflow.

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **Model Tests**: Test database models, relationships, and constraints
- **CRUD Tests**: Test database operations with proper mocking
- **Security Tests**: Test password hashing, token generation, etc.
- **Utility Tests**: Test helper functions and utilities
- **Configuration Tests**: Test application configuration

**Characteristics:**

- Fast execution (< 1 second per test) — this budget applies to `unit/` and only to
  `unit/`. A test that boots the app cannot meet it and belongs in `api/`.
- No application boot and no database
- Use mocks for database and external services
- Focus on single responsibility testing

### API Tests (in-process)

`api/` holds tests that drive HTTP endpoints through an in-process ASGI transport.
They boot the application and may use the SQLite-backed session fixtures, but need no
external services, so CI runs them in the same job as `unit/`.

- **Security-behaviour tests**: CSRF enforcement, account enumeration, rate limits
- **Policy tests**: password policy and reuse rules applied across every path
- **Session tests**: revocation, token flow rejection

**Characteristics:**

- Slower than `unit/`: each test pays application and fixture setup
- Real request/response cycle, no live server
- May seed through factories directly, because the test and the app share one process
  and one database — which is exactly what stack tests cannot do

### Integration Tests

Integration tests focus on testing complete workflows and API endpoints. **All integration tests must follow the [Integration Test Refactor Guide](./integration/INTEGRATION_TEST_REFACTOR_GUIDE.md) to ensure API-driven, maintainable, and contract-aligned tests.**

- **Authentication Flow Tests**: Complete auth workflows from registration to login
- **User Management Tests**: Full CRUD operations through API endpoints
- **Role Management Tests**: Role creation, assignment, and permission handling
- **Permission Management Tests**: Permission CRUD and group operations
- **Dashboard Tests**: Analytics and reporting endpoints

**Characteristics:**

- Slower execution (1-10 seconds per test)
- Use real database (test database)
- Test complete user workflows
- Include proper authentication and authorization
- Mock external services but use real internal services

## Factories and Test Data

### Factory Pattern

The test suite uses Factory Boy for generating test data:

```python
# Create a verified user
user = await user_factory.create_verified_user()

# Create a user with specific attributes
user = await user_factory.create_verified_user(
    email="specific@example.com",
    first_name="Specific"
)

# Create admin user
admin = await user_factory.create_admin_user()

# Create unverified user
unverified = await user_factory.create_unverified_user()
```

### Available Factories

- **UserFactory**: Creates user instances with various states
- **RoleFactory**: Creates roles with permissions
- **PermissionFactory**: Creates permissions with groups
- **PermissionGroupFactory**: Creates permission groups
- **RoleGroupFactory**: Creates role groups
- **AuditFactory**: Creates audit log entries

## SQLModel Async Idioms and Best Practices

- **All async DB queries must use:**
  ```python
  result = await db.exec(select(User).where(User.email == email))
  users = result.all()
  ```
- **Do NOT use:**
  ```python
  # Deprecated for SQLModel async
  await db.execute(select(User))
  ```
- **Always use `AsyncSession` and SQLModel’s `.exec()` for all async DB operations.**
- **Integration tests should use only API-driven flows for user actions.**

## Factory Pattern Best Practices and Usage

- **Centralize test data creation** using factories (see `factories/`):
  - `AsyncUserFactory`, `UserFactory`, `RoleFactory`, `PermissionFactory`, etc.
- **Usage Example:**

  ```python
  # Create a user with default values
  user = await user_factory.create()

  # Create a user with custom values
  custom_user = await user_factory.create(email="custom@example.com", is_active=True)
  ```

- **For relationships:**
  ```python
  # Create a role and assign to user
  role = await role_factory.create(name="admin")
  user = await user_factory.create(email="admin@example.com", roles=[role])
  ```
- **Use factory fixtures for easy access in tests:**
  ```python
  @pytest.mark.asyncio
  async def test_with_user(client: AsyncClient, user_factory):
      user = await user_factory.create()
      # Test logic here
  ```

## Test Optimization Opportunities

- **Available but underutilized:**
  - Factory fixtures (e.g., `user_factory`, `role_factory`)
  - Service mock fixtures (e.g., `service_mocks`)
  - Auth fixtures (e.g., `auth_headers`)
- **Optimization examples:**
  - Replace manual user creation with factory usage
  - Use service mock fixtures for Redis, email, etc., instead of manual patching
  - Use auth fixtures for authenticated endpoint testing
- **Implementation approach:**
  - No urgency; current tests are stable and comprehensive
  - Gradually refactor to use available fixtures/factories for maintainability

## Example: Optimized Test Patterns

- **Manual user creation (current):**
  ```python
  register_data = {
      "email": random_email(),
      "password": "TestPassword123!",
      "first_name": "Test",
      "last_name": "User",
  }
  ```
- **Optimized with factory:**
  ```python
  user_data = await user_factory.get_user_create_data()
  response = await client.post("/auth/register", json=user_data)
  ```
- **Manual mock setup (current):**
  ```python
  @patch("app.utils.background_tasks.send_verification_email")
  async def test_registration(mock_send_email, client):
      mock_send_email.return_value = True
  ```
- **Optimized with fixture:**
  ```python
  async def test_registration(client: AsyncClient, service_mocks):
      # All mocks pre-configured in fixture
      pass
  ```
