"""Add an optional description to RoleGroup and PermissionGroup

Neither group table stored a description, so the create schema for role groups
accepted one and the model dropped it (#452).

Downgrade drops both columns. Stored descriptions are lost; nothing else in
either table changes.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_11_27_0000"
down_revision: Union[str, None] = "2026_11_19_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("RoleGroup", "PermissionGroup")


def upgrade() -> None:
    for table in TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("description", sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Batch mode so SQLite, which cannot drop a column in place on older
    # engines, rebuilds the table instead of failing.
    for table in TABLES:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column("description")
