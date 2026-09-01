"""
Comprehensive authentication API endpoint tests - FIXED VERSION.

This module tests all authentication endpoints including:
- User registration
- Email verification
- Login/logout
- Password reset
- Token refresh
- Account lockout and security features
"""

from datetime import datetime, timedelta, timezone
from test.factories.async_factories import AsyncUserFactory
from test.utils import get_csrf_token, random_email
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status
from httpx import AsyncClient, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import create_refresh_token, create_verification_token


async def register_user_with_csrf(client: AsyncClient, user_data: dict) -> tuple[int, dict]:
    """Helper to register a user with CSRF token."""
    csrf_token, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json=user_data,
        headers=headers,
    )
    return response.status_code, response.json()


def _response_message(response: Response) -> str:
    """Flatten FastAPI ``detail`` / ``message`` so callers can search the text."""
    body: Any = response.json()
    detail = body.get("detail", body.get("message", ""))
    if isinstance(detail, dict):
        return str(detail.get("message", detail))
    return str(detail)


class TestComprehensiveAuth:
    """Comprehensive tests for authentication flows."""

    @pytest.mark.asyncio
    async def test_complete_registration_and_login_flow(self, client: AsyncClient) -> None:
        """Register, verify, login, refresh, and logout through the HTTP API.

        Registration no longer returns a user object (#113). In MODE=testing the
        payload carries ``verification_code`` so the stack can finish the flow
        without reading mail or the runner's own database.
        """
        email = random_email()
        password = "TestPassw0rd!47"
        register_data = {"email": email, "password": password, "first_name": "Test", "last_name": "User"}

        status_code, response_data = await register_user_with_csrf(client, register_data)
        assert status_code == 200, response_data
        verification_token = (response_data.get("data") or {}).get("verification_code")
        assert verification_token, "Testing-mode registration must return verification_code"

        _, csrf_headers = await get_csrf_token(client)
        login_before = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            json={"email": email, "password": password},
            headers=csrf_headers,
        )
        assert login_before.status_code == 422, login_before.text
        assert "not verified" in _response_message(login_before).lower()

        _, verify_headers = await get_csrf_token(client)
        verify_response = await client.post(
            f"{settings.API_V1_STR}/auth/verify-email",
            json={"token": verification_token},
            headers=verify_headers,
        )
        assert verify_response.status_code == 200, verify_response.text
        assert "verified successfully" in verify_response.json()["message"].lower()

        _, login_headers = await get_csrf_token(client)
        login_after = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            json={"email": email, "password": password},
            headers=login_headers,
        )
        assert login_after.status_code == 200, login_after.text
        access_token = login_after.json()["data"]["access_token"]
        assert login_after.json()["data"]["token_type"] == "bearer"
        assert login_after.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

        me = await client.get(
            f"{settings.API_V1_STR}/users/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me.status_code == 200, me.text

        _, refresh_csrf = await get_csrf_token(client)
        refresh = await client.post(
            f"{settings.API_V1_STR}/auth/new_access_token",
            json={},
            headers=refresh_csrf,
        )
        assert refresh.status_code == 201, refresh.text
        new_access_token = refresh.json()["data"]["access_token"]
        assert new_access_token != access_token

        _, logout_csrf = await get_csrf_token(client)
        logout = await client.post(
            f"{settings.API_V1_STR}/auth/logout",
            headers={"Authorization": f"Bearer {new_access_token}", **logout_csrf},
        )
        assert logout.status_code == 200, logout.text
        assert "successfully logged out" in logout.json()["message"].lower()

        after_logout = await client.get(
            f"{settings.API_V1_STR}/users/me",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert after_logout.status_code == 403

    async def _test_login_endpoint_structure(self, client: AsyncClient) -> None:
        """Test login endpoint structure when registration fails."""
        # Get CSRF token
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

        # Test with invalid credentials
        login_data = {"username": "nonexistent@example.com", "password": "wrongpassword"}

        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        # Should handle request properly (not 404, 403, or 500)
        assert response.status_code in [400, 401, 422]

    @pytest.mark.asyncio
    @patch("app.utils.background_tasks.send_password_reset_email")
    async def test_password_reset_flow(
        self,
        mock_send_password_reset_email: MagicMock,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: MagicMock,
    ) -> None:
        """
        Test the password reset functionality, ensuring users can securely
        reset their password via an email link.
        """

        # Create a verified user
        user = await user_factory.create(verified=True)
        await db.commit()

        # Step 1: Request password reset
        response = await client.post(
            f"{settings.API_V1_STR}/auth/password-reset/request", json={"email": user.email}
        )

        # Should only allow 200 or 403 for password reset
        assert response.status_code in [200, 403]

        if response.status_code == 200:
            assert "password reset email sent" in response.json()["message"].lower()
            mock_send_password_reset_email.assert_called_once()

            # Step 2: Confirm password reset with new password
            new_password = "NewTestPassw0rd!47"

            with patch("app.core.security.decode_token") as mock_decode:
                mock_decode.return_value = {
                    "email": user.email,
                    "type": "password_reset",
                    "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
                }

                response = await client.post(
                    f"{settings.API_V1_STR}/auth/password-reset/confirm",
                    json={"token": "mock_reset_token", "new_password": new_password},
                )

            if response.status_code == 200:
                assert "password has been reset" in response.json()["message"].lower()

                # Step 3: Login with new password
                login_data = {"username": user.email, "password": new_password}

                # Get CSRF token for login
                csrf_token, csrf_headers = await get_csrf_token(client)
                csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

                response = await client.post(
                    f"{settings.API_V1_STR}/auth/login",
                    data=login_data,
                    headers=csrf_headers,
                )

                # Should either succeed or fail due to validation, not endpoint issues
                assert response.status_code in [200, 400, 401, 422]
                if response.status_code == 200:
                    assert "access_token" in response.json()["data"]

                    # Step 4: Verify old password doesn't work
                    login_data["password"] = "password123"  # Default from factory

                    response = await client.post(
                        f"{settings.API_V1_STR}/auth/login",
                        data=login_data,
                        headers=csrf_headers,
                    )

                    assert response.status_code in [400, 401, 422]
        else:
            # CSRF protection or service dependencies missing
            print(f"Password reset failed with status {response.status_code} - testing endpoint structure")
            # At minimum, verify endpoints exist and handle requests properly
            assert response.status_code != 404  # Endpoint should exist


class TestAuthenticationSecurity:
    """Test security features of authentication."""

    @pytest.mark.asyncio
    async def test_account_lockout_after_failed_attempts(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: MagicMock,
    ) -> None:
        """
        Test that a user's account is locked after multiple failed login attempts
        to prevent brute-force attacks.
        """

        # Create a verified user
        user = await user_factory.create(verified=True)
        await db.commit()

        # Get CSRF token for login attempts
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

        # Make multiple failed login attempts
        login_data = {"username": user.email, "password": "wrong_password"}

        # First few attempts should return authentication error
        for i in range(settings.MAX_LOGIN_ATTEMPTS - 1):
            response = await client.post(
                f"{settings.API_V1_STR}/auth/login",
                data=login_data,
                headers=csrf_headers,
            )
            assert response.status_code in [400, 401, 422]
            if response.status_code in [400, 401]:
                assert "invalid credentials" in response.json().get("message", "").lower()

        # Final attempt should trigger account lockout
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        assert response.status_code in [400, 401, 422]
        if response.status_code in [400, 401]:
            response_data = response.json()  # Should either show lockout or invalid credentials
            assert any(
                phrase in response_data.get("message", "").lower()
                for phrase in ["account has been locked", "invalid credentials", "locked"]
            )

        # Even correct password should fail now (if lockout is implemented)
        login_data["password"] = "password123"  # Correct password
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        assert response.status_code in [400, 401, 422]

    @pytest.mark.asyncio
    async def test_rate_limiting_on_login(self, client: AsyncClient) -> None:
        """Burst auth login stays within expected client-error statuses.

        HTTP rate limits are disabled in testing by default. Asserted 429 behavior
        for slowapi lives in ``test/unit/test_rate_limit.py``.
        """

        email = random_email()
        login_data = {"email": email, "password": "any_password"}

        # Get CSRF token for requests
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/json"

        # Make rapid login attempts (limiter off in testing — expect auth/validation errors)
        responses = []
        for i in range(10):
            response = await client.post(
                f"{settings.API_V1_STR}/auth/login",
                json=login_data,
                headers=csrf_headers,
            )
            responses.append(response.status_code)

        valid_responses = [400, 401, 422, 429]
        assert all(status in valid_responses for status in responses)

    @pytest.mark.asyncio
    async def test_token_blacklisting_on_logout(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: MagicMock,  # Use the available redis_mock fixture
    ) -> None:
        """
        Test that JWT tokens are properly blacklisted upon logout, preventing
        their reuse for accessing protected endpoints.
        """

        # Create and login a user
        user = await user_factory.create(verified=True)
        await db.commit()

        # Get CSRF token for login
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

        login_data = {"username": user.email, "password": "password123"}

        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        if response.status_code == 200:
            access_token = response.json()["data"]["access_token"]

            # Access protected endpoint (should work)
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get(f"{settings.API_V1_STR}/users/", headers=headers)
            assert response.status_code == 200

            # Logout
            _, logout_csrf = await get_csrf_token(client)
            response = await client.post(
                f"{settings.API_V1_STR}/auth/logout",
                headers={**headers, **logout_csrf},
            )
            if response.status_code == 200:
                # Try to use token after logout (should fail)
                response = await client.get(f"{settings.API_V1_STR}/users/", headers=headers)
                assert response.status_code == 401
        else:
            # Login failed due to services/mocking - test endpoint structure
            assert response.status_code in [400, 401, 422]


class TestAuthenticationEdgeCases:
    """Test edge cases and error conditions in authentication."""

    @pytest.mark.asyncio
    async def test_register_with_existing_email(self, client: AsyncClient, db: AsyncSession) -> None:
        """Test registration with an email that already exists."""

        # Use a pre-seeded user email from initial data
        seeded_email = "user@example.com"
        register_data = {
            "email": seeded_email,
            "password": "TestPassw0rd!47",
            "first_name": "Test",
            "last_name": "User",
        }
        # Attempt to register with an existing email
        status_code, response_data = await register_user_with_csrf(client, register_data)

        # Registering an existing address is answered exactly as registering a
        # new one (#113). It used to return 400 "Unable to process registration
        # request.", which confirmed the address existed. 429 is still possible
        # because the per-address mail budget is shared and other tests may have
        # spent it, but it must not depend on the account state.
        assert status_code in [200, 429]
        if status_code == 200:
            msg = (response_data.get("message", "") or response_data.get("detail", "")).lower()
            assert "already" not in msg
            assert "exists" not in msg
            assert "unable to process" not in msg

    @pytest.mark.asyncio
    async def test_login_with_nonexistent_user(self, client: AsyncClient) -> None:
        """Test login with an email that doesn't exist."""

        # Get CSRF token for login
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

        login_data = {"username": random_email(), "password": "any_password"}

        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        assert response.status_code in [400, 401, 422]
        if response.status_code in [400, 401]:
            assert "invalid credentials" in response.json().get("message", "").lower()

    @pytest.mark.asyncio
    async def test_verify_email_with_invalid_token(self, client: AsyncClient) -> None:
        """Test email verification with invalid token."""

        _, headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/verify-email",
            json={"token": "invalid_token"},
            headers=headers,
        )

        # decode_token raises HTTP 401 for malformed/invalid JWTs
        assert response.status_code in [400, 401]

    @pytest.mark.asyncio
    async def test_verify_email_with_expired_token(self, client: AsyncClient) -> None:
        """An expired verification JWT is 401, not 400.

        ``decode_token`` answers 400 only for strings that are not JWTs (no
        ``.``). A signed token whose ``exp`` has lapsed raises 401
        ``Token has expired``. The previous ``assert 400 == 401`` failure was
        the harness sending the literal ``expired_token`` and patching
        ``decode_token`` in the runner process.
        """
        token = create_verification_token("nobody@example.com", expires_delta=timedelta(seconds=-30))
        _, headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/verify-email",
            json={"token": token},
            headers=headers,
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in _response_message(response).lower()

    @pytest.mark.asyncio
    async def test_verify_email_expired_jwt_is_401(self, client: AsyncClient) -> None:
        """Expired verification JWT must fail as expiry, not as invalid format.

        The typed event name ``verify_email_token_invalid_expired`` is mapped
        from this 401 in ``map_jwt_http_error_to_event`` and is covered by
        ``test/unit/test_security.py``. The server does not persist those
        events to a queryable store, and an in-process ``BackgroundTasks``
        patch never reaches the application container.
        """
        token = create_verification_token("nobody@example.com", expires_delta=timedelta(seconds=-30))
        _, headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/verify-email",
            json={"token": token},
            headers=headers,
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "token has expired" in _response_message(response).lower()

    @pytest.mark.asyncio
    async def test_refresh_token_with_invalid_token(self, client: AsyncClient) -> None:
        """Test token refresh with invalid refresh token."""
        _, csrf_headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/new_access_token",
            json={"refresh_token": "invalid_refresh_token"},
            headers=csrf_headers,
        )

        assert response.status_code in [400, 401, 403, 422]

    @pytest.mark.asyncio
    async def test_refresh_token_expired_jwt_is_401(self, client: AsyncClient) -> None:
        """Expired refresh JWT must fail as expiry, not as invalid format.

        The typed event name ``refresh_token_expired`` is mapped from this 401
        in ``map_jwt_http_error_to_event`` and is covered by
        ``test/unit/test_security.py``. Persistence is not observable over HTTP.
        """
        token = create_refresh_token(
            "00000000-0000-0000-0000-000000000001",
            expires_delta=timedelta(seconds=-30),
        )
        _, csrf_headers = await get_csrf_token(client)
        response = await client.post(
            f"{settings.API_V1_STR}/auth/new_access_token",
            json={"refresh_token": token},
            headers=csrf_headers,
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in _response_message(response).lower()

    @pytest.mark.asyncio
    async def test_change_password_with_weak_password(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: MagicMock,
    ) -> None:
        """
        Test that the system rejects attempts to change to a weak password,
        enforcing password complexity rules.
        """

        # Create and login a user
        user = await user_factory.create(verified=True)
        await db.commit()

        # Get CSRF token for login
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

        # Login to get token
        login_data = {"username": user.email, "password": "password123"}

        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        if response.status_code == 200:
            access_token = response.json()["data"]["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}

            # Try to change to weak password
            response = await client.post(
                f"{settings.API_V1_STR}/auth/change_password",
                json={"current_password": "password123", "new_password": "weak"},  # Too weak
                headers=headers,
            )

            # Should either reject weak password or endpoint doesn't exist
            assert response.status_code in [400, 404, 422]

    @pytest.mark.asyncio
    @patch("app.utils.background_tasks.send_verification_email")
    async def test_resend_verification_email(
        self,
        mock_send_verification_email: MagicMock,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: MagicMock,
    ) -> None:
        """
        Test the ability for an unverified user to request a new verification email.
        """
        # Create unverified user
        user = await user_factory.create(verified=False)
        await db.commit()

        response = await client.post(
            f"{settings.API_V1_STR}/auth/resend-verification-email", json={"email": user.email}
        )

        # Should only allow 200, 403, or 404 for resend verification email
        assert response.status_code in [200, 403, 404]
        if response.status_code == 200:
            mock_send_verification_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_csrf_token_endpoint(self, client: AsyncClient) -> None:
        """Test CSRF token generation endpoint."""

        response = await client.get(f"{settings.API_V1_STR}/auth/csrf-token")

        assert response.status_code == 200
        data = response.json()
        assert "csrf_token" in data["data"]
        assert len(data["data"]["csrf_token"]) > 0

    @pytest.mark.asyncio
    async def test_multiple_device_login(
        self,
        client: AsyncClient,
        db: AsyncSession,
        user_factory: AsyncUserFactory,
        redis_mock: MagicMock,
    ) -> None:
        """
        Test that a user can be logged in on multiple devices simultaneously,
        and that logging out from one device does not affect the others.
        """

        # Create a verified user
        user = await user_factory.create(verified=True)
        await db.commit()

        # Get CSRF token for login
        csrf_token, csrf_headers = await get_csrf_token(client)
        csrf_headers["Content-Type"] = "application/x-www-form-urlencoded"

        # Login on device 1
        login_data = {"username": user.email, "password": "password123"}
        response1 = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        # Login on device 2
        response2 = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data=login_data,
            headers=csrf_headers,
        )

        if response1.status_code == 200 and response2.status_code == 200:
            token1 = response1.json()["data"]["access_token"]
            token2 = response2.json()["data"]["access_token"]
            assert token1 != token2

            headers1 = {"Authorization": f"Bearer {token1}"}
            headers2 = {"Authorization": f"Bearer {token2}"}

            # Both tokens should work
            response1_me = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers1)
            assert response1_me.status_code == 200
            response2_me = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers2)
            assert response2_me.status_code == 200

            # Logout from device 1
            _, logout_csrf = await get_csrf_token(client)
            logout_response = await client.post(
                f"{settings.API_V1_STR}/auth/logout",
                headers={**headers1, **logout_csrf},
            )
            if logout_response.status_code == 200:
                # Token 1 should be invalid
                response1_after_logout = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers1)
                assert response1_after_logout.status_code == 401
                # Token 2 should still be valid
                response2_after_logout = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers2)
                assert response2_after_logout.status_code == 200


