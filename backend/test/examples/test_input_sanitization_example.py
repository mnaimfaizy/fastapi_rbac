"""
Example script for manual input sanitization testing (not a pytest test).

This script demonstrates how to send potentially malicious input to the login and register \
endpoints to verify input sanitization.
Move or copy this file to test/examples/ if you want to keep it as a reference for manual \
or exploratory testing.
"""

from typing import Any, Dict, List

# ...existing code...

test_cases: List[Dict[str, Any]] = [
    {"name": "Normal login", "data": {"email": "admin@example.com", "password": "admin123"}},
    {
        "name": "XSS attempt in email",
        "data": {"email": "<script>alert('xss')</script>@example.com", "password": "admin123"},
    },
    {
        "name": "HTML injection in email",
        "data": {"email": "test<b>bold</b>@example.com", "password": "admin123"},
    },
    {"name": "Very long password (DoS test)", "data": {"email": "test@example.com", "password": "a" * 2000}},
]

base_url = "http://localhost:8000/api/v1"


def test_login_sanitization() -> None:
    # ...existing code...
    pass


def test_register_sanitization() -> None:
    # ...existing code...
    pass


if __name__ == "__main__":
    test_login_sanitization()
    test_register_sanitization()
