# Testing Guide

This guide covers how to run tests and write new ones for the FastAPI RBAC project.

## Quick Start

### Run All Core Tests

```bash
cd backend
python -m pytest test/test_basic_functionality.py test/test_auth_simplified.py test/test_api_auth_comprehensive.py -v
```

**Result**: 41 tests should pass in ~30-45 seconds

## Test Suites Overview

### ✅ Core Working Test Suites (41 Tests)

1. **Basic Functionality** (`test_basic_functionality.py`) - 13 tests

   - Database connectivity and table creation
   - API endpoints and routing
   - CORS configuration
   - Error handling and validation
   - Environment configuration

2. **Simplified Authentication** (`test_auth_simplified.py`) - 12 tests

   - CSRF token generation and validation
   - Authentication endpoint accessibility
   - Service dependency handling
   - Basic security validation

3. **Comprehensive Authentication** (`test_api_auth_comprehensive.py`) - 16 tests
   - Complete authentication workflows
   - Security features (rate limiting, account lockout)
   - Token management and refresh
   - Edge cases and validation scenarios

### 🛠️ Domain-Specific Tests (Available)

Additional test files for specific components:

- `test_api_rbac_comprehensive.py` - Complete RBAC workflow testing
- `test_crud_*.py` - Database CRUD operation testing
- `test_models_*.py` - Database model validation
- `test_security.py` - Security feature testing
- `test_sanitization.py` - Input sanitization testing

## Running Tests

### Individual Test Suites

```bash
# Basic infrastructure (13 tests)
python -m pytest test/test_basic_functionality.py -v

# Authentication simplified (12 tests)
python -m pytest test/test_auth_simplified.py -v

# Authentication comprehensive (16 tests)
python -m pytest test/test_api_auth_comprehensive.py -v
```

### Specific Test Categories

```bash
# Database and infrastructure only
python -m pytest test/test_basic_functionality.py::TestBasicFunctionality -v

# Authentication flow testing
python -m pytest test/test_api_auth_comprehensive.py::TestAuthenticationFlow -v

# Security testing
python -m pytest test/test_api_auth_comprehensive.py::TestAuthenticationSecurity -v

# Edge case testing
python -m pytest test/test_api_auth_comprehensive.py::TestAuthenticationEdgeCases -v
```

### Domain-Specific Testing

```bash
# RBAC comprehensive testing (requires configuration)
python -m pytest test/test_api_rbac_comprehensive.py -v

# CRUD operations
python -m pytest test/test_crud_*.py -v

# Model validation
python -m pytest test/test_models_*.py -v
```

### Test Options

```bash
# Verbose output with test names
python -m pytest test/ -v

# Stop on first failure
python -m pytest test/ -x

# Run specific test by name
python -m pytest test/test_basic_functionality.py::test_imports_working -v

# Show local variables on failure
python -m pytest test/ -l

# Quiet mode (just pass/fail counts)
python -m pytest test/ -q
```

## Test Environment

### Requirements

- Python 3.10+
- Virtual environment activated
- Dependencies installed (`pip install -r requirements.txt`)
- Environment variables configured (test mode automatically set)

### Database

- Uses SQLite in-memory database for testing
- No external database required
- Tables created automatically for each test session

### External Services

- Redis: Mocked using AsyncMock
- Email services: Mocked to prevent actual email sending
- File storage: Uses temporary directories

## Writing New Tests

### Test Structure

```python
"""
Test module docstring describing purpose.
"""

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestYourFeature:
    """Test class for specific feature."""

    @pytest.mark.asyncio
    async def test_specific_behavior(self, client: AsyncClient, db: AsyncSession) -> None:
        """Test specific behavior with clear description."""
        # Arrange
        test_data = {"key": "value"}

        # Act
        response = await client.post("/api/v1/endpoint", json=test_data)

        # Assert
        assert response.status_code == 200
        assert response.json()["message"] == "success"
```

### Available Fixtures

#### Core Fixtures (Always Available)

- `client: AsyncClient` - FastAPI test client
- `db: AsyncSession` - Database session
- `redis_mock: AsyncMock` - Mocked Redis client

#### Utility Functions

```python
from test.utils import random_email, get_csrf_token, register_user_with_csrf

# Generate random email
email = random_email()

# Get CSRF token for state-changing requests
csrf_token, headers = await get_csrf_token(client)

# Register user with CSRF protection
status, data = await register_user_with_csrf(client, user_data)
```

#### Factory Usage (Advanced)

```python
from test.factories.async_factories import AsyncUserFactory

# Create user for testing
user_factory = AsyncUserFactory(db)
user = await user_factory.create_user(
    email="test@example.com",
    password="secure_password"
)
```

### Test Patterns

#### API Endpoint Testing

```python
@pytest.mark.asyncio
async def test_endpoint_success(self, client: AsyncClient) -> None:
    """Test successful API endpoint response."""
    response = await client.get("/api/v1/health/")

    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["success"] is True
```

#### Authentication Testing

```python
@pytest.mark.asyncio
async def test_protected_endpoint(self, client: AsyncClient) -> None:
    """Test that protected endpoints require authentication."""
    response = await client.get("/api/v1/users")

    assert response.status_code == 401
    assert "unauthorized" in response.json()["detail"].lower()
```

