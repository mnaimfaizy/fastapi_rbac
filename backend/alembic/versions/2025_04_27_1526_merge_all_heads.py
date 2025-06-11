"""merge all heads

Revision ID: 2025_04_27_1526
Revises: 2025_04_27_1523, 2025_04_27_1525, 2271ef9d5855
Create Date: 2025-04-27 15:26:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2025_04_27_1526"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = (
    "2025_04_27_1523",
    "2025_04_27_1525",
    "2271ef9d5855",
)


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
