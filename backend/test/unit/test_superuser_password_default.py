"""Production refuses the shipped FIRST_SUPERUSER_PASSWORD (#272).

The default passes the password policy so that development and test seeding
work, which also means seeding would not stop a production deployment that
forgot to set its own. The production settings check does.
"""

from test.utils import random_strong_password

import pytest

from app.core.config import DEFAULT_FIRST_SUPERUSER_PASSWORD, ModeEnum, Settings, settings
from app.core.security import PasswordValidator


def _production_copy(**overrides: object) -> Settings:
    """The loaded settings switched to production, with every other production check satisfied."""
    strong = "p" * 40
    return settings.model_copy(
        update={
            "MODE": ModeEnum.production,
            "SECRET_KEY": strong,
            "JWT_REFRESH_SECRET_KEY": strong,
            "JWT_RESET_SECRET_KEY": strong,
            "ENCRYPT_KEY": strong,
            "DATABASE_HOST": "db.internal",
            **overrides,
        }
    )


def test_the_default_passes_the_policy() -> None:
    # Otherwise development seeding would refuse it.
    assert PasswordValidator.validate_complexity(DEFAULT_FIRST_SUPERUSER_PASSWORD)[0]


def test_production_refuses_the_default() -> None:
    production = _production_copy(FIRST_SUPERUSER_PASSWORD=DEFAULT_FIRST_SUPERUSER_PASSWORD)

    with pytest.raises(AssertionError, match="FIRST_SUPERUSER_PASSWORD"):
        production.validate_production_settings()


def test_production_accepts_a_deployment_password() -> None:
    production = _production_copy(FIRST_SUPERUSER_PASSWORD=random_strong_password())

    assert production.validate_production_settings() is production
