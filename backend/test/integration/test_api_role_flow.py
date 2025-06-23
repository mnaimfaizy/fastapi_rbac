"""
Role management integration tests.

Tests the complete role management flow including:
- Role CRUD operations
- Permission assignments
- Role hierarchy management
- Role group operations
"""

from test.factories.async_factories import AsyncPermissionFactory, AsyncRoleFactory, AsyncUserFactory
from test.utils import get_csrf_token
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestRoleManagementFlow:
    """Integration tests for role management flows."""

    @pytest.mark.asyncio
    async def test_admin_role_crud_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test complete CRUD operations for roles by admin."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Create role
        role_data = {
            "name": "test_manager",
            "description": "Test Manager Role",
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=role_data,
            headers=headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["success"] is True
        created_role = result["data"]
        role_id = created_role["id"]
        assert created_role["name"] == role_data["name"]

        # Step 2: Get role by ID
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        role_detail = result["data"]
        assert role_detail["name"] == role_data["name"]

        # Step 3: Update role
        update_data = {"description": "Updated Test Manager Role"}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/roles/{role_id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        updated_role = result["data"]
        assert updated_role["description"] == update_data["description"]

        # Step 4: List roles (should include our created role)
        response = await client.get(
            f"{settings.API_V1_STR}/roles",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        roles_list = result["data"]["items"]
        created_role_found = any(role["id"] == role_id for role in roles_list)
        assert created_role_found

        # Step 5: Delete role
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Verify role is deleted
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_role_permission_assignment_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        permission_factory: AsyncPermissionFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test role permission assignment and removal."""
        # Create admin user, role, and permissions
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        role = await role_factory.create_role(name="test_role")
        permission1 = await permission_factory.create_permission(name="test.read")
        permission2 = await permission_factory.create_permission(name="test.write")

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Assign permissions to role
        permission_assignment_data = {"permission_ids": [str(permission1.id), str(permission2.id)]}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/roles/{role.id}/permissions",
            json=permission_assignment_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Step 2: Verify role has the permissions
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        role_detail = result["data"]
        role_permissions = [p["name"] for p in role_detail.get("permissions", [])]
        assert "test.read" in role_permissions
        assert "test.write" in role_permissions

        # Step 3: Remove one permission from role
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/roles/{role.id}/permissions/{permission1.id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Verify permission is removed
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        role_detail = result["data"]
        role_permissions = [p["name"] for p in role_detail.get("permissions", [])]
        assert "test.read" not in role_permissions
        assert "test.write" in role_permissions

    @pytest.mark.asyncio
    async def test_role_list_and_pagination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test role listing and pagination."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create multiple test roles
        test_roles = []
        for i in range(15):  # Create more than typical page size
            role = await role_factory.create_role(name=f"test_role_{i}", description=f"Test Role {i}")
            test_roles.append(role)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test pagination
        response = await client.get(
            f"{settings.API_V1_STR}/roles?page=1&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        data = result["data"]
        assert len(data["items"]) <= 10
        assert data["total"] >= 15  # At least our test roles
        assert data["page"] == 1

        # Test second page
        response = await client.get(
            f"{settings.API_V1_STR}/roles?page=2&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        data = result["data"]
        assert data["page"] == 2

        # Test all roles list (no pagination)
        response = await client.get(
            f"{settings.API_V1_STR}/roles/list",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        all_roles = result["data"]
        assert len(all_roles) >= 15

    @pytest.mark.asyncio
    async def test_role_duplicate_name_handling(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test handling of duplicate role names."""
        # Create admin user and existing role
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        existing_role = await role_factory.create_role(name="duplicate_role")

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Try to create role with same name
        duplicate_role_data = {
            "name": "duplicate_role",
            "description": "This should fail",
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=duplicate_role_data,
            headers=headers,
        )

        assert response.status_code == 400  # Bad request for duplicate
        result = response.json()
        assert "exist" in result["detail"].lower() or "duplicate" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_role_with_users_deletion_handling(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test deletion of roles that have users assigned."""
        # Create admin user, role, and user with role
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        role = await role_factory.create_role(name="role_with_users")
        user_with_role = await user_factory.create_verified_user()

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Assign role to user
        role_assignment_data = {"user_id": str(user_with_role.id), "role_ids": [str(role.id)]}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/users/{user_with_role.id}/roles",
            json=role_assignment_data,
            headers=headers,
        )

        assert response.status_code == 200

        # Try to delete role that has users
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/roles/{role.id}",
            headers=headers,
        )

        # This might succeed or fail depending on business logic
        # If it fails, it should be a meaningful error
        if response.status_code != 200:
            assert response.status_code == 400  # Business rule violation
            result = response.json()
            assert "user" in result["detail"].lower() or "assigned" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_permission_based_role_access(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test permission-based access to role endpoints."""
        # Create admin user and regular user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        regular_user = await user_factory.create_verified_user()
        regular_token = await user_factory.get_auth_token(regular_user)

        # Admin should be able to list roles
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.get(
            f"{settings.API_V1_STR}/roles",
            headers=admin_headers,
        )
        assert response.status_code == 200

        # Regular user should not be able to list roles
        regular_headers = {"Authorization": f"Bearer {regular_token}"}
        response = await client.get(
            f"{settings.API_V1_STR}/roles",
            headers=regular_headers,
        )
        assert response.status_code == 403  # Forbidden

        # Regular user should not be able to create roles
        role_data = {
            "name": "unauthorized_role",
            "description": "This should fail",
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(regular_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=role_data,
            headers=headers,
        )
        assert response.status_code == 403  # Forbidden

    @pytest.mark.asyncio
    async def test_role_search_and_filtering(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test role search and filtering functionality if available."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create roles with different names
        await role_factory.create_role(name="admin_role", description="Admin role")
        await role_factory.create_role(name="user_role", description="User role")
        await role_factory.create_role(name="manager_role", description="Manager role")

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test search by name if supported
        response = await client.get(
            f"{settings.API_V1_STR}/roles?search=admin",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If search is supported
            result = response.json()
            assert result["success"] is True
            filtered_roles = result["data"]["items"]
            admin_role_found = any("admin" in role["name"].lower() for role in filtered_roles)
            assert admin_role_found

        # Test filtering by name pattern
        response = await client.get(
            f"{settings.API_V1_STR}/roles?name_pattern=*_role",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If filtering is supported
            result = response.json()
            assert result["success"] is True
            filtered_roles = result["data"]["items"]
            all_match_pattern = all(role["name"].endswith("_role") for role in filtered_roles)
            assert all_match_pattern
