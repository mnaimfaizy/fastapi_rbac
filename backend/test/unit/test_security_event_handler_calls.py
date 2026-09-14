"""Direct handler calls so unit coverage records security-event awaits (#243).

HTTP tests in ``test/api/`` already persist the rows. Coverage does not always
trace those awaits through ASGI on raising paths -- the same gap
``test_verify_email_repeat_visit.py`` documents -- so this module calls the
handlers themselves.
"""

from datetime import datetime, timedelta, timezone
from test.fixtures.mock_redis_client import MockRedisClient
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api.v1.endpoints import auth as auth_endpoints
from app.api.v1.endpoints.auth import login, login_access_token, register, request_password_reset
from app.core.config import ModeEnum, settings
from app.schemas.user_schema import PasswordResetRequest, UserRegister
from app.utils.account_email_dispatch import AccountState, dispatch_account_email


def _request() -> MagicMock:
    request = MagicMock()
    request.client = MagicMock(host="127.0.0.1")
    request.headers = {}
    return request


def _sanitizer() -> MagicMock:
    sanitizer = MagicMock()
    sanitizer.sanitize = MagicMock(side_effect=lambda value, _kind: value)
    sanitizer.max_length = 1000
    return sanitizer


def _user(**kwargs: Any) -> MagicMock:
    user = MagicMock()
    user.id = kwargs.get("id", uuid4())
    user.email = kwargs.get("email", "handler@example.com")
    user.is_active = kwargs.get("is_active", True)
    user.verified = kwargs.get("verified", True)
    user.is_locked = kwargs.get("is_locked", False)
    user.locked_until = kwargs.get("locked_until")
    user.number_of_failed_attempts = kwargs.get("number_of_failed_attempts", 0)
    user.password = kwargs.get("password", "hashed")
    return user


@pytest.fixture(autouse=True)
def _no_response_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)
    monkeypatch.setattr("app.api.v1.endpoints.auth.get_client_ip", lambda _request: "127.0.0.1")


@pytest.fixture
def recorded(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    events: list[str] = []

    async def recorder(*_args: object, **kwargs: object) -> None:
        event_type = kwargs.get("event_type")
        if isinstance(event_type, str):
            events.append(event_type)

    monkeypatch.setattr(auth_endpoints, "log_security_event", recorder)
    monkeypatch.setattr("app.utils.account_email_dispatch.log_security_event", recorder)
    return events


async def _login(
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str = "handler@example.com",
    password: str = "irrelevant",
    sanitizer: MagicMock | None = None,
    user: MagicMock | None = None,
    authenticated: MagicMock | None | str = "default",
) -> None:
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.get_by_email",
        AsyncMock(return_value=user),
    )
    if authenticated != "default":
        monkeypatch.setattr(
            "app.api.v1.endpoints.auth.crud.user.authenticate",
            AsyncMock(return_value=authenticated),
        )
    await login(
        request=_request(),
        response=MagicMock(),
        email=email,
        password=password,
        background_tasks=BackgroundTasks(),
        redis_client=MockRedisClient(),  # type: ignore[arg-type]
        sanitizer=sanitizer or _sanitizer(),
        db_session=MagicMock(),
        _=None,
    )


@pytest.mark.asyncio
async def test_login_sanitization_failure_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    sanitizer = _sanitizer()
    sanitizer.sanitize = MagicMock(side_effect=ValueError("bad email"))
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, sanitizer=sanitizer)
    assert raised.value.status_code == 400
    assert "login_input_sanitization_failed" in recorded


@pytest.mark.asyncio
async def test_login_unknown_user_emits_failed_login(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=None)
    assert raised.value.status_code == 422
    assert "failed_login" in recorded


@pytest.mark.asyncio
async def test_login_locked_user_emits_locked_attempt(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(is_locked=True, locked_until=datetime.now(timezone.utc) + timedelta(hours=1))
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=user)
    assert raised.value.status_code == 422
    assert "locked_account_attempt" in recorded


@pytest.mark.asyncio
async def test_login_authenticate_error_emits_authentication_error(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.authenticate",
        AsyncMock(side_effect=RuntimeError("auth backend down")),
    )
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=_user())
    assert raised.value.status_code == 500
    assert "authentication_error" in recorded


