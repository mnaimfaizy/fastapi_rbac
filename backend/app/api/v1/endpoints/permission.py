from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_pagination import Params
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.deps import permission_deps
from app.models.permission_model import Permission
from app.models.user_model import User
from app.schemas.permission_schema import IPermissionCreate, IPermissionRead
from app.schemas.response_schema import (
    IDeleteResponseBase,
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    create_response,
)
from app.utils.exceptions.common_exception import IdNotFoundException, NameExistException
from app.utils.string_utils import format_permission_name

router = APIRouter()


@router.get("")
async def get_permissions(
    params: Params = Depends(),
    group_id: Optional[UUID] = None,
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["permission.read"])),
) -> IGetResponsePaginated[IPermissionRead]:
    """
    Gets a paginated list of permission, optionally filtered by group_id
    """
    if group_id:
        # Get all permissions for the group and manually paginate
        permissions = await crud.permission.get_permissions_by_group(
            group_id=group_id, skip=(params.page - 1) * params.size, limit=params.size, db_session=db_session
        )
        # Manually build a paginated response
        total_permissions = len(
            await crud.permission.get_permissions_by_group(
                group_id=group_id, skip=0, limit=10000, db_session=db_session
            )
        )

        class DummyPage:
            def __init__(self, items: list, total: int, page: int, size: int) -> None:
                self.items = items
                self.total = total
                self.page = page
                self.size = size

        page = DummyPage(permissions, total_permissions, params.page, params.size)
        return create_response(data=page)
    else:
        permissions = await crud.permission.get_multi_paginated(params=params, db_session=db_session)
        return create_response(data=permissions)


@router.get("/{permission_id}", response_model=IGetResponseBase[IPermissionRead])
async def get_permission_by_id(
    permission_id: UUID,
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["permission.read"])),
) -> IGetResponseBase[IPermissionRead]:
    """
    Gets a permission by its ID
    """
    permission = await crud.permission.get_permission_by_id(
        permission_id=permission_id, db_session=db_session
    )
    if permission:
        return create_response(data=permission)
    else:
        raise IdNotFoundException(Permission, id=permission_id)


@router.post("")
async def create_permission(
    permission: IPermissionCreate,
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["permission.create"])),
) -> IPostResponseBase[IPermissionRead]:
    """
    Creates a new role permission

    Required roles:
    - admin
    - manager
    """
    # Get the permission group to format the name correctly
    permission_group = await crud.permission_group.get(id=permission.group_id, db_session=db_session)

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
    permission_current = await crud.permission.get_permission_by_name(
        name=formatted_permission.name, db_session=db_session
    )
    if permission_current:
        raise NameExistException(Permission, name=formatted_permission.name)

    new_permission = await crud.permission.create(
        obj_in=formatted_permission,
        created_by_id=current_user.id,
        db_session=db_session,
    )
    return create_response(data=new_permission)


@router.delete("/{permission_id}")
async def delete_permission(
    permission: Permission = Depends(permission_deps.get_permission_by_id),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["permission.delete"])),
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
        is_in_use = await crud.permission.is_permission_in_use(
            permission_id=permission.id, db_session=db_session
        )
        if is_in_use:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Permission '{permission.name}' is currently in use by one or more roles "
                    "and cannot be deleted."
                ),
            )

        deleted_permission = await crud.permission.remove(id=permission.id, db_session=db_session)
        return create_response(data=deleted_permission, message="Permission deleted successfully")
    except Exception as e:
        # Catch potential DB errors or other issues during deletion
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting permission: {str(e)}",
        )
