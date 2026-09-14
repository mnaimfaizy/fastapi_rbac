"""Every module except test_email_send.py must still get the mocked mailer.

test/unit/test_email_send.py cancels the suite-wide ``mock_send_email`` fixture
so it can exercise the real function against a stubbed socket. That override is
module-scoped, but "module-scoped" is a property of pytest's fixture
resolution, not something the file itself can prove -- if it were ever moved to
a conftest, or the fixture renamed, the patch would come off the whole suite
and tests would start sending mail to whatever SMTP_HOST happened to be
configured.

This assertion has to live outside that module by construction, which is why it
is a file of its own.
"""

from unittest.mock import AsyncMock, MagicMock

from app.utils.email import email as email_module


def test_send_email_is_still_patched_outside_the_boundary_test() -> None:
    assert isinstance(email_module.send_email, (MagicMock, AsyncMock)), (
        "send_email is not mocked here -- the override in test_email_send.py has "
        "escaped its module and the suite can now send real mail"
    )
