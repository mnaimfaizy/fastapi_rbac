"""
Test script for sending password reset emails.
This can be used to verify both development (MailHog)
and production email configurations.
"""

import asyncio
import os
import sys

from app.core.config import settings
from app.utils.email.reset_password import send_reset_password_email

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


async def test_send_reset_password_email() -> None:
    """Test sending a password reset email."""
    print(f"Testing email sending with SMTP host: {settings.SMTP_HOST}, port: {settings.SMTP_PORT}")
    print(f"Current environment mode: {settings.MODE}")

    # Sample test data
    email = "test@example.com"
    token = "test-token-12345"
    reset_url = f"{settings.PASSWORD_RESET_URL}?token={token}"
    email_message = ""
    if settings.MODE == "development":
        email_message = f"Environment: {'Development (MailHog)' }"
    else:
        email_message = "Production"
    try:
        await send_reset_password_email(email=email, token=token, reset_url=reset_url)
        print("Email sent successfully!")
        print(email_message)

        if settings.MODE == "development":
            print("Check MailHog interface at http://localhost:8025 to see the email.")
    except Exception as e:
        print(f"Failed to send email: {e}")


if __name__ == "__main__":
    asyncio.run(test_send_reset_password_email())
