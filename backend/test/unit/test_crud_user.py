from test.utils import random_email, random_lower_string

import pytest
from fastapi import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession  # Changed import

from app.core.security import PasswordValidator
from app.crud.user_crud import user_crud
from app.models.role_model import Role
from app.schemas.user_schema import IUserCreate, IUserUpdate


@pytest.mark.asyncio
async def test_create_user(db: AsyncSession) -> None:  # Added return type
    """Test creating a user through CRUD operations"""
    # Create user data
    email = random_email()
    password = random_lower_string()
    first_name = random_lower_string()
    last_name = random_lower_string()

    # Create user schema
    user_in = IUserCreate(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )

    # Create user in DB - using keyword arguments
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Check that user was created with correct data
    assert user.email == email
    assert user.first_name == first_name
    assert user.last_name == last_name
    assert user.is_active  # Default value should be True
    assert not user.is_superuser  # Default value should be False
    assert hasattr(user, "password")
    assert user.password is not None  # Added assertion
    assert user.password != password  # Password should be hashed
    assert PasswordValidator.verify_password(password, user.password)  # Verify password hashing worked


@pytest.mark.asyncio
async def test_get_user(db: AsyncSession) -> None:  # Added return type
    """Test retrieving a user by ID"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Get the user by ID
    stored_user = await user_crud.get(id=user.id, db_session=db)

    # Check that we got the correct user
    assert stored_user
    assert user.id == stored_user.id
    assert user.email == stored_user.email
    assert user.is_active == stored_user.is_active


@pytest.mark.asyncio
async def test_get_user_by_email(db: AsyncSession) -> None:  # Added return type
    """Test retrieving a user by email"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Get the user by email
    stored_user = await user_crud.get_by_email(email=email, db_session=db)

    # Check that we got the correct user
    assert stored_user
    assert user.id == stored_user.id
    assert user.email == stored_user.email
    assert user.is_active == stored_user.is_active


@pytest.mark.asyncio
async def test_update_user(db: AsyncSession) -> None:  # Added return type
    """Test updating a user"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
        first_name="Original",
        last_name="Name",
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Create update data
    new_first_name = "Updated"
    new_last_name = "UserName"
    user_update = IUserUpdate(
        email=email,  # use existing email
        password=password,  # use existing password
        first_name=new_first_name,
        last_name=new_last_name,
    )

    # Update the user
    updated_user = await user_crud.update(obj_current=user, obj_new=user_update, db_session=db)

    # Check that user was updated correctly
    assert updated_user.id == user.id
    assert updated_user.email == user.email  # Email should remain unchanged
    assert updated_user.first_name == new_first_name
    assert updated_user.last_name == new_last_name
    assert updated_user.is_active == user.is_active  # Should remain unchanged


@pytest.mark.asyncio
async def test_update_user_password(db: AsyncSession) -> None:  # Added return type
    """Test updating a user's password"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Create update data with new password
    new_password = random_lower_string()
    user_update = IUserUpdate(
        email=email,  # use existing email
        password=new_password,
    )

    # Update the user
    updated_user = await user_crud.update(obj_current=user, obj_new=user_update, db_session=db)

    # Check that the password was updated correctly
    assert updated_user.id == user.id
    assert updated_user.email == user.email  # Email should remain unchanged
    assert updated_user.password is not None  # Added assertion
    assert PasswordValidator.verify_password(new_password, updated_user.password)
    assert user.password is not None  # Added assertion
    assert not PasswordValidator.verify_password(
        password, updated_user.password
    )  # Old password should not work


