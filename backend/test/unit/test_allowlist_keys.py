"""Allowlist Redis key shape is fixed and independent of Python enum f-string rules."""

from uuid import uuid4

from app.schemas.common_schema import TokenType
from app.utils.allowlist import _allowlist_key, _allowlist_meta_key

USER_ID = uuid4()


def test_allowlist_key_spells_token_values_not_enum_names() -> None:
    assert _allowlist_key(USER_ID, TokenType.ACCESS) == f"user:{USER_ID}:access_token"
    assert _allowlist_key(USER_ID, TokenType.REFRESH) == f"user:{USER_ID}:refresh_token"


def test_allowlist_meta_key_extends_the_token_key() -> None:
    assert _allowlist_meta_key(USER_ID, TokenType.ACCESS) == f"user:{USER_ID}:access_token:meta"
    assert _allowlist_meta_key(USER_ID, TokenType.REFRESH) == f"user:{USER_ID}:refresh_token:meta"
