"""Who may set a user's roles and superuser flag, and a role's permissions.

Every route that sets roles is gated on a single permission (``user.update``
or ``user.create``). That permission says the caller may edit users. It does
not say which authority they may hand out. This module adds that second
check, the role-grant ceiling:

- A superuser is not limited.
- Anyone else may grant or remove only roles whose permissions they already
  hold, so no one can give a role above their own.
- Anyone else may not change their own roles at all.
- Only a superuser may set or clear ``is_superuser``. A superuser skips every
  permission check, so without this rule the ceiling could be stepped around.

The same holds one level down, for the routes that write a role's
permissions (gated on ``role.update`` or ``role.create``). This is the
role-permission ceiling:

- A superuser is not limited.
- Anyone else may add or remove only permissions they already hold.
- Anyone else may not change the permissions of a role they hold.

Only values that change are checked. Resending a user's current roles or flag,
or a role's current permissions, is a no-op and is allowed, so an edit that
leaves them alone never fails here.
"""

from collections.abc import Iterable, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.permission_model import Permission
from app.models.role_model import Role
from app.models.user_model import User

OWN_ROLES_DETAIL = "You cannot change your own roles."
SUPERUSER_DETAIL = "Only a superuser can change whether a user is a superuser."
OWN_ROLE_PERMISSIONS_DETAIL = "You cannot change the permissions of a role you hold."


def _permission_names(roles: Iterable[Role]) -> set[str]:
    return {permission.name for role in roles for permission in (role.permissions or [])}


async def load_roles(role_ids: Sequence[UUID | str], *, db_session: AsyncSession) -> list[Role]:
    """The roles ``role_ids`` names, with their permissions loaded; 404 if any is missing."""
    try:
        wanted = [UUID(str(role_id)) for role_id in role_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role id.")
    if not wanted:
        return []
    # populate_existing: a Role already in this session may hold a stale
    # permissions list, and the ceiling must judge what the database says now.
    result = await db_session.exec(
        select(Role)
        .where(Role.id.in_(wanted))  # type: ignore[attr-defined]
        .options(selectinload(Role.permissions))  # type: ignore[arg-type]
        .execution_options(populate_existing=True)
    )
    found = {role.id: role for role in result.all()}
    missing = [str(role_id) for role_id in wanted if role_id not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"One or more roles not found for IDs: {missing}",
        )
    return [found[role_id] for role_id in wanted]


def ensure_can_set_roles(
    *,
    actor: User,
    target_id: UUID | None,
    current: Sequence[Role],
    new: Sequence[Role],
) -> None:
    """Refuse with 403 unless ``actor`` may change a user's roles from ``current`` to ``new``.

    ``target_id`` is None for a user being created. ``actor`` must have its
    roles and their permissions loaded, as ``deps.get_current_user`` does.
    """
    if actor.is_superuser:
        return
    current_by_id = {role.id: role for role in current}
    new_by_id = {role.id: role for role in new}
    changed = [
        role
        for role_id, role in {**current_by_id, **new_by_id}.items()
        if (role_id in current_by_id) != (role_id in new_by_id)
    ]
    if not changed:
        return
    if target_id is not None and target_id == actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=OWN_ROLES_DETAIL)
    held = _permission_names(actor.roles or [])
    for role in changed:
        if not _permission_names([role]) <= held:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"You cannot grant or remove the role '{role.name}': "
                    "it has permissions you do not hold."
                ),
            )


def ensure_can_set_superuser(*, actor: User, current: bool, new: bool | None) -> None:
    """Refuse with 403 unless ``actor`` may change ``is_superuser`` from ``current`` to ``new``.

    ``new`` is None when the request does not set the flag. ``current`` is
    False for a user being created.
    """
    if actor.is_superuser or new is None or bool(new) == bool(current):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=SUPERUSER_DETAIL)


async def load_role(role_id: UUID, *, db_session: AsyncSession) -> Role:
    """The role ``role_id`` names, with its permissions loaded; 404 if it is missing."""
    # populate_existing: see load_roles.
    result = await db_session.exec(
        select(Role)
        .where(Role.id == role_id)
        .options(selectinload(Role.permissions))  # type: ignore[arg-type]
        .execution_options(populate_existing=True)
    )
    role = result.first()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Role {role_id} not found.")
    return role


async def load_permissions(permission_ids: Sequence[UUID], *, db_session: AsyncSession) -> list[Permission]:
    """The permissions ``permission_ids`` names; 404 if any is missing."""
    wanted = list(dict.fromkeys(permission_ids))
    if not wanted:
        return []
    result = await db_session.exec(
        select(Permission).where(Permission.id.in_(wanted))  # type: ignore[union-attr]
    )
    found = {permission.id: permission for permission in result.all()}
    missing = [str(permission_id) for permission_id in wanted if permission_id not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"One or more permissions not found for IDs: {missing}",
        )
    return [found[permission_id] for permission_id in wanted]


def ensure_can_set_permissions(
    *,
    actor: User,
    role_id: UUID | None,
    current: Sequence[Permission],
    new: Sequence[Permission],
) -> None:
    """Refuse with 403 unless ``actor`` may change a role's permissions from ``current`` to ``new``.

    ``role_id`` is None for a role being created. ``actor`` must have its
    roles and their permissions loaded, as ``deps.get_current_user`` does.
    """
    if actor.is_superuser:
        return
    current_by_id = {permission.id: permission for permission in current}
    new_by_id = {permission.id: permission for permission in new}
    changed = [
        permission
        for permission_id, permission in {**current_by_id, **new_by_id}.items()
        if (permission_id in current_by_id) != (permission_id in new_by_id)
    ]
    if not changed:
        return
    if role_id is not None and role_id in {role.id for role in actor.roles or []}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=OWN_ROLE_PERMISSIONS_DETAIL)
    held = _permission_names(actor.roles or [])
    for permission in changed:
        if permission.name not in held:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"You cannot grant or remove the permission '{permission.name}': " "you do not hold it."
                ),
            )
