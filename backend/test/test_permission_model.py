import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission_group_model import PermissionGroup
from app.models.permission_model import Permission
from app.models.user_model import User

from .utils import random_email


@pytest_asyncio.fixture(scope="function")
async def test_user(db: AsyncSession) -> User:
    """Fixture to create a test user"""
    user = User(
        email=random_email(), hashed_password="hashed_password", is_active=True  # Generate a unique email
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_permission_group(db: AsyncSession, test_user: User) -> PermissionGroup:
    """Fixture to create a test permission group"""
    group = PermissionGroup(name="Test Permission Group", created_by_id=test_user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@pytest_asyncio.fixture
async def test_permission(db: AsyncSession, test_permission_group: PermissionGroup) -> Permission:
    """Fixture to create a test permission"""
    permission = Permission(
        name="Test Permission", description="A test permission", group_id=test_permission_group.id
    )
    db.add(permission)
    await db.commit()
    await db.refresh(permission)
    return permission


@pytest.mark.asyncio
async def test_create_permission(db: AsyncSession, test_permission_group: PermissionGroup) -> None:
    """Test creating a permission in the database"""
    permission = Permission(
        name="New Permission", description="A new permission", group_id=test_permission_group.id
    )
    db.add(permission)
    await db.commit()
    await db.refresh(permission)

    assert permission.id is not None
    assert permission.name == "New Permission"
    assert permission.description == "A new permission"
    assert permission.group_id == test_permission_group.id


@pytest.mark.asyncio
async def test_permission_relationships(db: AsyncSession, test_permission: Permission) -> None:
    """Test relationships of the permission"""
    test_permission_group_instance = test_permission.group  # Use the group directly from the permission

    assert test_permission_group_instance is not None
    assert test_permission_group_instance.name == "Test Permission Group"
