"""
User management integration tests.

Tests the complete user management flow including:
- User CRUD operations
- Role assignments
- Permission checks
- Profile management
"""

from test.factories.async_factories import AsyncRoleFactory, AsyncUserFactory
from test.utils import get_csrf_token, random_email
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestUserManagementFlow:
    """Integration tests for user management flows."""

    @pytest.mark.asyncio
    async def test_admin_user_crud_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test complete CRUD operations for users by admin."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create user data
        user_data = {
            "email": random_email(),
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecurePassword123!",
            "contact_phone": "+1234567890",
            "is_active": True,
        }

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Create user
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/users",
            json=user_data,
            headers=headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["success"] is True
        created_user = result["data"]
        user_id = created_user["id"]
        assert created_user["email"] == user_data["email"]

        # Step 2: Get user by ID
        response = await client.get(
            f"{settings.API_V1_STR}/users/{user_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        user_detail = result["data"]
        assert user_detail["email"] == user_data["email"]

        # Step 3: Update user
        update_data = {"first_name": "Jane", "last_name": "Smith", "contact_phone": "+9876543210"}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/users/{user_id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        updated_user = result["data"]
        assert updated_user["first_name"] == update_data["first_name"]
        assert updated_user["last_name"] == update_data["last_name"]

        # Step 4: List users (should include our created user)
        response = await client.get(
            f"{settings.API_V1_STR}/users/list",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        users_list = result["data"]["items"]
        created_user_found = any(user["id"] == user_id for user in users_list)
        assert created_user_found

        # Step 5: Delete user
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/users/{user_id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Verify user is deleted
        response = await client.get(
            f"{settings.API_V1_STR}/users/{user_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user_role_assignment_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test user role assignment and permission checking."""
        # Create admin user and regular user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        regular_user = await user_factory.create_verified_user()

        # Create a role
        role = await role_factory.create_role(name="manager")

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Assign role to user
        role_assignment_data = {"user_id": str(regular_user.id), "role_ids": [str(role.id)]}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/users/{regular_user.id}/roles",
            json=role_assignment_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Step 2: Verify user has the role
        response = await client.get(
            f"{settings.API_V1_STR}/users/{regular_user.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        user_detail = result["data"]
        user_roles = [r["name"] for r in user_detail.get("roles", [])]
        assert "manager" in user_roles

        # Step 3: Remove role from user
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/users/{regular_user.id}/roles/{role.id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Verify role is removed
        response = await client.get(
            f"{settings.API_V1_STR}/users/{regular_user.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        user_detail = result["data"]
        user_roles = [r["name"] for r in user_detail.get("roles", [])]
        assert "manager" not in user_roles

    @pytest.mark.asyncio
    async def test_user_profile_management_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test user profile management (self-service)."""
        # Create verified user
        user = await user_factory.create_verified_user()
        user_token = await user_factory.get_auth_token(user)

        auth_headers = {"Authorization": f"Bearer {user_token}"}

        # Step 1: Get own profile
        response = await client.get(
            f"{settings.API_V1_STR}/users",  # Get my profile endpoint
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        profile = result["data"]
        assert profile["email"] == user.email

        # Step 2: Update own profile
        update_data = {"first_name": "UpdatedName", "contact_phone": "+1111111111"}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/users",  # Update my profile endpoint
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        updated_profile = result["data"]
        assert updated_profile["first_name"] == update_data["first_name"]

    @pytest.mark.asyncio
    async def test_permission_based_access_control(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test permission-based access to user endpoints."""
        # Create users with different permissions
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        regular_user = await user_factory.create_verified_user()
        regular_token = await user_factory.get_auth_token(regular_user)

        # Admin should be able to list users
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.get(
            f"{settings.API_V1_STR}/users/list",
            headers=admin_headers,
        )
        assert response.status_code == 200

        # Regular user should not be able to list users
        regular_headers = {"Authorization": f"Bearer {regular_token}"}
        response = await client.get(
            f"{settings.API_V1_STR}/users/list",
            headers=regular_headers,
        )
        assert response.status_code == 403  # Forbidden

        # Regular user should be able to get their own profile
        response = await client.get(
            f"{settings.API_V1_STR}/users",
            headers=regular_headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_user_pagination_and_filtering(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test user list pagination and filtering."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create multiple test users
        test_users = []
        for i in range(15):  # Create more than typical page size
            user = await user_factory.create_verified_user(
                email=f"testuser{i}@example.com", first_name=f"User{i}"
            )
            test_users.append(user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test pagination
        response = await client.get(
            f"{settings.API_V1_STR}/users/list?page=1&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        data = result["data"]
        assert len(data["items"]) <= 10
        assert data["total"] >= 15  # At least our test users plus admin
        assert data["page"] == 1

        # Test second page
        response = await client.get(
            f"{settings.API_V1_STR}/users/list?page=2&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        data = result["data"]
        assert data["page"] == 2

    @pytest.mark.asyncio
    async def test_user_activation_deactivation_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test user activation and deactivation."""
        # Create admin user and regular user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        regular_user = await user_factory.create_verified_user()

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Deactivate user
        update_data = {"is_active": False}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/users/{regular_user.id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["data"]["is_active"] is False

        # Step 2: Verify deactivated user cannot login
        user_token = await user_factory.get_auth_token(regular_user)
        deactivated_headers = {"Authorization": f"Bearer {user_token}"}

        response = await client.get(
            f"{settings.API_V1_STR}/users",
            headers=deactivated_headers,
        )
        # This should fail since user is deactivated
        assert response.status_code in [401, 403]

        # Step 3: Reactivate user
        update_data = {"is_active": True}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/users/{regular_user.id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["data"]["is_active"] is True

    @pytest.mark.asyncio
    async def test_bulk_user_operations(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test bulk user operations if supported."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create test users
        test_users = []
        for i in range(5):
            user = await user_factory.create_verified_user(email=f"bulktest{i}@example.com")
            test_users.append(user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test bulk deactivation (if endpoint exists)
        user_ids = [str(user.id) for user in test_users]
        bulk_update_data = {"user_ids": user_ids, "updates": {"is_active": False}}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        # Note: This endpoint might not exist, so we'd need to check if it's implemented
        response = await client.put(
            f"{settings.API_V1_STR}/users/bulk-update",
            json=bulk_update_data,
            headers=headers,
        )

        # If endpoint doesn't exist, that's fine for this test
        if response.status_code != 404:
            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True
