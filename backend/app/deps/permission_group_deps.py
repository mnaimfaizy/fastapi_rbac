from uuid import UUID

from fastapi import Path, Query
from typing_extensions import Annotated

from app import crud
from app.models.permission_group_model import PermissionGroup
from app.utils.exceptions.common_exception import (IdNotFoundException,
                                                   NameNotFoundException)


async def get_permission_group_by_name(
    group_name: Annotated[
        str, Query(description="String compare with role group name")
    ] = ""
) -> str:
    group = await crud.permission_group.get_group_by_name(name=group_name)
    if not group:
        raise NameNotFoundException(PermissionGroup, name=group_name)
    return group


async def get_permission_group_by_id(
    group_id: Annotated[UUID, Path(description="The UUID id of the group")]
) -> PermissionGroup:
    group = await crud.permission_group.get(id=group_id)
    if not group:
        raise IdNotFoundException(PermissionGroup, id=group_id)
    return group
