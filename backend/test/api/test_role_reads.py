"""Role reads return each permission's group and how many users hold the role.

The group is loaded with the permissions, and the user count is one aggregate,
so neither grows a query per permission or per user.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import API_TEST_PASSWORD as PASSWORD
from test.utils import get_csrf_token, seeded_permission
from typing import Any, Dict, Iterable, List
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings

SEEDED_MANAGER_GROUPS = {
    "user.create": "User",
    "user.read": "User",
    "user.update": "User",
    "role.read": "Role",
    "permission.read": "Permission",
    "role_group.read": "Role Group",
    "permission_group.read": "Permission Group",
    "self.read_profile": "Self",
    "self.update_profile": "Self",
    "self.read_roles": "Self",
    "self.read_permissions": "Self",
    "content.create_article": "Content",
    "content.read_article": "Content",
    "content.update_article": "Content",
    "content.delete_article": "Content",
}


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


async def sign_in(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_names: Iterable[str],
) -> Dict[str, str]:
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


def _permission_group_selects(statements: List[str]) -> List[str]:
    return [
        statement
        for statement in statements
        if "permissiongroup" in statement.lower() and statement.lstrip().lower().startswith("select")
    ]


async def test_seeded_manager_role_returns_groups_and_a_user_count(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers = await sign_in(client, user_factory, role_factory, permission_factory, ("role.read",))

    listing = await client.get(url("/roles"), headers=headers)
    assert listing.status_code == 200, listing.text
    manager = next(item for item in listing.json()["data"]["items"] if item["name"] == "Manager")

    assert manager["user_count"] >= 1
    groups = {permission["name"]: permission["group"]["name"] for permission in manager["permissions"]}
    assert groups == SEEDED_MANAGER_GROUPS
    assert all(permission["group"]["id"] for permission in manager["permissions"])

    detail = await client.get(url(f"/roles/{manager['id']}"), headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()["data"]
    assert body["user_count"] == manager["user_count"]
    assert {permission["name"]: permission["group"]["name"] for permission in body["permissions"]} == groups
    assert any(user["email"] == "manager@example.com" for user in body["users"])


async def test_role_list_user_count_matches_holders(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers = await sign_in(client, user_factory, role_factory, permission_factory, ("role.read",))
    role = await role_factory.create(name=f"counted-{uuid4().hex[:8]}")
    first = await user_factory.create(email=f"held-a-{uuid4().hex[:8]}@example.com", roles=[role])
    second = await user_factory.create(email=f"held-b-{uuid4().hex[:8]}@example.com", roles=[role])

    listing = await client.get(url("/roles"), headers=headers)
    assert listing.status_code == 200, listing.text
    listed = next(item for item in listing.json()["data"]["items"] if item["id"] == str(role.id))
    assert listed["user_count"] == 2

    detail = await client.get(url(f"/roles/{role.id}"), headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()["data"]
    assert body["user_count"] == 2
    assert {user["email"] for user in body["users"]} == {first.email, second.email}


async def test_permission_groups_are_not_loaded_once_per_permission(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_group_factory: Any,
    db_engine: AsyncEngine,
) -> None:
    headers = await sign_in(client, user_factory, role_factory, permission_factory, ("role.read",))

    async def role_with_permissions(count: int) -> Any:
        permissions = []
        for index in range(count):
            group = await permission_group_factory.create(name=f"grp-{count}-{index}-{uuid4().hex[:6]}")
            permissions.append(
                await permission_factory.create(
                    name=f"sample.read_{count}_{index}_{uuid4().hex[:6]}", group_id=group.id
                )
            )
        return await role_factory.create(name=f"wide-{count}-{uuid4().hex[:6]}", permissions=permissions)

    small = await role_with_permissions(1)
    large = await role_with_permissions(8)

    async def group_selects_for(role_id: Any) -> int:
        statements: List[str] = []

        def receive(*args: Any) -> None:
            statements.append(args[2])

        event.listen(db_engine.sync_engine, "before_cursor_execute", receive)
        try:
            response = await client.get(url(f"/roles/{role_id}"), headers=headers)
        finally:
            event.remove(db_engine.sync_engine, "before_cursor_execute", receive)
        assert response.status_code == 200, response.text
        permissions = response.json()["data"]["permissions"]
        assert len(permissions) == (1 if role_id == small.id else 8)
        assert all(permission["group"]["name"] for permission in permissions)
        return len(_permission_group_selects(statements))

    small_selects = await group_selects_for(small.id)
    large_selects = await group_selects_for(large.id)
    assert large_selects <= small_selects + 1


async def test_unpaginated_role_list_includes_group_and_user_count(
    client: AsyncClient, user_factory: Any, role_factory: Any, permission_factory: Any
) -> None:
    headers = await sign_in(client, user_factory, role_factory, permission_factory, ("role.read",))
    response = await client.get(url("/roles/list"), headers=headers)
    assert response.status_code == 200, response.text
    manager = next(item for item in response.json()["data"] if item["name"] == "Manager")
    assert manager["user_count"] >= 1
    assert {permission["name"]: permission["group"]["name"] for permission in manager["permissions"]} == (
        SEEDED_MANAGER_GROUPS
    )
