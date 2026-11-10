"""A temporary password restricts the account until it is replaced (#273).

``User.needs_to_change_password`` was written by admin create and admin set
and shown as a badge, but nothing read it: the user kept full access with a
password an administrator chose. ADR 0011 section 4 objects to a field whose
name asserts a control that does not exist; ADR 0014 records the enforcement.

A flagged user still logs in. Every route behind ``get_current_user`` then
answers 403 ``password_change_required``, except the four that opt in:
change password, logout, logout all, and reading one's own profile.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import get_csrf_token
from typing import Any, Dict
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.config import settings

PASSWORD = "TemporaryPass!47"
NEW_PASSWORD = "ReplacementPassword!42"

PASSWORD_CHANGE_REQUIRED = {
    "detail": {"code": "password_change_required", "message": "Password change required."}
}


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


async def login(client: AsyncClient, email: str, password: str = PASSWORD) -> Dict[str, Any]:
    _, headers = await get_csrf_token(client)
    response = await client.post(
        url("/auth/login"), json={"email": email, "password": password}, headers=headers
    )
    assert response.status_code == 200, response.text
    data: Dict[str, Any] = response.json()["data"]
    return data


async def bearer(client: AsyncClient, access_token: str) -> Dict[str, str]:
    """CSRF and bearer headers, enough for any route."""
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {access_token}"}


async def flagged_session(client: AsyncClient, user_factory: Any, **user: Any) -> Dict[str, str]:
    email = f"temp-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, needs_to_change_password=True, **user)
    data = await login(client, email)
    return await bearer(client, data["access_token"])


async def admin_session(client: AsyncClient, user_factory: Any) -> Dict[str, str]:
    email = f"admin-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, is_superuser=True)
    data = await login(client, email)
    return await bearer(client, data["access_token"])


async def test_flagged_user_is_refused_a_protected_route(client: AsyncClient, user_factory: Any) -> None:
    headers = await flagged_session(client, user_factory)

    response = await client.get(url("/dashboard"), headers=headers)

    assert response.status_code == 403, response.text
    assert response.json() == PASSWORD_CHANGE_REQUIRED


async def test_flagged_user_can_read_own_profile(client: AsyncClient, user_factory: Any) -> None:
    headers = await flagged_session(client, user_factory)

    response = await client.get(url("/users/me"), headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["data"]["needs_to_change_password"] is True


@pytest.mark.parametrize("path", ["/auth/logout", "/auth/logout/all"])
async def test_flagged_user_can_log_out(client: AsyncClient, user_factory: Any, path: str) -> None:
    headers = await flagged_session(client, user_factory)

    response = await client.post(url(path), headers=headers)

    assert response.status_code == 200, response.text


async def test_flagged_user_can_change_password(client: AsyncClient, user_factory: Any) -> None:
    headers = await flagged_session(client, user_factory)

    response = await client.post(
        url("/auth/change_password"),
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["user"]["needs_to_change_password"] is False
    # The new token reaches a route the temporary password was refused.
    after = await client.get(url("/dashboard"), headers=await bearer(client, data["access_token"]))
    assert after.status_code == 200, after.text


async def test_flagged_superuser_is_also_refused(client: AsyncClient, user_factory: Any) -> None:
    headers = await flagged_session(client, user_factory, is_superuser=True)

    response = await client.get(url("/users"), headers=headers)

    assert response.status_code == 403, response.text
    assert response.json() == PASSWORD_CHANGE_REQUIRED


async def test_flagged_user_cannot_update_own_profile(client: AsyncClient, user_factory: Any) -> None:
    """The one self-service route that writes the flag stays restricted."""
    headers = await flagged_session(client, user_factory, is_superuser=True)

    response = await client.put(url("/users/me"), json={"needs_to_change_password": False}, headers=headers)

    assert response.status_code == 403, response.text
    assert response.json() == PASSWORD_CHANGE_REQUIRED


async def test_profile_update_never_writes_the_flag(client: AsyncClient, user_factory: Any) -> None:
    """Only an administrator sets the flag, and only a password change clears it."""
    headers = await admin_session(client, user_factory)

    response = await client.put(
        url("/users/me"),
        json={"first_name": "Renamed", "needs_to_change_password": True},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["first_name"] == "Renamed"
    assert data["needs_to_change_password"] is False


@pytest.mark.parametrize("auto_verified", [True, False])
async def test_admin_create_always_sets_a_temporary_password(
    client: AsyncClient, user_factory: Any, monkeypatch: pytest.MonkeyPatch, auto_verified: bool
) -> None:
    """Verification and password ownership are separate: the setting decides only the first."""
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_AUTO_VERIFIED", auto_verified)
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_SEND_EMAIL", False)
    headers = await admin_session(client, user_factory)

    response = await client.post(
        url("/users"),
        json={
            "email": f"made-{uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "first_name": "Admin",
            "last_name": "Made",
            "role_id": [],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["data"]["needs_to_change_password"] is True


async def test_admin_set_password_restricts_the_next_login(client: AsyncClient, user_factory: Any) -> None:
    email = f"target-{uuid4().hex[:8]}@example.com"
    target = await user_factory.create(email=email, password=PASSWORD)
    headers = await admin_session(client, user_factory)

    response = await client.put(url(f"/users/{target.id}"), json={"password": NEW_PASSWORD}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["needs_to_change_password"] is True

    data = await login(client, email, NEW_PASSWORD)
    assert data["user"]["needs_to_change_password"] is True
    refused = await client.get(url("/dashboard"), headers=await bearer(client, data["access_token"]))
    assert refused.status_code == 403, refused.text
    assert refused.json() == PASSWORD_CHANGE_REQUIRED


async def test_self_registered_user_is_not_restricted(client: AsyncClient) -> None:
    email = f"self-{uuid4().hex[:8]}@example.com"
    _, headers = await get_csrf_token(client)
    registered = await client.post(
        url("/auth/register"),
        json={"email": email, "password": PASSWORD, "first_name": "Self", "last_name": "Made"},
        headers=headers,
    )
    assert registered.status_code == 200, registered.text
    _, headers = await get_csrf_token(client)
    verified = await client.post(
        url("/auth/verify-email"),
        json={"token": registered.json()["data"]["verification_code"]},
        headers=headers,
    )
    assert verified.status_code == 200, verified.text

    data = await login(client, email)

    assert data["user"]["needs_to_change_password"] is False
    response = await client.get(url("/dashboard"), headers=await bearer(client, data["access_token"]))
    assert response.status_code == 200, response.text
