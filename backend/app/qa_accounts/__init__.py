"""QA Accounts: one signed-in fixture user per role, for agent-run and remote QA (#318).

Run from ``backend/``::

    python -m app.qa_accounts print [--account ID]
    python -m app.qa_accounts seed [--account ID]
    python -m app.qa_accounts seed --restore --account ID

The values below are public fixtures, not secrets. Each password is derived
from the account id by code in this file, so it is the same on every machine
and anyone with the repository can compute it. That is why ``seed`` writes
only to a local database (see :func:`refusal`), and why nothing here reads a
value from ``.env``.

Emails use the ``.example`` TLD, which RFC 2606 reserves, so they cannot
resolve or reach a real mailbox. The issue asked for ``.test``, but the
app's ``EmailStr`` (email-validator) refuses ``.test`` as a special-use name,
which would block both seeding and sign-in for these addresses.

``app.db.init_db`` is separate and unchanged: it seeds the roles these
accounts hold, so run ``app/initial_data.py`` (the dev container does on
start) before ``seed``.
"""
