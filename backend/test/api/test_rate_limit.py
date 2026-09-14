"""HTTP rate limit wiring seams (slowapi consolidation — issue #64)."""

from __future__ import annotations

import ast
from pathlib import Path
from test.utils import random_email

import pytest
from httpx import AsyncClient

from app.core.config import settings


def test_main_does_not_import_fastapi_limiter() -> None:
    """App wiring must not depend on fastapi-limiter (init-only scaffold removed)."""
    main_path = Path(__file__).resolve().parents[2] / "app" / "main.py"
    tree = ast.parse(main_path.read_text(encoding="utf-8"))
    imported_modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module.split(".")[0])
    assert "fastapi_limiter" not in imported_modules


def test_shared_limiter_disabled_in_testing_by_default() -> None:
    from app.core.rate_limit import create_limiter

    lim = create_limiter()
    assert lim.enabled is False


def _reset_limiter_storage(limiter: object) -> None:
    storage = getattr(limiter, "_storage", None)
    if storage is None:
        return
    if hasattr(storage, "reset"):
        storage.reset()
    elif hasattr(storage, "clear"):
        storage.clear()


@pytest.mark.asyncio
async def test_access_token_http_rate_limit_returns_429_when_enabled(
    client: AsyncClient,
) -> None:
    """Burst past access-token's 5/minute HTTP rate limit → 429 with standardized JSON."""
    from app.core.rate_limit import limiter

    previous = limiter.enabled
    limiter.enabled = True
    _reset_limiter_storage(limiter)
    try:
        email = random_email()
        form = {"username": email, "password": "any_password"}

        statuses: list[int] = []
        last_response = None
        for _ in range(6):
            last_response = await client.post(
                f"{settings.API_V1_STR}/auth/access-token",
                data=form,
            )
            statuses.append(last_response.status_code)

        assert 429 in statuses, f"expected HTTP rate limit 429, got {statuses}"
        assert last_response is not None
        assert last_response.status_code == 429
        body = last_response.json()
        assert body.get("status") == "error"
        assert body.get("message") == "Rate limit exceeded"
        error_codes = [err.get("code") for err in body.get("errors", [])]
        assert "rate_limit" in error_codes
    finally:
        limiter.enabled = previous
        _reset_limiter_storage(limiter)
