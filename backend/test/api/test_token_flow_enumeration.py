"""The token-bearing account flows must not reveal that an account is disabled (#137).

Verify-email and both password-reset confirm endpoints used to answer
"Account is inactive. Cannot ..." for a disabled user. Each of those confirmed
that an account exists at the submitted address -- the same class of oracle
#113 closed for registration and resend-verification, narrowed to disabled
users.

The property under test: for a caller who does not already hold a valid token,
a disabled account is indistinguishable from a missing one and from a bad
token. What still differs is the security event written to the audit log.

In `test/api/` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md). They sit
beside `test_account_enumeration.py`, which tests the same property across the
same six endpoints.
"""

import time
from test.utils import get_csrf_token
from typing import Any, Callable, Dict, List, Tuple

import pytest
from httpx import AsyncClient, Response

from app.api.v1.endpoints import auth as auth_endpoints
from app.core import security
from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils import account_token_responses
from app.utils.account_token_responses import (
    INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
    INVALID_VERIFICATION_TOKEN_MESSAGE,
    PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE,
)
from app.utils.token import add_token_to_redis

PASSWORD = "TestPassw0rd!47"
NEW_PASSWORD = "ReplacementPassword!42"

ABSENT_EMAIL = "no-such-account@example.com"
ACTIVE_EMAIL = "active-user@example.com"
DISABLED_EMAIL = "disabled-user@example.com"

CONFIRM_PATHS = ["/password-reset/confirm", "/reset_password"]


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


def observable(response: Response) -> Tuple[int, str]:
    """Reduce a response to what a caller can actually distinguish."""
    body: Dict[str, Any] = response.json()
    return response.status_code, str(body.get("message", body.get("detail", "")))


