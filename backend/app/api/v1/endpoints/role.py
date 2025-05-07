from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi_pagination import Params
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.api.deps import get_redis_client
from app.deps import role_deps
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.response_schema import (
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    IPutResponseBase,
    create_response,
)
from app.schemas.role_schema import (
    IRoleCreate,
    IRoleEnum,
    IRolePermissionAssign,
    IRolePermissionUnassign,
    IRoleRead,
    IRoleUpdate,
)
from app.utils.exceptions.common_exception import (
    ContentNoChangeException,
    NameExistException,
    ResourceNotFoundException,
)
from app.utils.role_utils import serialize_role

router = APIRouter()


@router.get("")
async def get_roles(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user()),
) -> IGetResponsePaginated[IRoleRead]:
    """
    Gets a paginated list of roles
    """
    paginated_roles = await crud.role.get_multi_paginated(params=params)

    response_data = {
        "items": [serialize_role(role) for role in paginated_roles.items],
        "total": paginated_roles.total,
        "page": paginated_roles.page,
        "size": paginated_roles.size,
        "pages": paginated_roles.pages,
    }

    return create_response(data=response_data)


@router.get("/list", response_model=IGetResponseBase[List[IRoleRead]])
async def get_all_roles_list(
    current_user: User = Depends(deps.get_current_user()),  # Ensure user is authenticated
    db_session: AsyncSession = Depends(deps.get_db),  # Get DB session
) -> IGetResponseBase[List[IRoleRead]]:
    """
    Gets a list of all roles (no pagination).
    """
    roles = await crud.role.get_all(db_session=db_session)
    return create_response(data=[serialize_role(role) for role in roles])


@router.get("/{role_id}")
async def get_role_by_id(
    role: Role = Depends(role_deps.get_user_role_by_id),
    current_user: User = Depends(deps.get_current_user()),
) -> IGetResponseBase[IRoleRead]:
    """
    Gets a role by its id
    """
    return create_response(data=serialize_role(role))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_role(
    role: IRoleCreate,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
) -> IPostResponseBase[IRoleRead]:
    """
    Create a new role

    Required roles:
    - admin
    """
    role_current = await crud.role.get_role_by_name(name=role.name)
    if role_current:
        raise NameExistException(Role, name=role_current.name)

    new_role = await crud.role.create(obj_in=role, created_by_id=current_user.id)
    return create_response(data=new_role)


@router.put("/{role_id}")
async def update_role(
    role: IRoleUpdate,
    current_role: Role = Depends(role_deps.get_user_role_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
) -> IPutResponseBase[IRoleRead]:
    """
    Updates a role by its id

    Required roles:
    - admin
    """
    if current_role.name == role.name and current_role.description == role.description:
        raise ContentNoChangeException()

    # Only check for name conflicts if the name is being changed
    if role.name != current_role.name:
        exist_role = await crud.role.get_role_by_name(name=role.name)
        if exist_role:
            raise NameExistException(Role, name=role.name)

    updated_role = await crud.role.update(obj_current=current_role, obj_new=role)
    return create_response(data=updated_role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role: Role = Depends(role_deps.get_user_role_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
) -> None:
    """
    Deletes a role by its id

    Required roles:
    - admin
    """
    # Check if the role has permissions assigned
    if role.permissions and len(role.permissions) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Role '{role.name}' has associated permissions and cannot be deleted. "
                f"Please remove permissions first."
            ),
        )

    # Check if the role is assigned to any users
    user_exists = await crud.role.user_exist_in_role(role_id=role.id)
    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Role '{role.name}' is assigned to one or more users and cannot be deleted. "
                f"Please unassign the role from users first."
            ),
        )

    # Optional: Add checks here if a role cannot be deleted under certain conditions
    # (e.g., if it's assigned to users)
    # Example check (if users are linked):
    # user_exists = await crud.role.user_exist_in_role(role_id=role.id)
    # if user_exists:
    #     raise HTTPException(
    #         status_code=status.HTTP_409_CONFLICT,
    #         detail="Cannot delete role assigned to users.",
    #     )

    try:
        await crud.role.remove(id=role.id)
    except Exception as e:
        # Catch potential DB errors or other issues during deletion
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting role: {e}",
        )

    # No content is returned on successful deletion (204)


@router.post("/{role_id}/permissions")
async def assign_permissions_to_role(
    role_id: UUID,
    permissions: IRolePermissionAssign,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase[IRoleRead]:
    """
    Assign permissions to a role

    Required roles:
    - admin
    """
    # Check if it's a system role
    is_system_role = await crud.role.validate_system_role(role_id=role_id)
    if is_system_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system role permissions",
        )

    try:
        role = await crud.role.assign_permissions(
            role_id=role_id,
            permission_ids=permissions.permission_ids,
            current_user=current_user,
        )

        # Comprehensive cache invalidation
        # Clear specific role cache
        await redis_client.delete(f"role:{role_id}")

        # Clear roles list cache
        await redis_client.delete("roles:list")

        # If the role is part of a role group, clear that cache too
        if role.role_group_id:
            await redis_client.delete(f"role_group:{role.role_group_id}")
            # Also clear the role groups list cache
            await redis_client.delete("role_groups:list")

        # Clear user permissions caches that might include this role
        # This is done in background to not block the response
        background_tasks.add_task(
            crud.role.invalidate_user_permission_caches, role_id=role_id, redis_client=redis_client
        )

        return create_response(data=serialize_role(role), message="Permissions assigned successfully")
    except ResourceNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error assigning permissions: {str(e)}",
        )


@router.delete("/{role_id}/permissions")
async def remove_permissions_from_role(
    role_id: UUID,
    permissions: IRolePermissionUnassign,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase[IRoleRead]:
    """
    Remove permissions from a role

    Required roles:
    - admin
    """
    # Check if it's a system role
    is_system_role = await crud.role.validate_system_role(role_id=role_id)
    if is_system_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system role permissions",
        )

    try:
        role = await crud.role.remove_permissions(
            role_id=role_id,
            permission_ids=permissions.permission_ids,
            current_user=current_user,
        )

        # Comprehensive cache invalidation
        # Clear specific role cache
        await redis_client.delete(f"role:{role_id}")

        # Clear roles list cache
        await redis_client.delete("roles:list")

        # If the role is part of a role group, clear that cache too
        if role.role_group_id:
            await redis_client.delete(f"role_group:{role.role_group_id}")
            # Also clear the role groups list cache
            await redis_client.delete("role_groups:list")

        # Clear user permissions caches that might include this role
        # This is done in background to not block the response
        background_tasks.add_task(
            crud.role.invalidate_user_permission_caches, role_id=role_id, redis_client=redis_client
        )

        return create_response(data=serialize_role(role), message="Permissions removed successfully")
    except ResourceNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing permissions: {str(e)}",
        )
