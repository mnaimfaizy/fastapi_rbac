from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_pagination import Params
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.deps import permission_group_deps
from app.models.permission_group_model import PermissionGroup
from app.models.user_model import User
from app.schemas.permission_group_schema import (
    IPermissionGroupCreate,
    IPermissionGroupRead,
    IPermissionGroupUpdate,
    IPermissionGroupWithPermissions,
)
from app.schemas.response_schema import (
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    IPutResponseBase,
    create_response,
)
from app.schemas.role_schema import IRoleEnum
from app.utils.exceptions.common_exception import IdNotFoundException, NameExistException

router = APIRouter()


@router.get("")
async def get_permission_groups(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user()),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IGetResponsePaginated[IPermissionGroupRead]:
    """
    Gets a paginated list of permission groups
    """
    permission_groups = await crud.permission_group.get_multi_paginated(params=params, db_session=db_session)
    return create_response(data=permission_groups)


@router.get("/{group_id}", response_model=IGetResponseBase[IPermissionGroupWithPermissions])
async def get_permission_group_by_id(
    group_id: UUID,
    current_user: User = Depends(deps.get_current_user()),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IGetResponseBase[IPermissionGroupWithPermissions]:
    """
    Gets a permission group by its ID
    """
    try:
        permission_group = await crud.permission_group.get_group_by_id(
            group_id=group_id, db_session=db_session
        )
        if not permission_group:
            raise IdNotFoundException(PermissionGroup, id=group_id)

        # Convert SQLModel to dictionary to avoid lazy loading issues
        response_data = {
            "id": permission_group.id,
            "name": permission_group.name,
            "permission_group_id": permission_group.permission_group_id,
            "created_at": getattr(permission_group, "created_at", None),
            "updated_at": getattr(permission_group, "updated_at", None),
            "created_by_id": getattr(permission_group, "created_by_id", None),
            "permissions": [],
            "groups": [],
        }

        # Add creator information if available
        if hasattr(permission_group, "creator") and permission_group.creator:
            response_data["creator"] = {
                "id": permission_group.creator.id,
                "email": permission_group.creator.email,
                "first_name": getattr(permission_group.creator, "first_name", None),
                "last_name": getattr(permission_group.creator, "last_name", None),
            }

        # Add permissions if they exist
        if hasattr(permission_group, "permissions") and permission_group.permissions:
            response_data["permissions"] = [
                {
                    "id": permission.id,
                    "name": permission.name,
                    "description": getattr(permission, "description", None),
                    "group_id": permission.group_id,
                }
                for permission in permission_group.permissions
            ]

        # Add child groups if they exist
        if hasattr(permission_group, "groups") and permission_group.groups:
            response_data["groups"] = [
                {
                    "id": group.id,
                    "name": group.name,
                    "permission_group_id": group.permission_group_id,
                    "created_at": getattr(group, "created_at", None),
                    "updated_at": getattr(group, "updated_at", None),
                    "created_by_id": getattr(group, "created_by_id", None),
                }
                for group in permission_group.groups
            ]

        return create_response(data=response_data)
    except Exception as e:
        if isinstance(e, IdNotFoundException):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving permission group: {str(e)}",
        )


@router.post("")
async def create_permission_group(
    group: IPermissionGroupCreate,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IPostResponseBase[IPermissionGroupRead]:
    """
    Creates a new role group

    Required roles:
    - admin
    - manager
    """
    permission_group_current = await crud.permission_group.get_group_by_name(
        name=group.name, db_session=db_session
    )
    if permission_group_current:
        raise NameExistException(PermissionGroup, name=group.name)
    new_group = await crud.permission_group.create(
        obj_in=group, created_by_id=current_user.id, db_session=db_session
    )
    return create_response(data=new_group)


@router.put("/{group_id}")
async def update_permission_group(
    group: IPermissionGroupUpdate,
    current_group: PermissionGroup = Depends(permission_group_deps.get_permission_group_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IPutResponseBase[IPermissionGroupRead]:
    """
    Updates a group by its id

    Required roles:
    - admin
    - manager
    """
    group_updated = await crud.permission_group.update(
        obj_current=current_group, obj_new=group, db_session=db_session
    )
    return create_response(data=group_updated)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission_group(
    group: PermissionGroup = Depends(permission_group_deps.get_permission_group_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> None:
    """
    Deletes a permission group by its id

    Required roles:
    - admin
    - manager
    """
    # Check if the group has child groups
    if group.groups and len(group.groups) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Permission group '{group.name}' has child groups and cannot be deleted. "
                f"Please delete or reassign child groups first."
            ),
        )

    try:
        await crud.permission_group.remove(id=group.id, db_session=db_session)
    except Exception as e:
        # Catch potential DB errors or other issues during deletion
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting permission group: {e}",
        )
