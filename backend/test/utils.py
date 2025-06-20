import random
import string
from typing import Dict, Tuple

from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.core.config import settings


def random_lower_string(length: int = 32) -> str:
    """Generate a random lowercase string."""
    return "".join(random.choices(string.ascii_lowercase, k=length))


def random_email() -> str:
    """Generate a random email."""
    return f"{random_lower_string(8)}@{random_lower_string(6)}.com"


def random_uuid_str() -> str:
    """Generate a random UUID string format."""
    return (
        f"{random_lower_string(8)}-{random_lower_string(4)}-"
        f"{random_lower_string(4)}-{random_lower_string(4)}-"
        f"{random_lower_string(12)}"
    )


def get_superuser_token_headers(client: TestClient) -> Dict[str, str]:
    """
    Get a superuser token for testing.
    This is a synchronous version for tests that don't use async client.
    """
    login_data = {
        "username": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", json=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}
    return headers


# CSRF Token Utilities for Testing
async def get_csrf_token(client: AsyncClient) -> Tuple[str, Dict[str, str]]:
    """
    Get CSRF token and return both the token and the headers needed for requests.

    Returns:
        Tuple of (csrf_token, headers_dict) where headers_dict contains the X-CSRF-Token header
    """
    # Get CSRF token
    csrf_response = await client.get(f"{settings.API_V1_STR}/auth/csrf-token")

    if csrf_response.status_code != 200:
        raise Exception(f"Failed to get CSRF token: {csrf_response.status_code} - {csrf_response.text}")

    csrf_data = csrf_response.json()
    csrf_token = csrf_data.get("data", {}).get("csrf_token")

    if not csrf_token:
        raise Exception(f"CSRF token not found in response: {csrf_data}")

    # The cookie is automatically set by the CSRF endpoint response
    # We just need to include the X-CSRF-Token header in subsequent requests
    headers = {"X-CSRF-Token": csrf_token}

    return csrf_token, headers


async def register_user_with_csrf(
    client: AsyncClient, user_data: Dict[str, str]
) -> Tuple[int, Dict[str, str]]:
    """
    Register a user with proper CSRF token handling.

    Args:
        client: AsyncClient instance
        user_data: User registration data

    Returns:
        Tuple of (status_code, response_json)
    """
    csrf_token, headers = await get_csrf_token(client)

    response = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json=user_data,
        headers=headers,
    )

    try:
        response_json = response.json()
    except Exception:
        response_json = {"error": f"Failed to parse JSON response: {response.text}"}

    return response.status_code, response_json


async def login_user_with_csrf(
    client: AsyncClient, username: str, password: str
) -> Tuple[int, Dict[str, str]]:
    """
    Login a user with proper CSRF token handling.

    Args:
        client: AsyncClient instance
        username: User email/username
        password: User password

    Returns:
        Tuple of (status_code, response_json)
    """
    csrf_token, headers = await get_csrf_token(client)

    # Add form content type header
    headers["Content-Type"] = "application/x-www-form-urlencoded"

    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": username, "password": password},
        headers=headers,
    )

    return response.status_code, response.json()
