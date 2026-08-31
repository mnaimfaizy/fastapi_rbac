"""Detect whether the Docker/Postgres integration stack is the current run target.

The integration suite is Postgres-only and drives a live server over HTTP. It has
no supported in-process mode: outside the stack it used to collect, run against a
throwaway SQLite database, and fail non-deterministically (table visibility,
email collisions, ``database is locked``) in ways indistinguishable from a real
regression. That is how #190 came to be filed against application code that was
healthy. The decision taken there is that the suite skips loudly outside the
stack rather than producing failures nobody can interpret.

The run-mode signal is the environment contract the test compose files already
set on their test-runner service: ``USE_HTTP_TEST_CLIENT`` /
``TEST_API_BASE_URL``. ``test/fixtures/fixtures_app.py`` selects its HTTP client
from :func:`stack_is_active` as well, so "inside the stack" has one definition
rather than two that can drift apart.
"""

from __future__ import annotations

import os

#: Compose file that brings up the smallest stack the suite can run against.
COMPOSE_FILE = "docker-compose.test.minimal.yml"

#: Service whose exit code is the suite's exit code.
RUNNER_SERVICE = "fastapi_rbac_test_runner"

#: Copy-pasteable command that starts the stack and runs the suite in it. The
#: leading ``down -v`` is not optional. ``up`` reuses an exited runner container
#: from a previous run and reports its stale exit code without running anything,
#: and the suite assumes an empty database -- rows left behind by an earlier run
#: push a later one's own rows off the first page of paginated list endpoints.
STACK_COMMAND = (
    f"cd backend && docker compose -f {COMPOSE_FILE} down -v && "
    f"docker compose -f {COMPOSE_FILE} up --build "
    f"--exit-code-from {RUNNER_SERVICE} {RUNNER_SERVICE}"
)


def stack_is_active() -> bool:
    """Return True when this run targets the Docker/Postgres integration stack.

    Mirrors the contract set by the ``fastapi_rbac_test_runner`` service in
    ``docker-compose.test.minimal.yml`` and ``docker-compose.test.yml``.
    """
    return os.getenv("USE_HTTP_TEST_CLIENT", "0") == "1" or bool(os.getenv("TEST_API_BASE_URL"))


#: Reason attached to every skipped integration test. Names the run mode and the
#: command, so a skip in a bare test log is self-explanatory.
SKIP_REASON = (
    "integration tests run only against the Docker/Postgres test stack; "
    "neither USE_HTTP_TEST_CLIENT nor TEST_API_BASE_URL is set. "
    f"Start the stack and run the suite with: {STACK_COMMAND}"
)
