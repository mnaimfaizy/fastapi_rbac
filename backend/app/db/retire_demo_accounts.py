"""``python -m app.db.retire_demo_accounts``: deactivate demo accounts left in a production database.

Releases up to v0.4.0-beta seeded the Manager and User demo accounts
(``init_db.DEMO_ACCOUNT_EMAILS``) in every mode. Production no longer seeds
them, but start-up never changes existing users, so a database created by an
earlier release may still hold them. This one-off, opt-in command deactivates
each one that exists through the disable operation, which ends its sessions
and revokes its pending emailed links.
It deletes nothing, so an account's history and audit rows stay. Running it
again changes nothing. It runs only when MODE is production, because
development and tests sign in as these accounts.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Sequence

from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.config import ModeEnum, settings
from app.db.init_db import DEMO_ACCOUNT_EMAILS
from app.utils.account_disable import disable_user


async def retire_demo_accounts(
    db_session: AsyncSession,
    redis_client: Redis,
    *,
    emails: Sequence[str] = DEMO_ACCOUNT_EMAILS,
) -> list[str]:
    """Deactivate each account in ``emails``. Returns one ``"<email>: <outcome>"`` line per address."""
    report: list[str] = []
    for email in emails:
        user = await crud.user.get_by_email(email=email, db_session=db_session)
        if user is None:
            report.append(f"{email}: not present")
            continue
        if user.is_superuser:
            # FIRST_SUPERUSER_EMAIL may have been set to a demo address.
            report.append(f"{email}: skipped, it is a superuser")
            continue
        outcome = "deactivated" if user.is_active else "already inactive"
        # Deactivation goes through disable_user. An account that is already
        # inactive still loses a session or link a direct edit left behind,
        # and does not gain a second audit row.
        await disable_user(user, actor=None, db_session=db_session, redis_client=redis_client)
        report.append(f"{email}: {outcome}")
    return report


async def _run() -> list[str]:
    # Imported here, after the mode check, so a refused run opens no connection.
    from app.db.session import SessionLocal
    from app.utils.redis_connection import RedisConnectionFactory

    redis_client = await RedisConnectionFactory.get_client()
    async with SessionLocal() as db_session:
        return await retire_demo_accounts(db_session, redis_client)


def _print(report: Sequence[str]) -> None:
    for line in report:
        print(line, flush=True)


def main(argv: Sequence[str] | None = None) -> int:
    argparse.ArgumentParser(
        prog="python -m app.db.retire_demo_accounts",
        description=(
            "Deactivate the demo accounts (" + ", ".join(DEMO_ACCOUNT_EMAILS) + ") that releases "
            "up to v0.4.0-beta seeded in production. Deletes nothing; safe to run again."
        ),
    ).parse_args(argv)
    if settings.MODE != ModeEnum.production:
        print(
            f"retire_demo_accounts: refusing to run: MODE is {settings.MODE.value}. It runs only in "
            "production; development and tests sign in as the demo accounts.",
            file=sys.stderr,
        )
        return 1
    _print(asyncio.run(_run()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
