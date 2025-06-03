"""add role group map

Revision ID: 2025_04_27_1525
Revises: 2025_04_27_1524
Create Date: 2025-04-27 15:25:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_1525"
down_revision: Union[str, None] = "2025_04_27_1524"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "role_group_map",
        sa.Column("role_id", sa.UUID(), sa.ForeignKey("Role.id"), primary_key=True),
        sa.Column(
            "role_group_id", sa.UUID(), sa.ForeignKey("RoleGroup.id"), primary_key=True
        ),
    )
    op.create_index("ix_role_group_map_role_id", "role_group_map", ["role_id"])
    op.create_index(
        "ix_role_group_map_role_group_id", "role_group_map", ["role_group_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_role_group_map_role_group_id")
    op.drop_index("ix_role_group_map_role_id")
    op.drop_table("role_group_map")
