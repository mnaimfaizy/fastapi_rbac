"""
External API mocks for testing.
"""

from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock


class MockHTTPResponse:
    """Mock HTTP response for testing."""

    def __init__(
        self,
        status_code: int = 200,
        json_data: Optional[Dict[str, Any]] = None,
        text: str = "",
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text
        self.headers = headers or {}

    def json(self) -> Dict[str, Any]:
        """Return JSON data."""
        return self._json_data

    def raise_for_status(self) -> None:
        """Raise exception for bad status codes."""
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code} Error")


class MockHTTPClient:
    """Mock HTTP client for testing external API calls."""

    def __init__(self) -> None:
        self.requests: List[Dict[str, Any]] = []
        self.default_response = MockHTTPResponse()
        self.response_map: Dict[str, MockHTTPResponse] = {}

        # Mock methods
        self.get = AsyncMock(side_effect=self._make_request)
        self.post = AsyncMock(side_effect=self._make_request)
        self.put = AsyncMock(side_effect=self._make_request)
        self.patch = AsyncMock(side_effect=self._make_request)
        self.delete = AsyncMock(side_effect=self._make_request)

    async def _make_request(self, url: str, method: str = "GET", **kwargs: Any) -> MockHTTPResponse:
        """Mock HTTP request."""
        request_data = {"method": method, "url": url, "kwargs": kwargs}
        self.requests.append(request_data)

        # Return mapped response if exists
        key = f"{method.upper()} {url}"
        if key in self.response_map:
            return self.response_map[key]

        return self.default_response

    def set_response(self, method: str, url: str, response: MockHTTPResponse) -> None:
        """Set a specific response for method and URL."""
        key = f"{method.upper()} {url}"
        self.response_map[key] = response

    def clear_requests(self) -> None:
        """Clear request history."""
        self.requests.clear()

    def get_requests(self, method: Optional[str] = None, url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get requests, optionally filtered by method or URL."""
        requests = self.requests
        if method:
            requests = [r for r in requests if r["method"].upper() == method.upper()]
        if url:
            requests = [r for r in requests if url in r["url"]]
        return requests


class MockOAuthProvider:
    """Mock OAuth provider for testing OAuth flows."""

    def __init__(self) -> None:
        self.authorization_codes: Dict[str, Dict[str, Any]] = {}
        self.access_tokens: Dict[str, Dict[str, Any]] = {}
        self.user_info: Dict[str, Dict[str, Any]] = {}

    def generate_authorization_url(
        self, client_id: str, redirect_uri: str, state: Optional[str] = None
    ) -> str:
        """Generate mock authorization URL."""
        return (
            f"https://oauth.example.com/authorize?client_id={client_id}"
            f"&redirect_uri={redirect_uri}&state={state}"
        )

    def exchange_code_for_token(
        self, code: str, client_id: str, client_secret: str, redirect_uri: str
    ) -> Dict[str, Any]:
        """Mock token exchange."""
        if code not in self.authorization_codes:
            raise ValueError("Invalid authorization code")

        token_data = {
            "access_token": f"access_token_{code}",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": f"refresh_token_{code}",
        }
        self.access_tokens[str(token_data["access_token"])] = {
            "code": code,
            "client_id": client_id,
            "expires_in": token_data["expires_in"],
        }
        return token_data

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Mock user info retrieval."""
        if access_token not in self.access_tokens:
            raise ValueError("Invalid access token")

        return self.user_info.get(
            access_token, {"id": "mock_user_id", "email": "mock@example.com", "name": "Mock User"}
        )

    def set_user_info(self, access_token: str, user_data: Dict[str, Any]) -> None:
        """Set user info for a token."""
        self.user_info[access_token] = user_data

    def add_authorization_code(self, code: str, user_data: Dict[str, Any]) -> None:
        """Add authorization code."""
        self.authorization_codes[code] = user_data
