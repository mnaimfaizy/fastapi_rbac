from uuid import UUID

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.permission_crud import permission_crud
from app.schemas.permission_schema import IPermissionCreate, IPermissionUpdate

from .utils import random_lower_string


@pytest.mark.asyncio
async def test_create_permission(db: AsyncSession) -> None:
    """Test creating a permission through CRUD operations"""
    # Create permission data
    name = f"test-permission-{random_lower_string(8)}"
    description = "Test Permission Description"
    # Create permission schema
    permission_in = IPermissionCreate(
        name=name,
        description=description,
    )
    # Create permission in DB
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Check that permission was created correctly
    assert permission.name == name
    assert permission.description == description
    assert isinstance(permission.id, UUID)


@pytest.mark.asyncio
async def test_get_permission(db: AsyncSession) -> None:
    """Test retrieving a permission by ID"""
    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(
        name=name,
        description="Test Permission",
    )
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Get the permission by ID
    stored_permission = await permission_crud.get(id=permission.id, db_session=db)
    # Check that the retrieved permission matches
    assert stored_permission
    assert stored_permission.id == permission.id
    assert stored_permission.name == name
    assert stored_permission.description == permission.description


@pytest.mark.asyncio
async def test_get_permission_by_name(db: AsyncSession) -> None:
    """Test retrieving a permission by name"""
    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(
        name=name,
        description="Test Permission",
    )
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Get the permission by name
    stored_permission = await permission_crud.get_permission_by_name(name=name, db_session=db)
    # Check that the retrieved permission matches
    assert stored_permission
    assert stored_permission.id == permission.id
    assert stored_permission.name == name
    assert stored_permission.description == permission.description


@pytest.mark.asyncio
async def test_update_permission(db: AsyncSession) -> None:
    """Test updating a permission"""
    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(
        name=name,
        description="Original Description",
    )
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Update the permission description
    new_description = "Updated Description"
    permission_update = IPermissionUpdate(description=new_description)
    updated_permission = await permission_crud.update(
        obj_current=permission, obj_new=permission_update, db_session=db
    )
    # Check that the permission was updated
    assert updated_permission.id == permission.id
    assert updated_permission.name == name
    assert updated_permission.description == new_description


@pytest.mark.asyncio
async def test_update_permission_name(db: AsyncSession) -> None:
    """Test updating a permission's name"""
    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(
        name=name,
        description="Test Permission",
    )
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Update the permission name
    new_name = f"updated-permission-{random_lower_string(8)}"
    permission_update = IPermissionUpdate(name=new_name)
    updated_permission = await permission_crud.update(
        obj_current=permission, obj_new=permission_update, db_session=db
    )
    # Check that the permission was updated
    assert updated_permission.id == permission.id
    assert updated_permission.name == new_name
    assert updated_permission.description == permission.description
    # Verify the update by getting the permission with the new name
    stored_permission = await permission_crud.get_permission_by_name(name=new_name, db_session=db)
    assert stored_permission
    assert stored_permission.id == permission.id


@pytest.mark.asyncio
async def test_get_multi_permissions(db: AsyncSession) -> None:
    """Test retrieving multiple permissions with pagination"""
    # Create several permissions
    permission_count = 10
    for i in range(permission_count):
        permission_in = IPermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)
    # Get permissions with pagination
    permissions = await permission_crud.get_multi(skip=0, limit=5, db_session=db)
    # Check that we got the right number of permissions
    assert len(permissions) == 5
    # Get next page
    permissions_page_2 = await permission_crud.get_multi(skip=5, limit=5, db_session=db)
    # Check that we got the second page
    assert len(permissions_page_2) == 5
    # Ensure both pages have different items
    assert permissions[0].id != permissions_page_2[0].id


@pytest.mark.asyncio
async def test_delete_permission(db: AsyncSession) -> None:
    """Test deleting a permission"""
    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(
        name=name,
        description="Test Permission",
    )
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Delete the permission
    deleted_permission = await permission_crud.remove(id=permission.id, db_session=db)
    # Check that the deleted permission is returned
    assert deleted_permission.id == permission.id
    assert deleted_permission.name == name
    # Verify that the permission is actually deleted
    stored_permission = await permission_crud.get(id=permission.id, db_session=db)
    assert stored_permission is None