#### Database Testing

```python
@pytest.mark.asyncio
async def test_database_operation(self, db: AsyncSession) -> None:
    """Test database operations."""
    from sqlalchemy import text

    result = await db.execute(text("SELECT COUNT(*) FROM User"))
    count = result.scalar()

    assert count >= 0  # Should have valid count
```

#### CSRF Protection Testing

```python
@pytest.mark.asyncio
async def test_csrf_protected_endpoint(self, client: AsyncClient) -> None:
    """Test CSRF protection on state-changing endpoints."""
    # Get CSRF token
    csrf_token, headers = await get_csrf_token(client)

    # Make request with CSRF token
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "password"},
        headers=headers
    )

    # Should not return CSRF error
    assert response.status_code != 403
```

## Best Practices

### Test Organization

- **One test file per module/feature**
- **Group related tests in classes**
- **Use descriptive test names**
- **Include docstrings for complex tests**

### Test Independence

- **Each test should be isolated**
- **Don't rely on test execution order**
- **Clean up test data if needed**
- **Use fresh database session per test**

### Assertion Patterns

```python
# Good: Specific assertions
assert response.status_code == 200
assert "access_token" in response.json()["data"]

# Good: Multiple related assertions
data = response.json()
assert data["success"] is True
assert data["message"] == "User created successfully"
assert "id" in data["data"]

# Avoid: Generic assertions
assert response.status_code != 500  # Too vague
```

### Error Testing

```python
# Test both success and failure cases
@pytest.mark.asyncio
async def test_invalid_input_handling(self, client: AsyncClient) -> None:
    """Test that invalid input returns proper error."""
    response = await client.post("/api/v1/endpoint", json={})

    assert response.status_code == 422
    assert "validation error" in response.json()["detail"].lower()
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Ensure test environment is set
export MODE=testing
# or in PowerShell
$env:MODE="testing"
```

#### Import Errors

```bash
# Run from backend directory
cd backend
python -m pytest test/
```

#### Async Test Issues

```python
# Always use @pytest.mark.asyncio for async tests
@pytest.mark.asyncio
async def test_async_operation(self):
    # Your async test code
```

#### CSRF Token Issues

```python
# Always get CSRF token for state-changing requests
csrf_token, headers = await get_csrf_token(client)
response = await client.post("/endpoint", headers=headers, json=data)
```

### Performance Issues

- Use `-x` flag to stop on first failure during development
- Use specific test files instead of running all tests
- Check for resource leaks if tests become slow

## Test Coverage

### Current Coverage Areas

- ✅ **Database Layer**: Connections, tables, transactions
- ✅ **API Layer**: Endpoints, routing, error handling
- ✅ **Authentication**: Login, registration, tokens, CSRF
- ✅ **Security**: Rate limiting, validation, access control
- ✅ **Integration**: End-to-end workflows

### Coverage Commands

```bash
# Install coverage if needed
pip install coverage

# Run tests with coverage
coverage run -m pytest test/test_basic_functionality.py test/test_auth_simplified.py test/test_api_auth_comprehensive.py

# Generate coverage report
coverage report

# Generate HTML coverage report
coverage html
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Pull requests to main branch
- Pushes to main branch
- Manual workflow dispatch

### Local CI Simulation

```bash
# Run the same tests as CI
python -m pytest test/test_basic_functionality.py test/test_auth_simplified.py test/test_api_auth_comprehensive.py -v --tb=short
```

## Security Testing

### Manual Security Tests

Some security tests require manual execution against a running server:

```bash
# Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Run security validation (in another terminal)
python test/test_sanitization.py
```

### Security Test Areas

- CSRF protection validation
- Input sanitization testing
- SQL injection prevention
- XSS prevention
- Rate limiting effectiveness

## Contributing Tests

### Before Submitting Tests

1. **Run all core tests**: Ensure your changes don't break existing functionality
2. **Add tests for new features**: New code should include corresponding tests
3. **Follow naming conventions**: Use descriptive test names and docstrings
4. **Update documentation**: Add new test files to this guide

### Test Review Checklist

- [ ] Tests are isolated and independent
- [ ] Test names clearly describe what is being tested
- [ ] Both success and error cases are covered
- [ ] Async tests use `@pytest.mark.asyncio`
- [ ] CSRF tokens used for state-changing requests
- [ ] Database operations use provided `db` fixture
- [ ] No hardcoded URLs (use `settings.API_V1_STR`)

## References

- [FastAPI Testing Documentation](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [AsyncIO Testing](https://docs.python.org/3/library/unittest.html#unittest.IsolatedAsyncioTestCase)
- [HTTPx Async Client](https://www.python-httpx.org/async/)

For project-specific testing patterns, see:

- `backend/test/CURRENT_TEST_INFRASTRUCTURE_GUIDE.md` - Infrastructure overview
- `backend/test/TEST_OPTIMIZATION_EXAMPLES.md` - Optimization patterns
- `backend/test/FACTORY_PATTERN_GUIDE.md` - Factory usage guide
