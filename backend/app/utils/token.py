import hashlib
import json
import time
from datetime import timedelta
from uuid import UUID

from redis.asyncio import Redis

from app.core.config import settings
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.origin_network import is_different_network

# The types the allowlist actually holds under ``user:{id}:{token_type}``.
# TokenType.VERIFICATION is deliberately absent: email verification stores a
# single token under ``verification_token:{id}``, a different key shape that
# these helpers do not reach.
ALLOWLIST_TOKEN_TYPES = (TokenType.ACCESS, TokenType.REFRESH, TokenType.RESET)


def session_id_for(refresh_token: str) -> str:
    """Stable id for one session (a refresh token and the access tokens derived from it)."""
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()


def _allowlist_key(user_id: UUID | str, token_type: TokenType) -> str:
    return f"user:{user_id}:{token_type}"


def _allowlist_meta_key(user_id: UUID | str, token_type: TokenType) -> str:
    return f"{_allowlist_key(user_id, token_type)}:meta"


def _as_text(value: bytes | str) -> str:
    return value.decode("utf-8") if isinstance(value, bytes) else value


def _metadata_payload(
    *, issued_at: float, expires_at: float, session_id: str | None, origin_ip: str | None = None
) -> str:
    return json.dumps(
        {
            "issued_at": issued_at,
            "exp": expires_at,
            "session_id": session_id or "",
            "origin_ip": origin_ip or "",
        }
    )


async def _purge_expired(redis_client: Redis, user_id: UUID | str, token_type: TokenType) -> None:
    token_key = _allowlist_key(user_id, token_type)
    meta_key = _allowlist_meta_key(user_id, token_type)
    now = time.time()
    expired = await redis_client.zrangebyscore(token_key, "-inf", now)
    if not expired:
        return
    fields = [_as_text(member) for member in expired]
    await redis_client.zremrangebyscore(token_key, "-inf", now)
    if fields:
        await redis_client.hdel(meta_key, *fields)


async def _extend_key_ttl(redis_client: Redis, user_id: UUID | str, token_type: TokenType) -> None:
    token_key = _allowlist_key(user_id, token_type)
    meta_key = _allowlist_meta_key(user_id, token_type)
    scored = await redis_client.zrange(token_key, 0, -1, withscores=True)
    if not scored:
        return
    deadline = int(max(float(score) for _member, score in scored))
    await redis_client.expireat(token_key, deadline)
    await redis_client.expireat(meta_key, deadline)


async def _remove_member(redis_client: Redis, user_id: UUID | str, token_type: TokenType, token: str) -> None:
    token_key = _allowlist_key(user_id, token_type)
    meta_key = _allowlist_meta_key(user_id, token_type)
    await redis_client.zrem(token_key, token)
    await redis_client.hdel(meta_key, token)


async def _read_metadata(
    redis_client: Redis, user_id: UUID | str, token_type: TokenType, token: str
) -> dict[str, object]:
    raw = await redis_client.hget(_allowlist_meta_key(user_id, token_type), token)
    if raw is None:
        return {}
    try:
        payload = json.loads(_as_text(raw))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


async def _load_issued_at(
    redis_client: Redis, user_id: UUID | str, token_type: TokenType, token: str
) -> float:
    try:
        return float((await _read_metadata(redis_client, user_id, token_type, token)).get("issued_at", 0.0))
    except (TypeError, ValueError):
        return 0.0


async def _session_id_of(redis_client: Redis, user_id: UUID | str, token_type: TokenType, token: str) -> str:
    return str((await _read_metadata(redis_client, user_id, token_type, token)).get("session_id") or "")


async def session_origin_ip(redis_client: Redis, user_id: UUID | str, refresh_token: str) -> str | None:
    """The client address a session was established from, or None if unrecorded.

    Unrecorded covers a session predating #69, a login whose client address the
    request did not carry, and metadata that cannot be read back. All three are
    absent rather than mismatched -- see ``origin_network``.
    """
    recorded = (await _read_metadata(redis_client, user_id, TokenType.REFRESH, refresh_token)).get(
        "origin_ip"
    )
    return str(recorded) if recorded else None


