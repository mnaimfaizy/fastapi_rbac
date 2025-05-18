from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role_model import Role
from app.models.user_model import User
from app.models.user_role_model import UserRole

from .utils import random_email, random_lower_string


@pytest.mark.asyncio
async def test_create_user_role(db: AsyncSession) -> None:
    """Test creating a user-role mapping in the database"""
    # Create a user first
    email = random_email()
    user = User(
        email=email,
        hashed_password=random_lower_string(),
        is_active=True,
    )
    db.add(user)

    # Create a role
    role_name = f"test_role_{random_lower_string()}"
    role = Role(name=role_name, description="Test role")
    db.add(role)

    await db.commit()
    await db.refresh(user)
    await db.refresh(role)

    # Create user-role mapping
    user_role = UserRole(user_id=user.id, role_id=role.id)

    # Add user-role mapping to database
    db.add(user_role)
    await db.commit()
    await db.refresh(user_role)

    # Check that user-role mapping was created with correct data
    assert user_role.id is not None
    assert isinstance(user_role.id, UUID)
    assert user_role.user_id == user.id
    assert user_role.role_id == role.id
    assert user_role.created_at is not None
    assert user_role.updated_at is not None


@pytest.mark.asyncio
async def test_retrieve_roles_for_user(db: AsyncSession) -> None:
    """Test retrieving all roles assigned to a specific user"""
    # Create a user
    email = random_email()
    user = User(
        email=email,
        hashed_password=random_lower_string(),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create multiple roles
    roles = []
    role_names = []
    for i in range(3):
        role_name = f"role_{i}_{random_lower_string()}"
        role_names.append(role_name)
        role = Role(name=role_name, description=f"Test role {i}")
        roles.append(role)

    db.add_all(roles)
    await db.commit()
    for role in roles:
        await db.refresh(role)

    # Assign all roles to the user
    user_roles = []
    for role in roles:
        user_role = UserRole(user_id=user.id, role_id=role.id)
        user_roles.append(user_role)

    db.add_all(user_roles)
    await db.commit()

    # Retrieve all roles for this user
    stmt = text("SELECT * FROM role WHERE id IN (SELECT role_id FROM UserRole WHERE user_id = :user_id)")
    stmt = stmt.bindparams(user_id=user.id)
    result = await db.execute(stmt)
    retrieved_roles = result.scalars().all()

    # Check that all roles were retrieved correctly
    assert len(retrieved_roles) == 3
    retrieved_role_names = [r.name for r in retrieved_roles]
    for name in role_names:
        assert name in retrieved_role_names


@pytest.mark.asyncio
async def test_retrieve_users_with_role(db: AsyncSession) -> None:
    """Test retrieving all users with a specific role"""
    # Create a role
    role_name = f"test_role_{random_lower_string()}"
    role = Role(name=role_name, description="Test role")
    db.add(role)
    await db.commit()
    await db.refresh(role)

    # Create multiple users
    users = []
    emails = []
    for i in range(3):
        email = random_email()
        emails.append(email)
        user = User(
            email=email,
            hashed_password=random_lower_string(),
            is_active=True,
        )
        users.append(user)

    db.add_all(users)
    await db.commit()
    for user in users:
        await db.refresh(user)

    # Assign the role to all users
    user_roles = []
    for user in users:
        user_role = UserRole(user_id=user.id, role_id=role.id)
        user_roles.append(user_role)

    db.add_all(user_roles)
    await db.commit()

    # Retrieve all users with this role
    stmt = text("SELECT * FROM user WHERE id IN (SELECT user_id FROM UserRole WHERE role_id = :role_id)")
    stmt = stmt.bindparams(role_id=role.id)
    result = await db.execute(stmt)
    retrieved_users = result.scalars().all()

    # Check that all users were retrieved correctly
    assert len(retrieved_users) == 3
    retrieved_emails = [u.email for u in retrieved_users]
    for email in emails:
        assert email in retrieved_emails
