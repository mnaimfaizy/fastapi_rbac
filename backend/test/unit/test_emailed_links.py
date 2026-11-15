"""Emailed links through the module interface: issue, redeem, revoke (#283).

Verification and password-reset links are both issued, redeemed and revoked
by ``app.utils.emailed_links``. These tests drive only that interface and read
the outcome back from what the module promises: the refusal a caller sees, the
security event recorded, and whether the link still works. They do not read
the module's Redis keys.

The API-level proof that the uniform contract holds over HTTP stays in
``test/api/test_token_flow_enumeration.py``.
"""

import hashlib
import json
from datetime import datetime, timedelta, timezone
from test.fixtures.mock_redis_client import MockRedisClient
from typing import Any, Awaitable, Callable, List

import jwt
import pytest
from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core import security
from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.utils import emailed_links
from app.utils.account_token_responses import (
    INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
    INVALID_VERIFICATION_TOKEN_MESSAGE,
)
from app.utils.emailed_links import AlreadyVerified, LinkKind, VerifiedNow

CLIENT_ADDRESS = "203.0.113.7"

REFUSAL = {
    LinkKind.VERIFICATION: INVALID_VERIFICATION_TOKEN_MESSAGE,
    LinkKind.PASSWORD_RESET: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
}
EVENTS = {
    LinkKind.VERIFICATION: {
        "missing_sub": "verify_email_token_missing_sub",
        "user_not_found": "verify_email_user_not_found",
        "not_stored": "verify_email_token_mismatch_or_expired_redis",
        "inactive": "verify_email_inactive_account",
    },
    LinkKind.PASSWORD_RESET: {
        "missing_sub": "password_reset_token_missing_sub",
        "user_not_found": "password_reset_user_not_found",
        "not_stored": "password_reset_token_not_in_redis",
        "inactive": "password_reset_inactive_account",
    },
}
SECRET = {
    LinkKind.VERIFICATION: lambda: settings.JWT_VERIFICATION_SECRET_KEY,
    LinkKind.PASSWORD_RESET: lambda: settings.JWT_RESET_SECRET_KEY,
}
JWT_TYPE = {LinkKind.VERIFICATION: "verification", LinkKind.PASSWORD_RESET: "reset"}


class ActRefused(Exception):
    """Stands in for a password the policy refused."""


@pytest.fixture(autouse=True)
def _no_response_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


def _fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]


def _token_for(kind: LinkKind, subject: str) -> str:
    """A correctly signed link of ``kind`` for ``subject`` that was never issued."""
    if kind is LinkKind.VERIFICATION:
        return security.create_verification_token(subject)
    return security.create_reset_token(subject)


def _token_with_empty_subject(kind: LinkKind) -> str:
    now = datetime.now(timezone.utc)
    claims = security.add_token_claims({"exp": now + timedelta(minutes=5), "sub": "", "type": JWT_TYPE[kind]})
    return jwt.encode(claims, SECRET[kind](), algorithm=security.JWT_ALGORITHM)


async def _redeem(kind: LinkKind, token: str, db: AsyncSession, redis: Any, act: Any = None) -> Any:
    if kind is LinkKind.VERIFICATION:
        return await emailed_links.verify_email(
            token, client_address=CLIENT_ADDRESS, db_session=db, redis=redis
        )

    async def accept(_user: User) -> None:
        return None

    return await emailed_links.redeem_password_reset(
        token, act or accept, client_address=CLIENT_ADDRESS, db_session=db, redis=redis
    )


async def _refusal(kind: LinkKind, token: str, db: AsyncSession, redis: Any) -> str:
    with pytest.raises(HTTPException) as exc_info:
        await _redeem(kind, token, db, redis)
    assert exc_info.value.status_code == 400
    return str(exc_info.value.detail)


async def _events(db: AsyncSession) -> List[AuditLog]:
    # Ids are uuid7, so they sort in the order the events were written.
    result = await db.exec(select(AuditLog).order_by(AuditLog.id))
    return list(result.all())


