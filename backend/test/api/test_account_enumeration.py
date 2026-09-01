"""The registration and resend-verification endpoints must not reveal account state (#113).

Registration used to answer 400 "Unable to process registration request." for
any existing address while resend-verification answered "This email is already
verified." for established users and "Account is inactive." for disabled ones.
Either of those confirmed an address in a single request, which is what made
registration's deliberately vague 400 pointless.

The property under test is that all four account states -- absent, pending,
established, disabled -- are indistinguishable from the outside, on both
endpoints. What differs is only which mail the address owner receives.
"""

import time
from typing import Any, Dict, Tuple

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.utils.account_email_dispatch import (
    ACCOUNT_EMAIL_UNIFORM_MESSAGE,
    AccountState,
    account_email_budget_key,
    classify,
)

PASSWORD = "TestPassw0rd!47"

ABSENT_EMAIL = "nobody-at-all@example.com"
PENDING_EMAIL = "pending-user@example.com"
ESTABLISHED_EMAIL = "established-user@example.com"
DISABLED_EMAIL = "disabled-user@example.com"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def csrf_headers(client: AsyncClient) -> Dict[str, str]:
    """Fetch a CSRF token and return headers carrying it."""
    response = await client.get(auth_url("/csrf-token"))
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["data"]["csrf_token"]}


async def post_register(client: AsyncClient, email: str) -> Tuple[int, Dict[str, Any]]:
    headers = await csrf_headers(client)
    response = await client.post(
        auth_url("/register"),
        json={
            "email": email,
            "password": PASSWORD,
            "first_name": "Test",
            "last_name": "User",
        },
        headers=headers,
    )
    return response.status_code, response.json()


async def post_resend(client: AsyncClient, email: str) -> Tuple[int, Dict[str, Any]]:
    headers = await csrf_headers(client)
    response = await client.post(
        auth_url("/resend-verification-email"),
        json={"email": email},
        headers=headers,
    )
    return response.status_code, response.json()


def observable(status_code: int, body: Dict[str, Any]) -> Tuple[int, str]:
    """Reduce a response to what a caller can actually distinguish.

    The data payload is excluded deliberately: under MODE=testing the
    verification code is exposed there so integration tests can drive the flow.
    That exposure is test-only, and every other field must match.
    """
    return status_code, body.get("message", body.get("detail", ""))


async def seed_states(user_factory: Any) -> None:
    """Create one user in each of the three non-absent states."""
    await user_factory.create(email=PENDING_EMAIL, password=PASSWORD, verified=False, is_active=True)
    await user_factory.create(email=ESTABLISHED_EMAIL, password=PASSWORD, verified=True, is_active=True)
    await user_factory.create(email=DISABLED_EMAIL, password=PASSWORD, verified=True, is_active=False)


# --------------------------------------------------------------------------
# classify() -- the state machine both endpoints share
# --------------------------------------------------------------------------


def test_classify_absent_for_missing_user() -> None:
    assert classify(None) is AccountState.ABSENT


def test_classify_prefers_disabled_over_verified() -> None:
    """An inactive account is disabled whether or not it ever verified."""

    class Row:
        is_active = False
        verified = True

    assert classify(Row()) is AccountState.DISABLED

    class UnverifiedRow:
        is_active = False
        verified = False

    assert classify(UnverifiedRow()) is AccountState.DISABLED


def test_classify_distinguishes_pending_from_established() -> None:
    class Pending:
        is_active = True
        verified = False

    class Established:
        is_active = True
        verified = True

    assert classify(Pending()) is AccountState.PENDING
    assert classify(Established()) is AccountState.ESTABLISHED


# --------------------------------------------------------------------------
# The enumeration property
# --------------------------------------------------------------------------


async def test_registration_is_uniform_across_all_account_states(
    client: AsyncClient, user_factory: Any
) -> None:
    """Registration returns identical status, body and message for all four states."""
    await seed_states(user_factory)

    results = {
        state: observable(*await post_register(client, email))
        for state, email in (
            (AccountState.ABSENT, ABSENT_EMAIL),
            (AccountState.PENDING, PENDING_EMAIL),
            (AccountState.ESTABLISHED, ESTABLISHED_EMAIL),
            (AccountState.DISABLED, DISABLED_EMAIL),
        )
    }

    distinct = set(results.values())
    assert len(distinct) == 1, f"registration distinguishes account states: {results}"

    status_code, message = distinct.pop()
    assert status_code == 200
    assert message == ACCOUNT_EMAIL_UNIFORM_MESSAGE


