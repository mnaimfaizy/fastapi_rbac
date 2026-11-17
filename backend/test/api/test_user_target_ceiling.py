"""A caller can change or remove only users within their own permissions.

The role-grant ceiling (``role_grants``) limits the authority a caller hands
out. This is the other half: the user being changed. A caller who isn't a
superuser may not change or remove a user who is a superuser, or who holds a
permission the caller lacks, through any route gated on ``user.update`` or
``user.delete``. Users at or below the caller, peers included, stay editable,
and so does the caller's own record. Superusers are not limited.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.api.test_role_grant_ceiling import make_role, sign_in, url
from test.utils import API_TEST_PASSWORD as PASSWORD
from test.utils import random_strong_password
from typing import Any, Dict, List
from uuid import uuid4

import pytest
from httpx import AsyncClient, Response

from app.models.role_model import Role
from app.models.user_model import User

# The seeded Manager role's user and role permissions, plus user.delete.
CALLER_PERMISSIONS = ("user.read", "user.create", "user.update", "user.delete", "role.read")
# A role above the caller: one permission the caller does not hold.
HIGHER_PERMISSIONS = ("user.read", "role.create")
# A role within the caller's permissions.
LOWER_PERMISSIONS = ("user.read",)

SUPERUSER_TARGET_DETAIL = "Only a superuser can change or remove a superuser."
HIGHER_TARGET_DETAIL = "You cannot change or remove a user who has permissions you do not hold."


def a_new_email() -> str:
    return f"moved-{uuid4().hex[:8]}@example.com"


async def make_target(user_factory: Any, roles: List[Role] | None = None, superuser: bool = False) -> User:
    return await user_factory.create(
        email=f"target-{uuid4().hex[:8]}@example.com",
        password=PASSWORD,
        is_superuser=superuser,
        roles=roles or [],
    )


async def snapshot(user_factory: Any, user: User) -> Dict[str, Any]:
    """The fields these routes can change, read back from the database."""
    fields = ["email", "first_name", "is_active", "is_superuser", "password", "needs_to_change_password"]
    await user_factory.session.refresh(user, attribute_names=fields + ["roles"])
    return {**{field: getattr(user, field) for field in fields}, "roles": {role.id for role in user.roles}}


async def still_exists(user_factory: Any, user: User) -> bool:
    user_id = user.id
    user_factory.session.expire_all()
    return await user_factory.session.get(User, user_id) is not None


def single_update(field: str) -> Dict[str, Any]:
    if field == "password":
        return {"password": random_strong_password()}
    if field == "email":
        return {"email": a_new_email()}
    if field == "is_active":
        return {"is_active": False}
    if field == "first_name":
        return {"first_name": "Renamed"}
    raise AssertionError(field)


async def change(
    client: AsyncClient, headers: Dict[str, str], route: str, target: User, field: str
) -> Response:
    """Change one ``field`` of ``target`` through ``route``."""
    if route == "update":
        return await client.put(url(f"/users/{target.id}"), json=single_update(field), headers=headers)
    if route == "bulk":
        return await client.put(
            url("/users/bulk-update"),
            json={"user_ids": [str(target.id)], "updates": single_update(field)},
            headers=headers,
        )
    raise AssertionError(route)


def refused(response: Response, detail: str) -> None:
    assert response.status_code == 403, response.text
    assert response.json()["detail"] == detail


UPDATE_FIELDS = ["password", "email", "is_active", "first_name"]
# Bulk update refuses a password on its own (#198).
BULK_FIELDS = ["email", "is_active", "first_name"]
CHANGES = [("update", field) for field in UPDATE_FIELDS] + [("bulk", field) for field in BULK_FIELDS]


@pytest.mark.parametrize(("route", "field"), CHANGES)
async def test_a_superuser_target_cannot_be_changed(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    route: str,
    field: str,
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, superuser=True)
    before = await snapshot(user_factory, target)

    response = await change(client, headers, route, target, field)

    refused(response, SUPERUSER_TARGET_DETAIL)
    assert await snapshot(user_factory, target) == before


@pytest.mark.parametrize(("route", "field"), CHANGES)
async def test_a_target_above_the_caller_cannot_be_changed(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    route: str,
    field: str,
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, [higher])
    before = await snapshot(user_factory, target)

    response = await change(client, headers, route, target, field)

    refused(response, HIGHER_TARGET_DETAIL)
    assert await snapshot(user_factory, target) == before


async def test_a_target_who_also_holds_the_callers_role_is_judged_on_all_their_roles(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, [caller_role, higher])

    response = await change(client, headers, "update", target, "first_name")

    refused(response, HIGHER_TARGET_DETAIL)


async def test_bulk_update_changes_nobody_when_one_target_is_refused(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    lower = await make_role(role_factory, permission_factory, LOWER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    editable = await make_target(user_factory, [lower])
    protected = await make_target(user_factory, superuser=True)
    before = [await snapshot(user_factory, editable), await snapshot(user_factory, protected)]

    response = await client.put(
        url("/users/bulk-update"),
        json={"user_ids": [str(editable.id), str(protected.id)], "updates": {"is_active": False}},
        headers=headers,
    )

    refused(response, SUPERUSER_TARGET_DETAIL)
    assert [await snapshot(user_factory, editable), await snapshot(user_factory, protected)] == before


@pytest.mark.parametrize("superuser", [True, False], ids=["superuser", "higher-role"])
async def test_roles_cannot_be_assigned_to_a_target_above_the_caller(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    superuser: bool,
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    lower = await make_role(role_factory, permission_factory, LOWER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, [] if superuser else [higher], superuser=superuser)
    before = await snapshot(user_factory, target)
    # Only the role within the caller changes, so the role-grant ceiling alone allows it.
    new_roles = [lower] if superuser else [higher, lower]

    response = await client.post(
        url(f"/users/{target.id}/roles"),
        json={"user_id": str(target.id), "role_ids": [str(role.id) for role in new_roles]},
        headers=headers,
    )

    refused(response, SUPERUSER_TARGET_DETAIL if superuser else HIGHER_TARGET_DETAIL)
    assert await snapshot(user_factory, target) == before


@pytest.mark.parametrize("superuser", [True, False], ids=["superuser", "higher-role"])
async def test_a_target_above_the_caller_cannot_be_deleted(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    superuser: bool,
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    higher = await make_role(role_factory, permission_factory, HIGHER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, [] if superuser else [higher], superuser=superuser)

    response = await client.delete(url(f"/users/{target.id}"), headers=headers)

    refused(response, SUPERUSER_TARGET_DETAIL if superuser else HIGHER_TARGET_DETAIL)
    assert await still_exists(user_factory, target)


# Allowed: targets at or below the caller, the caller themselves, and any superuser caller.


@pytest.mark.parametrize("level", ["lower", "peer", "no-roles"])
@pytest.mark.parametrize(("route", "field"), CHANGES)
async def test_a_target_at_or_below_the_caller_can_be_changed(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    route: str,
    field: str,
    level: str,
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    roles = {
        "lower": [await make_role(role_factory, permission_factory, LOWER_PERMISSIONS)],
        # A deliberate choice: a peer holding exactly the caller's permissions stays editable.
        "peer": [await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)],
        "no-roles": [],
    }[level]
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, roles)

    response = await change(client, headers, route, target, field)

    assert response.status_code == 200, response.text


async def test_roles_can_be_assigned_to_a_target_below_the_caller(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    lower = await make_role(role_factory, permission_factory, LOWER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    target = await make_target(user_factory, [lower])

    response = await client.post(
        url(f"/users/{target.id}/roles"),
        json={"user_id": str(target.id), "role_ids": []},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert (await snapshot(user_factory, target))["roles"] == set()


async def test_a_target_below_the_caller_can_be_deleted(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    _, headers = await sign_in(client, user_factory, [caller_role])
    # No roles: deleting a user who still has roles is refused with 409 anyway.
    target = await make_target(user_factory)

    response = await client.delete(url(f"/users/{target.id}"), headers=headers)

    assert response.status_code == 200, response.text
    assert not await still_exists(user_factory, target)


@pytest.mark.parametrize("route", ["update", "bulk"])
async def test_the_caller_can_still_edit_their_own_plain_fields(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any, route: str
) -> None:
    caller_role = await make_role(role_factory, permission_factory, CALLER_PERMISSIONS)
    caller, headers = await sign_in(client, user_factory, [caller_role])

    response = await change(client, headers, route, caller, "first_name")

    assert response.status_code == 200, response.text
    assert (await snapshot(user_factory, caller))["first_name"] == "Renamed"


@pytest.mark.parametrize(("route", "field"), CHANGES)
async def test_a_superuser_caller_can_change_a_superuser(
    client: AsyncClient, user_factory: Any, route: str, field: str
) -> None:
    _, headers = await sign_in(client, user_factory, [], superuser=True)
    target = await make_target(user_factory, superuser=True)

    response = await change(client, headers, route, target, field)

    assert response.status_code == 200, response.text


async def test_a_superuser_caller_can_delete_a_superuser(client: AsyncClient, user_factory: Any) -> None:
    _, headers = await sign_in(client, user_factory, [], superuser=True)
    target = await make_target(user_factory, superuser=True)

    response = await client.delete(url(f"/users/{target.id}"), headers=headers)

    assert response.status_code == 200, response.text
    assert not await still_exists(user_factory, target)
