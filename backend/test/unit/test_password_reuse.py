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
   check and never incremented `password_version`.

The property under test is the agreement, not one endpoint's spelling of it: a
password the policy refuses must be refused on every path, and a password the
policy accepts must produce the same side effects on every path. The structural
test at the end guards the shape of the fix -- `password_version` is bumped in
exactly one place, so a password path added later cannot quietly skip it.
"""

import ast
from pathlib import Path
from test.utils import get_csrf_token
from typing import Any, Dict, List

import pytest
from httpx import AsyncClient, Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.security import PasswordValidator
from app.crud.user_crud import password_reuse_window, user_crud
from app.models.password_history_model import UserPasswordHistory
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.token import add_token_to_redis

# Every one of these satisfies the complexity policy, so a rejection can only
# come from the reuse rule under test and never from #192's complexity branch.
SIGNUP_PASSWORD = "QaRegisterPass!47"
SECOND_PASSWORD = "ReplacementPassword!42"
THIRD_PASSWORD = "AnotherGoodPhrase!73"

CONFIRM_PATHS = ["/password-reset/confirm", "/reset_password"]


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


def detail_of(response: Response) -> str:
    body: Dict[str, Any] = response.json()
    return str(body.get("detail", body.get("message", "")))


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


async def history_hashes(db: AsyncSession, user: User) -> List[str]:
    result = await db.exec(
        select(UserPasswordHistory.password_hash).where(UserPasswordHistory.user_id == user.id)
    )
    return list(result.all())


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
# The policy itself, at the one place it lives
# --------------------------------------------------------------------------


async def test_update_password_refuses_the_current_password_with_empty_history(
    db: AsyncSession, user_factory: Any
) -> None:
    """Defect 1: nothing in history, and the current password still refused."""
    user = await user_factory.create(password=SIGNUP_PASSWORD)
    assert await history_hashes(db, user) == []

    with pytest.raises(ValueError, match="different from your current password"):
        await user_crud.update_password(user=user, new_password=SIGNUP_PASSWORD, db_session=db)


async def test_update_password_refuses_a_password_inside_the_window(
    db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=SIGNUP_PASSWORD)
    await user_crud.update_password(user=user, new_password=SECOND_PASSWORD, db_session=db)

    with pytest.raises(ValueError, match=f"last {password_reuse_window()} passwords"):
        await user_crud.update_password(user=user, new_password=SIGNUP_PASSWORD, db_session=db)


async def test_update_password_accepts_a_genuinely_new_password(db: AsyncSession, user_factory: Any) -> None:
    user = await user_factory.create(password=SIGNUP_PASSWORD)
    previous_hash = user.password
    previous_version = user.password_version

    await user_crud.update_password(user=user, new_password=SECOND_PASSWORD, db_session=db)

    assert PasswordValidator.verify_password(SECOND_PASSWORD, user.password)
    assert user.password_version == previous_version + 1
    assert await history_hashes(db, user) == [previous_hash]


# --------------------------------------------------------------------------
# Both reset-confirm endpoints
# --------------------------------------------------------------------------


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_refuses_the_current_password_on_a_fresh_account(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any, path: str
) -> None:
    """The live repro from #193: register, then reset back to the sign-up password."""
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    email, version = user.email, user.password_version
    assert await history_hashes(db, user) == []
    token = await issue_reset_token(redis_mock, user)

    response = await post_reset_confirm(client, path, token, SIGNUP_PASSWORD)

    assert response.status_code == 400, response.text
    db.expunge_all()
    reloaded = await user_crud.get_by_email(db_session=db, email=email)
    assert reloaded is not None
    assert reloaded.password_version == version


@pytest.mark.parametrize("path", CONFIRM_PATHS)
async def test_reset_accepts_a_genuinely_new_password(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any, path: str
) -> None:
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    email = user.email
    token = await issue_reset_token(redis_mock, user)

    response = await post_reset_confirm(client, path, token, SECOND_PASSWORD)

    assert response.status_code == 200, response.text
    db.expunge_all()
    reloaded = await user_crud.get_by_email(db_session=db, email=email)
    assert reloaded is not None
    assert reloaded.password is not None
    assert PasswordValidator.verify_password(SECOND_PASSWORD, reloaded.password)


