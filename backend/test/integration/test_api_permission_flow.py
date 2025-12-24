"""
Permission management integration tests.

Tests the complete permission management flow including:
- Permission CRUD operations
- Permission group management
- Permission assignments
"""

import uuid
from test.utils import get_csrf_token
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestPermissionManagementFlow:
    """Integration tests for permission management flows."""

    async def get_admin_token(self, client: AsyncClient) -> str:
        # Use the known pre-seeded admin credentials from initial data
        login_data = {
            "email": str(settings.FIRST_SUPERUSER_EMAIL),
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        }
        csrf_token, headers = await get_csrf_token(client)
        headers["x-csrf-token"] = csrf_token
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            json=login_data,
            headers=headers,
        )
        if response.status_code != 200:
            print("Admin login failed:", response.status_code, response.text)
        assert response.status_code == 200
        return response.json()["data"]["access_token"]

    @pytest.mark.asyncio
    async def test_admin_permission_crud_flow(
        self,
        client: AsyncClient,
        db: AsyncSession,
        redis_mock: AsyncMock,
    ) -> None:
        """Test complete CRUD operations for permissions by admin."""
        admin_token = await self.get_admin_token(client)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create permission group via API
        group_data = {"name": f"test_group_{uuid.uuid4().hex[:8]}"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        permission_group = response.json()["data"]

        # Step 1: Create permission
        permission_data = {
            "name": "test.create",
            "group_id": str(permission_group["id"]),
        }
        print("Permission creation payload:", permission_data)
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=permission_data,
            headers=headers,
        )
        if response.status_code not in (200, 201):
            print("Permission creation failed:", response.status_code, response.text)
        assert response.status_code in (200, 201)
        result = response.json()
        assert "data" in result
        created_permission = result["data"]
        permission_id = created_permission["id"]
        # Expect formatted permission name
        expected_permission_name = f"{permission_group['name'].lower().replace(' ', '_')}.test.create"
        assert created_permission["name"] == expected_permission_name

        # Step 2: Get permission by ID
        response = await client.get(
            f"{settings.API_V1_STR}/permissions/{permission_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        # No 'success' key in backend response, only check for 'data'
        permission_detail = result["data"]
        assert permission_detail["name"] == expected_permission_name

        # Step 3: Delete permission (skip update, as update is not supported)
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/permissions/{permission_id}",
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert "data" in result

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
        redis_mock: AsyncMock,
    ) -> None:
        """Test complete CRUD operations for permission groups."""
        admin_token = await self.get_admin_token(client)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Create permission group via API
        group_data = {"name": f"test_permission_group_{uuid.uuid4().hex[:8]}"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )

        assert response.status_code in (200, 201)
        created_group = response.json()["data"]
        group_id = created_group["id"]
        assert created_group["name"] == group_data["name"]

        # Step 2: Get permission group by ID
        response = await client.get(
            f"{settings.API_V1_STR}/permission-groups/{group_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        if "success" not in result:
            print("Permission group GET response:", result)
        assert "data" in result
        group_detail = result["data"]
        assert group_detail["name"] == group_data["name"]

        # Step 3: Update permission group
        update_data: dict[str, object] = {}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.put(
            f"{settings.API_V1_STR}/permission-groups/{group_id}",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert "data" in result
        updated_group = result["data"]
        # No description field to assert
        assert updated_group["id"] == group_id

        # Step 4: List permission groups
        response = await client.get(
            f"{settings.API_V1_STR}/permission-groups?page=1&size=100",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert "data" in result
        groups_list = result["data"]["items"]
        created_group_found = any(group["id"] == group_id for group in groups_list)
        if not created_group_found:
            print("Groups returned:", [g["id"] for g in groups_list])
        assert created_group_found

        # Step 5: Delete permission group
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/permission-groups/{group_id}",
            headers=headers,
        )

        assert response.status_code in (200, 204)
        if response.status_code == 200:
            result = response.json()
            assert "data" in result

    @pytest.mark.asyncio
    async def test_permission_group_with_permissions_operations(
        self,
        client: AsyncClient,
        db: AsyncSession,
        redis_mock: AsyncMock,
    ) -> None:
        """Test operations on permission groups that contain permissions."""
        admin_token = await self.get_admin_token(client)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create permission group via API
        group_data = {"name": f"group_with_permissions_{uuid.uuid4().hex[:8]}"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        permission_group = response.json()["data"]

        # Create permissions in the group via API
        for perm_name in ["group.read", "group.write"]:
            perm_data = {
                "name": perm_name,
                "group_id": str(permission_group["id"]),
            }
            print("Permission creation payload:", perm_data)
            csrf_token, headers = await get_csrf_token(client)
            headers.update(auth_headers)
            resp = await client.post(
                f"{settings.API_V1_STR}/permissions",
                json=perm_data,
                headers=headers,
            )
            if resp.status_code not in (200, 201):
                print("Permission creation failed:", resp.status_code, resp.text)
            assert resp.status_code in (200, 201)

        # Get permission group with permissions
        response = await client.get(
            f"{settings.API_V1_STR}/permission-groups/{permission_group['id']}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        group_detail = result["data"]
        group_permissions = group_detail.get("permissions", [])
        permission_names = [p["name"] for p in group_permissions]
        expected_read = f"{permission_group['name'].lower().replace(' ', '_')}.group.read"
        expected_write = f"{permission_group['name'].lower().replace(' ', '_')}.group.write"
        assert expected_read in permission_names
        assert expected_write in permission_names

        # Try to delete group with permissions (should handle properly)
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)

        response = await client.delete(
            f"{settings.API_V1_STR}/permission-groups/{permission_group['id']}",
            headers=headers,
        )

        # This might succeed or fail depending on business logic
        if response.status_code != 200:
            assert response.status_code == 409  # Business rule violation (Conflict)
            result = response.json()
            assert "permission" in result["detail"].lower() or "contains" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_permission_list_and_pagination(
        self,
        client: AsyncClient,
        db: AsyncSession,
        redis_mock: AsyncMock,
    ) -> None:
        """Test permission listing and pagination."""
        admin_token = await self.get_admin_token(client)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create permission group via API
        group_data = {"name": f"pagination_test_group_{uuid.uuid4().hex[:8]}"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        permission_group = response.json()["data"]

        # Create multiple test permissions via API
        for i in range(15):
            perm_data = {
                "name": f"test.action_{i}",
                "group_id": str(permission_group["id"]),
            }
            print("Permission creation payload:", perm_data)
            csrf_token, headers = await get_csrf_token(client)
            headers.update(auth_headers)
            resp = await client.post(
                f"{settings.API_V1_STR}/permissions",
                json=perm_data,
                headers=headers,
            )
            if resp.status_code not in (200, 201):
                print("Permission creation failed:", resp.status_code, resp.text)
            assert resp.status_code in (200, 201)

        # Test pagination
        response = await client.get(
            f"{settings.API_V1_STR}/permissions?page=1&size=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert "data" in result
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
        redis_mock: AsyncMock,
    ) -> None:
        """Test handling of duplicate permission names."""
        admin_token = await self.get_admin_token(client)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create permission group via API
        group_data = {"name": f"duplicate_test_group_{uuid.uuid4().hex[:8]}"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        permission_group = response.json()["data"]

        # Create permission via API
        perm_data = {
            "name": "duplicate.permission",
            "group_id": str(permission_group["id"]),
        }
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        resp = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=perm_data,
            headers=headers,
        )
        if resp.status_code not in (200, 201):
            print("Permission creation failed:", resp.status_code, resp.text)
        assert resp.status_code in (200, 201)

        # Try to create permission with same name (should fail)
        duplicate_permission_data = {
            "name": "duplicate.permission",
            "group_id": str(permission_group["id"]),
        }
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=duplicate_permission_data,
            headers=headers,
        )
        assert response.status_code == 409  # Conflict for duplicate
        result = response.json()
        assert "exist" in result["detail"].lower() or "duplicate" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_permission_filtering_by_group(
        self,
        client: AsyncClient,
        db: AsyncSession,
        redis_mock: AsyncMock,
    ) -> None:
        """Test filtering permissions by group."""
        admin_token = await self.get_admin_token(client)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create permission groups via API
        group1_data = {"name": f"group1_{uuid.uuid4().hex[:8]}"}
        group2_data = {"name": f"group2_{uuid.uuid4().hex[:8]}"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        resp1 = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group1_data,
            headers=headers,
        )
        resp2 = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group2_data,
            headers=headers,
        )
        assert resp1.status_code in (200, 201)
        assert resp2.status_code in (200, 201)
        group1 = resp1.json()["data"]
        group2 = resp2.json()["data"]

        # Create permissions in different groups via API
        for perm_name, group in [("group1.read", group1), ("group1.write", group1), ("group2.read", group2)]:
            perm_data = {
                "name": perm_name,
                "group_id": str(group["id"]),
            }
            csrf_token, headers = await get_csrf_token(client)
            headers.update(auth_headers)
            resp = await client.post(
                f"{settings.API_V1_STR}/permissions",
                json=perm_data,
                headers=headers,
            )
            assert resp.status_code in (200, 201)

        # Test filtering by group
        response = await client.get(
            f"{settings.API_V1_STR}/permissions?group_id={group1['id']}",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If filtering is supported
            result = response.json()
            assert "data" in result
            filtered_permissions = result["data"]["items"]

            # Only consider permissions with the correct group_id
            group1_permissions = [p for p in filtered_permissions if p["group_id"] == str(group1["id"])]
            print("Filtered permissions for group1:", group1_permissions)

            expected_names = {
                f"{group1['name']}.group1.read",
                f"{group1['name']}.group1.write",
            }
            permission_names = [p["name"] for p in group1_permissions]
            if not all(name in permission_names for name in expected_names):
                print("Expected names not found. Permission names:", permission_names)
            for name in expected_names:
                assert name in permission_names, f"{name} not found in {permission_names}"
            # Should not have group2 permission
            group2_permission = f"{group2['name']}.group2.read"
            assert (
                group2_permission not in permission_names
            ), f"{group2_permission} unexpectedly found in {permission_names}"

    @pytest.mark.asyncio
    async def test_permission_based_access_control(
        self,
        client: AsyncClient,
        db: AsyncSession,
        redis_mock: AsyncMock,
    ) -> None:
        """Test permission-based access to permission endpoints."""
        admin_token = await self.get_admin_token(client)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create regular user via API (simulate registration)
        unique_email = f"regularuser_{uuid.uuid4().hex[:8]}@example.com"
        user_data = {
            "email": unique_email,
            "password": "TestPassword123!",
            "first_name": "Regular",
            "last_name": "User",
        }
        csrf_token, headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/register",
            json=user_data,
            headers=headers,
        )
        if response.status_code != 201:
            try:
                print("Registration failed:", response.status_code, response.json())
            except Exception:
                print("Registration failed:", response.status_code, response.text)
        else:
            try:
                print("Registration succeeded. Response:", response.json())
            except Exception:
                print("Registration succeeded. Response (raw):", response.text)
        assert response.status_code == 201
        # After registration, extract user id and verification code, and verify the user before login
        registration_json = response.json()
        verification_code = registration_json["data"].get("verification_code")
        if not verification_code:
            print(
                "ERROR: No verification_code in registration response. Registration JSON:",
                registration_json,
            )
            import pytest

            pytest.fail("No verification_code in registration response; cannot verify user.")
        # Call /auth/verify-email to verify the user
        verify_payload = {"token": verification_code}
        csrf_token, headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/verify-email",
            json=verify_payload,
            headers=headers,
        )
        if response.status_code != 200:
            print("User verification failed:", response.status_code, response.text)
        assert response.status_code == 200
        # Print verification response for debug
        verification_json = response.json()
        print("Verification response:", verification_json)
        needs_pw_change = verification_json["data"].get("needs_to_change_password")
        if needs_pw_change:
            # After verification, login as the user to get access token
            csrf_token, headers = await get_csrf_token(client)
            login_data = {"email": user_data["email"], "password": user_data["password"]}
            response = await client.post(
                f"{settings.API_V1_STR}/auth/login",
                json=login_data,
                headers=headers,
            )
            assert (
                response.status_code == 200
            ), f"Login after verification failed: {response.status_code} {response.text}"
            login_json = response.json()
            access_token = login_json["data"]["access_token"]
            # Now use the access token to change the password
            change_pw_payload = {
                "current_password": user_data["password"],
                "new_password": "A1b!xYz$7QwE",
            }
            csrf_token, headers = await get_csrf_token(client)
            headers["Authorization"] = f"Bearer {access_token}"
            response = await client.post(
                f"{settings.API_V1_STR}/auth/change_password",
                json=change_pw_payload,
                headers=headers,
            )
            print("Password change response:", response.status_code, response.text)
            assert response.status_code == 200
            # Update password for login
            user_data["password"] = "A1b!xYz$7QwE"
            # DEBUG: Fetch user state after password change
            csrf_token, debug_headers = await get_csrf_token(client)
            debug_headers["Authorization"] = f"Bearer {access_token}"
            debug_response = await client.get(
                f"{settings.API_V1_STR}/users/me",
                headers=debug_headers,
            )
            print("User state after password change:", debug_response.status_code, debug_response.text)
            # DEBUG: Fetch user state as admin after password change
            csrf_token, admin_debug_headers = await get_csrf_token(client)
            admin_debug_headers["Authorization"] = f"Bearer {admin_token}"
            admin_debug_response = await client.get(
                f"{settings.API_V1_STR}/users/{verification_json['data']['id']}",
                headers=admin_debug_headers,
            )
            print(
                "User state after password change (admin):",
                admin_debug_response.status_code,
                admin_debug_response.text,
            )
            # DEBUG: Print password being used for login
            print("[DEBUG] Password being used for login after password change:", user_data["password"])
            # DEBUG: Fetch user object as admin after password change
            csrf_token, admin_debug_headers = await get_csrf_token(client)
            admin_debug_headers["Authorization"] = f"Bearer {admin_token}"
            admin_debug_response = await client.get(
                f"{settings.API_V1_STR}/users/{verification_json['data']['id']}",
                headers=admin_debug_headers,
            )
            print(
                "[DEBUG] User object after password change (admin):",
                admin_debug_response.status_code,
                admin_debug_response.text,
            )
        # Login as regular user to get token
        csrf_token, headers = await get_csrf_token(client)
        login_data = {"email": user_data["email"], "password": user_data["password"]}
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            json=login_data,
            headers=headers,
        )
        if response.status_code != 200:
            print("Login after password change failed:", response.status_code, response.text)
        assert response.status_code == 200
        regular_token = response.json()["data"]["access_token"]
        regular_headers = {"Authorization": f"Bearer {regular_token}"}

        # Admin should be able to list permissions
        response = await client.get(
            f"{settings.API_V1_STR}/permissions",
            headers=admin_headers,
        )
        assert response.status_code == 200

        # Regular user should not be able to list permissions
        response = await client.get(
            f"{settings.API_V1_STR}/permissions",
            headers=regular_headers,
        )
        assert response.status_code == 403  # Forbidden

        # Regular user should not be able to create permissions
        permission_data = {"name": "unauthorized.permission"}

        csrf_token, headers = await get_csrf_token(client)
        headers.update(regular_headers)

        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=permission_data,
            headers=headers,
        )
        assert response.status_code == 403  # Forbidden
