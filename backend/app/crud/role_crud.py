from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.permission_model import Permission  # Add this import
from app.models.role_model import Role
from app.models.role_permission_model import RolePermission
from app.models.user_model import User
from app.schemas.role_schema import IRoleCreate, IRoleUpdate
from app.utils.exceptions.common_exception import ResourceNotFoundException
from app.utils.security_audit import create_audit_log


class CRUDRole(CRUDBase[Role, IRoleCreate, IRoleUpdate]):
    """CRUD operations for Role model"""

    async def get_role_by_name(self, *, name: str, db_session: AsyncSession | None = None) -> Role | None:
        db_session = db_session or super().get_db().session
        role = await db_session.execute(select(Role).where(Role.name == name))
        return role.scalar_one_or_none()

    async def get_all(self, *, db_session: AsyncSession | None = None) -> List[Role]:
        """Fetch all roles without pagination."""
        db_session = db_session or super().get_db().session
        result = await db_session.execute(select(Role).order_by(Role.name))  # Order by name for consistency
        return result.scalars().all()

    async def add_role_to_user(
        self, *, user: User, role_id: UUID, db_session: AsyncSession | None = None
    ) -> Role:
        db_session = db_session or super().get_db().session
        role = await super().get(id=role_id, db_session=db_session)
        if not role:
            raise ValueError(f"Role with ID {role_id} not found")

        role.users.append(user)
        db_session.add(role)
        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def permission_exist_in_role(
        self, *, role_id: UUID, db_session: AsyncSession | None = None
    ) -> bool:
        db_session = db_session or super().get_db().session
        result = await db_session.execute(select(RolePermission).where(RolePermission.role_id == role_id))
        permissions = result.scalars().all()
        return len(permissions) > 0

    async def user_exist_in_role(self, *, role_id: UUID, db_session: AsyncSession | None = None) -> bool:
        """Check if any user is assigned to the role."""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)
        if not role:
            # Or raise an exception if role not found should be handled differently
            return False
        # Check the relationship directly
        return len(role.users) > 0

    async def assign_permissions(
        self,
        *,
        role_id: UUID,
        permission_ids: List[UUID],
        current_user: User,
        db_session: AsyncSession | None = None,
    ) -> Role:
        """Assign permissions to a role"""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        # To avoid duplicate entries, first check if the permission is already assigned
        for permission_id in permission_ids:
            # Check if relationship already exists
            stmt = select(RolePermission).where(
                (RolePermission.role_id == role_id) & (RolePermission.permission_id == permission_id)
            )
            result = await db_session.execute(stmt)
            existing = result.scalar_one_or_none()

            # Only create if it doesn't exist
            if not existing:
                # Create a new RolePermission instance with required fields
                role_permission = RolePermission(role_id=role_id, permission_id=permission_id)
                db_session.add(role_permission)

        # Create audit log
        await create_audit_log(
            db_session=db_session,
            actor_id=current_user.id,
            action="assign_permissions",
            resource_type="role",
            resource_id=str(role_id),
            details={"permission_ids": [str(pid) for pid in permission_ids]},
        )

        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def remove_permissions(
        self,
        *,
        role_id: UUID,
        permission_ids: List[UUID],
        current_user: User,
        db_session: AsyncSession | None = None,
    ) -> Role:
        """Remove permissions from a role"""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        # Delete the specified role-permission mappings properly
        for permission_id in permission_ids:
            # First find the mapping
            stmt = select(RolePermission).where(
                (RolePermission.role_id == role_id) & (RolePermission.permission_id == permission_id)
            )
            result = await db_session.execute(stmt)
            role_permission = result.scalar_one_or_none()

            # If found, delete it
            if role_permission:
                await db_session.delete(role_permission)

        # Create audit log
        await create_audit_log(
            db_session=db_session,
            actor_id=current_user.id,
            action="remove_permissions",
            resource_type="role",
            resource_id=str(role_id),
            details={"permission_ids": [str(pid) for pid in permission_ids]},
        )

        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def validate_system_role(self, *, role_id: UUID, db_session: AsyncSession | None = None) -> bool:
        """Check if a role is a system role that shouldn't be modified"""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            return False

        # List of protected system role names
        system_roles = ["admin", "system", "superuser"]
        return role.name.lower() in system_roles

    async def invalidate_user_permission_caches(
        self, *, role_id: UUID, redis_client, db_session: AsyncSession | None = None
    ) -> None:
        """
        Invalidate permission caches for all users that have this role assigned.
        This is called after role permissions are modified to ensure all users get updated permissions.

        Args:
            role_id: The UUID of the role whose permissions were changed
            redis_client: Redis client for cache operations
            db_session: Optional AsyncSession instance for database operations
        """
        try:
            # Use the provided db_session or get a new one
            db_session = db_session or super().get_db().session
            # Get the role with its users - make sure to request the users relationship
            role = await self.get(id=role_id, db_session=db_session)

            # Ensure the users relationship is loaded
            if role:
                await db_session.refresh(role, ["users"])

            if not role or not role.users:
                # Just invalidate the wildcard pattern if no specific users
                await redis_client.delete("user_permissions:*")
                return

            # Invalidate user permission caches for all users with this role
            for user in role.users:
                # Delete user-specific permission cache
                await redis_client.delete(f"user_permissions:{user.id}")

            # Also delete any general user permission caches
            await redis_client.delete("user_permissions:*")

            # Log the cache invalidation
            import logging

            logging.info(f"Invalidated permission caches for users with role {role_id}")

        except Exception as e:
            # Log the error but don't raise it since this is in a background task
            import logging

            logging.error(f"Error invalidating user permission caches: {str(e)}")

    async def get_permissions(
        self, *, role_id: UUID, db_session: AsyncSession | None = None
    ) -> List[Permission]:
        """Get all permissions assigned to a role.

        Args:
            role_id: The UUID of the role
            db_session: Optional AsyncSession instance for database operations

        Returns:
            List of Permission objects assigned to the role
        """
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        # Make sure permissions are loaded
        await db_session.refresh(role, ["permissions"])

        return role.permissions


role_crud = CRUDRole(Role)
# Keep the original name for backward compatibility
role = role_crud
