#!/usr/bin/env python3
"""
Test script to verify CSRF protection implementation for critical auth endpoints.

This script tests:
1. CSRF token generation endpoint
2. Protected endpoints with CSRF validation
3. CSRF token validation failures
4. Integration with input sanitization and rate limiting
"""

import json
import sys
import time
from typing import Any, Dict

import requests

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


def test_csrf_token_generation():
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
                print(f"❌ CSRF token generation failed: Invalid response format")
                return None, None
        else:
            print(f"❌ CSRF token generation failed: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return None, None

    except Exception as e:
        print(f"❌ CSRF token generation error: {e}")
        return None


def test_endpoint_without_csrf(endpoint: str, test_data: Dict[str, Any]):
    """Test endpoint without CSRF token (should fail)."""
    print(f"🚫 Testing {endpoint} without CSRF token...")

    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=test_data,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 403:
            print(
                f"✅ CSRF protection working: {endpoint} rejected without token (403)"
            )
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


def test_endpoint_with_csrf(endpoint: str, test_data: Dict[str, Any], csrf_token: str):
    """Test endpoint with valid CSRF token."""
    print(f"🔒 Testing {endpoint} with CSRF token...")

    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=test_data,
            headers={"Content-Type": "application/json", "X-CSRF-Token": csrf_token},
        )

        # We expect various responses depending on the endpoint and data
        # But the important thing is it's not rejected for CSRF reasons
        if response.status_code == 403 and "CSRF" in response.text:
            print(f"❌ CSRF validation failed for {endpoint} even with token")
            print(f"Response: {response.text}")
            return False
        else:
            print(
                f"✅ CSRF validation passed for {endpoint} (HTTP {response.status_code})"
            )
            # Note: We might get validation errors for the actual data, which is expected
            return True

    except Exception as e:
        print(f"❌ Error testing {endpoint} with CSRF: {e}")
        return False


def test_endpoint_with_invalid_csrf(endpoint: str, test_data: Dict[str, Any]):
    """Test endpoint with invalid CSRF token (should fail)."""
    print(f"🔍 Testing {endpoint} with invalid CSRF token...")

    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=test_data,
            headers={
                "Content-Type": "application/json",
                "X-CSRF-Token": "invalid_token_12345",
            },
        )

        if response.status_code == 403:
            print(
                f"✅ CSRF protection working: {endpoint} rejected with invalid token (403)"
            )
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


def get_test_data(endpoint: str) -> Dict[str, Any]:
    """Get appropriate test data for each endpoint."""

    if endpoint == "/api/v1/auth/login":
        return {"email": "test@example.com", "password": "testpassword123"}
    elif endpoint == "/api/v1/auth/register":
        return {
            "email": "newuser@example.com",
            "first_name": "Test",
            "last_name": "User",
            "password": "TestPassword123!",
        }
    elif endpoint == "/api/v1/auth/password-reset/request":
        return {"email": "test@example.com"}
    elif endpoint == "/api/v1/auth/password-reset/confirm":
        return {"token": "dummy_token", "new_password": "NewPassword123!"}
    elif endpoint == "/api/v1/auth/change-password":
        return {"current_password": "oldpassword", "new_password": "newpassword123"}
    elif endpoint == "/api/v1/auth/verify-email":
        return {"token": "dummy_verification_token"}
    elif endpoint == "/api/v1/auth/resend-verification-email":
        return {"email": "test@example.com"}
    elif endpoint == "/api/v1/auth/reset_password":
        return {"token": "dummy_reset_token", "new_password": "ResetPassword123!"}
    else:
        return {"test": "data"}


def main():
    """Main test execution."""
    print("🚀 Starting CSRF Protection Implementation Tests")
    print("=" * 60)

    # Test 1: CSRF Token Generation
    csrf_token = test_csrf_token_generation()
    if not csrf_token:
        print("❌ Cannot proceed without CSRF token")
        return False

    print("\n" + "=" * 60)

    # Test 2: Endpoints without CSRF protection (should fail)
    print("📋 Testing endpoints WITHOUT CSRF tokens (should be rejected)...")
    csrf_protection_working = True

    for endpoint in AUTH_ENDPOINTS:
        test_data = get_test_data(endpoint)
        if not test_endpoint_without_csrf(endpoint, test_data):
            csrf_protection_working = False
        time.sleep(0.5)  # Small delay between requests

    print("\n" + "=" * 60)

    # Test 3: Endpoints with invalid CSRF tokens (should fail)
    print("📋 Testing endpoints WITH INVALID CSRF tokens (should be rejected)...")

    for endpoint in AUTH_ENDPOINTS:
        test_data = get_test_data(endpoint)
        if not test_endpoint_with_invalid_csrf(endpoint, test_data):
            csrf_protection_working = False
        time.sleep(0.5)  # Small delay between requests

    print("\n" + "=" * 60)

    # Test 4: Endpoints with valid CSRF tokens (should pass CSRF validation)
    print(
        "📋 Testing endpoints WITH VALID CSRF tokens (should pass CSRF validation)..."
    )

    for endpoint in AUTH_ENDPOINTS:
        test_data = get_test_data(endpoint)
        if not test_endpoint_with_csrf(endpoint, test_data, csrf_token):
            csrf_protection_working = False
        time.sleep(0.5)  # Small delay between requests

    print("\n" + "=" * 60)

    # Summary
    if csrf_protection_working:
        print("🎉 All CSRF protection tests PASSED!")
        print("✅ CSRF tokens are properly generated")
        print("✅ Protected endpoints reject requests without CSRF tokens")
        print("✅ Protected endpoints reject requests with invalid CSRF tokens")
        print("✅ Protected endpoints accept requests with valid CSRF tokens")
        return True
    else:
        print("❌ Some CSRF protection tests FAILED!")
        print("Please review the implementation and server logs")
        return False


if __name__ == "__main__":
    print("CSRF Protection Implementation Test")
    print("Making sure the FastAPI server is running on localhost:8000...")
    print()

    # Quick health check
    try:
        response = requests.get(f"{BASE_URL}/api/v1/health")
        if response.status_code == 200:
            print("✅ FastAPI server is responding")
        else:
            print(f"⚠️  FastAPI server responded with status {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot connect to FastAPI server: {e}")
        print(
            "Please make sure the server is running with: uvicorn app.main:app --host 0.0.0.0 --port 8000"
        )
        sys.exit(1)

    success = main()
    sys.exit(0 if success else 1)
