"""add parent_id to role group

Revision ID: 2025_04_27_2030
Revises: 2025_04_27_1525
Create Date: 2025-04-27 20:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_2030"
down_revision: Union[str, None] = "2025_04_27_1525"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Function to get appropriate UUID type based on dialect
def get_uuid_type():
    dialect = op.get_context().dialect.name
    if dialect == "postgresql":
        return postgresql.UUID(as_uuid=True)
    else:  # Default for SQLite or other non-PostgreSQL DBs
        return sa.String(36)


def upgrade() -> None:
    # For SQLite, we need to use batch operations for adding foreign key constraints
    with op.batch_alter_table("RoleGroup") as batch_op:
        batch_op.add_column(sa.Column("parent_id", get_uuid_type(), nullable=True))
        batch_op.create_foreign_key(
            constraint_name="fk_rolegroup_parent_id",
            referent_table="RoleGroup",
            local_cols=["parent_id"],
            remote_cols=["id"],
        )
        batch_op.create_index("ix_RoleGroup_parent_id", ["parent_id"])


def downgrade() -> None:
    with op.batch_alter_table("RoleGroup") as batch_op:
        batch_op.drop_index("ix_RoleGroup_parent_id")
        batch_op.drop_constraint("fk_rolegroup_parent_id", type_="foreignkey")
        batch_op.drop_column("parent_id")
