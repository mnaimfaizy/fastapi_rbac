from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models import RolePermission
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.role_schema import IRoleCreate, IRoleUpdate


class CRUDRole(CRUDBase[Role, IRoleCreate, IRoleUpdate]):
    async def get_role_by_name(
        self, *, name: str, db_session: AsyncSession | None = None
    ) -> Role:
        db_session = db_session or super().get_db().session
        role = await db_session.execute(select(Role).where(Role.name == name))
        return role.scalar_one_or_none()

    async def add_role_to_user(self, *, user: User, role_id: UUID) -> Role:
        db_session = super().get_db().session
        role = await super().get(id=role_id)
        role.users.append(user)
        db_session.add(role)
        await db_session.commit()
        await db_session.refresh(role)
        return role

    async def permission_exist_in_role(self, *, role_id: UUID) -> bool:
        db_session = super().get_db().session
        permissions = await db_session.execute(
            select(RolePermission).where(RolePermission.role_id == role_id)
        ).all()
        if len(permissions) > 0:
            return True
        return False


role = CRUDRole(Role)
