"""Unit tests for HTTP rate-limit keying (#100).

Seams under test:
- rate_limit_key (the shared limiter's key_func: user identity or client address)
- remember_authenticated_identity (how auth state is established for that key)
- get_current_user (reuses the existing security dependency; no second token path)
- observable limiter counters through a tiny FastAPI app (independent users, anonymous 429)
"""

from __future__ import annotations

import ast
from pathlib import Path
from test.fixtures.mock_redis_client import MockRedisClient
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from app.core.rate_limit import (
    UNKNOWN_CLIENT_KEY,
    create_limiter,
    rate_limit_key,
    remember_authenticated_identity,
)

CLIENT = "203.0.113.7"


def _request(client: tuple[str, int] | None, headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers or [],
            "client": client,
        }
    )


def test_anonymous_request_is_keyed_by_client_address() -> None:
    assert rate_limit_key(_request((CLIENT, 40000))) == f"ip:{CLIENT}"


def test_authenticated_request_is_keyed_by_user_identity() -> None:
    user_id = "11111111-1111-1111-1111-111111111111"
    request = _request((CLIENT, 40000))
    remember_authenticated_identity(request, user_id)
    assert rate_limit_key(request) == f"user:{user_id}"


def test_two_authenticated_users_behind_the_same_address_get_distinct_keys() -> None:
    alice = _request((CLIENT, 40000))
    bob = _request((CLIENT, 40000))
    remember_authenticated_identity(alice, "alice-id")
    remember_authenticated_identity(bob, "bob-id")
    assert rate_limit_key(alice) != rate_limit_key(bob)
    assert rate_limit_key(alice) == "user:alice-id"
    assert rate_limit_key(bob) == "user:bob-id"


def test_authenticated_key_and_address_key_cannot_collide() -> None:
    """A user identifier that looks like an address must not share a bucket with that address."""
    anonymous = _request((CLIENT, 40000))
    spoofed = _request((CLIENT, 40000))
    remember_authenticated_identity(spoofed, CLIENT)
    assert rate_limit_key(anonymous) == f"ip:{CLIENT}"
    assert rate_limit_key(spoofed) == f"user:{CLIENT}"
    assert rate_limit_key(anonymous) != rate_limit_key(spoofed)


def test_a_bearer_token_without_established_identity_is_keyed_by_address() -> None:
    """The key function must not invent a second authentication path from the header."""
    request = _request(
        (CLIENT, 40000),
        headers=[(b"authorization", b"Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhdHRhY2tlciJ9.")],
    )
    assert rate_limit_key(request) == f"ip:{CLIENT}"


def test_anonymous_request_without_a_peer_uses_the_unknown_address_key() -> None:
    assert rate_limit_key(_request(None)) == f"ip:{UNKNOWN_CLIENT_KEY}"


def test_rate_limit_module_does_not_decode_tokens() -> None:
    """Identity comes from already-established auth state, not a second JWT path."""
    source = (Path(__file__).resolve().parents[2] / "app" / "core" / "rate_limit.py").read_text(
        encoding="utf-8"
    )
    tree = ast.parse(source)
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
            imported.update(alias.name for alias in node.names)
    assert "jwt" not in imported
    assert "decode_token" not in imported


def test_shared_limiter_uses_the_user_or_address_key_function() -> None:
    lim = create_limiter()
    assert lim._key_func is rate_limit_key


def test_non_testing_storage_is_the_shared_redis_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """The same key function is what Redis stores; production storage stays Redis."""
    monkeypatch.setattr("app.core.rate_limit._is_testing", lambda: False)
    monkeypatch.setattr(
        "app.core.rate_limit.service_settings",
        SimpleNamespace(redis_url="redis://rate-limit-store:6379/2"),
    )
    from app.core.rate_limit import _storage_uri

    assert _storage_uri() == "redis://rate-limit-store:6379/2"


def _limited_client() -> TestClient:
    limiter = Limiter(key_func=rate_limit_key, storage_uri="memory://")
    limiter.enabled = True
    app = FastAPI()
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def _on_limit(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse({"status": "error"}, status_code=429)

    def establish_identity(request: Request) -> None:
        user_id = request.headers.get("x-user-id")
        if user_id:
            remember_authenticated_identity(request, user_id)

    @app.get("/ping")
    @limiter.limit("2/minute")
    async def ping(request: Request, _: None = Depends(establish_identity)) -> dict[str, bool]:
        return {"ok": True}

    return TestClient(app)


def test_two_authenticated_users_behind_the_same_address_have_independent_counters() -> None:
    client = _limited_client()
    alice = {"x-user-id": "alice"}
    bob = {"x-user-id": "bob"}

    assert client.get("/ping", headers=alice).status_code == 200
    assert client.get("/ping", headers=alice).status_code == 200
    assert client.get("/ping", headers=alice).status_code == 429

    assert client.get("/ping", headers=bob).status_code == 200
    assert client.get("/ping", headers=bob).status_code == 200
    assert client.get("/ping", headers=bob).status_code == 429


def test_anonymous_burst_from_one_address_is_rate_limited() -> None:
    """Mechanism: one address shares a bucket. Product 5/minute lives on access-token (test/api)."""
    client = _limited_client()
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 429


@pytest.mark.asyncio
async def test_get_current_user_establishes_identity_for_the_limiter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.deps import get_current_user
    from app.core import security
    from app.models.user_model import User
    from app.utils.token import add_session_tokens_to_redis

    redis = MockRedisClient()
    user_id = uuid4()
    user = User(id=user_id, email="rate-limit-key@example.com", is_active=True)
    access_token = security.create_access_token(str(user_id), user.email)
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token=access_token,
        refresh_token="refresh.one",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )
    monkeypatch.setattr(
        "app.crud.user.get_with_roles_permissions",
        AsyncMock(return_value=user),
    )

    request = _request((CLIENT, 40000))
    resolved = await get_current_user()(
        request=request,
        access_token=access_token,
        redis_client=redis,  # type: ignore[arg-type]
        db_session=MagicMock(),
    )

    assert resolved.id == user_id
    assert rate_limit_key(request) == f"user:{user_id}"
