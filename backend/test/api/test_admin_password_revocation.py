"""An admin-set password revokes the target user's allowlisted sessions (#240).

``PUT /users/{user_id}`` was the one password-setting path that did not call
``revoke_all_user_tokens``. Self-service already does; an administrator
reset is the response to a compromised account, so it must lock the old
sessions out before the response is written.

In ``test/api/`` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from test.utils import get_csrf_token
from typing import Any, Dict, Tuple
from uuid import uuid4

from httpx import AsyncClient, Response

from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils.token import get_valid_tokens, token_is_allowlisted

PASSWORD = "TestPassw0rd!47"
NEW_PASSWORD = "ReplacementPassword!42"
REJECTED_PASSWORD = "password"


def users_url(path: str) -> str:
    return f"{settings.API_V1_STR}/users{path}"


async def login(client: AsyncClient, email: str, password: str) -> Tuple[str, Dict[str, str]]:
    """Return the issued access token and headers carrying it plus CSRF."""
    _, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": email, "password": password},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    token = str(response.json()["data"]["access_token"])
    return token, {**headers, "Authorization": f"Bearer {token}"}


async def put_user_password(
    client: AsyncClient, headers: Dict[str, str], user_id: Any, password: str
) -> Response:
    return await client.put(
        users_url(f"/{user_id}"),
        json={"password": password},
        headers=headers,
    )


async def test_admin_set_password_invalidates_the_target_token(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """The token the target held beforehand must not survive the change."""
    await user_factory.create(
        email="admin-revoke@example.com",
        password=PASSWORD,
        verified=True,
        is_superuser=True,
    )
    target = await user_factory.create(
        email="target-revoke@example.com",
        password=PASSWORD,
        verified=True,
    )
    target_id = target.id
    old_access, _ = await login(client, "target-revoke@example.com", PASSWORD)
    old_refresh = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    _, admin_headers = await login(client, "admin-revoke@example.com", PASSWORD)

    response = await put_user_password(client, admin_headers, target_id, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    access_members = await get_valid_tokens(redis_mock, target_id, TokenType.ACCESS)
    refresh_members = await get_valid_tokens(redis_mock, target_id, TokenType.REFRESH)
    assert token_is_allowlisted(access_members, old_access) is False
    assert token_is_allowlisted(refresh_members, str(old_refresh)) is False

    me = await client.get(
        users_url("/me"),
        headers={"Authorization": f"Bearer {old_access}"},
    )
    assert me.status_code in (401, 403), me.text


async def test_admin_session_survives_setting_another_users_password(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    admin = await user_factory.create(
        email="admin-stays@example.com",
        password=PASSWORD,
        verified=True,
        is_superuser=True,
    )
    target = await user_factory.create(
        email="target-other@example.com",
        password=PASSWORD,
        verified=True,
    )
    admin_id = admin.id
    admin_access, admin_headers = await login(client, "admin-stays@example.com", PASSWORD)

    response = await put_user_password(client, admin_headers, target.id, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    members = await get_valid_tokens(redis_mock, admin_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, admin_access) is True

    me = await client.get(users_url("/me"), headers=admin_headers)
    assert me.status_code == 200, me.text


async def test_rejected_complexity_revokes_nothing(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    target = await user_factory.create(
        email="target-complex@example.com",
        password=PASSWORD,
        verified=True,
    )
    await user_factory.create(
        email="admin-complex@example.com",
        password=PASSWORD,
        verified=True,
        is_superuser=True,
    )
    target_id = target.id
    old_access, _ = await login(client, "target-complex@example.com", PASSWORD)
    _, admin_headers = await login(client, "admin-complex@example.com", PASSWORD)

    response = await put_user_password(client, admin_headers, target_id, REJECTED_PASSWORD)
    assert response.status_code == 400, response.text

    members = await get_valid_tokens(redis_mock, target_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, old_access) is True


async def test_rejected_reuse_revokes_nothing(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    target = await user_factory.create(
        email="target-reuse@example.com",
        password=PASSWORD,
        verified=True,
    )
    await user_factory.create(
        email="admin-reuse@example.com",
        password=PASSWORD,
        verified=True,
        is_superuser=True,
    )
    target_id = target.id
    old_access, _ = await login(client, "target-reuse@example.com", PASSWORD)
    _, admin_headers = await login(client, "admin-reuse@example.com", PASSWORD)

    response = await put_user_password(client, admin_headers, target_id, PASSWORD)
    assert response.status_code == 400, response.text

    members = await get_valid_tokens(redis_mock, target_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, old_access) is True


async def test_unknown_user_revokes_nothing(client: AsyncClient, user_factory: Any, redis_mock: Any) -> None:
    target = await user_factory.create(
        email="target-unknown@example.com",
        password=PASSWORD,
        verified=True,
    )
    await user_factory.create(
        email="admin-unknown@example.com",
        password=PASSWORD,
        verified=True,
        is_superuser=True,
    )
    target_id = target.id
    old_access, _ = await login(client, "target-unknown@example.com", PASSWORD)
    _, admin_headers = await login(client, "admin-unknown@example.com", PASSWORD)

    response = await put_user_password(client, admin_headers, uuid4(), NEW_PASSWORD)
    assert response.status_code == 404, response.text

    members = await get_valid_tokens(redis_mock, target_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, old_access) is True


async def test_non_password_update_revokes_nothing(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    target = await user_factory.create(
        email="target-name@example.com",
        password=PASSWORD,
        verified=True,
        first_name="Before",
    )
    await user_factory.create(
        email="admin-name@example.com",
        password=PASSWORD,
        verified=True,
        is_superuser=True,
    )
    target_id = target.id
    old_access, _ = await login(client, "target-name@example.com", PASSWORD)
    _, admin_headers = await login(client, "admin-name@example.com", PASSWORD)

    response = await client.put(
        users_url(f"/{target_id}"),
        json={"first_name": "After"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text

    members = await get_valid_tokens(redis_mock, target_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, old_access) is True
