from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.role_model import Role
from app.models.user_model import User
from app.models.user_role_model import UserRole

from .utils import random_email, random_lower_string


@pytest.mark.asyncio
async def test_create_user(db: AsyncSession) -> None:
    """Test creating a user in the database"""
    # Create user data
    email = random_email()
    password = random_lower_string()
    first_name = random_lower_string()
    last_name = random_lower_string()  # Create user object
    user = User(
        email=email,
        password=password,  # In a real app, this would be hashed
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_superuser=False,
        password_version=1,  # Required field with default value
    )

    # Add user to database
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Check that user was created with correct data
    assert user.id is not None
    assert isinstance(user.id, UUID)
    assert user.email == email
    assert user.first_name == first_name
    assert user.last_name == last_name
    assert user.is_active
    assert not user.is_superuser
    assert user.created_at is not None
    assert user.updated_at is not None


@pytest.mark.asyncio
async def test_user_with_roles(db: AsyncSession) -> None:
    """Test assigning roles to a user"""  # Create user
    email = random_email()
    user = User(email=email, password=random_lower_string(), is_active=True, password_version=1)
    db.add(user)

    # Create roles
    role1 = Role(name="admin", description="Administrator")
    role2 = Role(name="user", description="Regular User")
    db.add_all([role1, role2])
    await db.commit()
    await db.refresh(user)
    await db.refresh(role1)
    await db.refresh(role2)

    # Assign roles to user
    user_role1 = UserRole(user_id=user.id, role_id=role1.id)
    user_role2 = UserRole(user_id=user.id, role_id=role2.id)
    db.add_all([user_role1, user_role2])
    await db.commit()
    await db.refresh(user_role1)
    await db.refresh(user_role2)

    # Check that user has roles
    stmt = select(Role.name).join(UserRole).where(UserRole.user_id == user.id)
    result = await db.execute(stmt)  # Execute the query
    # Fetch all results
    result = result.fetchall()  # Fetch all results
    roles = [row[0] for row in result]

    # Check that the user has both roles
    assert "admin" in roles
    assert "user" in roles
    assert len(roles) == 2


@pytest.mark.asyncio
async def test_user_unique_email_constraint(db: AsyncSession) -> None:
    """Test that users must have unique emails"""  # Create first user
    email = random_email()
    user1 = User(email=email, password=random_lower_string(), is_active=True, password_version=1)
    db.add(user1)
    await db.commit()  # Try to create second user with same email
    user2 = User(
        email=email, password=random_lower_string(), is_active=True, password_version=1
    )  # Same email as user1
    db.add(user2)

    # This should raise an exception due to unique constraint on email
    with pytest.raises(IntegrityError):  # Could be more specific with the exact SQLAlchemy exception
        await db.commit()

    # Rollback to clean the session
    await db.rollback()


@pytest.mark.asyncio
async def test_user_update(db: AsyncSession) -> None:
    """Test updating user information"""  # Create user
    email = random_email()
    user = User(
        email=email,
        password=random_lower_string(),
        first_name="Original",
        last_name="Name",
        is_active=True,
        password_version=1,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Update user information
    user.first_name = "Updated"
    user.last_name = "UserName"
    user.is_active = False
    await db.commit()
    await db.refresh(user)

    # Check that information was updated
    assert user.first_name == "Updated"
    assert user.last_name == "UserName"
    assert not user.is_active
    assert user.updated_at is not None
