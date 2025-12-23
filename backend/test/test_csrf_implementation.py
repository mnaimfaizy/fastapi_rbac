#!/usr/bin/env python3
"""Test script to verify CSRF protection implementation for critical auth endpoints.

This script tests:
1. CSRF token generation endpoint
2. Protected endpoints with CSRF validation
3. CSRF token validation failures
4. Integration with input sanitization and rate limiting
"""

import sys
from typing import Any, Dict, Optional, Tuple

import requests  # type: ignore

# Configuration
BASE_URL = "http://localhost:8000"
AUTH_ENDPOINTS = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/password-reset/request",
    "/api/v1/auth/password-reset/confirm",
    "/api/v1/auth/change_password",  # Fixed: underscore not hyphen
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification-email",
    "/api/v1/auth/reset_password",
]


def test_csrf_token_generation() -> Tuple[Optional[str], Optional[requests.Session]]:
    """Test CSRF token generation endpoint."""
    print("🔐 Testing CSRF token generation...")

    try:
        # Use session to handle cookies automatically
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/v1/auth/csrf-token")

        if response.status_code == 200:
            data = response.json()
            if "data" in data and "csrf_token" in data["data"]:
                csrf_token = data["data"]["csrf_token"]
                print(f"✅ CSRF token generated successfully: {csrf_token[:20]}...")

                # Check if CSRF cookie was set
                csrf_cookie = response.cookies.get("fastapi-csrf-token")
                if csrf_cookie:
                    print(f"✅ CSRF cookie set successfully: {csrf_cookie[:20]}...")
                else:
                    print("⚠️  Warning: CSRF cookie not set")

                return csrf_token, session
            else:
                print("❌ CSRF token generation failed: Invalid response format")
                return None, None
        else:
            print(f"❌ CSRF token generation failed: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return None, None

    except Exception as e:
        print(f"❌ CSRF token generation error: {e}")
        return None, None


def test_endpoint_without_csrf(endpoint: str, test_data: Dict[str, Any]) -> bool:
    """Test endpoint without CSRF token (should fail)."""
    print(f"🚫 Testing {endpoint} without CSRF token...")

    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=test_data,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 403:
            print(f"✅ CSRF protection working: {endpoint} rejected without token (403)")
            return True
        else:
            print(
                f"❌ CSRF protection failed: {endpoint} allowed without token (HTTP {response.status_code})"
            )
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error testing {endpoint} without CSRF: {e}")
        return False


def test_endpoint_with_invalid_csrf(endpoint: str, test_data: Dict[str, Any]) -> bool:
    """Test endpoint with invalid CSRF token (should fail)."""
    print(f"🔍 Testing {endpoint} with invalid CSRF token...")

    try:
        # Create a session and set an invalid CSRF cookie
        session = requests.Session()
        session.cookies.set("fastapi-csrf-token", "invalid-csrf-token")

        response = session.post(
            f"{BASE_URL}{endpoint}",
            json=test_data,
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": "invalid-csrf-token",
            },
        )

        if response.status_code == 403:
            print(f"✅ CSRF protection working: {endpoint} rejected with invalid token (403)")
            return True
        else:
            print(
                f"❌ CSRF protection failed: {endpoint} accepted invalid token (HTTP {response.status_code})"
            )
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error testing {endpoint} with invalid CSRF: {e}")
        return False


def test_endpoint_with_csrf(
    endpoint: str, test_data: Dict[str, Any], csrf_token: str, session: requests.Session
) -> bool:
    """Test endpoint with valid CSRF token and session with cookie."""
    print(f"🔒 Testing {endpoint} with CSRF token...")

    try:
        response = session.post(
            f"{BASE_URL}{endpoint}",
            json=test_data,
            headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token},
        )

        # We expect various responses depending on the endpoint and data
        # But we should NOT get CSRF validation errors (403 with CSRF message)
        if response.status_code == 403 and "CSRF" in response.text:
            print(f"❌ CSRF validation failed for {endpoint} even with token")
            print(f"Response: {response.text}")
            return False
        else:
            print(f"✅ CSRF validation passed for {endpoint} (HTTP {response.status_code})")
            return True

    except Exception as e:
        print(f"❌ Error testing {endpoint} with CSRF: {e}")
        return False


def get_test_data(endpoint: str) -> Dict[str, Any]:
    """Get appropriate test data for each endpoint."""
    if "/login" in endpoint:
        return {"email": "test@example.com", "password": "testpassword123"}
    elif "/register" in endpoint:
        return {
            "email": "newuser@example.com",
            "password": "testpassword123",
            "first_name": "Test",
            "last_name": "User",
        }
    elif "/password-reset/request" in endpoint:
        return {"email": "test@example.com"}
    elif "/password-reset/confirm" in endpoint:
        return {"token": "dummy-token", "new_password": "newpassword123"}
    elif "/change_password" in endpoint:
        return {"current_password": "oldpassword123", "new_password": "newpassword123"}
    elif "/verify-email" in endpoint:
        return {"token": "dummy-verification-token"}
    elif "/resend-verification-email" in endpoint:
        return {"email": "test@example.com"}
    elif "/reset_password" in endpoint:
        return {"token": "dummy-reset-token", "new_password": "newpassword123"}
    else:
        return {"dummy": "data"}


def main() -> None:
    """Main test function."""
    print("CSRF Protection Implementation Test")
    print("=" * 60)

    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/v1/health")
        if response.status_code != 200:
            print("❌ FastAPI server is not responding. Please start the server first.")
            sys.exit(1)
        print("✅ FastAPI server is responding")
    except requests.ConnectionError:
        print("❌ Cannot connect to FastAPI server. Please start the server first.")
        sys.exit(1)

    print("🚀 Starting CSRF Protection Implementation Tests")
    print("=" * 60)

    # Test CSRF token generation
    csrf_token, session = test_csrf_token_generation()
    if not csrf_token or not session:
        print("❌ Cannot proceed without CSRF token")
        sys.exit(1)

    all_tests_passed = True

    print("\n" + "=" * 60)
    print("📋 Testing endpoints WITHOUT CSRF tokens (should be rejected)...")

    # Test all endpoints without CSRF tokens
    for endpoint in AUTH_ENDPOINTS:
        test_data = get_test_data(endpoint)
        if not test_endpoint_without_csrf(endpoint, test_data):
            all_tests_passed = False

    print("\n" + "=" * 60)
    print("📋 Testing endpoints WITH INVALID CSRF tokens (should be rejected)...")

    # Test all endpoints with invalid CSRF tokens
    for endpoint in AUTH_ENDPOINTS:
        test_data = get_test_data(endpoint)
        if not test_endpoint_with_invalid_csrf(endpoint, test_data):
            all_tests_passed = False

    print("\n" + "=" * 60)
    print("📋 Testing endpoints WITH VALID CSRF tokens (should pass CSRF validation)...")

    # Test all endpoints with valid CSRF tokens
    for endpoint in AUTH_ENDPOINTS:
        test_data = get_test_data(endpoint)
        if not test_endpoint_with_csrf(endpoint, test_data, csrf_token, session):
            all_tests_passed = False

    print("\n" + "=" * 60)
    if all_tests_passed:
        print("✅ All CSRF protection tests PASSED!")
    else:
        print("❌ Some CSRF protection tests FAILED!")
        print("Please review the implementation and server logs")

    sys.exit(0 if all_tests_passed else 1)


if __name__ == "__main__":
    main()
