from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Params

from app import crud
from app.api import deps
from app.deps import role_group_deps
from app.models.role_group_model import RoleGroup
from app.models.user_model import User
from app.schemas.response_schema import (IGetResponseBase,
                                         IGetResponsePaginated,
                                         IPostResponseBase, IPutResponseBase,
                                         create_response)
from app.schemas.role_group_schema import (IRoleGroupCreate, IRoleGroupRead,
                                           IRoleGroupUpdate,
                                           IRoleGroupWithRoles)
from app.schemas.role_schema import IRoleEnum
from app.utils.exceptions import IdNotFoundException, NameExistException

router = APIRouter()


@router.get("")
async def get_role_groups(
    params: Params = Depends(), current_user: User = Depends(deps.get_current_user())
) -> IGetResponsePaginated[IRoleGroupRead]:
    """
    Gets a paginated list of role groups
    """
    role_groups = await crud.role_group.get_multi_paginated(params=params)
    return create_response(data=role_groups)


@router.get("/{group_id}")
async def get_role_group_by_id(
    group_id: UUID, current_user: User = Depends(deps.get_current_user())
) -> IGetResponseBase[IRoleGroupWithRoles]:
    """
    Gets a role group by its ID
    """
    role_group = await role_group_deps.get_group_by_id(group_id=group_id)
    print(role_group)
    if role_group:
        return create_response(data=role_group)
    else:
        raise IdNotFoundException(RoleGroup, id=group_id)


@router.post("")
async def create_role_group(
    group: IRoleGroupCreate,
    current_user: User = Depends(
        deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])
    ),
) -> IPostResponseBase[IRoleGroupRead]:
    """
    Creates a new role group

    Required roles:
    - admin
    - manager
    """
    role_group_current = await crud.role_group.get_group_by_name(name=group.name)
    if role_group_current:
        raise NameExistException(RoleGroup, name=group.name)
    new_group = await crud.role_group.create(
        obj_in=group, created_by_id=current_user.id
    )
    return create_response(data=new_group)


@router.put("/{group_id}")
async def update_role_group(
    group: IRoleGroupUpdate,
    current_group: RoleGroup = Depends(role_group_deps.get_group_by_id),
    current_user: User = Depends(
        deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])
    ),
) -> IPutResponseBase[IRoleGroupRead]:
    """
    Updates a group by its id

    Required roles:
    - admin
    - manager
    """
    group_updated = await crud.role_group.update(
        obj_current=current_group, obj_new=group
    )
    return create_response(data=group_updated)
