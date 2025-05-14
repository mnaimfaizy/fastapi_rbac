# RBAC Test Factory Pattern Guide

This document provides guidance on using the test factory patterns implemented in this project.

## Overview

The test factory pattern provides a consistent, maintainable way to create model instances for testing. Benefits include:

1. **Centralized Data Creation**: Define test data creation in one place
2. **Flexible Customization**: Override only what you need for specific tests
3. **Clean Test Code**: Tests focus on assertions instead of setup details
4. **Easier Maintenance**: When models change, update only the factory classes

## Factory Components

### Model Factories

Factories for creating model instances:

- `UserFactory`: Creates User instances
- `RoleFactory`: Creates Role instances
- `PermissionFactory`: Creates Permission instances
- `PermissionGroupFactory`: Creates PermissionGroup instances
- `RoleGroupFactory`: Creates RoleGroup instances
- `AuditLogFactory`: Creates AuditLog instances

### Factory Fixtures

Fixtures for creating model instances:

- `make_user`: Creates User instances
- `make_admin_user`: Creates admin User instances
- `make_permission`: Creates Permission instances
- `make_permission_group`: Creates PermissionGroup instances
- `make_role`: Creates Role instances
- `make_role_with_permissions`: Creates Role instances with permissions
- `make_role_group`: Creates RoleGroup instances
- `make_audit_log`: Creates AuditLog instances
- `token_factory`: For creating JWT tokens
- `auth_headers`: For creating authentication headers

### Helper Classes

- `BaseTestCase`: Base class with common testing functionality
- `APITestCase`: Base class for testing API endpoints
- `RBACTestCase`: Base class for testing RBAC features

## Usage Examples

### Creating a Simple User

```python
@pytest.mark.asyncio
async def test_create_user(db, make_user):
    # Create a user with default values
    user = await make_user()

    # Create a user with custom values
    custom_user = await make_user(
        email="custom@example.com",
        first_name="Custom",
        last_name="User",
        is_active=True
    )

    assert user is not None
    assert custom_user.email == "custom@example.com"
```

### Creating a User with Roles

```python
@pytest.mark.asyncio
async def test_user_with_roles(db, make_user, make_role):
    # Create a role
    admin_role = await make_role(name="admin")

    # Create a user
    user = await make_user(email="admin@example.com")

    # Assign role to user
    from app.models.user_role_model import UserRole
    user_role = UserRole(user_id=user.id, role_id=admin_role.id)
    db.add(user_role)
    await db.commit()

    # Verify user has role
    result = await db.execute(
        """
        SELECT r.name FROM role r
        JOIN user_role ur ON r.id = ur.role_id
        WHERE ur.user_id = :user_id
        """,
        {"user_id": user.id}
    )
    roles = [row[0] for row in result]
    assert "admin" in roles
```

### Creating a Role with Permissions

```python
@pytest.mark.asyncio
async def test_role_with_permissions(db, make_role_with_permissions):
    # Create a role with 3 auto-generated permissions
    role = await make_role_with_permissions(
        name="admin",
        description="Administrator role",
        count=3
    )

    # Verify role has permissions
    result = await db.execute(
        """
        SELECT p.name FROM permission p
        JOIN role_permission rp ON p.id = rp.permission_id
        WHERE rp.role_id = :role_id
        """,
        {"role_id": role.id}
    )
    permissions = [row[0] for row in result]
    assert len(permissions) == 3
```

### Using the Token Factory

```python
def test_token_generation(token_factory):
    # Create an access token
    access_token = token_factory.create_access_token(
        user_id="123",
        is_superuser=True
    )

    # Create auth headers
    headers = token_factory.create_auth_headers(
        user_id="123",
        is_superuser=True
    )

    assert access_token is not None
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("Bearer ")
```

### Using Base Test Cases

```python
class TestMyFeature(RBACTestCase):
    @pytest.mark.asyncio
    async def test_api_with_permissions(
        self,
        client,
        app,
        db,
        make_user,
        make_role,
        make_permission,
        token_factory
    ):
        # Set up test data
        data = await self.setup_test_data(
            db=db,
            make_user=make_user,
            make_role=make_role,
            make_permission=make_permission
        )

        # Create a user with specific role
        manager = await self.create_user_with_roles(
            db=db,
            make_user=make_user,
            roles=[data['admin_role']],
            email="manager@example.com"
        )

        # Get auth headers
        headers = self.get_test_headers(token_factory, user=manager)

        # Test API access
        response_data = await self.send_request(
            client=client,
            method="GET",
            url="/api/v1/users",
            headers=headers,
            expected_status=200
        )

        # Assertions
        assert "data" in response_data
```

### Mocking Current User

```python
@pytest.mark.asyncio
async def test_with_mocked_user(client, app):
    # Mock a superuser
    with await RBACTestCase.mock_authorized_user(
        app=app,
        roles=["admin"],
        permissions=["user:read", "user:write"],
        is_superuser=True
    ):
        # This should succeed because we've mocked a superuser
        response = await client.get("/api/v1/users")
        assert response.status_code == 200
```

## Best Practices

1. **Use Factory Traits for Common Patterns**

   - Use `UserFactory.admin()` instead of `UserFactory(is_superuser=True)`
   - Create your own traits for common test scenarios

2. **Centralize Complex Setup Logic**

   - Put complex setup in the factory classes
   - Use helper methods in test base classes

3. **Use Faker for Realistic Data**

   - Use `Faker` providers for realistic test data
   - Add custom providers for domain-specific data

4. **Keep Tests Focused**

   - Create only the data you need for each test
   - Use the base test cases to reduce boilerplate

5. **Add Post-Generation Hooks**

   - Use `@factory.post_generation` for related objects
   - Handle cleanup in factory fixtures with `yield`

6. **Standardize API Testing**

   - Use `APITestCase.send_request()` for consistent API testing
   - Verify response formats consistently

7. **Use Session Management**
   - Always set up and reset database sessions for factories
   - Use the `db_factories` fixture to manage sessions

## Extending the Pattern

To add a new factory:

1. Create a factory class in `test/factories/`
2. Update `db_factories` to set the session
3. Add factory fixtures in `test/fixtures/fixtures_factories.py`
4. Use the new factory in tests

Example:

```python
# In test/factories/new_model_factory.py
class NewModelFactory(SQLAlchemyModelFactory):
    class Meta:
        model = NewModel
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid7)
    name = factory.Sequence(lambda n: f"new-model-{n}")

# In test/fixtures/fixtures_factories.py
@pytest_asyncio.fixture
async def make_new_model(db_factories, db):
    NewModelFactory._meta.sqlalchemy_session = db

    async def _make_new_model(**kwargs):
        return NewModelFactory(**kwargs)

    return _make_new_model
```
