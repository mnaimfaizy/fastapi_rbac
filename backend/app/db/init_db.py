from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.config import settings
from app.models import Permission as PermissionModel
from app.models import PermissionGroup as PermissionGroupModel
from app.models import Role as RoleModel
from app.models import RoleGroup as RoleGroupModel
from app.models import User as UserModel
from app.schemas.permission_group_schema import IPermissionGroupCreate
from app.schemas.permission_schema import IPermissionCreate
from app.schemas.role_group_schema import IRoleGroupCreate
from app.schemas.role_schema import IRoleCreate
from app.schemas.user_schema import IUserCreate
from app.utils.string_utils import format_permission_name

current_date = datetime.now(timezone.utc).replace(tzinfo=None)

SUPERUSER_EMAIL = settings.FIRST_SUPERUSER_EMAIL

INITIAL_USERS_DATA: List[Dict[str, Any]] = [
    {
        "user_data": IUserCreate(
            first_name="Admin",
            last_name="FastAPI",
            password=settings.FIRST_SUPERUSER_PASSWORD,
            email=SUPERUSER_EMAIL,
            is_superuser=True,
            is_active=True,
            verified=True,
            last_changed_password_date=current_date,
            expiry_date=current_date,
            needs_to_change_password=False,
            roles=[],
        ),
        "role_names": ["Admin"],
    },
    {
        "user_data": IUserCreate(
            first_name="Manager",
            last_name="FastAPI",
            password=settings.FIRST_SUPERUSER_PASSWORD,
            email="manager@example.com",
            is_superuser=False,
            is_active=True,
            verified=True,
            last_changed_password_date=current_date,
            expiry_date=current_date,
            needs_to_change_password=False,
            roles=[],
        ),
        "role_names": ["Manager"],
    },
    {
        "user_data": IUserCreate(
            first_name="User",
            last_name="FastAPI",
            password=settings.FIRST_SUPERUSER_PASSWORD,
            email="user@example.com",
            is_superuser=False,
            is_active=True,
            verified=True,
            last_changed_password_date=current_date,
            expiry_date=current_date,
            needs_to_change_password=False,
            roles=[],
        ),
        "role_names": ["User"],
    },
]

INITIAL_PERMISSION_GROUPS: List[Dict[str, Any]] = [
    {"name": "User", "description": "Permissions for managing users"},
    {"name": "Role", "description": "Permissions for managing roles"},
    {"name": "Permission", "description": "Permissions for managing permissions"},
    {"name": "Role Group", "description": "Permissions for managing role groups"},
    {
        "name": "Permission Group",
        "description": "Permissions for managing permission groups",
    },
    {"name": "Self", "description": "Permissions for users managing their own profile"},
    {"name": "Content", "description": "Permissions for managing general content"},
]

INITIAL_PERMISSIONS: List[Dict[str, str]] = [
    # User Permissions
    {"name": "create", "description": "Create users", "group_name": "User"},
    {"name": "read", "description": "Read user data (all users)", "group_name": "User"},
    {
        "name": "update",
        "description": "Update user data (all users)",
        "group_name": "User",
    },
    {"name": "delete", "description": "Delete users", "group_name": "User"},
    {"name": "manage_roles", "description": "Manage user roles", "group_name": "User"},
    # Role Permissions
    {"name": "create", "description": "Create roles", "group_name": "Role"},
    {"name": "read", "description": "Read roles", "group_name": "Role"},
    {"name": "update", "description": "Update roles", "group_name": "Role"},
    {"name": "delete", "description": "Delete roles", "group_name": "Role"},
    # Permission Permissions
    {"name": "create", "description": "Create permissions", "group_name": "Permission"},
    {"name": "read", "description": "Read permissions", "group_name": "Permission"},
    {"name": "update", "description": "Update permissions", "group_name": "Permission"},
    {"name": "delete", "description": "Delete permissions", "group_name": "Permission"},
    # RoleGroup Permissions
    {
        "name": "create",
        "description": "Create role groups",
        "group_name": "Role Group",
    },
    {
        "name": "read",
        "description": "Read role groups",
        "group_name": "Role Group",
    },
    {
        "name": "update",
        "description": "Update role groups",
        "group_name": "Role Group",
    },
    {
        "name": "delete",
        "description": "Delete role groups",
        "group_name": "Role Group",
    },
    # PermissionGroup Permissions
    {
        "name": "create",
        "description": "Create permission groups",
        "group_name": "Permission Group",
    },
    {
        "name": "read",
        "description": "Read permission groups",
        "group_name": "Permission Group",
    },
    {
        "name": "update",
        "description": "Update permission groups",
        "group_name": "Permission Group",
    },
    {
        "name": "delete",
        "description": "Delete permission groups",
        "group_name": "Permission Group",
    },
    # Self Profile Permissions
    {
        "name": "read_profile",
        "description": "Read own user profile",
        "group_name": "Self",
    },
    {
        "name": "update_profile",
        "description": "Update own user profile",
        "group_name": "Self",
    },
    {"name": "read_roles", "description": "Read own roles", "group_name": "Self"},
    {
        "name": "read_permissions",
        "description": "Read own aggregated permissions",
        "group_name": "Self",
    },
    # Content Permissions
    {
        "name": "create_article",
        "description": "Create articles",
        "group_name": "Content",
    },
    {"name": "read_article", "description": "Read articles", "group_name": "Content"},
    {
        "name": "update_article",
        "description": "Update articles",
        "group_name": "Content",
    },
    {
        "name": "delete_article",
        "description": "Delete articles",
        "group_name": "Content",
    },
]

