"""Periodic sweep of pending users past the verification window (#136).

The sweep replaces an in-process ``asyncio.sleep`` that never survived a worker
restart. These tests pin the four guarantees the issue asks for: old pending
users go, verified users never go, a user who verifies mid-sweep survives, and
running the sweep twice is a no-op the second time.
"""

from datetime import datetime, timedelta, timezone
from test.factories.async_factories import AsyncUserFactory
from test.fixtures.mock_redis_client import MockRedisClient
from uuid import UUID

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user_model import User
from app.models.user_role_model import UserRole
from app.utils.unverified_cleanup import (
    delete_if_still_pending,
    sweep_unverified_users,
    unverified_cutoff,
)

CLEANUP_HOURS = 72


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _make_user(
    factory: AsyncUserFactory,
    *,
    age_hours: float,
    verified: bool = False,
    is_active: bool = True,
    is_superuser: bool = False,
) -> User:
    """Create a user whose ``created_at`` is ``age_hours`` in the past."""
    created_at = _naive_utc_now() - timedelta(hours=age_hours)
    if verified:
        return await factory.create(
            verified=True,
            is_active=is_active,
            is_superuser=is_superuser,
            created_at=created_at,
        )
    return await factory.create_unverified(
        is_active=is_active,
        is_superuser=is_superuser,
        created_at=created_at,
    )


async def _exists(db: AsyncSession, user_id: UUID) -> bool:
    result = await db.exec(select(User).where(User.id == user_id))
    return result.one_or_none() is not None


@pytest.mark.asyncio
async def test_cutoff_is_naive_utc_offset_by_the_window() -> None:
    now = datetime(2026, 8, 27, 12, 0, 0, tzinfo=timezone.utc)
    cutoff = unverified_cutoff(hours=CLEANUP_HOURS, now=now)
    assert cutoff.tzinfo is None
    assert cutoff == datetime(2026, 8, 24, 12, 0, 0)


@pytest.mark.asyncio
async def test_sweep_deletes_pending_user_past_the_window(
    db: AsyncSession, user_factory: AsyncUserFactory
) -> None:
    stale = await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1)

    deleted = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)

    assert stale.id in deleted
    assert not await _exists(db, stale.id)


@pytest.mark.asyncio
async def test_sweep_never_deletes_a_verified_user(db: AsyncSession, user_factory: AsyncUserFactory) -> None:
    verified = await _make_user(user_factory, age_hours=CLEANUP_HOURS * 10, verified=True)

    deleted = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)

    assert verified.id not in deleted
    assert await _exists(db, verified.id)


@pytest.mark.asyncio
async def test_sweep_keeps_pending_user_still_inside_the_window(
    db: AsyncSession, user_factory: AsyncUserFactory
) -> None:
    fresh = await _make_user(user_factory, age_hours=1)

    deleted = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)

    assert fresh.id not in deleted
    assert await _exists(db, fresh.id)


@pytest.mark.asyncio
async def test_sweep_leaves_deactivated_and_superuser_rows_alone(
    db: AsyncSession, user_factory: AsyncUserFactory
) -> None:
    disabled = await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1, is_active=False)
    superuser = await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1, is_superuser=True)

    deleted = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)

    assert disabled.id not in deleted
    assert superuser.id not in deleted
    assert await _exists(db, disabled.id)
    assert await _exists(db, superuser.id)


@pytest.mark.asyncio
async def test_sweep_is_idempotent(db: AsyncSession, user_factory: AsyncUserFactory) -> None:
    await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1)

    first = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)
    second = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)

    assert len(first) == 1
    assert second == []


@pytest.mark.asyncio
async def test_sweep_discards_the_pending_verification_token(
    db: AsyncSession, user_factory: AsyncUserFactory
) -> None:
    stale = await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1)
    redis_client = MockRedisClient()
    await redis_client.setex(f"verification_token:{stale.id}", 600, "token")

    await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS, redis_client=redis_client)

    assert not await redis_client.exists(f"verification_token:{stale.id}")


@pytest.mark.asyncio
async def test_sweep_removes_role_assignments_with_the_user(
    db: AsyncSession, user_factory: AsyncUserFactory
) -> None:
    """Registration gives pending users the default role; the FK must not block."""
    from app.crud.role_crud import role as role_crud

    stale = await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1)
    default_role = await role_crud.get_role_by_name(name="User", db_session=db)
    assert default_role is not None
    db.add(UserRole(user_id=stale.id, role_id=default_role.id))
    await db.commit()

    deleted = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS)

    assert stale.id in deleted
    links = await db.exec(select(UserRole).where(UserRole.user_id == stale.id))
    assert links.all() == []


@pytest.mark.asyncio
async def test_user_who_verifies_after_selection_is_not_deleted(
    db: AsyncSession, user_factory: AsyncUserFactory
) -> None:
    """The delete re-checks ``verified`` so a mid-sweep verification wins."""
    racer = await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1)
    racer_id = racer.id
    cutoff = unverified_cutoff(hours=CLEANUP_HOURS)

    racer.verified = True
    db.add(racer)
    await db.commit()

    assert await delete_if_still_pending(db_session=db, user_id=racer_id, cutoff=cutoff) is False
    assert await _exists(db, racer_id)


@pytest.mark.asyncio
async def test_sweep_honours_the_batch_limit(db: AsyncSession, user_factory: AsyncUserFactory) -> None:
    for _ in range(3):
        await _make_user(user_factory, age_hours=CLEANUP_HOURS + 1)

    deleted = await sweep_unverified_users(db_session=db, cleanup_hours=CLEANUP_HOURS, limit=2)

    assert len(deleted) == 2
