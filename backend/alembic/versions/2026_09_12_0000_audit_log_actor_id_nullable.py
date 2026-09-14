"""Allow AuditLog.actor_id to be null for anonymous security events.

Anonymous events (unknown-email login, missing refresh token, sanitization
failures) have no user. A sentinel UUID would look like an actor; null does
not. #238 already dropped the User foreign key on this column (#243).
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_09_12_0000"
down_revision: Union[str, None] = "2026_09_09_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("AuditLog") as batch_op:
        batch_op.alter_column("actor_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("AuditLog") as batch_op:
        batch_op.alter_column("actor_id", existing_type=sa.UUID(), nullable=False)
