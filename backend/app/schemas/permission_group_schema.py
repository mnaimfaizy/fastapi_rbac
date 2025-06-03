from datetime import datetime
from typing import Any, List, Optional
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
    # Add description and created_by_id if they are part of the base or should be here
    description: Optional[str] = None
    created_by_id: Optional[UUID] = None


class IPermissionGroupRead(IPermissionGroupBase):
    pass


# Add a new schema that includes permissions for paginated responses
class IPermissionGroupReadWithPermissions(IPermissionGroupRead):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    permissions: Optional[List[Permission]] = []


@optional()
class IPermissionGroupUpdate(PermissionGroupBase):
    pass


class IPermissionGroupWithPermissions(IPermissionGroupBase):
    model_config = ConfigDict(
        from_attributes=True, arbitrary_types_allowed=True, populate_by_name=True
    )

    creator: Optional[UserBasic] = None
    permissions: Optional[List[Permission]] = []
    groups: Optional[List["IPermissionGroupBase"]] = []
    parent: Optional[IPermissionGroupBase] = None

    @model_validator(mode="before")
    @classmethod
    def prevent_recursion(cls, values: dict[str, Any]) -> dict[str, Any]:
        """Prevent infinite recursion in parent/child relationships"""
        if "parent" in values and values["parent"]:
            # Only include basic parent info
            # Ensure parent is converted to dict if it's a model instance before creating IPermissionGroupBase
            parent_data = values["parent"]
            if hasattr(parent_data, "model_dump"):
                parent_data = parent_data.model_dump()
            values["parent"] = IPermissionGroupBase(**parent_data)
        if "groups" in values and values["groups"]:
            # Only include basic child info
            # Ensure group is converted to dict if it's a model instance before creating IPermissionGroupBase
            processed_groups = []
            for g in values["groups"]:
                group_data = g
                if hasattr(group_data, "model_dump"):
                    group_data = group_data.model_dump()
                processed_groups.append(IPermissionGroupBase(**group_data))
            values["groups"] = processed_groups
        return values
