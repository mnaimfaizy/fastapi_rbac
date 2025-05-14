from uuid import UUID

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.role_crud import role_crud
from app.crud.role_group_crud import role_group
from app.crud.user_crud import user_crud
from app.models.role_group_model import RoleGroup
from app.models.user_model import User
from app.schemas.role_group_schema import IRoleGroupCreate, IRoleGroupUpdate
from app.schemas.role_schema import IRoleCreate
from app.schemas.user_schema import IUserCreate

from .utils import random_email, random_lower_string


@pytest_asyncio.fixture
async def test_user(db: AsyncSession) -> User:
    """Create a test user for tests that require a user"""
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
        is_active=True,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)
    return user


@pytest.mark.asyncio
async def test_create_role_group(db: AsyncSession) -> None:
    """Test creating a role group through CRUD operations"""
    # Create role group data
    name = f"test-group-{random_lower_string(8)}"
    # Create role group schema
    group_in = IRoleGroupCreate(
        name=name,
    )
    # Create role group in DB
    group = await role_group.create(obj_in=group_in, db_session=db)
    # Check that group was created correctly
    assert group.name == name
    assert isinstance(group.id, UUID)


@pytest.mark.asyncio
async def test_get_role_group(db: AsyncSession) -> None:
    """Test retrieving a role group by ID"""
    # Create a role group
    name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(
        name=name,
    )
    group = await role_group.create(obj_in=group_in, db_session=db)
    # Get the role group by ID
    stored_group = await role_group.get(id=group.id, db_session=db)
    # Check that the retrieved role group matches
    assert stored_group
    assert stored_group.id == group.id
    assert stored_group.name == name


@pytest.mark.asyncio
async def test_get_group_by_name(db: AsyncSession) -> None:
    """Test retrieving a role group by name"""
    # Create a role group
    name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(
        name=name,
    )
    group = await role_group.create(obj_in=group_in, db_session=db)
    # Get the role group by name
    stored_group = await role_group.get_group_by_name(name=name, db_session=db)
    # Check that the retrieved role group matches
    assert stored_group
    assert stored_group.id == group.id
    assert stored_group.name == name


@pytest.mark.asyncio
async def test_update_role_group(db: AsyncSession) -> None:
    """Test updating a role group"""
    # Create a role group
    name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(
        name=name,
    )
    group = await role_group.create(obj_in=group_in, db_session=db)
    # Update the role group name
    new_name = f"updated-group-{random_lower_string(8)}"
    group_update = IRoleGroupUpdate(name=new_name)
    updated_group = await role_group.update(obj_current=group, obj_new=group_update, db_session=db)
    # Check that the role group was updated
    assert updated_group.id == group.id
    assert updated_group.name == new_name
    # Verify the update by getting the role group with the new name
    stored_group = await role_group.get_group_by_name(name=new_name, db_session=db)
    assert stored_group
    assert stored_group.id == group.id


@pytest.mark.asyncio
async def test_get_all_role_groups(db: AsyncSession) -> None:
    """Test retrieving all role groups without pagination"""
    # Create several role groups
    group_count = 3
    created_groups = []
    for i in range(group_count):
        group_in = IRoleGroupCreate(
            name=f"test-group-{i}-{random_lower_string(5)}",
        )
        group = await role_group.create(obj_in=group_in, db_session=db)
        created_groups.append(group)

    # Get all role groups
    groups = await role_group.get_all(db_session=db)

    # Check that we got at least the number of groups we created
    # (There might be other groups in the DB)
    assert len(groups) >= group_count

    # Check that our created groups are in the result
    created_ids = {group.id for group in created_groups}
    result_ids = {group.id for group in groups}
    assert created_ids.issubset(result_ids)


