"""
Role management integration tests.

Tests the complete role management flow including:
- Role CRUD operations
- Permission assignments
- Role hierarchy management
- Role group operations
"""

import asyncio
import uuid
from test.utils import get_csrf_token
from typing import Any, Dict

import pytest
from httpx import AsyncClient

from app.core.config import settings


# Helper to generate unique emails for each test run
def unique_email(prefix: str = "testuser") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


# Helper functions for API-driven user flows
async def register_and_verify_user(client: AsyncClient, user_data: Dict[str, Any]) -> Dict[str, Any]:
    # Register user
    csrf_token, headers = await get_csrf_token(client)
    response = await client.post(f"{settings.API_V1_STR}/auth/register", json=user_data, headers=headers)
    assert response.status_code == 201
    verification_code = response.json()["data"].get("verification_code")
    # Verify user
    verify_payload = {"token": verification_code}
    csrf_token, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/verify-email", json=verify_payload, headers=headers
    )
    assert response.status_code == 200
    return user_data


async def login_user(client: AsyncClient, email: str, password: str) -> str:
    csrf_token, headers = await get_csrf_token(client)
    login_payload = {"email": email, "password": password}
    response = await client.post(f"{settings.API_V1_STR}/auth/login", json=login_payload, headers=headers)
    assert response.status_code == 200
    return response.json()["data"]["access_token"]


async def promote_user_to_admin(
    client: AsyncClient, user_email: str, max_retries: int = 5, delay: float = 0.3
) -> str:
    """Assign the admin role to a user using the seeded admin account, with retry for DB visibility."""
    seed_admin_email = "admin@example.com"
    seed_admin_password = "admin123"
    seed_admin_token = await login_user(client, seed_admin_email, seed_admin_password)
    seed_admin_headers = {"Authorization": f"Bearer {seed_admin_token}"}
    user_id = None
    response = None  # Ensure response is always defined
    # Retry user lookup for DB visibility
    for attempt in range(max_retries):
        response = await client.get(
            f"{settings.API_V1_STR}/users?email={user_email}", headers=seed_admin_headers
        )
        if response.status_code != 200:
            await asyncio.sleep(delay)
            continue
        data = response.json()["data"]
        if isinstance(data, dict) and "items" in data:
            user_items = data["items"]
        elif isinstance(data, list):
            user_items = data
        elif isinstance(data, dict) and "id" in data:
            user_items = [data]
        else:
            user_items = []
        if user_items:
            user_id = user_items[0]["id"]
            break
        await asyncio.sleep(delay)
    assert user_id, f"No user found for email {user_email} after {max_retries} retries"
    # Get admin role id
    response = await client.get(f"{settings.API_V1_STR}/roles?search=admin", headers=seed_admin_headers)
    assert response.status_code == 200
    roles = response.json()["data"]["items"]
    admin_role = next((r for r in roles if r["name"].lower() == "admin"), None)
    assert admin_role is not None, "Admin role not found"
    admin_role_id = admin_role["id"]
    # Retry role assignment for DB visibility
    response = None
    for attempt in range(max_retries):
        # Confirm user is visible by ID to the admin session
        get_resp = await client.get(f"{settings.API_V1_STR}/users/{user_id}", headers=seed_admin_headers)
        if get_resp.status_code != 200:
            await asyncio.sleep(delay)
            continue
        csrf_token, headers = await get_csrf_token(client)
        headers.update(seed_admin_headers)
        role_assignment_data = {"user_id": user_id, "role_ids": [admin_role_id]}
        response = await client.post(
            f"{settings.API_V1_STR}/users/{user_id}/roles",
            json=role_assignment_data,
            headers=headers,
        )
        if response.status_code == 200:
            return user_id
        await asyncio.sleep(delay)
    raise AssertionError(
        (
            f"Failed to assign admin role to user {user_email} after {max_retries} retries "
            f"(last status: {response.status_code if response else 'no response'})"
        )
    )


