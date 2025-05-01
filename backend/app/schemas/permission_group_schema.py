from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.models import Permission
from app.models.permission_group_model import PermissionGroupBase
from app.utils.partial import optional


class UserBasic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class IPermissionGroupBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str | None = None
    permission_group_id: UUID | None = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None


class IPermissionGroupCreate(PermissionGroupBase):
    pass


class IPermissionGroupRead(IPermissionGroupBase):
    pass


@optional()
class IPermissionGroupUpdate(PermissionGroupBase):
    pass


class IPermissionGroupWithPermissions(IPermissionGroupBase):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True, populate_by_name=True)

    creator: Optional[UserBasic] = None
    permissions: Optional[List[Permission]] = []
    groups: Optional[List["IPermissionGroupBase"]] = []
    parent: Optional[IPermissionGroupBase] = None

    @model_validator(mode="before")
    @classmethod
    def prevent_recursion(cls, values):
        """Prevent infinite recursion in parent/child relationships"""
        if "parent" in values and values["parent"]:
            # Only include basic parent info
            values["parent"] = IPermissionGroupBase(**values["parent"].model_dump())
        if "groups" in values and values["groups"]:
            # Only include basic child info
            values["groups"] = [IPermissionGroupBase(**g.model_dump()) for g in values["groups"]]
        return values