INITIAL_ROLE_GROUPS: List[Dict[str, Any]] = [
    {"name": "Administrative", "description": "Roles with high-level access"},
    {"name": "Operational", "description": "Roles for day-to-day operations"},
    {"name": "StandardUser", "description": "Standard user roles"},
]

ALL_PERMISSION_NAMES_QUALIFIED = [
    format_permission_name(p["name"], pg_name_dict["name"])
    for pg_name_dict in INITIAL_PERMISSION_GROUPS
    for p in INITIAL_PERMISSIONS
    if p["group_name"] == pg_name_dict["name"]
]


INITIAL_ROLES: List[Dict[str, Any]] = [
    {
        "name": "Admin",
        "description": "Administrator with all permissions",
        "group_name": "Administrative",
        "permission_names": ALL_PERMISSION_NAMES_QUALIFIED,
    },
    {
        "name": "Manager",
        "description": "Manager with user and content management permissions",
        "group_name": "Operational",
        "permission_names": [
            "user.create",
            "user.read",
            "user.update",
            "role.read",
            "permission.read",
            "role_group.read",
            "permission_group.read",
            "self.read_profile",
            "self.update_profile",
            "self.read_roles",
            "self.read_permissions",
            "content.create_article",
            "content.read_article",
            "content.update_article",
            "content.delete_article",
        ],
    },
    {
        "name": "User",
        "description": "Standard user with self-management and basic content interaction",
        "group_name": "StandardUser",
        "permission_names": [
            "self.read_profile",
            "self.update_profile",
            "self.read_roles",
            "self.read_permissions",
            "content.read_article",
        ],
    },
]


async def get_or_create_superuser(db_session: AsyncSession) -> UserModel:
    user = await crud.user.get_by_email(email=SUPERUSER_EMAIL, db_session=db_session)
    if not user:
        superuser_data_entry = next(
            (u["user_data"] for u in INITIAL_USERS_DATA if u["user_data"].email == SUPERUSER_EMAIL),
            None,
        )
        if not superuser_data_entry:
            raise Exception(f"Superuser email {SUPERUSER_EMAIL} not found in INITIAL_USERS_DATA.")

        user = await crud.user.create(obj_in=superuser_data_entry, db_session=db_session)
        if not user:
            raise Exception(f"Could not create superuser {SUPERUSER_EMAIL}")
    return user


