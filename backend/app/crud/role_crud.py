from typing import List
from uuid import UUID

from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.role_model import Role
from app.models.role_permission_model import RolePermission
from app.models.user_model import User
from app.schemas.role_schema import IRoleCreate, IRoleUpdate
from app.utils.exceptions.common_exception import ResourceNotFoundException
from app.utils.security_audit import create_audit_log


class CRUDRole(CRUDBase[Role, IRoleCreate, IRoleUpdate]):
    """CRUD operations for Role model"""

    async def get_role_by_name(self, *, name: str, db_session: AsyncSession | None = None) -> Role | None:
        db_session = db_session or super().get_db().session
        role = await db_session.execute(select(Role).where(Role.name == name))
        return role.scalar_one_or_none()

    async def add_role_to_user(
        self, *, user: User, role_id: UUID, db_session: AsyncSession | None = None
    ) -> Role:
        db_session = db_session or super().get_db().session
        role = await super().get(id=role_id, db_session=db_session)
        if not role:
            raise ValueError(f"Role with ID {role_id} not found")

        role.users.append(user)
        db_session.add(role)
        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def permission_exist_in_role(
        self, *, role_id: UUID, db_session: AsyncSession | None = None
    ) -> bool:
        db_session = db_session or super().get_db().session
        result = await db_session.execute(select(RolePermission).where(RolePermission.role_id == role_id))
        permissions = result.scalars().all()
        return len(permissions) > 0

    async def assign_permissions(
        self,
        *,
        role_id: UUID,
        permission_ids: List[UUID],
        current_user: User,
        db_session: AsyncSession | None = None,
    ) -> Role:
        """Assign permissions to a role"""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        for permission_id in permission_ids:
            role_permission = RolePermission(role_id=role_id, permission_id=permission_id)
            db_session.add(role_permission)

        # Create audit log
        await create_audit_log(
            db_session=db_session,
            actor_id=current_user.id,
            action="assign_permissions",
            resource_type="role",
            resource_id=str(role_id),
            details={"permission_ids": [str(pid) for pid in permission_ids]},
        )

        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def remove_permissions(
        self,
        *,
        role_id: UUID,
        permission_ids: List[UUID],
        current_user: User,
        db_session: AsyncSession | None = None,
    ) -> Role:
        """Remove permissions from a role"""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            raise ResourceNotFoundException(Role, id=role_id)

        # Delete the specified role-permission mappings
        for permission_id in permission_ids:
            await db_session.execute(
                select(RolePermission).filter_by(role_id=role_id, permission_id=permission_id).delete()
            )

        # Create audit log
        await create_audit_log(
            db_session=db_session,
            actor_id=current_user.id,
            action="remove_permissions",
            resource_type="role",
            resource_id=str(role_id),
            details={"permission_ids": [str(pid) for pid in permission_ids]},
        )

        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def validate_system_role(self, *, role_id: UUID, db_session: AsyncSession | None = None) -> bool:
        """Check if a role is a system role that shouldn't be modified"""
        db_session = db_session or super().get_db().session
        role = await self.get(id=role_id, db_session=db_session)

        if not role:
            return False

        # List of protected system role names
        system_roles = ["admin", "system", "superuser"]
        return role.name.lower() in system_roles


role_crud = CRUDRole(Role)
# Keep the original name for backward compatibility
role = role_crud