@pytest.mark.asyncio
async def test_hierarchical_role_groups(db: AsyncSession) -> None:
    """Test creating and retrieving hierarchical role groups"""
    # Create a parent role group
    parent_name = f"parent-group-{random_lower_string(8)}"
    parent_in = IRoleGroupCreate(
        name=parent_name,
    )
    parent_group = await role_group.create(obj_in=parent_in, db_session=db)

    # Create a child role group
    child_name = f"child-group-{random_lower_string(8)}"
    child_in = IRoleGroupCreate(name=child_name, parent_id=parent_group.id)
    child_group = await role_group.create(obj_in=child_in, db_session=db)

    # Fetch the parent group directly from the database to ensure it's updated
    parent_group_refreshed = await db.get(RoleGroup, parent_group.id)
    await db.refresh(parent_group_refreshed, ["children"])

    # Check the parent-child relationship directly
    assert parent_group_refreshed
    assert parent_group_refreshed.id == parent_group.id
    assert hasattr(parent_group_refreshed, "children")
    assert len(parent_group_refreshed.children) > 0

    # Now let's check using the get_with_hierarchy method
    stored_parent = await role_group.get_with_hierarchy(id=parent_group.id, db_session=db)

    # Check the parent-child relationship
    assert stored_parent
    assert stored_parent.id == parent_group.id
    assert hasattr(stored_parent, "children")
    # Either check for non-empty children or fetch child directly and compare
    child_in_parent = any(c.id == child_group.id for c in stored_parent.children)
    assert child_in_parent

    # Get the child group with hierarchy
    stored_child = await role_group.get_with_hierarchy(id=child_group.id, db_session=db)

    # Check the child-parent relationship
    assert stored_child
    assert stored_child.id == child_group.id
    assert stored_child.parent_id == parent_group.id
    assert hasattr(stored_child, "parent")
    assert stored_child.parent.id == parent_group.id
    assert stored_child.parent.name == parent_name


@pytest.mark.asyncio
async def test_add_roles_to_group(db: AsyncSession) -> None:
    """Test adding roles to a role group"""
    # Create a role group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(name=group_name)
    group = await role_group.create(obj_in=group_in, db_session=db)

    # Create some roles
    roles = []
    for i in range(3):
        role_in = IRoleCreate(
            name=f"test-role-{i}-{random_lower_string(5)}",
            description=f"Test Role {i}",
        )
        role = await role_crud.create(obj_in=role_in, db_session=db)
        roles.append(role)

    role_ids = [role.id for role in roles]

    # Add roles to group
    role_group_maps = await role_group.add_roles_to_group(group_id=group.id, role_ids=role_ids, db_session=db)

    # Check that the mapping was created
    assert len(role_group_maps) == 3
    for i, map_obj in enumerate(role_group_maps):
        assert map_obj.role_id == roles[i].id
        assert map_obj.role_group_id == group.id

    # Import the mapping model
    from app.models.role_group_map_model import RoleGroupMap

    # Check that each role was correctly assigned to the group
    # Use a different approach that works with SQLAlchemy/SQLModel
    for role_id in role_ids:
        # Use an alternate approach - check if any record exists
        statement = (
            select(1)
            .where(and_(RoleGroupMap.role_id == role_id, RoleGroupMap.role_group_id == group.id))
            .exists()
        )

        result = await db.execute(select(statement))
        exists = result.scalar()
        assert exists


