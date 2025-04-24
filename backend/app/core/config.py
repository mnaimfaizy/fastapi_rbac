import os
import secrets
from enum import Enum
from typing import Any

from pydantic import AnyHttpUrl, EmailStr, PostgresDsn, field_validator
from pydantic_core.core_schema import FieldValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the path of the directory containing the current script (config.py)
current_dir = os.path.dirname(os.path.abspath(__file__))

# Navigate two directories up to reach the project root directory
project_root = os.path.dirname(os.path.dirname(current_dir))


class ModeEnum(str, Enum):
    development = "development"
    production = "production"
    testing = "testing"


class Settings(BaseSettings):
    MODE: ModeEnum = ModeEnum.development
    API_VERSION: str = "v1"
    API_V1_STR: str = f"/api/{API_VERSION}"
    PROJECT_NAME: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 1  # 1 hour
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 100  # 100 days
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    PASSWORD_RESET_URL: str = (
        "http://localhost:3000/reset-password"  # Frontend URL for password reset
    )
    # Email configuration
    EMAILS_ENABLED: bool = True
    SMTP_TLS: bool = True
    SMTP_HOST: str = "fastapi_mailhog" if ModeEnum.development else ""
    SMTP_PORT: int = 1025 if ModeEnum.development else 587
    SMTP_USER: str = "" if ModeEnum.development else ""
    SMTP_PASSWORD: str = "" if ModeEnum.development else ""
    EMAILS_FROM_EMAIL: str = "info@fastapi-rbac.com"
    EMAILS_FROM_NAME: str = "FastAPI RBAC"
    EMAIL_TEMPLATES_DIR: str = os.path.join(project_root, "app", "email-templates")

    DATABASE_USER: str
    DATABASE_PASSWORD: str
    DATABASE_HOST: str
    DATABASE_PORT: int
    DATABASE_NAME: str
    DATABASE_CELERY_NAME: str = "celery_schedule_jobs"
    REDIS_HOST: str
    REDIS_PORT: str
    DB_POOL_SIZE: int = 83
    WEB_CONCURRENCY: int = 9
    POOL_SIZE: int = max(DB_POOL_SIZE // WEB_CONCURRENCY, 5)
    ASYNC_DATABASE_URI: PostgresDsn | str = ""
    ALGORITHM: str = "HS256"
    TOKEN_ISSUER: str
    TOKEN_AUDIENCE: str
    # PgAdmin settings that are in the env file but not needed by the app
    PGADMIN_DEFAULT_EMAIL: str = "admin@example.com"
    PGADMIN_DEFAULT_PASSWORD: str = "admin"

    @field_validator("ASYNC_DATABASE_URI", mode="after")
    def assemble_db_connection(cls, v: str | None, info: FieldValidationInfo) -> Any:
        if isinstance(v, str):
            if v == "":
                return PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=info.data["DATABASE_USER"],
                    password=info.data["DATABASE_PASSWORD"],
                    host=info.data["DATABASE_HOST"],
                    port=info.data["DATABASE_PORT"],
                    path=info.data["DATABASE_NAME"],
                )
        return v

    SYNC_CELERY_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("SYNC_CELERY_DATABASE_URI", mode="after")
    def assemble_celery_db_connection(
        cls, v: str | None, info: FieldValidationInfo
    ) -> Any:
        if isinstance(v, str):
            if v == "":
                return PostgresDsn.build(
                    scheme="db+postgresql",
                    username=info.data["DATABASE_USER"],
                    password=info.data["DATABASE_PASSWORD"],
                    host=info.data["DATABASE_HOST"],
                    port=info.data["DATABASE_PORT"],
                    path=info.data["DATABASE_CELERY_NAME"],
                )
        return v

    SYNC_CELERY_BEAT_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("SYNC_CELERY_BEAT_DATABASE_URI", mode="after")
    def assemble_celery_beat_db_connection(
        cls, v: str | None, info: FieldValidationInfo
    ) -> Any:
        if isinstance(v, str):
            if v == "":
                return PostgresDsn.build(
                    scheme="postgresql+psycopg2",
                    username=info.data["DATABASE_USER"],
                    password=info.data["DATABASE_PASSWORD"],
                    host=info.data["DATABASE_HOST"],
                    port=info.data["DATABASE_PORT"],
                    path=info.data["DATABASE_CELERY_NAME"],
                )
        return v

    ASYNC_CELERY_BEAT_DATABASE_URI: PostgresDsn | str = ""

    @field_validator("ASYNC_CELERY_BEAT_DATABASE_URI", mode="after")
    def assemble_async_celery_beat_db_connection(
        cls, v: str | None, info: FieldValidationInfo
    ) -> Any:
        if isinstance(v, str):
            if v == "":
                return PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=info.data["DATABASE_USER"],
                    password=info.data["DATABASE_PASSWORD"],
                    host=info.data["DATABASE_HOST"],
                    port=info.data["DATABASE_PORT"],
                    path=info.data["DATABASE_CELERY_NAME"],
                )
        return v

    FIRST_SUPERUSER_EMAIL: EmailStr
    FIRST_SUPERUSER_PASSWORD: str
    USER_CHANGED_PASSWORD_DATE: str
    USERS_OPEN_REGISTRATION: bool

    JWT_REFRESH_SECRET_KEY: str
    JWT_RESET_SECRET_KEY: str  # Secret key for password reset tokens
    ENCRYPT_KEY: str
    BACKEND_CORS_ORIGINS: list[str] | list[AnyHttpUrl]

    @field_validator("BACKEND_CORS_ORIGINS")
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str] | str:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=os.path.join(project_root, "backend.env"),
        extra="ignore",  # Allow and ignore extra fields from env file
    )


settings = Settings()
