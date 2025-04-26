"""merge heads

Revision ID: bd7fd9f11370
Revises: 10fcb44b9e37, 2025_04_26_1010
Create Date: 2025-04-26 10:04:37.382905

"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'bd7fd9f11370'
down_revision: Union[str, None] = ('10fcb44b9e37', '2025_04_26_1010')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
