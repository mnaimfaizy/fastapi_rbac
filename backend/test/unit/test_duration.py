"""A lifetime rendered for a human reader must be exact, not merely close.

Email copy that states a validity window is computed from the setting that
enforces it (#182). The old arithmetic was ``minutes // 60``, which floors: a
30-minute window rendered as "0 hours" and a 90-minute one as "1 hours".
"""

import pytest

from app.utils.duration import humanize_minutes


@pytest.mark.parametrize(
    ("minutes", "expected"),
    [
        (1, "1 minute"),
        (45, "45 minutes"),
        (59, "59 minutes"),
        (60, "1 hour"),
        (90, "90 minutes"),
        (120, "2 hours"),
        (1440, "1 day"),
        (2880, "2 days"),
        (10080, "7 days"),
    ],
)
def test_a_lifetime_reads_in_the_largest_unit_that_divides_it(minutes: int, expected: str) -> None:
    """A duration no larger unit divides stays in minutes rather than being floored."""
    assert humanize_minutes(minutes) == expected
