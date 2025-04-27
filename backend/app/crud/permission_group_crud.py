from typing import Any, TypedDict
from uuid import UUID

from sqlalchemy import literal
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.permission_group_model import PermissionGroup
from app.schemas.permission_group_schema import IPermissionGroupCreate, IPermissionGroupUpdate


# Type definition for get method return value
class PermissionGroupData(TypedDict):
    group: dict[str, Any]
    groups: list[PermissionGroup]


class CRUDPermissionGroup(CRUDBase[PermissionGroup, IPermissionGroupCreate, IPermissionGroupUpdate]):
    async def get_group_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> PermissionGroup | None:
        db_session = db_session or super().get_db().session
        permission_group = await db_session.execute(
            select(PermissionGroup).where(PermissionGroup.name == name)
        )
        return permission_group.scalar_one_or_none()

    async def get(
        self, *, id: UUID | str, db_session: AsyncSession | None = None
    ) -> PermissionGroupData | None:
        db_session = db_session or super().get_db().session
        query = select(PermissionGroup, literal(0).label("parent_group")).where(PermissionGroup.id == id)
        result = await db_session.execute(query)
        group_result = result.first()

        if group_result:
            group = group_result[0].__dict__.copy()  # Create a copy to avoid modifying the SQLModel instance

            # Query for parent group using proper comparison
            parent_group_query: Any = select(PermissionGroup).where(
                PermissionGroup.id == group.get("permission_group_id")
            )
            parent_group_result = await db_session.execute(parent_group_query)
            group["parent_group"] = parent_group_result.scalar_one_or_none()

            # Query for top-level groups using proper comparison
            groups_query: Any = select(PermissionGroup).where(
                or_(
                    PermissionGroup.permission_group_id.is_(None),
                    PermissionGroup.permission_group_id == "",
                )
            )
            groups_result = await db_session.execute(groups_query)
            groups = groups_result.scalars().all()

            data: PermissionGroupData = {
                "group": group,
                "groups": groups,
            }
            return data

        return None

    async def check_role_exists_in_group(
        self, *, group_id: UUID, db_session: AsyncSession | None = None
    ) -> bool:
        db_session = db_session or super().get_db().session
        result = await db_session.execute(
            select(PermissionGroup).where(PermissionGroup.permission_group_id == group_id)
        )
        return result.scalar_one_or_none() is not None


permission_group = CRUDPermissionGroup(PermissionGroup)