async def test_resend_verification_is_uniform_across_all_account_states(
    client: AsyncClient, user_factory: Any
) -> None:
    """Resend-verification returns identical status, body and message for all four states."""
    await seed_states(user_factory)

    results = {
        state: observable(*await post_resend(client, email))
        for state, email in (
            (AccountState.ABSENT, ABSENT_EMAIL),
            (AccountState.PENDING, PENDING_EMAIL),
            (AccountState.ESTABLISHED, ESTABLISHED_EMAIL),
            (AccountState.DISABLED, DISABLED_EMAIL),
        )
    }

    distinct = set(results.values())
    assert len(distinct) == 1, f"resend-verification distinguishes account states: {results}"

    status_code, message = distinct.pop()
    assert status_code == 200
    assert message == ACCOUNT_EMAIL_UNIFORM_MESSAGE


async def test_both_endpoints_return_the_same_response(client: AsyncClient, user_factory: Any) -> None:
    """The two endpoints do not differ from each other either.

    Registration and resend previously drifted apart because each implemented
    the policy separately. They now share one operation, so their responses
    should be indistinguishable as well.
    """
    await seed_states(user_factory)

    assert observable(*await post_register(client, ESTABLISHED_EMAIL)) == observable(
        *await post_resend(client, ESTABLISHED_EMAIL)
    )


async def test_registration_no_longer_reports_duplicate_email(client: AsyncClient, user_factory: Any) -> None:
    """The old 400 oracle is gone."""
    await seed_states(user_factory)

    status_code, body = await post_register(client, ESTABLISHED_EMAIL)

    assert status_code == 200
    serialized = str(body).lower()
    assert "unable to process" not in serialized
    assert "already" not in serialized
    assert "exists" not in serialized


async def test_resend_no_longer_reports_verified_or_inactive(client: AsyncClient, user_factory: Any) -> None:
    """Both strings named in #113 and #137 are gone from resend-verification."""
    await seed_states(user_factory)

    _, established_body = await post_resend(client, ESTABLISHED_EMAIL)
    _, disabled_body = await post_resend(client, DISABLED_EMAIL)

    assert "already verified" not in str(established_body).lower()
    assert "inactive" not in str(disabled_body).lower()


# --------------------------------------------------------------------------
# Re-registration must not mutate a pending user
# --------------------------------------------------------------------------


async def test_reregistration_cannot_change_a_pending_users_password(
    client: AsyncClient, db: Any, user_factory: Any
) -> None:
    """The attack this closes: hijacking an unverified account by re-registering.

    If re-registering overwrote credentials, an attacker could register against
    a victim's unverified address and have the victim activate an
    attacker-controlled account by clicking the link in their own inbox.
    """
    from app import crud

    await user_factory.create(email=PENDING_EMAIL, password=PASSWORD, verified=False, is_active=True)
    before = await crud.user.get_by_email(db_session=db, email=PENDING_EMAIL)
    assert before is not None
    original_hash = before.password
    original_first = before.first_name
    original_last = before.last_name

    headers = await csrf_headers(client)
    response = await client.post(
        auth_url("/register"),
        json={
            "email": PENDING_EMAIL,
            "password": "AttackerPassw0rd!x9",
            "first_name": "Attacker",
            "last_name": "Person",
        },
        headers=headers,
    )
    assert response.status_code == 200

    db.expunge_all()
    after = await crud.user.get_by_email(db_session=db, email=PENDING_EMAIL)
    assert after is not None
    assert after.password == original_hash, "re-registration overwrote a pending user's password"
    assert after.first_name == original_first
    assert after.last_name == original_last
    assert after.verified is False


async def test_reregistration_does_not_create_a_second_user(
    client: AsyncClient, db: Any, user_factory: Any
) -> None:
    """An established address must not gain a duplicate row."""
    from sqlmodel import select

    from app.models.user_model import User

    await user_factory.create(email=ESTABLISHED_EMAIL, password=PASSWORD, verified=True, is_active=True)

    await post_register(client, ESTABLISHED_EMAIL)

    rows = await db.exec(select(User).where(User.email == ESTABLISHED_EMAIL))
    assert len(rows.all()) == 1


# --------------------------------------------------------------------------
# The shared per-address mail budget
# --------------------------------------------------------------------------


