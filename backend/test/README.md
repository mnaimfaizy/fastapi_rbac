# FastAPI RBAC Test Suite

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
  - API-driven flows for integration tests (no direct DB user creation in integration tests)
  - Pre-seeded users and robust error handling
  - Comprehensive fixture and factory infrastructure (see below)

## Current Test Infrastructure Overview

- **Directory Structure:**
  - `unit/` and `integration/` for clear test separation
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

---

# FastAPI RBAC Test Suite

This document provides comprehensive information about the refactored test suite for the FastAPI RBAC backend.

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
│   └── test_email.py           # Email utility tests
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

## Running Integration Tests (Docker Compose Only)

> **IMPORTANT:** Integration tests must be run inside Docker Compose for correct environment isolation and service dependencies. Do NOT run integration tests locally. Only unit tests are supported for local runs.

### Run all integration tests in Docker Compose

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

- This will run the integration test suite in the correct environment with all dependencies (Postgres, Redis, etc.) available.

### Run a specific integration test file

```bash
# Use the path relative to /app inside the container
# Example: test/integration/test_api_auth_comprehensive.py

docker-compose -f docker-compose.test.yml run --rm test_runner python backend/run_tests.py --env docker --test-path test/integration/test_api_auth_comprehensive.py
```

### Run unit tests locally

```bash
pytest backend/test/unit/
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **Model Tests**: Test database models, relationships, and constraints
- **CRUD Tests**: Test database operations with proper mocking
- **Security Tests**: Test password hashing, token generation, etc.
- **Utility Tests**: Test helper functions and utilities
- **Configuration Tests**: Test application configuration

**Characteristics:**

- Fast execution (< 1 second per test)
- Isolated from external dependencies
- Use mocks for database and external services
- Focus on single responsibility testing

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

---

# FastAPI RBAC Test Suite

This document provides comprehensive information about the refactored test suite for the FastAPI RBAC backend.

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
│   └── test_email.py           # Email utility tests
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

## Running Integration Tests (Docker Compose Only)

> **IMPORTANT:** Integration tests must be run inside Docker Compose for correct environment isolation and service dependencies. Do NOT run integration tests locally. Only unit tests are supported for local runs.

### Run all integration tests in Docker Compose

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

- This will run the integration test suite in the correct environment with all dependencies (Postgres, Redis, etc.) available.

### Run a specific integration test file

```bash
# Use the path relative to /app inside the container
# Example: test/integration/test_api_auth_comprehensive.py

docker-compose -f docker-compose.test.yml run --rm test_runner python backend/run_tests.py --env docker --test-path test/integration/test_api_auth_comprehensive.py
```

### Run unit tests locally

```bash
pytest backend/test/unit/
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **Model Tests**: Test database models, relationships, and constraints
- **CRUD Tests**: Test database operations with proper mocking
- **Security Tests**: Test password hashing, token generation, etc.
- **Utility Tests**: Test helper functions and utilities
- **Configuration Tests**: Test application configuration

**Characteristics:**

- Fast execution (< 1 second per test)
- Isolated from external dependencies
- Use mocks for database and external services
- Focus on single responsibility testing

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

---

# FastAPI RBAC Test Suite

This document provides comprehensive information about the refactored test suite for the FastAPI RBAC backend.

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
│   └── test_email.py           # Email utility tests
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

## Running Integration Tests (Docker Compose Only)

> **IMPORTANT:** Integration tests must be run inside Docker Compose for correct environment isolation and service dependencies. Do NOT run integration tests locally. Only unit tests are supported for local runs.

### Run all integration tests in Docker Compose

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

- This will run the integration test suite in the correct environment with all dependencies (Postgres, Redis, etc.) available.

### Run a specific integration test file

```bash
# Use the path relative to /app inside the container
# Example: test/integration/test_api_auth_comprehensive.py

docker-compose -f docker-compose.test.yml run --rm test_runner python backend/run_tests.py --env docker --test-path test/integration/test_api_auth_comprehensive.py
```

### Run unit tests locally

```bash
pytest backend/test/unit/
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **Model Tests**: Test database models, relationships, and constraints
- **CRUD Tests**: Test database operations with proper mocking
- **Security Tests**: Test password hashing, token generation, etc.
- **Utility Tests**: Test helper functions and utilities
- **Configuration Tests**: Test application configuration

**Characteristics:**

- Fast execution (< 1 second per test)
- Isolated from external dependencies
- Use mocks for database and external services
- Focus on single responsibility testing

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

---

# FastAPI RBAC Test Suite

This document provides comprehensive information about the refactored test suite for the FastAPI RBAC backend.

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
│   └── test_email.py           # Email utility tests
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

## Running Integration Tests (Docker Compose Only)

> **IMPORTANT:** Integration tests must be run inside Docker Compose for correct environment isolation and service dependencies. Do NOT run integration tests locally. Only unit tests are supported for local runs.

### Run all integration tests in Docker Compose

```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

- This will run the integration test suite in the correct environment with all dependencies (Postgres, Redis, etc.) available.

### Run a specific integration test file

```bash
# Use the path relative to /app inside the container
# Example: test/integration/test_api_auth_comprehensive.py

docker-compose -f docker-compose.test.yml run --rm test_runner python backend/run_tests.py --env docker --test-path test/integration/test_api_auth_comprehensive.py
```

### Run unit tests locally

```bash
pytest backend/test/unit/
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **Model Tests**: Test database models, relationships, and constraints
- **CRUD Tests**: Test database operations with proper mocking
- **Security Tests**: Test password hashing, token generation, etc.
- **Utility Tests**: Test helper functions and utilities
- **Configuration Tests**: Test application configuration

**Characteristics:**

- Fast execution (< 1 second per test)
- Isolated from external dependencies
- Use mocks for database and external services
- Focus on single responsibility testing

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
