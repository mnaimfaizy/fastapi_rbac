"""One reuse policy, applied by every path that sets a password (#193).

Three defects left `PASSWORD_HISTORY_SIZE` / `PREVENT_PASSWORD_REUSE` almost
entirely unenforced:

1. The current password was never compared -- only `UserPasswordHistory` rows
   were. Registration writes no row, so a freshly registered account could
   "reset" straight back to the password it already had.
2. `is_password_reused` compared a *freshly generated* bcrypt digest against
   stored digests with `in`. bcrypt salts each hash independently, so that
   comparison can never be true; the function was inert in both its callers.
3. `/auth/change_password` bypassed `crud.user.update_password` entirely,
   reimplementing the sequence inline. It therefore ran no effective reuse
   check and skipped the history append.

Every path now sets a password through ``app.utils.password_policy`` (#271).
What a reuse refusal or a success does to the account, the history and the
allowlist is asserted once, through that module, in
``test/unit/test_password_change.py``. Here each self-service route gets one
test per outcome class and asserts status and body only; the admin route is in
``test_admin_password_policy.py``. The structural tests at the end guard the
shape of the fix -- the side effects are written in exactly one place, so a
password path added later cannot quietly skip them.
"""

import ast
from pathlib import Path
from test.utils import get_csrf_token
from typing import Any, Dict

import pytest
from httpx import AsyncClient, Response

from app.core import security
from app.core.config import settings
from app.core.security import PasswordValidator
from app.crud.user_crud import password_reuse_window, user_crud
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.token import add_token_to_redis

# Every one of these satisfies the complexity policy, so a rejection can only
# come from the reuse rule under test and never from #192's complexity branch.
SIGNUP_PASSWORD = "QaRegisterPass!47"
SECOND_PASSWORD = "ReplacementPassword!42"
THIRD_PASSWORD = "AnotherGoodPhrase!73"

CONFIRM_PATHS = ["/password-reset/confirm", "/reset_password"]

CURRENT_PASSWORD_MESSAGE = "New password must be different from your current password."


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


def reuse_refusal(message: str) -> Dict[str, Any]:
    return {"detail": {"message": message, "errors": [message]}}


