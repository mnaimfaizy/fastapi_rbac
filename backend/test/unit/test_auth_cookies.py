"""Unit tests for HttpOnly refresh-token cookie helpers (#66)."""

from typing import Any
from unittest.mock import MagicMock

from app.core.config import ModeEnum, settings
from app.utils.auth_cookies import (
    clear_refresh_token_cookie,
    refresh_cookie_path,
    refresh_cookie_secure,
    set_refresh_token_cookie,
)


def test_refresh_cookie_path_scopes_to_auth_routes() -> None:
    assert refresh_cookie_path() == f"{settings.API_V1_STR}/auth"


def test_refresh_cookie_secure_defaults_by_mode(monkeypatch: Any) -> None:
    monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", None)
    monkeypatch.setattr(settings, "MODE", ModeEnum.development)
    assert refresh_cookie_secure() is False
    monkeypatch.setattr(settings, "MODE", ModeEnum.production)
    assert refresh_cookie_secure() is True
    monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", True)
    monkeypatch.setattr(settings, "MODE", ModeEnum.development)
    assert refresh_cookie_secure() is True


def test_set_refresh_token_cookie_flags() -> None:
    response = MagicMock()
    set_refresh_token_cookie(response, "opaque-refresh-value")
    response.set_cookie.assert_called_once()
    kwargs = response.set_cookie.call_args.kwargs
    assert kwargs["key"] == settings.REFRESH_TOKEN_COOKIE_NAME
    assert kwargs["value"] == "opaque-refresh-value"
    assert kwargs["httponly"] is True
    assert kwargs["path"] == refresh_cookie_path()
    assert kwargs["max_age"] == settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
    assert kwargs["samesite"] == "lax"


def test_clear_refresh_token_cookie_matches_path() -> None:
    response = MagicMock()
    clear_refresh_token_cookie(response)
    response.delete_cookie.assert_called_once()
    kwargs = response.delete_cookie.call_args.kwargs
    assert kwargs["key"] == settings.REFRESH_TOKEN_COOKIE_NAME
    assert kwargs["path"] == refresh_cookie_path()
    assert kwargs["httponly"] is True
