import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi_pagination import Params
from redis.asyncio import Redis as AsyncRedis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api import deps
from app.api.deps import get_redis_client
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
from app.utils import password_policy
from app.utils.account_email_dispatch import issue_verification
from app.utils.exceptions.user_exceptions import UserSelfDeleteException
from app.utils.password_policy import InitialPasswordReason, PasswordChangeReason
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

    # paginate() builds the page class from this route's return annotation, so
    # it returns an IGetResponsePaginated, not a Page: the rows live at
    # .data.items, never .items. The declared Page[ModelType] on
    # get_multi_paginated describes the CRUD layer, not what arrives here.
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

    # paginate() builds the page class from this route's return annotation, so
    # it returns an IGetResponsePaginated, not a Page: the rows live at
    # .data.items, never .items. The declared Page[ModelType] on
    # get_multi_paginated describes the CRUD layer, not what arrives here.
    # Convert to a response format that includes roles
    response_data = {
        "items": [serialize_user(user) for user in users.data.items],
        "total": users.data.total,
        "page": users.data.page,
        "size": users.data.size,
        "pages": users.data.pages,
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
    redis_client: AsyncRedis = Depends(get_redis_client),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.create"])),
) -> IPostResponseBase[IUserRead]:
    """
    Creates a new user

    Required roles:
    - admin

    Note: Admin-created users behavior depends on configuration:
    - ADMIN_CREATED_USERS_AUTO_VERIFIED: Auto-verify admin-created users
    - ADMIN_CREATED_USERS_SEND_EMAIL: Send verification email to admin-created users

    Admin-set passwords are subject to the same complexity policy as
    self-service (#198). A weaker rule here would leave the new user unable
    to change the password they were given.
    """
    await password_policy.accept_initial_password(
        new_user.password,
        reason=InitialPasswordReason.ADMIN_CREATE,
        email=new_user.email,
        actor=current_user,
        db_session=db_session,
    )

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
            # issue_verification, not a hand-rolled token plus mail: /verify-email
            # checks Redis, so a link mailed without the Redis write can never
            # succeed. Registration and resend come through here too.
            await issue_verification(
                user=user,
                redis_client=redis_client,
                background_tasks=background_tasks,
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

    A ``password`` key is refused (#198). Applying one password to many users
    skips the per-account history/reuse path even when the value is strong;
    set a password on each user individually instead.
    """
    user_ids = bulk_update.get("user_ids")
    updates = bulk_update.get("updates")
    if not user_ids or not isinstance(user_ids, list) or not updates:
        raise HTTPException(status_code=400, detail="user_ids and updates are required")
    if isinstance(updates, dict) and "password" in updates:
        raise HTTPException(
            status_code=400,
            detail="Password cannot be changed via bulk update. Update each user individually.",
        )
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
    redis_client: AsyncRedis = Depends(get_redis_client),
    current_user: User = Depends(deps.get_current_user(required_permissions=["users.update"])),
) -> IPostResponseBase[IUserRead]:
    """
    Updates a user by id

    Required roles:
    - admin

    A new password goes through ``password_policy.change_password`` like every
    other path that sets one (#271): the same rules and reuse policy as
    self-service (#198), and the *target* user's sessions end before the
    response is written (#240, #206). The acting administrator's session is
    not touched. The password is a temporary one, so the user is flagged to
    change it.
    """
    update_data = user_update.model_dump(exclude_unset=True)
    # Popped whether or not it is blank: crud.user.update refuses a password
    # key outright, and blank / omitted means leave the password as-is.
    new_password = update_data.pop("password", None)
    if new_password:
        await password_policy.change_password(
            user,
            new_password,
            reason=PasswordChangeReason.ADMIN,
            actor=current_user,
            client_address=None,
            db_session=db_session,
            redis_client=redis_client,
        )

    # Update other fields if any
    if any(value is not None for value in update_data.values()):
        updated_user = await crud.user.update(obj_current=user, obj_new=update_data, db_session=db_session)
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
