"""
Add unique constraint to RoleGroup.name
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_06_15_0000"
down_revision: Union[str, None] = "5b37ec4d07bc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_unique_constraint("uq_rolegroup_name", "RoleGroup", ["name"])


def downgrade():
    op.drop_constraint("uq_rolegroup_name", "RoleGroup", type_="unique")
