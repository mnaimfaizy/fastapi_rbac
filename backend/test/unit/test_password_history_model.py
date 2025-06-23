from test.utils import random_lower_string
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.password_history_model import UserPasswordHistory
from app.models.user_model import User


@pytest.mark.asyncio
async def test_create_password_history(db: AsyncSession) -> None:
    """Test creating a password history entry in the database"""
    # Create a user first
    user = User(
        email=f"{random_lower_string()}@example.com",
        password=random_lower_string(),
        password_version=1,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create password history entry
    hashed_password = "hashed_password_value"
    password_history = UserPasswordHistory(user_id=user.id, password_hash=hashed_password)

    # Add password history to database
    db.add(password_history)
    await db.commit()
    await db.refresh(password_history)

    # Check that password history was created with correct data
    assert password_history.id is not None
    assert isinstance(password_history.id, UUID)
    assert password_history.user_id == user.id
    assert password_history.password_hash == hashed_password
    assert password_history.created_at is not None
    assert password_history.updated_at is not None


@pytest.mark.asyncio
async def test_retrieve_user_password_history(db: AsyncSession) -> None:
    """Test retrieving password history entries for a specific user"""
    # Create a user
    user = User(
        email=f"{random_lower_string()}@example.com",
        password=random_lower_string(),
        password_version=1,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create multiple password history entries
    histories = []
    for i in range(3):
        password_history = UserPasswordHistory(user_id=user.id, password_hash=f"old_password_{i}")
        histories.append(password_history)

    db.add_all(histories)
    await db.commit()

    # Retrieve all password histories for this user
    stmt = select(UserPasswordHistory).where(UserPasswordHistory.user_id == user.id)
    result = await db.execute(stmt)
    retrieved_histories = result.scalars().all()

    # Check that all histories were retrieved correctly
    assert len(retrieved_histories) == 3
    passwords = [h.password_hash for h in retrieved_histories]
    for i in range(3):
        assert f"old_password_{i}" in passwords


@pytest.mark.asyncio
async def test_check_password_reuse(db: AsyncSession) -> None:
    """Test functionality to check for password reuse"""
    # Create a user
    user = User(
        email=f"{random_lower_string()}@example.com",
        password=random_lower_string(),
        password_version=1,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Add some password history
    password1 = "hashed_password_1"
    password2 = "hashed_password_2"

    histories = [
        UserPasswordHistory(user_id=user.id, password_hash=password1),
        UserPasswordHistory(user_id=user.id, password_hash=password2),
    ]
    db.add_all(histories)
    await db.commit()

    # Check if a specific password exists in history
    new_password = "hashed_password_3"
    stmt = select(UserPasswordHistory).where(
        UserPasswordHistory.user_id == user.id,
        UserPasswordHistory.password_hash == new_password,
    )
    result = await db.execute(stmt)
    existing_entry = result.scalars().first()

    # Password should not exist in history
    assert existing_entry is None

    # Check if another password exists in history
    stmt = select(UserPasswordHistory).where(
        UserPasswordHistory.user_id == user.id,
        UserPasswordHistory.password_hash == password1,
    )
    result = await db.execute(stmt)
    existing_entry = result.scalars().first()

    # This password should exist in history
    assert existing_entry is not None
    assert existing_entry.password_hash == password1
