"""``python -m app.qa_accounts``: print, seed, or restore the QA Accounts (#318)."""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Sequence

from app.core.config import settings
from app.qa_accounts.accounts import QAAccount, QAAccountsError, format_account, refusal, select_accounts


def _parse(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.qa_accounts",
        description="QA Accounts: public fixture users for local and test environments only.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    print_cmd = sub.add_parser("print", help="print each account's id, role, email and password")
    print_cmd.add_argument("--account", metavar="ID", help="only this account")
    seed_cmd = sub.add_parser("seed", help="create each account, or put back what drifted")
    seed_cmd.add_argument("--account", metavar="ID", help="only this account")
    seed_cmd.add_argument(
        "--restore",
        action="store_true",
        help="return one account to its default state (needs --account) and say what was deleted",
    )
    args = parser.parse_args(argv)
    if getattr(args, "restore", False) and not args.account:
        parser.error("--restore needs --account ID")
    return args


def _report(account_id: str, changes: list[str]) -> None:
    print(f"{account_id}: {'; '.join(changes) if changes else 'unchanged'}", flush=True)


async def _run_seed(accounts: Sequence[QAAccount], *, restore: bool) -> None:
    """Seed each account and report it as soon as it is written.

    Each account commits on its own, so a failure part way says which
    accounts were already written before it stops.
    """
    # Imported here, after the refusal check, so nothing builds an engine or
    # opens a connection to a database the check refused.
    from app.db.session import SessionLocal
    from app.qa_accounts.seeding import seed_account
    from app.utils.password_policy import PasswordRefused
    from app.utils.redis_connection import RedisConnectionFactory

    redis_client = await RedisConnectionFactory.get_client()
    async with SessionLocal() as db_session:
        for account in accounts:
            try:
                changes = await seed_account(account, db_session, redis_client, restore=restore)
            except PasswordRefused as refused:
                raise QAAccountsError(
                    f"{account.id}: the password policy refuses its fixture password: "
                    + "; ".join(refused.errors)
                ) from refused
            except QAAccountsError as error:
                raise QAAccountsError(f"{account.id}: {error}") from error
            _report(account.id, changes)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse(argv)
    try:
        accounts = select_accounts(args.account)
        if args.command == "print":
            for account in accounts:
                print(format_account(account))
            return 0

        reason = refusal(mode=settings.MODE, database_url=str(settings.ASYNC_DATABASE_URI))
        if reason is not None:
            raise QAAccountsError(f"refusing to seed: {reason}. QA Accounts go only into a local database.")
        asyncio.run(_run_seed(accounts, restore=args.restore))
    except QAAccountsError as error:
        print(f"qa_accounts: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
