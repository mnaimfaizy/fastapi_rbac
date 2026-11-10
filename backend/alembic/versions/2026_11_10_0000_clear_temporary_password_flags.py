"""Clear every User.needs_to_change_password before the flag is enforced (#273).

The model used to default the flag to true and the create schema inherited that
default, so self-registration stored true for every user who never changed or
reset their password. Nothing on the row tells those users apart from ones an
administrator flagged, so every flag is cleared. From this release on only
admin create and admin set turn it on, and it restricts the account
(ADR 0014).
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_11_10_0000"
down_revision: Union[str, None] = "2026_09_12_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('UPDATE "User" SET needs_to_change_password = FALSE WHERE needs_to_change_password')


def downgrade() -> None:
    # Which rows were flagged is not recoverable, and restoring true everywhere
    # would force a change on users who chose their own password.
    pass
