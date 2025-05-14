import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission_group_model import PermissionGroup
from app.models.user_model import User

from .utils import random_email


@pytest_asyncio.fixture(scope="function")
async def test_user(db: AsyncSession) -> User:
    """Fixture to create a test user"""
    user = User(email=random_email(), hashed_password="hashed_password", is_active=True)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_permission_group(db: AsyncSession, test_user: User) -> PermissionGroup:
    """Fixture to create a test permission group"""
    group = PermissionGroup(name="Test Group", created_by_id=test_user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@pytest.mark.asyncio
async def test_create_permission_group(db: AsyncSession, test_user: User) -> None:
    """Test creating a permission group in the database"""
    group = PermissionGroup(name="New Group", created_by_id=test_user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)

    assert group.id is not None
    assert group.name == "New Group"
    assert group.created_by_id == test_user.id


@pytest.mark.asyncio
async def test_permission_group_relationships(
    db: AsyncSession, test_permission_group: PermissionGroup, test_user: User
) -> None:
    """Test relationships of the permission group"""
    test_permission_group_instance = test_permission_group

    assert test_permission_group_instance.creator.id == test_user.id
    assert test_permission_group_instance.creator.email == test_user.email
