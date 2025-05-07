import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    """Test health check endpoint is working properly"""
    response = await client.get(f"{settings.API_V1_STR}/health/")

    # Response should be successful
    assert response.status_code == 200

    # Check response content
    data = response.json()
    assert "status" in data
    # The status could be "healthy" or "unhealthy" depending on the environment
    assert data["status"] in ["healthy", "unhealthy"]
    assert "environment" in data
    # Check that other health check components are present
    assert "api" in data
    assert "database" in data
    assert "redis" in data
    assert "background_tasks" in data
