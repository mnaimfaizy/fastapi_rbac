"""
Email service mocks for testing.
"""

from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock


class MockEmailService:
    """Mock implementation of email service for testing."""

    def __init__(self):
        self.sent_emails: List[Dict[str, Any]] = []
        self.send_email = AsyncMock(side_effect=self._send_email)
        self.send_verification_email = AsyncMock(side_effect=self._send_verification_email)
        self.send_password_reset_email = AsyncMock(side_effect=self._send_password_reset_email)

    async def _send_email(
        self, to: str, subject: str, body: str, template: Optional[str] = None, **kwargs
    ) -> bool:
        """Mock email sending."""
        email_data = {"to": to, "subject": subject, "body": body, "template": template, "kwargs": kwargs}
        self.sent_emails.append(email_data)
        return True

    async def _send_verification_email(
        self, email: str, verification_code: str, first_name: str = "", **kwargs
    ) -> bool:
        """Mock verification email sending."""
        return await self._send_email(
            to=email,
            subject="Verify your email",
            body=f"Verification code: {verification_code}",
            template="verification_email",
            first_name=first_name,
            verification_code=verification_code,
            **kwargs,
        )

    async def _send_password_reset_email(
        self, email: str, reset_token: str, first_name: str = "", **kwargs
    ) -> bool:
        """Mock password reset email sending."""
        return await self._send_email(
            to=email,
            subject="Password Reset",
            body=f"Reset token: {reset_token}",
            template="password_reset",
            first_name=first_name,
            reset_token=reset_token,
            **kwargs,
        )

    def clear_sent_emails(self) -> None:
        """Clear the sent emails list."""
        self.sent_emails.clear()

    def get_last_email(self) -> Optional[Dict[str, Any]]:
        """Get the last sent email."""
        return self.sent_emails[-1] if self.sent_emails else None

    def get_emails_for_recipient(self, email: str) -> List[Dict[str, Any]]:
        """Get all emails sent to a specific recipient."""
        return [email_data for email_data in self.sent_emails if email_data["to"] == email]
