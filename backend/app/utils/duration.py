"""Render a configured lifetime as the phrase that goes into an email.

Email copy that states a validity window has to be computed from the setting
that actually enforces it, never written by hand and never taken from a
parallel setting -- that is how the verification mail came to promise 168 hours
for a link that stopped working after 24 (#182).

Formatting is exact rather than approximate: a lifetime is rendered in the
largest unit that divides it evenly, so no reader is told a number that is
merely close to the truth.
"""

MINUTES_PER_HOUR = 60
MINUTES_PER_DAY = 60 * 24


def humanize_minutes(minutes: int) -> str:
    """Describe ``minutes`` in the largest unit that divides it exactly.

    >>> humanize_minutes(1440)
    '1 day'
    >>> humanize_minutes(90)
    '90 minutes'
    >>> humanize_minutes(60)
    '1 hour'
    """
    for size, unit in ((MINUTES_PER_DAY, "day"), (MINUTES_PER_HOUR, "hour")):
        if minutes >= size and minutes % size == 0:
            return _plural(minutes // size, unit)
    return _plural(minutes, "minute")


def _plural(count: int, unit: str) -> str:
    return f"{count} {unit}" if count == 1 else f"{count} {unit}s"
