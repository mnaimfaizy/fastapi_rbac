import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.permission_crud import permission_crud
from app.crud.role_crud import role_crud
from app.crud.user_crud import user_crud
from app.models.role_permission_model import RolePermission
from app.models.user_role_model import UserRole
from app.schemas.permission_schema import IPermissionCreate as PermissionCreate
from app.schemas.role_schema import IRoleCreate as RoleCreate
from app.schemas.user_schema import IUserCreate as UserCreate
from app.tests.utils import random_email, random_lower_string


@pytest.mark.asyncio
async def test_assign_permission_to_role(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
):
    """Test assigning a permission to a role"""
    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = RoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission
    permission_name = f"test-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(name=permission_name, description="Test Permission")
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)

    # Assign the permission to the role
    data = {"permission_id": str(permission.id)}
    response = await client.post(
        f"{settings.API_V1_STR}/role/{role.id}/permissions", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200

    # Verify that the permission was assigned to the role
    response = await client.get(
        f"{settings.API_V1_STR}/role/{role.id}/permissions", headers=superuser_token_headers
    )
    assert response.status_code == 200
    permissions = response.json()
    assert len(permissions) == 1
    assert permissions[0]["id"] == str(permission.id)
    assert permissions[0]["name"] == permission_name


@pytest.mark.asyncio
async def test_assign_role_to_user(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test assigning a role to a user"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = RoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Assign the role to the user
    data = {"role_id": str(role.id)}
    response = await client.post(
        f"{settings.API_V1_STR}/user/{user.id}/roles", headers=superuser_token_headers, json=data
    )

    # Check response
    assert response.status_code == 200

    # Verify that the role was assigned to the user
    response = await client.get(
        f"{settings.API_V1_STR}/user/{user.id}/roles", headers=superuser_token_headers
    )
    assert response.status_code == 200
    roles = response.json()
    assert len(roles) == 1
    assert roles[0]["id"] == str(role.id)
    assert roles[0]["name"] == role_name


@pytest.mark.asyncio
async def test_user_permission_through_role(client: AsyncClient, db: AsyncSession):
    """Test that a user gets permissions through their assigned roles"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = RoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission
    permission_name = f"test-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(name=permission_name, description="Test Permission")
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)

    # Assign the permission to the role
    role_permission = RolePermission(role_id=role.id, permission_id=permission.id)
    db.add(role_permission)
    await db.commit()

    # Assign the role to the user
    user_role = UserRole(user_id=user.id, role_id=role.id)
    db.add(user_role)
    await db.commit()

    # Log in as the user
    login_data = {
        "username": email,
        "password": password,
    }
    response = await client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert response.status_code == 200
    tokens = response.json()
    user_token_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Get the user's permissions (direct or through roles)
    response = await client.get(f"{settings.API_V1_STR}/user/me/permissions", headers=user_token_headers)

    # Check that the user has the permission through the role
    assert response.status_code == 200
    permissions = response.json()
    assert len(permissions) >= 1  # There might be default permissions

    # Find our test permission
    found_test_permission = False
    for perm in permissions:
        if perm["name"] == permission_name:
            found_test_permission = True
            break

    assert found_test_permission, f"Permission '{permission_name}' not found in user's permissions"


@pytest.mark.asyncio
async def test_remove_permission_from_role(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
):
    """Test removing a permission from a role"""
    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = RoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Create a permission
    permission_name = f"test-permission-{random_lower_string(8)}"
    permission_in = PermissionCreate(name=permission_name, description="Test Permission")
    permission = await permission_crud.create(obj_in=permission_in, db_session=db)

    # Assign the permission to the role
    role_permission = RolePermission(role_id=role.id, permission_id=permission.id)
    db.add(role_permission)
    await db.commit()

    # Remove the permission from the role
    response = await client.delete(
        f"{settings.API_V1_STR}/role/{role.id}/permissions/{permission.id}", headers=superuser_token_headers
    )

    # Check response
    assert response.status_code == 200

    # Verify that the permission was removed from the role
    response = await client.get(
        f"{settings.API_V1_STR}/role/{role.id}/permissions", headers=superuser_token_headers
    )
    assert response.status_code == 200
    permissions = response.json()
    assert len(permissions) == 0


@pytest.mark.asyncio
async def test_remove_role_from_user(client: AsyncClient, superuser_token_headers: dict, db: AsyncSession):
    """Test removing a role from a user"""
    # Create a user
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = await user_crud.create(obj_in=user_in, db_session=db)

    # Create a role
    role_name = f"test-role-{random_lower_string(8)}"
    role_in = RoleCreate(name=role_name, description="Test Role")
    role = await role_crud.create(obj_in=role_in, db_session=db)

    # Assign the role to the user
    user_role = UserRole(user_id=user.id, role_id=role.id)
    db.add(user_role)
    await db.commit()

    # Remove the role from the user
    response = await client.delete(
        f"{settings.API_V1_STR}/user/{user.id}/roles/{role.id}", headers=superuser_token_headers
    )

    # Check response
    assert response.status_code == 200

    # Verify that the role was removed from the user
    response = await client.get(
        f"{settings.API_V1_STR}/user/{user.id}/roles", headers=superuser_token_headers
    )
    assert response.status_code == 200
    roles = response.json()
    assert len(roles) == 0
