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
from app.schemas.role_schema import IRoleEnum
from app.schemas.user_schema import IUserCreate, IUserRead, IUserUpdate
from app.utils.exceptions.user_exceptions import UserSelfDeleteException

router = APIRouter()


@router.get("/list")
async def read_users_list(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
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
        "items": [
            {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_active": user.is_active,
                "is_superuser": user.is_superuser,
                "needs_to_change_password": user.needs_to_change_password,
                "expiry_date": user.expiry_date,
                "contact_phone": user.contact_phone,
                "last_changed_password_date": user.last_changed_password_date,
                "number_of_failed_attempts": user.number_of_failed_attempts,
                "is_locked": user.is_locked,
                "locked_until": user.locked_until,
                "verified": user.verified,
                "roles": (
                    [
                        {"id": str(role.id), "name": role.name, "description": role.description}
                        for role in user.roles
                    ]
                    if user.roles
                    else []
                ),
                "created_at": user.created_at,
                "updated_at": user.updated_at,
            }
            for user in users.items
        ],
        "total": users.total,
        "page": users.page,
        "size": users.size,
        "pages": users.pages,
    }
    return create_response(data=response_data)


@router.get("/order_by_created_at")
async def get_user_list_order_by_created_at(
    params: Params = Depends(),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
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
        "items": [
            {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_active": user.is_active,
                "is_superuser": user.is_superuser,
                "needs_to_change_password": user.needs_to_change_password,
                "expiry_date": user.expiry_date,
                "contact_phone": user.contact_phone,
                "last_changed_password_date": user.last_changed_password_date,
                "number_of_failed_attempts": user.number_of_failed_attempts,
                "is_locked": user.is_locked,
                "locked_until": user.locked_until,
                "verified": user.verified,
                "roles": (
                    [
                        {"id": str(role.id), "name": role.name, "description": role.description}
                        for role in user.roles
                    ]
                    if user.roles
                    else []
                ),
                "created_at": user.created_at,
                "updated_at": user.updated_at,
            }
            for user in users.items
        ],
        "total": users.total,
        "page": users.page,
        "size": users.size,
        "pages": users.pages,
    }
    return create_response(data=response_data)


@router.get("/{user_id}")
async def get_user_by_id(
    user: User = Depends(user_deps.is_valid_user),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin, IRoleEnum.manager])),
) -> IGetResponseBase[IUserRead]:
    """
    Gets a user by his/her id

    Required roles:
    - admin
    - manager
    """
    user_data = {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "needs_to_change_password": user.needs_to_change_password,
        "expiry_date": user.expiry_date,
        "contact_phone": user.contact_phone,
        "last_changed_password_date": user.last_changed_password_date,
        "number_of_failed_attempts": user.number_of_failed_attempts,
        "is_locked": user.is_locked,
        "locked_until": user.locked_until,
        "verified": user.verified,
        "roles": (
            [{"id": str(role.id), "name": role.name, "description": role.description} for role in user.roles]
            if user.roles
            else []
        ),
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
    return create_response(data=user_data)


@router.get("")
async def get_my_data(
    current_user: User = Depends(deps.get_current_user()),
) -> IGetResponseBase[IUserRead]:
    """
    Gets my user profile information
    """
    user_data = {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "needs_to_change_password": current_user.needs_to_change_password,
        "expiry_date": current_user.expiry_date,
        "contact_phone": current_user.contact_phone,
        "last_changed_password_date": current_user.last_changed_password_date,
        "number_of_failed_attempts": current_user.number_of_failed_attempts,
        "is_locked": current_user.is_locked,
        "locked_until": current_user.locked_until,
        "verified": current_user.verified,
        "roles": (
            [
                {"id": str(role.id), "name": role.name, "description": role.description}
                for role in current_user.roles
            ]
            if current_user.roles
            else []
        ),
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    }
    return create_response(data=user_data)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    new_user: IUserCreate = Depends(user_deps.user_exists),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
) -> IPostResponseBase[IUserRead]:
    """
    Creates a new user

    Required roles:
    - admin
    """
    user = await crud.user.create_with_role(obj_in=new_user)
    return create_response(data=user)


@router.put("/{user_id}")
async def update_user(
    user_update: IUserUpdate,
    user: User = Depends(user_deps.is_valid_user),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
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
        user_data = {
            "id": updated_user.id,
            "email": updated_user.email,
            "first_name": updated_user.first_name,
            "last_name": updated_user.last_name,
            "is_active": updated_user.is_active,
            "is_superuser": updated_user.is_superuser,
            "needs_to_change_password": updated_user.needs_to_change_password,
            "expiry_date": updated_user.expiry_date,
            "contact_phone": updated_user.contact_phone,
            "last_changed_password_date": updated_user.last_changed_password_date,
            "number_of_failed_attempts": updated_user.number_of_failed_attempts,
            "is_locked": updated_user.is_locked,
            "locked_until": updated_user.locked_until,
            "verified": updated_user.verified,
            "roles": (
                [
                    {"id": str(role.id), "name": role.name, "description": role.description}
                    for role in updated_user.roles
                ]
                if updated_user.roles
                else []
            ),
            "created_at": updated_user.created_at,
            "updated_at": updated_user.updated_at,
        }
        return create_response(data=user_data, message="User updated successfully")
    else:
        user_data = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "needs_to_change_password": user.needs_to_change_password,
            "expiry_date": user.expiry_date,
            "contact_phone": user.contact_phone,
            "last_changed_password_date": user.last_changed_password_date,
            "number_of_failed_attempts": user.number_of_failed_attempts,
            "is_locked": user.is_locked,
            "locked_until": user.locked_until,
            "verified": user.verified,
            "roles": (
                [
                    {"id": str(role.id), "name": role.name, "description": role.description}
                    for role in user.roles
                ]
                if user.roles
                else []
            ),
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
        return create_response(data=user_data, message="User updated successfully")


@router.delete("/{user_id}")
async def remove_user(
    user_id: UUID = Depends(user_deps.is_valid_user_id),
    current_user: User = Depends(deps.get_current_user(required_roles=[IRoleEnum.admin])),
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

    # Format the response according to IUserRead schema
    user_data = {
        "id": deleted_user.id,
        "email": deleted_user.email,
        "first_name": deleted_user.first_name,
        "last_name": deleted_user.last_name,
        "is_active": deleted_user.is_active,
        "is_superuser": deleted_user.is_superuser,
        "needs_to_change_password": deleted_user.needs_to_change_password,
        "expiry_date": deleted_user.expiry_date,
        "contact_phone": deleted_user.contact_phone,
        "last_changed_password_date": deleted_user.last_changed_password_date,
        "number_of_failed_attempts": deleted_user.number_of_failed_attempts,
        "is_locked": deleted_user.is_locked,
        "locked_until": deleted_user.locked_until,
        "verified": deleted_user.verified,
        "roles": (
            [
                {"id": str(role.id), "name": role.name, "description": role.description}
                for role in deleted_user.roles
            ]
            if deleted_user.roles
            else []
        ),
        "created_at": deleted_user.created_at,
        "updated_at": deleted_user.updated_at,
    }

    return create_response(data=user_data, message="User removed")
