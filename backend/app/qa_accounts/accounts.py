"""The QA Accounts list and the rule for where they may be seeded (#318).

This is the one tracked file that names each account. It imports nothing that
touches a database, so ``print`` stays fast and quiet.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from sqlalchemy.engine import make_url

from app.core.config import ModeEnum

EMAIL_DOMAIN = "fastapi-rbac.example"

# Loopback names, plus the database container names from this repository's
# dev and test compose files, so the seeder also works inside those stacks.
# Deliberately no bare service name such as "db" or "postgres": a production
# database on a private network is often called that.
LOCAL_DB_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
COMPOSE_DB_HOSTS = frozenset({"fastapi_rbac_db_dev", "fastapi_rbac_db_test"})

# The password is built one character class at a time, so any three adjacent
# characters belong to three different classes. That rules out the policy's
# sequence ("abc", "321") and repeat checks whatever the digest is.
_PASSWORD_CLASSES = (
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#%*-_+=?",
)
_PASSWORD_LENGTH = 20


@dataclass(frozen=True)
class QAAccount:
    """One QA Account. ``id`` is what ``qa.config.yml`` and a QA Plan call it."""

    id: str
    role: str  # the Role.name init_db seeds
    first_name: str
    last_name: str
    purpose: str

    @property
    def email(self) -> str:
        return f"{self.id}@{EMAIL_DOMAIN}"

    @property
    def password(self) -> str:
        return fixture_password(self.id)


ACCOUNTS: tuple[QAAccount, ...] = (
    QAAccount(
        id="admin",
        role="Admin",
        first_name="QA",
        last_name="Admin",
        purpose="holds every permission: manages users, roles, permissions and their groups",
    ),
    QAAccount(
        id="manager",
        role="Manager",
        first_name="QA",
        last_name="Manager",
        purpose="creates, reads and updates users and content; can read roles and permissions only",
    ),
    QAAccount(
        id="user",
        role="User",
        first_name="QA",
        last_name="User",
        purpose="an ordinary user who manages only their own profile",
    ),
)


class QAAccountsError(Exception):
    """A refusal or a precondition the command cannot meet."""


def fixture_password(account_id: str) -> str:
    """A fixed function of the account id: a public fixture, not a secret."""
    digest = hashlib.sha256(f"fastapi_rbac QA Account {account_id}".encode()).digest()
    chars = []
    for i in range(_PASSWORD_LENGTH):
        alphabet = _PASSWORD_CLASSES[i % len(_PASSWORD_CLASSES)]
        chars.append(alphabet[digest[i] % len(alphabet)])
    return "".join(chars)


def select_accounts(account_id: str | None) -> tuple[QAAccount, ...]:
    if account_id is None:
        return ACCOUNTS
    for account in ACCOUNTS:
        if account.id == account_id:
            return (account,)
    known = ", ".join(a.id for a in ACCOUNTS)
    raise QAAccountsError(f"no QA Account {account_id!r}; the accounts are: {known}")


def refusal(*, mode: ModeEnum | str, database_url: str) -> str | None:
    """Why ``seed`` must not write to this database, or None when it may.

    There is no override: no flag or setting lifts a refusal, because an
    override is how fixture accounts with public passwords reach production.
    """
    if ModeEnum(mode) == ModeEnum.production:
        return "MODE is production"
    try:
        url = make_url(database_url)
    except Exception:
        return "the database URL cannot be parsed"
    if url.get_backend_name() == "sqlite":
        return None  # a file on this machine
    host = (url.host or "").strip("[]").lower()
    if not host:
        return "the database URL names no host"
    if host in LOCAL_DB_HOSTS or host.endswith(".localhost") or host in COMPOSE_DB_HOSTS:
        return None
    return f"the database host {host!r} is not local"


def format_account(account: QAAccount) -> str:
    return f"id={account.id} role={account.role} email={account.email} password={account.password}"
