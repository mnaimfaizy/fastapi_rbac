"""add_needs_to_change_password

Revision ID: 2025_04_25_1200
Revises: 5c76e4868fe4
Create Date: 2025-04-25 12:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "2025_04_25_1200"
down_revision: Union[str, None] = "5c76e4868fe4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add needs_to_change_password column as nullable first
    op.add_column(
        "User", sa.Column("needs_to_change_password", sa.Boolean(), nullable=True)
    )
    # Update existing rows to set default value to True
    op.execute('UPDATE "User" SET needs_to_change_password = true')
    # Now make it non-nullable
    op.alter_column(
        "User", "needs_to_change_password", existing_type=sa.Boolean(), nullable=False
    )


def downgrade() -> None:
    # Remove the column if we need to roll back
    op.drop_column("User", "needs_to_change_password")
