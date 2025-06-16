from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base_schema import IBaseSchema
from app.schemas.permission_schema import IPermissionRead
from app.utils.partial import optional


# Define a Pydantic base schema for Role properties
class RoleSchemaBase(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    role_group_id: Optional[UUID] = None


# Properties to receive via API on Creation
class IRoleCreate(RoleSchemaBase):
    name: str = Field(..., min_length=1)
    permission_ids: Optional[List[UUID]] = []  # Add permission_ids field for consistency


@optional()
class IRoleUpdate(RoleSchemaBase):
    permission_ids: Optional[List[UUID]] = None


# Output paginated data
class RoleOutput(BaseModel):
    pass


class IRoleRead(RoleSchemaBase):
    id: UUID
    created_at: datetime
    updated_at: datetime | None = None
    created_by_id: UUID | None = None
    permissions: List[IPermissionRead] = []


class IRoleOutput(RoleSchemaBase):
    id: UUID


class IRoleEnum(str, Enum):
    admin = "admin"
    manager = "manager"
    user = "user"


class IRolePermissionAssign(IBaseSchema):
    """Schema for assigning permissions to a role"""

    permission_ids: List[UUID]  # Changed from UUID4 to UUID for more flexible validation


class IRolePermissionUnassign(IBaseSchema):
    """Schema for unassigning permissions from a role"""

    permission_ids: List[UUID]  # Changed from UUID4 to UUID for more flexible validation
