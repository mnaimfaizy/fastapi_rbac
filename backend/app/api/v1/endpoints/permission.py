from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi_pagination import Params

from app import crud
from app.api import deps
from app.deps import permission_deps
from app.models.permission_model import Permission
from app.models.user_model import User
from app.schemas.permission_schema import (
    IPermissionCreate,
    IPermissionRead,
    IPermissionUpdate,
)
from app.schemas.response_schema import (
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    IPutResponseBase,
    create_response,
)
from app.schemas.role_schema import IRoleEnum
from app.utils.exceptions import IdNotFoundException, NameExistException

router = APIRouter()


@router.get("")
async def get_permissions(
    params: Params = Depends(), current_user: User = Depends(deps.get_current_user())
) -> IGetResponsePaginated[IPermissionRead]:
    """
    Gets a paginated list of permission
    """
    permissions = await crud.permission.get_multi_paginated(params=params)
    return create_response(data=permissions)


@router.get("/{permission_id}", response_model=IPermissionRead)
async def get_permission_by_id(
    permission_id: UUID, current_user: User = Depends(deps.get_current_user())
) -> IGetResponseBase[IPermissionRead]:
    """
    Gets a permission by its ID
    """
    permission = await crud.permission.get_permission_by_id(permission_id=permission_id)
    if permission:
        return create_response(data=permission)
    else:
        raise IdNotFoundException(Permission, id=permission_id)


@router.post("")
async def create_permission(
    permission: IPermissionCreate,
    current_user: User = Depends(
        deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])
    ),
) -> IPostResponseBase[IPermissionRead]:
    """
    Creates a new role permission

    Required roles:
    - admin
    - manager
    """
    permission_current = await crud.permission.get_permission_by_name(
        name=permission.name
    )
    if permission_current:
        raise NameExistException(Permission, name=permission.name)
    new_permission = await crud.permission.create(
        obj_in=permission, created_by_id=current_user.id
    )
    return create_response(data=new_permission)


@router.put("/{permission_id}")
async def update_permission(
    group: IPermissionUpdate,
    current_group: Permission = Depends(permission_deps.get_permission_by_id),
    current_user: User = Depends(
        deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])
    ),
) -> IPutResponseBase[IPermissionRead]:
    """
    Updates a permission by its id

    Required roles:
    - admin
    - manager
    """
    permission_updated = await crud.permission.update(
        obj_current=current_group, obj_new=group
    )
    return create_response(data=permission_updated)
