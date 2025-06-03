from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.permission_crud import permission_crud
from app.crud.permission_group_crud import permission_group_crud
from app.crud.role_crud import role_crud
from app.crud.user_crud import user_crud
from app.models.user_model import User
from app.schemas.permission_group_schema import IPermissionGroupCreate
from app.schemas.permission_schema import IPermissionCreate
from app.schemas.role_schema import IRoleCreate, IRoleUpdate
from app.schemas.user_schema import IUserCreate
from app.utils.exceptions.common_exception import ResourceNotFoundException

from .utils import random_email, random_lower_string


@pytest.mark.asyncio
async def test_create_role(db: AsyncSession) -> None:
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
async def test_get_role(db: AsyncSession) -> None:
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
async def test_get_role_by_name(db: AsyncSession) -> None:
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
async def test_update_role(db: AsyncSession) -> None:
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
    role_update = IRoleUpdate(name=role.name, description=new_description)
    updated_role = await role_crud.update(
        obj_current=role, obj_new=role_update, db_session=db
    )
    # Check that the role was updated
    assert updated_role.id == role.id
    assert updated_role.name == name
    assert updated_role.description == new_description


@pytest.mark.asyncio
async def test_update_role_name(db: AsyncSession) -> None:
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
    updated_role = await role_crud.update(
        obj_current=role, obj_new=role_update, db_session=db
    )
    # Check that the role was updated
    assert updated_role.id == role.id
    assert updated_role.name == new_name
    assert updated_role.description == role.description
    # Verify the update by getting the role with the new name
    stored_role = await role_crud.get_role_by_name(name=new_name, db_session=db)
    assert stored_role
    assert stored_role.id == role.id


@pytest.mark.asyncio
async def test_get_multi_roles(db: AsyncSession) -> None:
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
async def test_delete_role(db: AsyncSession) -> None:
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


@pytest.mark.asyncio
async def test_get_all_roles(db: AsyncSession) -> None:
    """Test retrieving all roles without pagination"""
    # Create several roles
    role_count = 5
    created_roles = []
    for i in range(role_count):
        role_in = IRoleCreate(
            name=f"test-get-all-{i}-{random_lower_string(5)}",
            description=f"Test Role {i}",
        )
        role = await role_crud.create(obj_in=role_in, db_session=db)
        created_roles.append(role)

    # Get all roles
    all_roles = await role_crud.get_all(db_session=db)

    # Check that all created roles are in the result
    for role in created_roles:
        assert any(r.id == role.id for r in all_roles)

    # Check that we get at least the number of roles we created
    assert len(all_roles) >= role_count


