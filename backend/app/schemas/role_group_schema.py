from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.role_group_model import RoleGroupBase
from app.schemas.role_schema import IRoleRead
from app.utils.partial import optional


# Basic user information to include in role group responses
class IUserBasic(BaseModel):
    id: UUID
    email: str
    first_name: str | None = None
    last_name: str | None = None

    @property
    def full_name(self) -> str:
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name or ""


# Simple role group schema for parent references to avoid cyclic references
class IRoleGroupBase(RoleGroupBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None
    creator: Optional[IUserBasic] = None


class IRoleGroupCreate(RoleGroupBase):
    # Add description and created_by_id if they are part of the base or should be here
    description: Optional[str] = None
    created_by_id: Optional[UUID] = None


class IRoleGroupRead(RoleGroupBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None
    creator: Optional[IUserBasic] = None
    children: List["IRoleGroupRead"] = []
    parent: Optional[IRoleGroupBase] = None


@optional()
class IRoleGroupUpdate(RoleGroupBase):
    pass


class IRoleGroupWithRoles(RoleGroupBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None
    creator: Optional[IUserBasic] = None
    roles: List[IRoleRead] = []
    children: List["IRoleGroupWithRoles"] = []
    parent: Optional[IRoleGroupBase] = None


# Update forward references to fix recursive type hints
IRoleGroupRead.model_rebuild()
IRoleGroupWithRoles.model_rebuild()
