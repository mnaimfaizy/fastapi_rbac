"""Unit tests for CSRF protection on state-changing auth endpoints (#164).

These replace ``test/test_csrf_implementation.py``, which was a manual script
driving a live server on ``localhost:8000``. Its helpers were named ``test_*``,
so pytest collected them by prefix and errored on their positional arguments
without ever exercising CSRF. These run in-process against the ASGI app, so CI
actually executes them.

``validate_csrf_token`` is not overridden by the ``app`` fixture, so CSRF
validation is live here exactly as it is in production.
"""

import pytest
from httpx import AsyncClient

from app.core.config import settings

CSRF_COOKIE_NAME = "fastapi-csrf-token"
CSRF_HEADER_NAME = "X-CSRF-Token"

# Every auth route declaring Depends(deps.validate_csrf_token) that resolves CSRF
# before authentication. Kept in sync with app/api/v1/endpoints/auth.py.
# /logout is deliberately absent: it authenticates first, so an unauthenticated
# request never reaches CSRF validation. See test_logout_authenticates_before_csrf.
CSRF_PROTECTED_ENDPOINTS = [
    "/login",
    "/register",
    "/verify-email",
    "/resend-verification-email",
    "/change_password",
    "/new_access_token",
    "/password-reset/request",
    "/password-reset/confirm",
    "/reset_password",
]


def auth_url(path: str) -> str:
    """Build a full URL for an auth endpoint."""
    return f"{settings.API_V1_STR}/auth{path}"


def is_csrf_rejection(status_code: int, body: str) -> bool:
    """Return True if a response is a CSRF validation failure specifically."""
    return status_code == 403 and "CSRF" in body


async def fetch_csrf_token(client: AsyncClient) -> str:
    """Fetch a CSRF token, leaving the signed cookie on the client."""
    response = await client.get(auth_url("/csrf-token"))
    assert response.status_code == 200
    token: str = response.json()["data"]["csrf_token"]
    return token


async def test_csrf_token_endpoint_issues_token_and_cookie(client: AsyncClient) -> None:
    """The token endpoint returns an unsigned token and sets the signed cookie."""
    response = await client.get(auth_url("/csrf-token"))

    assert response.status_code == 200
    token = response.json()["data"]["csrf_token"]
    assert token

    # The cookie carries the signed token and must never be readable by scripts.
    assert CSRF_COOKIE_NAME in response.cookies
    set_cookie_header = response.headers["set-cookie"]
    assert "httponly" in set_cookie_header.lower()
    # The signed cookie value is not the same as the token handed to the caller.
    assert response.cookies[CSRF_COOKIE_NAME] != token


@pytest.mark.parametrize("endpoint", CSRF_PROTECTED_ENDPOINTS)
async def test_endpoint_rejected_without_csrf_token(client: AsyncClient, endpoint: str) -> None:
    """A state-changing endpoint rejects a request carrying no CSRF token."""
    response = await client.post(auth_url(endpoint), json={})

    assert is_csrf_rejection(response.status_code, response.text), (
        f"{endpoint} did not reject a request without a CSRF token "
        f"(got {response.status_code}: {response.text[:200]})"
    )


async def test_endpoint_rejected_with_invalid_csrf_token(client: AsyncClient) -> None:
    """A forged cookie and header are rejected; the cookie must be a valid signature.

    Not parametrized across every endpoint: signature verification lives in the
    single shared dependency, so one route proves it. The per-endpoint cases
    below cover what does vary — whether each route is wired to that dependency.
    """
    client.cookies.set(CSRF_COOKIE_NAME, "invalid-csrf-token")

    response = await client.post(
        auth_url("/login"),
        json={},
        headers={CSRF_HEADER_NAME: "invalid-csrf-token"},
    )

    assert is_csrf_rejection(response.status_code, response.text)


@pytest.mark.parametrize("endpoint", CSRF_PROTECTED_ENDPOINTS)
async def test_endpoint_accepts_valid_csrf_token(client: AsyncClient, endpoint: str) -> None:
    """A matching cookie and header pass CSRF validation.

    The request may still fail on business grounds — bad credentials, an unknown
    token, a validation error — so this asserts only that the failure is not a
    CSRF rejection.
    """
    token = await fetch_csrf_token(client)

    response = await client.post(
        auth_url(endpoint),
        json={},
        headers={CSRF_HEADER_NAME: token},
    )

    detail = f"{response.status_code}: {response.text[:180]}"
    assert not is_csrf_rejection(
        response.status_code, response.text
    ), f"{endpoint} rejected a valid CSRF token ({detail})"


async def test_csrf_rejected_when_header_missing_but_cookie_present(client: AsyncClient) -> None:
    """The cookie alone is not sufficient; the header must accompany it.

    This is the property that makes the protection work: a cross-site form post
    carries cookies automatically but cannot set the header.
    """
    await fetch_csrf_token(client)

    response = await client.post(auth_url("/login"), json={})

    assert is_csrf_rejection(response.status_code, response.text)


async def test_csrf_rejected_when_header_does_not_match_cookie(client: AsyncClient) -> None:
    """A well-formed token from a different session does not validate."""
    first_token = await fetch_csrf_token(client)

    # Re-issuing rotates the cookie; the earlier token no longer matches it.
    second_token = await fetch_csrf_token(client)
    assert first_token != second_token

    response = await client.post(
        auth_url("/login"),
        json={},
        headers={CSRF_HEADER_NAME: first_token},
    )

    assert is_csrf_rejection(response.status_code, response.text)


async def test_logout_authenticates_before_csrf(client: AsyncClient) -> None:
    """/logout is CSRF-protected but authenticates first.

    It declares Depends(validate_csrf_token) like the others, yet an
    unauthenticated request is refused at 401 before CSRF is evaluated. This is
    documented rather than asserted as 403 so a future reordering is visible.
    """
    response = await client.post(auth_url("/logout"), json={})

    assert response.status_code == 401
    assert not is_csrf_rejection(response.status_code, response.text)


async def test_safe_method_does_not_require_csrf(client: AsyncClient) -> None:
    """GET is not CSRF-protected; only state-changing methods are."""
    response = await client.get(auth_url("/csrf-token"))

    assert response.status_code == 200
