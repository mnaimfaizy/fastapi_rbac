import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.tests.utils import random_lower_string
from app.crud.permission_crud import permission_crud
from app.schemas.permission_schema import IPermissionCreate as PermissionCreate


@pytest.mark.asyncio
async def test_create_permission(client: AsyncClient, superuser_token_headers: dict):
    """Test creating a permission as superuser"""
    # Generate random permission data
    name = f"test-permission-{random_lower_string(8)}"
    description = f"Test Permission Description {random_lower_string(5)}"

    # Request data
    data = {
        "name": name,
        "description": description,
    }

    # Send request to create permission
    response = await client.post(
        f"{settings.API_V1_STR}/permission/", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 201
    created_permission = response.json()
    assert created_permission["name"] == name
    assert created_permission["description"] == description
    assert "id" in created_permission


@pytest.mark.asyncio
async def test_create_permission_existing_name(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
):
    """Test creating a permission with an existing name"""
    # Create a permission directly in the database
    name = f"unique-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(
        name=name,
        description="Test Permission",
    )
    await permission_crud.create(db, obj_in=permission_in)

    # Try to create another permission with the same name
    data = {
        "name": name,  # Same name
        "description": "Another Permission Description",
    }

    response = await client.post(
        f"{settings.API_V1_STR}/permission/", headers=superuser_token_headers, json=data
    )

    # Should return 400 Bad Request for duplicate name
    assert response.status_code == 400
    assert "detail" in response.json()


@pytest.mark.asyncio
async def test_get_permissions(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test retrieving permissions with pagination"""
    # Create some permissions directly in the database
    for i in range(5):
        permission_in = PermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
        )
        await permission_crud.create(db, obj_in=permission_in)

    # Send request to get permissions
    response = await client.get(f"{settings.API_V1_STR}/permission/", headers=superuser_token_headers)

    # Check response
    assert response.status_code == 200
    permissions_response = response.json()
    assert "items" in permissions_response
    assert isinstance(permissions_response["items"], list)
    assert len(permissions_response["items"]) > 0  # Should return at least the created permissions

    # Test pagination
    response = await client.get(
        f"{settings.API_V1_STR}/permission/?skip=0&limit=2", headers=superuser_token_headers
    )
    assert response.status_code == 200
    permissions_response = response.json()
    assert len(permissions_response["items"]) == 2  # Should return exactly 2 permissions


@pytest.mark.asyncio
async def test_get_specific_permission(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test retrieving a specific permission by ID"""
    # Create a permission
    name = f"specific-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(
        name=name,
        description="Specific Test Permission",
    )
    permission = await permission_crud.create(db, obj_in=permission_in)

    # Get the permission by ID
    response = await client.get(
        f"{settings.API_V1_STR}/permission/{permission.id}", headers=superuser_token_headers
    )

    # Check response
    assert response.status_code == 200
    permission_data = response.json()
    assert permission_data["id"] == str(permission.id)
    assert permission_data["name"] == name
    assert permission_data["description"] == "Specific Test Permission"


@pytest.mark.asyncio
async def test_get_permission_by_name(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test retrieving a permission by name"""
    # Create a permission
    name = f"name-lookup-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(
        name=name,
        description="Name Lookup Test Permission",
    )
    permission = await permission_crud.create(db, obj_in=permission_in)

    # Get the permission by name
    response = await client.get(
        f"{settings.API_V1_STR}/permission/by-name/{name}", headers=superuser_token_headers
    )

    # Check response
    assert response.status_code == 200
    permission_data = response.json()
    assert permission_data["id"] == str(permission.id)
    assert permission_data["name"] == name
    assert permission_data["description"] == "Name Lookup Test Permission"


@pytest.mark.asyncio
async def test_update_permission(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test updating a permission as superuser"""
    # Create a permission
    name = f"update-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(
        name=name,
        description="Original Description",
    )
    permission = await permission_crud.create(db, obj_in=permission_in)

    # Update data
    new_description = f"Updated Description {random_lower_string(5)}"
    data = {
        "description": new_description,
    }

    response = await client.patch(
        f"{settings.API_V1_STR}/permission/{permission.id}", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200
    updated_permission = response.json()
    assert updated_permission["id"] == str(permission.id)
    assert updated_permission["name"] == name  # Name should remain unchanged
    assert updated_permission["description"] == new_description


@pytest.mark.asyncio
async def test_update_permission_name(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test updating a permission's name"""
    # Create a permission
    name = f"rename-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(
        name=name,
        description="Permission to be renamed",
    )
    permission = await permission_crud.create(db, obj_in=permission_in)

    # Update data with new name
    new_name = f"new-name-{random_lower_string(8)}"
    data = {
        "name": new_name,
    }

    response = await client.patch(
        f"{settings.API_V1_STR}/permission/{permission.id}", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200
    updated_permission = response.json()
    assert updated_permission["id"] == str(permission.id)
    assert updated_permission["name"] == new_name
    assert (
        updated_permission["description"] == "Permission to be renamed"
    )  # Description should remain unchanged

    # Verify the permission is now retrievable by the new name
    response = await client.get(
        f"{settings.API_V1_STR}/permission/by-name/{new_name}", headers=superuser_token_headers
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_permission(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test deleting a permission as superuser"""
    # Create a permission
    name = f"delete-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(
        name=name,
        description="Permission to be deleted",
    )
    permission = await permission_crud.create(db, obj_in=permission_in)

    # Delete the permission
    response = await client.delete(
        f"{settings.API_V1_STR}/permission/{permission.id}", headers=superuser_token_headers
    )

    # Check response
    assert response.status_code == 200
    deleted_permission = response.json()
    assert deleted_permission["id"] == str(permission.id)
    assert deleted_permission["name"] == name

    # Verify the permission is no longer retrievable
    response = await client.get(
        f"{settings.API_V1_STR}/permission/{permission.id}", headers=superuser_token_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_permission_access_normal_user(
    client: AsyncClient, normal_user_token_headers: dict, db: AsyncSession
):
    """Test that normal users cannot create permissions"""
    # Generate random permission data
    name = f"unauthorized-permission-{random_lower_string(8)}"
    description = "Unauthorized Permission Description"

    # Request data
    data = {
        "name": name,
        "description": description,
    }

    # Send request to create permission with normal user token
    response = await client.post(
        f"{settings.API_V1_STR}/permission/", headers=normal_user_token_headers, json=data
    )

    # Should return 403 Forbidden for insufficient permissions
    assert response.status_code == 403
