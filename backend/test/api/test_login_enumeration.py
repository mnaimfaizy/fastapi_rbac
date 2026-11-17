"""A failed password login must not reveal account state (ADR 0015).

``POST /auth/login`` and ``POST /auth/access-token`` used to answer a wrong
password with a lockout countdown for an existing account and a plain message
for an unknown address, a locked account with the minutes left, and the form
route with a different status for a locked account. Each of those told an
unauthenticated caller something about the account at the submitted address.

The property under test: every failure that a caller without the password can
cause -- unknown address, wrong password in any account state, and any
attempt on a locked account -- is the same status and the same body, on both
routes. Only a correct password may learn more: unverified (422) and inactive
(403). A locked account stays on the uniform answer even with the right
password, so the lock really does stop guessing.

In ``test/api/`` because they boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from test.utils import STRONG_TEST_PASSWORD, get_csrf_token, random_strong_password
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Tuple

import pytest
from httpx import AsyncClient, Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.v1.endpoints import auth as auth_endpoints
from app.core.config import settings
from app.core.security import PasswordValidator
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.allowlist import get_valid_tokens
from app.utils.login_refusal import LOGIN_REFUSED_DETAIL, LOGIN_REFUSED_STATUS

PASSWORD = STRONG_TEST_PASSWORD
WRONG_PASSWORD = random_strong_password()

ABSENT_EMAIL = "login-nobody@example.com"
VERIFIED_EMAIL = "login-verified@example.com"
UNVERIFIED_EMAIL = "login-unverified@example.com"
INACTIVE_EMAIL = "login-inactive@example.com"
LOCKED_EMAIL = "login-locked@example.com"

Attempt = Callable[[AsyncClient, str, str], Awaitable[Response]]


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def json_login(client: AsyncClient, email: str, password: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(auth_url("/login"), json={"email": email, "password": password}, headers=headers)


async def form_login(client: AsyncClient, email: str, password: str) -> Response:
    return await client.post(auth_url("/access-token"), data={"username": email, "password": password})


ROUTES = [
    pytest.param(json_login, id="json-login"),
    pytest.param(form_login, id="access-token"),
]


def observable(response: Response) -> Tuple[int, str]:
    """Everything a caller can tell apart: the status and the whole body."""
    return response.status_code, response.text


UNIFORM = (LOGIN_REFUSED_STATUS, {"detail": LOGIN_REFUSED_DETAIL})


def as_uniform(response: Response) -> Tuple[int, Dict[str, Any]]:
    return response.status_code, response.json()


@pytest.fixture(autouse=True)
def _no_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    """The floor is asserted separately; here it would only slow the suite."""
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


async def seed_users(user_factory: Any) -> None:
    await user_factory.create(email=VERIFIED_EMAIL, password=PASSWORD, verified=True, is_active=True)
    await user_factory.create(email=UNVERIFIED_EMAIL, password=PASSWORD, verified=False, is_active=True)
    await user_factory.create(email=INACTIVE_EMAIL, password=PASSWORD, verified=True, is_active=False)
    await user_factory.create(
        email=LOCKED_EMAIL,
        password=PASSWORD,
        verified=True,
        is_active=True,
        is_locked=True,
        number_of_failed_attempts=settings.MAX_LOGIN_ATTEMPTS,
        locked_until=(datetime.now(timezone.utc) + timedelta(hours=2)).replace(tzinfo=None),
    )


async def stored_user(db: AsyncSession, email: str) -> User:
    db.expire_all()
    return (await db.exec(select(User).where(User.email == email))).one()


# --------------------------------------------------------------------------
# Every failure a caller without the password can cause is one response
# --------------------------------------------------------------------------


@pytest.mark.parametrize("attempt", ROUTES)
async def test_failed_login_is_uniform_across_account_states(
    client: AsyncClient, user_factory: Any, attempt: Attempt
) -> None:
    await seed_users(user_factory)

    responses = {
        "unknown address": await attempt(client, ABSENT_EMAIL, WRONG_PASSWORD),
        "wrong password, verified": await attempt(client, VERIFIED_EMAIL, WRONG_PASSWORD),
        "wrong password, unverified": await attempt(client, UNVERIFIED_EMAIL, WRONG_PASSWORD),
        "wrong password, inactive": await attempt(client, INACTIVE_EMAIL, WRONG_PASSWORD),
        "wrong password, locked": await attempt(client, LOCKED_EMAIL, WRONG_PASSWORD),
        "right password, locked": await attempt(client, LOCKED_EMAIL, PASSWORD),
    }

    observed = {label: observable(response) for label, response in responses.items()}
    assert len(set(observed.values())) == 1, observed
    assert as_uniform(responses["unknown address"]) == UNIFORM


async def test_both_routes_give_the_same_refusal(client: AsyncClient, user_factory: Any) -> None:
    await seed_users(user_factory)

    from_json = await json_login(client, VERIFIED_EMAIL, WRONG_PASSWORD)
    from_form = await form_login(client, VERIFIED_EMAIL, WRONG_PASSWORD)

    assert observable(from_json) == observable(from_form)


@pytest.mark.parametrize("attempt", ROUTES)
async def test_no_attempt_counts_down_to_the_lockout(
    client: AsyncClient, db: AsyncSession, user_factory: Any, attempt: Attempt
) -> None:
    """Every wrong password, the last one before the lock and the locking one included, looks alike."""
    await user_factory.create(email=VERIFIED_EMAIL, password=PASSWORD, verified=True, is_active=True)
    unknown = observable(await attempt(client, ABSENT_EMAIL, WRONG_PASSWORD))

    for number in range(1, settings.MAX_LOGIN_ATTEMPTS + 2):
        response = await attempt(client, VERIFIED_EMAIL, WRONG_PASSWORD)
        assert observable(response) == unknown, f"attempt {number}: {response.text}"

    stored = await stored_user(db, VERIFIED_EMAIL)
    assert stored.is_locked is True
    assert stored.number_of_failed_attempts == settings.MAX_LOGIN_ATTEMPTS


# --------------------------------------------------------------------------
# Lockout counting is unchanged
# --------------------------------------------------------------------------


@pytest.mark.parametrize("attempt", ROUTES)
async def test_lockout_still_triggers_at_max_login_attempts(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
    attempt: Attempt,
) -> None:
    """The form route used to count down from a hard-coded 3; the limit is the setting."""
    monkeypatch.setattr(settings, "MAX_LOGIN_ATTEMPTS", 4)
    await user_factory.create(email=VERIFIED_EMAIL, password=PASSWORD, verified=True, is_active=True)

    for _ in range(3):
        await attempt(client, VERIFIED_EMAIL, WRONG_PASSWORD)
    before = await stored_user(db, VERIFIED_EMAIL)
    assert before.is_locked is False
    assert before.number_of_failed_attempts == 3

    await attempt(client, VERIFIED_EMAIL, WRONG_PASSWORD)

    after = await stored_user(db, VERIFIED_EMAIL)
    assert after.is_locked is True
    assert after.locked_until is not None


# --------------------------------------------------------------------------
# A correct password may learn the account's state
# --------------------------------------------------------------------------


@pytest.mark.parametrize("attempt", ROUTES)
async def test_right_password_on_an_unverified_account_says_so(
    client: AsyncClient, user_factory: Any, attempt: Attempt
) -> None:
    await seed_users(user_factory)

    response = await attempt(client, UNVERIFIED_EMAIL, PASSWORD)

    assert response.status_code == 422
    assert response.json()["detail"] == {"field_name": "email", "message": "Email is not verified."}


@pytest.mark.parametrize("attempt", ROUTES)
async def test_right_password_on_an_inactive_account_says_so(
    client: AsyncClient, user_factory: Any, attempt: Attempt
) -> None:
    await seed_users(user_factory)

    response = await attempt(client, INACTIVE_EMAIL, PASSWORD)

    assert response.status_code == 403
    assert response.json()["detail"] == {"field_name": "email", "message": "Inactive user"}


@pytest.mark.parametrize("attempt", ROUTES)
async def test_right_password_on_a_locked_account_keeps_the_lock_and_opens_no_session(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any, attempt: Attempt
) -> None:
    await seed_users(user_factory)
    before = await stored_user(db, LOCKED_EMAIL)
    locked_until = before.locked_until

    response = await attempt(client, LOCKED_EMAIL, PASSWORD)

    assert as_uniform(response) == UNIFORM
    after = await stored_user(db, LOCKED_EMAIL)
    assert after.is_locked is True
    assert after.locked_until == locked_until
    assert after.number_of_failed_attempts == settings.MAX_LOGIN_ATTEMPTS
    assert await get_valid_tokens(redis_mock, after.id, TokenType.ACCESS) == set()
    assert await get_valid_tokens(redis_mock, after.id, TokenType.REFRESH) == set()


@pytest.mark.parametrize("attempt", ROUTES)
async def test_success_after_failures_carries_no_lockout_warning(
    client: AsyncClient, user_factory: Any, attempt: Attempt
) -> None:
    """The success message used to become a 'last attempt' warning one failure short of the lock."""
    await user_factory.create(
        email=VERIFIED_EMAIL,
        password=PASSWORD,
        verified=True,
        is_active=True,
        number_of_failed_attempts=settings.MAX_LOGIN_ATTEMPTS - 1,
    )

    response = await attempt(client, VERIFIED_EMAIL, PASSWORD)

    assert response.status_code == 200, response.text
    assert "attempt" not in response.json()["message"].lower()


# --------------------------------------------------------------------------
# Timing: the floor, and a bcrypt check on every path
# --------------------------------------------------------------------------


@pytest.mark.parametrize("attempt", ROUTES)
async def test_every_login_outcome_leaves_through_the_response_floor(
    client: AsyncClient, user_factory: Any, monkeypatch: pytest.MonkeyPatch, attempt: Attempt
) -> None:
    await seed_users(user_factory)
    entered: List[str] = []
    real_floor = auth_endpoints.response_time_floor

    @asynccontextmanager
    async def spy(seconds: float | None = None) -> AsyncIterator[None]:
        entered.append("floor")
        async with real_floor(seconds):
            yield

    monkeypatch.setattr(auth_endpoints, "response_time_floor", spy)

    cases = [
        (ABSENT_EMAIL, WRONG_PASSWORD),
        (VERIFIED_EMAIL, WRONG_PASSWORD),
        (LOCKED_EMAIL, PASSWORD),
        (UNVERIFIED_EMAIL, PASSWORD),
        (VERIFIED_EMAIL, PASSWORD),
    ]
    for email, password in cases:
        entered.clear()
        await attempt(client, email, password)
        assert entered == ["floor"], f"{email} did not pass through the floor"


@pytest.mark.parametrize("attempt", ROUTES)
@pytest.mark.parametrize("email", [ABSENT_EMAIL, LOCKED_EMAIL], ids=["unknown-address", "locked"])
async def test_paths_without_a_usable_hash_still_pay_for_a_bcrypt_check(
    client: AsyncClient,
    user_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
    attempt: Attempt,
    email: str,
) -> None:
    """Otherwise an unknown address answers measurably sooner than a known one."""
    await seed_users(user_factory)
    checks: List[str] = []
    real_verify = PasswordValidator.verify_password

    def counting_verify(plain: str | bytes, hashed: str | bytes) -> bool:
        checks.append("bcrypt")
        return real_verify(plain, hashed)

    monkeypatch.setattr(PasswordValidator, "verify_password", staticmethod(counting_verify))

    response = await attempt(client, email, WRONG_PASSWORD)

    assert as_uniform(response) == UNIFORM
    assert checks == ["bcrypt"]


async def test_the_dummy_hash_is_generated_not_committed() -> None:
    """A literal hash in the source would be the same in every deployment."""
    from pathlib import Path

    from app.utils import login_refusal

    source = Path(login_refusal.__file__).read_text(encoding="utf-8")
    assert "$2b$" not in source
    assert PasswordValidator.verify_password(WRONG_PASSWORD, login_refusal._DUMMY_PASSWORD_HASH) is False
