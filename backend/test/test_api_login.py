import pytest
from httpx import AsyncClient

from app.core.config import settings

from .utils import random_email


@pytest.mark.asyncio
async def test_get_access_token(client: AsyncClient) -> None:
    """Test login endpoint to get access token with superuser credentials"""
    login_data = {
        "username": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    response = await client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)

    # Check response
    assert response.status_code == 200
    tokens = response.json()
    assert "access_token" in tokens
    assert tokens["access_token"]
    assert "token_type" in tokens
    assert tokens["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_access_token_incorrect_password(client: AsyncClient) -> None:
    """Test login with incorrect password"""
    login_data = {
        "username": settings.FIRST_SUPERUSER_EMAIL,
        "password": "wrong-password",
    }
    response = await client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)

    # Should return 400 Bad Request for incorrect credentials
    assert response.status_code == 400
    response_json = response.json()
    assert "errors" in response_json
    assert len(response_json["errors"]) > 0
    assert "field" in response_json["errors"][0]
    assert response_json["errors"][0]["field"] == "username"


@pytest.mark.asyncio
async def test_get_access_token_nonexistent_user(client: AsyncClient) -> None:
    """Test login with non-existent user"""
    login_data = {
        "username": f"nonexistent-{random_email()}",
        "password": "password123",
    }
    response = await client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)

    # Should return 400 Bad Request for non-existent user
    assert response.status_code == 400
    response_json = response.json()
    assert "errors" in response_json
    assert len(response_json["errors"]) > 0
    assert "field" in response_json["errors"][0]
    assert response_json["errors"][0]["field"] == "username"


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, superuser_token_headers: dict[str, str]) -> None:
    # Assuming the superuser is already logged in and has headers
    # tokens = superuser_token_headers # F841: Variable 'tokens' assigned but never used
    # refresh_token = "..."  # Placeholder: Need to extract refresh token from login response
    # For now, let's assume we have a valid refresh token somehow
    # In a real test, you'd get this from the initial login response
    # response = await client.post(
    #     f"{settings.API_V1_STR}/login/refresh-token",
    #     headers=superuser_token_headers
    # )
    # assert response.status_code == 200
    # new_tokens = response.json()
    # assert "access_token" in new_tokens
    # assert new_tokens["access_token"]
    pass  # Test needs implementation to get refresh token first


@pytest.mark.asyncio
async def test_refresh_token_invalid(client: AsyncClient) -> None:
    headers = {"Authorization": "Bearer invalidtoken"}
    response = await client.post(f"{settings.API_V1_STR}/login/refresh-token", headers=headers)
    assert response.status_code == 401  # Expect unauthorized


@pytest.mark.asyncio
async def test_test_token(client: AsyncClient, superuser_token_headers: dict[str, str]) -> None:
    response = await client.post(f"{settings.API_V1_STR}/login/test-token", headers=superuser_token_headers)
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == settings.FIRST_SUPERUSER_EMAIL
