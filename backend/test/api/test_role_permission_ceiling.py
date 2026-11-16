"""A caller can add or remove only permissions they hold, on roles they don't hold.

Every route that writes a role's permissions is gated on one permission
(``role.update``, or ``role.create`` for a new role). Holding it must not let a
caller put a permission they lack on a role, nor take one away, and a caller
who isn't a superuser cannot change the permissions of a role they hold. A
system role's permissions and name can't be changed through ``PUT`` either,
matching the per-permission routes. Superusers are not limited by the
ceiling. Only changes are checked: resending a role's current permissions is
allowed.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import API_TEST_PASSWORD as PASSWORD
from test.utils import get_csrf_token, seeded_permission
from typing import Any, Dict, Iterable, List, Tuple
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func
from sqlmodel import select

from app.core.config import settings
from app.models.permission_model import Permission
from app.models.role_model import Role
from app.models.user_model import User

# What the caller's main role holds: enough to edit and create roles.
CALLER_PERMISSIONS = ("role.read", "role.create", "role.update", "user.read")
# A permission the caller does not hold.
HIGHER_PERMISSION = "permission.delete"
# A permission the caller holds, through CALLER_PERMISSIONS.
HELD_PERMISSION = "user.read"


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


async def permission_names_of(role_factory: Any, role: Role) -> set[str]:
    await role_factory.session.refresh(role, attribute_names=["permissions"])
    return {permission.name for permission in role.permissions}


async def add_permission(
    client: AsyncClient, headers: Dict[str, str], route: str, role: Role, permission: Permission
) -> Any:
    """Add ``permission`` to ``role`` through ``route``."""
    if route == "assign":
        return await client.post(
            url(f"/roles/{role.id}/permissions"),
            json={"permission_ids": [str(permission.id)]},
            headers=headers,
        )
    if route == "update":
        ids = [str(p.id) for p in role.permissions] + [str(permission.id)]
        return await client.put(
            url(f"/roles/{role.id}"),
            json={"name": role.name, "description": role.description, "permission_ids": ids},
            headers=headers,
        )
    raise AssertionError(route)


async def remove_permission(
    client: AsyncClient, headers: Dict[str, str], route: str, role: Role, permission: Permission
) -> Any:
    """Remove ``permission`` from ``role`` through ``route``."""
    if route == "remove":
        return await client.request(
            "DELETE",
            url(f"/roles/{role.id}/permissions"),
            json={"permission_ids": [str(permission.id)]},
            headers=headers,
        )
    if route == "remove_one":
        return await client.delete(url(f"/roles/{role.id}/permissions/{permission.id}"), headers=headers)
    if route == "update":
        ids = [str(p.id) for p in role.permissions if p.id != permission.id]
        return await client.put(
            url(f"/roles/{role.id}"),
            json={"name": role.name, "description": role.description, "permission_ids": ids},
            headers=headers,
        )
    raise AssertionError(route)


ADD_ROUTES = ["assign", "update"]
REMOVE_ROUTES = ["remove", "remove_one", "update"]


async def caller_and_target(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    target_permissions: Iterable[str] = (),
    superuser: bool = False,
) -> Tuple[Dict[str, str], Role]:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    target = await make_role(role_factory, permission_factory, target_permissions)
    await permission_names_of(role_factory, target)
    _, headers = await sign_in(client, user_factory, [] if superuser else [caller_role], superuser)
    return headers, target


@pytest.mark.parametrize("route", ADD_ROUTES)
async def test_a_permission_above_the_caller_cannot_be_added(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    headers, target = await caller_and_target(client, user_factory, role_factory, permission_factory)
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)

    response = await add_permission(client, headers, route, target, higher)

    assert response.status_code == 403, response.text
    assert HIGHER_PERMISSION in response.json()["detail"]
    assert await permission_names_of(role_factory, target) == set()


@pytest.mark.parametrize("route", REMOVE_ROUTES)
async def test_a_permission_above_the_caller_cannot_be_removed(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    headers, target = await caller_and_target(
        client, user_factory, role_factory, permission_factory, [HIGHER_PERMISSION]
    )
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)

    response = await remove_permission(client, headers, route, target, higher)

    assert response.status_code == 403, response.text
    assert HIGHER_PERMISSION in response.json()["detail"]
    assert await permission_names_of(role_factory, target) == {HIGHER_PERMISSION}


async def test_a_role_cannot_be_created_with_a_permission_above_the_caller(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers, _ = await caller_and_target(client, user_factory, role_factory, permission_factory)
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)
    name = f"made-{uuid4().hex[:8]}"

    response = await client.post(
        url("/roles"), json={"name": name, "permission_ids": [str(higher.id)]}, headers=headers
    )

    assert response.status_code == 403, response.text
    assert HIGHER_PERMISSION in response.json()["detail"]
    made = (await role_factory.session.exec(select(Role).where(Role.name == name))).first()
    assert made is None


@pytest.mark.parametrize("route", ADD_ROUTES)
async def test_the_caller_cannot_add_to_a_role_they_hold(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    # A second role the caller holds, missing a permission the caller has elsewhere.
    own = await make_role(role_factory, permission_factory, ())
    await permission_names_of(role_factory, own)
    _, headers = await sign_in(client, user_factory, [caller_role, own])
    held = await seeded_permission(permission_factory, HELD_PERMISSION)

    response = await add_permission(client, headers, route, own, held)

    assert response.status_code == 403, response.text
    assert "role you hold" in response.json()["detail"]
    assert await permission_names_of(role_factory, own) == set()


@pytest.mark.parametrize("route", REMOVE_ROUTES)
async def test_the_caller_cannot_remove_from_a_role_they_hold(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    await permission_names_of(role_factory, caller_role)
    _, headers = await sign_in(client, user_factory, [caller_role])
    held = await seeded_permission(permission_factory, HELD_PERMISSION)

    response = await remove_permission(client, headers, route, caller_role, held)

    assert response.status_code == 403, response.text
    assert "role you hold" in response.json()["detail"]
    assert await permission_names_of(role_factory, caller_role) == set(CALLER_PERMISSIONS)


async def system_role(role_factory: Any) -> Role:
    role = (await role_factory.session.exec(select(Role).where(func.lower(Role.name) == "admin"))).first()
    if role is None:
        role = await role_factory.create(name="admin")
    await permission_names_of(role_factory, role)
    return role


async def test_put_cannot_change_a_system_roles_permissions(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    admin = await system_role(role_factory)
    before = await permission_names_of(role_factory, admin)
    _, headers = await sign_in(client, user_factory, [], superuser=True)
    extra = await seeded_permission(permission_factory, f"extra.{uuid4().hex[:8]}")

    response = await add_permission(client, headers, "update", admin, extra)

    assert response.status_code == 403, response.text
    assert await permission_names_of(role_factory, admin) == before


async def test_put_cannot_rename_a_system_role(
    client: AsyncClient, user_factory: Any, role_factory: Any
) -> None:
    admin = await system_role(role_factory)
    _, headers = await sign_in(client, user_factory, [], superuser=True)

    response = await client.put(url(f"/roles/{admin.id}"), json={"name": "renamed"}, headers=headers)

    assert response.status_code == 403, response.text


async def test_put_can_change_a_system_roles_description(
    client: AsyncClient, user_factory: Any, role_factory: Any
) -> None:
    admin = await system_role(role_factory)
    _, headers = await sign_in(client, user_factory, [], superuser=True)
    ids = [str(p.id) for p in admin.permissions]

    response = await client.put(
        url(f"/roles/{admin.id}"),
        json={"name": admin.name, "description": "new words", "permission_ids": ids},
        headers=headers,
    )

    assert response.status_code == 200, response.text


async def test_resending_current_permissions_is_allowed(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    # The role carries a permission above the caller; the SPA's role form
    # resends it unchanged alongside a description edit.
    headers, target = await caller_and_target(
        client, user_factory, role_factory, permission_factory, [HIGHER_PERMISSION]
    )

    response = await client.put(
        url(f"/roles/{target.id}"),
        json={
            "name": target.name,
            "description": "edited",
            "permission_ids": [str(p.id) for p in target.permissions],
        },
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert await permission_names_of(role_factory, target) == {HIGHER_PERMISSION}


async def test_reassigning_a_permission_already_on_the_role_is_allowed(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers, target = await caller_and_target(
        client, user_factory, role_factory, permission_factory, [HIGHER_PERMISSION]
    )
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)

    response = await add_permission(client, headers, "assign", target, higher)

    assert response.status_code == 200, response.text


@pytest.mark.parametrize("route", ADD_ROUTES)
async def test_a_permission_within_the_caller_can_be_added(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    headers, target = await caller_and_target(client, user_factory, role_factory, permission_factory)
    held = await seeded_permission(permission_factory, HELD_PERMISSION)

    response = await add_permission(client, headers, route, target, held)

    assert response.status_code == 200, response.text
    assert await permission_names_of(role_factory, target) == {HELD_PERMISSION}


@pytest.mark.parametrize("route", REMOVE_ROUTES)
async def test_a_permission_within_the_caller_can_be_removed(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    headers, target = await caller_and_target(
        client, user_factory, role_factory, permission_factory, [HELD_PERMISSION]
    )
    held = await seeded_permission(permission_factory, HELD_PERMISSION)

    response = await remove_permission(client, headers, route, target, held)

    assert response.status_code == 200, response.text
    assert await permission_names_of(role_factory, target) == set()


async def test_a_role_can_be_created_with_a_permission_within_the_caller(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers, _ = await caller_and_target(client, user_factory, role_factory, permission_factory)
    held = await seeded_permission(permission_factory, HELD_PERMISSION)

    response = await client.post(
        url("/roles"),
        json={"name": f"made-{uuid4().hex[:8]}", "permission_ids": [str(held.id)]},
        headers=headers,
    )

    assert response.status_code == 201, response.text


@pytest.mark.parametrize("route", ADD_ROUTES)
async def test_a_superuser_can_add_any_permission(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    headers, target = await caller_and_target(
        client, user_factory, role_factory, permission_factory, superuser=True
    )
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)

    response = await add_permission(client, headers, route, target, higher)

    assert response.status_code == 200, response.text
    assert await permission_names_of(role_factory, target) == {HIGHER_PERMISSION}


@pytest.mark.parametrize("route", REMOVE_ROUTES)
async def test_a_superuser_can_remove_any_permission(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    headers, target = await caller_and_target(
        client, user_factory, role_factory, permission_factory, [HIGHER_PERMISSION], superuser=True
    )
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)

    response = await remove_permission(client, headers, route, target, higher)

    assert response.status_code == 200, response.text
    assert await permission_names_of(role_factory, target) == set()


async def test_a_superuser_can_create_a_role_with_any_permission(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers, _ = await caller_and_target(
        client, user_factory, role_factory, permission_factory, superuser=True
    )
    higher = await seeded_permission(permission_factory, HIGHER_PERMISSION)

    response = await client.post(
        url("/roles"),
        json={"name": f"made-{uuid4().hex[:8]}", "permission_ids": [str(higher.id)]},
        headers=headers,
    )

    assert response.status_code == 201, response.text
