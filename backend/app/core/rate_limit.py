"""Shared slowapi HTTP rate limiter for the FastAPI app.

HTTP rate limits use this single Limiter instance (app.state + route decorators).
Abuse counters (hand-rolled Redis incr/expire in auth) are separate.
"""

from __future__ import annotations

import os

from slowapi import Limiter
from starlette.requests import Request

from app.core.config import ModeEnum, settings
from app.core.service_config import service_settings
from app.utils.client_address import get_client_ip

#: Bucket for a request whose peer the ASGI server did not report. Rare enough
#: to share, and never reachable through the proxy.
UNKNOWN_CLIENT_KEY = "unknown"


def client_address_key(request: Request) -> str:
    """Key a rate limit on the real client address.

    Deliberately not slowapi's ``get_remote_address``: rate limiting, the audit
    trail, and origin-network detection read the client address through the one
    reader corrected by ``ProxyHeadersMiddleware`` (#203), so they cannot drift
    into separate notions of who a request came from.
    """
    return get_client_ip(request) or UNKNOWN_CLIENT_KEY


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
    limiter = Limiter(key_func=client_address_key, storage_uri=_storage_uri())
    if _is_testing():
        limiter.enabled = False
    return limiter


limiter = create_limiter()
