"""Permission detail lists every role that grants the permission (#424).

The list and the old read model returned the permission and its group, and
nothing about which roles grant it. Detail now returns that list, with each
role's group name and how many users hold the role.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import API_TEST_PASSWORD, get_csrf_token, seeded_permission
from typing import Any, Dict, Iterable
from uuid import uuid4

from httpx import AsyncClient

from app.core.config import settings

PASSWORD = API_TEST_PASSWORD


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


async def session_holding(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_names: Iterable[str],
) -> Dict[str, str]:
    """Bearer and CSRF headers for a non-superuser whose one role holds ``permission_names``."""
    permissions = [await seeded_permission(permission_factory, name) for name in permission_names]
    role = await role_factory.create(name=f"reader-{uuid4().hex[:8]}", permissions=permissions)
    email = f"reader-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, is_superuser=False, roles=[role])

    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}


async def test_permission_detail_lists_every_role_that_grants_it(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    role_group_factory: Any,
    permission_factory: Any,
) -> None:
    suffix = uuid4().hex[:8]
    permission = await permission_factory.create(
        name=f"catalog.read.{suffix}", description="Read the catalog"
    )
    administrative = await role_group_factory.create(name=f"Administrative {suffix}")
    operational = await role_group_factory.create(name=f"Operational {suffix}")
    admin_role = await role_factory.create(
        name=f"Admin {suffix}",
        permissions=[permission],
        role_group_id=administrative.id,
    )
    manager_role = await role_factory.create(
        name=f"Manager {suffix}",
        permissions=[permission],
        role_group_id=operational.id,
    )
    outsider = await role_factory.create(name=f"Outsider {suffix}")
    await user_factory.create(
        email=f"admin-holder-{suffix}@example.com", password=PASSWORD, roles=[admin_role]
    )
    await user_factory.create(
        email=f"manager-holder-{suffix}@example.com", password=PASSWORD, roles=[manager_role]
    )
    await user_factory.create(
        email=f"manager-holder-2-{suffix}@example.com", password=PASSWORD, roles=[manager_role]
    )
    await user_factory.create(email=f"outsider-{suffix}@example.com", password=PASSWORD, roles=[outsider])
    untouched = await permission_factory.create(name=f"catalog.none.{suffix}")

    headers = await session_holding(
        client, user_factory, role_factory, permission_factory, ["permission.read"]
    )

    detail = await client.get(url(f"/permissions/{permission.id}"), headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()["data"]
    assert body["name"] == permission.name
    assert body["group"]["name"]
    by_name = {role["name"]: role for role in body["roles"]}
    assert set(by_name) == {admin_role.name, manager_role.name}
    assert outsider.name not in by_name
    assert by_name[admin_role.name]["role_group"] == administrative.name
    assert by_name[admin_role.name]["user_count"] == 1
    assert by_name[manager_role.name]["role_group"] == operational.name
    assert by_name[manager_role.name]["user_count"] == 2

    empty = await client.get(url(f"/permissions/{untouched.id}"), headers=headers)
    assert empty.status_code == 200, empty.text
    assert empty.json()["data"]["roles"] == []

    listed = await client.get(url("/permissions?size=100"), headers=headers)
    assert listed.status_code == 200, listed.text
    match = next(item for item in listed.json()["data"]["items"] if item["id"] == str(permission.id))
    assert "roles" not in match


async def test_permission_detail_without_permission_read_is_refused(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    permission = await permission_factory.create(name=f"catalog.hidden.{uuid4().hex[:8]}")
    headers = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])

    detail = await client.get(url(f"/permissions/{permission.id}"), headers=headers)

    assert detail.status_code == 403, detail.text
    assert detail.json()["detail"] == "Insufficient permissions. Missing: permission.read"
