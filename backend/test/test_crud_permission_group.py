from uuid import UUID

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.permission_crud import permission_crud
from app.crud.permission_group_crud import permission_group_crud
from app.models.permission_group_model import PermissionGroup
from app.models.permission_model import Permission
from app.schemas.permission_group_schema import IPermissionGroupCreate, IPermissionGroupUpdate
from app.schemas.permission_schema import IPermissionCreate

from .utils import random_lower_string


@pytest.mark.asyncio
async def test_create_permission_group(db: AsyncSession) -> None:
    """Test creating a permission group through CRUD operations"""
    name = f"test-group-{random_lower_string(8)}"
    # Create permission group schema - without description
    group_in = IPermissionGroupCreate(name=name)
    # Create permission group in DB
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)
    # Check that permission group was created correctly
    assert group.name == name
    assert isinstance(group.id, UUID)


@pytest.mark.asyncio
async def test_get_permission_group_by_id(db: AsyncSession) -> None:
    """Test retrieving a permission group by ID"""
    # Create a permission group
    name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=name)
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)
    # Get the group by ID
    stored_group = await permission_group_crud.get_group_by_id(group_id=group.id, db_session=db)
    # Check that the retrieved group matches
    assert stored_group
    assert stored_group.id == group.id
    assert stored_group.name == name


@pytest.mark.asyncio
async def test_get_permission_group_by_name(db: AsyncSession) -> None:
    """Test retrieving a permission group by name"""
    # Create a permission group
    name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=name)
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)
    # Get the group by name
    stored_group = await permission_group_crud.get_group_by_name(name=name, db_session=db)
    # Check that the retrieved group matches
    assert stored_group
    assert stored_group.id == group.id
    assert stored_group.name == name


@pytest.mark.asyncio
async def test_update_permission_group(db: AsyncSession) -> None:
    """Test updating a permission group"""
    # Create a permission group
    old_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=old_name)
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)
    # Update the group name
    new_name = f"updated-name-{random_lower_string(8)}"
    group_update = IPermissionGroupUpdate(name=new_name)
    updated_group = await permission_group_crud.update(obj_current=group, obj_new=group_update, db_session=db)
    # Check that the group was updated
    assert updated_group.id == group.id
    assert updated_group.name == new_name


@pytest.mark.asyncio
async def test_update_permission_group_name(db: AsyncSession) -> None:
    """Test updating a permission group's name"""
    # Create a permission group
    name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=name)
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)
    # Update the group name
    new_name = f"updated-group-{random_lower_string(8)}"
    group_update = IPermissionGroupUpdate(name=new_name)
    updated_group = await permission_group_crud.update(obj_current=group, obj_new=group_update, db_session=db)
    # Check that the group was updated
    assert updated_group.id == group.id
    assert updated_group.name == new_name
    # Verify the update by getting the group with the new name
    stored_group = await permission_group_crud.get_group_by_name(name=new_name, db_session=db)
    assert stored_group
    assert stored_group.id == group.id


@pytest.mark.asyncio
async def test_get_multi_permission_groups(db: AsyncSession) -> None:
    """Test retrieving multiple permission groups with pagination"""
    # Create several permission groups
    group_prefix = random_lower_string(5)
    group_count = 10
    for i in range(group_count):
        group_in = IPermissionGroupCreate(
            name=f"test-group-{group_prefix}-{i}",
        )
        await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Get groups with pagination
    groups = await permission_group_crud.get_multi(skip=0, limit=5, db_session=db)
    # Check that we got the right number of groups
    assert len(groups) == 5

    # Get next page
    groups_page_2 = await permission_group_crud.get_multi(skip=5, limit=5, db_session=db)
    # Check that we got the second page
    assert len(groups_page_2) == 5
    # Ensure both pages have different items
    assert groups[0].id != groups_page_2[0].id


@pytest.mark.asyncio
async def test_delete_permission_group(db: AsyncSession) -> None:
    """Test deleting a permission group"""
    # Create a permission group
    name = f"test-group-to-delete-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=name)
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Delete the group
    deleted_group = await permission_group_crud.remove(id=group.id, db_session=db)

    # Check that the deleted group is returned
    assert deleted_group.id == group.id
    assert deleted_group.name == name

    # Verify that the group is actually deleted
    stored_group = await permission_group_crud.get(id=group.id, db_session=db)
    assert stored_group is None


