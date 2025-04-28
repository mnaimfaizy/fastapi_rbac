import random
import string
from typing import Dict, Optional

from fastapi.testclient import TestClient

from app.core.config import settings


def random_lower_string(length: int = 32) -> str:
    """Generate a random lowercase string."""
    return "".join(random.choices(string.ascii_lowercase, k=length))


def random_email() -> str:
    """Generate a random email."""
    return f"{random_lower_string(8)}@{random_lower_string(6)}.com"


def random_uuid_str() -> str:
    """Generate a random UUID string format."""
    return f"{random_lower_string(8)}-{random_lower_string(4)}-{random_lower_string(4)}-{random_lower_string(4)}-{random_lower_string(12)}"


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
