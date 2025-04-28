"""standardize table names

Revision ID: 2025_04_27_1530
Revises: 2025_04_27_1529
Create Date: 2025-04-27 15:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_1530"
down_revision: str = "2025_04_27_1529"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists"""
    conn = op.get_bind()
    inspector = inspect(conn)
    return table_name.lower() in (t.lower() for t in inspector.get_table_names())


def upgrade() -> None:
    # Rename tables to PascalCase if they exist
    table_renames = [
        ("role_group_map", "RoleGroupMap"),
        ("audit_logs", "AuditLog"),
        ("user_password_history", "UserPasswordHistory"),
        ("user_role", "UserRole"),
        ("role_permission", "RolePermission"),
    ]

    for old_name, new_name in table_renames:
        if table_exists(old_name):
            op.execute(f'ALTER TABLE "{old_name}" RENAME TO "{new_name}"')


def downgrade() -> None:
    # Revert names back to snake_case
    table_renames = [
        ("RoleGroupMap", "role_group_map"),
        ("AuditLog", "audit_logs"),
        ("UserPasswordHistory", "user_password_history"),
        ("UserRole", "user_role"),
        ("RolePermission", "role_permission"),
    ]

    for old_name, new_name in table_renames:
        if table_exists(old_name):
            op.execute(f'ALTER TABLE "{old_name}" RENAME TO "{new_name}"')