@pytest.mark.asyncio
async def test_add_role_to_user(db: AsyncSession) -> None:
    """Test adding a role to a user"""
    # Create a user
    email = random_email()
    password = random_lower_string(12)
    user_in = IUserCreate(
        email=email,
        password=password,
        is_active=True,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = IRoleCreate(
        name=role_name,
        description="Test Role for User",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Add role to user
    updated_role = await role_crud.add_role_to_user(
        user=user, role_id=role.id, db_session=db
    )

    # Check that role was added to user
    assert updated_role.id == role.id
    assert user in updated_role.users


@pytest.mark.asyncio
async def test_add_role_to_user_not_found(db: AsyncSession) -> None:
    """Test adding a non-existent role to a user raises ValueError"""
    # Create a user
    email = random_email()
    password = random_lower_string(12)
    user_in = IUserCreate(
        email=email,
        password=password,
        is_active=True,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Try to add non-existent role to user
    non_existent_id = UUID("00000000-0000-0000-0000-000000000000")

    # Check that ValueError is raised with the correct message pattern
    with pytest.raises(ValueError, match=f"Role with ID {non_existent_id} not found"):
        await role_crud.add_role_to_user(
            user=user, role_id=non_existent_id, db_session=db
        )


@pytest.mark.asyncio
async def test_permission_exist_in_role(db: AsyncSession) -> None:
    """Test checking if permissions exist in a role"""
    # Create role and permission
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(8)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Initially should have no permissions
    has_permissions = await role_crud.permission_exist_in_role(
        role_id=role.id, db_session=db
    )
    assert has_permissions is False

    # Create a permission group first since group_id is required
    group_in = IPermissionGroupCreate(
        name=f"test-perm-group-{random_lower_string(8)}",
        description="Test Permission Group",
    )
    permission_group = await permission_group_crud.create(
        obj_in=group_in, db_session=db
    )

    # Create a permission with the required group_id
    perm_in = IPermissionCreate(
        name=f"test-permission-{random_lower_string(8)}",
        description="Test Permission",
        group_id=permission_group.id,
    )
    permission = await permission_crud.create(obj_in=perm_in, db_session=db)

    # Mock a user for the audit log
    mock_user = MagicMock(spec=User)
    mock_user.id = UUID("11111111-1111-1111-1111-111111111111")

    # Assign permission to role
    await role_crud.assign_permissions(
        role_id=role.id,
        permission_ids=[permission.id],
        current_user=mock_user,
        db_session=db,
    )

    # Now should have permissions
    has_permissions = await role_crud.permission_exist_in_role(
        role_id=role.id, db_session=db
    )
    assert has_permissions is True


@pytest.mark.asyncio
async def test_user_exist_in_role(db: AsyncSession) -> None:
    """Test checking if users exist in a role"""
    # Create a role
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(8)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Initially should have no users
    has_users = await role_crud.user_exist_in_role(role_id=role.id, db_session=db)
    assert has_users is False

    # Create a user
    email = random_email()
    password = random_lower_string(12)
    user_in = IUserCreate(
        email=email,
        password=password,
        is_active=True,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Add user to role
    await role_crud.add_role_to_user(user=user, role_id=role.id, db_session=db)

    # Now should have users
    has_users = await role_crud.user_exist_in_role(role_id=role.id, db_session=db)
    assert has_users is True

    # Test with non-existent role
    non_existent_id = UUID("00000000-0000-0000-0000-000000000000")
    has_users = await role_crud.user_exist_in_role(
        role_id=non_existent_id, db_session=db
    )
    assert has_users is False


@pytest.mark.asyncio
async def test_assign_permissions(db: AsyncSession) -> None:
    """Test assigning permissions to a role"""
    # Create role and permissions
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(8)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission group first since group_id is required
    group_in = IPermissionGroupCreate(
        name=f"test-perm-group-{random_lower_string(8)}",
        description="Test Permission Group",
    )
    permission_group = await permission_group_crud.create(
        obj_in=group_in, db_session=db
    )

    # Create multiple permissions
    permission_ids = []
    for i in range(3):
        perm_in = IPermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
            group_id=permission_group.id,  # Add the required group_id
        )
        permission = await permission_crud.create(obj_in=perm_in, db_session=db)
        permission_ids.append(permission.id)

    # Mock a user for the audit log
    mock_user = MagicMock(spec=User)
    mock_user.id = UUID("11111111-1111-1111-1111-111111111111")

    # Assign permissions to role
    updated_role = await role_crud.assign_permissions(
        role_id=role.id,
        permission_ids=permission_ids,
        current_user=mock_user,
        db_session=db,
    )

    # Check that permissions were assigned
    assert len(updated_role.permissions) == 3
    for perm_id in permission_ids:
        assert any(p.id == perm_id for p in updated_role.permissions)

    # Test assignment idempotency (assigning same permissions again)
    updated_role = await role_crud.assign_permissions(
        role_id=role.id,
        permission_ids=permission_ids,
        current_user=mock_user,
        db_session=db,
    )

    # Check that permissions are still the same (no duplicates)
    assert len(updated_role.permissions) == 3


@pytest.mark.asyncio
async def test_assign_permissions_not_found(db: AsyncSession) -> None:
    """Test assigning permissions to a non-existent role raises exception"""
    # Mock a user for the audit log
    mock_user = MagicMock(spec=User)
    mock_user.id = UUID("11111111-1111-1111-1111-111111111111")

    # Non-existent role ID
    non_existent_id = UUID("00000000-0000-0000-0000-000000000000")
    permission_ids = [UUID("11111111-1111-1111-1111-111111111111")]

    # Check that ResourceNotFoundException is raised
    with pytest.raises(ResourceNotFoundException):
        await role_crud.assign_permissions(
            role_id=non_existent_id,
            permission_ids=permission_ids,
            current_user=mock_user,
            db_session=db,
        )


@pytest.mark.asyncio
async def test_remove_permissions(db: AsyncSession) -> None:
    """Test removing permissions from a role"""
    # Create role and permissions
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(8)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission group first since group_id is required
    group_in = IPermissionGroupCreate(
        name=f"test-perm-group-{random_lower_string(8)}",
        description="Test Permission Group",
    )
    permission_group = await permission_group_crud.create(
        obj_in=group_in, db_session=db
    )

    # Create multiple permissions
    permission_ids = []
    for i in range(3):
        perm_in = IPermissionCreate(
            name=f"test-permission-{i}-{random_lower_string(5)}",
            description=f"Test Permission {i}",
            group_id=permission_group.id,  # Add the required group_id
        )
        permission = await permission_crud.create(obj_in=perm_in, db_session=db)
        permission_ids.append(permission.id)

    # Mock a user for the audit log
    mock_user = MagicMock(spec=User)
    mock_user.id = UUID("11111111-1111-1111-1111-111111111111")

    # Assign permissions to role
    updated_role = await role_crud.assign_permissions(
        role_id=role.id,
        permission_ids=permission_ids,
        current_user=mock_user,
        db_session=db,
    )

    # Check that permissions were assigned
    assert len(updated_role.permissions) == 3

    # Remove one permission
    updated_role = await role_crud.remove_permissions(
        role_id=role.id,
        permission_ids=[permission_ids[0]],
        current_user=mock_user,
        db_session=db,
    )

    # Check that permission was removed
    assert len(updated_role.permissions) == 2
    assert all(p.id != permission_ids[0] for p in updated_role.permissions)

    # Try to remove non-existent permission (should not fail)
    non_existent_id = UUID("00000000-0000-0000-0000-000000000000")
    updated_role = await role_crud.remove_permissions(
        role_id=role.id,
        permission_ids=[non_existent_id],
        current_user=mock_user,
        db_session=db,
    )

    # Should still have 2 permissions
    assert len(updated_role.permissions) == 2


@pytest.mark.asyncio
async def test_remove_permissions_not_found(db: AsyncSession) -> None:
    """Test removing permissions from a non-existent role raises exception"""
    # Mock a user for the audit log
    mock_user = MagicMock(spec=User)
    mock_user.id = UUID("11111111-1111-1111-1111-111111111111")

    # Non-existent role ID
    non_existent_id = UUID("00000000-0000-0000-0000-000000000000")
    permission_ids = [UUID("11111111-1111-1111-1111-111111111111")]

    # Check that ResourceNotFoundException is raised
    with pytest.raises(ResourceNotFoundException):
        await role_crud.remove_permissions(
            role_id=non_existent_id,
            permission_ids=permission_ids,
            current_user=mock_user,
            db_session=db,
        )


@pytest.mark.asyncio
async def test_validate_system_role(db: AsyncSession) -> None:
    """Test validation of system roles"""
    # Create system roles
    system_roles = ["admin", "system", "superuser"]
    system_role_ids = []

    for role_name in system_roles:
        role_in = IRoleCreate(
            name=role_name,
            description=f"{role_name.capitalize()} System Role",
        )
        role = await role_crud.create(obj_in=role_in, db_session=db)
        system_role_ids.append(role.id)

    # Create a regular role
    regular_role_in = IRoleCreate(
        name=f"regular-role-{random_lower_string(8)}",
        description="Regular Role",
    )
    regular_role = await role_crud.create(obj_in=regular_role_in, db_session=db)

    # Check system roles
    for role_id in system_role_ids:
        is_system_role = await role_crud.validate_system_role(
            role_id=role_id, db_session=db
        )
        assert is_system_role is True

    # Check regular role
    is_system_role = await role_crud.validate_system_role(
        role_id=regular_role.id, db_session=db
    )
    assert is_system_role is False

    # Check non-existent role
    non_existent_id = UUID("00000000-0000-0000-0000-000000000000")
    is_system_role = await role_crud.validate_system_role(
        role_id=non_existent_id, db_session=db
    )
    assert is_system_role is False


@pytest.mark.asyncio
async def test_invalidate_user_permission_caches(db: AsyncSession) -> None:
    """Test invalidating user permission caches in Redis"""
    # Create a role
    role_in = IRoleCreate(
        name=f"test-role-{random_lower_string(8)}",
        description="Test Role",
    )
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a user
    email = random_email()
    password = random_lower_string(12)
    user_in = IUserCreate(
        email=email,
        password=password,
        is_active=True,
    )
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Add user to role
    await role_crud.add_role_to_user(user=user, role_id=role.id, db_session=db)

    # Refresh the role to make sure the users relationship is loaded
    await db.refresh(role, ["users"])

    # Create mock Redis client
    mock_redis = AsyncMock()
    mock_redis.delete = AsyncMock()  # Explicitly mock the delete method

    # Call the method directly with the real implementation
    await role_crud.invalidate_user_permission_caches(
        role_id=role.id,
        redis_client=mock_redis,
        db_session=db,  # Pass the database session
    )

    # Verify that our Redis operations were called as expected
    mock_redis.delete.assert_any_call(f"user_permissions:{user.id}")
    mock_redis.delete.assert_any_call("user_permissions:*")
