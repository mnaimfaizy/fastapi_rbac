from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID  # Removed Coroutine

from fastapi import HTTPException
from pydantic import EmailStr
from sqlalchemy import exc  # Keep this import
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession  # Keep this import

from app.core.config import settings
from app.core.security import PasswordValidator
from app.crud.base_crud import CRUDBase
from app.models.password_history_model import UserPasswordHistory

# Removed unused Permission import
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, IUserUpdate


class CRUDUser(CRUDBase[User, IUserCreate, IUserUpdate]):
    async def get_by_email(self, *, email: str, db_session: AsyncSession | None = None) -> User | None:
        resolved_session = db_session or self.db.session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        stmt = (
            select(self.model)
            .where(self.model.email == email)  # type: ignore[attr-defined]
            .options(
                selectinload(self.model.roles).selectinload(  # type: ignore[attr-defined]
                    Role.permissions  # type: ignore[arg-type]
                )
            )
        )
        result = await resolved_session.execute(stmt)
        unique_result = result.unique()
        return unique_result.scalar_one_or_none()

    async def get_by_id_active(self, *, id: UUID) -> User | None:
        user = await super().get(id=id)
        if not user:
            return None
        if user.is_active is False:
            return None

        return user

    async def create_with_role(self, *, obj_in: IUserCreate, db_session: AsyncSession | None = None) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        user_data = obj_in.model_dump(exclude={"role_id", "password"})
        user_data["roles"] = []  # Ensure roles is an empty list for User constructor
        db_obj = User(**user_data)
        db_obj.password = PasswordValidator.get_password_hash(obj_in.password)

        try:
            resolved_session.add(db_obj)
            # Defer commit until roles are handled for atomicity

            role_ids = obj_in.role_id if obj_in.role_id is not None else []
            if role_ids:
                result = await resolved_session.execute(
                    select(Role).where(Role.id.in_(role_ids))  # type: ignore[attr-defined]
                )
                roles_to_assign = list(result.scalars().all())
                if len(roles_to_assign) != len(role_ids):
                    await resolved_session.rollback()  # Rollback before raising
                    found_role_ids = {r.id for r in roles_to_assign}
                    missing_ids = [rid for rid in role_ids if rid not in found_role_ids]
                    raise HTTPException(
                        status_code=404,
                        detail=f"One or more roles not found for IDs: {missing_ids}",
                    )
                db_obj.roles = roles_to_assign

            await resolved_session.commit()  # Single commit for user and roles
            await resolved_session.refresh(db_obj)
            if role_ids:  # Refresh roles attribute if they were processed
                await resolved_session.refresh(db_obj, attribute_names=["roles"])

        except exc.IntegrityError as e:
            await resolved_session.rollback()
            is_unique_constraint_violation = "UNIQUE constraint failed" in str(
                e
            ) or "duplicate key value violates unique constraint" in str(e)
            if is_unique_constraint_violation:
                raise HTTPException(
                    status_code=409,
                    detail="User with this email already exists",
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Database integrity error: {e}",
                )
        except HTTPException:
            raise
        except Exception as e:
            await resolved_session.rollback()
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

        return db_obj

    async def create(
        self,
        *,
        obj_in: IUserCreate | User,
        created_by_id: UUID | str | None = None,
        db_session: AsyncSession | None = None,
    ) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        role_ids = []  # Initialize role_ids for later conditional refresh
        if isinstance(obj_in, IUserCreate):
            role_ids = obj_in.role_id if obj_in.role_id is not None else []
            obj_in_data = obj_in.model_dump(exclude={"password", "role_id"})
            obj_in_data["roles"] = []  # Ensure roles is an empty list for User constructor
            db_obj = User(**obj_in_data)
            db_obj.password = PasswordValidator.get_password_hash(obj_in.password)
        else:  # isinstance(obj_in, User)
            db_obj = obj_in
            if db_obj.roles is None:
                db_obj.roles = []

        if created_by_id:
            db_obj.created_by_id = created_by_id

        try:
            resolved_session.add(db_obj)
            # Defer commit until roles are handled for atomicity (if any)

            if role_ids:  # Only if obj_in was IUserCreate and had role_ids
                result = await resolved_session.execute(
                    select(Role).where(Role.id.in_(role_ids))  # type: ignore[attr-defined]
                )
                roles = list(result.scalars().all())
                if len(roles) != len(role_ids):
                    await resolved_session.rollback()  # Rollback before raising
                    raise HTTPException(
                        status_code=404,
                        detail=f"One or more roles not found for IDs: {role_ids}",
                    )
                db_obj.roles = roles

            await resolved_session.commit()  # Single commit
            await resolved_session.refresh(db_obj)
            # Conditionally refresh roles attribute if they were involved
            if role_ids or (isinstance(obj_in, User) and obj_in.roles is not None and len(obj_in.roles) > 0):
                await resolved_session.refresh(db_obj, attribute_names=["roles"])

        except exc.IntegrityError as e:
            await resolved_session.rollback()
            is_unique_constraint_violation = "UNIQUE constraint failed" in str(
                e
            ) or "duplicate key value violates unique constraint" in str(e)
            if is_unique_constraint_violation:
                raise HTTPException(
                    status_code=409,
                    detail="User with this email already exists",
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Database integrity error: {e}",
                )
        except HTTPException:
            raise
        except Exception as e:
            await resolved_session.rollback()
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

        # Ensure this refresh is inside the try block or handled after confirming success.
        # The logic above now includes conditional refresh of roles inside the try block.
        # So, the standalone refresh below might be redundant or needs re-evaluation.
        # For now, I'll keep it as per the original structure but note it.
        # await resolved_session.refresh(db_obj, attribute_names=["roles"])  # Original position
        return db_obj

    async def update(
        self,
        *,
        obj_current: User,
        obj_new: IUserUpdate | dict[str, Any] | User,
        db_session: AsyncSession | None = None,
    ) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        if isinstance(obj_new, dict):
            update_data = obj_new
        else:
            update_data = obj_new.model_dump(exclude_unset=True)

        if "password" in update_data and update_data["password"]:
            hashed_password = PasswordValidator.get_password_hash(update_data["password"])
            obj_current.password = hashed_password
            obj_current.last_changed_password_date = datetime.utcnow()
            del update_data["password"]
        elif "password" in update_data:
            del update_data["password"]

        if "role_id" in update_data:
            role_ids = update_data.pop("role_id", [])
            if role_ids:
                result = await resolved_session.execute(
                    select(Role).where(Role.id.in_(role_ids))  # type: ignore[attr-defined]
                )
                roles = list(result.scalars().all())
                if len(roles) != len(role_ids):
                    raise HTTPException(
                        status_code=404,
                        detail=f"One or more roles not found for IDs: {role_ids}",
                    )
                obj_current.roles = roles
            else:
                obj_current.roles = []

        for field, value in update_data.items():
            setattr(obj_current, field, value)

        try:
            resolved_session.add(obj_current)
            await resolved_session.commit()
        except exc.IntegrityError as e:
            await resolved_session.rollback()
            is_unique_constraint_violation = "UNIQUE constraint failed" in str(
                e
            ) or "duplicate key value violates unique constraint" in str(e)
            if is_unique_constraint_violation:
                raise HTTPException(
                    status_code=409,
                    detail="Email already exists for another user.",
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Database integrity error during update: {e}",
                )
        except HTTPException:
            raise
        except Exception as e:
            await resolved_session.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"An unexpected error occurred during update: {e}",
            )

        await resolved_session.refresh(obj_current)
        await resolved_session.refresh(obj_current, attribute_names=["roles"])
        return obj_current

    def has_verified(self, user: User) -> bool:
        return getattr(user, "is_verified", True)

    async def update_is_active(self, *, db_obj: list[User], obj_in: IUserUpdate) -> list[User] | None:
        db_session: AsyncSession = self.db.session  # type: ignore[assignment]
        if db_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        for x in db_obj:
            if hasattr(obj_in, "is_active") and obj_in.is_active is not None:
                x.is_active = obj_in.is_active
            db_session.add(x)

        await db_session.commit()

        for x in db_obj:
            await db_session.refresh(x)

        return db_obj

    async def authenticate(
        self, *, email: EmailStr, password: str, db_session: AsyncSession | None = None
    ) -> User | None:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        user = await self.get_by_email(email=email, db_session=resolved_session)

        if not user:
            return None

        if user.password is None:
            return None

        if user.is_locked and user.locked_until and user.locked_until > datetime.utcnow():
            return None

        if user.is_locked and user.locked_until and user.locked_until <= datetime.utcnow():
            await self.unlock_account(user=user, db_session=resolved_session)

        if not user.is_active:
            return None

        if not PasswordValidator.verify_password(password, user.password):
            await self.increment_failed_attempts(user=user, db_session=resolved_session)
            return None

        await self.reset_failed_attempts(user=user, db_session=resolved_session)
        return user

    async def remove(self, *, id: UUID | str, db_session: AsyncSession | None = None) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")
        response = await resolved_session.execute(
            select(self.model).where(self.model.id == id)  # type: ignore[attr-defined]
        )
        unique_response = response.unique()
        obj = unique_response.scalar_one()

        await resolved_session.delete(obj)
        await resolved_session.commit()
        return obj

    async def add_password_to_history(
        self,
        *,
        user_id: UUID,
        hashed_password: str,
        created_by_ip: str | None = None,
        reset_token_id: UUID | None = None,
        db_session: AsyncSession | None = None,
    ) -> None:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        history_entry_data = {
            "user_id": user_id,
            "password_hash": hashed_password,
            "created_by_ip": created_by_ip,
        }
        if reset_token_id:
            history_entry_data["reset_token_id"] = reset_token_id

        password_history = UserPasswordHistory(**history_entry_data)
        resolved_session.add(password_history)
        await resolved_session.commit()

    async def is_password_reused(
        self,
        *,
        user_id: UUID,
        new_password_hash: str,
        db_session: AsyncSession | None = None,
    ) -> bool:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        limit = settings.PREVENT_PASSWORD_REUSE
        if limit <= 0:
            return False
        result = await resolved_session.execute(
            select(UserPasswordHistory.password_hash)  # type: ignore[arg-type]
            .where(UserPasswordHistory.user_id == user_id)  # type: ignore[attr-defined]
            .order_by(desc(UserPasswordHistory.created_at))  # type: ignore[attr-defined]
            .limit(limit)
        )
        history_hashes = result.scalars().all()
        return new_password_hash in history_hashes

    async def is_password_in_history(
        self,
        *,
        user_id: UUID,
        new_password: str,
        db_session: AsyncSession | None = None,
    ) -> bool:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        limit = settings.PASSWORD_HISTORY_SIZE
        if limit <= 0:
            return False
        result = await resolved_session.execute(
            select(UserPasswordHistory)
            .where(UserPasswordHistory.user_id == user_id)  # type: ignore[attr-defined]
            .order_by(desc(UserPasswordHistory.created_at))  # type: ignore[attr-defined]
            .limit(limit)
        )
        history_entries = result.scalars().all()

        return any(
            PasswordValidator.verify_password(new_password, entry.password_hash) for entry in history_entries
        )

    async def update_password(
        self,
        *,
        user: User,
        new_password: str,
        db_session: AsyncSession | None = None,
        created_by_ip: str | None = None,
        reset_token_id: UUID | None = None,
    ) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        if settings.PASSWORD_HISTORY_SIZE > 0 and await self.is_password_in_history(
            user_id=user.id, new_password=new_password, db_session=resolved_session
        ):
            raise ValueError(f"Cannot reuse any of your last {settings.PASSWORD_HISTORY_SIZE} passwords.")

        new_password_hash = PasswordValidator.get_password_hash(new_password)

        if settings.PREVENT_PASSWORD_REUSE > 0 and await self.is_password_reused(
            user_id=user.id,
            new_password_hash=new_password_hash,
            db_session=resolved_session,
        ):
            raise ValueError("This password has been used too recently. Please choose a different one.")
        if user.password is None:
            raise ValueError("Current user password is not set. Cannot add to history.")

        await self.add_password_to_history(
            user_id=user.id,
            hashed_password=user.password,
            created_by_ip=created_by_ip,
            reset_token_id=reset_token_id,
            db_session=resolved_session,
        )

        user.password = new_password_hash
        user.last_changed_password_date = datetime.now(timezone.utc)
        user.password_version += 1
        resolved_session.add(user)
        await resolved_session.commit()
        await resolved_session.refresh(user)

        return user

    async def increment_failed_attempts(self, *, user: User, db_session: AsyncSession | None = None) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        if user.number_of_failed_attempts is None:
            user.number_of_failed_attempts = 1
        else:
            user.number_of_failed_attempts += 1

        if user.number_of_failed_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.is_locked = True
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
        try:
            resolved_session.add(user)
            await resolved_session.commit()
            await resolved_session.refresh(user)
        except Exception as e:
            await resolved_session.rollback()
            # Consider logging 'e'
            raise HTTPException(status_code=500, detail=f"Error updating failed attempts: {str(e)}")
        return user

    async def reset_failed_attempts(self, *, user: User, db_session: AsyncSession | None = None) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        user.number_of_failed_attempts = 0
        resolved_session.add(user)
        await resolved_session.commit()
        await resolved_session.refresh(user)
        return user

    async def unlock_account(self, *, user: User, db_session: AsyncSession | None = None) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        user.is_locked = False
        user.locked_until = None
        user.number_of_failed_attempts = 0

        resolved_session.add(user)
        await resolved_session.commit()
        await resolved_session.refresh(user)
        return user

    async def add_roles_by_ids(
        self,
        *,
        user_id: UUID,
        role_ids: list[UUID],
        db_session: AsyncSession | None = None,
    ) -> User:
        resolved_session: AsyncSession = db_session or self.db.session  # type: ignore[assignment]
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        user = await self.get(id=user_id, db_session=resolved_session)  # type: ignore[arg-type]
        if not user:
            raise HTTPException(status_code=404, detail=f"User with id {user_id} not found")

        roles_result = await resolved_session.execute(
            select(Role).where(Role.id.in_(role_ids))  # type: ignore[attr-defined]
        )
        roles_to_add = list(roles_result.scalars().all())  # Ensure it's a list

        if len(roles_to_add) != len(role_ids):
            found_role_ids = {role.id for role in roles_to_add}
            missing_role_ids = [rid for rid in role_ids if rid not in found_role_ids]
            raise HTTPException(
                status_code=404,
                detail=f"One or more roles not found for IDs: {missing_role_ids}",
            )

        if user.roles is None:  # Ensure user.roles is a list
            user.roles = []

        for role in roles_to_add:
            if role not in user.roles:
                user.roles.append(role)

        resolved_session.add(user)
        await resolved_session.commit()
        await resolved_session.refresh(user, attribute_names=["roles"])
        return user


user_crud = CRUDUser(User)
# Keep the original name for backward compatibility
user = user_crud
