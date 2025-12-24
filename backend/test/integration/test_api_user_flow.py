"""
User management integration tests.

Tests the complete user management flow including:
- User CRUD operations
- Role assignments
- Permission checks
- Profile management
"""

import asyncio
import random
import string
import uuid
from test.utils import get_csrf_token, random_email
from typing import Any, Dict, Optional, Tuple

import jwt
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.config import settings as app_settings


# --- Helper functions for API-driven flows ---
async def register_and_verify_user(
    client: AsyncClient,
    email: Optional[str] = None,
    password: Optional[str] = None,
    first_name: str = "Test",
    last_name: str = "User",
) -> Tuple[str, str]:
    if not email:
        email = random_email()
    if not password:
        password = "SecurePassword123!"
    user_data = {
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "password": password,
        "contact_phone": "+1234567890",
    }
    csrf_token, headers = await get_csrf_token(client)
    response = await client.post(f"{settings.API_V1_STR}/auth/register", json=user_data, headers=headers)
    if response.status_code != 201:
        print(f"Registration failed for {email}: {response.status_code} {response.text}")
    assert response.status_code == 201
    verification_code = response.json()["data"].get("verification_code")
    # Verify email
    verify_payload = {"token": verification_code}
    csrf_token, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/verify-email", json=verify_payload, headers=headers
    )
    assert response.status_code == 200
    return email, password


async def login_user(client: AsyncClient, email: str, password: str) -> Optional[str]:
    csrf_token, headers = await get_csrf_token(client)
    login_data = {"email": email, "password": password}
    response = await client.post(f"{settings.API_V1_STR}/auth/login", json=login_data, headers=headers)
    if response.status_code != 200:
        print(f"Admin login failed for {email}: {response.status_code} {response.text}")
    if response.status_code == 200:
        json_resp = response.json()
        token = json_resp.get("access_token")
        if not token and "data" in json_resp and isinstance(json_resp["data"], dict):
            token = json_resp["data"].get("access_token")
        if not token:
            print(f"Login for {email} returned 200 but no access_token. Response: {response.text}")
        if isinstance(token, str):
            return token
        return None
    return None


async def promote_user_to_admin(
    client: AsyncClient,
    user_email: str,
    max_retries: int = 5,
    delay: float = 0.3,
) -> Optional[Dict[str, Any]]:
    """Assign the admin role to a user using the seeded admin account, with retry for DB visibility.
    Also sets is_superuser=True."""
    seed_admin_email = str(settings.FIRST_SUPERUSER_EMAIL)
    seed_admin_password = settings.FIRST_SUPERUSER_PASSWORD
    admin_token = await login_user(client, seed_admin_email, seed_admin_password)
    assert admin_token is not None, (
        f"Admin login failed for {seed_admin_email}. "
        "Check that the seeded admin user exists and the password is correct. "
        "If this fails, check the login endpoint and DB seeding logic."
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    user_id = None
    response = None  # Ensure response is always defined
    # Retry user lookup for DB visibility
    for attempt in range(max_retries):
        response = await client.get(f"{settings.API_V1_STR}/users?email={user_email}", headers=admin_headers)
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
    response = await client.get(f"{settings.API_V1_STR}/roles?search=admin", headers=admin_headers)
    assert response.status_code == 200
    roles = response.json()["data"]["items"]
    admin_role = next((r for r in roles if r["name"].lower() == "admin"), None)
    assert admin_role is not None, "Admin role not found"
    admin_role_id = admin_role["id"]
    # Retry role assignment for DB visibility
    response = None
    for attempt in range(max_retries):
        get_resp = await client.get(f"{settings.API_V1_STR}/users/{user_id}", headers=admin_headers)
        if get_resp.status_code != 200:
            await asyncio.sleep(delay)
            continue
        csrf_token, headers = await get_csrf_token(client)
        headers.update(admin_headers)
        role_assignment_data = {"user_id": user_id, "role_ids": [admin_role_id]}
        response = await client.post(
            f"{settings.API_V1_STR}/users/{user_id}/roles",
            json=role_assignment_data,
            headers=headers,
        )
        if response.status_code == 200:
            break
        await asyncio.sleep(delay)
    else:
        raise AssertionError(
            (
                f"Failed to assign admin role to user {user_email} after {max_retries} retries "
                f"(last status: {response.status_code if response else 'no response'})"
            )
        )
    # Set is_superuser=True for the user (with retry)
    for attempt in range(max_retries):
        csrf_token, headers = await get_csrf_token(client)
        headers.update(admin_headers)
        update_data = {"is_superuser": True}
        response = await client.put(
            f"{settings.API_V1_STR}/users/{user_id}",
            json=update_data,
            headers=headers,
        )
        if response.status_code == 200:
            return user_id
        await asyncio.sleep(delay)
    raise AssertionError(
        f"Failed to set is_superuser=True for user {user_email} after {max_retries} retries "
        f"(last status: {response.status_code if response else 'no response'})"
    )


def generate_strong_password(length: int = 16) -> str:
    """Generate a strong password that avoids sequential characters and meets complexity requirements."""
    # Avoid obvious sequences and repeated chars
    while True:
        password = "".join(random.sample(string.ascii_letters + string.digits + "!@#$%^&*()_+-=", length))
        # Check for sequential chars
        sequential = any(
            password[i : i + 3] in string.ascii_lowercase
            or password[i : i + 3] in string.ascii_uppercase
            or password[i : i + 3] in string.digits
            for i in range(len(password) - 2)
        )
        if sequential:
            continue
        # Check for at least one uppercase, one lowercase, one digit, one special
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in "!@#$%^&*()_+-=" for c in password)
        ):
            return password


