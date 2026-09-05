"""`password_version` is retired; the allowlist is the sole revocation mechanism.

The column was incremented on every password change and read by nothing. No
token ever carried a `version` claim, no endpoint compared one, and the field
appeared in no schema, no API response and no client. ADR 0011 decision 3
settled #68 by retiring it rather than enforcing it, because decision 1 makes
the Redis allowlist the one place sessions are revoked -- and that mechanism
already works: the allowlist is checked against every access token on every
authenticated request, and revoking is deleting the user's token set.

Keeping the column while ceasing to increment it would leave a name asserting a
security property nothing provides, so the column goes too.

These are tripwires. The first two catch the field coming back; the third
guards what the field was mistaken for -- revocation on every password path,
which the allowlist does and always did. The migration itself is exercised in
`test/api/test_password_version_migration.py`, which needs a database.
"""

import ast
from pathlib import Path

import pytest

from app.models.base_uuid_model import SQLModel
from app.models.user_model import User  # noqa: F401  registers the mapped table

APP_DIR = Path(__file__).resolve().parents[2] / "app"
USER_TABLE = SQLModel.metadata.tables["User"]


def test_user_model_has_no_password_version() -> None:
    """Gone from the Pydantic field set and from the mapped table alike."""
    assert "password_version" not in User.model_fields
    assert "password_version" not in USER_TABLE.columns


def test_password_version_appears_nowhere_in_the_app_package() -> None:
    """A name nothing reads must not be reintroduced by a later password path."""
    offenders = [
        path.relative_to(APP_DIR).as_posix()
        for path in APP_DIR.rglob("*.py")
        if "password_version" in path.read_text(encoding="utf-8")
    ]

    assert offenders == []


def calls_named(function: ast.AST, name: str) -> bool:
    for node in ast.walk(function):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == name:
            return True
    return False


def handlers_in(module: str) -> dict:
    tree = ast.parse((APP_DIR / "api" / "v1" / "endpoints" / module).read_text(encoding="utf-8"))
    return {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


@pytest.mark.parametrize("handler", ["change_password", "confirm_password_reset", "reset_password"])
def test_every_self_service_password_path_revokes_prior_sessions(handler: str) -> None:
    """Retiring the field must not touch the mechanism that made it redundant."""
    handlers = handlers_in("auth.py")

    assert handler in handlers
    assert calls_named(handlers[handler], "revoke_all_user_tokens")


def test_the_admin_password_path_is_the_one_that_does_not_revoke() -> None:
    """Pins the gap so the guard above cannot be read as covering all four paths.

    `PUT /users/{user_id}` sets a password through the same
    `crud.user.update_password` and revokes nothing -- `user.py` imports no
    revocation helper at all. That predates #68 and outlives it: changing how
    sessions are revoked is out of scope there. Tracked as #240; when that
    lands, delete this test and add the handler to the parametrize list above.
    """
    source = (APP_DIR / "api" / "v1" / "endpoints" / "user.py").read_text(encoding="utf-8")

    assert "update_password" in source
    assert "revoke" not in source
