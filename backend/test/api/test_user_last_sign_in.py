"""``last_login_at`` on the users list and user read (#454).

Read from audit events (``successful_login``, ``oauth2_successful_login``), as
the dashboard's Recent sign-ins does. A failed login does not count. A user who
never signed in gets null.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

from datetime import datetime, timedelta, timezone
from test.utils import API_TEST_PASSWORD, get_csrf_token, seeded_permission
from typing import Any, Dict, Iterable
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog

PASSWORD = API_TEST_PASSWORD


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


def naive_utc(moment: datetime) -> datetime:
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


async def session_holding(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_names: Iterable[str],
) -> tuple[Dict[str, str], str]:
    """Bearer and CSRF headers for a non-superuser holding ``permission_names``, and their email."""
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
    return {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}, email


def add_event(db: AsyncSession, user_id: UUID, action: str, when: datetime) -> None:
    db.add(
        AuditLog(
            actor_id=user_id,
            action=action,
            resource_type="security_event",
            resource_id=str(user_id),
            timestamp=naive_utc(when),
        )
    )


async def seed_two_users(user_factory: Any, db: AsyncSession) -> tuple[Any, Any, datetime]:
    """User A signed in three ways, then failed once. User B only failed. Returns A, B, A's newest sign-in."""
    tag = uuid4().hex[:8]
    signed_in = await user_factory.create(email=f"signed-in-{tag}@example.com", password=PASSWORD)
    never = await user_factory.create(email=f"never-{tag}@example.com", password=PASSWORD)
    start = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(days=3)
    newest = start + timedelta(hours=5)
    add_event(db, signed_in.id, "successful_login", start)
    add_event(db, signed_in.id, "successful_login", start + timedelta(hours=1))
    add_event(db, signed_in.id, "oauth2_successful_login", newest)
    add_event(db, signed_in.id, "failed_login", newest + timedelta(hours=1))
    add_event(db, never.id, "failed_login", newest + timedelta(hours=2))
    await db.commit()
    return signed_in, never, newest


async def listed_by_email(client: AsyncClient, headers: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
    response = await client.get(url("/users/list?size=100"), headers=headers)
    assert response.status_code == 200, response.text
    return {item["email"]: item for item in response.json()["data"]["items"]}


def parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def test_list_carries_the_newest_sign_in_and_null_for_never_signed_in(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, _ = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])
    signed_in, never, newest = await seed_two_users(user_factory, db)

    items = await listed_by_email(client, headers)

    # The OAuth2 sign-in is the newest and counts. The later failed login does not.
    assert "last_login_at" in items[signed_in.email]
    assert parse(items[signed_in.email]["last_login_at"]) == newest
    assert "last_login_at" in items[never.email]
    assert items[never.email]["last_login_at"] is None


async def test_user_read_carries_last_sign_in(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, _ = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])
    signed_in, never, newest = await seed_two_users(user_factory, db)

    signed = await client.get(url(f"/users/{signed_in.id}"), headers=headers)
    unsigned = await client.get(url(f"/users/{never.id}"), headers=headers)

    assert signed.status_code == 200, signed.text
    assert parse(signed.json()["data"]["last_login_at"]) == newest
    assert unsigned.status_code == 200, unsigned.text
    assert "last_login_at" in unsigned.json()["data"]
    assert unsigned.json()["data"]["last_login_at"] is None


async def test_last_sign_in_is_utc_with_offset(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, _ = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])
    signed_in, _, _ = await seed_two_users(user_factory, db)

    items = await listed_by_email(client, headers)

    raw = items[signed_in.email]["last_login_at"]
    # A bare ISO string would be read as local time by the browser.
    assert raw.endswith("Z") or raw.endswith("+00:00"), raw
    assert parse(raw).utcoffset() == timedelta(0)


async def test_real_login_sets_last_sign_in(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, email = await session_holding(
        client, user_factory, role_factory, permission_factory, ["user.read"]
    )

    items = await listed_by_email(client, headers)

    raw = items[email]["last_login_at"]
    assert raw is not None
    assert abs(datetime.now(timezone.utc) - parse(raw)) < timedelta(minutes=1)


async def test_other_user_responses_do_not_send_last_sign_in(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, _ = await session_holding(client, user_factory, role_factory, permission_factory, ["user.read"])

    me = await client.get(url("/users/me"), headers=headers)

    assert me.status_code == 200, me.text
    assert "last_login_at" not in me.json()["data"]
