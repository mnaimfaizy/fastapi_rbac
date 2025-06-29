import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi_pagination import Params
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.core.config import settings
from app.deps import user_deps
from app.models import User
from app.schemas.response_schema import (
    IDeleteResponseBase,
    IGetResponseBase,
    IGetResponsePaginated,
    IPostResponseBase,
    create_response,
)
from app.schemas.user_schema import IUserCreate, IUserRead, IUserRoleAssign, IUserUpdate
from app.utils.background_tasks import send_verification_email
from app.utils.exceptions.user_exceptions import UserSelfDeleteException
from app.utils.user_utils import serialize_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/list")
async def read_users_list(
    params: Params = Depends(),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.read"])),
) -> IGetResponsePaginated[Any]:
    """
    Retrieve users. Requires admin or manager role

    Required roles:
    - admin
    - manager
    """
    users = await crud.user.get_multi_paginated(params=params, db_session=db_session)

    # Convert to a response format that includes roles
    response_data = {
        "items": [serialize_user(user) for user in users.data.items],
        "total": users.data.total,
        "page": users.data.page,
        "size": users.data.size,
        "pages": users.data.pages,
    }
    return create_response(data=response_data)


@router.get("/order_by_created_at")
async def get_user_list_order_by_created_at(
    params: Params = Depends(),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.read"])),
) -> IGetResponsePaginated[Any]:
    """
    Gets a paginated list of users ordered by created datetime

    Required roles:
    - admin
    - manager
    """
    users = await crud.user.get_multi_paginated_ordered(
        params=params, order_by="created_at", db_session=db_session
    )

    # Convert to a response format that includes roles
    response_data = {
        "items": [serialize_user(user) for user in users.items],
        "total": users.total,
        "page": users.page,
        "size": users.size,
        "pages": users.pages,
    }
    return create_response(data=response_data)


@router.get("/me")
async def get_my_data(
    current_user: User = Depends(deps.get_current_user()),
) -> IGetResponseBase[IUserRead]:
    """
    Gets my user profile information
    """
    return create_response(data=serialize_user(current_user))


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


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    background_tasks: BackgroundTasks,
    new_user: IUserCreate = Depends(user_deps.user_exists),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.create"])),
) -> IPostResponseBase[IUserRead]:
    """
    Creates a new user

    Required roles:
    - admin

    Note: Admin-created users behavior depends on configuration:
    - ADMIN_CREATED_USERS_AUTO_VERIFIED: Auto-verify admin-created users
    - ADMIN_CREATED_USERS_SEND_EMAIL: Send verification email to admin-created users
    """
    from app.core.security import create_verification_token

    # Configure user verification based on settings
    if settings.ADMIN_CREATED_USERS_AUTO_VERIFIED:
        new_user.verified = True
        new_user.needs_to_change_password = False
        message = "User created successfully and verified"
    else:
        new_user.verified = False
        new_user.needs_to_change_password = True
        message = "User created successfully"

    # Create the user
    user = await crud.user.create_with_role(obj_in=new_user, db_session=db_session)

    # Send verification email if configured and user is not auto-verified
    if settings.ADMIN_CREATED_USERS_SEND_EMAIL and not settings.ADMIN_CREATED_USERS_AUTO_VERIFIED:
        try:
            verification_token = create_verification_token(user.email)
            await send_verification_email(
                background_tasks=background_tasks,
                user_email=user.email,
                verification_token=verification_token,
                verification_url=settings.EMAIL_VERIFICATION_URL,
            )
            message += ". Verification email sent"
        except Exception as e:
            # Log the error but don't fail user creation
            logger.error(f"Failed to send verification email to {user.email}: {e}")
            message += ". Note: Verification email could not be sent"

    return create_response(data=serialize_user(user), message=message)


@router.put("/me")
async def update_my_profile(
    user_update: IUserUpdate,
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["self.update_profile"])),
) -> IPostResponseBase[IUserRead]:
    """
    Update my own user profile information
    """
    # Only allow updating allowed fields (not roles, is_superuser, etc.)
    update_data = user_update.model_dump(exclude_unset=True)
    # Remove forbidden fields if present
    forbidden_fields = ["id", "roles", "is_superuser", "is_active", "email", "password"]
    for field in forbidden_fields:
        update_data.pop(field, None)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    db_session.add(current_user)
    await db_session.commit()
    await db_session.refresh(current_user)
    return create_response(data=serialize_user(current_user), message="Profile updated successfully")


