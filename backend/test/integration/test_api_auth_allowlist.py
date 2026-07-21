"""Integration tests for Redis JWT allowlist enforcement (#73).

Seam: auth HTTP API (OAuth2/JSON login, logout, protected route, refresh).
Uses the seeded superuser from init_db to avoid extra INSERT lock contention.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from test.utils import get_csrf_token

import jwt
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils.token import token_is_allowlisted


def _user_id_from_access_token(access_token: str) -> str:
    payload = jwt.decode(
        access_token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        audience=settings.TOKEN_AUDIENCE,
        issuer=settings.TOKEN_ISSUER,
    )
    return str(payload["sub"])


@pytest.mark.asyncio
async def test_oauth2_first_login_writes_allowlist_and_logout_rejects(
    client: AsyncClient,
    redis_mock: MockRedisClient,
) -> None:
    """First OAuth2 login must allowlist the access token; logout must revoke it."""
    login_response = await client.post(
        f"{settings.API_V1_STR}/auth/access-token",
        data={
            "username": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    assert login_response.status_code == 200, login_response.text
    access_token = login_response.json()["data"]["access_token"]
    user_id = _user_id_from_access_token(access_token)
    access_key = f"user:{user_id}:{TokenType.ACCESS}"

    members = await redis_mock.smembers(access_key)
    assert token_is_allowlisted(members, access_token) is True

    headers = {"Authorization": f"Bearer {access_token}"}
    me_before = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert me_before.status_code == 200, me_before.text

    logout_response = await client.post(f"{settings.API_V1_STR}/auth/logout", headers=headers)
    assert logout_response.status_code == 200, logout_response.text

    assert await redis_mock.smembers(access_key) == set()
    assert await redis_mock.smembers(f"user:{user_id}:{TokenType.REFRESH}") == set()

    me_after = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert me_after.status_code == 403


@pytest.mark.asyncio
async def test_logout_rejects_subsequent_refresh(
    client: AsyncClient,
    redis_mock: MockRedisClient,
) -> None:
    """After logout, a previously issued refresh token must be rejected."""
    _, csrf_headers = await get_csrf_token(client)
    login_response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
        headers=csrf_headers,
    )
    assert login_response.status_code == 200, login_response.text
    data = login_response.json()["data"]
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    logout_response = await client.post(
        f"{settings.API_V1_STR}/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_response.status_code == 200, logout_response.text

    refresh_response = await client.post(
        f"{settings.API_V1_STR}/auth/new_access_token",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == 403


@pytest.mark.asyncio
async def test_json_login_writes_access_and_refresh_allowlist(
    client: AsyncClient,
    redis_mock: MockRedisClient,
) -> None:
    """JSON login must always write both access and refresh tokens into Redis."""
    _, csrf_headers = await get_csrf_token(client)
    login_response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
        headers=csrf_headers,
    )
    assert login_response.status_code == 200, login_response.text
    data = login_response.json()["data"]
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]
    user_id = _user_id_from_access_token(access_token)

    access_members = await redis_mock.smembers(f"user:{user_id}:{TokenType.ACCESS}")
    refresh_members = await redis_mock.smembers(f"user:{user_id}:{TokenType.REFRESH}")
    assert token_is_allowlisted(access_members, access_token) is True
    assert token_is_allowlisted(refresh_members, refresh_token) is True


@pytest.mark.asyncio
async def test_refresh_rejected_when_allowlist_empty(
    client: AsyncClient,
    redis_mock: MockRedisClient,
) -> None:
    """A cryptographically valid refresh JWT must fail when Redis set is empty."""
    _, csrf_headers = await get_csrf_token(client)
    login_response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
        headers=csrf_headers,
    )
    assert login_response.status_code == 200, login_response.text
    refresh_token = login_response.json()["data"]["refresh_token"]
    access_token = login_response.json()["data"]["access_token"]
    user_id = _user_id_from_access_token(access_token)

    await redis_mock.delete(f"user:{user_id}:{TokenType.REFRESH}")

    refresh_response = await client.post(
        f"{settings.API_V1_STR}/auth/new_access_token",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == 403
