from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi_cache.decorator import cache
from fastapi_pagination import Params
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.api.deps import get_redis_client
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
from app.utils.exceptions.common_exception import (
    CircularDependencyException,
    NameExistException,
    ResourceNotFoundException,
)

router = APIRouter()


@router.get("")
async def get_role_groups(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.read"])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IGetResponsePaginated[IRoleGroupRead]:
    """
    Gets a paginated list of role groups with hierarchical structure.
    Only root groups (those without parents) are returned at the top level,
    with children accessible through the children property.
    """

    try:
        # Get all role groups using standard pagination
        paginated_result = await crud.role_group.get_multi_paginated_hierarchical(
            params=params, db_session=db_session
        )

        return create_response(data=paginated_result)
    except Exception as e:
        import logging

        logging.error(f"Error in get_role_groups: {str(e)}")

        # Return a helpful error message
        error_message = str(e)
        if "greenlet_spawn" in error_message:
            error_message = "Database async context error. Please check the server logs for details."

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message,
        )


@router.get("/{group_id}")
@cache(expire=300)  # Cache for 5 minutes
async def get_role_group_by_id(
    group_id: UUID,
    include_nested_roles: bool = False,
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.read"])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IGetResponseBase[IRoleGroupWithRoles]:
    """
    Gets a role group by its id with full hierarchical information.

    Parameters:
        group_id: The UUID of the group to retrieve
        include_nested_roles: Whether to include roles for nested groups
        current_user: The current authenticated user
        db_session: The database session

    Returns:
        The role group with all its relationships properly loaded
    """
    try:
        role_group = await role_group_deps.get_group_by_id(
            group_id=group_id, db_session=db_session, include_roles_recursive=include_nested_roles
        )

        # The model will now have the parent relationship properly loaded
        # Convert the SQLModel object to a response format
        response_data = {
            "id": role_group.id,
            "name": role_group.name,
            "parent_id": role_group.parent_id,
            "created_at": role_group.created_at,
            "updated_at": role_group.updated_at,
            "created_by_id": role_group.created_by_id,
            "children": [],
            "roles": [],
        }

        # Add creator information if available
        if hasattr(role_group, "creator") and role_group.creator:
            response_data["creator"] = {
                "id": role_group.creator.id,
                "email": role_group.creator.email,
                "first_name": getattr(role_group.creator, "first_name", None),
                "last_name": getattr(role_group.creator, "last_name", None),
            }

        # Add roles if they exist
        if hasattr(role_group, "roles") and role_group.roles:
            response_data["roles"] = [
                {
                    "id": role.id,
                    "name": role.name,
                    "description": getattr(role, "description", None),
                    "is_default": getattr(role, "is_default", False),
                }
                for role in role_group.roles
            ]

        # Add children if they exist
        if hasattr(role_group, "children") and role_group.children:
            for child in role_group.children:
                child_data = {
                    "id": child.id,
                    "name": child.name,
                    "parent_id": child.parent_id,
                    "created_at": child.created_at,
                    "updated_at": child.updated_at,
                    "created_by_id": child.created_by_id,
                    "children": [],
                    "roles": [],
                }

                # Add creator information for child if available
                if hasattr(child, "creator") and child.creator:
                    child_data["creator"] = {
                        "id": child.creator.id,
                        "email": child.creator.email,
                        "first_name": getattr(child.creator, "first_name", None),
                        "last_name": getattr(child.creator, "last_name", None),
                    }

                # Add roles for child if include_nested_roles is True
                if include_nested_roles and hasattr(child, "roles") and child.roles:
                    child_data["roles"] = [
                        {
                            "id": role.id,
                            "name": role.name,
                            "description": getattr(role, "description", None),
                            "is_default": getattr(role, "is_default", False),
                        }
                        for role in child.roles
                    ]

                response_data["children"].append(child_data)

        # Add parent information if it exists
        if hasattr(role_group, "parent") and role_group.parent:
            parent = role_group.parent
            response_data["parent"] = {
                "id": parent.id,
                "name": parent.name,
                "parent_id": parent.parent_id,
                "created_at": parent.created_at,
                "updated_at": parent.updated_at,
                "created_by_id": parent.created_by_id,
            }

            # Add creator information for parent if available
            if hasattr(parent, "creator") and parent.creator:
                response_data["parent"]["creator"] = {
                    "id": parent.creator.id,
                    "email": parent.creator.email,
                    "first_name": getattr(parent.creator, "first_name", None),
                    "last_name": getattr(parent.creator, "last_name", None),
                }

            # Add parent roles if include_nested_roles is True
            if include_nested_roles and hasattr(parent, "roles") and parent.roles:
                response_data["parent"]["roles"] = [
                    {
                        "id": role.id,
                        "name": role.name,
                        "description": getattr(role, "description", None),
                        "is_default": getattr(role, "is_default", False),
                    }
                    for role in parent.roles
                ]

        return create_response(data=response_data)

    except Exception as e:
        import logging

        logging.error(f"Error in get_role_group_by_id: {str(e)}")

        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("")
async def create_role_group(
    group: IRoleGroupCreate,
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.create"])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IPostResponseBase[IRoleGroupRead]:
    """
    Creates a new role group

    Required roles:
    - admin
    - manager
    """
    role_group_current = await crud.role_group.get_group_by_name(name=group.name, db_session=db_session)
    if role_group_current:
        raise NameExistException(RoleGroup, name=group.name)
    new_group = await crud.role_group.create(
        obj_in=group, created_by_id=current_user.id, db_session=db_session
    )
    return create_response(data=new_group)


@router.put("/{group_id}")
async def update_role_group(
    group: IRoleGroupUpdate,
    current_group: RoleGroup = Depends(role_group_deps.get_group_by_id),
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.update"])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> IPutResponseBase[IRoleGroupRead]:
    """
    Updates a group by its id

    Required roles:
    - admin
    - manager
    """
    group_updated = await crud.role_group.update(
        obj_current=current_group, obj_new=group, db_session=db_session
    )
    return create_response(data=group_updated)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_group(
    group: RoleGroup = Depends(role_group_deps.get_group_by_id),
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.delete"])),
    db_session: AsyncSession = Depends(deps.get_async_db),
) -> None:
    """
    Deletes a role group by its id

    Required roles:
    - admin
    - manager
    """
    # Check if the group has child groups
    if group.children and len(group.children) > 0:
        message = (
            f"Role group '{group.name}' has child groups and cannot be deleted. "
            "Please delete or reassign child groups first."
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        )

    # Check if group has any roles before deletion
    has_roles = await crud.role_group.check_role_exists_in_group(group_id=group.id, db_session=db_session)
    if has_roles:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Group '{group.name}' has assigned roles and cannot be deleted. "
                "Please remove all roles first."
            ),
        )

    try:
        await crud.role_group.remove(id=group.id, db_session=db_session)
    except Exception as e:
        # Catch potential DB errors or other issues during deletion
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting role group: {str(e)}",
        )

    # No content is returned on successful deletion (204)


