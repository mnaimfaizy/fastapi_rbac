from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Params

from app import crud
from app.api import deps
from app.deps import permission_group_deps
from app.models.permission_group_model import PermissionGroup
from app.models.user_model import User
from app.schemas.permission_group_schema import (
    IPermissionGroupCreate, IPermissionGroupRead, IPermissionGroupUpdate,
    IPermissionGroupWithPermissions)
from app.schemas.response_schema import (IGetResponseBase,
                                         IGetResponsePaginated,
                                         IPostResponseBase, IPutResponseBase,
                                         create_response)
from app.schemas.role_schema import IRoleEnum
from app.utils.exceptions import IdNotFoundException, NameExistException

router = APIRouter()


@router.get("")
async def get_permission_groups(
    params: Params = Depends(), current_user: User = Depends(deps.get_current_user())
) -> IGetResponsePaginated[IPermissionGroupRead]:
    """
    Gets a paginated list of permission groups
    """
    permission_groups = await crud.permission_group.get_multi_paginated(params=params)
    return create_response(data=permission_groups)


@router.get("/{group_id}", response_model=IPermissionGroupRead)
async def get_permission_group_by_id(
    group_id: UUID, current_user: User = Depends(deps.get_current_user())
) -> IGetResponseBase[IPermissionGroupWithPermissions]:
    """
    Gets a role group by its ID
    """
    permission_group = await crud.permission_group.get_group_by_id(group_id=group_id)
    if permission_group:
        return create_response(data=permission_group)
    else:
        raise IdNotFoundException(PermissionGroup, id=group_id)


@router.post("")
async def create_permission_group(
    group: IPermissionGroupCreate,
    current_user: User = Depends(
        deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])
    ),
) -> IPostResponseBase[IPermissionGroupRead]:
    """
    Creates a new role group

    Required roles:
    - admin
    - manager
    """
    permission_group_current = await crud.permission_group.get_group_by_name(
        name=group.name
    )
    if permission_group_current:
        raise NameExistException(PermissionGroup, name=group.name)
    new_group = await crud.permission_group.create(
        obj_in=group, created_by_id=current_user.id
    )
    return create_response(data=new_group)


@router.put("/{group_id}")
async def update_permission_group(
    group: IPermissionGroupUpdate,
    current_group: PermissionGroup = Depends(
        permission_group_deps.get_permission_group_by_id
    ),
    current_user: User = Depends(
        deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])
    ),
) -> IPutResponseBase[IPermissionGroupRead]:
    """
    Updates a group by its id

    Required roles:
    - admin
    - manager
    """
    group_updated = await crud.permission_group.update(
        obj_current=current_group, obj_new=group
    )
    return create_response(data=group_updated)
