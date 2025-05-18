"""
Permission and Role model factories for testing.
"""

from datetime import datetime, timezone
from typing import Any, Optional, Sequence, cast
from uuid import UUID

import factory

# from factory import Faker, LazyFunction
from factory.alchemy import SQLAlchemyModelFactory
from sqlalchemy.orm import Session

from app.models.permission_group_model import PermissionGroup
from app.models.permission_model import Permission
from app.models.role_group_model import RoleGroup
from app.models.role_model import Role
from app.utils.uuid6 import uuid7


class BaseFactory(SQLAlchemyModelFactory):
    """Base factory with common functionality."""

    class Meta:  # type: ignore
        abstract = True

    @classmethod
    def get_session(cls) -> Session:
        """Get the SQLAlchemy session from the factory's meta."""
        return cls._meta.sqlalchemy_session  # type: ignore[attr-defined]


class PermissionGroupFactory(BaseFactory):
    """Factory for creating PermissionGroup model instances."""

    class Meta:  # type: ignore
        model = PermissionGroup
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid7)  # type: ignore[assignment]
    name = factory.Sequence(lambda n: f"permission-group-{n}")  # type: ignore[assignment]
    description = factory.Faker("sentence")  # type: ignore[assignment]
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    created_by_id = None  # Will be set by tests if needed


class PermissionFactory(BaseFactory):
    """Factory for creating Permission model instances."""

    class Meta:  # type: ignore
        model = Permission
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid7)  # type: ignore[assignment]
    name = factory.Sequence(lambda n: f"permission_{n}")  # type: ignore[assignment]
    description = factory.Faker("sentence")  # type: ignore[assignment]
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]

    # Each permission needs to belong to a group
    @factory.lazy_attribute  # type: ignore
    def group_id(self) -> UUID:
        """Generate a group ID, creating a new group if necessary."""
        if not hasattr(self, "_group"):
            # Create a permission group if none exists
            self._group = cast(PermissionGroup, PermissionGroupFactory(created_by_id=None))
        return self._group.id

    @classmethod
    def with_group(cls, group: Optional[PermissionGroup] = None, **kwargs: Any) -> Permission:
        """Create permission with a specific group."""
        if group is None:
            group = cast(PermissionGroup, PermissionGroupFactory())
        return cast(Permission, cls(group_id=group.id, **kwargs))


class RoleGroupFactory(BaseFactory):
    """Factory for creating RoleGroup model instances."""

    class Meta:  # type: ignore
        model = RoleGroup
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid7)  # type: ignore[assignment]
    name = factory.Sequence(lambda n: f"role-group-{n}")  # type: ignore[assignment]
    description = factory.Faker("sentence")  # type: ignore[assignment]
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    parent_id = None  # No parent by default


class RoleFactory(BaseFactory):
    """Factory for creating Role model instances."""

    class Meta:  # type: ignore
        model = Role
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid7)  # type: ignore[assignment]
    name = factory.Sequence(lambda n: f"role-{n}")  # type: ignore[assignment]
    description = factory.Faker("sentence")  # type: ignore[assignment]
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))  # type: ignore[assignment]
    role_group_id = None  # Optional role group

    @factory.post_generation  # type: ignore
    def permissions(self, create: bool, extracted: Optional[Sequence[Permission]], **kwargs: Any) -> None:
        """Add permissions to the role if provided."""
        if not create or not extracted:
            return

        # Add the permissions to the role
        if hasattr(extracted, "__iter__"):
            from app.models.role_permission_model import RolePermission

            session = self.get_session()

            for permission in extracted:
                role_permission = RolePermission(role_id=self.id, permission_id=permission.id)  # type: ignore
                session.add(role_permission)
                session.flush()

    @classmethod
    def with_permissions(
        cls, permissions: Optional[Sequence[Permission]] = None, count: int = 2, **kwargs: Any
    ) -> Role:
        """Create role with specific permissions."""
        role = cast(Role, cls(**kwargs))
        session = cls.get_session()

        if permissions is None and count > 0:
            # Create some default permissions
            permissions = [cast(Permission, PermissionFactory()) for _ in range(count)]

        if permissions:
            from app.models.role_permission_model import RolePermission

            for permission in permissions:
                role_permission = RolePermission(role_id=role.id, permission_id=permission.id)
                session.add(role_permission)

        session.flush()
        return role
