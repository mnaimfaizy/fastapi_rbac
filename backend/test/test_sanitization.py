#!/usr/bin/env python3
"""
Test script for input sanitization functionality.
"""
from typing import Any, Dict, List

import requests  # type: ignore

# Test data with potentially malicious content
test_cases: List[Dict[str, Any]] = [
    {
        "name": "Normal login",
        "data": {"email": "admin@example.com", "password": "admin123"},
    },
    {
        "name": "XSS attempt in email",
        "data": {
            "email": "<script>alert('xss')</script>@example.com",
            "password": "admin123",
        },
    },
    {
        "name": "HTML injection in email",
        "data": {"email": "test<b>bold</b>@example.com", "password": "admin123"},
    },
    {
        "name": "Very long password (DoS test)",
        "data": {
            "email": "test@example.com",
            "password": "a" * 2000,
        },  # Very long password
    },
]

base_url = "http://localhost:8000/api/v1"


def test_login_sanitization() -> None:
    """Test login endpoint input sanitization."""
    print("Testing Login Endpoint Input Sanitization")
    print("=" * 50)

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        email_data = test_case["data"]
        if isinstance(email_data, dict) and "email" in email_data:
            print(f"Input email: {str(email_data['email'])[:50]}...")
        if isinstance(email_data, dict) and "password" in email_data:
            print(f"Password length: {len(str(email_data['password']))}")

        try:
            response = requests.post(
                f"{base_url}/auth/login",
                json=test_case["data"],
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:200]}...")

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")


def test_register_sanitization() -> None:
    """Test register endpoint input sanitization."""
    print("\n\nTesting Register Endpoint Input Sanitization")
    print("=" * 50)

    register_test = {
        "email": "<script>alert('xss')</script>@example.com",
        "password": "TestPass123!",
        "first_name": "<b>Bold Name</b>",
        "last_name": "Normal'Last\"Name",
    }

    print("Input data:")
    for key, value in register_test.items():
        print(f"  {key}: {value}")

    try:
        response = requests.post(
            f"{base_url}/auth/register",
            json=register_test,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print(f"\nStatus: {response.status_code}")
        print(f"Response: {response.text[:300]}...")

    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")


if __name__ == "__main__":
    test_login_sanitization()
    test_register_sanitization()