@router.post("/bulk")
async def bulk_create_role_groups(
    groups: List[IRoleGroupCreate],
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.create"])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase[List[IRoleGroupRead]]:
    """
    Create multiple role groups in bulk

    Required roles:
    - admin
    - manager
    """
    try:
        new_groups = await crud.role_group.bulk_create(groups=groups, current_user=current_user)

        # Invalidate role groups list cache
        background_tasks.add_task(redis_client.delete, "role_groups:list")

        return create_response(data=new_groups, message=f"Successfully created {len(new_groups)} role groups")
    except NameExistException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating role groups: {str(e)}",
        )


@router.delete("/bulk")
async def bulk_delete_role_groups(
    group_ids: List[UUID],
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.delete"])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase:
    """
    Delete multiple role groups in bulk

    Required roles:
    - admin
    - manager
    """
    try:
        await crud.role_group.bulk_delete(group_ids=group_ids, current_user=current_user)

        # Invalidate role groups list cache and individual group caches
        background_tasks.add_task(redis_client.delete, "role_groups:list")
        for group_id in group_ids:
            background_tasks.add_task(redis_client.delete, f"role_group:{group_id}")

        return create_response(message=f"Successfully deleted {len(group_ids)} role groups")
    except ResourceNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting role groups: {str(e)}",
        )


