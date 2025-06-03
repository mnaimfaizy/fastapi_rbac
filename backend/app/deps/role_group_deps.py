from uuid import UUID

from fastapi import Depends, Path, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from typing_extensions import Annotated

from app import crud
from app.api.deps import get_async_db
from app.models.role_group_model import RoleGroup
from app.utils.exceptions.common_exception import (
    IdNotFoundException,
    NameNotFoundException,
)


async def get_group_by_name(
    group_name: Annotated[
        str, Query(description="String compare with role group name")
    ] = "",
    db_session: AsyncSession = Depends(get_async_db),
) -> str:
    group = await crud.role_group.get_group_by_name(
        name=group_name, db_session=db_session
    )
    if not group:
        raise NameNotFoundException(RoleGroup, name=group_name)
    return group


async def get_group_by_id(
    group_id: Annotated[UUID, Path(description="The UUID id of the group")],
    db_session: AsyncSession = Depends(get_async_db),
    include_roles_recursive: bool = True,
) -> RoleGroup:
    # Use the hierarchical method to retrieve the group with all relationships and roles
    group = await crud.role_group.get_with_hierarchy(
        id=group_id,
        db_session=db_session,
        include_roles_recursive=include_roles_recursive,
    )
    if not group:
        raise IdNotFoundException(RoleGroup, id=group_id)
    return group
