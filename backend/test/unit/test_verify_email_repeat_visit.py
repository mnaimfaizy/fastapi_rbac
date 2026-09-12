"""Direct call covering verify_email's Redis-mismatch branch (#239).

The in-process HTTP tests in ``test/api/`` assert the same behaviour. This
file calls the handler itself so the unit coverage data records the inner
``if not (user.is_active and user.verified)`` / ``reject_verification`` lines
that the ASGI path does not always trace.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api.v1.endpoints.auth import verify_email
from app.core.config import settings
from app.core.security import create_verification_token
from app.schemas.user_schema import VerifyEmail
from app.utils.account_token_responses import INVALID_VERIFICATION_TOKEN_MESSAGE


def _request() -> MagicMock:
    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    return request


def _sanitizer() -> MagicMock:
    sanitizer = MagicMock()
    sanitizer.sanitize = MagicMock(side_effect=lambda value, _kind: value)
    return sanitizer


@pytest.fixture(autouse=True)
def _no_response_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


@pytest.mark.asyncio
async def test_unverified_redis_mismatch_takes_the_uniform_reject(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unverified user whose Redis token does not match is the uniform 400."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "unverified-mismatch@example.com"
    user.is_active = True
    user.verified = False

    redis = MockRedisClient()
    await redis.setex(f"verification_token:{user.id}", 3600, "some-other-token")
    token = create_verification_token(user.email)

    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.get_by_email",
        AsyncMock(return_value=user),
    )

    with pytest.raises(HTTPException) as exc_info:
        await verify_email(
            request=_request(),
            body=VerifyEmail(token=token),
            background_tasks=BackgroundTasks(),
            redis_client=redis,  # type: ignore[arg-type]
            sanitizer=_sanitizer(),
            db_session=MagicMock(),
            _=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == INVALID_VERIFICATION_TOKEN_MESSAGE
