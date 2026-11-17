"""Account tokens reach a response body only when EXPOSE_TOKENS_IN_RESPONSES is on.

Password-reset request used to return the reset token whenever ``MODE`` was
development, and registration returned the verification code whenever it was
testing. ``MODE`` defaults to development, so a deployment that never set it
handed out live tokens. Both branches now follow the opt-in alone, so these
tests set it explicitly both ways and set ``MODE`` to the mode each branch
used to key on.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from test.utils import STRONG_TEST_PASSWORD, get_csrf_token
from typing import Any, AsyncGenerator, List
from uuid import uuid4

import pytest
from httpx import AsyncClient, Response

from app import main
from app.core.config import ModeEnum, settings
from app.utils.account_email_dispatch import ACCOUNT_EMAIL_UNIFORM_MESSAGE
from app.utils.account_token_responses import PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE

PASSWORD = STRONG_TEST_PASSWORD


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


@pytest.fixture(autouse=True)
def _no_response_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


def set_mode(monkeypatch: pytest.MonkeyPatch, mode: ModeEnum, expose: bool) -> None:
    monkeypatch.setattr(settings, "MODE", mode)
    monkeypatch.setattr(settings, "EXPOSE_TOKENS_IN_RESPONSES", expose)


async def request_reset(client: AsyncClient, user_factory: Any) -> Response:
    email = f"reset-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, verified=True, is_active=True)
    _, headers = await get_csrf_token(client)
    return await client.post(auth_url("/password-reset/request"), json={"email": email}, headers=headers)


async def register(client: AsyncClient) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(
        auth_url("/register"),
        json={
            "email": f"register-{uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "first_name": "Opt",
            "last_name": "In",
        },
        headers=headers,
    )


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
async def test_reset_request_returns_no_token_without_the_opt_in(
    client: AsyncClient, user_factory: Any, monkeypatch: pytest.MonkeyPatch, mode: ModeEnum
) -> None:
    set_mode(monkeypatch, mode, expose=False)

    response = await request_reset(client, user_factory)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["message"] == PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE
    assert not body.get("data")


async def test_reset_request_returns_the_token_with_the_opt_in(
    client: AsyncClient, user_factory: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_mode(monkeypatch, ModeEnum.testing, expose=True)

    response = await request_reset(client, user_factory)

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["reset_token"]
    assert data["reset_url"] == f"{settings.PASSWORD_RESET_URL}?token={data['reset_token']}"


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
async def test_registration_returns_no_code_without_the_opt_in(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, mode: ModeEnum
) -> None:
    set_mode(monkeypatch, mode, expose=False)

    response = await register(client)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["message"] == ACCOUNT_EMAIL_UNIFORM_MESSAGE
    assert not body.get("data")


async def test_registration_returns_a_working_code_with_the_opt_in(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_mode(monkeypatch, ModeEnum.development, expose=True)

    registered = await register(client)

    assert registered.status_code == 200, registered.text
    code = registered.json()["data"]["verification_code"]
    _, headers = await get_csrf_token(client)
    verified = await client.post(auth_url("/verify-email"), json={"token": code}, headers=headers)
    assert verified.status_code == 200, verified.text


async def test_lifespan_logs_the_mode_warnings(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: List[object] = []

    async def no_redis() -> AsyncGenerator[None, None]:
        yield None

    async def nothing() -> None:
        return None

    monkeypatch.setattr(main, "log_mode_warnings", seen.append)
    monkeypatch.setattr(main, "get_redis_client", no_redis)
    monkeypatch.setattr(main.FastAPICache, "clear", nothing)
    monkeypatch.setattr("app.utils.redis_connection.RedisConnectionFactory.close_pool", nothing)

    async with main.lifespan(main.fastapi_app):
        pass

    assert seen == [settings]
