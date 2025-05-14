import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.role_group_map_model import RoleGroupMap
from app.models.role_group_model import RoleGroup
from app.models.role_model import Role

from .utils import random_lower_string


@pytest.mark.asyncio
async def test_create_role_group_map(db: AsyncSession) -> None:
    """Test creating a role group map entry in the database"""
    # Create a role first
    role_name = f"test_role_{random_lower_string()}"
    role = Role(name=role_name, description="Test role")
    db.add(role)

    # Create a role group
    group_name = f"test_group_{random_lower_string()}"
    role_group = RoleGroup(name=group_name, description="Test role group")
    db.add(role_group)

    await db.commit()
    await db.refresh(role)
    await db.refresh(role_group)

    # Create role group map entry
    role_group_map = RoleGroupMap(role_id=role.id, role_group_id=role_group.id)

    # Add role group map to database
    db.add(role_group_map)
    await db.commit()

    # Check that role group map was created with correct data
    stmt = select(RoleGroupMap).where(
        RoleGroupMap.role_id == role.id, RoleGroupMap.role_group_id == role_group.id
    )
    result = await db.execute(stmt)
    retrieved_map = result.scalars().first()

    assert retrieved_map is not None
    assert retrieved_map.role_id == role.id
    assert retrieved_map.role_group_id == role_group.id


@pytest.mark.asyncio
async def test_retrieve_roles_in_group(db: AsyncSession) -> None:
    """Test retrieving all roles in a specific group"""
    # Create a role group
    group_name = f"test_group_{random_lower_string()}"
    role_group = RoleGroup(name=group_name, description="Test role group")
    db.add(role_group)
    await db.commit()
    await db.refresh(role_group)

    # Create multiple roles
    roles = []
    role_names = []
    for i in range(3):
        role_name = f"role_{i}_{random_lower_string()}"
        role_names.append(role_name)
        role = Role(name=role_name, description=f"Test role {i}")
        roles.append(role)

    db.add_all(roles)
    await db.commit()
    for role in roles:
        await db.refresh(role)

    # Create role group mappings
    mappings = []
    for role in roles:
        mapping = RoleGroupMap(role_id=role.id, role_group_id=role_group.id)
        mappings.append(mapping)

    db.add_all(mappings)
    await db.commit()

    # Retrieve all roles in the group
    stmt = select(Role).join(RoleGroupMap).where(RoleGroupMap.role_group_id == role_group.id)
    result = await db.execute(stmt)
    retrieved_roles = result.scalars().all()

    # Check that all roles were retrieved correctly
    assert len(retrieved_roles) == 3
    retrieved_role_names = [r.name for r in retrieved_roles]
    for name in role_names:
        assert name in retrieved_role_names


@pytest.mark.asyncio
async def test_retrieve_groups_for_role(db: AsyncSession) -> None:
    """Test retrieving all groups a specific role belongs to"""
    # Create a role
    role_name = f"test_role_{random_lower_string()}"
    role = Role(name=role_name, description="Test role")
    db.add(role)
    await db.commit()
    await db.refresh(role)

    # Create multiple role groups
    groups = []
    group_names = []
    for i in range(2):
        group_name = f"group_{i}_{random_lower_string()}"
        group_names.append(group_name)
        group = RoleGroup(name=group_name, description=f"Test group {i}")
        groups.append(group)

    db.add_all(groups)
    await db.commit()
    for group in groups:
        await db.refresh(group)

    # Create role group mappings
    mappings = []
    for group in groups:
        mapping = RoleGroupMap(role_id=role.id, role_group_id=group.id)
        mappings.append(mapping)

    db.add_all(mappings)
    await db.commit()

    # Retrieve all groups for this role
    stmt = select(RoleGroup).join(RoleGroupMap).where(RoleGroupMap.role_id == role.id)
    result = await db.execute(stmt)
    retrieved_groups = result.scalars().all()

    # Check that all groups were retrieved correctly
    assert len(retrieved_groups) == 2
    retrieved_group_names = [g.name for g in retrieved_groups]
    for name in group_names:
        assert name in retrieved_group_names


@pytest.mark.asyncio
async def test_unique_constraint(db: AsyncSession) -> None:
    """Test that role-group mappings must be unique"""
    # Create a role
    role = Role(name=f"role_{random_lower_string()}", description="Test role")
    db.add(role)

    # Create a role group
    role_group = RoleGroup(name=f"group_{random_lower_string()}", description="Test group")
    db.add(role_group)

    await db.commit()
    await db.refresh(role)
    await db.refresh(role_group)

    # Create first mapping
    mapping1 = RoleGroupMap(role_id=role.id, role_group_id=role_group.id)
    db.add(mapping1)
    await db.commit()

    # Try to create duplicate mapping
    mapping2 = RoleGroupMap(role_id=role.id, role_group_id=role_group.id)
    db.add(mapping2)

    # This should raise an exception due to unique constraint
    with pytest.raises(IntegrityError):
        await db.commit()

    # Rollback to clean the session
    await db.rollback()
