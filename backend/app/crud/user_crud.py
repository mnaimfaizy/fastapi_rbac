from typing import Any
from uuid import UUID

from pydantic.networks import EmailStr
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.crud.base_crud import CRUDBase
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, IUserUpdate


class CRUDUser(CRUDBase[User, IUserCreate, IUserUpdate]):
    async def get_by_email(
        self, *, email: str, db_session: AsyncSession | None = None
    ) -> User | None:
        db_session = db_session or super().get_db().session
        result = await db_session.execute(select(User).where(User.email == email))
        users = result.unique()
        user = users.scalar_one_or_none()
        print(user)
        return user

    async def get_by_id_active(self, *, id: UUID) -> User | None:
        user = await super().get(id=id)
        if not user:
            return None
        if user.is_active is False:
            return None

        return user

    async def create_with_role(
        self, *, obj_in: IUserCreate, db_session: AsyncSession | None = None
    ) -> User:
        db_session = db_session or super().get_db().session
        db_obj = User.model_validate(obj_in)
        db_obj.password = get_password_hash(obj_in.password)
        db_session.add(db_obj)
        await db_session.commit()
        await db_session.refresh(db_obj)
        return db_obj

    def has_verified(self, user: User) -> bool:
        """
        Check if the user's email is verified.
        For now, assuming all users are verified unless there's a specific field for it.
        If there is an is_verified field in your User model, modify this method accordingly.
        """
        # If there's a specific field for email verification, use that
        if hasattr(user, "is_verified"):
            return user.is_verified
        # Otherwise assume all active users are verified
        return True

    async def update_is_active(
        self, *, db_obj: list[User], obj_in: int | str | dict[str, Any]
    ) -> User | None:
        response = None
        db_session = super().get_db().session
        for x in db_obj:
            x.is_active = obj_in.is_active
            db_session.add(x)
            await db_session.commit()
            await db_session.refresh(x)
            response.append(x)
        return response

    async def authenticate(self, *, email: EmailStr, password: str) -> User | None:
        user = await self.get_by_email(email=email)
        if not user:
            return None
        if not verify_password(password, user.password):
            return None
        return user

    async def remove(
        self, *, id: UUID | str, db_session: AsyncSession | None = None
    ) -> User:
        db_session = db_session or super().get_db().session
        response = await db_session.execute(
            select(self.model).where(self.model.id == id)
        )
        obj = response.scalar_one()

        await db_session.delete(obj)
        await db_session.commit()
        return obj


user = CRUDUser(User)
