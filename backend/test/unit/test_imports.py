"""
Unit test: Import checks for FastAPI RBAC backend models and schemas.

This module provides unit tests to verify that all required imports work as expected.
Move or copy this file to test/unit/ if you want to keep it as a reference for import checks.
"""


def test_imports_working() -> None:
    """Test that all required imports are working."""
    from app.core.config import settings
    from app.main import app
    from app.models.permission_model import Permission
    from app.models.role_model import Role
    from app.models.user_model import User
    from app.schemas.permission_schema import IPermissionRead
    from app.schemas.role_schema import IRoleRead
    from app.schemas.user_schema import IUserRead

    assert settings is not None
    assert app is not None
    assert User is not None
    assert Role is not None
    assert Permission is not None
    assert IUserRead is not None
    assert IRoleRead is not None
    assert IPermissionRead is not None
