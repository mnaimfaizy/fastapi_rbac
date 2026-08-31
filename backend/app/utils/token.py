from datetime import timedelta
from uuid import UUID

from redis.asyncio import Redis

from app.models.user_model import User
from app.schemas.common_schema import TokenType

# The types the allowlist actually holds under ``user:{id}:{token_type}``.
# TokenType.VERIFICATION is deliberately absent: email verification stores a
# single token under ``verification_token:{id}``, a different key shape that
# these helpers do not reach.
ALLOWLIST_TOKEN_TYPES = (TokenType.ACCESS, TokenType.REFRESH, TokenType.RESET)


async def add_token_to_redis(
    redis_client: Redis,
    user: User,
    token: str,
    token_type: TokenType,
    expire_time: int | None = None,
) -> None:
    token_key = f"user:{user.id}:{token_type}"
    valid_tokens = await get_valid_tokens(redis_client, user.id, token_type)
    await redis_client.sadd(token_key, token)
    if not valid_tokens:
        await redis_client.expire(token_key, timedelta(minutes=expire_time))


async def get_valid_tokens(
    redis_client: Redis, user_id: UUID | str, token_type: TokenType
) -> set[bytes | str]:
    token_key = f"user:{user_id}:{token_type}"
    valid_tokens = await redis_client.smembers(token_key)
    return valid_tokens


def token_is_allowlisted(valid_tokens: set[bytes | str], token: str) -> bool:
    return token in valid_tokens or token.encode() in valid_tokens


async def revoke_user_tokens(redis_client: Redis, user_id: UUID | str, token_type: TokenType) -> None:
    """Revoke every token of one type for a user by deleting the allowlist set.

    This is the session revocation primitive (ADR 0011). It is awaited inline
    and never deferred: callers that reissue afterwards depend on the deletion
    having completed, and a queued delete would remove the tokens they just
    issued. It was called ``cleanup_expired_tokens``, which described garbage
    collection and hid revocation from readers looking for it (#206).
    """
    await redis_client.delete(f"user:{user_id}:{token_type}")


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
