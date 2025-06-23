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

### Using the Test Runner

The project includes a comprehensive test runner (`test_runner.py`) that provides easy access to different test scenarios:

```bash
# Run all tests
python test_runner.py all

# Run unit tests only
python test_runner.py unit

# Run integration tests only
python test_runner.py integration

# Run specific test file
python test_runner.py specific --path test/unit/test_crud_user.py

# Run with coverage
python test_runner.py all --coverage

# Run in parallel
python test_runner.py all --parallel

# Run verbose output
python test_runner.py all --verbose

# Clean cache files
python test_runner.py clean

# Check test suite health
python test_runner.py health
```

### Using pytest directly

```bash
# Run all tests
pytest

# Run unit tests only
pytest test/unit/

# Run integration tests only
pytest test/integration/

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test class
pytest test/unit/test_crud_user.py::TestUserCRUD

# Run specific test method
pytest test/unit/test_crud_user.py::TestUserCRUD::test_create_user_success

# Run with verbose output
pytest -v -s

# Run in parallel
pytest -n auto
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

Integration tests focus on testing complete workflows and API endpoints:

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

## Mocking Strategy

### Service Mocks

External services are mocked to ensure test isolation:

```python
# Email service mock
@pytest.fixture
async def email_mock():
    mock_service = MockEmailService()
    yield mock_service
    mock_service.clear_sent_emails()

# Verify email was sent
assert len(email_mock.sent_emails) == 1
assert email_mock.sent_emails[0]["to"] == "user@example.com"
```

### Available Mocks

- **MockEmailService**: Mock email sending functionality
- **MockCeleryApp**: Mock Celery task queue
- **MockRedisClient**: Mock Redis operations
- **MockHTTPClient**: Mock external HTTP calls
- **MockOAuthProvider**: Mock OAuth providers

## Best Practices

### Test Structure

Follow the Arrange-Act-Assert pattern:

```python
@pytest.mark.asyncio
async def test_create_user_success(self, db, user_factory):
    # Arrange
    user_data = IUserCreate(
        email="test@example.com",
        first_name="Test",
        last_name="User",
        password="SecurePassword123!"
    )

    # Act
    created_user = await crud.user.create(db_session=db, obj_in=user_data)

    # Assert
    assert created_user is not None
    assert created_user.email == user_data.email
```

### Test Naming

- Use descriptive test names that explain what is being tested
- Include the expected outcome in the name
- Use consistent naming patterns

```python
def test_create_user_success()          # Happy path
def test_create_user_duplicate_email()  # Error case
def test_create_user_invalid_data()     # Validation error
```

### Fixtures and Dependencies

- Use pytest fixtures for setup and teardown
- Prefer session-scoped fixtures for expensive operations
- Use function-scoped fixtures for test isolation

```python
@pytest_asyncio.fixture(scope="function")
async def user_with_roles(user_factory, role_factory):
    user = await user_factory.create_verified_user()
    role = await role_factory.create_role(name="test_role")
    # Assign role to user
    return user
```

### Async Testing

For async operations, use pytest-asyncio:

```python
@pytest.mark.asyncio
async def test_async_operation():
    result = await some_async_function()
    assert result is not None
```

### Error Testing

Test error conditions explicitly:

```python
@pytest.mark.asyncio
async def test_user_not_found():
    with pytest.raises(UserNotFoundException):
        await crud.user.get_by_id(non_existent_id)
```

## Configuration

### Environment Variables

Tests use a separate configuration with test-specific settings:

```python
# In conftest.py
os.environ["MODE"] = "testing"
```

### Test Database

Tests use a separate test database to avoid conflicts:

- SQLite in-memory database for unit tests
- PostgreSQL test database for integration tests
- Automatic database cleanup between tests

### Test Markers

Use pytest markers to categorize tests:

```python
@pytest.mark.slow
def test_expensive_operation():
    # Long-running test
    pass

@pytest.mark.integration
def test_api_endpoint():
    # Integration test
    pass
```

Run specific markers:

```bash
# Skip slow tests
pytest -m "not slow"

# Run only integration tests
pytest -m integration
```

## Coverage Requirements

The test suite maintains high code coverage:

- **Target Coverage**: 85%+ overall
- **Critical Components**: 95%+ (auth, security, CRUD)
- **New Code**: 90%+ coverage required

Generate coverage reports:

```bash
# HTML report
pytest --cov=app --cov-report=html

# Terminal report
pytest --cov=app --cov-report=term-missing

# XML report (for CI)
pytest --cov=app --cov-report=xml
```

## CI/CD Integration

The test suite is designed for CI/CD integration:

- Fast unit tests for quick feedback
- Comprehensive integration tests for release validation
- Coverage reporting for quality gates
- Parallel execution support

Example GitHub Actions workflow:

```yaml
- name: Run Unit Tests
  run: python test_runner.py unit --coverage --parallel

- name: Run Integration Tests
  run: python test_runner.py integration --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**

   - Ensure test database is running
   - Check database URL in test configuration
   - Verify database permissions

2. **Redis Connection Errors**

   - Ensure Redis is running for integration tests
   - Check Redis configuration in test settings
   - Use Redis mock for unit tests

3. **Import Errors**

   - Ensure PYTHONPATH includes the app directory
   - Check for circular imports
   - Verify all dependencies are installed

4. **Slow Tests**
   - Use markers to identify slow tests
   - Optimize database operations
   - Consider using mocks instead of real services

### Debugging Tests

```bash
# Run with debug information
pytest --pdb --capture=no test/path/to/test.py

# Run with verbose output
pytest -v -s test/path/to/test.py

# Run single test with debugging
python test_runner.py specific --path test/unit/test_crud_user.py --debug
```

## Contributing

When adding new tests:

1. Follow the existing directory structure
2. Use appropriate factories for test data
3. Mock external dependencies
4. Include both positive and negative test cases
5. Update documentation if adding new patterns
6. Ensure tests are independent and can run in any order

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio Documentation](https://pytest-asyncio.readthedocs.io/)
- [Factory Boy Documentation](https://factoryboy.readthedocs.io/)
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy Testing Guide](https://docs.sqlalchemy.org/en/14/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)
