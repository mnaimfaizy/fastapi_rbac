"""The password-reset email must state the window the link actually has.

Both senders rendered the duration as
``PASSWORD_RESET_TOKEN_EXPIRE_MINUTES // 60``. Integer division floors, and the
setting is 30 by default and in every shipped env file, so every password-reset
mail told its reader:

    This password reset link is valid for 0 hours.

Nothing was wrong with the link -- the JWT ``exp`` and the Redis TTL are both
built from the same setting, and both give the reader a real 30 minutes. Only
the sentence describing it was wrong, and it was wrong in the direction that
makes a working link look already dead.

Sibling of ``test_verification_link_lifetime.py`` and asserted the same way:
the duration is read back out of the rendered email as a recipient reads it,
then compared to the configured lifetime. Neither side recomputes the other's
formula, so a template that hardcodes a number fails.
"""

import re
from datetime import timedelta
from typing import Any, Dict, Iterator

import pytest
from fastapi import BackgroundTasks

from app.core.config import settings
from app.utils.background_tasks import send_password_reset_email
from app.utils.email.email import html_to_plain_text, render_template

RESET_URL = "https://rbac.example.com/reset-password"
TOKEN = "abc.def.ghi"

# Includes the shipped default (30) and values no larger unit divides, because
# "N hours" is exactly what those cannot be stated as.
LIFETIME_MINUTES = [15, 30, 60, 90, 1440]

UNITS = {
    "minute": timedelta(minutes=1),
    "hour": timedelta(hours=1),
    "day": timedelta(days=1),
}


def stated_lifetime(email_body: str) -> timedelta:
    """Read the promise out of the email the way a recipient does."""
    match = re.search(r"valid for (\d+) (minute|hour|day)s?\b", email_body)
    assert match is not None, f"no stated validity found in:\n{email_body}"
    return int(match.group(1)) * UNITS[match.group(2)]


def rendered(context: Dict[str, Any]) -> str:
    return html_to_plain_text(render_template("password-reset.html", context))


@pytest.fixture(autouse=True)
def restore_configured_lifetime() -> Iterator[None]:
    """Tests rewrite the lifetime; none of it may leak out of a test."""
    original = settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    yield
    settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = original


async def context_from_background_sender(minutes: int) -> Dict[str, Any]:
    """The context the Celery and BackgroundTasks branches both receive."""
    settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = minutes
    tasks = BackgroundTasks()

    await send_password_reset_email(
        background_tasks=tasks,
        user_email="reader@example.com",
        reset_token=TOKEN,
        reset_url=RESET_URL,
    )

    return dict(tasks.tasks[0].kwargs["context"])


async def context_from_standalone_sender(monkeypatch: pytest.MonkeyPatch, minutes: int) -> Dict[str, Any]:
    """The other sender, which mails directly rather than through a task."""
    from app.utils.email import reset_password

    settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = minutes
    captured: Dict[str, Any] = {}

    def capture(**kwargs: Any) -> None:
        captured.update(kwargs["context"])

    monkeypatch.setattr(reset_password, "send_email_with_template", capture)
    await reset_password.send_reset_password_email(
        email="reader@example.com", token=TOKEN, reset_url=RESET_URL
    )

    return captured


@pytest.mark.asyncio
@pytest.mark.parametrize("minutes", LIFETIME_MINUTES)
async def test_the_background_sender_states_the_configured_lifetime(minutes: int) -> None:
    """The sender the reset endpoint actually uses."""
    body = rendered(await context_from_background_sender(minutes))

    assert stated_lifetime(body) == timedelta(minutes=minutes)


@pytest.mark.asyncio
@pytest.mark.parametrize("minutes", LIFETIME_MINUTES)
async def test_the_standalone_sender_states_the_configured_lifetime(
    monkeypatch: pytest.MonkeyPatch, minutes: int
) -> None:
    """The second copy of the same sender, which carried the same defect."""
    body = rendered(await context_from_standalone_sender(monkeypatch, minutes))

    assert stated_lifetime(body) == timedelta(minutes=minutes)


@pytest.mark.asyncio
async def test_the_shipped_default_does_not_read_as_zero() -> None:
    """The regression itself: 30 minutes must not floor to "0 hours"."""
    body = rendered(await context_from_background_sender(30))

    assert "0 hour" not in body
    assert stated_lifetime(body) == timedelta(minutes=30)
