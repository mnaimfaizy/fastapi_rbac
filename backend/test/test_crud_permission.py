from uuid import UUID

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.permission_crud import permission_crud
from app.crud.permission_group_crud import permission_group_crud
from app.crud.role_crud import role_crud
from app.models import RolePermission
from app.schemas.permission_group_schema import IPermissionGroupCreate
from app.schemas.permission_schema import IPermissionCreate, IPermissionUpdate
from app.schemas.role_schema import IRoleCreate

from .utils import random_lower_string


@pytest.mark.asyncio
async def test_create_permission(db: AsyncSession) -> None:
    """Test creating a permission through CRUD operations"""
    # Create a permission group first since permissions require a group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create permission data
    name = f"test-permission-{random_lower_string(8)}"
    description = "Test Permission Description"
    # Create permission schema
    permission_in = IPermissionCreate(name=name, description=description, group_id=group.id)
    # Create permission in DB
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Check that permission was created correctly
    assert permission.name == name
    assert permission.description == description
    assert permission.group_id == group.id
    assert isinstance(permission.id, UUID)


@pytest.mark.asyncio
async def test_get_permission(db: AsyncSession) -> None:
    """Test retrieving a permission by ID"""
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Test Permission", group_id=group.id)
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Get the permission by ID
    stored_permission = await permission_crud.get(id=permission.id, db_session=db)
    # Check that the retrieved permission matches
    assert stored_permission
    assert stored_permission.id == permission.id
    assert stored_permission.name == name
    assert stored_permission.description == permission.description
    assert stored_permission.group_id == group.id


@pytest.mark.asyncio
async def test_get_permission_by_name(db: AsyncSession) -> None:
    """Test retrieving a permission by name"""
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Test Permission", group_id=group.id)
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Get the permission by name
    stored_permission = await permission_crud.get_permission_by_name(name=name, db_session=db)
    # Check that the retrieved permission matches
    assert stored_permission
    assert stored_permission.id == permission.id
    assert stored_permission.name == name
    assert stored_permission.description == permission.description


@pytest.mark.asyncio
async def test_permission_exists(db: AsyncSession) -> None:
    """Test checking if a permission exists by name"""
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Test Permission", group_id=group.id)
    await permission_crud.create(obj_in=permission_in, db_session=db)

    # Check that the permission exists
    exists = await permission_crud.permission_exists(name=name, db_session=db)
    assert exists is True

    # Check that a non-existent permission does not exist
    non_existent_name = f"non-existent-{random_lower_string(8)}"
    exists = await permission_crud.permission_exists(name=non_existent_name, db_session=db)
    assert exists is False


@pytest.mark.asyncio
async def test_get_permission_by_id(db: AsyncSession) -> None:
    """Test retrieving a permission by ID with relationships loaded"""
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Test Permission", group_id=group.id)
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)

    # Get the permission by ID with relationships
    stored_permission = await permission_crud.get_permission_by_id(permission_id=permission.id, db_session=db)

    # Check that the retrieved permission matches and relationships are loaded
    assert stored_permission
    assert stored_permission.id == permission.id
    assert stored_permission.name == name
    assert stored_permission.group is not None
    assert stored_permission.group.id == group.id
    assert stored_permission.group.name == group_name


