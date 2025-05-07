"""add audit logs

Revision ID: 2025_04_27_1523
Revises: 2025_04_25_1200
Create Date: 2025-04-27 15:23:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_1523"
down_revision: Union[str, None] = "2025_04_25_1200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "AuditLog",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "actor_id", sa.UUID(), sa.ForeignKey("User.id"), nullable=False
        ),  # Changed "users.id" to "user.id"
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_log_timestamp", "AuditLog", ["timestamp"])
    op.create_index("ix_audit_log_actor_id", "AuditLog", ["actor_id"])
    op.create_index("ix_audit_log_resource_type", "AuditLog", ["resource_type"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_resource_type")
    op.drop_index("ix_audit_log_actor_id")
    op.drop_index("ix_audit_log_timestamp")
    op.drop_table("AuditLog")
