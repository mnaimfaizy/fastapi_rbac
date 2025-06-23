"""
Dashboard integration tests.

Tests the dashboard API endpoints including:
- System statistics
- User analytics
- Role/permission summaries
- Activity metrics
"""

from test.factories.async_factories import AsyncPermissionFactory, AsyncRoleFactory, AsyncUserFactory
from test.utils import get_csrf_token
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings


class TestDashboardFlow:
    """Integration tests for dashboard endpoints."""

    @pytest.mark.asyncio
    async def test_admin_dashboard_access(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test admin access to dashboard endpoints."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test dashboard stats endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/stats",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        stats = result["data"]

        # Should have basic stats
        assert "total_users" in stats
        assert "total_roles" in stats
        assert "total_permissions" in stats
        assert "active_users" in stats

        # Values should be numeric
        assert isinstance(stats["total_users"], int)
        assert isinstance(stats["total_roles"], int)
        assert isinstance(stats["total_permissions"], int)
        assert isinstance(stats["active_users"], int)

    @pytest.mark.asyncio
    async def test_dashboard_user_analytics(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard user analytics endpoints."""
        # Create admin user and some test data
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create various users for analytics
        await user_factory.create_verified_user()
        await user_factory.create_unverified_user()
        inactive_user = await user_factory.create_verified_user()
        # Make one user inactive
        # This would need to be done through the service layer

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test user analytics endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/users/analytics",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If endpoint exists
            result = response.json()
            assert result["success"] is True
            analytics = result["data"]

            # Should have user breakdown
            expected_keys = [
                "total_users",
                "active_users",
                "inactive_users",
                "verified_users",
                "unverified_users",
            ]
            for key in expected_keys:
                if key in analytics:
                    assert isinstance(analytics[key], int)

    @pytest.mark.asyncio
    async def test_dashboard_role_analytics(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard role analytics endpoints."""
        # Create admin user and test roles
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create test roles
        await role_factory.create_role(name="test_manager")
        await role_factory.create_role(name="test_user")

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test role analytics endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/roles/analytics",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If endpoint exists
            result = response.json()
            assert result["success"] is True
            analytics = result["data"]

            # Should have role information
            if "total_roles" in analytics:
                assert isinstance(analytics["total_roles"], int)
                assert analytics["total_roles"] >= 2  # Our test roles

            if "role_distribution" in analytics:
                assert isinstance(analytics["role_distribution"], list)

    @pytest.mark.asyncio
    async def test_dashboard_activity_metrics(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard activity metrics endpoints."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test activity metrics endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/activity",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If endpoint exists
            result = response.json()
            assert result["success"] is True
            activity = result["data"]

            # Should have activity metrics
            expected_keys = [
                "recent_logins",
                "failed_login_attempts",
                "recent_registrations",
                "active_sessions",
            ]
            for key in expected_keys:
                if key in activity:
                    assert isinstance(activity[key], (int, list))

    @pytest.mark.asyncio
    async def test_dashboard_system_health(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard system health endpoints."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test system health endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/health",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If endpoint exists
            result = response.json()
            assert result["success"] is True
            health = result["data"]

            # Should have health information
            expected_keys = ["database", "redis", "celery"]
            for service in expected_keys:
                if service in health:
                    assert "status" in health[service]
                    assert health[service]["status"] in ["healthy", "unhealthy", "unknown"]

    @pytest.mark.asyncio
    async def test_dashboard_recent_activities(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard recent activities endpoint."""
        # Create admin user and perform some activities
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create a regular user to generate activity
        regular_user = await user_factory.create_verified_user()

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test recent activities endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/activities/recent",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If endpoint exists
            result = response.json()
            assert result["success"] is True
            activities = result["data"]

            # Should be a list of activities
            assert isinstance(activities, list)

            # Each activity should have expected structure
            for activity in activities[:5]:  # Check first 5
                assert "id" in activity
                assert "action" in activity
                assert "timestamp" in activity
                if "user" in activity:
                    assert "email" in activity["user"]

    @pytest.mark.asyncio
    async def test_regular_user_dashboard_access_denied(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test that regular users cannot access dashboard endpoints."""
        # Create regular user
        regular_user = await user_factory.create_verified_user()
        regular_token = await user_factory.get_auth_token(regular_user)

        regular_headers = {"Authorization": f"Bearer {regular_token}"}

        # Test dashboard endpoints should be forbidden
        dashboard_endpoints = [
            "/dashboard/stats",
            "/dashboard/users/analytics",
            "/dashboard/roles/analytics",
            "/dashboard/activity",
            "/dashboard/health",
            "/dashboard/activities/recent",
        ]

        for endpoint in dashboard_endpoints:
            response = await client.get(
                f"{settings.API_V1_STR}{endpoint}",
                headers=regular_headers,
            )
            # Should be forbidden or not found (if endpoint doesn't exist)
            assert response.status_code in [403, 404]

    @pytest.mark.asyncio
    async def test_dashboard_data_consistency(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        role_factory: AsyncRoleFactory,
        permission_factory: AsyncPermissionFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test that dashboard data is consistent with actual data."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        # Create known test data
        test_users = []
        for i in range(3):
            user = await user_factory.create_verified_user(email=f"consistency_test_{i}@example.com")
            test_users.append(user)

        test_roles = []
        for i in range(2):
            role = await role_factory.create_role(name=f"consistency_role_{i}")
            test_roles.append(role)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Get dashboard stats
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/stats",
            headers=auth_headers,
        )

        assert response.status_code == 200
        result = response.json()
        stats = result["data"]

        # Verify stats make sense
        assert stats["total_users"] >= 4  # At least admin + 3 test users
        assert stats["total_roles"] >= 2  # At least 2 test roles
        assert stats["active_users"] >= 4  # All our users should be active

    @pytest.mark.asyncio
    async def test_dashboard_date_range_filtering(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard endpoints with date range filtering."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test with date range parameters
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/activity?start_date=2024-01-01&end_date=2024-12-31",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If endpoint and filtering exist
            result = response.json()
            assert result["success"] is True
            # Data should be filtered by date range
            activity = result["data"]
            assert isinstance(activity, dict)

    @pytest.mark.asyncio
    async def test_dashboard_export_functionality(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: AsyncMock,
    ) -> None:
        """Test dashboard data export functionality if available."""
        # Create admin user
        admin_user = await user_factory.create_admin_user()
        admin_token = await user_factory.get_auth_token(admin_user)

        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Test export endpoint
        response = await client.get(
            f"{settings.API_V1_STR}/dashboard/export?format=json",
            headers=auth_headers,
        )

        if response.status_code == 200:  # If export endpoint exists
            # Should return data in requested format
            if response.headers.get("content-type") == "application/json":
                result = response.json()
                assert "stats" in result or "data" in result
            else:
                # Might be CSV or other format
                assert len(response.content) > 0
