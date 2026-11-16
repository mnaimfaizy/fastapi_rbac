"""Who may set a user's roles.

Every route that sets roles is gated on a single permission (``user.update``
or ``user.create``). That permission says the caller may edit users. It does
not say which roles they may hand out. This module adds that second check,
the role-grant ceiling:

- A superuser is not limited.
- Anyone else may grant or remove only roles whose permissions they already
  hold, so no one can give a role above their own.
- Anyone else may not change their own roles at all.

Only roles that change are checked. Resending a user's current roles is a
no-op and is allowed, so an edit that leaves roles alone never fails here.
"""

from collections.abc import Iterable, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.role_model import Role
from app.models.user_model import User

OWN_ROLES_DETAIL = "You cannot change your own roles."


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
