from uuid import UUID

from app import crud
from app.models.role_group_model import RoleGroup
from app.utils.exceptions.common_exception import (IdNotFoundException,
                                                   NameNotFoundException)
from fastapi import Path, Query
from typing_extensions import Annotated


async def get_group_by_name(
    group_name: Annotated[
        str, Query(description="String compare with role group name")
    ] = "",
) -> str:
    group = await crud.role_group.get_group_by_name(name=group_name)
    if not group:
        raise NameNotFoundException(RoleGroup, name=group_name)
    return group


async def get_group_by_id(
    group_id: Annotated[UUID, Path(description="The UUID id of the group")],
) -> RoleGroup:
    group = await crud.role_group.get(id=group_id)
    if not group:
        raise IdNotFoundException(RoleGroup, id=group_id)
    return group