@pytest.mark.asyncio
async def test_add_permissions_to_group(db: AsyncSession) -> None:
    """Test adding permissions to a permission group"""
    # Create a permission group
    group_name = f"test-group-with-perms-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name)
    group: PermissionGroup = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create permissions in this group
    permission_count = 5
    for i in range(permission_count):
        suffix = random_lower_string(5)
        permission_in = IPermissionCreate(
            name=f"group-permission-{i}-{suffix}",
            description=f"Group Permission {i}",
            group_id=group.id,
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Verify permissions were created with the correct group_id
    query = select(Permission).where(Permission.group_id == group.id)
    result = await db.exec(query)
    permissions = result.all()

    # Assert that the correct number of permissions were created
    assert len(permissions) == permission_count

    # Assert that all permissions have the correct group_id
    for permission in permissions:
        assert permission.group_id == group.id

    # Verify that we can load the group with its permissions
    stored_group = await permission_group_crud.get_group_by_id(group_id=group.id, db_session=db)
    assert stored_group is not None
    assert stored_group.id == group.id
    assert stored_group.name == group_name


@pytest.mark.asyncio
async def test_permission_group_with_subgroups(db: AsyncSession) -> None:
    """Test permission groups with subgroups relationship"""
    # Create a parent permission group
    parent_group_name = f"parent-group-{random_lower_string(8)}"
    parent_group_in = IPermissionGroupCreate(name=parent_group_name)
    parent_group = await permission_group_crud.create(obj_in=parent_group_in, db_session=db)

    # Create child permission groups
    child_group_count = 3
    child_groups = []
    for i in range(child_group_count):
        child_name = f"child-group-{i}-{random_lower_string(5)}"
        child_group_in = IPermissionGroupCreate(
            name=child_name,
            permission_group_id=parent_group.id,  # Set parent relationship
        )
        child_group = await permission_group_crud.create(obj_in=child_group_in, db_session=db)
        child_groups.append(child_group)

    # Verify parent-child relationships using SQLModel query
    query = select(PermissionGroup).where(PermissionGroup.permission_group_id == parent_group.id)
    result = await db.exec(query)
    children = result.all()

    # Assert that we have the correct number of child groups
    assert len(children) == child_group_count

    # Assert that all children point to the correct parent
    for child in children:
        assert child.permission_group_id == parent_group.id


@pytest.mark.asyncio
async def test_permission_count_by_group(db: AsyncSession) -> None:
    """Test counting permissions by group"""
    # Create two permission groups
    group1_name = f"test-count-group1-{random_lower_string(8)}"
    group1_in = IPermissionGroupCreate(name=group1_name)
    group1 = await permission_group_crud.create(obj_in=group1_in, db_session=db)

    group2_name = f"test-count-group2-{random_lower_string(8)}"
    group2_in = IPermissionGroupCreate(name=group2_name)
    group2 = await permission_group_crud.create(obj_in=group2_in, db_session=db)

    # Create permissions in group 1
    for i in range(3):
        suffix = random_lower_string(5)
        permission_in = IPermissionCreate(
            name=f"count-g1-perm-{i}-{suffix}",
            description=f"Count Group 1 Permission {i}",
            group_id=group1.id,
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Create permissions in group 2
    for i in range(5):
        suffix = random_lower_string(5)
        permission_in = IPermissionCreate(
            name=f"count-g2-perm-{i}-{suffix}",
            description=f"Count Group 2 Permission {i}",
            group_id=group2.id,
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Count permissions in group 1 using SQLModel query
    query1 = select(Permission).where(Permission.group_id == group1.id)
    result1 = await db.exec(query1)
    permissions1 = result1.all()
    assert len(permissions1) == 3

    # Count permissions in group 2 using SQLModel query
    query2 = select(Permission).where(Permission.group_id == group2.id)
    result2 = await db.exec(query2)
    permissions2 = result2.all()
    assert len(permissions2) == 5
