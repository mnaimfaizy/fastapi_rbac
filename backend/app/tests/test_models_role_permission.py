import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID

from app.models.role_model import Role
from app.models.permission_model import Permission
from app.models.role_permission_model import RolePermission
from app.tests.utils import random_lower_string


@pytest.mark.asyncio
async def test_create_role(db: AsyncSession):
    """Test creating a role in the database"""
    # Create role data
    name = f"test-role-{random_lower_string(8)}"
    description = "Test Role Description"

    # Create role object
    role = Role(
        name=name,
        description=description,
    )

    # Add role to database
    db.add(role)
    await db.commit()
    await db.refresh(role)

    # Check that role was created with correct data
    assert role.id is not None
    assert isinstance(role.id, UUID)
    assert role.name == name
    assert role.description == description
    assert role.created_at is not None
    assert role.updated_at is not None


@pytest.mark.asyncio
async def test_create_permission(db: AsyncSession):
    """Test creating a permission in the database"""
    # Create permission data
    name = f"test-permission-{random_lower_string(8)}"
    description = "Test Permission Description"

    # Create permission object
    permission = Permission(
        name=name,
        description=description,
    )

    # Add permission to database
    db.add(permission)
    await db.commit()
    await db.refresh(permission)

    # Check that permission was created with correct data
    assert permission.id is not None
    assert isinstance(permission.id, UUID)
    assert permission.name == name
    assert permission.description == description
    assert permission.created_at is not None
    assert permission.updated_at is not None


@pytest.mark.asyncio
async def test_role_with_permissions(db: AsyncSession):
    """Test assigning permissions to a role"""
    # Create role
    role_name = f"test-role-{random_lower_string(8)}"
    role = Role(name=role_name, description="Test Role")
    db.add(role)

    # Create permissions
    perm1_name = f"test-permission-1-{random_lower_string(8)}"
    perm2_name = f"test-permission-2-{random_lower_string(8)}"
    perm1 = Permission(name=perm1_name, description="Test Permission 1")
    perm2 = Permission(name=perm2_name, description="Test Permission 2")
    db.add_all([perm1, perm2])
    await db.commit()
    await db.refresh(role)
    await db.refresh(perm1)
    await db.refresh(perm2)

    # Assign permissions to role
    role_perm1 = RolePermission(role_id=role.id, permission_id=perm1.id)
    role_perm2 = RolePermission(role_id=role.id, permission_id=perm2.id)
    db.add_all([role_perm1, role_perm2])
    await db.commit()

    # Query to check if permissions were assigned correctly
    query = text(
        """
        SELECT p.name FROM Permission p
        JOIN RolePermission rp ON p.id = rp.permission_id
        WHERE rp.role_id = :role_id
    """
    )
    result = await db.execute(query, {"role_id": str(role.id)})
    permissions = [row[0] for row in result]

    # Check that the role has both permissions
    assert perm1_name in permissions
    assert perm2_name in permissions
    assert len(permissions) == 2


@pytest.mark.asyncio
async def test_role_unique_name_constraint(db: AsyncSession):
    """Test that roles must have unique names"""
    # Create first role
    name = f"unique-role-{random_lower_string(8)}"
    role1 = Role(name=name, description="First Role")
    db.add(role1)
    await db.commit()

    # Try to create second role with same name
    role2 = Role(name=name, description="Second Role")  # Same name as role1
    db.add(role2)

    # This should raise an exception due to unique constraint on name
    with pytest.raises(Exception):  # Could be more specific with the exact SQLAlchemy exception
        await db.commit()

    # Rollback to clean the session
    await db.rollback()


@pytest.mark.asyncio
async def test_permission_unique_name_constraint(db: AsyncSession):
    """Test that permissions must have unique names"""
    # Create first permission
    name = f"unique-permission-{random_lower_string(8)}"
    perm1 = Permission(name=name, description="First Permission")
    db.add(perm1)
    await db.commit()

    # Try to create second permission with same name
    perm2 = Permission(name=name, description="Second Permission")  # Same name as perm1
    db.add(perm2)

    # This should raise an exception due to unique constraint on name
    with pytest.raises(Exception):  # Could be more specific with the exact SQLAlchemy exception
        await db.commit()

    # Rollback to clean the session
    await db.rollback()


@pytest.mark.asyncio
async def test_role_update(db: AsyncSession):
    """Test updating role information"""
    # Create role
    name = f"update-role-{random_lower_string(8)}"
    role = Role(name=name, description="Original Description")
    db.add(role)
    await db.commit()
    await db.refresh(role)

    # Update role information
    new_description = "Updated Description"
    role.description = new_description
    await db.commit()
    await db.refresh(role)

    # Check that information was updated
    assert role.description == new_description
    assert role.updated_at is not None
