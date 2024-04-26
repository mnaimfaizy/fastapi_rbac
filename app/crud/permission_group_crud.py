from uuid import UUID

from sqlalchemy import literal
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.permission_group_model import PermissionGroup
from app.schemas.permission_group_schema import (IPermissionGroupCreate,
                                                 IPermissionGroupUpdate)


class CRUDPermissionGroup(
    CRUDBase[PermissionGroup, IPermissionGroupCreate, IPermissionGroupUpdate]
):
    async def get_group_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> PermissionGroup:
        db_session = db_session or super().get_db().session
        permission_group = await db_session.execute(
            select(PermissionGroup).where(PermissionGroup.name == name)
        )
        return permission_group.scalar_one_or_none()

    async def get(
        self, *, id: UUID | str, db_session: AsyncSession | None = None
    ) -> PermissionGroup | None:
        db_session = db_session or super().get_db().session
        query = select(PermissionGroup, literal(0).label("parent_group"))
        result = await db_session.execute(query)
        group = result.scalar_one_or_none()

        if group:
            group = group[0].__dict__
            parent_group_query = select(PermissionGroup).where(
                PermissionGroup.permission_group_id == group["permission_group_id"]
            )
            parent_group_result = await db_session.execute(parent_group_query)
            group["parent_group"] = parent_group_result.scalar_one_or_none()

            groups_query = select(PermissionGroup).where(
                or_(
                    PermissionGroup.permission_group_id is None,
                    PermissionGroup.permission_group_id == "",
                )
            )
            groups_result = await db_session.execute(groups_query)
            groups = groups_result.scalars().all()

            data = {
                "group": group,
                "groups": groups,
            }
            return data

        return None

    async def check_role_exists_in_group(
        self, *, group_id: UUID, db_session: AsyncSession | None = None
    ) -> bool:
        db_session = db_session or super().get_db().session
        permission_group = await db_session.execute(
            select(PermissionGroup).where(
                PermissionGroup.permission_group_id == group_id
            )
        )
        if permission_group.scalar_one_or_none():
            return True
        return False


permission_group = CRUDPermissionGroup(PermissionGroup)
