"""add_needs_to_change_password

Revision ID: 2025_04_25_1200
Revises: 5c76e4868fe4
Create Date: 2025-04-25 12:00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_25_1200"
down_revision: Union[str, None] = "5c76e4868fe4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def has_column(table_name, column_name):
    """Check if a column exists in a table"""
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Check if the column already exists before trying to add it
    if not has_column("User", "needs_to_change_password"):
        # Add needs_to_change_password column as nullable first
        with op.batch_alter_table("User") as batch_op:
            batch_op.add_column(sa.Column("needs_to_change_password", sa.Boolean(), nullable=True))

        # Update existing rows to set default value to True
        op.execute('UPDATE "User" SET needs_to_change_password = true WHERE needs_to_change_password IS NULL')

        # Now make it non-nullable using batch operations
        with op.batch_alter_table("User") as batch_op:
            batch_op.alter_column("needs_to_change_password", existing_type=sa.Boolean(), nullable=False)
    else:
        # If the column already exists, make sure all rows have a value
        op.execute('UPDATE "User" SET needs_to_change_password = true WHERE needs_to_change_password IS NULL')


def downgrade() -> None:
    # Only try to remove the column if it exists
    if has_column("User", "needs_to_change_password"):
        # Remove the column if we need to roll back, using batch operations for SQLite compatibility
        with op.batch_alter_table("User") as batch_op:
            batch_op.drop_column("needs_to_change_password")