async def post_reset_confirm(client: AsyncClient, path: str, token: str, new_password: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(
        auth_url(path),
        json={"token": token, "new_password": new_password},
        headers=headers,
    )


async def issue_reset_token(redis_mock: Any, user: User) -> str:
    token = security.create_reset_token(user.email)
    await add_token_to_redis(
        redis_mock,
        user,
        token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    return token


async def login_headers(client: AsyncClient, email: str, password: str) -> Dict[str, str]:
    _, headers = await get_csrf_token(client)
    response = await client.post(
        auth_url("/login"),
        json={"email": email, "password": password},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    token = response.json()["data"]["access_token"]
    return {**headers, "Authorization": f"Bearer {token}"}


async def post_change_password(
    client: AsyncClient, headers: Dict[str, str], current_password: str, new_password: str
) -> Response:
    return await client.post(
        auth_url("/change_password"),
        json={"current_password": current_password, "new_password": new_password},
        headers=headers,
    )


# --------------------------------------------------------------------------
# Why the old check could not work
# --------------------------------------------------------------------------


def test_two_hashes_of_one_password_are_never_equal() -> None:
    """The anchor for defect 2: bcrypt salts each hash, so `in` never matched."""
    first = PasswordValidator.get_password_hash(SIGNUP_PASSWORD)
    second = PasswordValidator.get_password_hash(SIGNUP_PASSWORD)

    assert first != second
    assert PasswordValidator.verify_password(SIGNUP_PASSWORD, first)
    assert PasswordValidator.verify_password(SIGNUP_PASSWORD, second)


def test_reuse_window_never_exceeds_what_is_retained() -> None:
    """Refusing more passwords than are stored is not possible."""
    assert password_reuse_window() == min(settings.PASSWORD_HISTORY_SIZE, settings.PREVENT_PASSWORD_REUSE)
    assert password_reuse_window() > 0, "the reuse policy is disabled in this environment"


# --------------------------------------------------------------------------
# Both reset-confirm routes
# --------------------------------------------------------------------------


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_reuse_refused(
    client: AsyncClient, user_factory: Any, redis_mock: Any, path: str
) -> None:
    """The live repro from #193: register, then reset back to the sign-up password.

    The real reuse message, not a generic one: only a caller holding a live
    reset link can reach it (#271, ADR 0010).
    """
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    token = await issue_reset_token(redis_mock, user)

    response = await post_reset_confirm(client, path, token, SIGNUP_PASSWORD)

    assert response.status_code == 400, response.text
    assert response.json() == reuse_refusal(CURRENT_PASSWORD_MESSAGE)


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_succeeded(client: AsyncClient, user_factory: Any, redis_mock: Any, path: str) -> None:
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    token = await issue_reset_token(redis_mock, user)

    response = await post_reset_confirm(client, path, token, SECOND_PASSWORD)

    assert response.status_code == 200, response.text
    assert response.json()["message"] == "Password has been reset successfully"


# --------------------------------------------------------------------------
# change_password -- the path that ran no effective check at all
# --------------------------------------------------------------------------


async def test_change_password_reuse_refused(client: AsyncClient, user_factory: Any) -> None:
    """The live repro from #193: current == new returned 200."""
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    headers = await login_headers(client, user.email, SIGNUP_PASSWORD)

    response = await post_change_password(client, headers, SIGNUP_PASSWORD, SIGNUP_PASSWORD)

    assert response.status_code == 400, response.text
    assert response.json() == reuse_refusal(CURRENT_PASSWORD_MESSAGE)


async def test_change_password_succeeded(client: AsyncClient, user_factory: Any) -> None:
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    headers = await login_headers(client, user.email, SIGNUP_PASSWORD)

    response = await post_change_password(client, headers, SIGNUP_PASSWORD, SECOND_PASSWORD)

    assert response.status_code == 200, response.text
    assert response.json()["message"] == "Password changed successfully"


async def test_change_password_wrong_current_password(client: AsyncClient, user_factory: Any) -> None:
    """The current-password check authenticates the caller and runs first."""
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    headers = await login_headers(client, user.email, SIGNUP_PASSWORD)

    response = await post_change_password(client, headers, THIRD_PASSWORD, SECOND_PASSWORD)

    assert response.status_code == 400, response.text
    assert response.json() == {"detail": "Invalid Current Password"}


# --------------------------------------------------------------------------
# The shape of the fix
# --------------------------------------------------------------------------


def _app_package() -> Path:
    return Path(__file__).resolve().parents[2] / "app"


def _modules_matching(predicate: Any) -> set:
    found = set()
    for path in _app_package().rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if predicate(node):
                found.add(path.relative_to(_app_package()).as_posix())
    return found


def test_password_side_effects_are_written_in_exactly_one_place() -> None:
    """Every password path must inherit the side effects, not restate them.

    `change_password` reimplemented the sequence and silently dropped them.
    Keeping the writes in one module is what makes the reuse policy and the
    history append impossible to apply selectively. This tracks
    `last_changed_password_date` because it is the side effect written by
    assignment; the version counter used to serve as the marker until #68
    retired it.
    """

    def stamps_the_password_change(node: ast.AST) -> bool:
        if not isinstance(node, ast.Assign):
            return False
        return any(
            isinstance(target, ast.Attribute) and target.attr == "last_changed_password_date"
            for target in node.targets
        )

    assert _modules_matching(stamps_the_password_change) == {"crud/user_crud.py"}


def _calls_named(name: str) -> Any:
    def predicate(node: ast.AST) -> bool:
        if not isinstance(node, ast.Call):
            return False
        func = node.func
        called = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        return bool(called == name)

    return predicate


def test_only_the_policy_module_stages_a_password() -> None:
    """No route can set a password without the rules, reuse and revocation (#271)."""
    assert _modules_matching(_calls_named("update_password")) == {"utils/password_policy.py"}


def test_no_reuse_check_compares_bcrypt_digests() -> None:
    """`is_password_reused` was structurally incapable of returning True.

    It is gone. This is a tripwire, not a proof: it catches the shape the bug
    took -- a hash-named expression tested for membership in stored hashes --
    so the same mistake cannot come back unremarked.
    """
    assert not hasattr(user_crud, "is_password_reused")

    def compares_a_hash_for_membership(node: ast.AST) -> bool:
        if not isinstance(node, ast.Compare):
            return False
        if not any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            return False
        return "hash" in ast.unparse(node.left)

    assert _modules_matching(compares_a_hash_for_membership) == set()
