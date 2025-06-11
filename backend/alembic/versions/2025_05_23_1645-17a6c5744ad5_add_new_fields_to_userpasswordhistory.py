"""add fields to userpasswordhistory manually

Revision ID: add_fields_to_userpasswordhistory_manual
Revises: 74a7cd91e8fa
Create Date: 2025-05-23 15:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as pg_UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "17a6c5744ad5"
down_revision: Union[str, None] = "bf342191792b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Function to get appropriate UUID type based on dialect
def get_uuid_type():
    dialect = op.get_context().dialect.name
    if dialect == "postgresql":
        return pg_UUID(as_uuid=True)
    else:
        # For SQLite (used in development), we'll use String to store UUIDs
        return sa.String(36)


def upgrade() -> None:
    # Add other fields
    op.add_column(
        "UserPasswordHistory", sa.Column("password_hash", sa.String(), nullable=False)
    )
    op.add_column(
        "UserPasswordHistory",
        sa.Column("salt", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "UserPasswordHistory",
        sa.Column(
            "pepper_used", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column(
        "UserPasswordHistory", sa.Column("created_by_ip", sa.String(), nullable=True)
    )
    op.add_column(
        "UserPasswordHistory",
        sa.Column("reset_token_id", get_uuid_type(), nullable=True),
    )

    # Add index to created_at (assuming created_at column exists from BaseUUIDModel).
    # The model UserPasswordHistoryBase redefines it with index=True.
    op.create_index(
        op.f("ix_UserPasswordHistory_created_at"),
        "UserPasswordHistory",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_UserPasswordHistory_created_at"), table_name="UserPasswordHistory"
    )
    op.drop_column("UserPasswordHistory", "password")
    op.drop_column("UserPasswordHistory", "reset_token_id")
    op.drop_column("UserPasswordHistory", "created_by_ip")
    op.drop_column("UserPasswordHistory", "pepper_used")
    op.drop_column("UserPasswordHistory", "salt")
    op.drop_column("UserPasswordHistory", "password_hash")
