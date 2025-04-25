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
    ) -> RoleGroup | None:
        db_session = db_session or super().get_db().session
        result = await db_session.execute(
            select(RoleGroup).where(RoleGroup.name == name)
        )
        return result.scalar_one_or_none()

    async def check_role_exists_in_group(
        self, *, group_id: UUID, db_session: AsyncSession | None = None
    ) -> bool:
        db_session = db_session or super().get_db().session
        result = await db_session.execute(
            select(RoleGroupMap).where(RoleGroupMap.role_group_id == group_id)
        )
        return result.scalar_one_or_none() is not None

    async def add_roles_to_group(
        self,
        *,
        group_id: UUID,
        role_ids: list[UUID],
        db_session: AsyncSession | None = None,
    ) -> list[RoleGroupMap]:
        """
        Add multiple roles to a group in a batch operation
        for improved performance
        """
        db_session = db_session or super().get_db().session

        # Create all role_group_map objects
        role_group_maps = []
        for role_id in role_ids:
            map_obj = RoleGroupMap(role_id=role_id, role_group_id=group_id)
            db_session.add(map_obj)
            role_group_maps.append(map_obj)

        # Commit once for all objects
        await db_session.commit()

        # Refresh all objects
        for map_obj in role_group_maps:
            await db_session.refresh(map_obj)

        return role_group_maps


role_group = CRUDRoleGroup(RoleGroup)