@pytest.mark.asyncio
async def test_login_user_disappears_after_failed_auth(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user()
    get_by_email = AsyncMock(side_effect=[user, None])
    monkeypatch.setattr("app.api.v1.endpoints.auth.crud.user.get_by_email", get_by_email)
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.authenticate",
        AsyncMock(return_value=None),
    )
    with pytest.raises(HTTPException) as raised:
        await login(
            request=_request(),
            response=MagicMock(),
            email=user.email,
            password="wrong",
            background_tasks=BackgroundTasks(),
            redis_client=MockRedisClient(),  # type: ignore[arg-type]
            sanitizer=_sanitizer(),
            db_session=MagicMock(),
            _=None,
        )
    assert raised.value.status_code == 500
    assert "failed_login_user_disappeared" in recorded


@pytest.mark.asyncio
async def test_login_wrong_password_emits_oauth2_failed_login(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user()
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=user, authenticated=None)
    assert raised.value.status_code == 422
    assert "oauth2_failed_login" in recorded


@pytest.mark.asyncio
async def test_login_failed_auth_handling_error_emits_failed_login_error(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user()
    get_by_email = AsyncMock(side_effect=[user, RuntimeError("lookup failed")])
    monkeypatch.setattr("app.api.v1.endpoints.auth.crud.user.get_by_email", get_by_email)
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.authenticate",
        AsyncMock(return_value=None),
    )
    with pytest.raises(HTTPException) as raised:
        await login(
            request=_request(),
            response=MagicMock(),
            email=user.email,
            password="wrong",
            background_tasks=BackgroundTasks(),
            redis_client=MockRedisClient(),  # type: ignore[arg-type]
            sanitizer=_sanitizer(),
            db_session=MagicMock(),
            _=None,
        )
    assert raised.value.status_code == 500
    assert "failed_login_error" in recorded


@pytest.mark.asyncio
async def test_login_unverified_user_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(verified=False)
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=user, authenticated=user)
    assert raised.value.status_code == 422
    assert "unverified_login_attempt" in recorded


@pytest.mark.asyncio
async def test_login_inactive_user_emits_event(monkeypatch: pytest.MonkeyPatch, recorded: list[str]) -> None:
    user = _user(is_active=False, verified=True)
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=user, authenticated=user)
    assert raised.value.status_code == 403
    assert "inactive_user_login_attempt" in recorded


@pytest.mark.asyncio
async def test_login_token_generation_error_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user()
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.security.create_access_token",
        MagicMock(side_effect=RuntimeError("signing failed")),
    )
    with pytest.raises(HTTPException) as raised:
        await _login(monkeypatch, user=user, authenticated=user)
    assert raised.value.status_code == 500
    assert "token_generation_error" in recorded


@pytest.mark.asyncio
async def test_login_unexpected_error_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.get_by_email",
        AsyncMock(side_effect=RuntimeError("db down")),
    )
    with pytest.raises(HTTPException) as raised:
        await login(
            request=_request(),
            response=MagicMock(),
            email="handler@example.com",
            password="irrelevant",
            background_tasks=BackgroundTasks(),
            redis_client=MockRedisClient(),  # type: ignore[arg-type]
            sanitizer=_sanitizer(),
            db_session=MagicMock(),
            _=None,
        )
    assert raised.value.status_code == 500
    assert "login_unexpected_error" in recorded


async def _oauth2(
    monkeypatch: pytest.MonkeyPatch,
    *,
    user: MagicMock | None,
    authenticated: MagicMock | None | str = "default",
) -> None:
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.get_by_email",
        AsyncMock(return_value=user),
    )
    if authenticated != "default":
        monkeypatch.setattr(
            "app.api.v1.endpoints.auth.crud.user.authenticate",
            AsyncMock(return_value=authenticated),
        )
    form = MagicMock()
    form.username = "oauth@example.com"
    form.password = "irrelevant"
    await login_access_token(
        request=_request(),
        form_data=form,
        background_tasks=BackgroundTasks(),
        redis_client=MockRedisClient(),  # type: ignore[arg-type]
        db_session=MagicMock(),
    )


