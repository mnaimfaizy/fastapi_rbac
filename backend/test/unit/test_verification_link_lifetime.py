"""The verification email must promise exactly as long as the link really works (#182).

Two settings used to govern one lifetime. ``EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES``
drove the JWT ``exp`` and the "valid for N hours" copy; ``VERIFICATION_TOKEN_EXPIRE_MINUTES``
drove the Redis ``setex`` TTL. ``/verify-email`` compares the submitted token against
``verification_token:{user.id}``, so Redis is the real lifetime and the shorter value
always won -- production mailed a 168-hour promise for a link that died after 24.

The property under test: whatever the email says, a reader who waits that long still
gets in, and a reader who waits longer does not. It is asserted by reading the duration
back out of the rendered email the way a recipient would and comparing it to the TTL the
dispatcher actually wrote -- neither side recomputes the other's formula.
"""

import pathlib
import re
from datetime import timedelta
from test.fixtures.mock_redis_client import MockRedisClient
from typing import Any, Dict, Iterator, NamedTuple
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks

from app.core import security
from app.core.config import settings
from app.models.user_model import User
from app.utils.account_email_dispatch import _issue_verification
from app.utils.email.email import html_to_plain_text, render_template

# Values a deployment might plausibly choose, including ones that are not a whole
# number of hours -- the copy has to stay true for those too, not just for 1440.
LIFETIME_MINUTES = [60, 90, 1440, 2880, 10080]

UNITS = {
    "minute": timedelta(minutes=1),
    "hour": timedelta(hours=1),
    "day": timedelta(days=1),
}


class Issued(NamedTuple):
    """One issued verification, as its three independent observers see it."""

    ttl_seconds: int
    token: str
    email_body: str


def stated_lifetime(email_body: str) -> timedelta:
    """Read the promise out of the email the way a recipient does.

    The copy carries whole counts only, so a decimal here would mean it came
    from somewhere other than the configured lifetime.
    """
    match = re.search(r"valid for (\d+) (minute|hour|day)s?\b", email_body)
    assert match is not None, f"no stated validity found in:\n{email_body}"
    return int(match.group(1)) * UNITS[match.group(2)]


async def issue_verification(redis: MockRedisClient, minutes: int) -> Issued:
    """Run the real dispatch path and collect everything it committed to."""
    settings.VERIFICATION_TOKEN_EXPIRE_MINUTES = minutes
    tasks = BackgroundTasks()
    user = User(id=uuid4(), email="pending@example.com", first_name="Pending", last_name="User")

    await _issue_verification(user=user, redis_client=redis, background_tasks=tasks)

    _key, ttl_seconds, token = redis.setex.await_args.args
    context: Dict[str, Any] = tasks.tasks[0].kwargs["context"]
    return Issued(
        ttl_seconds=ttl_seconds,
        token=token,
        email_body=html_to_plain_text(render_template("email-verification.html", context)),
    )


@pytest.fixture(autouse=True)
def restore_configured_lifetime() -> Iterator[None]:
    """``issue_verification`` rewrites the lifetime; none of it may leak out of a test."""
    original = settings.VERIFICATION_TOKEN_EXPIRE_MINUTES
    yield
    settings.VERIFICATION_TOKEN_EXPIRE_MINUTES = original


@pytest.mark.asyncio
@pytest.mark.parametrize("minutes", LIFETIME_MINUTES)
async def test_email_promises_exactly_the_redis_ttl(redis_mock: MockRedisClient, minutes: int) -> None:
    """The stated validity equals the TTL on the key ``/verify-email`` checks."""
    issued = await issue_verification(redis_mock, minutes)

    assert stated_lifetime(issued.email_body) == timedelta(seconds=issued.ttl_seconds)


@pytest.mark.asyncio
@pytest.mark.parametrize("minutes", LIFETIME_MINUTES)
async def test_jwt_expiry_matches_the_redis_ttl(redis_mock: MockRedisClient, minutes: int) -> None:
    """The signed token dies with its Redis entry, so neither can outlive the promise."""
    issued = await issue_verification(redis_mock, minutes)

    payload = security.decode_token(issued.token, token_type="verification")
    assert payload["exp"] - payload["iat"] == issued.ttl_seconds


def test_the_parallel_setting_is_gone() -> None:
    """One lifetime, one setting -- a second one is what let the two drift."""
    assert not hasattr(settings, "EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES")


def test_nothing_reintroduces_the_parallel_setting() -> None:
    """Nothing reads or ships it any more, so it cannot come back by half."""
    backend = pathlib.Path(__file__).resolve().parents[2]
    sources = list((backend / "app").rglob("*.py")) + list((backend / "app").rglob("*.html"))
    sources += [path for path in backend.glob(".env*") if path.is_file()]

    offenders = [
        str(path.relative_to(backend))
        for path in sources
        if "EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES" in path.read_text(encoding="utf-8")
    ]

    assert offenders == []


def env_setting(filename: str, name: str) -> str:
    """Read one assignment out of an env file, ignoring any trailing comment."""
    path = pathlib.Path(__file__).resolve().parents[2] / filename
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].split("#", 1)[0].strip()
    raise AssertionError(f"{name} is not set in {filename}")


def test_the_production_example_sets_the_enforcing_lifetime() -> None:
    """The example named the wrong setting, and that is how #182 stayed hidden.

    Real ``.env.*`` files are gitignored, so the example is the only production
    config any checkout shares. Asserting against the real ``.env.production``
    would skip everywhere it matters, and a skipped run is not a passing run
    (``test/README.md``) -- so this pins the example to the value the deployed
    file is documented to use instead.
    """
    assert env_setting(".env.production.example", "VERIFICATION_TOKEN_EXPIRE_MINUTES") == "1440"
