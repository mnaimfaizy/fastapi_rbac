import pytest
from httpx import ASGITransport, AsyncClient

from app.main import fastapi_app


@pytest.mark.asyncio
async def test_docs_include_csrf_request_interceptor() -> None:
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/docs")

    assert response.status_code == 200
    assert "requestInterceptor" in response.text
    assert "/api/v1/auth/csrf-token" in response.text
    assert "X-CSRF-Token" in response.text
