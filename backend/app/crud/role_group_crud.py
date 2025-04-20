from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.role_group_map_model import RoleGroupMap
from app.models.role_group_model import RoleGroup
from app.schemas.role_group_schema import IRoleGroupCreate, IRoleGroupUpdate


class CRUDRoleGroup(CRUDBase[RoleGroup, IRoleGroupCreate, IRoleGroupUpdate]):
    async def get_group_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> RoleGroup:
        db_session = db_session or super().get_db().session
        role_group = await db_session.execute(
            select(RoleGroup).where(RoleGroup.name == name)
        )
        return role_group.scalar_one_or_none()

    async def check_role_exists_in_group(
        self, *, group_id: UUID, db_session: AsyncSession | None = None
    ) -> bool:
        db_session = db_session or super().get_db().session
        role_group = await db_session.execute(
            select(RoleGroupMap).where(RoleGroupMap.role_group_id == group_id)
        )
        if role_group.scalar_one_or_none():
            return True
        return False


role_group = CRUDRoleGroup(RoleGroup)
