# Integration test for authentication flow (refactored)
# This file should be expanded with more API flow tests as needed.
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_registration_and_login(client: AsyncClient, user_factory):
    user_data = user_factory.get_user_create_data()
    # Register
    resp = await client.post("/api/v1/auth/register", json=user_data)
    assert resp.status_code == 201
    # Login
    login_data = {"email": user_data["email"], "password": user_data["password"]}
    resp = await client.post("/api/v1/auth/login", json=login_data)
    assert resp.status_code == 200
    assert "access_token" in resp.json()
