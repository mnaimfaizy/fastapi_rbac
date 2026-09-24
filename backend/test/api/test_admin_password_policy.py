"""Admin-set passwords go through the same policy as self-service (#198, #271).

``enforce_password_complexity`` once had four callers, all in ``auth.py``. An
administrator could set a password every self-service path then refused, and
the user was stuck: they could not change it to the value they were given.
Admin set was also the path missed twice when the policy changed: it wrote no
success or reuse audit event and surfaced the reuse refusal as a bare string.

Admin create and admin update now call ``app.utils.password_policy`` like
every other path. What each outcome does to the account and the audit log is
asserted once, through that module, in ``test/unit/test_password_change.py``.
Here each route gets one test per outcome class and asserts status and body
only. Bulk update refuses a ``password`` key outright -- applying one password
to many users is the wrong operation even when the value is strong.
"""

from test.utils import get_csrf_token
from typing import Any, Dict
from uuid import uuid4

from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api.v1.endpoints.user import bulk_update_users
from app.core.config import settings
from app.core.security import PasswordValidator
from app.models.user_model import User
from app.utils.password_policy import PASSWORD_COMPLEXITY_FAILURE_MESSAGE

# Satisfies every rule in settings. Shared with the self-service policy tests.
ACCEPTED_PASSWORD = "QaRegisterPass!47"
NEW_PASSWORD = "ReplacementPassword!42"
REJECTED_PASSWORD = "password"


def users_url(path: str = "") -> str:
    return f"{settings.API_V1_STR}/users{path}"


def rules_refusal(password: str) -> Dict[str, Any]:
    _, errors = PasswordValidator.validate_complexity(password)
    return {"detail": {"message": PASSWORD_COMPLEXITY_FAILURE_MESSAGE, "errors": errors}}


async def admin_headers(client: AsyncClient, user_factory: Any) -> Dict[str, str]:
    email = f"admin-{uuid4().hex[:8]}@example.com"
    await user_factory.create(email=email, password=ACCEPTED_PASSWORD, verified=True, is_superuser=True)
    _, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": email, "password": ACCEPTED_PASSWORD},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return {**headers, "Authorization": f"Bearer {response.json()['data']['access_token']}"}


async def post_user(client: AsyncClient, headers: Dict[str, str], email: str, password: str) -> Any:
    return await client.post(
        users_url(),
        json={
            "email": email,
            "password": password,
            "first_name": "Admin",
            "last_name": "Made",
            "role_id": [],
        },
        headers=headers,
    )


async def put_password(client: AsyncClient, headers: Dict[str, str], user_id: Any, password: str) -> Any:
    return await client.put(users_url(f"/{user_id}"), json={"password": password}, headers=headers)


# --------------------------------------------------------------------------
# Admin create
# --------------------------------------------------------------------------


async def test_admin_create_rules_refused(client: AsyncClient, user_factory: Any) -> None:
    headers = await admin_headers(client, user_factory)

    response = await post_user(client, headers, "weak@example.com", REJECTED_PASSWORD)

    assert response.status_code == 400, response.text
    assert response.json() == rules_refusal(REJECTED_PASSWORD)


async def test_rejected_admin_create_creates_no_user(client: AsyncClient, db: Any, user_factory: Any) -> None:
    """The refusal must land before the row is written."""
    headers = await admin_headers(client, user_factory)
    email = "no-row@example.com"

    response = await post_user(client, headers, email, REJECTED_PASSWORD)
    assert response.status_code == 400

    db.expunge_all()
    assert await crud.user.get_by_email(db_session=db, email=email) is None


async def test_admin_create_succeeded(client: AsyncClient, user_factory: Any) -> None:
    headers = await admin_headers(client, user_factory)

    response = await post_user(client, headers, "strong@example.com", ACCEPTED_PASSWORD)

    assert response.status_code == 201, response.text
    assert response.json()["data"]["email"] == "strong@example.com"


# --------------------------------------------------------------------------
# Admin update
# --------------------------------------------------------------------------


async def test_admin_update_rules_refused(client: AsyncClient, user_factory: Any) -> None:
    target = await user_factory.create(password=ACCEPTED_PASSWORD, verified=True)
    headers = await admin_headers(client, user_factory)

    response = await put_password(client, headers, target.id, REJECTED_PASSWORD)

    assert response.status_code == 400, response.text
    assert response.json() == rules_refusal(REJECTED_PASSWORD)


async def test_admin_update_reuse_refused(client: AsyncClient, user_factory: Any) -> None:
    """The same body as every other path, not ``str(ValueError)``."""
    target = await user_factory.create(password=ACCEPTED_PASSWORD, verified=True)
    headers = await admin_headers(client, user_factory)

    response = await put_password(client, headers, target.id, ACCEPTED_PASSWORD)

    message = "New password must be different from your current password."
    assert response.status_code == 400, response.text
    assert response.json() == {"detail": {"message": message, "errors": [message]}}


async def test_admin_update_succeeded(client: AsyncClient, user_factory: Any) -> None:
    target = await user_factory.create(
        password=ACCEPTED_PASSWORD, verified=True, needs_to_change_password=False
    )
    headers = await admin_headers(client, user_factory)

    response = await put_password(client, headers, target.id, NEW_PASSWORD)

    assert response.status_code == 200, response.text
    # A temporary password: the user is flagged to change it (#271).
    assert response.json()["data"]["needs_to_change_password"] is True


# --------------------------------------------------------------------------
# Bulk update refuses a password key rather than applying one
# --------------------------------------------------------------------------


async def test_bulk_update_rejects_a_password_key(client: AsyncClient, user_factory: Any) -> None:
    """One password for many users is refused, even when the value is strong."""
    target = await user_factory.create(password=ACCEPTED_PASSWORD)
    headers = await admin_headers(client, user_factory)

    response = await client.put(
        users_url("/bulk-update"),
        json={
            "user_ids": [str(target.id)],
            "updates": {"password": ACCEPTED_PASSWORD, "first_name": "Changed"},
        },
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert response.json() == {
        "detail": "Password cannot be changed via bulk update. Update each user individually."
    }


async def test_bulk_update_without_a_password_key_succeeds(db: AsyncSession, user_factory: Any) -> None:
    """Refusing ``password`` must not break the fields bulk update is for.

    Called directly with UUID ids: over HTTP the route answers 500 for any
    update because the JSON ids reach the UUID column as strings, a separate
    defect this test does not cover.
    """
    target = await user_factory.create(password=ACCEPTED_PASSWORD, first_name="Before")

    response = await bulk_update_users(
        bulk_update={"user_ids": [target.id], "updates": {"first_name": "After"}},
        db_session=db,
        current_user=User(id=uuid4(), email="admin@example.com"),
    )

    assert response.message == "Bulk update successful"
    assert [user["first_name"] for user in response.data] == ["After"]