@pytest.mark.asyncio
async def test_update_permission(db: AsyncSession) -> None:
    """Test updating a permission"""
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Original Description", group_id=group.id)
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
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Test Permission", group_id=group.id)
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
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create several permissions
    permission_count = 10
    for i in range(permission_count):
        permission_in = IPermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
            group_id=group.id,
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
async def test_get_permissions_by_group(db: AsyncSession) -> None:
    """Test retrieving permissions by group"""
    # Create two permission groups
    group_name_1 = f"test-group-1-{random_lower_string(8)}"
    group_in_1 = IPermissionGroupCreate(name=group_name_1, description="Test Group 1")
    group1 = await permission_group_crud.create(obj_in=group_in_1, db_session=db)

    group_name_2 = f"test-group-2-{random_lower_string(8)}"
    group_in_2 = IPermissionGroupCreate(name=group_name_2, description="Test Group 2")
    group2 = await permission_group_crud.create(obj_in=group_in_2, db_session=db)

    # Create permissions in group 1
    for i in range(3):
        permission_in = IPermissionCreate(
            name=f"group1-permission-{i}-{random_lower_string(5)}",
            description=f"Group 1 Permission {i}",
            group_id=group1.id,
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Create permissions in group 2
    for i in range(5):
        permission_in = IPermissionCreate(
            name=f"group2-permission-{i}-{random_lower_string(5)}",
            description=f"Group 2 Permission {i}",
            group_id=group2.id,
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Get permissions for group 1
    group1_permissions = await permission_crud.get_permissions_by_group(group_id=group1.id, db_session=db)
    # Check that we got the right number of permissions
    assert len(group1_permissions) == 3

    # Get permissions for group 2
    group2_permissions = await permission_crud.get_permissions_by_group(group_id=group2.id, db_session=db)
    # Check that we got the right number of permissions
    assert len(group2_permissions) == 5

    # Check that all permissions have the correct group_id
    for permission in group1_permissions:
        assert permission.group_id == group1.id

    for permission in group2_permissions:
        assert permission.group_id == group2.id


@pytest.mark.asyncio
async def test_search_permissions(db: AsyncSession) -> None:
    """Test searching permissions by name or description"""
    # Create a permission group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create permissions with different names and descriptions
    unique_term = random_lower_string(5)

    # Create permissions with the unique term in name
    for i in range(3):
        permission_in = IPermissionCreate(
            name=f"name-{unique_term}-{i}", description=f"Regular description {i}", group_id=group.id
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Create permissions with the unique term in description
    for i in range(2):
        permission_in = IPermissionCreate(
            name=f"regular-name-{i}", description=f"Description with {unique_term} term", group_id=group.id
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Create additional permissions without the term
    for i in range(4):
        permission_in = IPermissionCreate(
            name=f"other-name-{i}", description=f"Other description {i}", group_id=group.id
        )
        await permission_crud.create(obj_in=permission_in, db_session=db)

    # Search permissions with the unique term
    search_results = await permission_crud.search_permissions(search_term=unique_term, db_session=db)

    # Should find 5 permissions (3 in name + 2 in description)
    assert len(search_results) == 5

    # Verify results contain the term in either name or description
    for permission in search_results:
        name_match = permission.name and unique_term in permission.name
        desc_match = permission.description and unique_term in permission.description
        assert name_match or desc_match


@pytest.mark.asyncio
async def test_delete_permission(db: AsyncSession) -> None:
    """Test deleting a permission"""
    # Create a permission group first
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    name = f"test-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(name=name, description="Test Permission", group_id=group.id)
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)
    # Delete the permission
    deleted_permission = await permission_crud.remove(id=permission.id, db_session=db)
    # Check that the deleted permission is returned
    assert deleted_permission.id == permission.id
    assert deleted_permission.name == name
    # Verify that the permission is actually deleted
    stored_permission = await permission_crud.get(id=permission.id, db_session=db)
    assert stored_permission is None


@pytest.mark.asyncio
async def test_assign_permissions_to_role(db: AsyncSession) -> None:
    """Test assigning permissions to a role"""
    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create permissions
    permission_ids = []
    for i in range(3):
        permission_in = IPermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
            group_id=group.id,
        )
        permission = await permission_crud.create(obj_in=permission_in, db_session=db)
        permission_ids.append(permission.id)

    # Assign permissions to the role
    await permission_crud.assign_permissions_to_role(
        role_id=role.id, permissions=permission_ids, db_session=db
    )

    # Verify that the permissions were assigned to the role
    stmt = select(RolePermission).where((RolePermission.role_id == role.id))
    result = await db.execute(stmt)
    role_permissions = result.scalars().all()

    # Check that we have the right number of role permission associations
    assert len(role_permissions) == 3

    # Check that all permission IDs are in the role permissions
    assigned_permission_ids = [rp.permission_id for rp in role_permissions]
    for permission_id in permission_ids:
        assert permission_id in assigned_permission_ids


@pytest.mark.asyncio
async def test_assign_permissions_to_role_already_assigned(db: AsyncSession) -> None:
    """Test assigning already assigned permissions to a role"""
    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission
    permission_in = IPermissionCreate(
        name=f"test-permission-{random_lower_string(5)}", description="Test Permission", group_id=group.id
    )
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)

    # Assign permission to the role
    await permission_crud.assign_permissions_to_role(
        role_id=role.id, permissions=[permission.id], db_session=db
    )

    # Try to assign the same permission again and expect an HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await permission_crud.assign_permissions_to_role(
            role_id=role.id, permissions=[permission.id], db_session=db
        )

    # Check that the right error is raised
    assert excinfo.value.status_code == 409
    assert "already assigned" in excinfo.value.detail


