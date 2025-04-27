from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_pagination import Params

from app import crud
from app.api import deps
from app.deps import role_group_deps
from app.models.role_group_model import RoleGroup
from app.models.user_model import User
from app.schemas.response_schema import (
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    IPutResponseBase,
    create_response,
)
from app.schemas.role_group_schema import (
    IRoleGroupCreate,
    IRoleGroupRead,
    IRoleGroupUpdate,
    IRoleGroupWithRoles,
)
from app.schemas.role_schema import IRoleEnum
from app.utils.exceptions.common_exception import IdNotFoundException, NameExistException

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
    if role_group:
        return create_response(data=role_group)
    else:
        raise IdNotFoundException(RoleGroup, id=group_id)


@router.post("")
async def create_role_group(
    group: IRoleGroupCreate,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
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
    new_group = await crud.role_group.create(obj_in=group, created_by_id=current_user.id)
    return create_response(data=new_group)


@router.put("/{group_id}")
async def update_role_group(
    group: IRoleGroupUpdate,
    current_group: RoleGroup = Depends(role_group_deps.get_group_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IPutResponseBase[IRoleGroupRead]:
    """
    Updates a group by its id

    Required roles:
    - admin
    - manager
    """
    group_updated = await crud.role_group.update(obj_current=current_group, obj_new=group)
    return create_response(data=group_updated)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_group(
    group: RoleGroup = Depends(role_group_deps.get_group_by_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
):
    """
    Deletes a role group by its id

    Required roles:
    - admin
    - manager
    """
    # Optional: Add checks here if a role group cannot be deleted under certain conditions
    # For example, if it's used by certain system components

    try:
        await crud.role_group.remove(id=group.id)
    except Exception as e:
        # Catch potential DB errors or other issues during deletion
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting role group: {e}",
        )

    # No content is returned on successful deletion (204)


@router.post("/{group_id}/roles")
async def add_roles_to_group(
    group_id: UUID,
    role_ids: dict,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IPostResponseBase[IRoleGroupWithRoles]:
    """
    Adds roles to a role group

    Required roles:
    - admin
    - manager
    """
    # Check if the group exists
    await role_group_deps.get_group_by_id(group_id=group_id)

    try:
        # Handle both list of strings and list of UUIDs
        role_ids_list = role_ids.get("role_ids", [])
        uuid_role_ids = []

        for role_id in role_ids_list:
            if isinstance(role_id, str):
                uuid_role_ids.append(UUID(role_id))
            elif isinstance(role_id, UUID):
                uuid_role_ids.append(role_id)
            else:
                raise ValueError(f"Invalid role_id format: {role_id}")

        # Add roles to the group with converted UUIDs
        await crud.role_group.add_roles_to_group(group_id=group_id, role_ids=uuid_role_ids)

        # Get updated group
        updated_group = await role_group_deps.get_group_by_id(group_id=group_id)
        return create_response(data=updated_group)
    except ValueError as e:
        # Handle invalid UUID format
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid UUID format in role_ids: {str(e)}"
        )
    except Exception as e:
        # Handle other exceptions
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error adding roles to group: {str(e)}"
        )


@router.delete("/{group_id}/roles")
async def remove_roles_from_group(
    group_id: UUID,
    role_ids: dict,
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IPostResponseBase[IRoleGroupWithRoles]:
    """
    Removes roles from a role group

    Required roles:
    - admin
    - manager
    """
    # Check if the group exists
    await role_group_deps.get_group_by_id(group_id=group_id)

    try:
        # Handle both list of strings and list of UUIDs
        role_ids_list = role_ids.get("role_ids", [])
        uuid_role_ids = []

        for role_id in role_ids_list:
            if isinstance(role_id, str):
                uuid_role_ids.append(UUID(role_id))
            elif isinstance(role_id, UUID):
                uuid_role_ids.append(role_id)
            else:
                raise ValueError(f"Invalid role_id format: {role_id}")

        # Call the CRUD method with converted UUIDs
        await crud.role_group.remove_roles_from_group(group_id=group_id, role_ids=uuid_role_ids)

        # Get updated group
        updated_group = await role_group_deps.get_group_by_id(group_id=group_id)
        return create_response(data=updated_group)
    except ValueError as e:
        # Handle invalid UUID format
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid UUID format in role_ids: {str(e)}"
        )
    except Exception as e:
        # Handle other exceptions
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error removing roles from group: {str(e)}",
        )
