from uuid import UUID

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.role_crud import role_crud
from app.schemas.role_schema import IRoleCreate, IRoleUpdate
from app.tests.utils import random_lower_string


@pytest.mark.asyncio
async def test_create_role(db: AsyncSession):
    """Test creating a role through CRUD operations"""
    # Create role data
    name = f"test-role-{random_lower_string(8)}"
    description = "Test Role Description"
    # Create role schema
    role_in = IRoleCreate(
        name=name,
        description=description,
    )
    # Create role in DB
    role = await role_crud.create(obj_in=role_in, db_session=db)
    # Check that role was created correctly
    assert role.name == name
    assert role.description == description
    assert isinstance(role.id, UUID)


@pytest.mark.asyncio
async def test_get_role(db: AsyncSession):
    """Test retrieving a role by ID"""
    # Create a role
    name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(
        name=name,
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)
    # Get the role by ID
    stored_role = await role_crud.get(id=role.id, db_session=db)
    # Check that the retrieved role matches
    assert stored_role
    assert stored_role.id == role.id
    assert stored_role.name == name
    assert stored_role.description == role.description


@pytest.mark.asyncio
async def test_get_role_by_name(db: AsyncSession):
    """Test retrieving a role by name"""
    # Create a role
    name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(
        name=name,
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)
    # Get the role by name
    stored_role = await role_crud.get_role_by_name(name=name, db_session=db)
    # Check that the retrieved role matches
    assert stored_role
    assert stored_role.id == role.id
    assert stored_role.name == name
    assert stored_role.description == role.description


@pytest.mark.asyncio
async def test_update_role(db: AsyncSession):
    """Test updating a role"""
    # Create a role
    name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(
        name=name,
        description="Original Description",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)
    # Update the role description
    new_description = "Updated Description"
    role_update = IRoleUpdate(description=new_description)
    updated_role = await role_crud.update(obj_current=role, obj_new=role_update, db_session=db)
    # Check that the role was updated
    assert updated_role.id == role.id
    assert updated_role.name == name
    assert updated_role.description == new_description


@pytest.mark.asyncio
async def test_update_role_name(db: AsyncSession):
    """Test updating a role's name"""
    # Create a role
    name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(
        name=name,
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)
    # Update the role name
    new_name = f"updated-role-{random_lower_string(8)}"
    role_update = IRoleUpdate(name=new_name)
    updated_role = await role_crud.update(obj_current=role, obj_new=role_update, db_session=db)
    # Check that the role was updated
    assert updated_role.id == role.id
    assert updated_role.name == new_name
    assert updated_role.description == role.description
    # Verify the update by getting the role with the new name
    stored_role = await role_crud.get_role_by_name(name=new_name, db_session=db)
    assert stored_role
    assert stored_role.id == role.id


@pytest.mark.asyncio
async def test_get_multi_roles(db: AsyncSession):
    """Test retrieving multiple roles with pagination"""
    # Create several roles
    role_count = 10
    for i in range(role_count):
        role_in = IRoleCreate(
            name=f"test-role-{i}-{random_lower_string(5)}",
            description=f"Test Role {i}",
        )
        await role_crud.create(obj_in=role_in, db_session=db)
    # Get roles with pagination
    roles = await role_crud.get_multi(skip=0, limit=5, db_session=db)
    # Check that we got the right number of roles
    assert len(roles) == 5
    # Get next page
    roles_page_2 = await role_crud.get_multi(skip=5, limit=5, db_session=db)
    # Check that we got the second page
    assert len(roles_page_2) == 5
    # Ensure both pages have different items
    assert roles[0].id != roles_page_2[0].id


@pytest.mark.asyncio
async def test_delete_role(db: AsyncSession):
    """Test deleting a role"""
    # Create a role
    name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(
        name=name,
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)
    # Delete the role
    deleted_role = await role_crud.remove(id=role.id, db_session=db)
    # Check that the deleted role is returned
    assert deleted_role.id == role.id
    assert deleted_role.name == name
    # Verify that the role is actually deleted
    stored_role = await role_crud.get(id=role.id, db_session=db)
    assert stored_role is None
