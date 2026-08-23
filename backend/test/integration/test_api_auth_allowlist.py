"""Integration tests for Redis JWT allowlist enforcement (#73) and HttpOnly refresh cookies (#66).

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

    _, csrf_headers = await get_csrf_token(client)
    logout_response = await client.post(
        f"{settings.API_V1_STR}/auth/logout",
        headers={**headers, **csrf_headers},
    )
    assert logout_response.status_code == 200, logout_response.text

    assert await redis_mock.smembers(access_key) == set()
    assert await redis_mock.smembers(f"user:{user_id}:{TokenType.REFRESH}") == set()

    me_after = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert me_after.status_code == 403


@pytest.mark.asyncio
async def test_login_sets_httponly_refresh_cookie(
    client: AsyncClient,
) -> None:
    """JSON login must set an HttpOnly refresh cookie and omit the token from JSON."""
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
    assert data["access_token"]
    assert data.get("refresh_token") in (None, "")

    cookie = login_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    assert cookie, "Expected refresh_token Set-Cookie on login"
    set_cookie_raw = login_response.headers.get("set-cookie", "")
    if hasattr(login_response.headers, "get_list"):
        set_cookie_raw = "; ".join(login_response.headers.get_list("set-cookie"))
    joined = set_cookie_raw.lower()
    assert "httponly" in joined
    assert settings.REFRESH_TOKEN_COOKIE_NAME.lower() in joined


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
    refresh_token = login_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    assert refresh_token

    _, logout_csrf = await get_csrf_token(client)
    logout_response = await client.post(
        f"{settings.API_V1_STR}/auth/logout",
        headers={"Authorization": f"Bearer {access_token}", **logout_csrf},
    )
    assert logout_response.status_code == 200, logout_response.text
    assert settings.REFRESH_TOKEN_COOKIE_NAME not in logout_response.cookies or (
        logout_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME) in ("", None)
    )

    _, refresh_csrf = await get_csrf_token(client)
    # Body fallback: cookie cleared; stolen token value from before logout must fail allowlist
    refresh_response = await client.post(
        f"{settings.API_V1_STR}/auth/new_access_token",
        json={"refresh_token": refresh_token},
        headers=refresh_csrf,
    )
    assert refresh_response.status_code == 403


@pytest.mark.asyncio
async def test_cookie_refresh_issues_new_access_token(
    client: AsyncClient,
) -> None:
    """Refresh via HttpOnly cookie + CSRF must return a new access token."""
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
    access_token = login_response.json()["data"]["access_token"]
    assert login_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

    _, refresh_csrf = await get_csrf_token(client)
    refresh_response = await client.post(
        f"{settings.API_V1_STR}/auth/new_access_token",
        json={},
        headers=refresh_csrf,
    )
    assert refresh_response.status_code == 201, refresh_response.text
    new_access = refresh_response.json()["data"]["access_token"]
    assert new_access
    assert new_access != access_token


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
    refresh_token = login_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    assert refresh_token
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
    refresh_token = login_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    assert refresh_token
    access_token = login_response.json()["data"]["access_token"]
    user_id = _user_id_from_access_token(access_token)

    await redis_mock.delete(f"user:{user_id}:{TokenType.REFRESH}")

    _, refresh_csrf = await get_csrf_token(client)
    refresh_response = await client.post(
        f"{settings.API_V1_STR}/auth/new_access_token",
        json={"refresh_token": refresh_token},
        headers=refresh_csrf,
    )
    assert refresh_response.status_code == 403


@pytest.mark.asyncio
async def test_refresh_requires_csrf(
    client: AsyncClient,
) -> None:
    """Cookie-authenticated refresh must reject requests without CSRF."""
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
    assert login_response.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

    refresh_response = await client.post(
        f"{settings.API_V1_STR}/auth/new_access_token",
        json={},
    )
    assert refresh_response.status_code == 403
