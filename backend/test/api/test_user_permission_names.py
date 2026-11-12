"""A non-superuser holding the seeded user permissions can manage users (#325).

The user endpoints required ``users.*`` while ``init_db`` seeds ``user.*``,
so the Admin and Manager roles could not list, create, edit or delete users.
Every other test of these routes signs in as a superuser, who skips
permission checks, which is how the mismatch went unnoticed. These tests sign
in as a user whose role holds exactly the seeded names, and nothing else.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import get_csrf_token
from typing import Any, Dict, Iterable
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlmodel import select

from app.core.config import settings
from app.models.permission_model import Permission

PASSWORD = "PermissionNames!47"
SEEDED_USER_PERMISSIONS = ("user.read", "user.create", "user.update", "user.delete")


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


async def seeded_permission(permission_factory: Any, name: str) -> Permission:
    """The permission ``name``, created once: names are unique, and this suite's database outlives a test."""
    existing = (
        await permission_factory.session.exec(select(Permission).where(Permission.name == name))
    ).first()
    return existing if existing is not None else await permission_factory.create(name=name)


async def session_holding(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_names: Iterable[str],
) -> Dict[str, str]:
    """Bearer and CSRF headers for a non-superuser whose one role holds ``permission_names``."""
    permissions = [await seeded_permission(permission_factory, name) for name in permission_names]
    role = await role_factory.create(name=f"role-{uuid4().hex[:8]}", permissions=permissions)
    email = f"manager-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, is_superuser=False, roles=[role])

    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}


async def test_seeded_user_permissions_manage_users(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_SEND_EMAIL", False)
    headers = await session_holding(
        client, user_factory, role_factory, permission_factory, SEEDED_USER_PERMISSIONS
    )
    target = await user_factory.create(email=f"target-{uuid4().hex[:8]}@example.com", password=PASSWORD)

    listed = await client.get(url("/users/list"), headers=headers)
    assert listed.status_code == 200, listed.text

    ordered = await client.get(url("/users/order_by_created_at"), headers=headers)
    assert ordered.status_code == 200, ordered.text

    read = await client.get(url(f"/users/{target.id}"), headers=headers)
    assert read.status_code == 200, read.text

    created = await client.post(
        url("/users"),
        json={
            "email": f"made-{uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "first_name": "Made",
            "last_name": "ByManager",
            "role_id": [],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    updated = await client.put(url(f"/users/{target.id}"), json={"first_name": "Renamed"}, headers=headers)
    assert updated.status_code == 200, updated.text

    deleted = await client.delete(url(f"/users/{target.id}"), headers=headers)
    assert deleted.status_code == 200, deleted.text


@pytest.mark.parametrize(
    ("method", "path", "missing"),
    [
        ("get", "/users/list", "user.read"),
        ("post", "/users", "user.create"),
        ("delete", "/users/{id}", "user.delete"),
    ],
)
async def test_a_role_without_the_permission_is_refused(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    method: str,
    path: str,
    missing: str,
) -> None:
    held = [name for name in SEEDED_USER_PERMISSIONS if name != missing]
    headers = await session_holding(client, user_factory, role_factory, permission_factory, held)
    target = await user_factory.create(email=f"target-{uuid4().hex[:8]}@example.com", password=PASSWORD)

    kwargs: Dict[str, Any] = {"headers": headers}
    if method == "post":
        kwargs["json"] = {"email": f"x-{uuid4().hex[:8]}@example.com", "password": PASSWORD, "role_id": []}
    response = await getattr(client, method)(url(path.format(id=target.id)), **kwargs)

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == f"Insufficient permissions. Missing: {missing}"
