from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_pagination import Params

from app import crud
from app.api import deps
from app.deps import user_deps
from app.models import User
from app.schemas.response_schema import (
    IDeleteResponseBase,
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    create_response,
)
from app.schemas.user_schema import IUserCreate, IUserRead, IUserUpdate
from app.utils.exceptions.user_exceptions import UserSelfDeleteException
from app.utils.user_utils import serialize_user

router = APIRouter()


@router.get("/list")
async def read_users_list(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.read"])),
) -> IGetResponsePaginated[Any]:
    """
    Retrieve users. Requires admin or manager role

    Required roles:
    - admin
    - manager
    """
    users = await crud.user.get_multi_paginated(params=params)

    # Convert to a response format that includes roles
    response_data = {
        "items": [serialize_user(user) for user in users.items],
        "total": users.total,
        "page": users.page,
        "size": users.size,
        "pages": users.pages,
    }
    return create_response(data=response_data)


@router.get("/order_by_created_at")
async def get_user_list_order_by_created_at(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.read"])),
) -> IGetResponsePaginated[Any]:
    """
    Gets a paginated list of users ordered by created datetime

    Required roles:
    - admin
    - manager
    """
    users = await crud.user.get_multi_paginated_ordered(params=params, order_by="created_at")

    # Convert to a response format that includes roles
    response_data = {
        "items": [serialize_user(user) for user in users.items],
        "total": users.total,
        "page": users.page,
        "size": users.size,
        "pages": users.pages,
    }
    return create_response(data=response_data)


@router.get("/{user_id}")
async def get_user_by_id(
    user: User = Depends(user_deps.is_valid_user),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.read"])),
) -> IGetResponseBase[IUserRead]:
    """
    Gets a user by his/her id

    Required roles:
    - admin
    - manager
    """
    return create_response(data=serialize_user(user))


@router.get("")
async def get_my_data(
    current_user: User = Depends(deps.get_current_user()),
) -> IGetResponseBase[IUserRead]:
    """
    Gets my user profile information
    """
    return create_response(data=serialize_user(current_user))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    new_user: IUserCreate = Depends(user_deps.user_exists),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.create"])),
) -> IPostResponseBase[IUserRead]:
    """
    Creates a new user

    Required roles:
    - admin
    """
    user = await crud.user.create_with_role(obj_in=new_user)
    return create_response(data=serialize_user(user))


@router.put("/{user_id}")
async def update_user(
    user_update: IUserUpdate,
    user: User = Depends(user_deps.is_valid_user),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.update"])),
) -> IPostResponseBase[IUserRead]:
    """
    Updates a user by id

    Required roles:
    - admin
    """
    # If password is being updated, use password history management
    if user_update.password:
        try:
            await crud.user.update_password(user=user, new_password=user_update.password)
            # Remove password from update data since it's already been handled
            user_update.password = None
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Update other fields if any
    if any(getattr(user_update, field) is not None for field in user_update.__fields__):
        updated_user = await crud.user.update(obj_current=user, obj_new=user_update)
        return create_response(data=serialize_user(updated_user), message="User updated successfully")

    return create_response(data=serialize_user(user), message="No changes to update")


@router.delete("/{user_id}")
async def remove_user(
    user_id: UUID = Depends(user_deps.is_valid_user_id),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.delete"])),
) -> IDeleteResponseBase[IUserRead]:
    """
    Deletes a user by his/her id

    Required roles:
    - admin
    """
    if current_user.id == user_id:
        raise UserSelfDeleteException()

    # Get the user to check their roles
    user = await crud.user.get(id=user_id)
    if user and user.roles and len(user.roles) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"User has {len(user.roles)} role(s) assigned and cannot be deleted. "
                "Please remove all roles first."
            ),
        )

    deleted_user = await crud.user.remove(id=user_id)
    return create_response(data=serialize_user(deleted_user), message="User removed")
