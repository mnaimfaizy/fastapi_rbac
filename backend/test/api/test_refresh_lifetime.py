"""Every route that opens a session issues the same refresh lifetime (#274).

``/login`` built its refresh token from ``REFRESH_TOKEN_EXPIRE_MINUTES`` (100
days by default) while change-password used a second, 7-day setting. A
password change therefore silently shortened the session it handed back.
There is now one setting. The token's ``exp``, the refresh cookie's
``Max-Age`` and the Redis allowlist entry that keeps the session alive all
come from it.

In ``test/api/`` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

import json
import re
from test.utils import STRONG_TEST_PASSWORD, get_csrf_token, random_strong_password
from typing import Any, Dict, Tuple
from uuid import UUID

from httpx import AsyncClient, Response

from app.core import security
from app.core.config import settings

PASSWORD = STRONG_TEST_PASSWORD
MAX_AGE = re.compile(r"max-age=(\d+)", re.IGNORECASE)


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def allowlisted_lifetime(redis_mock: Any, user_id: UUID, token: str) -> float:
    """Seconds the allowlist keeps ``token``, from its ``user:{id}:refresh_token:meta`` entry.

    Spelled exactly as ``app.utils.token`` writes it, so a re-key cannot pass.
    """
    raw = await redis_mock.hget(f"user:{user_id}:refresh_token:meta", token)
    assert raw is not None, "the refresh token is not allowlisted"
    meta = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
    return float(meta["exp"]) - float(meta["issued_at"])


def issued_refresh_session(client: AsyncClient, response: Response) -> Tuple[int, int]:
    """Return (token lifetime in seconds, cookie Max-Age) of the refresh cookie just set."""
    cookie_name = settings.REFRESH_TOKEN_COOKIE_NAME
    headers = [h for h in response.headers.get_list("set-cookie") if h.startswith(f"{cookie_name}=")]
    assert len(headers) == 1, headers
    match = MAX_AGE.search(headers[0])
    assert match, headers[0]

    token = client.cookies.get(cookie_name)
    assert token, "no refresh cookie was set"
    claims = security.decode_token(token, token_type="refresh")
    return int(claims["exp"]) - int(claims["iat"]), int(match.group(1))


async def login(client: AsyncClient, email: str) -> Tuple[Response, Dict[str, str]]:
    _, headers = await get_csrf_token(client)
    response = await client.post(
        auth_url("/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert response.status_code == 200, response.text
    token = str(response.json()["data"]["access_token"])
    return response, {**headers, "Authorization": f"Bearer {token}"}


async def test_login_and_change_password_issue_the_same_refresh_lifetime(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    user = await user_factory.create(email="lifetime@example.com", password=PASSWORD, verified=True)
    user_id = user.id  # read before the request; the endpoint's commit expires the instance
    expected = settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
    cookie_name = settings.REFRESH_TOKEN_COOKIE_NAME

    login_response, headers = await login(client, "lifetime@example.com")
    login_lifetime, login_max_age = issued_refresh_session(client, login_response)
    # Read now: change-password revokes this entry before it issues the new one.
    login_allowlisted = await allowlisted_lifetime(redis_mock, user_id, str(client.cookies.get(cookie_name)))

    change_response = await client.post(
        auth_url("/change_password"),
        json={"current_password": PASSWORD, "new_password": random_strong_password()},
        headers=headers,
    )
    assert change_response.status_code == 200, change_response.text
    change_lifetime, change_max_age = issued_refresh_session(client, change_response)
    change_allowlisted = await allowlisted_lifetime(redis_mock, user_id, str(client.cookies.get(cookie_name)))

    # exp and iat come from two clock reads, so whole seconds may differ by one.
    assert abs(login_lifetime - expected) <= 1, (login_lifetime, expected)
    assert abs(change_lifetime - login_lifetime) <= 1, (change_lifetime, login_lifetime)
    assert login_max_age == expected
    assert change_max_age == login_max_age
    # The session lives as long as its allowlist entry, so that must match too.
    assert abs(login_allowlisted - expected) <= 1, (login_allowlisted, expected)
    assert abs(change_allowlisted - expected) <= 1, (change_allowlisted, expected)
