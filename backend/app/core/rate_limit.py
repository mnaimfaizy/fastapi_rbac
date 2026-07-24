"""Shared slowapi HTTP rate limiter for the FastAPI app.

HTTP rate limits use this single Limiter instance (app.state + route decorators).
Abuse counters (hand-rolled Redis incr/expire in auth) are separate.
"""

from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import ModeEnum, settings
from app.core.service_config import service_settings


def _is_testing() -> bool:
    return (
        os.environ.get("MODE") == "testing" or settings.MODE == ModeEnum.testing or settings.MODE == "testing"
    )


def _storage_uri() -> str:
    """Memory in testing; Redis (service_settings.redis_url) otherwise."""
    if _is_testing():
        return "memory://"
    return service_settings.redis_url


def create_limiter() -> Limiter:
    limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri())
    if _is_testing():
        limiter.enabled = False
    return limiter


limiter = create_limiter()