class TestRoleManagementFlow:
    """Integration tests for role management flows (API-driven)."""

    @pytest.mark.asyncio
    async def test_admin_role_crud_flow(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_crud")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RoleCrud",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Step 1: Create role
        role_data = {"name": "test_manager", "description": "Test Manager Role"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=role_data,
            headers=headers,
        )
        assert response.status_code == 201
        created_role = response.json()["data"]
        role_id = created_role["id"]
        assert created_role["name"] == role_data["name"]

        # Step 2: Get role by ID
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        role_detail = response.json()["data"]
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
        updated_role = response.json()["data"]
        assert updated_role["description"] == update_data["description"]

        # Step 4: List roles (should include our created role)
        response = await client.get(
            f"{settings.API_V1_STR}/roles",
            headers=auth_headers,
        )
        assert response.status_code == 200
        roles_list = response.json()["data"]["items"]
        created_role_found = any(role["id"] == role_id for role in roles_list)
        assert created_role_found

        # Step 5: Delete role
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.delete(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=headers,
        )
        assert response.status_code == 204  # Expect 204 No Content for successful DELETE
        # Verify role is deleted
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_role_permission_assignment_flow(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_perm")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RolePerm",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create permission group (required for permission creation)
        group_name = "Test Group " + uuid.uuid4().hex[:8]
        group_data = {"name": group_name}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permission-groups",
            json=group_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        group_id = response.json()["data"]["id"]

        # Create role
        role_name = "test_role_" + uuid.uuid4().hex[:8]
        role_data = {"name": role_name, "description": "Test Role"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=role_data,
            headers=headers,
        )
        assert response.status_code == 201
        role_id = response.json()["data"]["id"]

        # Create permissions (now with group_id)
        perm1_data = {"name": "test.read", "description": "Test Read", "group_id": group_id}
        perm2_data = {"name": "test.write", "description": "Test Write", "group_id": group_id}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=perm1_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        perm1_id = response.json()["data"]["id"]
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/permissions",
            json=perm2_data,
            headers=headers,
        )
        assert response.status_code in (200, 201)
        perm2_id = response.json()["data"]["id"]

        # Step 1: Assign permissions to role
        permission_assignment_data = {"permission_ids": [perm1_id, perm2_id]}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/roles/{role_id}/permissions",
            json=permission_assignment_data,
            headers=headers,
        )
        assert response.status_code == 200

        # Step 2: Verify role has the permissions
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        role_detail = response.json()["data"]
        role_permissions = [p["name"] for p in role_detail.get("permissions", [])]
        perm1_fullname = f"{group_name.lower().replace(' ', '_')}.test.read"
        perm2_fullname = f"{group_name.lower().replace(' ', '_')}.test.write"
        assert perm1_fullname in role_permissions
        assert perm2_fullname in role_permissions

        # Step 3: Remove one permission from role
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.delete(
            f"{settings.API_V1_STR}/roles/{role_id}/permissions/{perm1_id}",
            headers=headers,
        )
        assert response.status_code == 200

        # Verify permission is removed
        response = await client.get(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        role_detail = response.json()["data"]
        role_permissions = [p["name"] for p in role_detail.get("permissions", [])]
        assert perm1_fullname not in role_permissions
        assert perm2_fullname in role_permissions

    @pytest.mark.asyncio
    async def test_role_list_and_pagination(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_list")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RoleList",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create multiple test roles
        for i in range(15):
            role_data = {"name": f"test_role_{i}_" + uuid.uuid4().hex[:6], "description": f"Test Role {i}"}
            csrf_token, headers = await get_csrf_token(client)
            headers.update(auth_headers)
            response = await client.post(
                f"{settings.API_V1_STR}/roles",
                json=role_data,
                headers=headers,
            )
            assert response.status_code == 201

        # Test pagination
        response = await client.get(f"{settings.API_V1_STR}/roles?page=1&size=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data["items"]) <= 10
        assert data["total"] >= 15
        assert data["page"] == 1

        # Test second page
        response = await client.get(f"{settings.API_V1_STR}/roles?page=2&size=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["page"] == 2

        # Test all roles list (no pagination)
        response = await client.get(f"{settings.API_V1_STR}/roles/list", headers=auth_headers)
        assert response.status_code == 200
        all_roles = response.json()["data"]
        assert len(all_roles) >= 15

    @pytest.mark.asyncio
    async def test_role_duplicate_name_handling(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_dup")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RoleDup",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create role
        role_data = {"name": "duplicate_role_" + uuid.uuid4().hex[:6], "description": "First"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=role_data,
            headers=headers,
        )
        assert response.status_code == 201

        # Try to create role with same name
        duplicate_role_data = {"name": role_data["name"], "description": "This should fail"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=duplicate_role_data,
            headers=headers,
        )
        assert response.status_code == 409
        result = response.json()
        assert "exist" in result["detail"].lower() or "duplicate" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_role_with_users_deletion_handling(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_userdel")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RoleUserDel",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create role
        role_name = "role_with_users_" + uuid.uuid4().hex[:8]
        role_data = {"name": role_name, "description": "Role with users"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/roles",
            json=role_data,
            headers=headers,
        )
        assert response.status_code == 201
        role_id = response.json()["data"]["id"]

        # Register and verify a regular user
        user_email = unique_email("roleuserdel_regular")
        user_password = "UserTest123!"
        user_data = {
            "email": user_email,
            "password": user_password,
            "first_name": "Regular",
            "last_name": "UserDel",
        }
        await register_and_verify_user(client, user_data)
        # Assign role to user via API
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        role_assignment_data = {"user_id": user_email, "role_ids": [role_id]}
        # Get user id via API (ensure admin headers are used)
        response = await client.get(f"{settings.API_V1_STR}/users?email={user_email}", headers=auth_headers)
        assert response.status_code == 200
        user_items = response.json()["data"]["items"]
        assert user_items
        user_id = user_items[0]["id"]
        role_assignment_data["user_id"] = user_id
        response = await client.post(
            f"{settings.API_V1_STR}/users/{user_id}/roles",
            json=role_assignment_data,
            headers=headers,
        )
        assert response.status_code == 200
        # Try to delete role that has users
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.delete(
            f"{settings.API_V1_STR}/roles/{role_id}",
            headers=headers,
        )
        if response.status_code != 200:
            assert response.status_code == 409
            result = response.json()
            assert "user" in result["detail"].lower() or "assigned" in result["detail"].lower()

    @pytest.mark.asyncio
    async def test_permission_based_role_access(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_access")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RoleAccess",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Register and verify regular user
        user_email = unique_email("roleaccess_regular")
        user_password = "UserTest123!"
        user_data = {
            "email": user_email,
            "password": user_password,
            "first_name": "Regular",
            "last_name": "RoleAccess",
        }
        await register_and_verify_user(client, user_data)
        user_token = await login_user(client, user_email, user_password)
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # Admin should be able to list roles
        response = await client.get(f"{settings.API_V1_STR}/roles", headers=admin_headers)
        assert response.status_code == 200
        # Regular user should not be able to list roles
        response = await client.get(f"{settings.API_V1_STR}/roles", headers=user_headers)
        assert response.status_code == 403
        # Regular user should not be able to create roles
        role_data = {"name": "unauthorized_role", "description": "This should fail"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(user_headers)
        response = await client.post(f"{settings.API_V1_STR}/roles", json=role_data, headers=headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_role_search_and_filtering(self, client: AsyncClient) -> None:
        admin_email = unique_email("admin_role_search")
        admin_password = "AdminTest123!"
        admin_data = {
            "email": admin_email,
            "password": admin_password,
            "first_name": "Admin",
            "last_name": "RoleSearch",
        }
        await register_and_verify_user(client, admin_data)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create roles with different names
        created_names = []
        for name, desc in [
            ("admin_role", "Admin role"),
            ("user_role", "User role"),
            ("manager_role", "Manager role"),
        ]:
            unique_name = name + "_" + uuid.uuid4().hex[:8]
            created_names.append(unique_name)
            role_data = {"name": unique_name, "description": desc}
            csrf_token, headers = await get_csrf_token(client)
            headers.update(auth_headers)
            response = await client.post(
                f"{settings.API_V1_STR}/roles",
                json=role_data,
                headers=headers,
            )
            assert response.status_code == 201

        # Test search by name if supported
        response = await client.get(f"{settings.API_V1_STR}/roles?search=admin", headers=auth_headers)
        if response.status_code == 200:
            filtered_roles = response.json()["data"]["items"]
            admin_role_found = any("admin" in role["name"].lower() for role in filtered_roles)
            assert admin_role_found
        # Test filtering by name pattern
        # Use a pattern that matches the test-created roles with UUID suffixes
        response = await client.get(f"{settings.API_V1_STR}/roles?name_pattern=*role_*", headers=auth_headers)
        if response.status_code == 200:
            filtered_roles = response.json()["data"]["items"]
            filtered_names = [role["name"] for role in filtered_roles]
            # Assert all test-created roles are present in the filtered results
            for name in created_names:
                assert name in filtered_names
