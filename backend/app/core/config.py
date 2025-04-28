import os
import secrets
from enum import Enum
from functools import lru_cache
from typing import Any, Dict, List, Optional, Union

from pydantic import AnyHttpUrl, EmailStr, PostgresDsn, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the path of the directory containing the current script (config.py)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Navigate two directories up to reach the project root directory
project_root = os.path.dirname(os.path.dirname(current_dir))

# Create paths to environment files
env_development_file = os.path.join(project_root, ".env.development")
env_test_file = os.path.join(project_root, ".env.test")
env_production_file = os.path.join(project_root, ".env.production")
env_local_file = os.path.join(project_root, ".env.local")
env_file = os.path.join(project_root, "backend.env")  # Legacy env file


class ModeEnum(str, Enum):
    development = "development"
    production = "production"
    testing = "testing"


class DatabaseTypeEnum(str, Enum):
    sqlite = "sqlite"
    postgresql = "postgresql"


class Settings(BaseSettings):
    # Core Settings
    MODE: ModeEnum = ModeEnum.development
    API_VERSION: str = "v1"
    API_V1_STR: str = f"/api/{API_VERSION}"
    PROJECT_NAME: str
    SECRET_KEY: str = secrets.token_urlsafe(32)
    DEBUG: bool = False

    # Database Type Setting
    DATABASE_TYPE: DatabaseTypeEnum = DatabaseTypeEnum.postgresql

    # Token Settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 1  # 1 hour
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 100  # 100 days
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    PASSWORD_RESET_URL: str = "http://localhost:3000/reset-password"
    ALGORITHM: str = "HS256"
    TOKEN_ISSUER: str
    TOKEN_AUDIENCE: str

    # Email Settings
    EMAILS_ENABLED: bool = True
    SMTP_TLS: bool = True
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: str = "info@fastapi-rbac.com"
    EMAILS_FROM_NAME: str = "FastAPI RBAC"
    EMAIL_TEMPLATES_DIR: str = os.path.join(project_root, "app", "email-templates")

    # Database Settings
    DATABASE_USER: Optional[str] = None
    DATABASE_PASSWORD: Optional[str] = None
    DATABASE_HOST: Optional[str] = None
    DATABASE_PORT: Optional[int] = None
    DATABASE_NAME: str = "fastapi_db"
    DATABASE_CELERY_NAME: str = "celery_schedule_jobs"
    SQLITE_DB_PATH: Optional[str] = None
    REDIS_HOST: str
    REDIS_PORT: str
    DB_POOL_SIZE: int = 83
    WEB_CONCURRENCY: int = 9
    POOL_SIZE: int = max(DB_POOL_SIZE // WEB_CONCURRENCY, 5)
    ASYNC_DATABASE_URI: PostgresDsn | str = ""

    # PgAdmin settings
    PGADMIN_DEFAULT_EMAIL: EmailStr = "admin@example.com"
    PGADMIN_DEFAULT_PASSWORD: str = "admin"

    # User Settings
    FIRST_SUPERUSER_EMAIL: EmailStr
    FIRST_SUPERUSER_PASSWORD: str
    USER_CHANGED_PASSWORD_DATE: str
    USERS_OPEN_REGISTRATION: bool = False

    # Security Settings
    JWT_REFRESH_SECRET_KEY: str
    JWT_RESET_SECRET_KEY: str  # Secret key for password reset tokens
    ENCRYPT_KEY: str
    BACKEND_CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = ["http://localhost:3000"]

    # Logging settings
    LOG_LEVEL: str = "INFO"

    # Feature Flags
    ENABLE_ACCOUNT_LOCKOUT: bool = True
    MAX_LOGIN_ATTEMPTS: int = 3
    ACCOUNT_LOCKOUT_MINUTES: int = 60 * 24  # 24 hours
    PASSWORD_HISTORY_SIZE: int = 5  # Number of previous passwords to remember

    @field_validator("BACKEND_CORS_ORIGINS")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @field_validator("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD")
    def set_email_values_based_on_mode(cls, v: Any, info: ValidationInfo) -> Any:
        mode = info.data.get("MODE", ModeEnum.development)
        field_name = info.field_name

        # Default values for development mode
        if mode == ModeEnum.development:
            if field_name == "SMTP_HOST" and not v:
                return "fastapi_mailhog"
            elif field_name == "SMTP_PORT" and not v:
                return 1025
            elif field_name in ["SMTP_USER", "SMTP_PASSWORD"] and not v:
                return ""

        # For production, these fields should be provided
        if mode == ModeEnum.production and not v and field_name in ["SMTP_HOST", "SMTP_PORT"]:
            raise ValueError(f"{field_name} must be set in production mode")

        return v

    @field_validator("ASYNC_DATABASE_URI", mode="after")
    def assemble_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(project_root, "app.db")
                return f"sqlite+aiosqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_NAME"),
                )
        return v

    SYNC_CELERY_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("SYNC_CELERY_DATABASE_URI", mode="after")
    def assemble_celery_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(
                        project_root,
                        f"{info.data.get('DATABASE_CELERY_NAME', 'celery')}.db",
                    )
                return f"sqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+psycopg2",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_CELERY_NAME"),
                )
        return v

    SYNC_CELERY_BEAT_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("SYNC_CELERY_BEAT_DATABASE_URI", mode="after")
    def assemble_celery_beat_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(
                        project_root,
                        f"{info.data.get('DATABASE_CELERY_NAME', 'celery')}.db",
                    )
                return f"sqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+psycopg2",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_CELERY_NAME"),
                )
        return v

    ASYNC_CELERY_BEAT_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("ASYNC_CELERY_BEAT_DATABASE_URI", mode="after")
    def assemble_async_celery_beat_db_connection(cls, v: str | None, info: ValidationInfo) -> Any:
        if isinstance(v, str) and v == "":
            db_type = info.data.get("DATABASE_TYPE", DatabaseTypeEnum.postgresql)

            if db_type == DatabaseTypeEnum.sqlite:
                sqlite_path = info.data.get("SQLITE_DB_PATH")
                if not sqlite_path:
                    sqlite_path = os.path.join(
                        project_root,
                        f"{info.data.get('DATABASE_CELERY_NAME', 'celery')}.db",
                    )
                return f"sqlite+aiosqlite:///{sqlite_path}"
            else:
                # PostgreSQL connection
                return PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=info.data.get("DATABASE_USER"),
                    password=info.data.get("DATABASE_PASSWORD"),
                    host=info.data.get("DATABASE_HOST"),
                    port=info.data.get("DATABASE_PORT"),
                    path=info.data.get("DATABASE_CELERY_NAME"),
                )
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Validate that critical settings are properly set in production mode"""
        if self.MODE == ModeEnum.production:
            # Ensure critical settings are set for production
            assert self.SECRET_KEY != "development_secret", "Change the SECRET_KEY for production"
            assert len(self.SECRET_KEY) >= 32, "SECRET_KEY should be at least 32 characters in production"

            # Validate database configuration if using PostgreSQL
            if self.DATABASE_TYPE == DatabaseTypeEnum.postgresql:
                assert self.DATABASE_HOST != "localhost", "Use a proper DATABASE_HOST in production"

            # Validate security settings
            assert (
                len(self.JWT_REFRESH_SECRET_KEY) >= 32
            ), "JWT_REFRESH_SECRET_KEY should be longer in production"
            assert len(self.JWT_RESET_SECRET_KEY) >= 32, "JWT_RESET_SECRET_KEY should be longer in production"
            assert len(self.ENCRYPT_KEY) >= 32, "ENCRYPT_KEY should be longer in production"
        return self

    def get_environment_specific_settings(self) -> Dict[str, Any]:
        """Return a dictionary of settings that vary by environment"""
        mode = self.MODE

        # Different settings based on environment
        if mode == ModeEnum.development:
            return {
                "DEBUG": True,
                "LOG_LEVEL": "DEBUG",
                "PASSWORD_RESET_URL": "http://localhost:3000/reset-password",
                "DATABASE_TYPE": DatabaseTypeEnum.sqlite,
            }
        elif mode == ModeEnum.testing:
            return {
                "DEBUG": True,
                "LOG_LEVEL": "DEBUG",
                "TESTING": True,
                "PASSWORD_RESET_URL": "http://localhost:3000/reset-password",
                "USERS_OPEN_REGISTRATION": True,
                "DB_POOL_SIZE": 5,
                "WEB_CONCURRENCY": 1,
            }
        elif mode == ModeEnum.production:
            return {
                "DEBUG": False,
                "LOG_LEVEL": "INFO",
                "PASSWORD_RESET_URL": f"https://{self.TOKEN_AUDIENCE}/reset-password",
                "USERS_OPEN_REGISTRATION": False,
                "DATABASE_TYPE": DatabaseTypeEnum.postgresql,
            }

    # This configuration uses the new SettingsConfigDict style in Pydantic v2
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file_encoding="utf-8",
        extra="ignore",  # Allow and ignore extra fields from env file
    )

    # Dynamically select the appropriate env file based on MODE
    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        # Get MODE from environment or default to development
        mode = os.getenv("MODE", ModeEnum.development)

        # Select appropriate env files based on mode
        env_files = []

        # Add default backend.env file if it exists (for backward compatibility)
        if os.path.isfile(env_file):
            env_files.append(env_file)

        # Add mode-specific env file if it exists
        if mode == ModeEnum.development and os.path.isfile(env_development_file):
            env_files.insert(0, env_development_file)
        elif mode == ModeEnum.testing and os.path.isfile(env_test_file):
            env_files.insert(0, env_test_file)
        elif mode == ModeEnum.production and os.path.isfile(env_production_file):
            env_files.insert(0, env_production_file)

        # Add local env file if it exists (highest priority)
        if os.path.isfile(env_local_file):
            env_files.insert(0, env_local_file)

        # Ensure we have at least one env file
        if not env_files:
            env_files = [env_file]  # Use legacy file as fallback

        # In Pydantic v2, we need to create a new dotenv settings instance
        # Pass the settings_cls parameter which is required in Pydantic v2
        new_dotenv = dotenv_settings.__class__(
            settings_cls=settings_cls,
            env_file=env_files,
            env_file_encoding="utf-8",
            env_nested_delimiter=None,
        )

        return (
            init_settings,
            env_settings,
            new_dotenv,
            file_secret_settings,
        )


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.

    This function returns a cached instance of the Settings class to avoid
    reloading environment variables on every call, improving performance.
    The caching is especially important in production environments where
    performance is critical.
    """
    return Settings()


settings = get_settings()
