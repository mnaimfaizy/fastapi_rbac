from typing import Any
from app.models.user_model import User


def serialize_user(user: User) -> dict[str, Any]:
    """
    Serialize a user object into a standardized dictionary format.
    This helper function provides consistent user serialization across endpoints.
    """
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "needs_to_change_password": user.needs_to_change_password,
        "expiry_date": user.expiry_date,
        "contact_phone": user.contact_phone,
        "last_changed_password_date": user.last_changed_password_date,
        "number_of_failed_attempts": user.number_of_failed_attempts,
        "is_locked": user.is_locked,
        "locked_until": user.locked_until,
        "verified": user.verified,
        "roles": (
            [{"id": str(role.id), "name": role.name, "description": role.description} for role in user.roles]
            if user.roles
            else []
        ),
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
