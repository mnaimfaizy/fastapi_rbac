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
from app.utils import password_policy, role_grants
from app.utils.account_disable import disable_user, end_sessions_and_emailed_links, record_user_deleted
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
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.read"])),
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
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.read"])),
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
    current_user: User = Depends(deps.get_current_user(allow_pending_password_change=True)),
) -> IGetResponseBase[IUserRead]:
    """
    Gets my user profile information
    """
    return create_response(data=serialize_user(current_user))


@router.get("/{user_id}")
async def get_user_by_id(
    user: User = Depends(user_deps.is_valid_user),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.read"])),
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
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.create"])),
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
    new_roles = await role_grants.load_roles(new_user.role_id or [], db_session=db_session)
    role_grants.ensure_can_set_roles(actor=current_user, target_id=None, current=[], new=new_roles)
    role_grants.ensure_can_set_superuser(actor=current_user, current=False, new=new_user.is_superuser)

    accepted_password = await password_policy.accept_initial_password(
        new_user.password,
        reason=InitialPasswordReason.ADMIN_CREATE,
        email=new_user.email,
        actor=current_user,
        db_session=db_session,
    )

    # The administrator chose this password, so it is temporary whatever the
    # verification setting says: verification and password ownership are
    # separate (#273, ADR 0014).
    new_user.needs_to_change_password = True

    # Configure user verification based on settings
    if settings.ADMIN_CREATED_USERS_AUTO_VERIFIED:
        new_user.verified = True
        message = "User created successfully and verified"
    else:
        new_user.verified = False
        message = "User created successfully"

    # Create the user
    user = await crud.user.create_with_role(
        obj_in=new_user, password=accepted_password, db_session=db_session
    )

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
    # Remove forbidden fields if present. The temporary-password flag is set
    # only by an administrator and cleared only by a password change (ADR 0014).
    forbidden_fields = [
        "id",
        "roles",
        "is_superuser",
        "is_active",
        "email",
        "password",
        "needs_to_change_password",
    ]
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
    redis_client: AsyncRedis = Depends(get_redis_client),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.update"])),
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
    try:
        parsed_ids = [UUID(str(user_id)) for user_id in user_ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="user_ids must be UUIDs")
    # Only allow fields that IUserUpdate allows
    update_obj = IUserUpdate(**updates)
    targets = []
    for user_id in parsed_ids:
        try:
            targets.append(await role_grants.load_user(user_id, db_session=db_session))
        except HTTPException as missing:
            if missing.status_code != status.HTTP_404_NOT_FOUND:
                raise
    # Check every target before writing any, so a refusal changes nobody.
    for user in targets:
        role_grants.ensure_can_manage_user(actor=current_user, target=user)
    if "is_superuser" in update_obj.model_fields_set:
        for user in targets:
            role_grants.ensure_can_set_superuser(
                actor=current_user, current=user.is_superuser, new=update_obj.is_superuser
            )
    if "role_id" in update_obj.model_fields_set:
        new_roles = await role_grants.load_roles(update_obj.role_id or [], db_session=db_session)
        for user in targets:
            role_grants.ensure_can_set_roles(
                actor=current_user, target_id=user.id, current=list(user.roles), new=new_roles
            )
    # False is the only value that ends sessions. Re-enabling (true) restores
    # nothing and stays an ordinary field update (#281).
    disabling = "is_active" in update_obj.model_fields_set and update_obj.is_active is False
    field_updates = update_obj.model_dump(exclude_unset=True)
    if disabling:
        field_updates.pop("is_active", None)
    if disabling and any(user.id == current_user.id for user in targets):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users cannot disable themselves.")
    updated_users = []
    for user in targets:
        current = user
        if disabling:
            current = await disable_user(
                user, actor=current_user, db_session=db_session, redis_client=redis_client
            )
        if field_updates:
            current = await crud.user.update(
                obj_current=current, obj_new=field_updates, db_session=db_session
            )
        updated_users.append(serialize_user(current))
    return create_response(data=updated_users, message="Bulk update successful")


@router.put("/{user_id}")
async def update_user(
    user_update: IUserUpdate,
    user: User = Depends(user_deps.is_valid_user),
    db_session: AsyncSession = Depends(deps.get_db),
    redis_client: AsyncRedis = Depends(get_redis_client),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.update"])),
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

    ``is_active=false`` goes through the disable operation, which ends every
    session and every emailed link before the flag changes (#281). Callers
    cannot disable themselves, so the acting administrator's session is not
    one of those sessions.

    A caller who isn't a superuser cannot change a user above them: see the
    user-target ceiling in ``role_grants``.
    """
    update_data = user_update.model_dump(exclude_unset=True)
    # Before any write, the password change included, so a refusal changes nothing.
    target = await role_grants.load_user(user.id, db_session=db_session)
    role_grants.ensure_can_manage_user(actor=current_user, target=target)
    if "is_superuser" in update_data:
        role_grants.ensure_can_set_superuser(
            actor=current_user, current=user.is_superuser, new=update_data["is_superuser"]
        )
    if "role_id" in update_data:
        new_roles = await role_grants.load_roles(update_data["role_id"] or [], db_session=db_session)
        role_grants.ensure_can_set_roles(
            actor=current_user, target_id=user.id, current=list(target.roles), new=new_roles
        )
    # Popped whether or not it is blank: crud.user.update refuses a password
    # key outright, and blank / omitted means leave the password as-is.
    new_password = update_data.pop("password", None)
    # Popped for the same reason when it is false: crud.user.update refuses
    # to deactivate, and the disable operation ends sessions and emailed
    # links before the flag changes (#281). True stays in update_data.
    disabling = update_data.get("is_active") is False
    if disabling:
        update_data.pop("is_active", None)
    # Before any write. ensure_can_manage_user allows the caller to edit
    # themselves; disable must not, or the caller ends their own sessions.
    if disabling and user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Users cannot disable themselves.")
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
    if disabling:
        user = await disable_user(user, actor=current_user, db_session=db_session, redis_client=redis_client)

    # Update other fields if any
    if any(value is not None for value in update_data.values()):
        updated_user = await crud.user.update(obj_current=user, obj_new=update_data, db_session=db_session)
        return create_response(data=serialize_user(updated_user), message="User updated successfully")

    message = "User updated successfully" if disabling else "No changes to update"
    return create_response(data=serialize_user(user), message=message)


@router.delete("/{user_id}")
async def remove_user(
    user_id: UUID = Depends(user_deps.is_valid_user_id),
    db_session: AsyncSession = Depends(deps.get_db),
    redis_client: AsyncRedis = Depends(get_redis_client),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.delete"])),
) -> IDeleteResponseBase[IUserRead]:
    """
    Deletes a user by his/her id

    Required roles:
    - admin

    A caller who isn't a superuser cannot remove a user above them: see the
    user-target ceiling in ``role_grants``.
    """
    if current_user.id == user_id:
        raise UserSelfDeleteException()
    target = await role_grants.load_user(user_id, db_session=db_session)
    role_grants.ensure_can_manage_user(actor=current_user, target=target)
    # The same refusal crud.user.remove raises, checked first so a delete that
    # will not happen does not end the user's sessions.
    if target.roles:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"User has {len(list(target.roles))} role(s) assigned and cannot be deleted. "
                "Please remove all roles first."
            ),
        )

    email = target.email
    await end_sessions_and_emailed_links(user_id, redis_client=redis_client)
    deleted_user = await crud.user.remove(id=user_id, db_session=db_session)
    await record_user_deleted(actor=current_user, user_id=user_id, email=email, db_session=db_session)
    return create_response(data=serialize_user(deleted_user), message="User removed")


@router.post("/{user_id}/roles", status_code=200)
async def assign_roles_to_user(
    user_id: UUID,
    role_assign: IUserRoleAssign,
    db_session: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user(required_permissions=["user.update"])),
) -> JSONResponse:
    """
    Replace a user's roles. Subject to the role-grant and user-target ceilings (``role_grants``).
    """
    user = await role_grants.load_user(user_id, db_session=db_session)
    role_grants.ensure_can_manage_user(actor=current_user, target=user)
    roles = await role_grants.load_roles(role_assign.role_ids, db_session=db_session)
    role_grants.ensure_can_set_roles(
        actor=current_user, target_id=user.id, current=list(user.roles), new=roles
    )
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
