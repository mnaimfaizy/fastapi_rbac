"""HttpOnly refresh-token cookie helpers for first-party SPA auth."""

from typing import Any, Literal, Optional

from fastapi import Response

from app.core.config import ModeEnum, settings

SameSite = Literal["lax", "strict", "none"]


def refresh_cookie_path() -> str:
    """Path-scope refresh cookies to auth routes only."""
    return f"{settings.API_V1_STR}/auth"


def refresh_cookie_secure() -> bool:
    """Secure cookies in production; allow plain HTTP on localhost/dev/test."""
    if settings.REFRESH_COOKIE_SECURE is not None:
        return settings.REFRESH_COOKIE_SECURE
    return settings.MODE == ModeEnum.production


def refresh_cookie_samesite() -> SameSite:
    value = (settings.REFRESH_COOKIE_SAMESITE or "lax").lower()
    if value not in ("lax", "strict", "none"):
        return "lax"
    return value  # type: ignore[return-value]


def _refresh_cookie_attrs(max_age: Optional[int] = None) -> dict[str, Any]:
    attrs: dict[str, Any] = {
        "key": settings.REFRESH_TOKEN_COOKIE_NAME,
        "httponly": True,
        "secure": refresh_cookie_secure(),
        "samesite": refresh_cookie_samesite(),
        "path": refresh_cookie_path(),
    }
    domain: Optional[str] = settings.REFRESH_COOKIE_DOMAIN
    if domain:
        attrs["domain"] = domain
    if max_age is not None:
        attrs["max_age"] = max_age
    return attrs


def set_refresh_token_cookie(
    response: Response,
    refresh_token: str,
    max_age: Optional[int] = None,
) -> None:
    """Set the HttpOnly refresh token cookie. Never log the token value."""
    if max_age is None:
        max_age = settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
    response.set_cookie(value=refresh_token, **_refresh_cookie_attrs(max_age=max_age))


def clear_refresh_token_cookie(response: Response) -> None:
    """Clear the refresh token cookie using the same attributes used when setting it."""
    response.delete_cookie(**_refresh_cookie_attrs())
