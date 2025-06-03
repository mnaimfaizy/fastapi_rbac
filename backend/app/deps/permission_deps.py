from uuid import UUID

from fastapi import Path, Query
from typing_extensions import Annotated

from app import crud
from app.models.permission_model import Permission
from app.utils.exceptions.common_exception import (
    IdNotFoundException,
    NameNotFoundException,
)


async def get_permission_by_name(
    permission_name: Annotated[
        str, Query(description="String compare with role group name")
    ] = "",
) -> str:
    permission = await crud.permission.get_group_by_name(name=permission_name)
    if not permission:
        raise NameNotFoundException(Permission, name=permission_name)
    return permission


async def get_permission_by_id(
    permission_id: Annotated[UUID, Path(description="The UUID id of the group")],
) -> Permission:
    permission = await crud.permission.get(id=permission_id)
    if not permission:
        raise IdNotFoundException(Permission, id=permission_id)
    return permission
