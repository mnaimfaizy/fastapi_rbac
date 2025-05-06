"""remove duplicate table

Revision ID: 2025_04_27_1529
Revises: 2025_04_27_1528
Create Date: 2025-04-27 15:29:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_1529"
down_revision: str = "2025_04_27_1528"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the duplicate table if it exists
    op.execute("DROP TABLE IF EXISTS rolegroupmap")


def downgrade() -> None:
    pass  # We don't need to recreate the duplicate table on downgrade
