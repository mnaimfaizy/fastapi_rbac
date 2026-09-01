"""Every path that sets a password applies one policy (#192).

``PasswordValidator.validate_complexity`` returns ``(is_valid, errors)``.
Registration tested that tuple for falsiness instead of unpacking it, and a
2-tuple is always truthy, so the complexity branch never ran for any input.
The 8-character common password ``password`` was accepted at sign-up and then
refused by ``/auth/password-reset/confirm``, ``/auth/reset_password`` and
``/auth/change_password``.

What is under test is the agreement, not one endpoint's spelling of it: a
password the validator rejects must be rejected at registration too, before a
user row, a verification token or a verification email exists. The last test
guards the shape of the fix -- the tuple is unpacked in exactly one place, so
a password path added later cannot reintroduce the same misuse.
"""

import ast
from pathlib import Path
from typing import Any, Dict, Tuple
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app import crud
from app.core.config import settings
from app.core.security import PasswordValidator
from app.utils.account_email_dispatch import ACCOUNT_EMAIL_UNIFORM_MESSAGE
from app.utils.password_policy import PASSWORD_COMPLEXITY_FAILURE_MESSAGE

# The three named in #192. Each fails a different rule: too common and too
# short, sequential characters, and length alone.
REJECTED_PASSWORDS = ["password", "NewPassword123!", "Short1!"]

# Satisfies every rule in settings: 12+ characters, all four character classes,
# no sequential run, no repeated run.
ACCEPTED_PASSWORD = "QaRegisterPass!47"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def csrf_headers(client: AsyncClient) -> Dict[str, str]:
    response = await client.get(auth_url("/csrf-token"))
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["data"]["csrf_token"]}


async def post_register(client: AsyncClient, email: str, password: str) -> Tuple[int, Dict[str, Any]]:
    headers = await csrf_headers(client)
    response = await client.post(
        auth_url("/register"),
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
        },
        headers=headers,
    )
    return response.status_code, response.json()


# --------------------------------------------------------------------------
# The validator's own verdicts, so the endpoint tests below are anchored
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
# Registration applies it
# --------------------------------------------------------------------------


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_registration_rejects_a_password_the_policy_rejects(client: AsyncClient, password: str) -> None:
    status_code, body = await post_register(client, "weak-password@example.com", password)

    assert status_code == 400, body
    detail = body["detail"]
    assert detail["message"] == PASSWORD_COMPLEXITY_FAILURE_MESSAGE
    assert detail["errors"] == PasswordValidator.validate_complexity(password)[1]


async def test_registration_accepts_a_policy_compliant_password(client: AsyncClient) -> None:
    status_code, body = await post_register(client, "strong-password@example.com", ACCEPTED_PASSWORD)

    assert status_code == 200, body
    assert body["message"] == ACCOUNT_EMAIL_UNIFORM_MESSAGE


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_rejected_registration_creates_no_user(client: AsyncClient, db: Any, password: str) -> None:
    """The reject must land before the row, the token and the email."""
    email = "no-row-please@example.com"

    status_code, _ = await post_register(client, email, password)
    assert status_code == 400

    db.expunge_all()
    assert await crud.user.get_by_email(db_session=db, email=email) is None


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_rejected_registration_logs_the_security_event(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, password: str
) -> None:
    """``registration_password_complexity_failed`` was dead along with the branch."""
    recorded = AsyncMock()
    monkeypatch.setattr("app.utils.password_policy.log_security_event", recorded)

    status_code, _ = await post_register(client, "audited@example.com", password)
    assert status_code == 400

    recorded.assert_awaited_once()
    assert recorded.await_args.kwargs["event_type"] == "registration_password_complexity_failed"
    assert recorded.await_args.kwargs["details"]["errors"]


async def test_registration_still_answers_uniformly_for_an_existing_account(
    client: AsyncClient, user_factory: Any
) -> None:
    """The complexity reject must not become an account-existence oracle (#113, #137).

    A compliant password answers the same for an address that exists as for one
    that does not, exactly as before -- the new reject path is reachable only
    when the submitted password alone is at fault.
    """
    existing = "already-registered@example.com"
    await user_factory.create(email=existing, password=ACCEPTED_PASSWORD, verified=True, is_active=True)

    absent_result = await post_register(client, "never-seen@example.com", ACCEPTED_PASSWORD)
    existing_result = await post_register(client, existing, ACCEPTED_PASSWORD)

    assert absent_result[0] == existing_result[0] == 200
    assert absent_result[1]["message"] == existing_result[1]["message"] == ACCOUNT_EMAIL_UNIFORM_MESSAGE


# --------------------------------------------------------------------------
# ...and so does every other password-setting path, through the same call
# --------------------------------------------------------------------------


def _app_package() -> Path:
    return Path(__file__).resolve().parents[2] / "app"


def test_validate_complexity_has_exactly_one_caller() -> None:
    """The tuple is unpacked in one place, so no call site can misread it.

    This is the regression guard for #192: the original bug was not a wrong
    comparison, it was four independent call sites, one of which got the
    contract wrong. A new password path must go through
    ``enforce_password_complexity`` rather than call the validator itself.
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
        f"enforce_password_complexity; also called from: {sorted(callers)}"
    )
