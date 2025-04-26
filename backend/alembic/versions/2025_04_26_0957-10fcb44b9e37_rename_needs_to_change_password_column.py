"""rename_needs_to_change_password_column

Revision ID: 10fcb44b9e37
Revises: 2025_04_25_1200
Create Date: 2025-04-26 09:57:37.590460

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "10fcb44b9e37"
down_revision: Union[str, None] = "2025_04_25_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite doesn't support direct column renaming with ALTER TABLE...RENAME COLUMN
    # So we need to use batch operations to work around this limitation
    with op.batch_alter_table("User") as batch_op:
        # First check if the old column exists
        inspector = sa.inspect(op.get_bind())
        columns = [col["name"] for col in inspector.get_columns("User")]

        if "needsToChangePassword" in columns:
            # Add the new column with the correct name
            batch_op.add_column(
                sa.Column("needs_to_change_password", sa.Boolean(), nullable=True)
            )

            # Copy data from old column to new column
            op.execute(
                'UPDATE "User" SET needs_to_change_password = "needsToChangePassword"'
            )

            # Make the new column not nullable
            batch_op.alter_column("needs_to_change_password", nullable=False)

            # Drop the old column
            batch_op.drop_column("needsToChangePassword")


def downgrade() -> None:
    # Reverse the operation if needed
    with op.batch_alter_table("User") as batch_op:
        # Add back the old column
        batch_op.add_column(
            sa.Column("needsToChangePassword", sa.Boolean(), nullable=True)
        )

        # Copy data from new column to old column
        op.execute(
            'UPDATE "User" SET "needsToChangePassword" = needs_to_change_password'
        )

        # Make the old column not nullable
        batch_op.alter_column("needsToChangePassword", nullable=False)

        # Drop the new column
        batch_op.drop_column("needs_to_change_password")