@pytest.mark.asyncio
async def test_authenticate_user(db: AsyncSession) -> None:  # Added return type
    """Test user authentication"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Authenticate with correct credentials
    authenticated_user = await user_crud.authenticate(email=email, password=password, db_session=db)

    # Check that authentication succeeds with correct credentials
    assert authenticated_user
    assert authenticated_user.id == user.id
    assert authenticated_user.email == email

    # Check that authentication fails with wrong email
    wrong_user = await user_crud.authenticate(email=random_email(), password=password, db_session=db)
    assert wrong_user is None

    # Check that authentication fails with wrong password
    wrong_user = await user_crud.authenticate(email=email, password=random_lower_string(), db_session=db)
    assert wrong_user is None


@pytest.mark.asyncio
async def test_get_multi_users(db: AsyncSession) -> None:  # Added return type
    """Test retrieving multiple users with pagination"""
    # Create several users
    user_count = 10
    for i in range(user_count):
        user_in = IUserCreate(
            email=random_email(),
            password=random_lower_string(),
        )
        await user_crud.create(obj_in=user_in, db_session=db)

    # Get users with pagination - first page
    users = await user_crud.get_multi(skip=0, limit=5, db_session=db)
    assert len(users) == 5

    # Get users with pagination - second page
    users = await user_crud.get_multi(skip=5, limit=5, db_session=db)
    assert len(users) == 5

    # Get users with a larger limit
    users = await user_crud.get_multi(skip=0, limit=20, db_session=db)
    assert len(users) >= user_count  # There might be more users from conftest setup


@pytest.mark.asyncio
async def test_delete_user(db: AsyncSession) -> None:  # Added return type
    """Test deleting a user"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Delete the user
    deleted_user = await user_crud.remove(id=user.id, db_session=db)

    # Check that the user was deleted
    assert deleted_user.id == user.id

    # Check that we can't retrieve the deleted user
    stored_user = await user_crud.get(id=user.id, db_session=db)
    assert stored_user is None


@pytest.mark.asyncio
async def test_create_user_with_duplicate_email(db: AsyncSession) -> None:
    """Test creating a user with a duplicate email"""
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(email=email, password=password)
    await user_crud.create(obj_in=user_in, db_session=db)

    with pytest.raises(HTTPException, match="User with this email already exists"):
        await user_crud.create(obj_in=user_in, db_session=db)


@pytest.mark.asyncio
async def test_password_history_enforcement(db: AsyncSession) -> None:
    """Test that a user cannot reuse any of their last 5 passwords"""
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(email=email, password=password)
    user = await user_crud.create(obj_in=user_in, db_session=db)

    for _ in range(5):
        new_password = random_lower_string()
        await user_crud.update_password(user=user, new_password=new_password, db_session=db)

    with pytest.raises(ValueError, match="Cannot reuse any of your last 5 passwords"):
        await user_crud.update_password(user=user, new_password=password, db_session=db)


@pytest.mark.asyncio
async def test_inactive_user_behavior(db: AsyncSession) -> None:
    """Test that inactive users cannot authenticate"""
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(email=email, password=password)
    user = await user_crud.create(obj_in=user_in, db_session=db)

    user.is_active = False
    await db.commit()
    await db.refresh(user)

    authenticated_user = await user_crud.authenticate(email=email, password=password, db_session=db)
    assert authenticated_user is None


@pytest.mark.asyncio
async def test_role_assignment_on_user_creation(db: AsyncSession) -> None:
    """Test assigning roles to a user during creation"""
    email = random_email()
    password = random_lower_string()
    role = Role(name="Test Role")
    db.add(role)
    await db.commit()
    await db.refresh(role)

    user_in = IUserCreate(email=email, password=password, role_id=[role.id])
    user = await user_crud.create(obj_in=user_in, db_session=db)

    assert len(user.roles) == 1
    assert user.roles[0].id == role.id


@pytest.mark.asyncio
async def test_email_verification_workflow(db: AsyncSession) -> None:
    """Test email verification workflow"""
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(email=email, password=password)
    user = await user_crud.create(obj_in=user_in, db_session=db)

    assert not user.verified

    user.verified = True
    await db.commit()
    await db.refresh(user)

    assert user.verified
