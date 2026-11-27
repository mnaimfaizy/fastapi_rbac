from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.permission_model import PermissionBase

# Import the basic group schema
from app.schemas.permission_group_schema import IPermissionGroupRead
from app.utils.partial import optional


class IPermissionCreate(PermissionBase):
    pass


@optional()
class IPermissionUpdate(PermissionBase):
    pass


class IPermissionRead(PermissionBase):
    id: UUID
    # Add the related group object
    group: Optional[IPermissionGroupRead] = None


class IPermissionRoleGrant(BaseModel):
    """A role that grants one permission, and how many users hold that role."""

    id: UUID
    name: str
    role_group: Optional[str] = None
    user_count: int = 0


class IPermissionDetailRead(IPermissionRead):
    """Permission read model plus the roles that grant it. The list omits ``roles``."""

    created_at: Optional[datetime] = None
    roles: list[IPermissionRoleGrant] = []
