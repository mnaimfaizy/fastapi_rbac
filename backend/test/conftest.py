"""
Global pytest configuration for the FastAPI RBAC project.

This module sets up fixtures and configuration for all test modules.
"""

import os

# Set testing mode
os.environ["MODE"] = "testing"

# Register fixture modules - support both originasl and improved fixtures
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
]
