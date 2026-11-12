"""Every permission a route requires is one the seed creates (#325).

The user endpoints required ``users.read``, ``users.create``, ``users.update``
and ``users.delete``, but ``init_db`` seeds ``user.*``. No role held the
plural names, so only a superuser, who skips permission checks, could list,
create, edit or delete users. Nothing compared the two lists, and this test
does.
"""

import ast
from pathlib import Path

from app.db.init_db import INITIAL_PERMISSIONS
from app.utils.string_utils import format_permission_name

API_PACKAGE = Path(__file__).resolve().parents[2] / "app" / "api"


def seeded_permission_names() -> set[str]:
    return {format_permission_name(p["name"], p["group_name"]) for p in INITIAL_PERMISSIONS}


def required_permission_names() -> dict[str, list[str]]:
    """Each ``required_permissions=[...]`` string literal under ``app/api``, with where it is."""
    found: dict[str, list[str]] = {}
    for path in sorted(API_PACKAGE.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.keyword) or node.arg != "required_permissions":
                continue
            if not isinstance(node.value, (ast.List, ast.Tuple)):
                continue
            for element in node.value.elts:
                if isinstance(element, ast.Constant) and isinstance(element.value, str):
                    where = f"{path.relative_to(API_PACKAGE.parent).as_posix()}:{element.lineno}"
                    found.setdefault(element.value, []).append(where)
    return found


def test_the_scan_finds_the_user_routes() -> None:
    # Guards the guard: a scan that found nothing would pass vacuously.
    required = required_permission_names()
    assert {"user.read", "user.create", "user.update", "user.delete"} <= required.keys()


def test_every_required_permission_is_seeded() -> None:
    seeded = seeded_permission_names()
    unseeded = {name: where for name, where in required_permission_names().items() if name not in seeded}
    assert unseeded == {}, f"required but never seeded, so no role can hold them: {unseeded}"
