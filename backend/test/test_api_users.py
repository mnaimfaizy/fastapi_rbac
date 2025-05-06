import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.user_crud import user_crud
from app.schemas.user_schema import IUserCreate as UserCreate
from app.tests.utils import random_email, random_lower_string


@pytest.mark.asyncio
async def test_create_user(client: AsyncClient, superuser_token_headers: dict):
    """Test creating a user as superuser"""
    # Generate random user data
    email = random_email()
    password = random_lower_string()
    first_name = random_lower_string()
    last_name = random_lower_string()

    # Request data
    data = {
        "email": email,
        "password": password,
        "first_name": first_name,
        "last_name": last_name,
    }

    # Send request to create user
    response = await client.post(f"{settings.API_V1_STR}/user/", headers=superuser_token_headers, json=data)

    # Check response
    assert response.status_code == 201
    created_user = response.json()
    assert created_user["email"] == email
    assert created_user["first_name"] == first_name
    assert created_user["last_name"] == last_name
    assert created_user["is_active"] is True
    assert created_user["is_superuser"] is False
    assert "id" in created_user
    assert "password" not in created_user  # Ensure password is not returned


@pytest.mark.asyncio
async def test_create_user_existing_email(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
):
    """Test creating a user with an existing email"""
    # Create a user directly in the database
    email = random_email()
    user_in = UserCreate(
        email=email,
        password=random_lower_string(),
    )
    await user_crud.create(db, obj_in=user_in)

    # Try to create another user with the same email
    data = {
        "email": email,  # Same email
        "password": random_lower_string(),
    }

    response = await client.post(f"{settings.API_V1_STR}/user/", headers=superuser_token_headers, json=data)

    # Should return 400 Bad Request for duplicate email
    assert response.status_code == 400
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_get_users(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test retrieving users with pagination"""
    # Create some users directly in the database
    for i in range(5):
        user_in = UserCreate(
            email=random_email(),
            password=random_lower_string(),
            first_name=f"Test{i}",
            last_name=f"User{i}",
        )
        await user_crud.create(db, obj_in=user_in)

    # Send request to get users
    response = await client.get(f"{settings.API_V1_STR}/user/", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    users_response = response.json()
    assert "items" in users_response
    assert isinstance(users_response["items"], list)
    assert len(users_response["items"]) > 0  # Should return at least the created users

    # Test pagination
    response = await client.get(
        f"{settings.API_V1_STR}/user/?skip=0&limit=2", headers=superuser_token_headers
    )
    assert response.status_code == 200
    users_response = response.json()
    assert len(users_response["items"]) == 2  # Should return exactly 2 users


@pytest.mark.asyncio
async def test_get_user_me(client: AsyncClient, superuser_token_headers: dict):
    """Test retrieving the current user's info"""
    response = await client.get(f"{settings.API_V1_STR}/user/me", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == settings.FIRST_SUPERUSER_EMAIL
    assert user_data["is_active"] is True
    assert user_data["is_superuser"] is True


@pytest.mark.asyncio
async def test_update_user_me(client: AsyncClient, normal_user_token_headers: dict):
    """Test updating the current user's info"""
    # Get current user info to verify later changes
    response = await client.get(f"{settings.API_V1_STR}/user/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    user_data = response.json()
    current_email = user_data["email"]

    # Update user data
    new_first_name = random_lower_string()
    new_last_name = random_lower_string()
    data = {
        "first_name": new_first_name,
        "last_name": new_last_name,
    }

    response = await client.patch(
        f"{settings.API_V1_STR}/user/me", headers=normal_user_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200
    updated_user = response.json()
    assert updated_user["email"] == current_email  # Email should remain unchanged
    assert updated_user["first_name"] == new_first_name
    assert updated_user["last_name"] == new_last_name


@pytest.mark.asyncio
async def test_get_specific_user(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test retrieving a specific user by ID"""
    # Create a user
    email = random_email()
    user_in = UserCreate(
        email=email,
        password=random_lower_string(),
        first_name="Test",
        last_name="User",
    )
    user = await user_crud.create(db, obj_in=user_in)

    # Get the user by ID
    response = await client.get(f"{settings.API_V1_STR}/user/{user.id}", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["id"] == str(user.id)
    assert user_data["email"] == email
    assert user_data["first_name"] == "Test"
    assert user_data["last_name"] == "User"


@pytest.mark.asyncio
async def test_update_user(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test updating a user as superuser"""
    # Create a user
    email = random_email()
    user_in = UserCreate(
        email=email,
        password=random_lower_string(),
    )
    user = await user_crud.create(db, obj_in=user_in)

    # Update data
    new_first_name = "UpdatedFirstName"
    new_last_name = "UpdatedLastName"
    data = {
        "first_name": new_first_name,
        "last_name": new_last_name,
        "is_active": False,
    }

    response = await client.patch(
        f"{settings.API_V1_STR}/user/{user.id}", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200
    updated_user = response.json()
    assert updated_user["id"] == str(user.id)
    assert updated_user["email"] == email  # Email should remain unchanged
    assert updated_user["first_name"] == new_first_name
    assert updated_user["last_name"] == new_last_name
    assert updated_user["is_active"] is False  # Should be updated to False


@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test deleting a user as superuser"""
    # Create a user
    email = random_email()
    user_in = UserCreate(
        email=email,
        password=random_lower_string(),
    )
    user = await user_crud.create(db, obj_in=user_in)

    # Delete the user
    response = await client.delete(f"{settings.API_V1_STR}/user/{user.id}", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    deleted_user = response.json()
    assert deleted_user["id"] == str(user.id)

    # Verify the user is no longer retrievable
    response = await client.get(f"{settings.API_V1_STR}/user/{user.id}", headers=superuser_token_headers)
    assert response.status_code == 404
