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
    async def get_group_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> Permission:
        db_session = db_session or super().get_db().session
        permission = await db_session.execute(
            select(Permission).where(Permission.name == name)
        )
        return permission.scalar_one_or_none()

    async def assign_permissions_to_role(
        self,
        *,
        role_id: UUID,
        permissions: list[UUID],
        db_session: AsyncSession | None = None,
    ) -> None:
        db_session = db_session or super().get_db().session
        for permission_id in permissions:
            role_permission = RolePermission(
                role_id=role_id, permission_id=permission_id
            )
            try:
                db_session.add(role_permission)
                await db_session.commit()
            except exc.IntegrityError:
                db_session.rollback()
                raise HTTPException(status_code=500, detail="Internal server error")
        return None


permission = CRUDPermission(Permission)
