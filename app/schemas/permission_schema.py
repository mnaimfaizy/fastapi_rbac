from uuid import UUID

from app.models.permission_model import PermissionBase
from app.utils.partial import optional


class IPermissionCreate(PermissionBase):
    pass


class IPermissionRead(PermissionBase):
    id: UUID


@optional()
class IPermissionUpdate(PermissionBase):
    pass
