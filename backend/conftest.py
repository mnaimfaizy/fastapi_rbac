"""
Root conftest.py to help pytest discover the app module.
This file adds the current directory to the Python path.
"""

import os
import sys

# Add the project root directory to Python's path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

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