@pytest.mark.asyncio
async def test_remove_permissions_from_role(db: AsyncSession) -> None:
    """Test removing permissions from a role"""
    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create permissions
    permission_ids = []
    for i in range(5):
        permission_in = IPermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
            group_id=group.id,
        )
        permission = await permission_crud.create(obj_in=permission_in, db_session=db)
        permission_ids.append(permission.id)

    # Assign all permissions to the role
    await permission_crud.assign_permissions_to_role(
        role_id=role.id, permissions=permission_ids, db_session=db
    )

    # Remove some permissions from the role
    permissions_to_remove = permission_ids[:2]  # Remove first 2 permissions
    await permission_crud.remove_permissions_from_role(
        role_id=role.id, permissions=permissions_to_remove, db_session=db
    )

    # Verify that the permissions were removed
    stmt = select(RolePermission).where((RolePermission.role_id == role.id))
    result = await db.execute(stmt)
    role_permissions = result.scalars().all()

    # Check that we have the right number of role permission associations
    assert len(role_permissions) == 3  # 5 total - 2 removed = 3 remaining

    # Check that removed permission IDs are not in the role permissions
    remaining_permission_ids = [rp.permission_id for rp in role_permissions]
    for permission_id in permissions_to_remove:
        assert permission_id not in remaining_permission_ids

    # Check that non-removed permission IDs are still in the role permissions
    for permission_id in permission_ids[2:]:
        assert permission_id in remaining_permission_ids


@pytest.mark.asyncio
async def test_create_bulk_permissions(db: AsyncSession) -> None:
    """Test creating multiple permissions in bulk"""
    # Create a permission group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a list of permission create schemas
    bulk_prefix = random_lower_string(8)
    permission_schemas = [
        IPermissionCreate(
            name=f"bulk-permission-{bulk_prefix}-{i}", description=f"Bulk Permission {i}", group_id=group.id
        )
        for i in range(5)
    ]

    # Create permissions in bulk
    created_permissions = await permission_crud.create_bulk(obj_in_list=permission_schemas, db_session=db)

    # Check that all permissions were created
    assert len(created_permissions) == 5

    # Check that each permission has the right data
    for i, permission in enumerate(created_permissions):
        assert f"bulk-permission-{bulk_prefix}-{i}" == permission.name
        assert f"Bulk Permission {i}" == permission.description
        assert group.id == permission.group_id
        assert isinstance(permission.id, UUID)


@pytest.mark.asyncio
async def test_create_bulk_permissions_duplicate_name(db: AsyncSession) -> None:
    """Test creating bulk permissions with duplicate names fails"""
    # Create a permission group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IPermissionGroupCreate(name=group_name, description="Test Group")
    group = await permission_group_crud.create(obj_in=group_in, db_session=db)

    # Create a permission first
    duplicate_name = f"duplicate-permission-{random_lower_string(8)}"
    permission_in = IPermissionCreate(
        name=duplicate_name, description="Original Permission", group_id=group.id
    )
    await permission_crud.create(obj_in=permission_in, db_session=db)

    # Create a list of permission create schemas with one having the same name
    bulk_prefix = random_lower_string(8)
    permission_schemas = [
        IPermissionCreate(
            name=f"bulk-permission-{bulk_prefix}-{i}", description=f"Bulk Permission {i}", group_id=group.id
        )
        for i in range(3)
    ]

    # Add a permission with duplicate name
    permission_schemas.append(
        IPermissionCreate(
            name=duplicate_name, description="Duplicate Permission", group_id=group.id  # Duplicate name
        )
    )

    # Try to create permissions in bulk and expect an HTTPException
    with pytest.raises(HTTPException) as excinfo:
        await permission_crud.create_bulk(obj_in_list=permission_schemas, db_session=db)

    # Check that the right error is raised
    assert excinfo.value.status_code == 409
    assert "uniqueness constraints" in excinfo.value.detail