# Update the existing add_roles_to_group endpoint to check for circular dependencies
@router.post("/{group_id}/roles")
async def add_roles_to_group(
    group_id: UUID,
    role_ids: dict,
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.update"])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase[IRoleGroupWithRoles]:
    """
    Adds roles to a role group with circular dependency check

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

        # Check for circular dependencies
        has_circular = await crud.role_group.validate_circular_dependency(
            group_id=group_id, role_ids=uuid_role_ids
        )

        if has_circular:
            raise CircularDependencyException("Adding these roles would create a circular dependency")

        # Add roles to the group with converted UUIDs
        await crud.role_group.add_roles_to_group(group_id=group_id, role_ids=uuid_role_ids)

        # Comprehensive cache invalidation
        # Invalidate cache for this role group
        await redis_client.delete(f"role_group:{group_id}")

        # Invalidate role groups list cache
        await redis_client.delete("role_groups:list")

        # Invalidate roles list cache
        await redis_client.delete("roles:list")

        # Invalidate individual role caches
        for role_id in uuid_role_ids:
            await redis_client.delete(f"role:{role_id}")

            # Invalidate user permissions caches for each role
            background_tasks.add_task(
                crud.role.invalidate_user_permission_caches, role_id=role_id, redis_client=redis_client
            )

        # Get updated group
        updated_group = await role_group_deps.get_group_by_id(group_id=group_id)
        return create_response(data=updated_group)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid UUID format in role_ids: {str(e)}"
        )
    except CircularDependencyException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding roles to group: {str(e)}",
        )


@router.delete("/{group_id}/roles")
async def remove_roles_from_group(
    group_id: UUID,
    role_ids: dict,
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.update"])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
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

        # Comprehensive cache invalidation
        # Invalidate cache for this role group
        await redis_client.delete(f"role_group:{group_id}")

        # Invalidate role groups list cache
        await redis_client.delete("role_groups:list")

        # Invalidate roles list cache
        await redis_client.delete("roles:list")

        # Invalidate individual role caches
        for role_id in uuid_role_ids:
            await redis_client.delete(f"role:{role_id}")

            # Invalidate user permissions caches for each role
            background_tasks.add_task(
                crud.role.invalidate_user_permission_caches, role_id=role_id, redis_client=redis_client
            )

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


@router.post("/{group_id}/clone")
async def clone_role_group(
    group_id: UUID,
    new_name: str,
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.create"])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase[IRoleGroupWithRoles]:
    """
    Clone a role group with all its role assignments

    Required roles:
    - admin
    - manager
    """
    # Get source group
    source_group = await role_group_deps.get_group_by_id(group_id=group_id)

    # Check if new name already exists
    existing = await crud.role_group.get_group_by_name(name=new_name)
    if existing:
        raise NameExistException(RoleGroup, name=new_name)

    try:
        # Create new group
        new_group = await crud.role_group.create(
            obj_in=IRoleGroupCreate(name=new_name), created_by_id=current_user.id
        )

        # Get all roles from source group and assign to new group
        role_ids = []
        if source_group.roles:
            role_ids = [role.id for role in source_group.roles]
            await crud.role_group.add_roles_to_group(group_id=new_group.id, role_ids=role_ids)

        # Comprehensive cache invalidation
        # Invalidate role groups list cache
        await redis_client.delete("role_groups:list")

        # Invalidate source and new group caches
        await redis_client.delete(f"role_group:{group_id}")
        await redis_client.delete(f"role_group:{new_group.id}")

        # Invalidate roles list cache since role-group relationships changed
        await redis_client.delete("roles:list")

        # Invalidate individual role caches for all roles in the cloned group
        for role_id in role_ids:
            await redis_client.delete(f"role:{role_id}")

            # Invalidate user permissions caches for each role
            background_tasks.add_task(
                crud.role.invalidate_user_permission_caches, role_id=role_id, redis_client=redis_client
            )

        # Get updated group with roles
        updated_group = await role_group_deps.get_group_by_id(group_id=new_group.id)
        return create_response(
            data=updated_group,
            message=f"Successfully cloned role group '{source_group.name}' to '{new_name}'",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cloning role group: {str(e)}",
        )


@router.post("/sync-roles")
async def sync_role_group_mappings(
    current_user: User = Depends(deps.get_current_user(required_permissions=["role_group.update"])),
    redis_client: Redis = Depends(get_redis_client),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> IPostResponseBase:
    """
    Synchronize roles with role groups based on the role_group_id field.
    This endpoint populates the RoleGroupMap table for any existing relationships
    where a role has a role_group_id but no corresponding entry in the RoleGroupMap table.

    Required roles:
    - admin
    """

    try:
        result = await crud.role_group.sync_roles_with_role_groups(current_user=current_user)

        # Invalidate role groups cache
        background_tasks.add_task(redis_client.delete, "role_groups:list")

        return create_response(
            message=(
                f"Successfully synchronized role-group mappings. "
                f"Created: {result['created']}, Skipped: {result['skipped']}"
            ),
            data=result,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error synchronizing role-group mappings: {str(e)}",
        )
