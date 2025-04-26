from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.security import get_password_hash, verify_password
from app.crud.base_crud import CRUDBase
from app.models.password_history_model import UserPasswordHistory
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, IUserUpdate
from pydantic import EmailStr
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession


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
        For now, assuming all users are verified unless there's a specific field
        for it. If there is an is_verified field in your User model, modify this
        method accordingly.
        """
        if hasattr(user, "is_verified"):
            return user.is_verified
        return True

    async def update_is_active(
        self, *, db_obj: list[User], obj_in: int | str | dict[str, Any]
    ) -> list[User] | None:
        """Update is_active status for multiple users in a batch operation"""
        db_session = super().get_db().session

        # Add all objects to the session at once
        for x in db_obj:
            x.is_active = obj_in.is_active
            db_session.add(x)

        # Commit once for all objects
        await db_session.commit()

        # Refresh all objects
        for x in db_obj:
            await db_session.refresh(x)

        return db_obj

    async def authenticate(
        self, *, email: EmailStr, password: str, db_session: AsyncSession | None = None
    ) -> User | None:
        db_session = db_session or super().get_db().session
        user = await self.get_by_email(email=email)

        # If user doesn't exist, return None (don't reveal that the user doesn't exist)
        if not user:
            return None

        # Check if the account is locked
        if (
            user.is_locked
            and user.locked_until
            and user.locked_until > datetime.utcnow()
        ):
            # Account is still locked
            return None

        # If the account was locked but the lock period has expired, unlock it
        if (
            user.is_locked
            and user.locked_until
            and user.locked_until <= datetime.utcnow()
        ):
            await self.unlock_account(user=user, db_session=db_session)

        # Verify password
        if not verify_password(password, user.password):
            # Increment failed attempts counter
            await self.increment_failed_attempts(user=user, db_session=db_session)
            return None

        # Password is correct, reset failed attempts counter
        await self.reset_failed_attempts(user=user, db_session=db_session)
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

    async def add_to_password_history(
        self,
        *,
        user_id: UUID,
        password_hash: str,
        db_session: AsyncSession | None = None,
    ) -> None:
        """Add a password to the user's password history"""
        db_session = db_session or super().get_db().session
        password_history = UserPasswordHistory(user_id=user_id, password=password_hash)
        db_session.add(password_history)
        await db_session.commit()

    async def is_password_in_history(
        self,
        *,
        user_id: UUID,
        new_password: str,
        db_session: AsyncSession | None = None,
    ) -> bool:
        """Check if a password exists in the user's password history"""
        db_session = db_session or super().get_db().session

        # Get the last 5 password history entries
        result = await db_session.execute(
            select(UserPasswordHistory)
            .where(UserPasswordHistory.user_id == user_id)
            .order_by(UserPasswordHistory.created_at.desc())
            .limit(5)
        )
        history_entries = result.scalars().all()

        # Compare plain new password with each hashed historical password
        return any(
            verify_password(new_password, entry.password) for entry in history_entries
        )

    async def update_password(
        self, *, user: User, new_password: str, db_session: AsyncSession | None = None
    ) -> User:
        """Update user password and manage password history"""
        db_session = db_session or super().get_db().session

        # Check if password is in history
        if await self.is_password_in_history(
            user_id=user.id, new_password=new_password, db_session=db_session
        ):
            raise ValueError("Cannot reuse any of your last 5 passwords")

        # Add current password to history before updating
        await self.add_to_password_history(
            user_id=user.id,
            password_hash=user.password,  # Current password is already hashed
            db_session=db_session,
        )

        # Hash the new password and update user
        new_password_hash = get_password_hash(new_password)
        user.password = new_password_hash
        user.last_changed_password_date = datetime.utcnow()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        return user

    async def increment_failed_attempts(
        self, *, user: User, db_session: AsyncSession | None = None
    ) -> User:
        """
        Increment the number of failed login attempts and lock the account if it reaches the threshold.
        """
        db_session = db_session or super().get_db().session

        # Initialize if None - this is critical since the field may be NULL in the database
        if user.number_of_failed_attempts is None:
            user.number_of_failed_attempts = 1
        else:
            # Increment the counter
            user.number_of_failed_attempts += 1

        print(
            f"Incremented failed attempts for user {user.email} to {user.number_of_failed_attempts}"
        )

        # Check if we need to lock the account (3 failed attempts)
        if user.number_of_failed_attempts >= 3:
            # Lock the account for 24 hours
            user.is_locked = True
            user.locked_until = datetime.utcnow() + timedelta(hours=24)
            print(f"Locking account for user {user.email} until {user.locked_until}")

        # Save the changes - use explicit transaction to ensure changes are committed
        try:
            db_session.add(user)
            await db_session.commit()
            await db_session.refresh(user)
            print(
                f"After commit: User {user.email} - failed attempts: {user.number_of_failed_attempts}, locked: {user.is_locked}"
            )
        except Exception as e:
            await db_session.rollback()
            print(f"Error updating failed attempts: {str(e)}")
            raise

        return user

    async def reset_failed_attempts(
        self, *, user: User, db_session: AsyncSession | None = None
    ) -> User:
        """
        Reset the number of failed login attempts to zero.
        """
        db_session = db_session or super().get_db().session

        user.number_of_failed_attempts = 0
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    async def unlock_account(
        self, *, user: User, db_session: AsyncSession | None = None
    ) -> User:
        """
        Unlock a user's account by resetting the lock status and counter.
        """
        db_session = db_session or super().get_db().session

        user.is_locked = False
        user.locked_until = None
        user.number_of_failed_attempts = 0

        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user


user = CRUDUser(User)