@pytest.mark.asyncio
async def test_remove_roles_from_group(db: AsyncSession) -> None:
    """Test removing roles from a role group"""
    # Create a role group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(name=group_name)
    group = await role_group.create(obj_in=group_in, db_session=db)

    # Create some roles
    roles = []
    for i in range(3):
        role_in = IRoleCreate(
            name=f"test-role-{i}-{random_lower_string(5)}",
            description=f"Test Role {i}",
        )
        role = await role_crud.create(obj_in=role_in, db_session=db)
        roles.append(role)

    role_ids = [role.id for role in roles]

    # Add roles to group
    await role_group.add_roles_to_group(group_id=group.id, role_ids=role_ids, db_session=db)

    # Import the mapping model
    from app.models.role_group_map_model import RoleGroupMap

    # Verify all roles were added initially
    for role_id in role_ids:
        # Use exists() instead of direct object access
        statement = (
            select(1)
            .where(and_(RoleGroupMap.role_id == role_id, RoleGroupMap.role_group_id == group.id))
            .exists()
        )

        result = await db.execute(select(statement))
        exists = result.scalar()
        assert exists

    # Remove two roles from the group
    roles_to_remove = role_ids[:2]
    await role_group.remove_roles_from_group(group_id=group.id, role_ids=roles_to_remove, db_session=db)

    # Verify that removed roles no longer have mappings
    for role_id in roles_to_remove:
        # Check that mappings were removed
        statement = (
            select(1)
            .where(and_(RoleGroupMap.role_id == role_id, RoleGroupMap.role_group_id == group.id))
            .exists()
        )

        result = await db.execute(select(statement))
        exists = result.scalar()
        assert not exists  # Mapping should not exist now

    # Verify that the remaining role still has mapping
    statement = (
        select(1)
        .where(and_(RoleGroupMap.role_id == role_ids[2], RoleGroupMap.role_group_id == group.id))
        .exists()
    )

    result = await db.execute(select(statement))
    exists = result.scalar()
    assert exists  # This mapping should still exist


@pytest.mark.asyncio
async def test_bulk_create_role_groups(db: AsyncSession, test_user: User) -> None:
    """Test creating multiple role groups in a single transaction"""
    # Create role group data
    group_names = [f"test-group-{i}-{random_lower_string(5)}" for i in range(3)]
    groups_in = [IRoleGroupCreate(name=name) for name in group_names]

    # Bulk create role groups
    groups = await role_group.bulk_create(groups=groups_in, current_user=test_user, db_session=db)

    # Check that all groups were created correctly
    assert len(groups) == 3
    for i, group in enumerate(groups):
        assert group.name == group_names[i]
        assert isinstance(group.id, UUID)
        assert group.created_by_id == test_user.id


@pytest.mark.asyncio
async def test_bulk_delete_role_groups(db: AsyncSession, test_user: User) -> None:
    """Test deleting multiple role groups in a single transaction"""
    # Create some role groups
    groups = []
    for i in range(3):
        group_in = IRoleGroupCreate(name=f"test-group-{i}-{random_lower_string(5)}")
        group = await role_group.create(obj_in=group_in, db_session=db)
        groups.append(group)

    group_ids = [group.id for group in groups]

    # Bulk delete role groups
    await role_group.bulk_delete(group_ids=group_ids, current_user=test_user, db_session=db)

    # Verify that the groups were deleted
    for group_id in group_ids:
        stored_group = await role_group.get(id=group_id, db_session=db)
        assert stored_group is None


