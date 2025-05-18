"""
User-related model factories for testing.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Sequence, cast

import factory
from factory import Faker
from factory.alchemy import SQLAlchemyModelFactory
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.role_model import Role
from app.models.user_model import User
from app.utils.uuid6 import uuid7


class UserFactory(SQLAlchemyModelFactory):
    """Factory for creating User model instances."""

    _sa_session: Session

    class Meta:
        model = User
        sqlalchemy_session_persistence = "commit"  # Save to database
        sqlalchemy_session: Optional[Session] = None

    id = factory.LazyFunction(uuid7)
    email = Faker("email")
    first_name = Faker("first_name")
    last_name = Faker("last_name")
    password = factory.LazyFunction(lambda: get_password_hash("password123"))
    contact_phone = Faker("phone_number")
    is_active = True
    is_superuser = False
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    needs_to_change_password = False
    verified = True

    @classmethod
    def _setup_next_sequence(cls) -> int:
        """Start sequence from a random point to avoid conflicts."""
        return 1000

    @factory.post_generation
    def roles(self, create: bool, extracted: Optional[Sequence[Role]], **kwargs: Any) -> None:
        """Add roles to the user if provided."""
        if not create or not extracted:
            return

        # Add the roles to the user
        if hasattr(self, "user_roles") and hasattr(extracted, "__iter__"):
            from app.models.user_role_model import UserRole

            # typing.cast is already imported in the file from previous usage
            # Use the SQLAlchemy session provided by Factory Boy
            # self is the User instance here. _sa_session is dynamically added by factory_boy.
            # Mypy may not know about _sa_session, so we use getattr and cast.
            session: Session = cast(Session, getattr(self, "_sa_session"))
            for role in extracted:
                user_role = UserRole(user_id=self.id, role_id=role.id)
                session.add(user_role)
                session.flush()

    @classmethod
    def admin(cls, **kwargs: Any) -> User:
        """Create a superuser/admin."""
        email = kwargs.pop("email", "admin@example.com")
        return cast(User, cls.create(is_superuser=True, email=email, **kwargs))

    @classmethod
    def locked(cls, **kwargs: Any) -> User:
        """Create a locked user."""
        now = datetime.now(timezone.utc)
        return cast(
            User,
            cls.create(
                is_locked=True, number_of_failed_attempts=5, locked_until=now + timedelta(hours=1), **kwargs
            ),
        )

    @classmethod
    def expired_password(cls, **kwargs: Any) -> User:
        """Create a user that needs to change password."""
        return cast(User, cls.create(needs_to_change_password=True, **kwargs))

    @classmethod
    def unverified(cls, **kwargs: Any) -> User:
        """Create an unverified user with verification code."""
        import random
        import string

        verification_code = "".join(random.choices(string.digits, k=6))
        return cast(User, cls.create(verified=False, verification_code=verification_code, **kwargs))
