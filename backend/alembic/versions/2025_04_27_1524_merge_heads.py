"""merge heads

Revision ID: 2025_04_27_1524
Revises: 2271ef9d5855, 2025_04_27_1523
Create Date: 2025-04-27 15:24:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_1524"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Update this to point to both heads
depends_on = ("2271ef9d5855", "2025_04_27_1523")


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
