from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import UUID4, BaseModel, Field

from app.models.role_model import RoleBase
from app.schemas.base_schema import IBaseSchema
from app.utils.partial import optional


# Properties to receive via API on Creation
class IRoleCreate(RoleBase):
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(None)
    role_group_id: Optional[UUID] = None


@optional()
class IRoleUpdate(RoleBase):
    pass


# Output paginated data
class RoleOutput(BaseModel):
    pass


class IRoleRead(RoleBase):
    id: UUID
    created_at: datetime
    updated_at: datetime | None = None
    created_by_id: UUID | None = None


class IRoleOutput(RoleBase):
    id: UUID


class IRoleEnum(str, Enum):
    admin = "admin"
    manager = "manager"
    user = "user"


class IRolePermissionAssign(IBaseSchema):
    """Schema for assigning permissions to a role"""

    permission_ids: List[UUID4]


class IRolePermissionUnassign(IBaseSchema):
    """Schema for unassigning permissions from a role"""

    permission_ids: List[UUID4]
