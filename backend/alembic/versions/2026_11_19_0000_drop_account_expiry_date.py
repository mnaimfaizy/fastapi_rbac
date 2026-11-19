"""Drop User.expiry_date

The column was written at seed time to the moment of creation and returned on
every user read, but no authentication or authorization path read it. The
users list painted that past date as a red Expires pill (#409). Account expiry
is not a feature (#412). Password expiry is a different column and is not
touched here.

Downgrade restores a nullable column. The previous values are not recoverable;
every row comes back NULL, which is the same shape the column had when it was
unused.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_11_19_0000"
down_revision: Union[str, None] = "2026_11_10_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite, which cannot drop a column in place on older
    # engines, rebuilds the table instead of failing.
    with op.batch_alter_table("User") as batch_op:
        batch_op.drop_column("expiry_date")


def downgrade() -> None:
    with op.batch_alter_table("User") as batch_op:
        batch_op.add_column(sa.Column("expiry_date", sa.DateTime(), nullable=True))
