from typing import Any, List
from uuid import UUID

from fastapi import HTTPException
from fastapi_pagination import Page, paginate  # Add this import if not present
from redis.asyncio import Redis
from sqlalchemy import exc, select  # removed or_, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.permission_model import Permission
from app.models.role_model import Role
from app.models.role_permission_model import RolePermission
from app.models.user_model import User
from app.schemas.role_schema import IRoleCreate, IRoleUpdate
from app.utils.exceptions.common_exception import ResourceNotFoundException
from app.utils.security_audit import create_audit_log


class CRUDRole(CRUDBase[Role, IRoleCreate, IRoleUpdate]):
    """CRUD operations for Role model"""

    async def create(
        self,
        *,
        obj_in: IRoleCreate | Role,
        created_by_id: UUID | str | None = None,
        db_session: AsyncSession | None = None,
    ) -> Role:
        """Create a new role with permissions"""
        if not db_session:
            raise ValueError("db_session must be provided to CRUD create method")

        # Handle both IRoleCreate schema and Role model instances
        if isinstance(obj_in, IRoleCreate):
            # Extract permission_ids from the input data
            permission_ids = obj_in.permission_ids or []  # Create role data without permission_ids
            role_data = obj_in.model_dump(exclude={"permission_ids"})

            # Create the role
            role = Role(**role_data)
        else:
            # If a Role model instance is passed directly
            role = obj_in
            permission_ids = []

        if created_by_id:
            if isinstance(created_by_id, str):
                role.created_by_id = UUID(created_by_id)
            else:
                role.created_by_id = created_by_id

        try:
            db_session.add(role)
            await db_session.flush()  # Flush to get the role ID

            # Assign permissions if any were provided
            if permission_ids:
                for permission_id in permission_ids:
                    # Create RolePermission mapping
                    role_permission = RolePermission(role_id=role.id, permission_id=permission_id)
                    db_session.add(role_permission)

            await db_session.commit()
        except exc.IntegrityError:
            await db_session.rollback()
            raise HTTPException(
                status_code=409,
                detail="Role already exists",
            )

        await db_session.refresh(role)
        return role

    async def get_role_by_name(self, *, name: str, db_session: AsyncSession) -> Role | None:
        result = await db_session.exec(select(Role).where(Role.name == name))
        return result.scalars().first()

    async def get_all(self, *, db_session: AsyncSession) -> List[Role]:
        """Fetch all roles without pagination."""
        result = await db_session.exec(select(Role).order_by(Role.name))  # Order by name for consistency
        return result.scalars().all()

    async def add_role_to_user(self, *, user: User, role_id: UUID, db_session: AsyncSession) -> Role:
        role = await super().get(id=role_id, db_session=db_session)
        if not role:
            raise ValueError(f"Role with ID {role_id} not found")

        role.users.append(user)
        db_session.add(role)
        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def permission_exist_in_role(self, *, role_id: UUID, db_session: AsyncSession) -> bool:
        result = await db_session.exec(select(RolePermission).where(RolePermission.role_id == role_id))
        permissions = result.all()
        return len(permissions) > 0

    async def user_exist_in_role(self, *, role_id: UUID, db_session: AsyncSession) -> bool:
        """Check if any user is assigned to the role."""
        role = await self.get(id=role_id, db_session=db_session)
        if not role:
            # Or raise an exception if role not found should be handled differently
            return False
        # Check the relationship directly
        return len(role.users) > 0

    async def assign_permissions(
        self, *, role_id: UUID, permission_ids: List[UUID], current_user: User, db_session: AsyncSession
    ) -> Role:
        """Assign permissions to a role"""
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        # To avoid duplicate entries, first check if the permission is already assigned
        for permission_id in permission_ids:
            # Check if relationship already exists
            stmt = select(RolePermission).where(
                (RolePermission.role_id == role_id) & (RolePermission.permission_id == permission_id)
            )
            result = await db_session.exec(stmt)
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
        self, *, role_id: UUID, permission_ids: List[UUID], current_user: User, db_session: AsyncSession
    ) -> Role:
        """Remove permissions from a role"""
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        # Track missing permission_ids
        missing_permission_ids = []
        mappings_to_delete = []
        for permission_id in permission_ids:
            stmt = select(RolePermission).where(
                (RolePermission.role_id == role_id) & (RolePermission.permission_id == permission_id)
            )
            result = await db_session.exec(stmt)
            mapping = result.scalar_one_or_none()
            if mapping:
                mappings_to_delete.append(mapping)
            else:
                missing_permission_ids.append(str(permission_id))

        if missing_permission_ids:
            raise ResourceNotFoundException(
                f"RolePermission mapping not found for permission_ids: {missing_permission_ids} "
                f"on role {role_id}"
            )

        for mapping in mappings_to_delete:
            await db_session.delete(mapping)

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
        self,
        *,
        role_id: UUID,
        redis_client: Redis,
        db_session: AsyncSession | None = None,
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

    async def update(
        self,
        *,
        obj_current: Role,
        obj_new: IRoleUpdate | dict[str, Any],
        db_session: AsyncSession | None = None,
    ) -> Role:
        """Update a role with permissions"""
        if not db_session:
            raise ValueError("db_session must be provided to CRUD update method")

        # Handle both IRoleUpdate schema and dict instances
        if isinstance(obj_new, IRoleUpdate):
            # Extract permission_ids from the input data
            permission_ids = obj_new.permission_ids
            # Get update data without permission_ids
            update_data = obj_new.model_dump(exclude_unset=True, exclude={"permission_ids"})
        elif isinstance(obj_new, dict):
            permission_ids = obj_new.pop("permission_ids", None)
            update_data = obj_new
        else:
            # Fallback for other types
            update_data = obj_new.model_dump(exclude_unset=True) if hasattr(obj_new, "model_dump") else {}
            permission_ids = None

        # Update basic fields
        for field, value in update_data.items():
            setattr(obj_current, field, value)

        # Handle permission updates if provided
        if permission_ids is not None:
            # Clear existing permissions
            await db_session.exec(select(RolePermission).where(RolePermission.role_id == obj_current.id))
            # Remove existing permissions
            result = await db_session.exec(
                select(RolePermission).where(RolePermission.role_id == obj_current.id)
            )
            existing_permissions = result.scalars().all()
            for rp in existing_permissions:
                await db_session.delete(rp)

            # Add new permissions
            for permission_id in permission_ids:
                role_permission = RolePermission(role_id=obj_current.id, permission_id=permission_id)
                db_session.add(role_permission)
        try:
            # Use merge instead of add to handle session attachment issues
            merged_obj = await db_session.merge(obj_current)
            await db_session.commit()
            await db_session.refresh(merged_obj)
            return merged_obj
        except Exception as e:
            await db_session.rollback()
            raise e

    async def get_multi_paginated(
        self,
        *,
        db_session: AsyncSession | None = None,
        skip: int = 0,
        limit: int = 100,
        name_pattern: str | None = None,
        search: str | None = None,
        params: dict | None = None,
        query: Any = None,
    ) -> Page[Role]:
        """
        Get roles with optional name pattern or search, paginated.
        """
        if db_session is None:
            raise ValueError("db_session (AsyncSession) is required for get_multi_paginated in CRUDRole")
        stmt = select(Role)
        if name_pattern:
            sql_pattern = name_pattern.replace("*", "%")
            stmt = stmt.where(Role.name.ilike(sql_pattern))  # type: ignore
        elif search:
            stmt = stmt.where(Role.name.ilike(f"%{search}%"))  # type: ignore
        stmt = stmt.order_by(Role.name)
        result = await db_session.exec(stmt)  # type: ignore
        roles = result.scalars().all()
        # Serialize roles to dicts matching IRoleRead before paginating
        from app.schemas.role_schema import IRoleRead
        from app.utils.role_utils import serialize_role

        serialized_roles = [IRoleRead.model_validate(serialize_role(role)) for role in roles]
        return paginate(serialized_roles)


role_crud = CRUDRole(Role)
# Keep the original name for backward compatibility
role = role_crud
