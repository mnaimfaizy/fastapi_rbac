#!/usr/bin/env python3
"""
Test script for input sanitization functionality.
"""

import json

import requests

# Test data with potentially malicious content
test_cases = [
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


def test_login_sanitization():
    """Test login endpoint input sanitization."""
    print("Testing Login Endpoint Input Sanitization")
    print("=" * 50)

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print(f"Input email: {test_case['data']['email'][:50]}...")
        print(f"Password length: {len(test_case['data']['password'])}")

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


def test_register_sanitization():
    """Test register endpoint input sanitization."""
    print("\n\nTesting Register Endpoint Input Sanitization")
    print("=" * 50)

    register_test = {
        "email": "<script>alert('xss')</script>@example.com",
        "password": "TestPass123!",
        "first_name": "<b>Bold Name</b>",
        "last_name": "Normal'Last\"Name",
    }

    print(f"Input data:")
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
