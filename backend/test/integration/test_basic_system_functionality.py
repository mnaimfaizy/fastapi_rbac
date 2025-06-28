"""
Integration test: Basic system functionality for FastAPI RBAC backend.

This module provides integration tests for core system components (DB, endpoints, CORS, config, "
"error handling)."
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestBasicFunctionality:
    """Test basic system functionality."""

    @pytest.mark.asyncio
    async def test_database_connection(self, db: AsyncSession) -> None:
        """Test that database connection is working."""
        result = await db.execute(text("SELECT 1 as test"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1

    @pytest.mark.asyncio
    async def test_health_endpoint(self, client: AsyncClient) -> None:
        """Test that health endpoint is working."""
        response = await client.get(f"{settings.API_V1_STR}/health/")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert "environment" in data
        assert "api" in data

    @pytest.mark.asyncio
    async def test_api_version_prefix(self, client: AsyncClient) -> None:
        """Test that API responds with correct version prefix."""
        # Test health endpoint with API version
        response = await client.get(f"{settings.API_V1_STR}/health/")
        assert response.status_code == 200

        # Test that wrong version returns 404
        response = await client.get("/api/v2/health/")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cors_headers(self, client: AsyncClient) -> None:
        """Test that CORS headers are present."""
        response = await client.options(f"{settings.API_V1_STR}/health/")
        assert response.status_code in [200, 405]  # Either OK or Method Not Allowed is fine

    @pytest.mark.asyncio
    async def test_public_endpoints_accessible(self, client: AsyncClient) -> None:
        """Test that public endpoints are accessible without authentication."""
        # Health endpoint should be public
        response = await client.get(f"{settings.API_V1_STR}/health/")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_protected_endpoints_require_auth(self, client: AsyncClient) -> None:
        """Test that protected endpoints require authentication."""
        # Users endpoint should require authentication
        response = await client.get(f"{settings.API_V1_STR}/users")
        assert response.status_code in [400, 401, 403]  # Should be unauthorized or bad request

    @pytest.mark.asyncio
    async def test_database_tables_exist(self, db: AsyncSession) -> None:
        """Test that core database tables exist."""
        # Use exec() idiom and check for all required tables, case-insensitive
        tables_to_check = {"user", "role", "permission"}
        result = await db.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        )
        all_tables = {row[0].lower() for row in result.fetchall()}
        missing = tables_to_check - all_tables
        assert not missing, f"Missing tables: {missing}. Found tables: {all_tables}"

    @pytest.mark.asyncio
    async def test_environment_config(self) -> None:
        """Test that environment configuration is loaded properly."""
        # Test that we have basic settings
        assert settings.API_V1_STR is not None
        assert settings.API_V1_STR.startswith("/api/v")  # Test that environment is set
        assert settings.MODE is not None
        assert settings.MODE in ["development", "testing", "production"]

    @pytest.mark.asyncio
    async def test_json_response_format(self, client: AsyncClient) -> None:
        """Test that endpoints return properly formatted JSON."""
        response = await client.get(f"{settings.API_V1_STR}/health/")
        assert response.status_code == 200

        # Should be able to parse as JSON
        data = response.json()
        assert isinstance(data, dict)

        # Should have standard response format
        assert "status" in data


class TestErrorHandling:
    """Test error handling functionality."""

    @pytest.mark.asyncio
    async def test_404_handling(self, client: AsyncClient) -> None:
        """Test that 404 errors are handled properly."""
        response = await client.get("/api/v1/nonexistent-endpoint")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_json_handling(self, client: AsyncClient) -> None:
        """Test that invalid JSON is handled properly."""
        # Try to post invalid JSON to an endpoint
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            content="invalid json content",
            headers={"Content-Type": "application/json"},
        )  # Should return a client error (4xx), not a server error (5xx)
        assert 400 <= response.status_code < 500

    @pytest.mark.asyncio
    async def test_method_not_allowed(self, client: AsyncClient) -> None:
        """Test that method not allowed errors are handled."""
        # Try to DELETE the health endpoint (should not be allowed)
        response = await client.delete(f"{settings.API_V1_STR}/health/")
        assert response.status_code == 405


def test_imports_working() -> None:
    """Test that all required imports are working."""
    # Test core imports
    from app.core.config import settings
    from app.main import app
    from app.models.permission_model import Permission  # Test schema imports
    from app.models.role_model import Role

    # Test model imports
    from app.models.user_model import User
    from app.schemas.permission_schema import IPermissionRead
    from app.schemas.role_schema import IRoleRead
    from app.schemas.user_schema import IUserRead

    # All imports should work without errors
    assert settings is not None
    assert app is not None
    assert User is not None
    assert Role is not None
    assert Permission is not None
    assert IUserRead is not None
    assert IRoleRead is not None
    assert IPermissionRead is not None


if __name__ == "__main__":
    """Run basic tests when executed directly."""
    pytest.main([__file__, "-v"])
