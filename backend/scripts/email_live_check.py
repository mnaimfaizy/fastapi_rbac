#!/usr/bin/env python3
"""Manual mail-delivery check against a real SMTP server.

Sends one password-reset message through the configured SMTP host so a human
can look at what arrived -- in MailHog for development, or a real inbox for
production. Rendering, encoding and deliverability are things you have to see;
a mail that is technically well-formed can still be unreadable.

    python scripts/email_live_check.py

This is a diagnostic, not a test suite. The automated coverage lives in
test/unit/test_email_send.py and runs in CI, stubbing only the socket.

It used to sit at test/unit/test_email.py, where pytest collected it. The
suite-wide ``send_email`` patch meant it sent nothing, it asserted nothing, and
it caught every exception -- so it reported "Email sent successfully!" and a
green PASSED while the code it named went unexercised. That false green is
exactly the gap #159 was about, so the file is named ``check_*`` here and lives
outside test/ where nothing will collect it.
"""

import asyncio
import sys

from app.core.config import settings
from app.utils.email.reset_password import send_reset_password_email


async def check_send_reset_password_email(email: str = "test@example.com") -> bool:
    """Send one password-reset email and report whether the call went through."""
    print(f"SMTP host: {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    print(f"Mode: {settings.MODE}")
    print(f"Reset URL base: {settings.PASSWORD_RESET_URL}")

    if not settings.EMAILS_ENABLED:
        print("EMAILS_ENABLED is false -- nothing will be sent.")
        return False

    token = "test-token-12345"
    reset_url = f"{settings.PASSWORD_RESET_URL}?token={token}"

    try:
        await send_reset_password_email(email=email, token=token, reset_url=reset_url)
    except Exception as exc:
        print(f"FAILED: {exc}")
        return False

    print(f"Sent to {email}.")
    if settings.MODE == "development":
        print("Open http://localhost:8025 and confirm the message is readable:")
        print("  - the body renders, rather than showing raw MIME")
        print("  - there is a text/plain part as well as text/html")
        print(f"  - the reset link points at {reset_url}")
    return True


if __name__ == "__main__":
    recipient = sys.argv[1] if len(sys.argv) > 1 else "test@example.com"
    sys.exit(0 if asyncio.run(check_send_reset_password_email(recipient)) else 1)
