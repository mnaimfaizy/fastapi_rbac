"""add_role_group_id_field_to_roles

Revision ID: 24cc34ec6962
Revises: 2025_04_27_1530
Create Date: 2025-04-27 13:59:11.469264

"""

from typing import Sequence, Union
from uuid import UUID

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "24cc34ec6962"
down_revision: Union[str, None] = "2025_04_27_1530"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("Role") as batch_op:  # Changed "role" to "Role"
        batch_op.add_column(sa.Column("role_group_id", sa.UUID(), nullable=True))
        batch_op.create_foreign_key(
            "fk_role_role_group_id", "RoleGroup", ["role_group_id"], ["id"]
        )  # Changed "role_group" to "RoleGroup"


def downgrade() -> None:
    with op.batch_alter_table("Role") as batch_op:  # Changed "role" to "Role"
        batch_op.drop_constraint("fk_role_role_group_id", type_="foreignkey")
        batch_op.drop_column("role_group_id")