async def post_verify_email(client: AsyncClient, token: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(auth_url("/verify-email"), json={"token": token}, headers=headers)


async def post_reset_confirm(client: AsyncClient, path: str, token: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(
        auth_url(path),
        json={"token": token, "new_password": NEW_PASSWORD},
        headers=headers,
    )


async def post_reset_request(client: AsyncClient, email: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(auth_url("/password-reset/request"), json={"email": email}, headers=headers)


async def seed_users(user_factory: Any) -> Tuple[Any, Any]:
    """Create one active, verified user and one disabled user."""
    active = await user_factory.create(email=ACTIVE_EMAIL, password=PASSWORD, verified=True, is_active=True)
    disabled = await user_factory.create(
        email=DISABLED_EMAIL, password=PASSWORD, verified=False, is_active=False
    )
    return active, disabled


@pytest.fixture
def emitted_events(monkeypatch: Any) -> List[str]:
    """Collect the security events the rejection helpers actually emit.

    This records calls to `log_security_event` itself rather than assertions
    about `BackgroundTasks.add_task`. FastAPI attaches an endpoint's background
    tasks to the response it returns, and an HTTPException is answered by a
    fresh response carrying none -- so a test that only checks the task was
    queued would pass while the event was silently discarded.
    """
    recorded: List[str] = []

    async def recorder(**kwargs: Any) -> None:
        recorded.append(str(kwargs.get("event_type")))

    monkeypatch.setattr(account_token_responses, "log_security_event", recorder)
    # The request endpoint returns 200 and so still queues its event the
    # ordinary way; patching both modules lets one fixture cover every site.
    monkeypatch.setattr(auth_endpoints, "log_security_event", recorder)
    return recorded


# --------------------------------------------------------------------------
# verify-email
# --------------------------------------------------------------------------


async def test_verify_email_disabled_matches_a_bad_token(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """A disabled account with a good token answers exactly as a bad token does."""
    active, disabled = await seed_users(user_factory)

    disabled_token = security.create_verification_token(disabled.email)
    await redis_mock.setex(f"verification_token:{disabled.id}", 3600, disabled_token)
    disabled_response = observable(await post_verify_email(client, disabled_token))

    # An active account whose token was never issued -- "the token is simply invalid".
    bad_token = security.create_verification_token(active.email)
    bad_response = observable(await post_verify_email(client, bad_token))

    assert disabled_response == bad_response
    assert disabled_response == (400, INVALID_VERIFICATION_TOKEN_MESSAGE)


async def test_verify_email_disabled_matches_an_unknown_address(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """A disabled account is indistinguishable from an address with no account."""
    _, disabled = await seed_users(user_factory)

    disabled_token = security.create_verification_token(disabled.email)
    await redis_mock.setex(f"verification_token:{disabled.id}", 3600, disabled_token)
    disabled_response = observable(await post_verify_email(client, disabled_token))

    absent_response = observable(
        await post_verify_email(client, security.create_verification_token(ABSENT_EMAIL))
    )

    assert disabled_response == absent_response


async def test_verify_email_disabled_still_emits_its_own_event(
    client: AsyncClient, user_factory: Any, redis_mock: Any, emitted_events: List[str]
) -> None:
    """The distinction survives in the audit log, not in the response."""
    _, disabled = await seed_users(user_factory)
    token = security.create_verification_token(disabled.email)
    await redis_mock.setex(f"verification_token:{disabled.id}", 3600, token)

    await post_verify_email(client, token)

    assert emitted_events == ["verify_email_inactive_account"]


async def test_verify_email_still_verifies_an_active_user(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """The uniform rejection must not swallow the success path."""
    pending = await user_factory.create(
        email="pending-user@example.com", password=PASSWORD, verified=False, is_active=True
    )
    token = security.create_verification_token(pending.email)
    await redis_mock.setex(f"verification_token:{pending.id}", 3600, token)

    response = await post_verify_email(client, token)

    assert response.status_code == 200
    assert "verified" in response.json()["message"].lower()


async def test_verify_email_rejects_an_undecodable_token_regardless_of_account(
    client: AsyncClient, user_factory: Any, redis_mock: Any, emitted_events: List[str]
) -> None:
    """The 401 carve-out is not an oracle: it does not vary with account state.

    A token that fails JWT validation is answered by `decode_token` with a 401
    describing the token itself. That branch stays distinct from the uniform
    400 deliberately (ADR 0010). It is safe because the answer is decided
    before any lookup, so a well-formed token signed with the wrong key gets
    the same 401 whether it names a disabled account or no account at all.
    """
    _, disabled = await seed_users(user_factory)

    # Well-formed JWTs, but minted with the reset key rather than the
    # verification key, so signature validation fails before any lookup.
    absent_response = observable(await post_verify_email(client, security.create_reset_token(ABSENT_EMAIL)))
    disabled_response = observable(
        await post_verify_email(client, security.create_reset_token(disabled.email))
    )

    assert absent_response == disabled_response
    assert absent_response[0] == 401
    assert emitted_events == []


# --------------------------------------------------------------------------
# password reset -- both confirm endpoints
# --------------------------------------------------------------------------


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_confirm_disabled_matches_a_bad_token(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str
) -> None:
    active, disabled = await seed_users(user_factory)

    disabled_token = security.create_reset_token(disabled.email)
    await add_token_to_redis(
        redis_mock,
        disabled,
        disabled_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    disabled_response = observable(await post_reset_confirm(client, path, disabled_token))

    bad_token = security.create_reset_token(active.email)
    bad_response = observable(await post_reset_confirm(client, path, bad_token))

    assert disabled_response == bad_response
    assert disabled_response == (400, INVALID_PASSWORD_RESET_TOKEN_MESSAGE)


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_confirm_disabled_matches_an_unknown_address(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str
) -> None:
    _, disabled = await seed_users(user_factory)

    disabled_token = security.create_reset_token(disabled.email)
    await add_token_to_redis(
        redis_mock,
        disabled,
        disabled_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    disabled_response = observable(await post_reset_confirm(client, path, disabled_token))

    absent_response = observable(
        await post_reset_confirm(client, path, security.create_reset_token(ABSENT_EMAIL))
    )

    assert disabled_response == absent_response


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_confirm_disabled_still_emits_its_own_event(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str, emitted_events: List[str]
) -> None:
    _, disabled = await seed_users(user_factory)
    token = security.create_reset_token(disabled.email)
    await add_token_to_redis(
        redis_mock, disabled, token, TokenType.RESET, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )

    await post_reset_confirm(client, path, token)

    assert emitted_events == ["password_reset_inactive_account"]


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_confirm_separates_the_disabled_and_bad_token_branches(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str, emitted_events: List[str]
) -> None:
    """One response, two records. The log is where the branches stay apart."""
    active, disabled = await seed_users(user_factory)

    disabled_token = security.create_reset_token(disabled.email)
    await add_token_to_redis(
        redis_mock,
        disabled,
        disabled_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    await post_reset_confirm(client, path, disabled_token)
    await post_reset_confirm(client, path, security.create_reset_token(active.email))

    assert emitted_events == [
        "password_reset_inactive_account",
        "password_reset_token_not_in_redis",
    ]


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_confirm_still_resets_an_active_user(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str
) -> None:
    """The uniform rejection must not swallow the success path."""
    active, _ = await seed_users(user_factory)
    token = security.create_reset_token(active.email)
    await add_token_to_redis(
        redis_mock, active, token, TokenType.RESET, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )

    response = await post_reset_confirm(client, path, token)

    assert response.status_code == 200, response.json()


# --------------------------------------------------------------------------
# password reset -- the request endpoint
# --------------------------------------------------------------------------


async def test_reset_request_is_uniform_across_account_states(client: AsyncClient, user_factory: Any) -> None:
    """Absent, active and disabled must produce identical answers.

    The success branch used to drop the full stop the other two branches ended
    with, which distinguished an active account from every other state on a
    single request.
    """
    await seed_users(user_factory)

    responses = {
        email: observable(await post_reset_request(client, email))
        for email in (ABSENT_EMAIL, ACTIVE_EMAIL, DISABLED_EMAIL)
    }

    assert len(set(responses.values())) == 1, responses
    assert responses[DISABLED_EMAIL] == (200, PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE)


async def test_reset_request_disabled_still_emits_its_own_event(
    client: AsyncClient, user_factory: Any, emitted_events: List[str]
) -> None:
    await seed_users(user_factory)

    await post_reset_request(client, DISABLED_EMAIL)

    assert emitted_events == ["password_reset_request_inactive_user"]


# --------------------------------------------------------------------------
# The response-time floor
# --------------------------------------------------------------------------


async def test_no_token_flow_branch_returns_faster_than_the_floor(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """A uniform body still leaks if the disabled branch answers sooner.

    Each of these branches returns before the work the others do -- the disabled
    check short-circuits ahead of the password write, and an unknown address
    short-circuits ahead of the Redis lookup. Only the lower bound is asserted;
    an upper bound would measure the host rather than the code.
    """
    _, disabled = await seed_users(user_factory)
    floor = settings.UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS
    minimum = floor * 0.9

    verification_token = security.create_verification_token(disabled.email)
    await redis_mock.setex(f"verification_token:{disabled.id}", 3600, verification_token)
    reset_token = security.create_reset_token(disabled.email)
    await add_token_to_redis(
        redis_mock, disabled, reset_token, TokenType.RESET, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )

    probes: List[Tuple[str, Callable[[], Any]]] = [
        ("verify-email disabled", lambda: post_verify_email(client, verification_token)),
        (
            "verify-email absent",
            lambda: post_verify_email(client, security.create_verification_token(ABSENT_EMAIL)),
        ),
        ("password-reset/request disabled", lambda: post_reset_request(client, DISABLED_EMAIL)),
        ("password-reset/request absent", lambda: post_reset_request(client, ABSENT_EMAIL)),
    ]
    for path in CONFIRM_PATHS:
        probes.append((f"{path} disabled", lambda p=path: post_reset_confirm(client, p, reset_token)))
        probes.append(
            (
                f"{path} absent",
                lambda p=path: post_reset_confirm(client, p, security.create_reset_token(ABSENT_EMAIL)),
            )
        )

    for label, call in probes:
        started = time.monotonic()
        await call()
        elapsed = time.monotonic() - started
        assert elapsed >= minimum, f"{label} returned in {elapsed:.3f}s, under the floor"
