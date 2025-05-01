from typing import Any, TypedDict, List
from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.permission_group_model import PermissionGroup
from app.schemas.permission_group_schema import IPermissionGroupCreate, IPermissionGroupUpdate


class PermissionGroupData(TypedDict):
    group: dict[str, Any]
    groups: list[PermissionGroup]


class CRUDPermissionGroup(CRUDBase[PermissionGroup, IPermissionGroupCreate, IPermissionGroupUpdate]):
    async def get_group_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> PermissionGroup | None:
        db_session = db_session or super().get_db().session
        stmt = (
            select(PermissionGroup)
            .options(
                selectinload(PermissionGroup.permissions),
                selectinload(PermissionGroup.groups),
                selectinload(PermissionGroup.creator),
            )
            .where(PermissionGroup.name == name)
        )
        result = await db_session.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_group_by_id(
        self, *, group_id: UUID | str, db_session: AsyncSession | None = None
    ) -> PermissionGroup | None:
        db_session = db_session or super().get_db().session
        query = (
            select(PermissionGroup)
            .options(
                selectinload(PermissionGroup.permissions),
                selectinload(PermissionGroup.groups),
                selectinload(PermissionGroup.creator),
            )
            .where(PermissionGroup.id == group_id)
        )
        result = await db_session.execute(query)
        return result.unique().scalar_one_or_none()

    async def get(self, *, id: UUID | str, db_session: AsyncSession | None = None) -> PermissionGroup | None:
        return await self.get_group_by_id(group_id=id, db_session=db_session)

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        db_session: AsyncSession | None = None,
    ) -> List[PermissionGroup]:
        db_session = db_session or super().get_db().session
        query = (
            select(PermissionGroup)
            .options(
                selectinload(PermissionGroup.permissions),
                selectinload(PermissionGroup.groups),
                selectinload(PermissionGroup.creator),
            )
            .offset(skip)
            .limit(limit)
        )
        result = await db_session.execute(query)
        return result.unique().scalars().all()


permission_group = CRUDPermissionGroup(PermissionGroup)
