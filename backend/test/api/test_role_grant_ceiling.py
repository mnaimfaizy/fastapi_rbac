"""A caller can grant or remove only roles within their own permissions.

Every route that sets a user's roles is gated on one permission
(``user.update`` or ``user.create``). Holding it must not let a caller give a
role, to anyone including themselves, that carries a permission the caller
lacks, nor take such a role away. A caller who isn't a superuser also cannot
change their own roles. Superusers are not limited.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.api.test_user_permission_names import PASSWORD, seeded_permission
from test.utils import get_csrf_token
from typing import Any, Dict, Iterable, List, Tuple
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.models.role_model import Role
from app.models.user_model import User

# What the seeded Manager role holds that matters here.
CALLER_PERMISSIONS = ("user.read", "user.create", "user.update", "role.read")
# A role above the caller: one permission the caller does not hold.
HIGHER_PERMISSIONS = ("user.read", "role.create")
# A role within the caller's permissions.
LOWER_PERMISSIONS = ("user.read",)


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


async def make_role(role_factory: Any, permission_factory: Any, names: Iterable[str]) -> Role:
    permissions = [await seeded_permission(permission_factory, name) for name in names]
    return await role_factory.create(name=f"role-{uuid4().hex[:8]}", permissions=permissions)


async def sign_in(
    client: AsyncClient, user_factory: Any, roles: List[Role], superuser: bool = False
) -> Tuple[User, Dict[str, str]]:
    email = f"caller-{uuid4().hex[:8]}@example.com"
    user = await user_factory.create(email=email, password=PASSWORD, is_superuser=superuser, roles=roles)
    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    _, headers = await get_csrf_token(client)
    return user, {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}


async def role_ids_of(user_factory: Any, user: User) -> set[str]:
    await user_factory.session.refresh(user, attribute_names=["roles"])
    return {str(role.id) for role in user.roles}


async def set_roles(
    client: AsyncClient, headers: Dict[str, str], route: str, target: User, roles: List[Role]
) -> Any:
    """Set ``target``'s roles to ``roles`` through ``route``."""
    ids = [str(role.id) for role in roles]
    if route == "assign":
        return await client.post(
            url(f"/users/{target.id}/roles"),
            json={"user_id": str(target.id), "role_ids": ids},
            headers=headers,
        )
    if route == "update":
        return await client.put(url(f"/users/{target.id}"), json={"role_id": ids}, headers=headers)
    if route == "bulk":
        return await client.put(
            url("/users/bulk-update"),
            json={"user_ids": [str(target.id)], "updates": {"role_id": ids}},
            headers=headers,
        )
    raise AssertionError(route)


ROUTES = ["assign", "update", "bulk"]


@pytest.mark.parametrize("route", ROUTES)
async def test_a_role_above_the_caller_cannot_be_granted_to_another_user(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await user_factory.create(email=f"target-{uuid4().hex[:8]}@example.com", password=PASSWORD)

    response = await set_roles(client, headers, route, target, [higher])

    assert response.status_code == 403, response.text
    assert await role_ids_of(user_factory, target) == set()


@pytest.mark.parametrize("route", ROUTES)
async def test_the_caller_cannot_change_their_own_roles(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    caller, headers = await sign_in(client, user_factory, [caller_role])

    response = await set_roles(client, headers, route, caller, [caller_role, higher])

    assert response.status_code == 403, response.text
    assert await role_ids_of(user_factory, caller) == {str(caller_role.id)}


async def test_a_role_above_the_caller_cannot_be_removed(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await user_factory.create(
        email=f"target-{uuid4().hex[:8]}@example.com", password=PASSWORD, roles=[higher]
    )

    response = await set_roles(client, headers, "assign", target, [])

    assert response.status_code == 403, response.text
    assert await role_ids_of(user_factory, target) == {str(higher.id)}


async def test_a_new_user_cannot_be_created_with_a_role_above_the_caller(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_SEND_EMAIL", False)
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])

    response = await client.post(
        url("/users"),
        json={
            "email": f"made-{uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "first_name": "Made",
            "last_name": "ByCaller",
            "role_id": [str(higher.id)],
        },
        headers=headers,
    )

    assert response.status_code == 403, response.text


@pytest.mark.parametrize("route", ROUTES)
async def test_a_role_within_the_caller_can_be_granted_to_another_user(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    lower = await make_role(role_factory, permission_factory, LOWER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await user_factory.create(email=f"target-{uuid4().hex[:8]}@example.com", password=PASSWORD)

    response = await set_roles(client, headers, route, target, [lower])

    assert response.status_code == 200, response.text
    assert await role_ids_of(user_factory, target) == {str(lower.id)}


async def test_a_new_user_can_be_created_with_a_role_within_the_caller(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_SEND_EMAIL", False)
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    lower = await make_role(role_factory, permission_factory, LOWER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])

    response = await client.post(
        url("/users"),
        json={
            "email": f"made-{uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "first_name": "Made",
            "last_name": "ByCaller",
            "role_id": [str(lower.id)],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text


@pytest.mark.parametrize("route", ROUTES)
async def test_a_superuser_is_not_limited(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    caller, headers = await sign_in(client, user_factory, [], superuser=True)

    response = await set_roles(client, headers, route, caller, [higher])

    assert response.status_code == 200, response.text
    assert await role_ids_of(user_factory, caller) == {str(higher.id)}
