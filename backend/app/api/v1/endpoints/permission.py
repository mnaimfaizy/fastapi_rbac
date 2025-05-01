from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_pagination import Params

from app import crud
from app.api import deps
from app.deps import permission_deps
from app.models.permission_model import Permission
from app.models.user_model import User
from app.schemas.permission_schema import IPermissionCreate, IPermissionRead, IPermissionUpdate
from app.schemas.response_schema import (
    IDeleteResponseBase,
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    IPutResponseBase,
    create_response,
)
from app.schemas.role_schema import IRoleEnum
from app.utils.exceptions.common_exception import (
    ContentNoChangeException,
    IdNotFoundException,
    NameExistException,
)
from app.utils.string_utils import format_permission_name

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


@router.get("/{permission_id}", response_model=IGetResponseBase[IPermissionRead])
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
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IPostResponseBase[IPermissionRead]:
    """
    Creates a new role permission

    Required roles:
    - admin
    - manager
    """
    # Get the permission group to format the name correctly
    permission_group = await crud.permission_group.get(id=permission.group_id)

    # Format the permission name using the utility function
    if permission_group:
        # Create a copy of the permission object to avoid modifying the input
        permission_dict = permission.model_dump()
        # Format the name using both permission name and group name
        permission_dict["name"] = format_permission_name(permission.name, permission_group.name)
        # Create a new IPermissionCreate instance with the formatted name
        formatted_permission = IPermissionCreate(**permission_dict)
    else:
        # If group not found, just format the permission name without group context
        permission_dict = permission.model_dump()
        permission_dict["name"] = format_permission_name(permission.name)
        formatted_permission = IPermissionCreate(**permission_dict)

    # Check if a permission with the formatted name already exists
    permission_current = await crud.permission.get_permission_by_name(name=formatted_permission.name)
    if permission_current:
        raise NameExistException(Permission, name=formatted_permission.name)

    new_permission = await crud.permission.create(obj_in=formatted_permission, created_by_id=current_user.id)
    return create_response(data=new_permission)


@router.put("/{permission_id}")
async def update_permission(
    permission_update: IPermissionUpdate,
    current_permission: Permission = Depends(permission_deps.get_permission_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IPutResponseBase[IPermissionRead]:
    """
    Updates a permission by its id

    Required roles:
    - admin
    - manager
    """
    # If name is being updated, format it properly
    if permission_update.name:
        # Get the permission group for formatting
        if permission_update.group_id:
            permission_group = await crud.permission_group.get(id=permission_update.group_id)
        else:
            permission_group = await crud.permission_group.get(id=current_permission.group_id)

        # Format the name
        if permission_group:
            formatted_name = format_permission_name(permission_update.name, permission_group.name)
        else:
            formatted_name = format_permission_name(permission_update.name)

        # Create a copy with the formatted name
        update_dict = permission_update.model_dump(exclude_unset=True)
        update_dict["name"] = formatted_name
        permission_update = IPermissionUpdate(**update_dict)

    # Check if there are any actual changes
    current_name = current_permission.name
    update_name = permission_update.name or current_permission.name

    if (
        current_name == update_name
        and current_permission.description == permission_update.description
        and current_permission.group_id == permission_update.group_id
    ):
        raise ContentNoChangeException()

    # Check if the new name conflicts with an existing permission (excluding itself)
    if permission_update.name and permission_update.name != current_permission.name:
        existing_permission = await crud.permission.get_permission_by_name(name=permission_update.name)
        if existing_permission and existing_permission.id != current_permission.id:
            raise NameExistException(Permission, name=permission_update.name)

    permission_updated = await crud.permission.update(
        obj_current=current_permission, obj_new=permission_update
    )
    return create_response(data=permission_updated)


@router.delete("/{permission_id}")
async def delete_permission(
    permission: Permission = Depends(permission_deps.get_permission_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IDeleteResponseBase[IPermissionRead]:
    """
    Deletes a permission by its id

    Required roles:
    - admin
    - manager
    """
    try:
        # Check if permission is currently used by any roles
        # This check is optional but recommended to prevent orphaned references
        # Uncomment if you want to prevent deletion of permissions in use
        # is_in_use = await crud.permission.is_permission_in_use(permission_id=permission.id)
        # if is_in_use:
        #     raise HTTPException(
        #         status_code=status.HTTP_409_CONFLICT,
        #         detail=f"Permission '{permission.name}' is currently in use by one or more roles and cannot be deleted.",
        #     )

        deleted_permission = await crud.permission.remove(id=permission.id)
        return create_response(data=deleted_permission, message="Permission deleted successfully")
    except Exception as e:
        # Catch potential DB errors or other issues during deletion
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting permission: {str(e)}",
        )