async def init_db(db_session: AsyncSession) -> None:
    superuser = await get_or_create_superuser(db_session=db_session)
    admin_user_id = superuser.id

    created_permission_groups: Dict[str, PermissionGroupModel] = {}
    for pg_data in INITIAL_PERMISSION_GROUPS:
        pg_obj = await crud.permission_group.get_by_name(name=pg_data["name"], db_session=db_session)
        if not pg_obj:
            pg_create_schema = IPermissionGroupCreate(
                name=pg_data["name"],
                description=pg_data["description"],
                created_by_id=admin_user_id,
            )
            pg_obj = await crud.permission_group.create(obj_in=pg_create_schema, db_session=db_session)
        if pg_obj:
            created_permission_groups[pg_data["name"]] = pg_obj
        else:
            print(f"Warning: Could not create/retrieve permission group {pg_data['name']}")

    created_permissions: Dict[str, PermissionModel] = {}
    for perm_data in INITIAL_PERMISSIONS:
        action_name = perm_data["name"]
        group_name_for_perm = perm_data["group_name"]

        permission_group_obj = created_permission_groups.get(group_name_for_perm)
        if not permission_group_obj:
            print(
                f"Warning: Permission Group '{group_name_for_perm}' not found "
                f"for permission action '{action_name}'. Skipping."
            )
            continue

        # Format the permission name using the utility function
        formatted_permission_name = format_permission_name(action_name, permission_group_obj.name)

        perm_obj = await crud.permission.get_by_name(name=formatted_permission_name, db_session=db_session)
        if not perm_obj:
            perm_create_schema = IPermissionCreate(
                name=formatted_permission_name,
                description=perm_data["description"],
                group_id=permission_group_obj.id,
            )
            perm_obj = await crud.permission.create(obj_in=perm_create_schema, db_session=db_session)

        if perm_obj:
            created_permissions[formatted_permission_name] = perm_obj  # Use formatted name as key
        else:
            print(f"Warning: Could not create/retrieve permission {formatted_permission_name}")

    created_role_groups: Dict[str, RoleGroupModel] = {}
    for rg_data in INITIAL_ROLE_GROUPS:
        rg_obj = await crud.role_group.get_by_name(name=rg_data["name"], db_session=db_session)
        if not rg_obj:
            rg_create_schema = IRoleGroupCreate(
                name=rg_data["name"],
                description=rg_data["description"],
                created_by_id=admin_user_id,
            )
            rg_obj = await crud.role_group.create(obj_in=rg_create_schema, db_session=db_session)
        if rg_obj:
            created_role_groups[rg_data["name"]] = rg_obj
        else:
            print(f"Warning: Could not create/retrieve role group {rg_data['name']}")

    created_roles: Dict[str, RoleModel] = {}
    for role_data in INITIAL_ROLES:
        role_obj = await crud.role.get_role_by_name(name=role_data["name"], db_session=db_session)
        if not role_obj:
            role_group_name = role_data["group_name"]
            role_group = created_role_groups.get(role_group_name)
            if not role_group:
                print(f"Warning: RG '{role_group_name}' not found for role '{role_data['name']}'. Skip.")
                continue

            permission_ids_for_role: List[UUID] = []
            for perm_name in role_data["permission_names"]:
                permission = created_permissions.get(perm_name)
                if permission:
                    permission_ids_for_role.append(permission.id)
                else:
                    print(f"Warning: Perm '{perm_name}' not found for role '{role_data['name']}'. Skip.")

            role_create_schema = IRoleCreate(
                name=role_data["name"],
                description=role_data["description"],
                role_group_id=role_group.id,
                permissions=permission_ids_for_role,
            )
            role_obj = await crud.role.create(obj_in=role_create_schema, db_session=db_session)
        if role_obj:
            created_roles[role_data["name"]] = role_obj
        else:
            print(f"Warning: Could not create/retrieve role {role_data['name']}")

    for user_entry in INITIAL_USERS_DATA:
        user_data_schema = user_entry["user_data"]
        user_obj = await crud.user.get_by_email(email=user_data_schema.email, db_session=db_session)

        if not user_obj:
            if user_data_schema.email != SUPERUSER_EMAIL:  # Superuser already handled
                user_obj = await crud.user.create(obj_in=user_data_schema, db_session=db_session)

        if not user_obj:
            print(f"Warning: User {user_data_schema.email} not found/created. Skip role assignment.")
            continue

        role_names_for_user = user_entry["role_names"]
        role_ids_to_assign: List[UUID] = []

        for role_name in role_names_for_user:
            role_to_assign = created_roles.get(role_name)
            if role_to_assign:
                role_ids_to_assign.append(role_to_assign.id)
            else:
                print(f"Warning: Role '{role_name}' not found for user '{user_obj.email}'. Skip role.")

        if role_ids_to_assign:
            try:
                await crud.user.add_roles_by_ids(
                    db_session=db_session,
                    user_id=user_obj.id,
                    role_ids=role_ids_to_assign,
                )
            except AttributeError:
                print(
                    f"Warning: crud.user.add_roles_by_ids not found. "
                    f"Roles for {user_obj.email} not assigned."
                )
            except Exception as e:
                print(f"Error assigning roles to {user_obj.email}: {e}")

    print("Database initialization complete with initial data.")
