"""Every route that opens a session issues the same refresh lifetime (#274).

``/login`` built its refresh token from ``REFRESH_TOKEN_EXPIRE_MINUTES`` (100
days by default) while change-password used a second, 7-day setting. A
password change therefore silently shortened the session it handed back.
There is now one setting, and both the token's ``exp`` and the refresh
cookie's ``Max-Age`` come from it.

In ``test/api/`` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

import re
from test.utils import STRONG_TEST_PASSWORD, get_csrf_token, random_strong_password
from typing import Any, Dict, Tuple

from httpx import AsyncClient, Response

from app.core import security
from app.core.config import settings

PASSWORD = STRONG_TEST_PASSWORD
MAX_AGE = re.compile(r"max-age=(\d+)", re.IGNORECASE)


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


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
    client: AsyncClient, user_factory: Any
) -> None:
    await user_factory.create(email="lifetime@example.com", password=PASSWORD, verified=True)
    expected = settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60

    login_response, headers = await login(client, "lifetime@example.com")
    login_lifetime, login_max_age = issued_refresh_session(client, login_response)

    change_response = await client.post(
        auth_url("/change_password"),
        json={"current_password": PASSWORD, "new_password": random_strong_password()},
        headers=headers,
    )
    assert change_response.status_code == 200, change_response.text
    change_lifetime, change_max_age = issued_refresh_session(client, change_response)

    # exp and iat come from two clock reads, so whole seconds may differ by one.
    assert abs(login_lifetime - expected) <= 1, (login_lifetime, expected)
    assert abs(change_lifetime - login_lifetime) <= 1, (change_lifetime, login_lifetime)
    assert login_max_age == expected
    assert change_max_age == login_max_age
