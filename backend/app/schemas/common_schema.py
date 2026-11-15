from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class IGenderEnum(str, Enum):
    female = "female"
    male = "male"
    other = "other"


class IOrderEnum(str, Enum):
    ascendent = "ascendent"
    descendent = "descendent"


# The token types the session allowlist holds. Emailed links are not among them (#283).
class TokenType(str, Enum):
    ACCESS = "access_token"
    REFRESH = "refresh_token"


class IUserMessage(BaseModel):
    """User message schema."""

    user_id: UUID | None = None
    message: str
