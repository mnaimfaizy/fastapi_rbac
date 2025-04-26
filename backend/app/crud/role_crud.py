from uuid import UUID

from app.crud.base_crud import CRUDBase
from app.models import RolePermission
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.role_schema import IRoleCreate, IRoleUpdate
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession


class CRUDRole(CRUDBase[Role, IRoleCreate, IRoleUpdate]):
    async def get_role_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> Role | None:
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
        result = await db_session.execute(
            select(RolePermission).where(RolePermission.role_id == role_id)
        )
        permissions = result.scalars().all()
        return len(permissions) > 0


role = CRUDRole(Role)