@router.put("/bulk-update", status_code=200)
async def bulk_update_users(
    bulk_update: dict = Body(...),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.update"])),
) -> JSONResponse:
    """
    Bulk update users. Accepts a dict with 'user_ids': List[UUID], 'updates': IUserUpdate fields.
    Required roles: admin
    """
    user_ids = bulk_update.get("user_ids")
    updates = bulk_update.get("updates")
    if not user_ids or not isinstance(user_ids, list) or not updates:
        raise HTTPException(status_code=400, detail="user_ids and updates are required")
    updated_users = []
    for user_id in user_ids:
        user = await crud.user.get(id=user_id, db_session=db_session)
        if not user:
            continue
        # Only allow fields that IUserUpdate allows
        update_obj = IUserUpdate(**updates)
        updated_user = await crud.user.update(obj_current=user, obj_new=update_obj, db_session=db_session)
        updated_users.append(serialize_user(updated_user))
    return create_response(data=updated_users, message="Bulk update successful")


@router.put("/{user_id}")
async def update_user(
    user_update: IUserUpdate,
    user: User = Depends(user_deps.is_valid_user),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.update"])),
) -> IPostResponseBase[IUserRead]:
    """
    Updates a user by id

    Required roles:
    - admin
    """  # If password is being updated, use password history management
    if user_update.password:
        try:
            await crud.user.update_password(
                user=user, new_password=user_update.password, db_session=db_session
            )
            # Create a new update object without the password field
            update_data = user_update.model_dump(exclude_unset=True)
            update_data.pop("password", None)  # Remove password from update data
            user_update_without_password = IUserUpdate(
                **{k: v for k, v in update_data.items() if k != "password"}
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        user_update_without_password = user_update

    # Update other fields if any
    update_fields = user_update_without_password.__fields__
    if any(getattr(user_update_without_password, field) is not None for field in update_fields):
        updated_user = await crud.user.update(
            obj_current=user, obj_new=user_update_without_password, db_session=db_session
        )
        return create_response(data=serialize_user(updated_user), message="User updated successfully")

    return create_response(data=serialize_user(user), message="No changes to update")


@router.delete("/{user_id}")
async def remove_user(
    user_id: UUID = Depends(user_deps.is_valid_user_id),
    db_session: AsyncSession = Depends(deps.get_db),
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
    user = await crud.user.get(id=user_id, db_session=db_session)
    if user and user.roles and len(user.roles) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"User has {len(user.roles)} role(s) assigned and cannot be deleted. "
                "Please remove all roles first."
            ),
        )

    deleted_user = await crud.user.remove(id=user_id, db_session=db_session)
    return create_response(data=serialize_user(deleted_user), message="User removed")


@router.post("/{user_id}/roles", status_code=200)
async def assign_roles_to_user(
    user_id: str,
    role_assign: IUserRoleAssign,
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.update"])),
) -> JSONResponse:
    """
    Assign one or more roles to a user.
    """
    # Fetch user
    user = await crud.user.get(id=user_id, db_session=db_session)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Validate roles
    roles = []
    for role_id in role_assign.role_ids:
        role = await crud.role.get(id=role_id, db_session=db_session)
        if not role:
            raise HTTPException(status_code=404, detail=f"Role {role_id} not found")
        roles.append(role)
    # Assign roles
    user.roles = roles
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user, attribute_names=["roles"])
    return JSONResponse(content={"message": "Roles assigned successfully"})


@router.get("")
@router.get("/")
async def read_users(
    email: Optional[str] = None,
    params: Optional[Params] = Depends(lambda: None),
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.read"])),
) -> IGetResponsePaginated[Any]:
    """
    Retrieve users, optionally filtered by email. Requires admin or manager role.
    """
    if email:
        users = await crud.user.get_multi_by_email(email=email, db_session=db_session)
        response_data = {
            "items": [serialize_user(user) for user in users],
            "total": len(users),
            "page": 1,
            "size": len(users),
            "pages": 1,
        }
        return create_response(data=response_data)
    else:
        if params is None:
            params = Params()  # Use default pagination if not provided
        users = await crud.user.get_multi_paginated(params=params, db_session=db_session)
        response_data = {
            "items": [serialize_user(user) for user in users.data.items],
            "total": users.data.total,
            "page": users.data.page,
            "size": users.data.size,
            "pages": users.data.pages,
        }
        return create_response(data=response_data)
