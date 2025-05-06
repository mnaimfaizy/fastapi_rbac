from typing import Any
from app.models.role_model import Role


def serialize_role(role: Role) -> dict[str, Any]:
    """
    Serialize a role model instance into a dictionary format suitable for API responses.

    Args:
        role: The Role model instance to serialize

    Returns:
        A dictionary containing the serialized role data
    """
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
        "created_by_id": role.created_by_id,
        "role_group_id": role.role_group_id,
        "permissions": (
            [
                {"id": perm.id, "name": perm.name, "description": perm.description, "group_id": perm.group_id}
                for perm in role.permissions
            ]
            if hasattr(role, "permissions")
            else []
        ),
    }
