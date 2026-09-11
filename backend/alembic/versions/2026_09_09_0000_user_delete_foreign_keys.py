"""Align User FKs with the deletion policy in ADR 0013.

Password history cascades. Assigned roles restrict (admin delete refuses
with 409). Creator attribution on RBAC artifacts and AuditLog.created_by_id
is SET NULL. AuditLog.actor_id keeps the UUID and loses its foreign key so
deleting a user cannot rewrite or destroy the audit trail (#238).
"""

from typing import Any, Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_09_09_0000"
down_revision: Union[str, None] = "2026_09_05_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SET_NULL_CREATED_BY = (
    ("Permission", "fk_permission_created_by_id_user"),
    ("PermissionGroup", "fk_permissiongroup_created_by_id_user"),
    ("Role", "fk_role_created_by_id_user"),
    ("RoleGroup", "fk_rolegroup_created_by_id_user"),
)


def _fk_names(inspector: Any, table: str, column: str) -> list[str]:
    return [
        fk["name"]
        for fk in inspector.get_foreign_keys(table)
        if column in (fk.get("constrained_columns") or []) and fk.get("name")
    ]


def _recreate_fk(
    table: str,
    column: str,
    constraint_name: str,
    *,
    ondelete: str | None,
    inspector: Any,
) -> None:
    existing = _fk_names(inspector, table, column)
    with op.batch_alter_table(table) as batch_op:
        for name in existing:
            batch_op.drop_constraint(name, type_="foreignkey")
        batch_op.create_foreign_key(
            constraint_name,
            "User",
            [column],
            ["id"],
            ondelete=ondelete,
        )


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    _recreate_fk(
        "UserPasswordHistory",
        "user_id",
        "UserPasswordHistory_user_id_fkey",
        ondelete="CASCADE",
        inspector=inspector,
    )
    _recreate_fk(
        "UserRole",
        "user_id",
        "UserRole_user_id_fkey",
        ondelete="RESTRICT",
        inspector=inspector,
    )
    for table, constraint_name in _SET_NULL_CREATED_BY:
        _recreate_fk(
            table,
            "created_by_id",
            constraint_name,
            ondelete="SET NULL",
            inspector=inspector,
        )

    created_by_fks = _fk_names(inspector, "AuditLog", "created_by_id")
    actor_fks = _fk_names(inspector, "AuditLog", "actor_id")
    with op.batch_alter_table("AuditLog") as batch_op:
        for name in created_by_fks + actor_fks:
            batch_op.drop_constraint(name, type_="foreignkey")
        batch_op.create_foreign_key(
            "AuditLog_created_by_id_fkey",
            "User",
            ["created_by_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    _recreate_fk(
        "UserPasswordHistory",
        "user_id",
        "UserPasswordHistory_user_id_fkey",
        ondelete=None,
        inspector=inspector,
    )
    _recreate_fk(
        "UserRole",
        "user_id",
        "UserRole_user_id_fkey",
        ondelete=None,
        inspector=inspector,
    )
    for table, constraint_name in _SET_NULL_CREATED_BY:
        _recreate_fk(
            table,
            "created_by_id",
            constraint_name,
            ondelete=None,
            inspector=inspector,
        )

    created_by_fks = _fk_names(inspector, "AuditLog", "created_by_id")
    actor_fks = _fk_names(inspector, "AuditLog", "actor_id")
    with op.batch_alter_table("AuditLog") as batch_op:
        for name in created_by_fks + actor_fks:
            batch_op.drop_constraint(name, type_="foreignkey")
        batch_op.create_foreign_key(
            "AuditLog_created_by_id_fkey",
            "User",
            ["created_by_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "AuditLog_actor_id_fkey",
            "User",
            ["actor_id"],
            ["id"],
        )
