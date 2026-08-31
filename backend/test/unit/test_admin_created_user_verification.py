"""An admin-created user's verification link has to actually verify them.

``POST /api/v1/users`` mints a verification token and mails it, but never wrote
it to Redis. ``/verify-email`` compares the submitted token against
``verification_token:{user.id}``, whose only writer was the registration and
resend dispatcher -- so the emailed link failed on its first click with
"This verification link is invalid or has expired", and the account it belonged
to could never be verified by its owner.

Dormant under the shipped defaults (``ADMIN_CREATED_USERS_AUTO_VERIFIED`` on,
``ADMIN_CREATED_USERS_SEND_EMAIL`` off) and live for any deployment that flips
them, which is why nothing noticed.

This is API-driven, which ``test/README.md`` assigns to ``integration/``. It
lives here because backend CI runs only ``test/unit/`` (#190), beside the other
account-flow tests kept here for the same reason. The creation half calls the
endpoint function directly rather than through the router: the bug is in what
that endpoint issues, not in who is allowed to call it, and the admin auth
stack would only add setup that cannot fail differently.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from test.utils import get_csrf_token
from typing import Optional
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.v1.endpoints.user import create_user
from app.core.config import settings
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate

PASSWORD = "AdminMadeThis!47"


@pytest.fixture(autouse=True)
def admin_created_users_get_a_verification_email(monkeypatch: pytest.MonkeyPatch) -> None:
    """The configuration under which the mail is sent at all."""
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_AUTO_VERIFIED", False)
    monkeypatch.setattr(settings, "ADMIN_CREATED_USERS_SEND_EMAIL", True)


def emailed_token(tasks: BackgroundTasks) -> Optional[str]:
    """The token as the recipient receives it, out of the queued mail."""
    for task in tasks.tasks:
        context = task.kwargs.get("context") or {}
        if "token" in context:
            return str(context["token"])
    return None


async def admin_creates_user(db: AsyncSession, redis: MockRedisClient, tasks: BackgroundTasks) -> User:
    """Run the admin create-user endpoint the way the router would."""
    new_user = IUserCreate(
        email=f"admin-made-{uuid4().hex[:8]}@example.com",
        password=PASSWORD,
        first_name="Admin",
        last_name="Made",
        role_id=[],
    )
    admin = User(id=uuid4(), email="admin@example.com", first_name="An", last_name="Admin")

    await create_user(
        background_tasks=tasks,
        new_user=new_user,
        db_session=db,
        redis_client=redis,
        current_user=admin,
    )
    return await _reload(db, str(new_user.email))


async def _reload(db: AsyncSession, email: str) -> User:
    from app import crud

    user = await crud.user.get_by_email(db_session=db, email=email)
    assert user is not None
    return user


@pytest.mark.asyncio
async def test_the_emailed_link_verifies_the_account(
    client: AsyncClient, db: AsyncSession, redis_mock: MockRedisClient
) -> None:
    """The whole point: the link in the mail turns an unverified account verified."""
    tasks = BackgroundTasks()
    user = await admin_creates_user(db, redis_mock, tasks)
    token = emailed_token(tasks)
    assert token is not None, "no verification mail was queued"

    _, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/verify-email", json={"token": token}, headers=headers
    )

    assert response.status_code == 200, response.text
    await db.refresh(user)
    assert user.verified is True


@pytest.mark.asyncio
async def test_the_emailed_token_is_the_one_redis_holds(
    db: AsyncSession, redis_mock: MockRedisClient
) -> None:
    """Redis is what /verify-email checks, so the mail must carry that token."""
    tasks = BackgroundTasks()
    user = await admin_creates_user(db, redis_mock, tasks)

    stored = await redis_mock.get(f"verification_token:{user.id}")
    if isinstance(stored, bytes):
        stored = stored.decode()

    assert stored == emailed_token(tasks)
