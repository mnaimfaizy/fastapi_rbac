"""
Global pytest configuration for the FastAPI RBAC project.

This module sets up fixtures and configuration for all test modules.
"""

import os

# Set testing mode
os.environ["MODE"] = "testing"
