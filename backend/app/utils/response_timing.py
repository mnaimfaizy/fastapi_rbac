"""Constant-time response helpers for endpoints that must not leak by timing.

An endpoint returning a uniform body still leaks if one branch returns sooner
than another. The registration and resend-verification endpoints previously
padded selected branches with ``asyncio.sleep(0.2)``. That approach goes stale:
the pad sits on the branches someone remembered, and a branch added later
carries no pad at all.

``response_time_floor`` instead measures the whole handler and sleeps only the
remainder, so every branch — including ones added later — leaves through the
same door.
"""

import asyncio
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from app.core.config import settings


@asynccontextmanager
async def response_time_floor(seconds: float | None = None) -> AsyncIterator[None]:
    """Ensure the wrapped block takes at least ``seconds`` to complete.

    Args:
        seconds: Minimum duration. Defaults to
            ``settings.UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS``.

    The floor is applied on the way out whether the block returns or raises, so
    an early ``HTTPException`` is not distinguishable from a slow success. A
    block that already exceeded the floor is not delayed further.
    """
    floor = settings.UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS if seconds is None else seconds
    started = time.monotonic()
    try:
        yield
    finally:
        remaining = floor - (time.monotonic() - started)
        if remaining > 0:
            await asyncio.sleep(remaining)