async def test_mail_budget_is_shared_between_both_endpoints(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """Exhausting the budget via registration also blocks resend, and vice versa.

    Before #113 the two endpoints kept separate per-email buckets, so alternating
    between them allowed 3 + 3 emails per hour at a single address.
    """
    await seed_states(user_factory)
    budget = settings.MAX_ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR

    # Spend the whole budget on one endpoint.
    for _ in range(budget):
        status_code, _ = await post_register(client, ESTABLISHED_EMAIL)
        assert status_code == 200

    # The other endpoint must already be exhausted for that address.
    status_code, _ = await post_resend(client, ESTABLISHED_EMAIL)
    assert status_code == 429, "resend still had budget after registration spent it"


async def test_mail_budget_is_per_address_not_global(client: AsyncClient, user_factory: Any) -> None:
    """Exhausting one address must not block a different one."""
    await seed_states(user_factory)
    budget = settings.MAX_ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR

    for _ in range(budget):
        await post_resend(client, ESTABLISHED_EMAIL)

    status_code, _ = await post_resend(client, PENDING_EMAIL)
    assert status_code == 200


async def test_mail_budget_charges_addresses_with_no_account(client: AsyncClient, redis_mock: Any) -> None:
    """An absent address is charged too, so 429 timing is not itself an oracle.

    Resend sends no mail for an absent address. If the budget were only charged
    when mail went out, the presence or absence of a 429 after three attempts
    would distinguish an address that produces mail from one that does not.
    """
    await post_resend(client, ABSENT_EMAIL)

    used = await redis_mock.get(account_email_budget_key(ABSENT_EMAIL))
    assert used is not None
    assert int(used) == 1


async def test_mail_budget_returns_429_uniformly_for_every_state(
    client: AsyncClient, user_factory: Any
) -> None:
    """The exhausted response must not vary by account state either."""
    await seed_states(user_factory)
    budget = settings.MAX_ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR

    seen = set()
    for email in (ABSENT_EMAIL, PENDING_EMAIL, ESTABLISHED_EMAIL, DISABLED_EMAIL):
        for _ in range(budget):
            await post_resend(client, email)
        seen.add(observable(*await post_resend(client, email)))

    assert len(seen) == 1, f"429 response varies by account state: {seen}"
    assert seen.pop()[0] == 429


# --------------------------------------------------------------------------
# Which mail each state produces
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("email", "expect_verification", "expect_notice"),
    [
        (ABSENT_EMAIL, False, False),
        (PENDING_EMAIL, True, False),
        (ESTABLISHED_EMAIL, False, True),
        (DISABLED_EMAIL, False, True),
    ],
)
async def test_resend_sends_the_right_mail_for_each_state(
    client: AsyncClient,
    user_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
    email: str,
    expect_verification: bool,
    expect_notice: bool,
) -> None:
    """Uniform responses outward; the correct, differing mail inward."""
    import app.utils.account_email_dispatch as dispatch

    sent: Dict[str, int] = {"verification": 0, "notice": 0}

    async def fake_verification(**kwargs: Any) -> None:
        sent["verification"] += 1

    async def fake_notice(**kwargs: Any) -> None:
        sent["notice"] += 1

    monkeypatch.setattr(dispatch, "send_verification_email", fake_verification)
    monkeypatch.setattr(dispatch, "send_registration_notice_email", fake_notice)

    await seed_states(user_factory)
    status_code, _ = await post_resend(client, email)

    assert status_code == 200
    assert bool(sent["verification"]) is expect_verification
    assert bool(sent["notice"]) is expect_notice


async def test_registration_creates_only_for_an_absent_address(
    client: AsyncClient,
    user_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Registration mails an absent address a verification, an established one a notice."""
    import app.utils.account_email_dispatch as dispatch

    sent: Dict[str, int] = {"verification": 0, "notice": 0}

    async def fake_verification(**kwargs: Any) -> None:
        sent["verification"] += 1

    async def fake_notice(**kwargs: Any) -> None:
        sent["notice"] += 1

    monkeypatch.setattr(dispatch, "send_verification_email", fake_verification)
    monkeypatch.setattr(dispatch, "send_registration_notice_email", fake_notice)

    await seed_states(user_factory)

    await post_register(client, ABSENT_EMAIL)
    assert sent == {"verification": 1, "notice": 0}

    await post_register(client, DISABLED_EMAIL)
    assert sent == {"verification": 1, "notice": 1}


# --------------------------------------------------------------------------
# The response-time floor
# --------------------------------------------------------------------------


async def test_no_branch_returns_faster_than_the_floor(client: AsyncClient, user_factory: Any) -> None:
    """No account state returns early enough to be distinguished by timing.

    A uniform body still leaks if one branch answers sooner than another. The
    old code padded selected branches with a fixed sleep, which covered the
    branches someone remembered and left later ones bare.

    Only the lower bound is asserted. That is what a floor guarantees, and it is
    what a timing oracle would violate: a branch skipping work and returning
    early. Asserting an upper bound would measure the host, not the code.
    """
    await seed_states(user_factory)
    floor = settings.UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS
    # Allow for coarse timer resolution on the measuring side.
    minimum = floor * 0.9

    for email in (ABSENT_EMAIL, PENDING_EMAIL, ESTABLISHED_EMAIL, DISABLED_EMAIL):
        started = time.monotonic()
        await post_resend(client, email)
        elapsed = time.monotonic() - started
        assert elapsed >= minimum, f"resend for {email} returned in {elapsed:.3f}s, under the floor"

    started = time.monotonic()
    await post_register(client, "timing-probe@example.com")
    elapsed = time.monotonic() - started
    assert elapsed >= minimum, f"register returned in {elapsed:.3f}s, under the floor"
