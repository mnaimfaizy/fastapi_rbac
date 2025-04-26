"""add_account_locking_columns

Revision ID: 5c76e4868fe4
Revises: 8c263ccc446a
Create Date: 2025-04-25 01:44:00.165605

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "5c76e4868fe4"
down_revision: Union[str, None] = "8c263ccc446a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def get_uuid_type():
    # For SQLite (used in development), we'll use String to store UUIDs
    return sa.String(36)


def has_column(table_name, column_name):
    """Check if a column exists in a table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Check if the columns already exist before trying to add them
    if not has_column("User", "is_locked"):
        # Use batch operations to ensure SQLite compatibility
        with op.batch_alter_table("User") as batch_op:
            batch_op.add_column(sa.Column("is_locked", sa.Boolean(), nullable=True))

    if not has_column("User", "locked_until"):
        # Add locked_until column if it doesn't exist
        with op.batch_alter_table("User") as batch_op:
            batch_op.add_column(sa.Column("locked_until", sa.DateTime(), nullable=True))

    # Set default values for existing rows if the column was just added
    op.execute('UPDATE "User" SET is_locked = false WHERE is_locked IS NULL')

    # Use batch operations to make is_locked non-nullable
    with op.batch_alter_table("User") as batch_op:
        batch_op.alter_column("is_locked", existing_type=sa.Boolean(), nullable=False)

    # Use batch operations for UserPasswordHistory
    with op.batch_alter_table("UserPasswordHistory") as batch_op:
        batch_op.alter_column("user_id", existing_type=get_uuid_type(), nullable=False)


def downgrade() -> None:
    # Use batch operations for proper SQLite compatibility on downgrade
    # UserPasswordHistory changes
    with op.batch_alter_table("UserPasswordHistory") as batch_op:
        batch_op.alter_column("user_id", existing_type=get_uuid_type(), nullable=True)

    # User table changes - we'll check if the columns exist before dropping
    if has_column("User", "locked_until"):
        with op.batch_alter_table("User") as batch_op:
            batch_op.drop_column("locked_until")

    if has_column("User", "is_locked"):
        with op.batch_alter_table("User") as batch_op:
            batch_op.drop_column("is_locked")