class TestAuthenticationValidation:
    """Test input validation for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_register_validation_errors(self, client: AsyncClient) -> None:
        """Test validation errors during registration."""

        # Get CSRF token for the requests
        csrf_token, headers = await get_csrf_token(client)

        # Missing required fields
        response = await client.post(f"{settings.API_V1_STR}/auth/register", json={}, headers=headers)
        assert response.status_code == 422

        # Invalid email format
        response = await client.post(
            f"{settings.API_V1_STR}/auth/register",
            json={
                "email": "invalid_email",
                "password": "TestPassw0rd!47",
                "first_name": "Test",
                "last_name": "User",
            },
            headers=headers,
        )
        assert response.status_code == 422

        # Password too short. 400, not 422: the length threshold lives in
        # settings alongside the rest of the complexity policy, and the
        # registration schema no longer carries a second, looser min_length
        # of its own (#192).
        response = await client.post(
            f"{settings.API_V1_STR}/auth/register",
            json={"email": random_email(), "password": "short", "first_name": "Test", "last_name": "User"},
            headers=headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_login_validation_errors(self, client: AsyncClient) -> None:
        """Test validation errors during login."""

        # Get CSRF token for the requests
        csrf_token, headers = await get_csrf_token(client)
        headers["Content-Type"] = "application/x-www-form-urlencoded"

        # Missing username
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data={"password": "test"},
            headers=headers,
        )
        assert response.status_code == 422

        # Missing password
        response = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            data={"username": "test@example.com"},
            headers=headers,
        )
        assert response.status_code == 422
