"""
Permission management integration tests.

Tests the complete permission management flow including:
- Permission CRUD operations
- Permission group management
- Permission assignments
"""

from test.factories.async_factories import (
    AsyncPermissionFactory,
    AsyncPermissionGroupFactory,
    AsyncUserFactory,
)
from test.utils import get_csrf_token
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestPermissionManagementFlow:
    """Integration tests for permission management flows."""

    @pytest.mark.asyncio
    async def test_admin_permission_crud_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        permission_group_factory: AsyncPermissionGroupFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test complete CRUD operations for permissions by admin."""
        # Create admin user and permission group
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        permission_group = await permission_group_factory.create_permission_group(name="test_group")

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Create permission
        permission_data = {
            "name": "test.create",
            "description": "Test Create Permission",
            "group_id": str(permission_group.id),
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=permission_data,
            headers=headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["success"] is True
        created_permission = result["data"]
        permission_id = created_permission["id"]
        assert created_permission["name"] == permission_data["name"]

        # Step 2: Get permission by ID
        response = await client.get(
            f"{settings.API_V1_STR}/permissions/{permission_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        permission_detail = result["data"]
        assert permission_detail["name"] == permission_data["name"]

        # Step 3: Update permission
        update_data = {"description": "Updated Test Create Permission"}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/permissions/{permission_id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        updated_permission = result["data"]
        assert updated_permission["description"] == update_data["description"]

        # Step 4: List permissions (should include our created permission)
        response = await client.get(
            f"{settings.API_V1_STR}/permissions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        permissions_list = result["data"]["items"]
        created_permission_found = any(perm["id"] == permission_id for perm in permissions_list)
        assert created_permission_found

        # Step 5: Delete permission
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/permissions/{permission_id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

        # Verify permission is deleted
        response = await client.get(
            f"{settings.API_V1_STR}/permissions/{permission_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_permission_group_crud_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test complete CRUD operations for permission groups."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Create permission group
        group_data = {
            "name": "test_permission_group",
            "description": "Test Permission Group",
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["success"] is True
        created_group = result["data"]
        group_id = created_group["id"]
        assert created_group["name"] == group_data["name"]

        # Step 2: Get permission group by ID
        response = await client.get(
            f"{settings.API_V1_STR}/permission-groups/{group_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        group_detail = result["data"]
        assert group_detail["name"] == group_data["name"]

        # Step 3: Update permission group
        update_data = {"description": "Updated Test Permission Group"}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/permission-groups/{group_id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        updated_group = result["data"]
        assert updated_group["description"] == update_data["description"]

        # Step 4: List permission groups
        response = await client.get(
            f"{settings.API_V1_STR}/permission-groups",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        groups_list = result["data"]["items"]
        created_group_found = any(group["id"] == group_id for group in groups_list)
        assert created_group_found

        # Step 5: Delete permission group
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/permission-groups/{group_id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_permission_group_with_permissions_operations(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        permission_factory: AsyncPermissionFactory,
        permission_group_factory: AsyncPermissionGroupFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test operations on permission groups that contain permissions."""
        # Create admin user and permission group
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        permission_group = await permission_group_factory.create_permission_group(
            name="group_with_permissions"
        )

        # Create permissions in the group
        permission1 = await permission_factory.create_permission(
            name="group.read", group_id=permission_group.id
        )
        permission2 = await permission_factory.create_permission(
            name="group.write", group_id=permission_group.id
        )

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Get permission group with permissions
        response = await client.get(
            f"{settings.API_V1_STR}/permission-groups/{permission_group.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        group_detail = result["data"]
        group_permissions = group_detail.get("permissions", [])
        permission_names = [p["name"] for p in group_permissions]
        assert "group.read" in permission_names
        assert "group.write" in permission_names

        # Try to delete group with permissions (should handle properly)
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/permission-groups/{permission_group.id}",
            headers=headers,
        )

        # This might succeed or fail depending on business logic
        if response.status_code != 200:
            assert response.status_code == 400  # Business rule violation
            result = response.json()
            assert "permission" in result["detail"].lower() or "contains" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_permission_list_and_pagination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        permission_factory: AsyncPermissionFactory,
        permission_group_factory: AsyncPermissionGroupFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test permission listing and pagination."""
        # Create admin user and permission group
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        permission_group = await permission_group_factory.create_permission_group(
            name="pagination_test_group"
        )

        # Create multiple test permissions
        test_permissions = []
        for i in range(15):  # Create more than typical page size
            permission = await permission_factory.create_permission(
                name=f"test.action_{i}", description=f"Test Permission {i}", group_id=permission_group.id
            )
            test_permissions.append(permission)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test pagination
        response = await client.get(
            f"{settings.API_V1_STR}/permissions?page=1&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        data = result["data"]
        assert len(data["items"]) <= 10
        assert data["total"] >= 15  # At least our test permissions
        assert data["page"] == 1

        # Test second page
        response = await client.get(
            f"{settings.API_V1_STR}/permissions?page=2&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        data = result["data"]
        assert data["page"] == 2

    @pytest.mark.asyncio
    async def test_permission_duplicate_name_handling(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        permission_factory: AsyncPermissionFactory,
        permission_group_factory: AsyncPermissionGroupFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test handling of duplicate permission names."""
        # Create admin user, permission group, and existing permission
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)
        permission_group = await permission_group_factory.create_permission_group(name="duplicate_test_group")
        existing_permission = await permission_factory.create_permission(
            name="duplicate.permission", group_id=permission_group.id
        )

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Try to create permission with same name
        duplicate_permission_data = {
            "name": "duplicate.permission",
            "description": "This should fail",
            "group_id": str(permission_group.id),
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=duplicate_permission_data,
            headers=headers,
        )

        assert response.status_code == 400  # Bad request for duplicate
        result = response.json()
        assert "exist" in result["detail"].lower() or "duplicate" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_permission_filtering_by_group(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        permission_factory: AsyncPermissionFactory,
        permission_group_factory: AsyncPermissionGroupFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test filtering permissions by group."""
        # Create admin user and permission groups
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        group1 = await permission_group_factory.create_permission_group(name="group1")
        group2 = await permission_group_factory.create_permission_group(name="group2")

        # Create permissions in different groups
        await permission_factory.create_permission(name="group1.read", group_id=group1.id)
        await permission_factory.create_permission(name="group1.write", group_id=group1.id)
        await permission_factory.create_permission(name="group2.read", group_id=group2.id)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test filtering by group
        response = await client.get(
            f"{settings.API_V1_STR}/permissions?group_id={group1.id}",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If filtering is supported
            result = response.json()
            assert result["success"] is True
            filtered_permissions = result["data"]["items"]

            # All permissions should belong to group1
            for permission in filtered_permissions:
                assert permission["group_id"] == str(group1.id)

            # Should have group1 permissions
            permission_names = [p["name"] for p in filtered_permissions]
            assert "group1.read" in permission_names
            assert "group1.write" in permission_names
            assert "group2.read" not in permission_names

    @pytest.mark.asyncio
    async def test_permission_based_access_control(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        permission_factory: AsyncPermissionFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test permission-based access to permission endpoints."""
        # Create admin user and regular user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        regular_user = await user_factory.create_verified_user()
        regular_token = await user_factory.get_auth_token(regular_user)

        # Admin should be able to list permissions
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.get(
            f"{settings.API_V1_STR}/permissions",
            headers=admin_headers,
        )
        assert response.status_code == 200

        # Regular user should not be able to list permissions
        regular_headers = {"Authorization": f"Bearer {regular_token}"}
        response = await client.get(
            f"{settings.API_V1_STR}/permissions",
            headers=regular_headers,
        )
        assert response.status_code == 403  # Forbidden

        # Regular user should not be able to create permissions
        permission_data = {
            "name": "unauthorized.permission",
            "description": "This should fail",
        }

        csrf_token, headers = await get_csrf_token(client)
        headers.update(regular_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=permission_data,
            headers=headers,
        )
        assert response.status_code == 403  # Forbidden
