"""Revocation completes before reissue, on every path that does both (#206).

`/auth/change_password` revoked the old session by *queueing* the allowlist
delete (a FastAPI background task, or a Celery task in production) and then
added the new tokens inline. The queued delete therefore ran after the response
had been written, removing the whole set -- including the tokens the response
had just handed the caller. Both halves were wrong, in opposite directions: the
user was logged out by a successful password change, and the old token stayed
valid for the whole of the request that claimed to revoke it.

Since #271 the revocation half runs inside ``password_policy.change_password``,
before its commit, and reissuing stays in the handler through
``sessions.open``. What the policy module revokes is asserted in
``test/unit/test_password_change.py``; what is tested here is that the
session the handler hands back is the one that survives. A revocation that ran
after the reissue, on any schedule, would leave the new tokens refused, so the
outcome is read back the way a client sees it: through ``accepts`` and
``refresh``, never the allowlist's keys.

ADR 0011 records the rename that comes with the fix: the primitive deletes the
user's allowlist set, and it is the only implementation of that deletion left
in the tree. `cleanup_expired_tokens` described garbage collection and hid the
revocation mechanism from the people who then built a second one. Callers now
reach it as ``sessions.end_all`` (#279).

In `test/api/` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

import inspect
from test.utils import get_csrf_token
from typing import Any, Dict, Optional, Tuple

from httpx import AsyncClient, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.utils import emailed_links, sessions
from app.utils.account_token_responses import INVALID_PASSWORD_RESET_TOKEN_MESSAGE
from app.utils.emailed_links import LinkKind
from app.utils.sessions import SessionRejected

PASSWORD = "TestPassw0rd!47"
NEW_PASSWORD = "ReplacementPassword!42"
# The client address httpx's ASGI transport gives every in-process request,
# so a refresh from here matches the origin the login recorded.
ASGI_CLIENT = "127.0.0.1"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def accepted(redis_mock: Any, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis_mock)
    except SessionRejected:
        return False
    return True


async def refreshes(db: AsyncSession, redis_mock: Any, refresh_token: Optional[str]) -> bool:
    assert refresh_token, "no refresh cookie was set"
    try:
        await sessions.refresh(refresh_token, ASGI_CLIENT, db_session=db, redis_client=redis_mock)
    except SessionRejected:
        return False
    return True


async def login(client: AsyncClient, email: str, password: str) -> Tuple[str, Dict[str, str]]:
    """Return the issued access token and headers carrying it plus CSRF."""
    _, headers = await get_csrf_token(client)
    response = await client.post(
        auth_url("/login"),
        json={"email": email, "password": password},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    token = str(response.json()["data"]["access_token"])
    return token, {**headers, "Authorization": f"Bearer {token}"}


async def post_change_password(
    client: AsyncClient, headers: Dict[str, str], current_password: str, new_password: str
) -> Response:
    return await client.post(
        auth_url("/change_password"),
        json={"current_password": current_password, "new_password": new_password},
        headers=headers,
    )


# --------------------------------------------------------------------------
# The primitive
#
# That it ends every session is covered by test_token_allowlist.py and
# test_sessions.py. What is tested here is the shape that makes the ordering
# guarantee possible.
# --------------------------------------------------------------------------


def test_revocation_has_exactly_one_implementation() -> None:
    """Consolidation is the point: three spellings of one DELETE became one.

    `delete_tokens` was an unused duplicate, `_cleanup_tokens_task` was the
    deferred one and `cleanup_tokens_task` its Celery twin. Any of them
    reappearing means the deferred path is back.
    """
    import app.utils.allowlist as allowlist
    import app.utils.background_tasks as background_tasks
    import app.worker as worker

    assert not hasattr(allowlist, "delete_tokens")
    assert not hasattr(background_tasks, "cleanup_expired_tokens")
    assert not hasattr(background_tasks, "_cleanup_tokens_task")
    assert not hasattr(worker, "cleanup_tokens_task")


def test_revocation_cannot_be_deferred() -> None:
    """No BackgroundTasks parameter means no caller can defer it.

    "Behaviour is identical whether the deferred path would have used
    background tasks or Celery" is met by there being no deferred path:
    ``end_all`` takes a Redis client and awaits the delete.
    """
    parameters = inspect.signature(sessions.end_all).parameters

    assert "background_tasks" not in parameters
    assert inspect.iscoroutinefunction(sessions.end_all)


# --------------------------------------------------------------------------
# change-password: revoke, then reissue
# --------------------------------------------------------------------------


async def test_change_password_hands_back_the_one_session_that_survives(
    client: AsyncClient, user_factory: Any, redis_mock: Any, db: AsyncSession
) -> None:
    """The response has completed here, so any deferred delete has already run.

    Had a revocation run after the reissue, the new tokens would be refused
    too; had it not run at all, the other device's session would still work.
    """
    await user_factory.create(email="reissue@example.com", password=PASSWORD, verified=True)
    other_access, _ = await login(client, "reissue@example.com", PASSWORD)
    other_refresh = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    old_access, headers = await login(client, "reissue@example.com", PASSWORD)
    old_refresh = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text
    new_access = str(response.json()["data"]["access_token"])
    # The refresh token is returned as an HttpOnly cookie, never in the body,
    # so read it the way a browser would.
    new_refresh = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

    assert await accepted(redis_mock, new_access) is True
    assert await refreshes(db, redis_mock, new_refresh) is True
    for access_token in (old_access, other_access):
        assert await accepted(redis_mock, access_token) is False
    for refresh_token in (old_refresh, other_refresh):
        assert await refreshes(db, redis_mock, refresh_token) is False


async def test_new_token_authenticates_immediately_after_change_password(
    client: AsyncClient, user_factory: Any
) -> None:
    """The symptom users reported: logged out by a successful password change."""
    await user_factory.create(email="stillin@example.com", password=PASSWORD, verified=True)
    _, headers = await login(client, "stillin@example.com", PASSWORD)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text
    new_access = str(response.json()["data"]["access_token"])

    me = await client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={**headers, "Authorization": f"Bearer {new_access}"},
    )
    assert me.status_code == 200, me.text


async def test_old_token_is_rejected_immediately_after_change_password(
    client: AsyncClient, user_factory: Any
) -> None:
    await user_factory.create(email="oldout@example.com", password=PASSWORD, verified=True)
    _, headers = await login(client, "oldout@example.com", PASSWORD)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    me = await client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert me.status_code in (401, 403), me.text


async def test_change_password_revokes_a_pending_reset_link(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """ "Every previously issued token is gone" includes a pending reset link.

    The stored reset link is the only thing gating a forgot-password link.
    Leaving it behind means an attacker who requested a reset before the
    victim changed their password can still redeem it afterwards. What the
    policy module revokes is asserted in ``test/unit/test_password_change.py``;
    this is the route-level outcome.
    """
    user = await user_factory.create(email="pendingreset@example.com", password=PASSWORD, verified=True)
    reset_token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    _, headers = await login(client, "pendingreset@example.com", PASSWORD)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    _, csrf = await get_csrf_token(client)
    redeemed = await client.post(
        auth_url("/password-reset/confirm"),
        json={"token": reset_token, "new_password": "YetAnotherPhrase!91"},
        headers=csrf,
    )
    assert redeemed.status_code == 400, "the stale reset link was still redeemable"
    assert redeemed.json() == {"detail": INVALID_PASSWORD_RESET_TOKEN_MESSAGE}


# --------------------------------------------------------------------------
# logout ends one session; logout/all ends every session
# --------------------------------------------------------------------------


async def test_logout_revokes_only_the_calling_session(
    client: AsyncClient, user_factory: Any, redis_mock: Any, db: AsyncSession
) -> None:
    await user_factory.create(email="loggedout@example.com", password=PASSWORD, verified=True)
    access_a, _headers_a = await login(client, "loggedout@example.com", PASSWORD)
    refresh_a = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    access_b, headers_b = await login(client, "loggedout@example.com", PASSWORD)
    refresh_b = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

    response = await client.post(auth_url("/logout"), headers=headers_b)
    assert response.status_code == 200, response.text

    assert await accepted(redis_mock, access_b) is False
    assert await refreshes(db, redis_mock, refresh_b) is False
    assert await accepted(redis_mock, access_a) is True
    assert await refreshes(db, redis_mock, refresh_a) is True


async def test_logout_leaves_a_pending_reset_link_alone(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """Logout ends a session; it is not a statement about the account.

    Change-password revokes the reset link because knowing the current
    password supersedes any outstanding link. Logging out says nothing of the
    kind, and killing the link there would break a user who requested one,
    logged out, and then opened their email.
    """
    user = await user_factory.create(email="resetkept@example.com", password=PASSWORD, verified=True)
    reset_token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    _, headers = await login(client, "resetkept@example.com", PASSWORD)

    response = await client.post(auth_url("/logout"), headers=headers)
    assert response.status_code == 200, response.text

    _, csrf = await get_csrf_token(client)
    redeemed = await client.post(
        auth_url("/password-reset/confirm"),
        json={"token": reset_token, "new_password": NEW_PASSWORD},
        headers=csrf,
    )
    assert redeemed.status_code == 200, redeemed.text


async def test_logout_all_revokes_every_session(
    client: AsyncClient, user_factory: Any, redis_mock: Any, db: AsyncSession
) -> None:
    await user_factory.create(email="logoutall@example.com", password=PASSWORD, verified=True)
    access_a, _ = await login(client, "logoutall@example.com", PASSWORD)
    refresh_a = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    access_b, headers = await login(client, "logoutall@example.com", PASSWORD)
    refresh_b = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)

    response = await client.post(auth_url("/logout/all"), headers=headers)
    assert response.status_code == 200, response.text

    for access_token in (access_a, access_b):
        assert await accepted(redis_mock, access_token) is False
    for refresh_token in (refresh_a, refresh_b):
        assert await refreshes(db, redis_mock, refresh_token) is False


async def test_logout_all_revokes_a_pending_reset_link(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """Signing out everywhere still ends a pending reset link, as it did while
    reset links lived in the allowlist (#283)."""
    user = await user_factory.create(email="logoutallreset@example.com", password=PASSWORD, verified=True)
    reset_token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    _, headers = await login(client, "logoutallreset@example.com", PASSWORD)

    response = await client.post(auth_url("/logout/all"), headers=headers)
    assert response.status_code == 200, response.text

    _, csrf = await get_csrf_token(client)
    redeemed = await client.post(
        auth_url("/password-reset/confirm"),
        json={"token": reset_token, "new_password": NEW_PASSWORD},
        headers=csrf,
    )
    assert redeemed.status_code == 400, "logout/all left the reset link redeemable"
    assert redeemed.json() == {"detail": INVALID_PASSWORD_RESET_TOKEN_MESSAGE}