@pytest.mark.asyncio
async def test_circular_dependency_detection(db: AsyncSession) -> None:
    """Test that circular dependencies are detected when adding roles to groups"""
    # Import the mapping model
    from app.models.role_group_map_model import RoleGroupMap

    # Create role groups
    group1_name = f"test-group-1-{random_lower_string(8)}"
    group1_in = IRoleGroupCreate(name=group1_name)
    group1 = await role_group.create(obj_in=group1_in, db_session=db)

    group2_name = f"test-group-2-{random_lower_string(8)}"
    group2_in = IRoleGroupCreate(name=group2_name)
    group2 = await role_group.create(obj_in=group2_in, db_session=db)

    # Create roles
    role1_in = IRoleCreate(name=f"test-role-1-{random_lower_string(5)}", description="Test Role 1")
    role1 = await role_crud.create(obj_in=role1_in, db_session=db)

    role2_in = IRoleCreate(name=f"test-role-2-{random_lower_string(5)}", description="Test Role 2")
    role2 = await role_crud.create(obj_in=role2_in, db_session=db)

    # Manually create the mappings to set up a circular dependency scenario
    # Add role1 to group1
    map1 = RoleGroupMap(role_id=role1.id, role_group_id=group1.id)
    db.add(map1)

    # Add role2 to group2
    map2 = RoleGroupMap(role_id=role2.id, role_group_id=group2.id)
    db.add(map2)

    # Now create a circular dependency by adding role2 to group1
    # This makes group1 -> role2 -> group2 -> role1 -> group1 (circular)
    map3 = RoleGroupMap(role_id=role1.id, role_group_id=group2.id)
    db.add(map3)

    await db.commit()

    # Now validate the circular dependency - adding role2 to group1 should be detected as circular
    has_circular = await role_group.validate_circular_dependency(
        group_id=group1.id, role_ids=[role2.id], db_session=db
    )

    # This should now be detected as circular
    assert has_circular is True

    # Test a non-circular case
    role3_in = IRoleCreate(name=f"test-role-3-{random_lower_string(5)}", description="Test Role 3")
    role3 = await role_crud.create(obj_in=role3_in, db_session=db)

    has_circular = await role_group.validate_circular_dependency(
        group_id=group1.id, role_ids=[role3.id], db_session=db
    )

    # This should not be circular
    assert has_circular is False


@pytest.mark.asyncio
async def test_sync_roles_with_role_groups(db: AsyncSession, test_user: User) -> None:
    """Test synchronizing roles with their role groups"""
    # Create a role group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(name=group_name)
    group = await role_group.create(obj_in=group_in, db_session=db)

    # Create roles with role_group_id
    for i in range(3):
        role_in = IRoleCreate(
            name=f"test-role-{i}-{random_lower_string(5)}",
            description=f"Test Role {i}",
            role_group_id=group.id,
        )
        await role_crud.create(obj_in=role_in, db_session=db)

    # Sync roles with role groups
    stats = await role_group.sync_roles_with_role_groups(db_session=db, current_user=test_user)

    # Check that roles were synchronized
    assert stats["created"] >= 3

    # Run sync again to test the skipping of existing mappings
    stats2 = await role_group.sync_roles_with_role_groups(db_session=db, current_user=test_user)

    # The second sync should not create any new mappings for these roles
    assert stats2["skipped"] >= 3


@pytest.mark.asyncio
async def test_check_role_exists_in_group(db: AsyncSession) -> None:
    """Test checking if roles exist in a group"""
    # Create a role group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(name=group_name)
    group = await role_group.create(obj_in=group_in, db_session=db)

    # Check if group has roles (should be false)
    has_roles = await role_group.check_role_exists_in_group(group_id=group.id, db_session=db)
    assert has_roles is False

    # Create a role
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(5)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Add role to group
    await role_group.add_roles_to_group(group_id=group.id, role_ids=[role.id], db_session=db)

    # Check if group has roles (should be true now)
    has_roles = await role_group.check_role_exists_in_group(group_id=group.id, db_session=db)
    assert has_roles is True


@pytest.mark.asyncio
async def test_bulk_delete_with_roles_conflict(db: AsyncSession, test_user: User) -> None:
    """Test that deleting a group with roles raises an exception"""
    # Create a role group
    group_name = f"test-group-{random_lower_string(8)}"
    group_in = IRoleGroupCreate(name=group_name)
    group = await role_group.create(obj_in=group_in, db_session=db)

    # Create a role
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(5)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Add role to group
    await role_group.add_roles_to_group(group_id=group.id, role_ids=[role.id], db_session=db)

    # Attempt to delete group that has roles
    with pytest.raises(HTTPException) as excinfo:
        await role_group.bulk_delete(group_ids=[group.id], current_user=test_user, db_session=db)

    # Check that the correct exception was raised
    assert excinfo.value.status_code == 409
    assert "has assigned roles and cannot be deleted" in str(excinfo.value.detail)
