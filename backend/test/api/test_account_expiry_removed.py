"""User API responses no longer carry an account expiry_date (#412).

The column was seeded, serialized, and shown. Nothing in authentication or
authorization read it. Password expiry stays: ``last_changed_password_date``
is still on every user payload.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import API_TEST_PASSWORD, get_csrf_token
from typing import Any, Dict
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.config import settings

PASSWORD = API_TEST_PASSWORD


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


def assert_no_account_expiry(user: Dict[str, Any]) -> None:
    assert "expiry_date" not in user
    assert "last_changed_password_date" in user


async def bearer(client: AsyncClient, access_token: str) -> Dict[str, str]:
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {access_token}"}


async def test_user_responses_omit_account_expiry(
    client: AsyncClient, user_factory: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_SEND_EMAIL", False)
    email = f"admin-{uuid4().hex[:8]}@example.com"
    admin = await user_factory.create(email=email, password=PASSWORD, is_superuser=True)
    target = await user_factory.create(
        email=f"target-{uuid4().hex[:8]}@example.com", password=PASSWORD, is_superuser=False
    )

    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    login_data = login.json()["data"]
    assert_no_account_expiry(login_data["user"])
    headers = await bearer(client, login_data["access_token"])

    me = await client.get(url("/users/me"), headers=headers)
    assert me.status_code == 200, me.text
    assert_no_account_expiry(me.json()["data"])

    listed = await client.get(url("/users/list"), headers=headers)
    assert listed.status_code == 200, listed.text
    items = listed.json()["data"]["items"]
    assert items
    for item in items:
        assert_no_account_expiry(item)

    detail = await client.get(url(f"/users/{target.id}"), headers=headers)
    assert detail.status_code == 200, detail.text
    assert_no_account_expiry(detail.json()["data"])

    updated = await client.put(url(f"/users/{target.id}"), json={"first_name": "Renamed"}, headers=headers)
    assert updated.status_code == 200, updated.text
    updated_user = updated.json()["data"]
    assert_no_account_expiry(updated_user)
    assert updated_user["first_name"] == "Renamed"

    created = await client.post(
        url("/users"),
        json={
            "email": f"made-{uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "first_name": "Made",
            "last_name": "WithoutExpiry",
            "role_id": [],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    assert_no_account_expiry(created.json()["data"])

    # The signed-in account is the one whose login payload was checked.
    assert str(admin.id) == str(login_data["user"]["id"])
