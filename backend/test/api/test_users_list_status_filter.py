"""``GET /users/list?status=`` narrows the list by account status (#441).

``locked`` uses the dashboard's rule (``is_locked``, ``locked_until`` set and
still in the future), so the Locked accounts card and the filtered list agree.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from datetime import datetime, timedelta, timezone
from test.utils import API_TEST_PASSWORD, get_csrf_token, seeded_permission
from typing import Any, Dict, Iterable
from uuid import uuid4

from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

PASSWORD = API_TEST_PASSWORD


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


def naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def session_holding(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_names: Iterable[str],
) -> Dict[str, str]:
    """Bearer and CSRF headers for a non-superuser whose one role holds ``permission_names``."""
    permissions = [await seeded_permission(permission_factory, name) for name in permission_names]
    role = await role_factory.create(name=f"role-{uuid4().hex[:8]}", permissions=permissions)
    email = f"caller-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, is_superuser=False, roles=[role])

    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}


async def listed_emails(client: AsyncClient, headers: Dict[str, str], query: str = "") -> set[str]:
    response = await client.get(url(f"/users/list?size=100{query}"), headers=headers)
    assert response.status_code == 200, response.text
    return {item["email"] for item in response.json()["data"]["items"]}


async def seed_statuses(user_factory: Any, db: AsyncSession) -> Dict[str, str]:
    """One user per status, and a healthy one. Returns name -> email."""
    tag = uuid4().hex[:8]
    emails = {
        name: f"{name}-{tag}@example.com"
        for name in ("locked", "expired", "windowless", "pending", "disabled", "healthy")
    }
    await user_factory.create_locked(email=emails["locked"], password=PASSWORD)
    expired = await user_factory.create(email=emails["expired"], password=PASSWORD)
    expired.is_locked = True
    expired.locked_until = naive_utc_now() - timedelta(hours=1)
    windowless = await user_factory.create(email=emails["windowless"], password=PASSWORD)
    windowless.is_locked = True
    windowless.locked_until = None
    db.add(expired)
    db.add(windowless)
    await db.commit()
    await user_factory.create(email=emails["pending"], password=PASSWORD, verified=False)
    await user_factory.create(email=emails["disabled"], password=PASSWORD, is_active=False)
    await user_factory.create(email=emails["healthy"], password=PASSWORD)
    return emails


async def test_locked_lists_only_accounts_with_an_open_lock(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])
    emails = await seed_statuses(user_factory, db)
    ours = set(emails.values())

    listed = await listed_emails(client, headers, "&status=locked")

    # An expired lock and a lock with no window are not locked, as on the dashboard.
    assert listed & ours == {emails["locked"]}


async def test_pending_and_disabled_list_their_accounts(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])
    emails = await seed_statuses(user_factory, db)
    ours = set(emails.values())

    assert await listed_emails(client, headers, "&status=pending") & ours == {emails["pending"]}
    assert await listed_emails(client, headers, "&status=disabled") & ours == {emails["disabled"]}


async def test_no_status_lists_everyone(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])
    emails = await seed_statuses(user_factory, db)

    listed = await listed_emails(client, headers)

    assert set(emails.values()) <= listed


async def test_an_unknown_status_is_refused(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])

    response = await client.get(url("/users/list?status=banned"), headers=headers)

    assert response.status_code == 422, response.text


async def test_the_status_filter_still_needs_user_read(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers = await session_holding(client, user_factory, role_factory, permission_factory, ["user.create"])

    response = await client.get(url("/users/list?status=locked"), headers=headers)

    assert response.status_code == 403, response.text
