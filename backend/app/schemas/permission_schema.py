from typing import Optional
from uuid import UUID

from app.models.permission_model import PermissionBase

# Import the basic group schema
from app.schemas.permission_group_schema import IPermissionGroupRead
from app.utils.partial import optional


class IPermissionCreate(PermissionBase):
    pass


class IPermissionRead(PermissionBase):
    id: UUID
    # Add the related group object
    group: Optional[IPermissionGroupRead] = None


@optional()
class IPermissionUpdate(PermissionBase):
    pass
