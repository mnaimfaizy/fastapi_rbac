from uuid import UUID

from app.models import Role
from app.models.role_group_model import RoleGroupBase
from app.schemas.role_schema import IRoleRead
from app.utils.partial import optional


class IRoleGroupCreate(RoleGroupBase):
    pass


class IRoleGroupRead(RoleGroupBase):
    id: UUID


@optional()
class IRoleGroupUpdate(RoleGroupBase):
    pass


class IRoleGroupWithRoles(RoleGroupBase):
    roles: list[IRoleRead] | None = None
