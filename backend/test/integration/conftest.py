"""Confine the integration suite to the Docker/Postgres test stack.

Outside that stack every test in this package is skipped at collection, before
any fixture runs, so an unsupported run reports skips rather than the failures
and errors that made #190 unreadable. See ``test/integration_stack.py`` for the
run-mode contract.
"""

from __future__ import annotations

from pathlib import Path
from test.integration_stack import SKIP_REASON, STACK_COMMAND, stack_is_active
from typing import AsyncGenerator, List

import pytest
import pytest_asyncio
from redis.asyncio import Redis

from app.utils.redis_connection import RedisConnectionFactory

INTEGRATION_DIR = Path(__file__).parent

# Count of tests this conftest skipped, read back by the terminal summary.
_SKIPPED_COUNT = pytest.StashKey[int]()


def _in_integration_suite(item: pytest.Item) -> bool:
    """Return True for items collected from this package.

    ``pytest_collection_modifyitems`` hands every conftest the whole session's
    items, so a run of ``pytest test/`` would otherwise skip the unit suite too.
    """
    path = getattr(item, "path", None)
    if path is None:  # pragma: no cover - pytest >= 7 always sets .path
        return False
    return INTEGRATION_DIR == path.parent or INTEGRATION_DIR in path.parents


def pytest_collection_modifyitems(config: pytest.Config, items: List[pytest.Item]) -> None:
    suite = [item for item in items if _in_integration_suite(item)]

    if not stack_is_active():
        skip_outside_stack = pytest.mark.skip(reason=SKIP_REASON)
        for item in suite:
            item.add_marker(skip_outside_stack)
        config.stash[_SKIPPED_COUNT] = len(suite)


def pytest_terminal_summary(terminalreporter: pytest.TerminalReporter, exitstatus: int) -> None:
    skipped = terminalreporter.config.stash.get(_SKIPPED_COUNT, 0)
    if not skipped:
        return

    write = terminalreporter.write_line
    terminalreporter.write_sep("=", "integration suite skipped", yellow=True, bold=True)
    write(
        f"Skipped all {skipped} integration tests: the Docker/Postgres test stack is not "
        "running for this session."
    )
    write(
        "This suite drives a live server against Postgres and has no supported in-process "
        "mode, so it is skipped rather than run against SQLite."
    )
    write("")
    write("Start the stack and run the suite with:")
    write("")
    write(f"    {STACK_COMMAND}")
    write("")


@pytest_asyncio.fixture
async def server_redis() -> AsyncGenerator[Redis, None]:
    """Redis the application container writes its allowlist to.

    The runner and the server share ``fastapi_rbac_redis_test``. ``redis_mock``
    is an in-process ``MockRedisClient`` the server never sees (#214).
    """
    client = await RedisConnectionFactory.get_client()
    yield client
