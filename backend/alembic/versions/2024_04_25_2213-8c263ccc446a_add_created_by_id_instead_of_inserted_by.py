"""add created_by_id instead of inserted_by

Revision ID: 8c263ccc446a
Revises: c93f54e30e5c
Create Date: 2024-04-25 22:13:36.062988

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql  # Added import

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c263ccc446a"
down_revision: Union[str, None] = "c93f54e30e5c"
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
    # Use batch operations for SQLite compatibility
    # Permission table changes
    with op.batch_alter_table("Permission") as batch_op:
        batch_op.add_column(sa.Column("created_by_id", get_uuid_type(), nullable=True))
        batch_op.create_foreign_key("fk_permission_created_by_id_user", "User", ["created_by_id"], ["id"])
        batch_op.drop_column("inserted_by")

    # PermissionGroup table changes
    with op.batch_alter_table("PermissionGroup") as batch_op:
        batch_op.add_column(sa.Column("created_by_id", get_uuid_type(), nullable=True))
        batch_op.create_foreign_key(
            "fk_permissiongroup_created_by_id_user", "User", ["created_by_id"], ["id"]
        )
        batch_op.drop_column("inserted_by")

    # Role table changes
    with op.batch_alter_table("Role") as batch_op:
        batch_op.add_column(sa.Column("created_by_id", get_uuid_type(), nullable=True))
        batch_op.create_foreign_key("fk_role_created_by_id_user", "User", ["created_by_id"], ["id"])
        batch_op.drop_column("inserted_by")

    # RoleGroup table changes
    with op.batch_alter_table("RoleGroup") as batch_op:
        batch_op.add_column(sa.Column("created_by_id", get_uuid_type(), nullable=True))
        batch_op.create_foreign_key("fk_rolegroup_created_by_id_user", "User", ["created_by_id"], ["id"])
        batch_op.drop_column("inserted_by")


def downgrade() -> None:
    # Use batch operations for SQLite compatibility
    # RoleGroup table changes
    with op.batch_alter_table("RoleGroup") as batch_op:
        batch_op.add_column(sa.Column("inserted_by", sa.INTEGER(), nullable=True))
        batch_op.drop_constraint("fk_rolegroup_created_by_id_user", type_="foreignkey")
        batch_op.drop_column("created_by_id")

    # Role table changes
    with op.batch_alter_table("Role") as batch_op:
        batch_op.add_column(sa.Column("inserted_by", sa.INTEGER(), nullable=True))
        batch_op.drop_constraint("fk_role_created_by_id_user", type_="foreignkey")
        batch_op.drop_column("created_by_id")

    # PermissionGroup table changes
    with op.batch_alter_table("PermissionGroup") as batch_op:
        batch_op.add_column(sa.Column("inserted_by", sa.INTEGER(), nullable=True))
        batch_op.drop_constraint("fk_permissiongroup_created_by_id_user", type_="foreignkey")
        batch_op.drop_column("created_by_id")

    # Permission table changes
    with op.batch_alter_table("Permission") as batch_op:
        batch_op.add_column(sa.Column("inserted_by", sa.INTEGER(), nullable=True))
        batch_op.drop_constraint("fk_permission_created_by_id_user", type_="foreignkey")
        batch_op.drop_column("created_by_id")
