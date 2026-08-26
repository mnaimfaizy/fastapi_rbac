"""Paginated list endpoints must read rows from .data.items, not .items.

``GET /api/v1/users/list`` returned a 500 in the running app:

    AttributeError: 'IGetResponsePaginated[Any]' object has no attribute 'items'

``fastapi_pagination.paginate()`` resolves the concrete page class from the
route's return annotation. Every list route here is annotated
``IGetResponsePaginated[...]``, whose ``create()`` nests the page under
``data``, so ``paginate()`` hands back an object with ``.data.items`` and no
``.items`` at all. Four call sites read ``.items`` off it and raised.

``get_multi_paginated`` is declared ``-> Page[ModelType]``, which is what made
the wrong access look right: that annotation describes the CRUD layer, not what
actually arrives at the endpoint.
"""

import ast
from pathlib import Path
from typing import get_args

import pytest
from fastapi_pagination import Params
from pydantic import BaseModel

from app.schemas.response_schema import IGetResponsePaginated

ENDPOINTS_DIR = Path(__file__).resolve().parents[2] / "app" / "api" / "v1" / "endpoints"


def make_page(total: int = 3) -> IGetResponsePaginated:
    """Build a page exactly as paginate() does, via the same classmethod."""
    return IGetResponsePaginated.create(
        items=["a", "b", "c"][:total],
        params=Params(page=1, size=10),
        total=total,
    )


def test_paginated_response_nests_rows_under_data() -> None:
    """The rows are at .data.items; this is the contract endpoints must use."""
    page = make_page()

    assert page.data.items == ["a", "b", "c"]
    assert page.data.total == 3
    assert page.data.page == 1
    assert page.data.size == 10
    assert page.data.pages == 1


def test_paginated_response_has_no_top_level_items() -> None:
    """Reading .items raises -- the exact failure seen in the running app."""
    page = make_page()

    with pytest.raises(AttributeError, match="items"):
        _ = page.items

    for attribute in ("total", "page", "size", "pages"):
        with pytest.raises(AttributeError):
            getattr(page, attribute)


def paginated_result_names(tree: ast.AST) -> set[str]:
    """Names assigned directly from a get_multi_paginated* call."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        value = node.value
        while isinstance(value, ast.Await):
            value = value.value
        if not isinstance(value, ast.Call):
            continue
        func = value.func
        attr = func.attr if isinstance(func, ast.Attribute) else None
        if attr and attr.startswith("get_multi_paginated"):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    names.add(target.id)
    return names


def test_no_endpoint_reads_items_off_a_paginated_result() -> None:
    """Guard the whole endpoint package, not just the routes that were fixed.

    A source scan rather than a request test: reproducing this through HTTP
    needs an authenticated admin and a populated table for every list route,
    and the defect is a static one -- reading an attribute that does not exist.

    One test over all files rather than one per file: a package-wide autouse
    fixture builds a database for every test, and this needs none of it.
    """
    offenders: list[str] = []

    for path in sorted(ENDPOINTS_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        tracked = paginated_result_names(tree)
        if not tracked:
            continue
        offenders.extend(
            f"{path.name}:{node.lineno} reads {node.value.id}.{node.attr}"
            for node in ast.walk(tree)
            if isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id in tracked
            and node.attr in {"items", "total", "page", "size", "pages"}
        )

    assert not offenders, (
        "paginated results expose these under .data, so reading them directly "
        f"raises AttributeError at runtime: {sorted(offenders)}"
    )


# ---------------------------------------------------------------------------
# Schemas behind paginated routes must accept ORM rows
# ---------------------------------------------------------------------------


def paginated_row_schemas() -> list[type]:
    """Every schema that appears as IGetResponsePaginated[...] on a route."""
    from app.schemas.permission_group_schema import IPermissionGroupReadWithPermissions
    from app.schemas.permission_schema import IPermissionRead
    from app.schemas.role_group_schema import IRoleGroupRead
    from app.schemas.role_schema import IRoleRead
    from app.schemas.user_schema import IUserRead

    return [
        IPermissionGroupReadWithPermissions,
        IPermissionRead,
        IRoleGroupRead,
        IRoleRead,
        IUserRead,
    ]


def reachable_models(root: type) -> dict[type, str]:
    """Every pydantic model reachable from root, with the path that reaches it.

    Walks nested fields, unwrapping Optional/List/Union. Nesting is the whole
    point: IRoleGroupRead carries from_attributes, but its creator field is an
    IUserBasic that did not, and that nested gap was what broke
    GET /role-groups. A flat check over the top-level schemas misses it.
    """
    found: dict[type, str] = {}

    def walk(model: type, path: str) -> None:
        if model in found:
            return
        found[model] = path
        for name, field in model.model_fields.items():
            pending = [field.annotation]
            while pending:
                annotation = pending.pop()
                if isinstance(annotation, type) and issubclass(annotation, BaseModel):
                    walk(annotation, f"{path}.{name}")
                else:
                    pending.extend(a for a in get_args(annotation) if a is not type(None))

    walk(root, root.__name__)
    return found


def test_paginated_row_schemas_accept_orm_rows() -> None:
    """from_attributes must be set on every model behind a paginated route.

    fastapi-pagination hands raw ORM rows straight to the page model, and
    pydantic v2 refuses to validate an arbitrary class instance into a model
    without from_attributes. Two schemas were missing it:

        IRoleRead    -> GET /roles
        IUserBasic   -> GET /role-groups?include_hierarchy=true

    Both raised "Input should be a valid dictionary or instance of ...".
    """
    graph: dict[type, str] = {}
    for root in paginated_row_schemas():
        for model, path in reachable_models(root).items():
            graph.setdefault(model, path)

    missing = sorted(
        f"{model.__name__} (reached via {path})"
        for model, path in graph.items()
        if model.model_config.get("from_attributes") is not True
    )

    assert not missing, (
        "these are used behind paginated routes but cannot be built from ORM "
        f"rows; inherit IBaseSchema or set from_attributes=True: {missing}"
    )


def test_role_page_builds_from_orm_rows() -> None:
    """The GET /roles path specifically, end to end through create()."""
    from datetime import datetime, timezone
    from uuid import uuid4

    from app.models.role_model import Role
    from app.schemas.role_schema import IRoleRead

    rows = [
        Role(id=uuid4(), name=f"role{i}", description="d", created_at=datetime.now(timezone.utc))
        for i in range(3)
    ]

    page = IGetResponsePaginated[IRoleRead].create(items=rows, params=Params(page=1, size=10), total=3)

    assert [row.name for row in page.data.items] == ["role0", "role1", "role2"]
    assert page.data.total == 3
