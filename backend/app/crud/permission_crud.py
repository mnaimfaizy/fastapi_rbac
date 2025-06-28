from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import exc, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models import RolePermission
from app.models.permission_model import Permission
from app.schemas.permission_schema import IPermissionCreate, IPermissionUpdate


class CRUDPermission(CRUDBase[Permission, IPermissionCreate, IPermissionUpdate]):
    async def get_permission_by_name(self, *, name: str, db_session: AsyncSession) -> Permission | None:
        """
        Get a permission by its name.

        Args:
            name: The name of the permission to retrieve
            db_session: Database session (required)

        Returns:
            The Permission object if found, None otherwise
        """
        stmt = select(Permission).where(Permission.name == name)
        result = await db_session.exec(stmt)
        return result.unique().one_or_none()

    async def get_by_name(self, *, name: str, db_session: AsyncSession) -> Permission | None:
        """Alias for get_permission_by_name."""
        return await self.get_permission_by_name(name=name, db_session=db_session)

    async def get_permission_by_id(
        self, *, permission_id: UUID, db_session: AsyncSession
    ) -> Permission | None:
        """
        Get a permission by ID with relationships loaded (group and created_by).

        Args:
            permission_id: The ID of the permission to retrieve
            db_session: Database session (required)

        Returns:
            The Permission object with relationships loaded if found, None otherwise
        """
        from sqlalchemy.orm import selectinload

        stmt = (
            select(Permission)
            .options(selectinload(Permission.group))
            .options(selectinload(Permission.created_by))
            .where(Permission.id == permission_id)
        )
        result = await db_session.exec(stmt)
        return result.unique().one_or_none()

    async def get_permissions_by_group(
        self, *, group_id: UUID, skip: int = 0, limit: int = 100, db_session: AsyncSession
    ) -> list[Permission]:
        """
        Get all permissions belonging to a specific permission group.

        Args:
            group_id: The ID of the group to filter permissions by
            skip: Number of records to skip for pagination
            limit: Maximum number of records to return
            db_session: Database session (required)

        Returns:
            List of permissions belonging to the specified group
        """
        stmt = select(Permission).where(Permission.group_id == group_id).offset(skip).limit(limit)
        result = await db_session.exec(stmt)
        return list(result.unique().all())

    async def search_permissions(
        self, *, search_term: str, skip: int = 0, limit: int = 100, db_session: AsyncSession
    ) -> list[Permission]:
        """
        Search permissions by name or description.

        Args:
            search_term: Text to search for in name or description
            skip: Number of records to skip for pagination
            limit: Maximum number of records to return
            db_session: Database session (required)

        Returns:
            List of matching permissions
        """
        search = f"%{search_term}%"
        stmt = (
            select(Permission)
            .where(
                or_(
                    Permission.name.ilike(search),
                    (Permission.description.ilike(search) if Permission.description else False),
                )
            )
            .offset(skip)
            .limit(limit)
        )
        result = await db_session.exec(stmt)
        return list(result.unique().all())

    async def permission_exists(self, *, name: str, db_session: AsyncSession) -> bool:
        """
        Check if a permission with the given name already exists.

        Args:
            name: The name to check
            db_session: Database session (required)

        Returns:
            True if the permission exists, False otherwise
        """
        stmt = select(func.count(Permission.id)).where(Permission.name == name)
        result = await db_session.exec(stmt)
        count = result.one()
        return count > 0

    async def create_bulk(
        self, *, obj_in_list: list[IPermissionCreate], db_session: AsyncSession
    ) -> list[Permission]:
        """
        Create multiple permissions in a single database transaction.

        Args:
            obj_in_list: List of permission create schemas
            db_session: Database session (required)

        Returns:
            List of created Permission objects

        Raises:
            HTTPException: If there's an integrity error (e.g., duplicates)
        """
        try:
            permissions = []
            for obj_in in obj_in_list:
                permission = Permission.model_validate(obj_in)
                db_session.add(permission)
                permissions.append(permission)

            await db_session.commit()

            # Refresh all permissions to get their generated IDs and other DB-default values
            for permission in permissions:
                await db_session.refresh(permission)

            return permissions
        except exc.IntegrityError:
            await db_session.rollback()
            raise HTTPException(
                status_code=409,
                detail="One or more permissions violate uniqueness constraints. Check for duplicate names.",
            )

    async def assign_permissions_to_role(
        self, *, role_id: UUID, permissions: list[UUID], db_session: AsyncSession
    ) -> None:
        """
        Assign multiple permissions to a role in a batch operation
        for improved performance.

        Args:
            role_id: The ID of the role to assign permissions to
            permissions: List of permission IDs to assign to the role
            db_session: Database session (required)

        Raises:
            HTTPException: If there's an integrity error (e.g., already assigned permissions)
        """
        # First check if any of these permissions are already assigned to the role
        if permissions:
            stmt = (
                select(RolePermission)
                .where(RolePermission.role_id == role_id)
                .where(RolePermission.permission_id.in_(permissions))
            )
            result = await db_session.exec(stmt)
            existing_assignments = result.all()

            if existing_assignments:
                # At least one permission is already assigned to this role
                raise HTTPException(
                    status_code=409,
                    detail="One or more permissions are already assigned to this role",
                )

        # Create all role_permission objects
        role_permissions = [
            RolePermission(role_id=role_id, permission_id=permission_id) for permission_id in permissions
        ]

        try:
            # Add all objects to the session at once
            for role_permission in role_permissions:
                db_session.add(role_permission)

            # Commit once for all objects
            await db_session.commit()
        except exc.IntegrityError:
            await db_session.rollback()
            raise HTTPException(
                status_code=409,
                detail="One or more permissions are already assigned to this role",
            )

        return None

    async def remove_permissions_from_role(
        self, *, role_id: UUID, permissions: list[UUID], db_session: AsyncSession
    ) -> None:
        """
        Remove multiple permissions from a role in a batch operation.

        Args:
            role_id: The ID of the role to remove permissions from
            permissions: List of permission IDs to remove from the role
            db_session: Database session (required)
        """
        # Delete all specified role-permission associations
        stmt = (
            RolePermission.__table__.delete()
            .where(RolePermission.role_id == role_id)
            .where(RolePermission.permission_id.in_(permissions))
        )

        await db_session.exec(stmt)
        await db_session.commit()

    async def is_permission_in_use(self, *, permission_id: UUID, db_session: AsyncSession) -> bool:
        """
        Check if a permission is currently assigned to any role.

        Args:
            permission_id: The ID of the permission to check.
            db_session: Database session (required).

        Returns:
            True if the permission is in use by at least one role, False otherwise.
        """
        stmt = select(func.count(RolePermission.role_id)).where(RolePermission.permission_id == permission_id)
        result = await db_session.exec(stmt)
        count = result.one()
        return count > 0


permission_crud = CRUDPermission(Permission)
# Keep the original name for backward compatibility
permission = permission_crud
