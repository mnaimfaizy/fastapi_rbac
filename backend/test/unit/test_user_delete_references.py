"""User deletion must succeed or refuse on purpose, never via a raw FK error (#238).

Seam: ``CRUDUser.remove``, the deletion interface ``DELETE /users/{id}`` calls.
"""

from test.utils import random_email, random_lower_string

import pytest
from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.user_crud import user_crud
from app.models.audit_log_model import AuditLog
from app.models.password_history_model import UserPasswordHistory
from app.models.permission_group_model import PermissionGroup
from app.models.permission_model import Permission
from app.models.role_group_model import RoleGroup
from app.models.role_model import Role
from app.models.user_model import User
from app.models.user_role_model import UserRole


async def _create_user(db: AsyncSession) -> User:
    user = User(
        email=random_email(),
        password=random_lower_string(),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_remove_user_with_password_history_succeeds_and_leaves_no_history(
    db: AsyncSession,
) -> None:
    """A user who has changed their password is still deletable; history goes with them."""
    user = await _create_user(db)
    db.add(UserPasswordHistory(user_id=user.id, password_hash="hash-one"))
    db.add(UserPasswordHistory(user_id=user.id, password_hash="hash-two"))
    await db.commit()

    deleted = await user_crud.remove(id=user.id, db_session=db)

    assert deleted.id == user.id
    assert await user_crud.get(id=user.id, db_session=db) is None
    leftover = await db.exec(select(UserPasswordHistory).where(UserPasswordHistory.user_id == user.id))
    assert leftover.all() == []


@pytest.mark.asyncio
async def test_remove_user_nulls_created_by_on_surviving_artifacts(db: AsyncSession) -> None:
    """Permissions, groups, and roles outlive their creator; created_by_id becomes null."""
    user = await _create_user(db)
    group = PermissionGroup(name=f"pg-{user.id}", created_by_id=user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)

    permission = Permission(
        name=f"perm-{user.id}",
        group_id=group.id,
        created_by_id=user.id,
    )
    role = Role(name=f"role-{user.id}", created_by_id=user.id)
    role_group = RoleGroup(name=f"rg-{user.id}", created_by_id=user.id)
    db.add(permission)
    db.add(role)
    db.add(role_group)
    await db.commit()

    await user_crud.remove(id=user.id, db_session=db)

    stored_permission = await db.get(Permission, permission.id)
    stored_group = await db.get(PermissionGroup, group.id)
    stored_role = await db.get(Role, role.id)
    stored_role_group = await db.get(RoleGroup, role_group.id)
    assert stored_permission is not None
    assert stored_permission.created_by_id is None
    assert stored_group is not None
    assert stored_group.created_by_id is None
    assert stored_role is not None
    assert stored_role.created_by_id is None
    assert stored_role_group is not None
    assert stored_role_group.created_by_id is None


@pytest.mark.asyncio
async def test_remove_user_keeps_audit_logs_and_actor_id(db: AsyncSession) -> None:
    """Audit rows outlive the actor; the recorded actor_id is not rewritten or dropped."""
    user = await _create_user(db)
    log = AuditLog(
        actor_id=user.id,
        created_by_id=user.id,
        action="login",
        resource_type="user",
        resource_id=str(user.id),
        details={"ip": "127.0.0.1"},
    )
    db.add(log)
    await db.commit()
    log_id = log.id

    await user_crud.remove(id=user.id, db_session=db)

    stored = await db.get(AuditLog, log_id)
    assert stored is not None
    assert stored.actor_id == user.id
    assert stored.created_by_id is None
    assert stored.action == "login"


@pytest.mark.asyncio
async def test_remove_user_with_roles_raises_conflict(db: AsyncSession) -> None:
    """Assigned roles are an explicit refusal, not a database error."""
    user = await _create_user(db)
    role = Role(name=f"assigned-{user.id}")
    db.add(role)
    await db.commit()
    await db.refresh(role)
    db.add(UserRole(user_id=user.id, role_id=role.id))
    await db.commit()

    with pytest.raises(HTTPException) as excinfo:
        await user_crud.remove(id=user.id, db_session=db)

    assert excinfo.value.status_code == 409
    assert "role(s) assigned" in str(excinfo.value.detail)
    assert await user_crud.get(id=user.id, db_session=db) is not None
    leftover_role = await db.get(Role, role.id)
    assert leftover_role is not None


def _fk_ondelete(model: type, column_name: str) -> str | None:
    column = model.__table__.c[column_name]
    fks = list(column.foreign_keys)
    assert fks, f"{model.__name__}.{column_name} has no foreign key"
    return next(iter(fks)).ondelete


def test_user_reference_ondelete_matches_deletion_policy() -> None:
    """Mapped FKs must match the deletion policy so autogenerate cannot revert it."""
    assert _fk_ondelete(UserPasswordHistory, "user_id") == "CASCADE"
    for model in (Permission, PermissionGroup, Role, RoleGroup, AuditLog):
        assert _fk_ondelete(model, "created_by_id") == "SET NULL"
    assert list(AuditLog.__table__.c["actor_id"].foreign_keys) == []
    user_role_ondelete = _fk_ondelete(UserRole, "user_id")
    assert user_role_ondelete == "RESTRICT"
