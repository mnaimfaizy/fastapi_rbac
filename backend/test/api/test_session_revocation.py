"""Revocation completes before reissue, on every path that does both (#206).

`/auth/change_password` revoked the old session by *queueing* the allowlist
delete (a FastAPI background task, or a Celery task in production) and then
added the new tokens inline. The queued delete therefore ran after the response
had been written, removing the whole set -- including the tokens the response
had just handed the caller. Both halves were wrong, in opposite directions: the
user was logged out by a successful password change, and the old token stayed
valid for the whole of the request that claimed to revoke it.

The property under test is the ordering, not the end state. A test that only
checked the final allowlist would pass against an implementation that adds
first and deletes afterwards on a different schedule, which is the shape of the
bug.

ADR 0011 records the rename that comes with the fix: the primitive is
`revoke_user_tokens`, it deletes the user's allowlist set, and it is the only
implementation of that deletion left in the tree. `cleanup_expired_tokens`
described garbage collection and hid the revocation mechanism from the people
who then built a second one.

In `test/api/` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

import inspect
from test.utils import get_csrf_token
from typing import Any, Dict, List, Tuple
from uuid import UUID

import pytest
from httpx import AsyncClient, Response

from app.core import security
from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils.token import (
    add_token_to_redis,
    get_valid_tokens,
    revoke_user_tokens,
    token_is_allowlisted,
)

PASSWORD = "TestPassw0rd!47"
NEW_PASSWORD = "ReplacementPassword!42"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


def allowlist_key(user_id: UUID, token_type: TokenType) -> str:
    """Spelled exactly as `app.utils.token` spells it, so a re-key cannot pass."""
    return f"user:{user_id}:{token_type}"


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


@pytest.fixture
def redis_ops(redis_mock: Any) -> List[Tuple[str, str]]:
    """Record (command, key) in call order for the two commands that matter.

    Ordering has to be observed as the endpoint issues it: the end state cannot
    distinguish "delete then add" from "add, then delete, then add".
    """
    recorded: List[Tuple[str, str]] = []

    def recording(command: str, call: Any) -> Any:
        async def wrapper(key: str, *args: Any, **kwargs: Any) -> Any:
            recorded.append((command, key))
            return await call(key, *args, **kwargs)

        return wrapper

    for command in ("sadd", "zadd", "delete"):
        setattr(redis_mock, command, recording(command, getattr(redis_mock, command)))
    return recorded


# --------------------------------------------------------------------------
# The primitive
#
# That it clears the allowlist set is covered by test_token_allowlist.py,
# beside the helpers that write to the same key. What is tested here is the
# shape that makes the ordering guarantee possible.
# --------------------------------------------------------------------------


def test_revocation_has_exactly_one_implementation() -> None:
    """Consolidation is the point: three spellings of one DELETE became one.

    `delete_tokens` was an unused duplicate, `_cleanup_tokens_task` was the
    deferred one and `cleanup_tokens_task` its Celery twin. Any of them
    reappearing means the deferred path is back.
    """
    import app.utils.background_tasks as background_tasks
    import app.utils.token as token_utils
    import app.worker as worker

    assert not hasattr(token_utils, "delete_tokens")
    assert not hasattr(background_tasks, "cleanup_expired_tokens")
    assert not hasattr(background_tasks, "_cleanup_tokens_task")
    assert not hasattr(worker, "cleanup_tokens_task")


def test_revocation_cannot_be_deferred() -> None:
    """No BackgroundTasks parameter means no caller can defer it.

    "Behaviour is identical whether the deferred path would have used
    background tasks or Celery" is met by there being no deferred path: the
    primitive takes a Redis client and awaits the delete.
    """
    parameters = inspect.signature(revoke_user_tokens).parameters

    assert "background_tasks" not in parameters
    assert inspect.iscoroutinefunction(revoke_user_tokens)


# --------------------------------------------------------------------------
# change-password: revoke, then reissue
# --------------------------------------------------------------------------


async def test_change_password_revokes_before_it_reissues(
    client: AsyncClient, user_factory: Any, redis_ops: List[Tuple[str, str]]
) -> None:
    """Every allowlist delete precedes every allowlist add within the request."""
    user = await user_factory.create(email="ordering@example.com", password=PASSWORD, verified=True)
    user_id = user.id  # read before the request; the endpoint's commit expires the instance
    _, headers = await login(client, "ordering@example.com", PASSWORD)

    redis_ops.clear()  # drop the login's own writes; only the change matters
    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    keys = {allowlist_key(user_id, t) for t in (TokenType.ACCESS, TokenType.REFRESH)}
    ordered = [command for command, key in redis_ops if key in keys]
    assert "delete" in ordered, "change-password revoked nothing"
    assert "zadd" in ordered, "change-password allowlisted nothing"

    first_add = ordered.index("zadd")
    last_delete = len(ordered) - 1 - ordered[::-1].index("delete")
    assert last_delete < first_add, f"a revocation ran after the reissue: {ordered}"


async def test_change_password_leaves_the_new_tokens_allowlisted(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """The response has completed here, so any deferred delete has already run."""
    user = await user_factory.create(email="reissue@example.com", password=PASSWORD, verified=True)
    user_id = user.id
    _, headers = await login(client, "reissue@example.com", PASSWORD)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text
    new_access = str(response.json()["data"]["access_token"])

    members = await get_valid_tokens(redis_mock, user_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, new_access) is True

    # The refresh token is returned as an HttpOnly cookie, never in the body,
    # so read it the way a browser would rather than counting set members.
    new_refresh = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    assert new_refresh, "no refresh cookie was set"
    refresh_members = await get_valid_tokens(redis_mock, user_id, TokenType.REFRESH)
    assert token_is_allowlisted(refresh_members, new_refresh) is True
    assert len(refresh_members) == 1, "exactly one session survives a password change"


async def test_change_password_revokes_the_previous_token(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    user = await user_factory.create(email="revoked@example.com", password=PASSWORD, verified=True)
    user_id = user.id
    old_access, headers = await login(client, "revoked@example.com", PASSWORD)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    members = await get_valid_tokens(redis_mock, user_id, TokenType.ACCESS)
    assert token_is_allowlisted(members, old_access) is False


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
    """ "Every previously issued token is gone" includes the reset allowlist.

    RESET is an allowlist type and is the only thing gating a forgot-password
    link. Leaving it behind means an attacker who requested a reset before the
    victim changed their password can still redeem it afterwards.
    """
    user = await user_factory.create(email="pendingreset@example.com", password=PASSWORD, verified=True)
    user_id = user.id
    reset_token = security.create_reset_token("pendingreset@example.com")
    await add_token_to_redis(
        redis_mock,
        user,
        reset_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    _, headers = await login(client, "pendingreset@example.com", PASSWORD)

    response = await post_change_password(client, headers, PASSWORD, NEW_PASSWORD)
    assert response.status_code == 200, response.text

    assert await get_valid_tokens(redis_mock, user_id, TokenType.RESET) == set()
    _, csrf = await get_csrf_token(client)
    redeemed = await client.post(
        auth_url("/password-reset/confirm"),
        json={"token": reset_token, "new_password": "YetAnotherPhrase!91"},
        headers=csrf,
    )
    assert redeemed.status_code != 200, "the stale reset link was still redeemable"


# --------------------------------------------------------------------------
# logout revokes the session, and only the session
# --------------------------------------------------------------------------


async def test_logout_revokes_every_token_for_the_user(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    user = await user_factory.create(email="loggedout@example.com", password=PASSWORD, verified=True)
    user_id = user.id
    _, headers = await login(client, "loggedout@example.com", PASSWORD)

    response = await client.post(auth_url("/logout"), headers=headers)
    assert response.status_code == 200, response.text

    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        assert await get_valid_tokens(redis_mock, user_id, token_type) == set()


async def test_logout_leaves_a_pending_reset_link_alone(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """Logout ends a session; it is not a statement about the account.

    Change-password revokes RESET because knowing the current password
    supersedes any outstanding link. Logging out says nothing of the kind, and
    killing the link there would break a user who requested one, logged out,
    and then opened their email.
    """
    user = await user_factory.create(email="resetkept@example.com", password=PASSWORD, verified=True)
    reset_token = security.create_reset_token("resetkept@example.com")
    await add_token_to_redis(
        redis_mock,
        user,
        reset_token,
        TokenType.RESET,
        settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    )
    user_id = user.id
    _, headers = await login(client, "resetkept@example.com", PASSWORD)

    response = await client.post(auth_url("/logout"), headers=headers)
    assert response.status_code == 200, response.text

    members = await get_valid_tokens(redis_mock, user_id, TokenType.RESET)
    assert token_is_allowlisted(members, reset_token) is True
