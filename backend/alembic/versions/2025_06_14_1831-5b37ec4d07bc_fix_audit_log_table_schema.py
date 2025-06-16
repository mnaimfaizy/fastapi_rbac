"""fix_audit_log_table_schema

Revision ID: 5b37ec4d07bc
Revises: 8ba4877e61a2
Create Date: 2025-06-14 18:31:05.103889

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5b37ec4d07bc"
down_revision: Union[str, None] = "8ba4877e61a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing AuditLog table with incorrect schema
    op.execute('DROP TABLE IF EXISTS "AuditLog" CASCADE')

    # Recreate AuditLog table with correct schema (UUID types)
    op.create_table(
        "AuditLog",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("actor_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["User.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["User.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index("ix_audit_log_timestamp", "AuditLog", ["timestamp"], unique=False)
    op.create_index("ix_audit_log_actor_id", "AuditLog", ["actor_id"], unique=False)
    op.create_index("ix_audit_log_resource_type", "AuditLog", ["resource_type"], unique=False)


def downgrade() -> None:
    # Drop the indexes first
    op.drop_index("ix_audit_log_resource_type", "AuditLog")
    op.drop_index("ix_audit_log_actor_id", "AuditLog")
    op.drop_index("ix_audit_log_timestamp", "AuditLog")

    # Drop the table
    op.drop_table("AuditLog")
