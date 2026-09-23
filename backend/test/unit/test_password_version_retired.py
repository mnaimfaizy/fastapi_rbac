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
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        called = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        if called == name:
            return True
    return False


def handlers_in(path: Path) -> dict:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


@pytest.mark.parametrize(
    ("module", "handler"),
    [
        ("auth.py", "change_password"),
        ("auth.py", "confirm_password_reset"),
        ("auth.py", "reset_password"),
        ("user.py", "update_user"),
    ],
)
def test_every_password_path_revokes_prior_sessions(module: str, handler: str) -> None:
    """Retiring the field must not touch the mechanism that made it redundant.

    Four paths set a password. Self-service lives in ``auth.py``; the
    administrator path is ``update_user`` in ``user.py``. Since #271 each goes
    through ``password_policy.change_password`` and none revokes on its own,
    so no path can end sessions after its commit or skip it.
    """
    handlers = handlers_in(APP_DIR / "api" / "v1" / "endpoints" / module)

    assert handler in handlers
    assert calls_named(handlers[handler], "change_password")
    assert not calls_named(handlers[handler], "revoke_all_user_tokens")


def test_the_policy_module_revokes_prior_sessions() -> None:
    """The one place a password changes is the one place sessions end.

    Awaited inline -- passing it to ``BackgroundTasks`` is not a Call of that
    name, so a deferred revoke fails this guard (#206).
    """
    handlers = handlers_in(APP_DIR / "utils" / "password_policy.py")

    assert calls_named(handlers["change_password"], "revoke_all_user_tokens")
