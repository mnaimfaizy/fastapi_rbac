"""
Async-compatible model factories for testing.

This module provides factories that work with async SQLModel sessions
for testing purposes.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import PasswordValidator
from app.models.permission_group_model import PermissionGroup
from app.models.permission_model import Permission
from app.models.role_group_model import RoleGroup
from app.models.role_model import Role
from app.models.role_permission_model import RolePermission
from app.models.user_model import User
from app.models.user_role_model import UserRole
from app.utils.uuid6 import uuid7


class AsyncFactoryBase:
    """Base class for async-compatible factories."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_and_save(self, model_class: type, **kwargs: Any) -> Any:
        """Create a model instance and save it to the database."""
        instance = model_class(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance


class AsyncUserFactory(AsyncFactoryBase):
    """Async factory for creating User model instances."""

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.fake_counter = 1000  # Start from 1000 to avoid conflicts

    def _get_fake_email(self) -> str:
        """Generate a unique fake email."""
        self.fake_counter += 1
        return f"user{self.fake_counter}@example.com"

    def _get_fake_name(self, prefix: str = "User") -> str:
        """Generate a fake name."""
        return f"{prefix}{self.fake_counter}"

    async def create(
        self,
        email: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        password: Optional[str] = None,
        is_active: bool = True,
        is_superuser: bool = False,
        verified: bool = True,
        needs_to_change_password: bool = False,
        roles: Optional[List[Role]] = None,
        **kwargs: Any,
    ) -> User:
        """Create a user with the given parameters."""

        # Set defaults
        if email is None:
            email = self._get_fake_email()
        if first_name is None:
            first_name = self._get_fake_name("First")
        if last_name is None:
            last_name = self._get_fake_name("Last")
        if password is None:
            password = "password123"

        # Hash the password
        hashed_password = PasswordValidator.get_password_hash(password)

        # Prepare user data
        user_data = {
            "id": uuid7(),
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "password": hashed_password,
            "is_active": is_active,
            "is_superuser": is_superuser,
            "verified": verified,
            "needs_to_change_password": needs_to_change_password,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_changed_password_date": datetime.now(timezone.utc),
            **kwargs,
        }

        # Create and save user
        user = await self.create_and_save(User, **user_data)

        # Add roles if provided
        if roles:
            for role in roles:
                user_role = UserRole(user_id=user.id, role_id=role.id)
                self.session.add(user_role)
            await self.session.flush()

        return user

    async def create_admin(self, **kwargs: Any) -> User:
        """Create an admin user."""
        kwargs.setdefault("email", "admin@example.com")
        kwargs.setdefault("is_superuser", True)
        return await self.create(**kwargs)

    async def create_locked(self, **kwargs: Any) -> User:
        """Create a locked user."""
        now = datetime.now(timezone.utc)
        kwargs.update(
            {"is_locked": True, "number_of_failed_attempts": 5, "locked_until": now + timedelta(hours=1)}
        )
        return await self.create(**kwargs)

    async def create_unverified(self, **kwargs: Any) -> User:
        """Create an unverified user."""
        import random
        import string

        verification_code = "".join(random.choices(string.digits, k=6))
        kwargs.update({"verified": False, "verification_code": verification_code})
        return await self.create(**kwargs)


class AsyncRoleFactory(AsyncFactoryBase):
    """Async factory for creating Role model instances."""

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.fake_counter = 1000

    def _get_fake_name(self) -> str:
        """Generate a unique fake role name."""
        self.fake_counter += 1
        return f"role_{self.fake_counter}"

    async def create(
        self,
        name: Optional[str] = None,
        description: Optional[str] = None,
        permissions: Optional[List[Permission]] = None,
        role_group_id: Optional[str] = None,
        **kwargs: Any,
    ) -> Role:
        """Create a role with the given parameters."""

        if name is None:
            name = self._get_fake_name()
        if description is None:
            description = f"Description for {name}"

        role_data = {
            "id": uuid7(),
            "name": name,
            "description": description,
            "role_group_id": role_group_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            **kwargs,
        }

        role = await self.create_and_save(Role, **role_data)

        # Add permissions if provided
        if permissions:
            for permission in permissions:
                role_permission = RolePermission(role_id=role.id, permission_id=permission.id)
                self.session.add(role_permission)
            await self.session.flush()

        return role

    async def create_admin_role(self, permissions: Optional[List[Permission]] = None) -> Role:
        """Create an admin role."""
        return await self.create(
            name="admin", description="Administrator role with full permissions", permissions=permissions
        )

    async def create_user_role(self, permissions: Optional[List[Permission]] = None) -> Role:
        """Create a basic user role."""
        return await self.create(name="user", description="Basic user role", permissions=permissions)


class AsyncPermissionFactory(AsyncFactoryBase):
    """Async factory for creating Permission model instances."""

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.fake_counter = 1000

    def _get_fake_name(self) -> str:
        """Generate a unique fake permission name."""
        self.fake_counter += 1
        return f"permission_{self.fake_counter}"

    async def create(
        self,
        name: Optional[str] = None,
        description: Optional[str] = None,
        group_id: Optional[Union[str, UUID]] = None,
        **kwargs: Any,
    ) -> Permission:
        """Create a permission with the given parameters."""

        if name is None:
            name = self._get_fake_name()
        if description is None:
            description = f"Description for {name}"

        # If no group_id provided, create a default permission group
        if group_id is None:
            permission_group_factory = AsyncPermissionGroupFactory(self.session)
            group = await permission_group_factory.create(name=f"Group for {name}")
            group_id = group.id
        elif isinstance(group_id, str):
            # Convert string UUID to UUID object
            from uuid import UUID

            group_id = UUID(group_id)

        permission_data = {
            "id": uuid7(),
            "name": name,
            "description": description,
            "group_id": group_id,  # This is now a UUID object
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            **kwargs,
        }

        return await self.create_and_save(Permission, **permission_data)

    async def create_user_permissions(self, group_id: Optional[str] = None) -> List[Permission]:
        """Create basic user permissions."""
        permissions = []
        permission_names = [
            ("user.read", "Read user information"),
            ("user.update", "Update user profile"),
            ("user.delete", "Delete user account"),
        ]

        for name, description in permission_names:
            permission = await self.create(name=name, description=description, group_id=group_id)
            permissions.append(permission)

        return permissions

    async def create_admin_permissions(self, group_id: Optional[str] = None) -> List[Permission]:
        """Create admin permissions."""
        permissions = []
        permission_names = [
            ("user.create", "Create new users"),
            ("user.read", "Read user information"),
            ("user.update", "Update user information"),
            ("user.delete", "Delete users"),
            ("role.create", "Create new roles"),
            ("role.read", "Read role information"),
            ("role.update", "Update role information"),
            ("role.delete", "Delete roles"),
            ("permission.create", "Create new permissions"),
            ("permission.read", "Read permission information"),
            ("permission.update", "Update permission information"),
            ("permission.delete", "Delete permissions"),
        ]

        for name, description in permission_names:
            permission = await self.create(name=name, description=description, group_id=group_id)
            permissions.append(permission)

        return permissions


class AsyncPermissionGroupFactory(AsyncFactoryBase):
    """Async factory for creating PermissionGroup model instances."""

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.fake_counter = 1000

    async def create(
        self, name: Optional[str] = None, description: Optional[str] = None, **kwargs: Any
    ) -> PermissionGroup:
        """Create a permission group."""

        if name is None:
            self.fake_counter += 1
            name = f"permission_group_{self.fake_counter}"
        if description is None:
            description = f"Description for {name}"

        group_data = {
            "id": uuid7(),
            "name": name,
            "description": description,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            **kwargs,
        }

        return await self.create_and_save(PermissionGroup, **group_data)


class AsyncRoleGroupFactory(AsyncFactoryBase):
    """Async factory for creating RoleGroup model instances."""

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.fake_counter = 1000

    async def create(
        self,
        name: Optional[str] = None,
        parent_id: Optional[str] = None,
        **kwargs: Any,
    ) -> RoleGroup:
        """Create a role group."""

        if name is None:
            self.fake_counter += 1
            name = f"role_group_{self.fake_counter}"

        group_data = {
            "id": uuid7(),
            "name": name,
            "parent_id": parent_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            **kwargs,
        }

        return await self.create_and_save(RoleGroup, **group_data)


class AsyncTestDataBuilder:
    """Helper class to build complex test data scenarios."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_factory = AsyncUserFactory(session)
        self.role_factory = AsyncRoleFactory(session)
        self.permission_factory = AsyncPermissionFactory(session)
        self.permission_group_factory = AsyncPermissionGroupFactory(session)
        self.role_group_factory = AsyncRoleGroupFactory(session)

    async def create_basic_rbac_setup(self) -> Dict[str, Any]:
        """Create a basic RBAC setup with users, roles, and permissions."""

        # Create permission groups
        user_perm_group = await self.permission_group_factory.create(
            name="User Management", description="Permissions for user management"
        )

        admin_perm_group = await self.permission_group_factory.create(
            name="Admin Operations", description="Permissions for administrative operations"
        )  # Create permissions
        user_permissions = await self.permission_factory.create_user_permissions(
            group_id=str(user_perm_group.id)
        )
        admin_permissions = await self.permission_factory.create_admin_permissions(
            group_id=str(admin_perm_group.id)
        )

        # Create role group
        role_group = await self.role_group_factory.create(
            name="Primary Roles", description="Main application roles"
        )

        # Create roles
        user_role = await self.role_factory.create_user_role(permissions=user_permissions)
        admin_role = await self.role_factory.create_admin_role(permissions=admin_permissions)

        # Create users
        regular_user = await self.user_factory.create(email="user@example.com", roles=[user_role])

        admin_user = await self.user_factory.create_admin(email="admin@example.com", roles=[admin_role])

        # Commit all changes
        await self.session.commit()

        return {
            "users": {"regular": regular_user, "admin": admin_user},
            "roles": {"user": user_role, "admin": admin_role},
            "permissions": {"user": user_permissions, "admin": admin_permissions},
            "groups": {"permission_groups": [user_perm_group, admin_perm_group], "role_groups": [role_group]},
        }
