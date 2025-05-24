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


class TokenType(str, Enum):
    ACCESS = "access_token"
    REFRESH = "refresh_token"
    RESET = "reset_token"
    VERIFICATION = "verification_token"


class IUserMessage(BaseModel):
    """User message schema."""

    user_id: UUID | None = None
    message: str