async def refresh_origin_is_anomalous(
    redis_client: Redis, user_id: UUID | str, refresh_token: str, client_ip: str | None
) -> bool:
    """Whether this refresh comes from a different network than the session's.

    Gated on ``VALIDATE_TOKEN_IP``, which is origin-network anomaly detection
    rather than IP binding (ADR 0011 decision 5). Asked at refresh only:
    access tokens are never checked against the origin.
    """
    if not settings.VALIDATE_TOKEN_IP:
        return False
    recorded = await session_origin_ip(redis_client, user_id, refresh_token)
    return is_different_network(recorded, client_ip)


async def revoke_session(redis_client: Redis, user_id: UUID | str, refresh_token: str) -> None:
    """Revoke one session: its refresh token and the access tokens derived from it.

    The user's other sessions are untouched, which is what makes this usable as
    the answer to an origin anomaly -- revoking all of them would mean a phone
    changing networks logs out the desktop.
    """
    session_id = await _session_id_of(redis_client, user_id, TokenType.REFRESH, refresh_token)
    if not session_id:
        session_id = session_id_for(refresh_token)
    await _remove_member(redis_client, user_id, TokenType.REFRESH, refresh_token)
    access_tokens = await get_valid_tokens(redis_client, user_id, TokenType.ACCESS)
    for member in list(access_tokens):
        access_token = _as_text(member)
        if await _session_id_of(redis_client, user_id, TokenType.ACCESS, access_token) == session_id:
            await _remove_member(redis_client, user_id, TokenType.ACCESS, access_token)


async def _revoke_members_with_session_id(redis_client: Redis, user_id: UUID | str, session_id: str) -> None:
    """Remove every allowlist member whose metadata names ``session_id``."""
    if not session_id:
        return
    for token_type in (TokenType.REFRESH, TokenType.ACCESS):
        members = await get_valid_tokens(redis_client, user_id, token_type)
        for member in list(members):
            token = _as_text(member)
            if await _session_id_of(redis_client, user_id, token_type, token) == session_id:
                await _remove_member(redis_client, user_id, token_type, token)


async def end_caller_session(
    redis_client: Redis,
    user_id: UUID | str,
    *,
    refresh_token: str | None,
    access_token: str | None,
) -> bool:
    """Revoke the caller's session. False when the session cannot be identified.

    Identity comes from the refresh token when one is presented (hashed if
    metadata is missing), otherwise from the access token's allowlist
    metadata. A missing identity must not revoke other sessions.
    """
    if refresh_token:
        await revoke_session(redis_client, user_id, refresh_token)
        return True
    if access_token:
        session_id = await _session_id_of(redis_client, user_id, TokenType.ACCESS, access_token)
        if not session_id:
            return False
        await _revoke_members_with_session_id(redis_client, user_id, session_id)
        return True
    return False


async def _enforce_concurrent_session_limit(redis_client: Redis, user_id: UUID | str) -> None:
    limit = settings.CONCURRENT_SESSION_LIMIT
    if limit <= 0:
        return
    refresh_tokens = [
        _as_text(member) for member in await get_valid_tokens(redis_client, user_id, TokenType.REFRESH)
    ]
    overflow = len(refresh_tokens) - limit
    if overflow <= 0:
        return
    ranked: list[tuple[float, str]] = []
    for token in refresh_tokens:
        issued_at = await _load_issued_at(redis_client, user_id, TokenType.REFRESH, token)
        ranked.append((issued_at, token))
    ranked.sort(key=lambda item: (item[0], item[1]))
    for _issued_at, token in ranked[:overflow]:
        await revoke_session(redis_client, user_id, token)


