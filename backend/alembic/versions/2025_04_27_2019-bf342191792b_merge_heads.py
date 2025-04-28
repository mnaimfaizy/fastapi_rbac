"""merge_heads

Revision ID: bf342191792b
Revises: 24cc34ec6962, 2025_04_27_2030
Create Date: 2025-04-27 20:19:12.351888

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bf342191792b"
down_revision: Union[str, None] = ("24cc34ec6962", "2025_04_27_2030")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
