import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crud.user_crud import user_crud
from app.crud.role_crud import role_crud
from app.crud.permission_crud import permission_crud
from app.models.role_permission_model import RolePermission
from app.models.user_role_model import UserRole
from app.schemas.user_schema import IUserCreate as UserCreate
from app.schemas.role_schema import IRoleCreate as RoleCreate
from app.schemas.permission_schema import IPermissionCreate as PermissionCreate
from app.tests.utils import random_lower_string, random_email


@pytest.mark.asyncio
async def test_rbac_access_control(client: AsyncClient, db: AsyncSession):
    """
    Integration test for role-based access control.

    This test verifies that:
    1. Users can access endpoints they have permission for
    2. Users cannot access endpoints they don't have permission for
    3. Permissions are correctly assigned through roles
    """
    # Create test users with different roles
    admin_email = random_email()
    admin_password = random_lower_string()
    admin_user = await user_crud.create(
        obj_in=UserCreate(email=admin_email, password=admin_password, is_active=True), db_session=db
    )

    editor_email = random_email()
    editor_password = random_lower_string()
    editor_user = await user_crud.create(
        obj_in=UserCreate(email=editor_email, password=editor_password, is_active=True), db_session=db
    )

    viewer_email = random_email()
    viewer_password = random_lower_string()
    viewer_user = await user_crud.create(
        obj_in=UserCreate(email=viewer_email, password=viewer_password, is_active=True), db_session=db
    )

    # Create roles
    admin_role = await role_crud.create(
        obj_in=RoleCreate(name="test-admin-role", description="Administrator with all permissions"),
        db_session=db,
    )

    editor_role = await role_crud.create(
        obj_in=RoleCreate(name="test-editor-role", description="Editor with create and update permissions"),
        db_session=db,
    )

    viewer_role = await role_crud.create(
        obj_in=RoleCreate(name="test-viewer-role", description="Viewer with read-only permissions"),
        db_session=db,
    )

    # Create permissions
    create_permission = await permission_crud.create(
        obj_in=PermissionCreate(name="test-create-permission", description="Permission to create resources"),
        db_session=db,
    )

    read_permission = await permission_crud.create(
        obj_in=PermissionCreate(name="test-read-permission", description="Permission to read resources"),
        db_session=db,
    )

    update_permission = await permission_crud.create(
        obj_in=PermissionCreate(name="test-update-permission", description="Permission to update resources"),
        db_session=db,
    )

    delete_permission = await permission_crud.create(
        obj_in=PermissionCreate(name="test-delete-permission", description="Permission to delete resources"),
        db_session=db,
    )

    # Assign permissions to roles
    # Admin gets all permissions
    db.add_all(
        [
            RolePermission(role_id=admin_role.id, permission_id=create_permission.id),
            RolePermission(role_id=admin_role.id, permission_id=read_permission.id),
            RolePermission(role_id=admin_role.id, permission_id=update_permission.id),
            RolePermission(role_id=admin_role.id, permission_id=delete_permission.id),
        ]
    )

    # Editor gets create, read and update permissions
    db.add_all(
        [
            RolePermission(role_id=editor_role.id, permission_id=create_permission.id),
            RolePermission(role_id=editor_role.id, permission_id=read_permission.id),
            RolePermission(role_id=editor_role.id, permission_id=update_permission.id),
        ]
    )

    # Viewer only gets read permission
    db.add(RolePermission(role_id=viewer_role.id, permission_id=read_permission.id))

    # Assign roles to users
    db.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))
    db.add(UserRole(user_id=editor_user.id, role_id=editor_role.id))
    db.add(UserRole(user_id=viewer_user.id, role_id=viewer_role.id))

    await db.commit()

    # Helper function to get token headers for a user
    async def get_user_token(email, password):
        login_response = await client.post(
            f"{settings.API_V1_STR}/login/access-token", data={"username": email, "password": password}
        )
        assert login_response.status_code == 200
        tokens = login_response.json()
        return {"Authorization": f"Bearer {tokens['access_token']}"}

    # Get tokens for each user
    admin_token = await get_user_token(admin_email, admin_password)
    editor_token = await get_user_token(editor_email, editor_password)
    viewer_token = await get_user_token(viewer_email, viewer_password)

    # Test case 1: Create operation - Admin and Editor can create, Viewer cannot
    test_role_data = {"name": f"test-role-{random_lower_string(8)}", "description": "Test Role"}

    # Admin should be able to create
    response = await client.post(f"{settings.API_V1_STR}/role/", headers=admin_token, json=test_role_data)
    assert response.status_code == 201

    # Editor should be able to create
    response = await client.post(
        f"{settings.API_V1_STR}/role/",
        headers=editor_token,
        json={"name": f"test-role-{random_lower_string(8)}", "description": "Test Role"},
    )
    assert response.status_code == 201

    # Viewer should NOT be able to create
    response = await client.post(
        f"{settings.API_V1_STR}/role/",
        headers=viewer_token,
        json={"name": f"test-role-{random_lower_string(8)}", "description": "Test Role"},
    )
    assert response.status_code == 403

    # Test case 2: Read operation - All users can read
    response = await client.get(f"{settings.API_V1_STR}/role/", headers=admin_token)
    assert response.status_code == 200

    response = await client.get(f"{settings.API_V1_STR}/role/", headers=editor_token)
    assert response.status_code == 200

    response = await client.get(f"{settings.API_V1_STR}/role/", headers=viewer_token)
    assert response.status_code == 200

    # Test case 3: Update operation - Admin and Editor can update, Viewer cannot
    # First create a role to update
    create_response = await client.post(
        f"{settings.API_V1_STR}/role/",
        headers=admin_token,
        json={"name": f"role-to-update-{random_lower_string(8)}", "description": "Original Description"},
    )
    assert create_response.status_code == 201
    created_role = create_response.json()
    role_id = created_role["id"]

    # Admin should be able to update
    response = await client.patch(
        f"{settings.API_V1_STR}/role/{role_id}", headers=admin_token, json={"description": "Updated by Admin"}
    )
    assert response.status_code == 200

    # Editor should be able to update
    response = await client.patch(
        f"{settings.API_V1_STR}/role/{role_id}",
        headers=editor_token,
        json={"description": "Updated by Editor"},
    )
    assert response.status_code == 200

    # Viewer should NOT be able to update
    response = await client.patch(
        f"{settings.API_V1_STR}/role/{role_id}",
        headers=viewer_token,
        json={"description": "Updated by Viewer"},
    )
    assert response.status_code == 403

    # Test case 4: Delete operation - Only Admin can delete
    # First create a role to delete
    create_response = await client.post(
        f"{settings.API_V1_STR}/role/",
        headers=admin_token,
        json={"name": f"role-to-delete-{random_lower_string(8)}", "description": "To be deleted"},
    )
    assert create_response.status_code == 201
    created_role = create_response.json()
    role_id = created_role["id"]

    # Editor should NOT be able to delete
    response = await client.delete(f"{settings.API_V1_STR}/role/{role_id}", headers=editor_token)
    assert response.status_code == 403

    # Viewer should NOT be able to delete
    response = await client.delete(f"{settings.API_V1_STR}/role/{role_id}", headers=viewer_token)
    assert response.status_code == 403

    # Admin should be able to delete
    response = await client.delete(f"{settings.API_V1_STR}/role/{role_id}", headers=admin_token)
    assert response.status_code == 200

    # Test case 5: Verify permissions are correctly linked to users through roles
    # Check admin permissions
    response = await client.get(f"{settings.API_V1_STR}/user/me/permissions", headers=admin_token)
    assert response.status_code == 200
    admin_permissions = {perm["name"] for perm in response.json()}
    assert "test-create-permission" in admin_permissions
    assert "test-read-permission" in admin_permissions
    assert "test-update-permission" in admin_permissions
    assert "test-delete-permission" in admin_permissions

    # Check editor permissions
    response = await client.get(f"{settings.API_V1_STR}/user/me/permissions", headers=editor_token)
    assert response.status_code == 200
    editor_permissions = {perm["name"] for perm in response.json()}
    assert "test-create-permission" in editor_permissions
    assert "test-read-permission" in editor_permissions
    assert "test-update-permission" in editor_permissions
    assert "test-delete-permission" not in editor_permissions

    # Check viewer permissions
    response = await client.get(f"{settings.API_V1_STR}/user/me/permissions", headers=viewer_token)
    assert response.status_code == 200
    viewer_permissions = {perm["name"] for perm in response.json()}
    assert "test-create-permission" not in viewer_permissions
    assert "test-read-permission" in viewer_permissions
    assert "test-update-permission" not in viewer_permissions
    assert "test-delete-permission" not in viewer_permissions
