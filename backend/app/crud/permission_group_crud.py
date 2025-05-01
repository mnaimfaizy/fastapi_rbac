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

    # Override the get_multi_paginated method to load permissions and other relationships
    async def get_multi_paginated(
        self, *, params=None, query_filter=None, db_session: AsyncSession | None = None, **kwargs
    ):
        db_session = db_session or super().get_db().session

        # Start with the base query
        base_query = select(self.model)

        # Add options to load related entities
        base_query = base_query.options(
            selectinload(PermissionGroup.permissions),
            selectinload(PermissionGroup.groups),
            selectinload(PermissionGroup.creator),
        )

        # Apply any filters if provided
        if query_filter is not None:
            base_query = base_query.where(query_filter)

        # Use the paginate function directly
        from fastapi_pagination.ext.sqlmodel import paginate

        return await paginate(db_session, base_query, params, unique=True)


permission_group = CRUDPermissionGroup(PermissionGroup)