async def _event_names(db: AsyncSession) -> List[str]:
    return [row.action for row in await _events(db)]


async def _user(user_factory: Any, kind: LinkKind, **overrides: Any) -> User:
    # A verification link is for a pending user; a reset link for an established one.
    fields = {"verified": kind is LinkKind.PASSWORD_RESET, "is_active": True, **overrides}
    return await user_factory.create(**fields)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_a_redeemed_link_works_once(
    kind: LinkKind, db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory, kind)
    token = await emailed_links.issue(kind, user, redis=redis_mock)

    outcome = await _redeem(kind, token, db, redis_mock)

    if kind is LinkKind.VERIFICATION:
        assert isinstance(outcome, VerifiedNow)
        assert outcome.user.verified is True
        assert "email_verified_successfully" in await _event_names(db)
    else:
        # The link is consumed: a second redemption is refused.
        assert await _refusal(kind, token, db, redis_mock) == REFUSAL[kind]
        assert EVENTS[kind]["not_stored"] in await _event_names(db)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_issuing_replaces_the_previous_link(
    kind: LinkKind, db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory, kind)
    first = await emailed_links.issue(kind, user, redis=redis_mock)
    second = await emailed_links.issue(kind, user, redis=redis_mock)
    assert first != second

    assert await _refusal(kind, first, db, redis_mock) == REFUSAL[kind]
    assert await _event_names(db) == [EVENTS[kind]["not_stored"]]
    await _redeem(kind, second, db, redis_mock)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_only_the_hash_of_a_link_is_stored(
    kind: LinkKind, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory, kind)
    token = await emailed_links.issue(kind, user, redis=redis_mock)

    stored = [str(value) for value in redis_mock._storage.values()]
    assert stored == [hashlib.sha256(token.encode("utf-8")).hexdigest()]
    assert not any(token in value for value in stored)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_every_rejection_branch_gives_one_refusal_and_its_own_event(
    kind: LinkKind, db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    disabled = await _user(user_factory, kind, is_active=False)
    holder = await _user(user_factory, kind)
    await emailed_links.issue(kind, holder, redis=redis_mock)

    cases: dict[str, Callable[[], Awaitable[str]]] = {
        "missing_sub": lambda: _refusal(kind, _token_with_empty_subject(kind), db, redis_mock),
        "user_not_found": lambda: _refusal(kind, _token_for(kind, "nobody@example.com"), db, redis_mock),
        "not_stored": lambda: _refusal(kind, _token_for(kind, holder.email), db, redis_mock),
    }
    disabled_token = await emailed_links.issue(kind, disabled, redis=redis_mock)
    cases["inactive"] = lambda: _refusal(kind, disabled_token, db, redis_mock)

    for branch, refuse in cases.items():
        before = len(await _events(db))
        assert await refuse() == REFUSAL[kind], branch
        names = await _event_names(db)
        assert names[before:] == [EVENTS[kind][branch]], branch


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_a_disabled_user_without_a_live_link_is_refused_before_is_active(
    kind: LinkKind, db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """Without the live link, a disabled account looks like any bad link (ADR 0010 decision 3)."""
    disabled = await _user(user_factory, kind, is_active=False)

    assert await _refusal(kind, _token_for(kind, disabled.email), db, redis_mock) == REFUSAL[kind]
    assert await _event_names(db) == [EVENTS[kind]["not_stored"]]


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_an_undecodable_link_is_a_distinct_401(
    kind: LinkKind, db: AsyncSession, redis_mock: MockRedisClient
) -> None:
    with pytest.raises(HTTPException) as exc_info:
        await _redeem(kind, "not.a.jwt", db, redis_mock)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_a_revoked_link_is_refused(
    kind: LinkKind, db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory, kind)
    token = await emailed_links.issue(kind, user, redis=redis_mock)

    await emailed_links.revoke(kind, user.id, redis=redis_mock)

    assert await _refusal(kind, token, db, redis_mock) == REFUSAL[kind]


@pytest.mark.asyncio
async def test_revoking_one_kind_leaves_the_other(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await user_factory.create(verified=True, is_active=True)
    reset = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    await emailed_links.issue(LinkKind.VERIFICATION, user, redis=redis_mock)

    await emailed_links.revoke(LinkKind.VERIFICATION, user.id, redis=redis_mock)

    await _redeem(LinkKind.PASSWORD_RESET, reset, db, redis_mock)


@pytest.mark.asyncio
async def test_a_refused_action_leaves_the_reset_link_usable(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await user_factory.create(verified=True, is_active=True)
    token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)

    async def refuse(_user: User) -> None:
        raise ActRefused()

    with pytest.raises(ActRefused):
        await _redeem(LinkKind.PASSWORD_RESET, token, db, redis_mock, act=refuse)

    acted_on: list[str] = []

    async def accept(redeemed: User) -> None:
        acted_on.append(redeemed.email)

    await _redeem(LinkKind.PASSWORD_RESET, token, db, redis_mock, act=accept)
    assert acted_on == [user.email]
    assert (
        await _refusal(LinkKind.PASSWORD_RESET, token, db, redis_mock) == INVALID_PASSWORD_RESET_TOKEN_MESSAGE
    )


@pytest.mark.asyncio
async def test_a_refused_link_never_runs_the_action(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await user_factory.create(verified=True, is_active=True)

    async def must_not_run(_user: User) -> None:
        raise AssertionError("act ran for a link that was never issued")

    with pytest.raises(HTTPException):
        await _redeem(
            LinkKind.PASSWORD_RESET,
            _token_for(LinkKind.PASSWORD_RESET, user.email),
            db,
            redis_mock,
            act=must_not_run,
        )


@pytest.mark.asyncio
async def test_a_repeat_verification_visit_says_already_verified(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """#239: the second visit with a consumed but valid link is not told the link is dead."""
    user = await user_factory.create(verified=False, is_active=True)
    token = await emailed_links.issue(LinkKind.VERIFICATION, user, redis=redis_mock)

    assert isinstance(await _redeem(LinkKind.VERIFICATION, token, db, redis_mock), VerifiedNow)
    second = await _redeem(LinkKind.VERIFICATION, token, db, redis_mock)

    assert isinstance(second, AlreadyVerified)
    assert second.user.id == user.id
    assert (await _event_names(db))[-1] == "verify_email_already_verified"


@pytest.mark.asyncio
async def test_a_repeat_visit_for_a_disabled_verified_user_is_refused(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """#137 still holds: already-verified is not an oracle for a disabled account."""
    user = await user_factory.create(verified=True, is_active=False)

    refusal = await _refusal(
        LinkKind.VERIFICATION, _token_for(LinkKind.VERIFICATION, user.email), db, redis_mock
    )

    assert refusal == INVALID_VERIFICATION_TOKEN_MESSAGE
    assert await _event_names(db) == ["verify_email_token_mismatch_or_expired_redis"]


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", list(LinkKind))
async def test_no_audit_row_holds_a_raw_token(
    kind: LinkKind, db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    disabled = await _user(user_factory, kind, is_active=False)
    holder = await _user(user_factory, kind)
    submitted = [
        _token_with_empty_subject(kind),
        _token_for(kind, "nobody@example.com"),
        _token_for(kind, holder.email),
        await emailed_links.issue(kind, disabled, redis=redis_mock),
    ]
    for token in submitted:
        await _refusal(kind, token, db, redis_mock)
    refusals = await _events(db)
    redeemed = await emailed_links.issue(kind, holder, redis=redis_mock)
    await _redeem(kind, redeemed, db, redis_mock)
    submitted.append(redeemed)

    dumped = [json.dumps(row.details) for row in await _events(db)]
    for token in submitted:
        assert not any(token in row for row in dumped)
    # Each refusal can still be correlated with the link it concerns.
    assert len(refusals) == len(submitted) - 1
    for row, token in zip(refusals, submitted):
        assert _fingerprint(token) in row.details.values()
