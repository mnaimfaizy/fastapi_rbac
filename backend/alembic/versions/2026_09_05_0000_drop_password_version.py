"""
Drop User.password_version

The column was incremented on every password change and read by nothing: no
token carried a version claim and no endpoint compared one. ADR 0011 makes the
Redis allowlist the sole session-revocation mechanism, which leaves this column
a name asserting a security property nothing provides (#68).

Downgrade restores the column and its default. The per-user counters are not
recoverable -- every row comes back at 1 -- which costs nothing, since no code
path ever read the value.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_09_05_0000"
down_revision: Union[str, None] = "2025_06_15_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite, which cannot drop a column in place on older
    # engines, rebuilds the table instead of failing.
    with op.batch_alter_table("User") as batch_op:
        batch_op.drop_column("password_version")


def downgrade() -> None:
    with op.batch_alter_table("User") as batch_op:
        batch_op.add_column(sa.Column("password_version", sa.Integer(), nullable=False, server_default="1"))
