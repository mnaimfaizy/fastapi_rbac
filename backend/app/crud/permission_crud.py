from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import exc
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models import RolePermission
from app.models.permission_model import Permission
from app.schemas.permission_schema import IPermissionCreate, IPermissionUpdate


class CRUDPermission(CRUDBase[Permission, IPermissionCreate, IPermissionUpdate]):
    async def get_permission_by_name(  # Renamed from get_group_by_name
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> Permission | None:
        db_session = db_session or super().get_db().session
        stmt = select(Permission).where(Permission.name == name)
        result = await db_session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def assign_permissions_to_role(
        self,
        *,
        role_id: UUID,
        permissions: list[UUID],
        db_session: AsyncSession | None = None,
    ) -> None:
        """
        Assign multiple permissions to a role in a batch operation
        for improved performance
        """
        db_session = db_session or super().get_db().session

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


permission_crud = CRUDPermission(Permission)
# Keep the original name for backward compatibility
permission = permission_crud
