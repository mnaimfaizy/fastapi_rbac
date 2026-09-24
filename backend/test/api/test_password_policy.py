"""Every self-service route refuses a password the rules refuse (#192, #271).

``PasswordValidator.validate_complexity`` returns ``(is_valid, errors)``.
Registration tested that tuple for falsiness instead of unpacking it, and a
2-tuple is always truthy, so the complexity branch never ran for any input.
The 8-character common password ``password`` was accepted at sign-up and then
refused by ``/auth/password-reset/confirm``, ``/auth/reset_password`` and
``/auth/change_password``.

What each refusal does to the account and the audit log is asserted once,
through the policy module, in ``test/unit/test_password_change.py``. Here each
route gets one test per outcome class and asserts status and body only. The
admin routes are in ``test_admin_password_policy.py``; reuse refusals and
successes are in ``test_password_reuse.py``.
"""

import ast
from pathlib import Path
from test.utils import get_csrf_token
from typing import Any, Dict

import pytest
from httpx import AsyncClient, Response

from app import crud
from app.core import security
from app.core.config import settings
from app.core.security import PasswordValidator
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.account_email_dispatch import ACCOUNT_EMAIL_UNIFORM_MESSAGE
from app.utils.password_policy import PASSWORD_COMPLEXITY_FAILURE_MESSAGE
from app.utils.token import add_token_to_redis

# The three named in #192. Each fails a different rule: too common and too
# short, sequential characters, and length alone.
REJECTED_PASSWORDS = ["password", "NewPassword123!", "Short1!"]
REJECTED_PASSWORD = REJECTED_PASSWORDS[0]

# Satisfies every rule in settings: 12+ characters, all four character classes,
# no sequential run, no repeated run.
ACCEPTED_PASSWORD = "QaRegisterPass!47"

CONFIRM_PATHS = ["/password-reset/confirm", "/reset_password"]


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


def rules_refusal(password: str) -> Dict[str, Any]:
    _, errors = PasswordValidator.validate_complexity(password)
    return {"detail": {"message": PASSWORD_COMPLEXITY_FAILURE_MESSAGE, "errors": errors}}


async def post_register(client: AsyncClient, email: str, password: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(
        auth_url("/register"),
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
        },
        headers=headers,
    )


async def issue_reset_token(redis_mock: Any, user: User) -> str:
    token = security.create_reset_token(user.email)
    await add_token_to_redis(
        redis_mock, user, token, TokenType.RESET, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    return token


# --------------------------------------------------------------------------
# The validator's own verdicts, so the route tests below are anchored
# --------------------------------------------------------------------------


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
def test_sample_passwords_are_rejected_by_the_policy(password: str) -> None:
    is_valid, errors = PasswordValidator.validate_complexity(password)
    assert is_valid is False
    assert errors


def test_sample_password_is_accepted_by_the_policy() -> None:
    is_valid, errors = PasswordValidator.validate_complexity(ACCEPTED_PASSWORD)
    assert is_valid is True, errors


# --------------------------------------------------------------------------
# Registration
# --------------------------------------------------------------------------


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_registration_rules_refused(client: AsyncClient, password: str) -> None:
    response = await post_register(client, "weak-password@example.com", password)

    assert response.status_code == 400, response.text
    assert response.json() == rules_refusal(password)


async def test_registration_succeeded(client: AsyncClient) -> None:
    response = await post_register(client, "strong-password@example.com", ACCEPTED_PASSWORD)

    assert response.status_code == 200, response.text
    assert response.json()["message"] == ACCOUNT_EMAIL_UNIFORM_MESSAGE


async def test_rejected_registration_creates_no_user(client: AsyncClient, db: Any) -> None:
    """The refusal must land before the row, the token and the email."""
    email = "no-row-please@example.com"

    response = await post_register(client, email, REJECTED_PASSWORD)
    assert response.status_code == 400

    db.expunge_all()
    assert await crud.user.get_by_email(db_session=db, email=email) is None


async def test_registration_still_answers_uniformly_for_an_existing_account(
    client: AsyncClient, user_factory: Any
) -> None:
    """The rules refusal must not become an account-existence oracle (#113, #137).

    A compliant password answers the same for an address that exists as for one
    that does not -- the refusal is reachable only when the submitted password
    alone is at fault.
    """
    existing = "already-registered@example.com"
    await user_factory.create(email=existing, password=ACCEPTED_PASSWORD, verified=True, is_active=True)

    absent = await post_register(client, "never-seen@example.com", ACCEPTED_PASSWORD)
    present = await post_register(client, existing, ACCEPTED_PASSWORD)

    assert absent.status_code == present.status_code == 200
    assert absent.json()["message"] == present.json()["message"] == ACCOUNT_EMAIL_UNIFORM_MESSAGE


# --------------------------------------------------------------------------
# Change password
# --------------------------------------------------------------------------


async def test_change_password_rules_refused(client: AsyncClient, user_factory: Any) -> None:
    user = await user_factory.create(password=ACCEPTED_PASSWORD, verified=True, is_active=True)
    _, headers = await get_csrf_token(client)
    login = await client.post(
        auth_url("/login"), json={"email": user.email, "password": ACCEPTED_PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    headers["Authorization"] = f"Bearer {login.json()['data']['access_token']}"

    response = await client.post(
        auth_url("/change_password"),
        json={"current_password": ACCEPTED_PASSWORD, "new_password": REJECTED_PASSWORD},
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert response.json() == rules_refusal(REJECTED_PASSWORD)


# --------------------------------------------------------------------------
# Both reset-confirm routes
# --------------------------------------------------------------------------


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_rules_refused(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str
) -> None:
    user = await user_factory.create(password=ACCEPTED_PASSWORD, verified=True, is_active=True)
    token = await issue_reset_token(redis_mock, user)
    _, headers = await get_csrf_token(client)

    response = await client.post(
        auth_url(path), json={"token": token, "new_password": REJECTED_PASSWORD}, headers=headers
    )

    assert response.status_code == 400, response.text
    assert response.json() == rules_refusal(REJECTED_PASSWORD)


# --------------------------------------------------------------------------
# The shape of the fix
# --------------------------------------------------------------------------


def _app_package() -> Path:
    return Path(__file__).resolve().parents[2] / "app"


def test_validate_complexity_has_exactly_one_caller() -> None:
    """The tuple is unpacked in one place, so no call site can misread it.

    This is the regression guard for #192: the original bug was not a wrong
    comparison, it was four independent call sites, one of which got the
    contract wrong. A new password path must go through
    ``app.utils.password_policy`` rather than call the validator itself.
    """
    callers = set()
    for path in _app_package().rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
                if name == "validate_complexity":
                    callers.add(path.relative_to(_app_package()).as_posix())

    assert callers == {"utils/password_policy.py"}, (
        "validate_complexity returns a tuple and must be called only by "
        f"app.utils.password_policy; also called from: {sorted(callers)}"
    )