async def add_token_to_redis(
    redis_client: Redis,
    user: User,
    token: str,
    token_type: TokenType,
    expire_time: int,
    session_id: str | None = None,
    origin_ip: str | None = None,
) -> None:
    issued_at = time.time()
    expires_at = issued_at + timedelta(minutes=expire_time).total_seconds()
    if token_type is TokenType.REFRESH and not session_id:
        session_id = session_id_for(token)
    token_key = _allowlist_key(user.id, token_type)
    meta_key = _allowlist_meta_key(user.id, token_type)
    await _purge_expired(redis_client, user.id, token_type)
    await redis_client.zadd(token_key, {token: expires_at})
    await redis_client.hset(
        meta_key,
        token,
        _metadata_payload(
            issued_at=issued_at,
            expires_at=expires_at,
            session_id=session_id,
            origin_ip=origin_ip,
        ),
    )
    await _extend_key_ttl(redis_client, user.id, token_type)
    if token_type is TokenType.REFRESH:
        await _enforce_concurrent_session_limit(redis_client, user.id)


async def add_session_tokens_to_redis(
    redis_client: Redis,
    user: User,
    access_token: str,
    refresh_token: str,
    access_expire_minutes: int,
    refresh_expire_minutes: int,
    origin_ip: str | None = None,
) -> None:
    """Record one session: a refresh token and the access token derived from it.

    Adding the refresh token enforces ``CONCURRENT_SESSION_LIMIT`` (ADR 0011
    decision 7): a login at the limit evicts the oldest session rather than
    rejecting the new one. A limit of 0 or less disables enforcement.

    ``origin_ip`` is the client address the session was established from, kept
    on the refresh entry alone because that is the only place it is read
    (ADR 0011 decision 5). Copying it onto the access entry would be a second
    place to keep correct with no reader. Passing None records no origin, and a
    session with no origin is never treated as an anomaly.
    """
    session_id = session_id_for(refresh_token)
    await add_token_to_redis(
        redis_client,
        user,
        refresh_token,
        TokenType.REFRESH,
        refresh_expire_minutes,
        session_id=session_id,
        origin_ip=origin_ip,
    )
    await add_token_to_redis(
        redis_client,
        user,
        access_token,
        TokenType.ACCESS,
        access_expire_minutes,
        session_id=session_id,
    )


async def add_derived_access_token_to_redis(
    redis_client: Redis,
    user: User,
    access_token: str,
    refresh_token: str,
    expire_time: int,
) -> None:
    """Allowlist an access token as belonging to the session of ``refresh_token``."""
    await add_token_to_redis(
        redis_client,
        user,
        access_token,
        TokenType.ACCESS,
        expire_time,
        session_id=session_id_for(refresh_token),
    )


async def get_valid_tokens(
    redis_client: Redis, user_id: UUID | str, token_type: TokenType
) -> set[bytes | str]:
    await _purge_expired(redis_client, user_id, token_type)
    members = await redis_client.zrange(_allowlist_key(user_id, token_type), 0, -1)
    return set(members)


def token_is_allowlisted(valid_tokens: set[bytes | str], token: str) -> bool:
    return token in valid_tokens or token.encode() in valid_tokens


async def revoke_user_tokens(redis_client: Redis, user_id: UUID | str, token_type: TokenType) -> None:
    """Revoke every token of one type for a user by deleting the allowlist keys.

    This is the session revocation primitive (ADR 0011). It is awaited inline
    and never deferred: callers that reissue afterwards depend on the deletion
    having completed, and a queued delete would remove the tokens they just
    issued. It was called ``cleanup_expired_tokens``, which described garbage
    collection and hid revocation from readers looking for it (#206).
    """
    await redis_client.delete(_allowlist_key(user_id, token_type))
    await redis_client.delete(_allowlist_meta_key(user_id, token_type))


async def revoke_all_user_tokens(redis_client: Redis, user_id: UUID | str) -> None:
    """Revoke every token the allowlist holds for a user, of any type.

    Used where the account itself has changed hands -- a self-service
    password change, a completed reset, or an administrator setting the
    password -- so an outstanding reset link cannot outlive the change
    that should have invalidated it. ``POST /logout`` does not call this: it
    ends one session and says nothing about a reset link the user may be part
    way through redeeming. ``POST /logout/all`` does, because signing out
    everywhere is a statement about every token the allowlist holds.
    """
    for token_type in ALLOWLIST_TOKEN_TYPES:
        await revoke_user_tokens(redis_client, user_id, token_type)
