"""rename needsToChangePassword to needs_to_change_password

Revision ID: 2025_04_26_1010
Revises: 2025_04_25_1200
Create Date: 2025-04-26 10:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_26_1010"
down_revision: Union[str, None] = "2025_04_25_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite doesn't support direct column renaming with ALTER TABLE...RENAME COLUMN
    # So we need to use batch operations to work around this limitation

    # First, check if the column exists with the old name
    inspector = Inspector.from_engine(op.get_bind())
    columns = [column["name"] for column in inspector.get_columns("User")]

    if "needsToChangePassword" in columns and "needs_to_change_password" not in columns:
        with op.batch_alter_table("User") as batch_op:
            # Add the new column with the correct name
            batch_op.add_column(
                sa.Column("needs_to_change_password", sa.Boolean(), nullable=True)
            )

            # Copy data from old column to new column
            op.execute(
                'UPDATE "User" SET needs_to_change_password = "needsToChangePassword"'
            )

            # Set the default value for any NULLs
            op.execute(
                'UPDATE "User" SET needs_to_change_password = FALSE WHERE needs_to_change_password IS NULL'
            )

            # Make the new column not nullable
            batch_op.alter_column("needs_to_change_password", nullable=False)

            # Drop the old column
            batch_op.drop_column("needsToChangePassword")


def downgrade() -> None:
    # Reverse the operation if needed
    inspector = Inspector.from_engine(op.get_bind())
    columns = [column["name"] for column in inspector.get_columns("User")]

    if "needs_to_change_password" in columns and "needsToChangePassword" not in columns:
        with op.batch_alter_table("User") as batch_op:
            # Add back the old column
            batch_op.add_column(
                sa.Column("needsToChangePassword", sa.Boolean(), nullable=True)
            )

            # Copy data from new column to old column
            op.execute(
                'UPDATE "User" SET "needsToChangePassword" = needs_to_change_password'
            )

            # Set the default value for any NULLs
            op.execute(
                'UPDATE "User" SET "needsToChangePassword" = FALSE WHERE "needsToChangePassword" IS NULL'
            )

            # Make the old column not nullable
            batch_op.alter_column("needsToChangePassword", nullable=False)

            # Drop the new column
            batch_op.drop_column("needs_to_change_password")
