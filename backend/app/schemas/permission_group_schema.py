from uuid import UUID

from app.models import Permission
from app.models.permission_group_model import PermissionGroupBase
from app.utils.partial import optional


class IPermissionGroupCreate(PermissionGroupBase):
    pass


class IPermissionGroupRead(PermissionGroupBase):
    id: UUID


@optional()
class IPermissionGroupUpdate(PermissionGroupBase):
    pass


class IPermissionGroupWithPermissions(PermissionGroupBase):
    id: UUID
    permissions: list[Permission]