# --------------------------------------------------------------------------
# change_password -- the path that ran no effective check at all
# --------------------------------------------------------------------------


async def test_change_password_refuses_the_current_password(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    """The live repro from #193: current == new returned 200."""
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    headers = await login_headers(client, user.email, SIGNUP_PASSWORD)

    response = await post_change_password(client, headers, SIGNUP_PASSWORD, SIGNUP_PASSWORD)

    assert response.status_code == 400, response.text
    assert "current password" in detail_of(response).lower()


async def test_change_password_refuses_a_password_inside_the_window(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    email = user.email
    headers = await login_headers(client, email, SIGNUP_PASSWORD)

    first = await post_change_password(client, headers, SIGNUP_PASSWORD, SECOND_PASSWORD)
    assert first.status_code == 200, first.text
    # A successful change revokes the tokens it was made with.
    db.expunge_all()
    headers = await login_headers(client, email, SECOND_PASSWORD)

    response = await post_change_password(client, headers, SECOND_PASSWORD, SIGNUP_PASSWORD)

    assert response.status_code == 400, response.text
    assert str(password_reuse_window()) in detail_of(response)


async def test_change_password_accepts_a_new_password_with_the_same_side_effects(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    """Defect 3: this path skipped the history append and the version bump."""
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    email = user.email
    previous_hash = user.password
    previous_version = user.password_version
    headers = await login_headers(client, email, SIGNUP_PASSWORD)

    response = await post_change_password(client, headers, SIGNUP_PASSWORD, SECOND_PASSWORD)

    assert response.status_code == 200, response.text
    db.expunge_all()
    reloaded = await user_crud.get_by_email(db_session=db, email=email)
    assert reloaded is not None
    assert reloaded.password is not None
    assert PasswordValidator.verify_password(SECOND_PASSWORD, reloaded.password)
    assert reloaded.password_version == previous_version + 1
    assert await history_hashes(db, reloaded) == [previous_hash]


async def test_change_password_still_refuses_a_wrong_current_password(
    client: AsyncClient, user_factory: Any
) -> None:
    """The reuse rule must not shadow the older, more specific rejection."""
    user = await user_factory.create(password=SIGNUP_PASSWORD, verified=True, is_active=True)
    headers = await login_headers(client, user.email, SIGNUP_PASSWORD)

    response = await post_change_password(client, headers, THIRD_PASSWORD, SECOND_PASSWORD)

    assert response.status_code == 400, response.text
    assert detail_of(response) == "Invalid Current Password"


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


def test_password_version_is_incremented_in_exactly_one_place() -> None:
    """Every password path must inherit the side effects, not restate them.

    `change_password` reimplemented the sequence and silently dropped this
    bump. Keeping the write in one module is what makes the reuse policy, the
    history append and the version bump impossible to apply selectively.
    """

    def writes_password_version(node: ast.AST) -> bool:
        if not isinstance(node, ast.AugAssign):
            return False
        target = node.target
        return isinstance(target, ast.Attribute) and target.attr == "password_version"

    assert _modules_matching(writes_password_version) == {"crud/user_crud.py"}


def test_no_reuse_check_compares_bcrypt_digests() -> None:
    """`is_password_reused` was structurally incapable of returning True.

    It is gone; nothing may reintroduce a comparison between a value named like
    a hash and a collection of stored hashes.
    """
    assert not hasattr(user_crud, "is_password_reused")

    def compares_a_hash_for_membership(node: ast.AST) -> bool:
        if not isinstance(node, ast.Compare):
            return False
        if not any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            return False
        left = node.left
        return isinstance(left, ast.Name) and "password_hash" in left.id

    assert _modules_matching(compares_a_hash_for_membership) == set()
