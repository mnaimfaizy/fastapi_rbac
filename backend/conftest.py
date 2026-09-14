"""
Root conftest.py to help pytest discover the app module.
This file adds the current directory to the Python path.
"""

import os
import sys

# Must run before pytest_plugins import app.main (via fixtures_app).
os.environ["MODE"] = "testing"

# Add the project root directory to Python's path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from test.venv_drift import fail_on_drift  # noqa: E402  (needs the sys.path above)

# Refuse to run against a virtualenv that has drifted from requirements.txt: a
# stale venv makes environment artifacts look like application defects (#190,
# #200). This runs here, in the module body, rather than from a pytest hook,
# because pytest imports the pytest_plugins below -- and with them app.main and
# every drifted package -- before the first hook fires. Set
# SKIP_DEPENDENCY_DRIFT_CHECK=1 to run deliberately off-pin.
fail_on_drift()

"""
Global pytest configuration for the FastAPI RBAC backend project.

This module sets up fixtures and configuration for all backend test modules.
"""

# Register fixture modules - support both original and improved fixtures
pytest_plugins = [
    # Original fixtures
    "test.fixtures.fixtures_db",
    "test.fixtures.fixtures_redis",
    "test.fixtures.fixtures_app",
    "test.fixtures.fixtures_auth",
    "test.fixtures.fixtures_service_mocks",
    "test.fixtures.fixtures_dependency_mocks",
    "test.fixtures.fixtures_factories",
    "test.fixtures.fixtures_token",
    # Improved async fixtures
    "test.fixtures.async_factory_fixtures",
    # Enhanced service mocks for integration testing
    "test.fixtures.enhanced_service_mocks",
]
