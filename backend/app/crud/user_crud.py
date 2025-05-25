from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from pydantic import EmailStr
from sqlalchemy import desc, exc  # Import desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload  # Added for eager loading
from sqlmodel import select

from app.core.config import settings  # Import settings
from app.core.security import PasswordValidator
from app.crud.base_crud import CRUDBase
from app.models.password_history_model import UserPasswordHistory
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, IUserUpdate


class CRUDUser(CRUDBase[User, IUserCreate, IUserUpdate]):
    async def get_by_email(self, *, email: str, db_session: AsyncSession | None = None) -> User | None:
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            # import logging
            # logger = logging.getLogger(__name__)
            # logger.error("Database session not available in CRUDUser.get_by_email")
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        # Eagerly load roles and their permissions
        stmt = (
            select(self.model)
            .where(self.model.email == email)
            .options(selectinload(User.roles).selectinload(Role.permissions))
        )
        result = await resolved_session.execute(stmt)
        # Apply unique() before calling scalar_one_or_none() to handle joined eager loads
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
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            # import logging
            # logger = logging.getLogger(__name__)
            # logger.error("Database session not available in CRUDUser.create_with_role")
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        db_obj = User.model_validate(obj_in)
        db_obj.password = PasswordValidator.get_password_hash(obj_in.password)
        resolved_session.add(db_obj)
        await resolved_session.commit()
        await resolved_session.refresh(db_obj)
        return db_obj

    async def create(
        self,
        *,
        obj_in: IUserCreate | User,
        created_by_id: UUID | str | None = None,
        db_session: AsyncSession | None = None,
    ) -> User:
        """Override the create method to hash the password and handle roles"""
        resolved_session = db_session or self.db.session
        if resolved_session is None:
            # import logging
            # logger = logging.getLogger(__name__)
            # logger.error("Database session not available in CRUDUser.create")
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        role_ids = []
        if isinstance(obj_in, IUserCreate):
            role_ids = obj_in.role_id if obj_in.role_id is not None else []
            # Create a dict without password and role_id
            obj_in_data = obj_in.model_dump(exclude={"password", "role_id"})
            db_obj = User(**obj_in_data)
            # Hash the password
            db_obj.password = PasswordValidator.get_password_hash(obj_in.password)
        else:  # isinstance(obj_in, User)
            # If a User model instance is passed directly, we assume roles are already handled
            # or not applicable in this context. Password should already be hashed.
            db_obj = obj_in

        if created_by_id:
            db_obj.created_by_id = created_by_id

        try:
            # First, add and commit the user to get an ID
            resolved_session.add(db_obj)
            await resolved_session.flush()  # Ensure data is flushed to DB before commit
            await resolved_session.commit()
            await resolved_session.refresh(db_obj)

            # After user is committed, handle roles if role_ids were provided
            if role_ids:
                # Fetch Role objects based on the provided IDs
                result = await resolved_session.exec(select(Role).where(Role.id.in_(role_ids)))
                roles = result.all()
                if len(roles) != len(role_ids):
                    # Handle error: some role IDs were not found
                    await resolved_session.rollback()
                    raise HTTPException(
                        status_code=404,
                        detail=f"One or more roles not found for IDs: {role_ids}",
                    )

                # Now that user has been committed, we can safely set relationships
                db_obj.roles = roles
                await resolved_session.commit()
                await resolved_session.refresh(db_obj)
        except exc.IntegrityError as e:
            await resolved_session.rollback()
            # Check if it's a unique constraint violation (e.g., email)
            is_unique_constraint_violation = "UNIQUE constraint failed" in str(
                e
            ) or "duplicate key value violates unique constraint" in str(e)
            if is_unique_constraint_violation:
                raise HTTPException(
                    status_code=409,
                    detail="User with this email already exists",
                )
            else:
                # Handle other integrity errors if necessary
                raise HTTPException(
                    status_code=500,
                    detail=f"Database integrity error: {e}",
                )
        except HTTPException:  # Re-raise HTTPException (like the 404 for roles)
            raise
        except Exception as e:
            await resolved_session.rollback()
            # Log the exception e
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

        # Make sure roles are loaded for the return value
        await resolved_session.refresh(db_obj, attribute_names=["roles"])
        return db_obj

    async def update(
        self,
        *,
        obj_current: User,
        obj_new: IUserUpdate | dict[str, Any] | User,
        db_session: AsyncSession | None = None,
    ) -> User:
        """Override base update method to handle password hashing and roles"""
        resolved_session = db_session or self.db.session
        if resolved_session is None:
            # import logging
            # logger = logging.getLogger(__name__)
            # logger.error("Database session not available in CRUDUser.update")
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        if isinstance(obj_new, dict):
            update_data = obj_new
        else:
            update_data = obj_new.model_dump(exclude_unset=True)

        # Handle password hashing if password is being updated
        if "password" in update_data and update_data["password"]:
            hashed_password = PasswordValidator.get_password_hash(update_data["password"])
            obj_current.password = hashed_password
            obj_current.last_changed_password_date = datetime.utcnow()
            del update_data["password"]
        elif "password" in update_data:
            del update_data["password"]

        # Handle roles update
        if "role_id" in update_data:
            role_ids = update_data.get("role_id", [])
            if role_ids:
                result = await resolved_session.execute(select(Role).where(Role.id.in_(role_ids)))
                roles = result.scalars().all()
                if len(roles) != len(role_ids):
                    raise HTTPException(
                        status_code=404,
                        detail=f"One or more roles not found for IDs: {role_ids}",
                    )
                obj_current.roles = roles  # Replace existing roles
            else:
                obj_current.roles = []  # Clear roles if empty list
            del update_data["role_id"]

        # Update remaining fields
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
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred during update: {e}")

        # Refresh the object to get updated data and roles
        await resolved_session.refresh(obj_current)
        await resolved_session.refresh(obj_current, attribute_names=["roles"])
        return obj_current

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
        # get_by_email will now eagerly load roles and permissions
        user = await self.get_by_email(email=email, db_session=db_session)

        # If user doesn't exist, return None (don't reveal that the user doesn't exist)
        if not user:
            return None

        # Check if the account is locked
        if user.is_locked and user.locked_until and user.locked_until > datetime.utcnow():
            # Account is still locked
            return None

        # If the account was locked but the lock period has expired, unlock it
        if user.is_locked and user.locked_until and user.locked_until <= datetime.utcnow():
            await self.unlock_account(user=user, db_session=db_session)

        # Check if the account is inactive
        if not user.is_active:
            return None

        # Verify password
        if not PasswordValidator.verify_password(password, user.password):
            # Increment failed attempts counter
            await self.increment_failed_attempts(user=user, db_session=db_session)
            return None

        # Password is correct, reset failed attempts counter
        await self.reset_failed_attempts(user=user, db_session=db_session)
        return user

    async def remove(self, *, id: UUID | str, db_session: AsyncSession | None = None) -> User:
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")
        response = await resolved_session.execute(select(self.model).where(self.model.id == id))
        unique_response = response.unique()
        obj = unique_response.scalar_one()

        await resolved_session.delete(obj)
        await resolved_session.commit()
        return obj

    async def add_password_to_history(
        self,
        *,
        user_id: UUID,
        hashed_password: str,  # Field name in UserPasswordHistory is password_hash
        created_by_ip: str | None = None,
        reset_token_id: UUID | None = None,
        db_session: AsyncSession | None = None,
    ) -> None:
        """Add a password to the user's password history"""
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        history_entry_data = {
            "user_id": user_id,
            "password_hash": hashed_password,  # Corrected field name
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
        """Check if a new password hash exists in the user's recent password history."""
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        limit = settings.PREVENT_PASSWORD_REUSE
        if limit <= 0:  # If prevention is disabled or invalid, consider not reused
            return False

        result = await resolved_session.execute(
            select(UserPasswordHistory.password_hash)
            .where(UserPasswordHistory.user_id == user_id)
            .order_by(desc(UserPasswordHistory.created_at))  # Use imported desc
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
        """Check if a plain password matches any in the user's password history."""
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        limit = settings.PASSWORD_HISTORY_SIZE
        if limit <= 0:  # If history size is zero or invalid, consider not in history
            return False

        result = await resolved_session.execute(
            select(UserPasswordHistory)
            .where(UserPasswordHistory.user_id == user_id)
            .order_by(desc(UserPasswordHistory.created_at))  # Use imported desc
            .limit(limit)
        )
        history_entries = result.scalars().all()

        return any(
            PasswordValidator.verify_password(new_password, entry.password_hash)  # Corrected field
            for entry in history_entries
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
        """Update user password and manage password history"""
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        if settings.PASSWORD_HISTORY_SIZE > 0 and await self.is_password_in_history(
            user_id=user.id, new_password=new_password, db_session=resolved_session
        ):
            raise ValueError(f"Cannot reuse any of your last {settings.PASSWORD_HISTORY_SIZE} passwords.")

        new_password_hash = PasswordValidator.get_password_hash(new_password)

        if settings.PREVENT_PASSWORD_REUSE > 0 and await self.is_password_reused(
            user_id=user.id, new_password_hash=new_password_hash, db_session=resolved_session
        ):
            raise ValueError(
                "This password has been used too recently. Please choose a different one."  # Not an f-string
            )

        if user.password is None:  # Should not happen for an existing user, but good practice
            raise ValueError("Current user password is not set.")

        await self.add_password_to_history(
            user_id=user.id,
            hashed_password=user.password,  # user.password should be str here
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
        """
        Increment the number of failed login attempts
        and lock the account if it reaches the threshold.
        """
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        # Initialize if None - this is critical since
        # the field may be NULL in the database
        if user.number_of_failed_attempts is None:
            user.number_of_failed_attempts = 1
        else:
            # Increment the counter
            user.number_of_failed_attempts += 1

        print(f"Incremented failed attempts for user {user.email} to " f"{user.number_of_failed_attempts}")

        # Check if we need to lock the account (3 failed attempts)
        if user.number_of_failed_attempts >= settings.MAX_LOGIN_ATTEMPTS:  # Use setting
            # Lock the account for 24 hours
            user.is_locked = True
            user.locked_until = datetime.utcnow() + timedelta(
                minutes=settings.ACCOUNT_LOCKOUT_MINUTES
            )  # Use setting
            print(f"Locking account for user {user.email} until {user.locked_until}")

        # Save the changes - use explicit transaction to ensure changes are committed
        try:
            resolved_session.add(user)
            await resolved_session.commit()
            await resolved_session.refresh(user)
            print(
                (
                    f"After commit: User {user.email} - failed attempts: "
                    f"{user.number_of_failed_attempts}, locked: {user.is_locked}"
                )
            )
        except Exception as e:
            await resolved_session.rollback()
            print(f"Error updating failed attempts: {str(e)}")
            raise

        return user

    async def reset_failed_attempts(self, *, user: User, db_session: AsyncSession | None = None) -> User:
        """
        Reset the number of failed login attempts to zero.
        """
        resolved_session = db_session or super().get_db().session
        if resolved_session is None:
            raise HTTPException(status_code=503, detail="Database service temporarily unavailable")

        user.number_of_failed_attempts = 0
        resolved_session.add(user)
        await resolved_session.commit()
        await resolved_session.refresh(user)
        return user

    async def unlock_account(self, *, user: User, db_session: AsyncSession | None = None) -> User:
        """
        Unlock a user's account by resetting the lock status and counter.
        """
        resolved_session = db_session or super().get_db().session
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
        """Adds multiple roles to a user by their IDs."""
        resolved_session = db_session or self.db.session
        user = await self.get(id=user_id, db_session=resolved_session)
        if not user:
            raise HTTPException(status_code=404, detail=f"User with id {user_id} not found")

        # Fetch Role objects based on the provided IDs
        roles_result = await resolved_session.execute(select(Role).where(Role.id.in_(role_ids)))
        roles_to_add = roles_result.scalars().all()

        if len(roles_to_add) != len(role_ids):
            found_role_ids = {role.id for role in roles_to_add}
            missing_role_ids = [rid for rid in role_ids if rid not in found_role_ids]
            raise HTTPException(
                status_code=404,
                detail=f"One or more roles not found for IDs: {missing_role_ids}",
            )

        # Add new roles, avoiding duplicates if user.roles already contains some
        # This assumes user.roles is already loaded or can be loaded here.
        # For simplicity, let's assume we are adding and SQLModel handles duplicates gracefully
        # or the relationship is a set.
        # A more robust way would be to check existing roles:
        # current_role_ids = {role.id for role in user.roles}
        # for role in roles_to_add:
        #     if role.id not in current_role_ids:
        #         user.roles.append(role)

        # Simple append, assuming the ORM handles duplicates or it's not an issue for the setup script
        for role in roles_to_add:
            if role not in user.roles:  # Prevent duplicates if roles already loaded
                user.roles.append(role)

        resolved_session.add(user)
        await resolved_session.commit()
        await resolved_session.refresh(user, attribute_names=["roles"])
        return user


user_crud = CRUDUser(User)
# Keep the original name for backward compatibility
user = user_crud