class TestUserManagementFlow:
    """Integration tests for user management flows (API-driven)."""

    @pytest.mark.asyncio
    async def test_admin_user_crud_flow(self, client: AsyncClient) -> None:
        # Register and verify a user, then promote to admin
        email, password = await register_and_verify_user(client)
        await promote_user_to_admin(client, email)
        # Refresh token after promotion to admin
        admin_token = await login_user(client, email, password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Debug: Fetch and print promoted user's roles and permissions
        response = await client.get(f"{settings.API_V1_STR}/users?email={email}", headers=auth_headers)
        assert response.status_code == 200
        user_info = response.json()["data"]["items"][0]
        print("Promoted user roles:", [r["name"] for r in user_info.get("roles", [])])
        print("Promoted user permissions:", user_info.get("permissions", []))

        # Step 1: Create user via API
        user_data = {
            "email": random_email(),
            "first_name": "John",
            "last_name": "Doe",
            "password": "SecurePassword123!",
            "contact_phone": "+1234567890",
            "is_active": True,
        }
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(f"{settings.API_V1_STR}/users", json=user_data, headers=headers)
        if response.status_code != 201:
            print(f"User creation failed: {response.status_code} {response.text}")
        assert response.status_code == 201
        result = response.json()
        created_user = result["data"]
        created_user_id = created_user["id"]
        assert created_user["email"] == user_data["email"]

        # Step 2: Get user by ID
        response = await client.get(f"{settings.API_V1_STR}/users/{created_user_id}", headers=auth_headers)
        assert response.status_code == 200
        user_detail = response.json()["data"]
        assert user_detail["email"] == user_data["email"]

        # Step 3: Update user
        update_data = {"first_name": "Jane", "last_name": "Smith", "contact_phone": "+9876543210"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.put(
            f"{settings.API_V1_STR}/users/{created_user_id}", json=update_data, headers=headers
        )
        assert response.status_code == 200
        updated_user = response.json()["data"]
        assert updated_user["first_name"] == update_data["first_name"]
        assert updated_user["last_name"] == update_data["last_name"]

        # Step 4: List users (should include our created user)
        # Fetch all pages to search for the user
        found = False
        page = 1
        while True:
            response = await client.get(
                f"{settings.API_V1_STR}/users/list?page={page}&size=20", headers=auth_headers
            )
            if response.status_code != 200:
                print(f"/users/list page {page} error: {response.status_code} {response.text}")
                break
            users_list = response.json()["data"]["items"]
            if any(user["id"] == created_user_id for user in users_list):
                found = True
                break
            if not users_list or len(users_list) < 20:
                break
            page += 1
        if not found:
            print(f"Created user {created_user_id} not found in any page of /users/list!")
        assert found

        # Step 5: Delete user
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.delete(f"{settings.API_V1_STR}/users/{created_user_id}", headers=headers)
        assert response.status_code == 200
        # Verify user is deleted
        response = await client.get(f"{settings.API_V1_STR}/users/{created_user_id}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_user_role_assignment_flow(self, client: AsyncClient) -> None:
        """Test user role assignment and permission checking (API-driven)."""
        # Register and verify admin user, promote to admin
        admin_email, admin_password = await register_and_verify_user(client)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Register and verify a regular user
        user_email, user_password = await register_and_verify_user(client)
        # Get regular user id
        response = await client.get(f"{settings.API_V1_STR}/users?email={user_email}", headers=auth_headers)
        regular_user_id = response.json()["data"]["items"][0]["id"]

        # Create a unique role via API
        unique_role_name = f"testing_{uuid.uuid4().hex[:8]}"
        role_data = {"name": unique_role_name, "description": "Testing role"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(f"{settings.API_V1_STR}/roles", json=role_data, headers=headers)
        assert response.status_code == 201
        role_id = response.json()["data"]["id"]

        # Step 1: Assign role to user
        role_assignment_data = {"user_id": regular_user_id, "role_ids": [role_id]}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.post(
            f"{settings.API_V1_STR}/users/{regular_user_id}/roles", json=role_assignment_data, headers=headers
        )
        assert response.status_code == 200

        # Step 2: Verify user has the role
        response = await client.get(f"{settings.API_V1_STR}/users/{regular_user_id}", headers=auth_headers)
        assert response.status_code == 200
        user_detail = response.json()["data"]
        user_roles = [r["name"] for r in user_detail.get("roles", [])]
        user_role_ids = [r["id"] for r in user_detail.get("roles", [])]
        print(f"User roles before removal: {user_roles}")
        print(f"User role IDs before removal: {user_role_ids}")
        assert unique_role_name in user_roles

        # Step 3: Remove role from user by replacing roles with an empty list
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        role_assignment_data = {"user_id": regular_user_id, "role_ids": []}
        response = await client.post(
            f"{settings.API_V1_STR}/users/{regular_user_id}/roles", json=role_assignment_data, headers=headers
        )
        assert response.status_code == 200

        # Verify role is removed
        response = await client.get(f"{settings.API_V1_STR}/users/{regular_user_id}", headers=auth_headers)
        assert response.status_code == 200
        user_detail = response.json()["data"]
        user_roles = [r["name"] for r in user_detail.get("roles", [])]
        assert unique_role_name not in user_roles

        # Cleanup: Remove the role itself
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.delete(f"{settings.API_V1_STR}/roles/{role_id}", headers=headers)
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_user_profile_management_flow(self, client: AsyncClient) -> None:
        """Test user profile management (self-service, API-driven)."""
        # Register and verify a user
        email, password = await register_and_verify_user(client)
        # Debug: fetch user status after registration/verification
        admin_email = str(settings.FIRST_SUPERUSER_EMAIL)
        admin_password = settings.FIRST_SUPERUSER_PASSWORD
        admin_token = await login_user(client, admin_email, admin_password)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = await client.get(f"{settings.API_V1_STR}/users?email={email}", headers=admin_headers)
        print("User status after registration:", response.json())
        user_token = await login_user(client, email, password)
        auth_headers = {"Authorization": f"Bearer {user_token}"}

        # Fetch user status to check if needs_to_change_password is True
        response = await client.get(f"{settings.API_V1_STR}/users?email={email}", headers=admin_headers)
        user_info = response.json()["data"]["items"][0]
        if user_info.get("needs_to_change_password"):
            csrf_token, headers = await get_csrf_token(client)
            headers.update(auth_headers)  # Add Authorization header
            new_password = generate_strong_password()
            change_data = {
                "current_password": password,
                "new_password": new_password,
            }
            response = await client.post(
                f"{settings.API_V1_STR}/auth/change_password", json=change_data, headers=headers
            )
            if response.status_code != 200:
                print("Password change error:", response.status_code, response.text)
            assert response.status_code == 200
            # Login again to get a fresh token after password change
            user_token = await login_user(client, email, new_password)
            auth_headers = {"Authorization": f"Bearer {user_token}"}
            password = new_password  # Update for later use if needed

        # Step 1: Get own profile
        print("User JWT access token:", user_token)
        if user_token is None:
            pytest.fail("User token is None, login failed.")
        assert isinstance(user_token, str)  # for mypy
        jwt.decode(
            user_token,
            app_settings.SECRET_KEY,
            algorithms=[app_settings.ALGORITHM],
            audience=app_settings.TOKEN_AUDIENCE,
        )
        response = await client.get(f"{settings.API_V1_STR}/users/me", headers=auth_headers)
        if response.status_code != 200:
            print("/users/me error:", response.status_code, response.text)
        assert response.status_code == 200
        profile = response.json()["data"]
        assert profile["email"] == email

        # Step 2: Update own profile
        update_data = {"first_name": "UpdatedName", "contact_phone": "+1111111111"}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.put(f"{settings.API_V1_STR}/users/me", json=update_data, headers=headers)
        assert response.status_code == 200
        updated_profile = response.json()["data"]
        assert updated_profile["first_name"] == update_data["first_name"]

    @pytest.mark.asyncio
    async def test_permission_based_access_control(self, client: AsyncClient) -> None:
        """Test permission-based access to user endpoints (API-driven)."""
        # Register and verify admin user, promote to admin
        admin_email, admin_password = await register_and_verify_user(client)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Register and verify a regular user
        user_email, user_password = await register_and_verify_user(client)
        user_token = await login_user(client, user_email, user_password)
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # Admin should be able to list users
        response = await client.get(f"{settings.API_V1_STR}/users/list", headers=admin_headers)
        assert response.status_code == 200

        # Regular user should not be able to list users
        response = await client.get(f"{settings.API_V1_STR}/users/list", headers=user_headers)
        assert response.status_code == 403  # Forbidden

        # Regular user should be able to get their own profile
        response = await client.get(f"{settings.API_V1_STR}/users/me", headers=user_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_user_pagination_and_filtering(self, client: AsyncClient) -> None:
        """Test user list pagination and filtering (API-driven)."""
        # Register and verify admin user, promote to admin
        admin_email, admin_password = await register_and_verify_user(client)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create multiple test users
        for i in range(15):
            # Add random suffix to email to guarantee uniqueness
            email = f"testuser{i}_{random.randint(10000,99999)}@example.com"
            await register_and_verify_user(client, email=email, first_name=f"User{i}")

        # Test pagination
        response = await client.get(f"{settings.API_V1_STR}/users/list?page=1&size=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data["items"]) <= 10
        assert data["total"] >= 15  # At least our test users plus admin
        assert data["page"] == 1

        # Test second page
        response = await client.get(f"{settings.API_V1_STR}/users/list?page=2&size=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["page"] == 2

    @pytest.mark.asyncio
    async def test_user_activation_deactivation_flow(self, client: AsyncClient) -> None:
        """Test user activation and deactivation (API-driven)."""
        # Register and verify admin user, promote to admin
        admin_email, admin_password = await register_and_verify_user(client)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Register and verify a regular user
        user_email, user_password = await register_and_verify_user(client)
        # Get regular user id
        response = await client.get(f"{settings.API_V1_STR}/users?email={user_email}", headers=auth_headers)
        user_id = response.json()["data"]["items"][0]["id"]

        # Step 1: Deactivate user
        update_data = {"is_active": False}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.put(
            f"{settings.API_V1_STR}/users/{user_id}", json=update_data, headers=headers
        )
        assert response.status_code == 200
        assert response.json()["data"]["is_active"] is False

        # Step 2: Verify deactivated user cannot login
        user_token = await login_user(client, user_email, user_password)
        assert user_token is None  # Should not get a token for deactivated user

        # Step 3: Reactivate user
        update_data = {"is_active": True}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.put(
            f"{settings.API_V1_STR}/users/{user_id}", json=update_data, headers=headers
        )
        assert response.status_code == 200
        assert response.json()["data"]["is_active"] is True

    @pytest.mark.asyncio
    async def test_bulk_user_operations(self, client: AsyncClient) -> None:
        """Test bulk user operations if supported (API-driven)."""
        # Register and verify admin user, promote to admin
        admin_email, admin_password = await register_and_verify_user(client)
        await promote_user_to_admin(client, admin_email)
        admin_token = await login_user(client, admin_email, admin_password)
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Register and verify test users
        user_ids = []
        for i in range(5):
            email = f"bulktest{i}_{random.randint(10000,99999)}@example.com"
            await register_and_verify_user(client, email=email)
            response = await client.get(f"{settings.API_V1_STR}/users?email={email}", headers=auth_headers)
            if response.status_code != 200:
                print(f"Failed to fetch user by email {email}: {response.status_code} {response.text}")
            user_id = response.json()["data"]["items"][0]["id"]
            user_ids.append(user_id)

        # Test bulk deactivation (if endpoint exists)
        bulk_update_data = {"user_ids": user_ids, "updates": {"is_active": False}}
        csrf_token, headers = await get_csrf_token(client)
        headers.update(auth_headers)
        response = await client.put(
            f"{settings.API_V1_STR}/users/bulk-update", json=bulk_update_data, headers=headers
        )
        if response.status_code not in (200, 404):
            print(f"Bulk update failed: {response.status_code} {response.text}")
        if response.status_code != 404:
            assert response.status_code == 200
            print("Bulk update response:", response.json())
            # Assert all users are now inactive
            for user_id in user_ids:
                user_resp = await client.get(f"{settings.API_V1_STR}/users/{user_id}", headers=auth_headers)
                assert user_resp.status_code == 200
                assert user_resp.json()["data"]["is_active"] is False
