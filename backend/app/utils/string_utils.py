from typing import Optional


def format_permission_name(permission_name: str, group_name: Optional[str] = None) -> str:
    """
    Formats a permission name by combining the permission group name and permission name
    in lowercase, with dots as separators.

    Examples:
        - Permission: "Access", Group: "Users" -> "users.access"
        - Permission: "Test Permission", Group: "Test Group" -> "test_group.test_permission"

    Args:
        permission_name (str): The name of the permission
        group_name (Optional[str]): The name of the permission group, if available

    Returns:
        str: Formatted permission name
    """
    # Convert to lowercase and replace spaces with dots
    formatted_permission = permission_name.lower().replace(" ", "_")

    # If group name is provided, format it and prepend to the permission name
    if group_name:
        formatted_group = group_name.lower().replace(" ", "_")
        return f"{formatted_group}.{formatted_permission}"

    return formatted_permission
