"""Dashboard metrics follow the caller's permissions (#421, absorbs #405).

Locked users, role distribution and the last 10 sign-in audit events
(``successful_login`` and ``oauth2_successful_login``) replace the
``active_sessions`` placeholder. A caller who lacks a
permission gets null for that metric, not a zero and not a 403.

In ``test/api/`` because these boot the app in-process: see
`ADR 0012 <../../../docs/adr/0012-test-suites-split-by-environment.md>`_.
"""

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from test.utils import API_TEST_PASSWORD, get_csrf_token, seeded_permission
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.v1.endpoints.dashboard import _ALL_METRICS
from app.core.config import settings
from app.dashboard_metrics import SIGN_IN_ACTIONS
from app.models.audit_log_model import AuditLog

PASSWORD = API_TEST_PASSWORD


def url(path: str) -> str:
    return f"{settings.API_V1_STR}{path}"


def naive_utc(value: datetime | None = None) -> datetime:
    current = value or datetime.now(timezone.utc)
    if current.tzinfo is not None:
        current = current.astimezone(timezone.utc)
    return current.replace(tzinfo=None)


async def sign_in_holding(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    permission_names: list[str],
    *,
    superuser: bool = False,
) -> tuple[dict[str, str], str]:
    """Bearer headers and email for a caller whose one role holds ``permission_names``."""
    permissions = [await seeded_permission(permission_factory, name) for name in permission_names]
    role = await role_factory.create(name=f"role-{uuid4().hex[:8]}", permissions=permissions)
    email = f"dash-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=PASSWORD, is_superuser=superuser, roles=[role])
    _, headers = await get_csrf_token(client)
    login = await client.post(
        url("/auth/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert login.status_code == 200, login.text
    _, headers = await get_csrf_token(client)
    return {**headers, "Authorization": f"Bearer {login.json()['data']['access_token']}"}, email


async def dashboard(client: AsyncClient, headers: dict[str, str], path: str = "/dashboard") -> dict[str, Any]:
    response = await client.get(url(path), headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def test_metrics_follow_permissions_and_drop_the_session_placeholder(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
    role_group_factory: Any,
) -> None:
    """Each metric is present only for the permission that owns it, and the counts are real."""
    headers, _email = await sign_in_holding(
        client,
        user_factory,
        role_factory,
        permission_factory,
        ["user.read", "role.read", "permission.read", "role_group.read", "permission_group.read"],
    )
    before = await dashboard(client, headers)
    stats = before["stats"]
    assert "active_sessions" not in stats
    assert "recent_logins" not in before
    assert "system_users_summary" not in before
    assert isinstance(stats["total_users"], int)
    assert isinstance(stats["active_users"], int)
    assert isinstance(stats["locked_users"], int)
    assert isinstance(stats["total_roles"], int)
    assert isinstance(stats["total_role_groups"], int)
    assert isinstance(stats["total_permissions"], int)
    assert isinstance(stats["total_permission_groups"], int)
    assert isinstance(before["role_distribution"], list)
    assert isinstance(before["recent_sign_ins"], list)

    await user_factory.create(
        email=f"active-{uuid4().hex[:8]}@example.com", password=PASSWORD, is_active=True
    )
    await user_factory.create(email=f"idle-{uuid4().hex[:8]}@example.com", password=PASSWORD, is_active=False)
    await user_factory.create_locked(email=f"locked-{uuid4().hex[:8]}@example.com", password=PASSWORD)
    expired = await user_factory.create(email=f"expired-{uuid4().hex[:8]}@example.com", password=PASSWORD)
    expired.is_locked = True
    expired.locked_until = naive_utc() - timedelta(hours=1)
    open_lock = await user_factory.create(email=f"open-{uuid4().hex[:8]}@example.com", password=PASSWORD)
    open_lock.is_locked = True
    open_lock.locked_until = None
    db.add(expired)
    db.add(open_lock)
    await role_factory.create(name=f"extra-role-{uuid4().hex[:8]}")
    await role_group_factory.create(name=f"extra-group-{uuid4().hex[:8]}")
    await permission_factory.create(name=f"extra.perm.{uuid4().hex[:8]}")
    await db.commit()

    after = (await dashboard(client, headers))["stats"]
    assert after["total_users"] == stats["total_users"] + 5
    assert after["active_users"] == stats["active_users"] + 4
    assert after["locked_users"] == stats["locked_users"] + 1
    assert after["total_roles"] == stats["total_roles"] + 1
    assert after["total_role_groups"] == stats["total_role_groups"] + 1
    assert after["total_permissions"] == stats["total_permissions"] + 1
    assert after["total_permission_groups"] == stats["total_permission_groups"] + 1


async def test_role_distribution_counts_a_user_once_per_role(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, _email = await sign_in_holding(
        client, user_factory, role_factory, permission_factory, ["role.read"]
    )
    alpha = await role_factory.create(name=f"Alpha-{uuid4().hex[:8]}")
    beta = await role_factory.create(name=f"Beta-{uuid4().hex[:8]}")
    await user_factory.create(
        email=f"both-{uuid4().hex[:8]}@example.com", password=PASSWORD, roles=[alpha, beta]
    )
    await user_factory.create(email=f"alpha-{uuid4().hex[:8]}@example.com", password=PASSWORD, roles=[alpha])

    counts = {row["name"]: row["count"] for row in (await dashboard(client, headers))["role_distribution"]}

    assert counts[alpha.name] == 2
    assert counts[beta.name] == 1


async def test_recent_sign_ins_are_the_last_ten_password_and_oauth2_logins(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, caller = await sign_in_holding(
        client, user_factory, role_factory, permission_factory, ["user.read"]
    )
    start = naive_utc() + timedelta(minutes=5)
    signed_in: list[tuple[str, datetime]] = []
    for offset in range(1, 13):
        email = f"signin-{offset}-{uuid4().hex[:6]}@example.com"
        person = await user_factory.create(
            email=email, password=PASSWORD, first_name="Sign", last_name=f"In{offset}"
        )
        when = start + timedelta(minutes=offset)
        signed_in.append((email, when))
        db.add(
            AuditLog(
                actor_id=person.id,
                action="successful_login",
                resource_type="security_event",
                resource_id=str(person.id),
                details={},
                timestamp=when,
            )
        )
    noise = await user_factory.create(email=f"noise-{uuid4().hex[:8]}@example.com", password=PASSWORD)
    newest = start + timedelta(days=1)
    db.add(
        AuditLog(
            actor_id=noise.id,
            action="failed_login",
            resource_type="security_event",
            resource_id=str(noise.id),
            details={},
            timestamp=newest,
        )
    )
    oauth_person = await user_factory.create(
        email=f"oauth-{uuid4().hex[:8]}@example.com",
        password=PASSWORD,
        first_name="Oauth",
        last_name="Person",
    )
    db.add(
        AuditLog(
            actor_id=oauth_person.id,
            action="oauth2_successful_login",
            resource_type="security_event",
            resource_id=str(oauth_person.id),
            details={},
            timestamp=newest + timedelta(minutes=1),
        )
    )
    await db.commit()

    rows = (await dashboard(client, headers))["recent_sign_ins"]

    # The OAuth2 sign-in is the newest, so it leads; nine password sign-ins follow.
    assert [row["email"] for row in rows] == [oauth_person.email] + [
        email for email, _when in reversed(signed_in[-9:])
    ]
    assert len(rows) == 10
    assert caller not in [row["email"] for row in rows]
    assert noise.email not in [row["email"] for row in rows]
    assert rows[0]["name"] == "Oauth Person"
    assert rows[1]["name"] == "Sign In12"
    first_at = datetime.fromisoformat(rows[0]["signed_in_at"].replace("Z", "+00:00"))
    second_at = datetime.fromisoformat(rows[1]["signed_in_at"].replace("Z", "+00:00"))
    assert first_at > second_at


async def test_a_caller_without_a_permission_gets_null_not_zero(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    user_headers, _email = await sign_in_holding(
        client, user_factory, role_factory, permission_factory, ["user.read"]
    )
    user_data = await dashboard(client, user_headers)
    assert isinstance(user_data["stats"]["total_users"], int)
    assert isinstance(user_data["stats"]["locked_users"], int)
    assert isinstance(user_data["recent_sign_ins"], list)
    assert user_data["stats"]["total_roles"] is None
    assert user_data["stats"]["total_permissions"] is None
    assert user_data["role_distribution"] is None

    role_headers, _email = await sign_in_holding(
        client, user_factory, role_factory, permission_factory, ["role.read"]
    )
    role_data = await dashboard(client, role_headers)
    assert isinstance(role_data["role_distribution"], list)
    assert isinstance(role_data["stats"]["total_roles"], int)
    assert role_data["stats"]["total_role_groups"] is None
    assert role_data["stats"]["total_users"] is None
    assert role_data["stats"]["locked_users"] is None
    assert role_data["recent_sign_ins"] is None

    plain_headers, _email = await sign_in_holding(client, user_factory, role_factory, permission_factory, [])
    plain = await dashboard(client, plain_headers)
    assert plain["stats"] == {
        "total_users": None,
        "active_users": None,
        "total_roles": None,
        "total_role_groups": None,
        "total_permissions": None,
        "total_permission_groups": None,
        "locked_users": None,
    }
    assert plain["role_distribution"] is None
    assert plain["recent_sign_ins"] is None


async def test_stats_alias_uses_permissions_for_a_non_admin(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, _email = await sign_in_holding(
        client, user_factory, role_factory, permission_factory, ["user.read"]
    )

    data = await dashboard(client, headers, "/dashboard/stats")

    assert isinstance(data["stats"]["total_users"], int)
    assert data["stats"]["total_roles"] is None
    assert "active_sessions" not in data["stats"]


async def test_superuser_receives_every_metric(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    headers, email = await sign_in_holding(
        client, user_factory, role_factory, permission_factory, [], superuser=True
    )

    data = await dashboard(client, headers)

    assert isinstance(data["stats"]["total_users"], int)
    assert isinstance(data["stats"]["locked_users"], int)
    assert isinstance(data["stats"]["total_roles"], int)
    assert isinstance(data["stats"]["total_permissions"], int)
    assert isinstance(data["role_distribution"], list)
    assert email in [row["email"] for row in data["recent_sign_ins"]]


# docs/reference/api/dashboard.md is hand-written. These tests hold its
# permission table and its list of sign-in actions to the code, so a renamed
# permission, a moved field or a new sign-in action fails here instead of
# drifting the page. The docs folder is absent when only backend/ is copied
# (the test image), so they skip there.
DASHBOARD_DOC = Path(__file__).resolve().parents[3] / "docs" / "reference" / "api" / "dashboard.md"
needs_doc = pytest.mark.skipif(not DASHBOARD_DOC.is_file(), reason="docs/ is not in this checkout")


def documented_permission_fields() -> dict[str, set[str]]:
    """The 'Which permission fills which field' table: permission -> field paths."""
    text = DASHBOARD_DOC.read_text(encoding="utf-8")
    section = text.split("**Which permission fills which field:**", 1)[1]
    table: dict[str, set[str]] = {}
    for line in section.splitlines()[1:]:
        if not line.strip():
            if table:
                break
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 2 or set(cells[0]) <= {"-", " ", ":"}:
            continue
        names = re.findall(r"`([^`]+)`", cells[0])
        if not names:
            continue
        table[names[0]] = set(re.findall(r"`([^`]+)`", cells[1]))
    return table


def documented_sign_in_actions() -> set[str]:
    text = DASHBOARD_DOC.read_text(encoding="utf-8")
    bullet = next(line for line in text.splitlines() if "A sign-in is" in line)
    return {name for name in re.findall(r"`([a-z0-9_]+)`", bullet) if name.endswith("_login")}


def non_null_fields(data: dict[str, Any]) -> set[str]:
    fields = {f"stats.{name}" for name, value in data["stats"].items() if value is not None}
    fields |= {name for name, value in data.items() if name != "stats" and value is not None}
    return fields


@needs_doc
def test_dashboard_doc_lists_every_metric_permission() -> None:
    assert set(documented_permission_fields()) == _ALL_METRICS


@needs_doc
def test_dashboard_doc_names_the_sign_in_actions() -> None:
    assert documented_sign_in_actions() == set(SIGN_IN_ACTIONS)


@needs_doc
async def test_dashboard_doc_table_matches_the_fields_each_permission_fills(
    client: AsyncClient,
    user_factory: Any,
    role_factory: Any,
    permission_factory: Any,
) -> None:
    table = documented_permission_fields()
    assert table, "the permission table was not found in dashboard.md"
    for permission, fields in sorted(table.items()):
        headers, _email = await sign_in_holding(
            client, user_factory, role_factory, permission_factory, [permission]
        )
        data = await dashboard(client, headers)
        assert non_null_fields(data) == fields, f"{permission}: the doc table and the API disagree"
