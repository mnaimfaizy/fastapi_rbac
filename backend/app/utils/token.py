import hashlib
import json
import time
from datetime import timedelta
from uuid import UUID

from redis.asyncio import Redis

from app.core.config import settings
from app.models.user_model import User
from app.schemas.common_schema import TokenType

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


def _metadata_payload(*, issued_at: float, expires_at: float, session_id: str | None) -> str:
    return json.dumps(
        {
            "issued_at": issued_at,
            "exp": expires_at,
            "session_id": session_id or "",
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


async def _evict_session(redis_client: Redis, user_id: UUID | str, refresh_token: str) -> None:
    session_id = await _session_id_of(redis_client, user_id, TokenType.REFRESH, refresh_token)
    if not session_id:
        session_id = session_id_for(refresh_token)
    await _remove_member(redis_client, user_id, TokenType.REFRESH, refresh_token)
    access_tokens = await get_valid_tokens(redis_client, user_id, TokenType.ACCESS)
    for member in list(access_tokens):
        access_token = _as_text(member)
        if await _session_id_of(redis_client, user_id, TokenType.ACCESS, access_token) == session_id:
            await _remove_member(redis_client, user_id, TokenType.ACCESS, access_token)


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
        await _evict_session(redis_client, user_id, token)


async def add_token_to_redis(
    redis_client: Redis,
    user: User,
    token: str,
    token_type: TokenType,
    expire_time: int,
    session_id: str | None = None,
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
) -> None:
    """Record one session: a refresh token and the access token derived from it.

    Adding the refresh token enforces ``CONCURRENT_SESSION_LIMIT`` (ADR 0011
    decision 7): a login at the limit evicts the oldest session rather than
    rejecting the new one. A limit of 0 or less disables enforcement.
    """
    session_id = session_id_for(refresh_token)
    await add_token_to_redis(
        redis_client,
        user,
        refresh_token,
        TokenType.REFRESH,
        refresh_expire_minutes,
        session_id=session_id,
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

    Used where the account itself has changed hands -- a password change or a
    completed reset -- so an outstanding reset link cannot outlive the change
    that should have invalidated it. Logout deliberately does not call this: it
    ends one session and says nothing about a reset link the user may be part
    way through redeeming.
    """
    for token_type in ALLOWLIST_TOKEN_TYPES:
        await revoke_user_tokens(redis_client, user_id, token_type)
