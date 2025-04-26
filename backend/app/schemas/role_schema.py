from enum import Enum
from typing import Optional
from uuid import UUID

from app.models.role_model import RoleBase
from app.utils.partial import optional
from pydantic import BaseModel, Field


# Properties to receive via API on Creation
class IRoleCreate(RoleBase):
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(None)
    role_group_id: UUID = Field(...)


@optional()
class IRoleUpdate(RoleBase):
    pass


# Output paginated data
class RoleOutput(BaseModel):
    pass


class IRoleRead(RoleBase):
    id: UUID


class IRoleOutput(RoleBase):
    id: UUID


class IRoleEnum(str, Enum):
    admin = "admin"
    manager = "manager"
    user = "user"