@pytest.mark.asyncio
async def test_oauth2_unknown_user_emits_failed_login(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    with pytest.raises(HTTPException):
        await _oauth2(monkeypatch, user=None)
    assert "oauth2_failed_login" in recorded


@pytest.mark.asyncio
async def test_oauth2_locked_user_emits_locked_attempt(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(
        is_locked=True,
        locked_until=datetime.now(timezone.utc) + timedelta(hours=1),
        email="oauth@example.com",
    )
    with pytest.raises(HTTPException):
        await _oauth2(monkeypatch, user=user)
    assert "oauth2_locked_account_attempt" in recorded


@pytest.mark.asyncio
async def test_oauth2_user_disappears_after_failed_auth(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(email="oauth@example.com")
    get_by_email = AsyncMock(side_effect=[user, None])
    monkeypatch.setattr("app.api.v1.endpoints.auth.crud.user.get_by_email", get_by_email)
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.authenticate",
        AsyncMock(return_value=None),
    )
    form = MagicMock()
    form.username = user.email
    form.password = "wrong"
    with pytest.raises(HTTPException):
        await login_access_token(
            request=_request(),
            form_data=form,
            background_tasks=BackgroundTasks(),
            redis_client=MockRedisClient(),  # type: ignore[arg-type]
            db_session=MagicMock(),
        )
    assert "oauth2_failed_login_user_disappeared" in recorded


@pytest.mark.asyncio
async def test_oauth2_wrong_password_emits_failed_login(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(email="oauth@example.com")
    with pytest.raises(HTTPException):
        await _oauth2(monkeypatch, user=user, authenticated=None)
    assert "oauth2_failed_login" in recorded


@pytest.mark.asyncio
async def test_oauth2_inactive_user_emits_event(monkeypatch: pytest.MonkeyPatch, recorded: list[str]) -> None:
    user = _user(is_active=False, email="oauth@example.com")
    with pytest.raises(HTTPException):
        await _oauth2(monkeypatch, user=user, authenticated=user)
    assert "oauth2_inactive_user_attempt" in recorded


@pytest.mark.asyncio
async def test_dispatch_absent_resend_emits_no_mail_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    monkeypatch.setattr(
        "app.utils.account_email_dispatch.crud.user.get_by_email",
        AsyncMock(return_value=None),
    )
    result = await dispatch_account_email(
        email="absent@example.com",
        db_session=MagicMock(),
        redis_client=MockRedisClient(),  # type: ignore[arg-type]
        background_tasks=BackgroundTasks(),
        ip_address="127.0.0.1",
        may_create=False,
    )
    assert result.state is AccountState.ABSENT
    assert "account_email_absent_no_mail_sent" in recorded


@pytest.mark.asyncio
async def test_dispatch_pending_reissue_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(verified=False, is_active=True)
    monkeypatch.setattr(
        "app.utils.account_email_dispatch.crud.user.get_by_email",
        AsyncMock(return_value=user),
    )
    monkeypatch.setattr(
        "app.utils.account_email_dispatch.issue_verification",
        AsyncMock(return_value="token"),
    )
    result = await dispatch_account_email(
        email=user.email,
        db_session=MagicMock(),
        redis_client=MockRedisClient(),  # type: ignore[arg-type]
        background_tasks=BackgroundTasks(),
        ip_address="127.0.0.1",
        may_create=False,
    )
    assert result.state is AccountState.PENDING
    assert "account_email_verification_reissued" in recorded


@pytest.mark.asyncio
async def test_dispatch_established_notice_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    user = _user(verified=True, is_active=True)
    monkeypatch.setattr(
        "app.utils.account_email_dispatch.crud.user.get_by_email",
        AsyncMock(return_value=user),
    )
    monkeypatch.setattr(
        "app.utils.account_email_dispatch.send_registration_notice_email",
        AsyncMock(),
    )
    result = await dispatch_account_email(
        email=user.email,
        db_session=MagicMock(),
        redis_client=MockRedisClient(),  # type: ignore[arg-type]
        background_tasks=BackgroundTasks(),
        ip_address="127.0.0.1",
        may_create=False,
    )
    assert result.state is AccountState.ESTABLISHED
    assert "account_email_notice_sent_established" in recorded


@pytest.mark.asyncio
async def test_register_sanitization_failure_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    sanitizer = _sanitizer()
    sanitizer.sanitize = MagicMock(side_effect=RuntimeError("bad input"))
    with pytest.raises(HTTPException) as raised:
        await register(
            request=_request(),
            user_in=UserRegister(
                email="new@example.com", password="QaRegisterPass!47", first_name="A", last_name="B"
            ),
            background_tasks=BackgroundTasks(),
            redis_client=MockRedisClient(),  # type: ignore[arg-type]
            sanitizer=sanitizer,
            db_session=MagicMock(),
            _=None,
        )
    assert raised.value.status_code == 400
    assert "registration_input_sanitization_failed" in recorded


@pytest.mark.asyncio
async def test_register_rate_limit_emits_event(monkeypatch: pytest.MonkeyPatch, recorded: list[str]) -> None:
    monkeypatch.setattr(settings, "MODE", ModeEnum.production)
    redis = MockRedisClient()
    await redis.set("registration_rate_limit:ip:127.0.0.1", str(settings.MAX_REGISTRATION_ATTEMPTS_PER_HOUR))
    with pytest.raises(HTTPException) as raised:
        await register(
            request=_request(),
            user_in=UserRegister(
                email="new@example.com", password="QaRegisterPass!47", first_name="A", last_name="B"
            ),
            background_tasks=BackgroundTasks(),
            redis_client=redis,  # type: ignore[arg-type]
            sanitizer=_sanitizer(),
            db_session=MagicMock(),
            _=None,
        )
    assert raised.value.status_code == 429
    assert "registration_rate_limit_exceeded" in recorded


@pytest.mark.asyncio
async def test_register_domain_not_allowed_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ALLOWLIST", ["allowed.example.com"])
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_BLACKLIST", [])
    with pytest.raises(HTTPException) as raised:
        await register(
            request=_request(),
            user_in=UserRegister(
                email="new@other.example.com",
                password="QaRegisterPass!47",
                first_name="A",
                last_name="B",
            ),
            background_tasks=BackgroundTasks(),
            redis_client=MockRedisClient(),  # type: ignore[arg-type]
            sanitizer=_sanitizer(),
            db_session=MagicMock(),
            _=None,
        )
    assert raised.value.status_code == 400
    assert "registration_domain_not_allowed" in recorded


async def _reset_request(
    monkeypatch: pytest.MonkeyPatch,
    *,
    user: MagicMock | None,
    sanitizer: MagicMock | None = None,
) -> object:
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.crud.user.get_by_email",
        AsyncMock(return_value=user),
    )
    monkeypatch.setattr("app.api.v1.endpoints.auth.send_password_reset_email", AsyncMock())
    monkeypatch.setattr("app.api.v1.endpoints.auth.add_token_to_redis", AsyncMock())
    return await request_password_reset(
        request=_request(),
        reset_request=PasswordResetRequest(email="reset@example.com"),
        background_tasks=BackgroundTasks(),
        redis_client=MockRedisClient(),  # type: ignore[arg-type]
        sanitizer=sanitizer or _sanitizer(),
        db_session=MagicMock(),
        _=None,
    )


@pytest.mark.asyncio
async def test_password_reset_sanitization_failure_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    sanitizer = _sanitizer()
    sanitizer.sanitize = MagicMock(side_effect=RuntimeError("bad email"))
    with pytest.raises(HTTPException):
        await _reset_request(monkeypatch, user=None, sanitizer=sanitizer)
    assert "password_reset_request_sanitization_failed" in recorded


@pytest.mark.asyncio
async def test_password_reset_unknown_email_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    await _reset_request(monkeypatch, user=None)
    assert "password_reset_request_invalid_email" in recorded


@pytest.mark.asyncio
async def test_password_reset_inactive_user_emits_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    await _reset_request(monkeypatch, user=_user(is_active=False, email="reset@example.com"))
    assert "password_reset_request_inactive_user" in recorded


@pytest.mark.asyncio
async def test_password_reset_active_user_emits_requested_event(
    monkeypatch: pytest.MonkeyPatch, recorded: list[str]
) -> None:
    await _reset_request(monkeypatch, user=_user(email="reset@example.com"))
    assert "password_reset_requested" in recorded
