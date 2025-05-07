import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession as SQLModelAsyncSession

from app.core.config import settings
from app.crud.role_crud import role_crud
from app.schemas.role_schema import IRoleCreate as RoleCreate

from .utils import random_lower_string


@pytest.mark.asyncio
async def test_create_role(client: AsyncClient, superuser_token_headers: dict) -> None:
    """Test creating a role as superuser"""
    # Generate random role data
    name = f"test-role-{random_lower_string(8)}"
    description = f"Test Role Description {random_lower_string(5)}"

    # Request data
    data = {
        "name": name,
        "description": description,
    }

    # Send request to create role
    response = await client.post(f"{settings.API_V1_STR}/role/", headers=superuser_token_headers, json=data)

    # Check response
    assert response.status_code == 201
    created_role = response.json()
    assert created_role["name"] == name
    assert created_role["description"] == description
    assert "id" in created_role


@pytest.mark.asyncio
async def test_create_role_existing_name(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test creating a role with an existing name"""
    # Create a role directly in the database
    name = f"unique-role-{random_lower_string(8)}"
    role_in = RoleCreate(
        name=name,
        description="Test Role",
    )
    await role_crud.create(obj_in=role_in, db_session=db)

    # Try to create another role with the same name
    data = {
        "name": name,  # Same name
        "description": "Another Role Description",
    }

    response = await client.post(f"{settings.API_V1_STR}/role/", headers=superuser_token_headers, json=data)

    # Should return 400 Bad Request for duplicate name
    assert response.status_code == 400
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_get_roles(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test retrieving roles with pagination"""
    # Create some roles directly in the database
    for i in range(5):
        role_in = RoleCreate(
            name=f"test-role-{i}-{random_lower_string(5)}",
            description=f"Test Role {i}",
        )
        await role_crud.create(obj_in=role_in, db_session=db)

    # Send request to get roles
    response = await client.get(f"{settings.API_V1_STR}/role/", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    roles_response = response.json()
    assert "items" in roles_response
    assert isinstance(roles_response["items"], list)
    assert len(roles_response["items"]) > 0  # Should return at least the created roles

    # Test pagination
    response = await client.get(
        f"{settings.API_V1_STR}/role/?skip=0&limit=2", headers=superuser_token_headers
    )
    assert response.status_code == 200
    roles_response = response.json()
    assert len(roles_response["items"]) == 2  # Should return exactly 2 roles


@pytest.mark.asyncio
async def test_get_specific_role(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test retrieving a specific role by ID"""
    # Create a role
    name = f"specific-role-{random_lower_string(8)}"
    role_in = RoleCreate(
        name=name,
        description="Specific Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Get the role by ID
    response = await client.get(f"{settings.API_V1_STR}/role/{role.id}", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    role_data = response.json()
    assert role_data["id"] == str(role.id)
    assert role_data["name"] == name
    assert role_data["description"] == "Specific Test Role"


@pytest.mark.asyncio
async def test_get_role_by_name(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test retrieving a role by name"""
    # Create a role
    name = f"name-lookup-role-{random_lower_string(8)}"
    role_in = RoleCreate(
        name=name,
        description="Name Lookup Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Get the role by name
    response = await client.get(f"{settings.API_V1_STR}/role/by-name/{name}", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    role_data = response.json()
    assert role_data["id"] == str(role.id)
    assert role_data["name"] == name
    assert role_data["description"] == "Name Lookup Test Role"


@pytest.mark.asyncio
async def test_update_role(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test updating a role as superuser"""
    # Create a role
    name = f"update-role-{random_lower_string(8)}"
    role_in = RoleCreate(
        name=name,
        description="Original Description",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Update data
    new_description = f"Updated Description {random_lower_string(5)}"
    data = {
        "description": new_description,
    }

    response = await client.patch(
        f"{settings.API_V1_STR}/role/{role.id}", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200
    updated_role = response.json()
    assert updated_role["id"] == str(role.id)
    assert updated_role["name"] == name  # Name should remain unchanged
    assert updated_role["description"] == new_description


@pytest.mark.asyncio
async def test_update_role_name(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test updating a role's name"""
    # Create a role
    name = f"rename-role-{random_lower_string(8)}"
    role_in = RoleCreate(
        name=name,
        description="Role to be renamed",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Update data with new name
    new_name = f"new-name-{random_lower_string(8)}"
    data = {
        "name": new_name,
    }

    response = await client.patch(
        f"{settings.API_V1_STR}/role/{role.id}", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200
    updated_role = response.json()
    assert updated_role["id"] == str(role.id)
    assert updated_role["name"] == new_name
    assert updated_role["description"] == "Role to be renamed"  # Description should remain unchanged

    # Verify the role is now retrievable by the new name
    response = await client.get(
        f"{settings.API_V1_STR}/role/by-name/{new_name}", headers=superuser_token_headers
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_role(
    client: AsyncClient, superuser_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test deleting a role as superuser"""
    # Create a role
    name = f"delete-role-{random_lower_string(8)}"
    role_in = RoleCreate(
        name=name,
        description="Role to be deleted",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Delete the role
    response = await client.delete(f"{settings.API_V1_STR}/role/{role.id}", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    deleted_role = response.json()
    assert deleted_role["id"] == str(role.id)
    assert deleted_role["name"] == name

    # Verify the role is no longer retrievable
    response = await client.get(f"{settings.API_V1_STR}/role/{role.id}", headers=superuser_token_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_role_access_normal_user(
    client: AsyncClient, normal_user_token_headers: dict, db: SQLModelAsyncSession
) -> None:
    """Test that normal users cannot create roles"""
    # Generate random role data
    name = f"unauthorized-role-{random_lower_string(8)}"
    description = "Unauthorized Role Description"

    # Request data
    data = {
        "name": name,
        "description": description,
    }

    # Send request to create role with normal user token
    response = await client.post(f"{settings.API_V1_STR}/role/", headers=normal_user_token_headers, json=data)

    # Should return 403 Forbidden for insufficient permissions
    assert response.status_code == 403
