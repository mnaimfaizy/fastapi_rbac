"""Confine the integration suite to the Docker/Postgres test stack.

Outside that stack every test in this package is skipped at collection, before
any fixture runs, so an unsupported run reports skips rather than the failures
and errors that made #190 unreadable. See ``test/integration_stack.py`` for the
run-mode contract.

This module is also where known-broken tests are quarantined, so the list stays
readable in one place instead of as decorators scattered across the suite.
"""

from __future__ import annotations

from pathlib import Path
from test.integration_stack import SKIP_REASON, STACK_COMMAND, stack_is_active
from typing import List

import pytest

INTEGRATION_DIR = Path(__file__).parent

# Count of tests this conftest skipped, read back by the terminal summary.
_SKIPPED_COUNT = pytest.StashKey[int]()

# Some tests mix the HTTP client with in-process state, which cannot work when
# the code under test runs in another container. That is a harness defect rather
# than an application one, tracked in #214.
QUARANTINE_REASON = (
    "fails in HTTP mode: asserts on in-process state -- the mock Redis, the "
    "runner's own database session, or an in-process event capture -- that the "
    "server under test never writes to"
)

# Node ids, relative to this package, of tests with that defect. Delete an entry
# as its test is repaired; the set should be empty when #214 closes.
QUARANTINE: frozenset[str] = frozenset(
    f"{module}::{test}"
    for module, tests in {
        "test_api_auth_allowlist.py": (
            "test_oauth2_first_login_writes_allowlist_and_logout_rejects",
            "test_json_login_writes_access_and_refresh_allowlist",
            "test_refresh_rejected_when_allowlist_empty",
        ),
        "test_api_auth_comprehensive.py": (
            "TestComprehensiveAuth::test_complete_registration_and_login_flow",
            "TestAuthenticationEdgeCases::test_verify_email_with_expired_token",
            "TestAuthenticationEdgeCases::test_verify_email_expired_emits_typed_security_event",
            "TestAuthenticationEdgeCases::test_refresh_token_expired_emits_typed_security_event",
        ),
    }.items()
    for test in tests
)


def _in_integration_suite(item: pytest.Item) -> bool:
    """Return True for items collected from this package.

    ``pytest_collection_modifyitems`` hands every conftest the whole session's
    items, so a run of ``pytest test/`` would otherwise skip the unit suite too.
    """
    path = getattr(item, "path", None)
    if path is None:  # pragma: no cover - pytest >= 7 always sets .path
        return False
    return INTEGRATION_DIR == path.parent or INTEGRATION_DIR in path.parents


def _quarantine_key(item: pytest.Item) -> str:
    """Node id relative to this package, so the table above stays readable."""
    return item.nodeid.split("test/integration/", 1)[-1]


def pytest_collection_modifyitems(config: pytest.Config, items: List[pytest.Item]) -> None:
    suite = [item for item in items if _in_integration_suite(item)]

    if not stack_is_active():
        skip_outside_stack = pytest.mark.skip(reason=SKIP_REASON)
        for item in suite:
            item.add_marker(skip_outside_stack)
        config.stash[_SKIPPED_COUNT] = len(suite)
        return

    xfail_known_broken = pytest.mark.xfail(reason=QUARANTINE_REASON, strict=False)
    for item in suite:
        if _quarantine_key(item) in QUARANTINE:
            item.add_marker(xfail_known_broken)


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
