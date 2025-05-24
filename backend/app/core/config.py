import os
import secrets
from enum import Enum
from functools import lru_cache
from typing import Any, Dict, List, Optional, Union

from pydantic import (
    AnyHttpUrl,
    EmailStr,
    Field,
    PostgresDsn,
    ValidationInfo,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

# Add these imports for settings sources
from pydantic_settings.sources import DotEnvSettingsSource, PydanticBaseSettingsSource


def get_project_root() -> str:
    """Get the project root path based on environment"""
    if os.getenv("FASTAPI_ENV") == "production":
        return "/app"

    # For development and testing
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(os.path.dirname(current_dir))


# Get project root path
project_root = get_project_root()

# Create paths to environment files
env_development_file = os.path.join(project_root, ".env.development")
env_test_file = os.path.join(project_root, ".env.test")
env_production_file = os.path.join(project_root, ".env.production")
env_local_file = os.path.join(project_root, ".env.local")
env_file_legacy = os.path.join(project_root, "backend.env")


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
    PROJECT_NAME: Optional[str] = "FastAPI RBAC"
    DEBUG: bool = False

    # Security Settings
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_REFRESH_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_RESET_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_VERIFICATION_SECRET_KEY: str = secrets.token_urlsafe(32)
    ENCRYPT_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"  # Added JWT Algorithm
    BACKEND_CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = ["http://localhost:3000", "http://localhost:80"]

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:5173"
    PASSWORD_RESET_URL: str = f"{FRONTEND_URL}/reset-password"

    # Database Type Setting
    DATABASE_TYPE: DatabaseTypeEnum = DatabaseTypeEnum.postgresql

    # Token Settings
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 1  # 1 hour
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 100  # 100 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    VERIFICATION_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)  # 24 hours
    UNVERIFIED_ACCOUNT_CLEANUP_HOURS: int = Field(default=72)  # 3 days
    MAX_LOGIN_ATTEMPTS: int = Field(default=5)
    LOCKOUT_DURATION_MINUTES: int = Field(default=15)
    PASSWORD_HISTORY_SIZE: int = Field(default=5)  # Number of old passwords to store
    PREVENT_PASSWORD_REUSE: int = Field(default=5)  # Number of recent passwords to check against
    TOKEN_ISSUER: Optional[str] = None  # Added
    TOKEN_AUDIENCE: Optional[str] = None  # Added

    # Email settings
    EMAILS_ENABLED: bool = Field(default=False)
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
    POSTGRES_URL: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None
    DB_POOL_SIZE: int = 83
    WEB_CONCURRENCY: int = 9
    POOL_SIZE: int = max(DB_POOL_SIZE // WEB_CONCURRENCY, 5)
    ASYNC_DATABASE_URI: PostgresDsn | str = ""

    # Redis Settings
    REDIS_HOST: Optional[str] = None
    REDIS_PORT: Optional[str] = None
    REDIS_PASSWORD: Optional[str] = None
    REDIS_SSL: bool = False

    # PgAdmin settings
    PGADMIN_DEFAULT_EMAIL: EmailStr = "admin@example.com"
    PGADMIN_DEFAULT_PASSWORD: str = "admin"  # User Settings
    FIRST_SUPERUSER_EMAIL: EmailStr = "admin@example.com"
    FIRST_SUPERUSER_PASSWORD: str = "admin123"
    USER_CHANGED_PASSWORD_DATE: Optional[str] = None
    USERS_OPEN_REGISTRATION: bool = False

    # Email Verification Settings
    EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    EMAIL_VERIFICATION_URL: str = FRONTEND_URL + "/verify-email"

    # Logging settings
    LOG_LEVEL: str = "INFO"

    # Feature Flags
    ENABLE_ACCOUNT_LOCKOUT: bool = True
    ACCOUNT_LOCKOUT_MINUTES: int = 60 * 24  # 24 hours

    # Registration Security Settings
    MAX_REGISTRATION_ATTEMPTS_PER_HOUR: int = 5
    MAX_REGISTRATION_ATTEMPTS_PER_EMAIL: int = 3
    UNVERIFIED_ACCOUNT_CLEANUP_DELAY_HOURS: int = 24  # ADDED to match auth.py usage
    EMAIL_DOMAIN_BLACKLIST: List[str] = []
    EMAIL_DOMAIN_ALLOWLIST: List[str] = []  # Empty means all domains allowed

    # Enhanced Security Settings
    PASSWORD_MIN_LENGTH: int = 12  # NIST recommends at least 8, we use 12
    PASSWORD_MAX_LENGTH: int = 128  # Reasonable maximum length
    PASSWORD_REQUIRE_UPPERCASE: bool = True  # At least one uppercase letter
    PASSWORD_REQUIRE_LOWERCASE: bool = True  # At least one lowercase letter
    PASSWORD_REQUIRE_DIGITS: bool = True  # At least one digit
    PASSWORD_REQUIRE_SPECIAL: bool = True  # At least one special character
    PASSWORD_SPECIAL_CHARS: str = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    PASSWORD_HASHING_ITERATIONS: int = 12  # bcrypt work factor (12 is good balance)
    PASSWORD_PREVENT_REUSE: bool = True  # Prevent reuse of recent passwords
    COMMON_PASSWORDS: List[str] = [  # List of commonly used passwords to prevent
        "password",
        "123456",
        "qwerty",
        "abc123",
        "letmein",
        "admin",
        "welcome",
        "monkey",
        "password1",
        "123456789",
        "football",
        "000000",
        "qwerty123",
        "1234567",
        "123123",
        "12345678",
        "dragon",
        "baseball",
        "abc123",
        "football",
        "monkey",
        "letmein",
        "shadow",
        "master",
        "666666",
        "qwertyuiop",
        "123321",
        "mustang",
        "123456",
        "michael",
        "superman",
        "princess",
        "password1",
        "123qwe",
        "password123",
    ]
    PREVENT_COMMON_PASSWORDS: bool = True  # Prevent use of common passwords
    PREVENT_SEQUENTIAL_CHARS: bool = True  # Prevent use of sequential characters (e.g., abc, 123)
    PASSWORD_PEPPER: Optional[str] = None  # Optional pepper for password hashing
    PREVENT_REPEATED_CHARS: bool = True  # Prevent use of too many repeated characters

    # Account Security Settings
    MAX_PASSWORD_CHANGE_ATTEMPTS: int = 3  # Maximum password change attempts per hour
    ACCOUNT_LOCKOUT_DURATION: int = 1800  # 30 minutes lockout
    REQUIRE_PASSWORD_CHANGE_DAYS: int = 90  # Force password change every 90 days
    ENABLE_BRUTE_FORCE_PROTECTION: bool = True
    BRUTE_FORCE_TIME_WINDOW: int = 3600  # 1 hour window for attempt counting
    PASSWORD_MIN_AGE_HOURS: int = 24  # Minimum time between password changes
    LOGIN_HISTORY_DAYS: int = 90  # Keep login history for 90 days

    # Session Security
    SESSION_MAX_AGE: int = 3600  # 1 hour
    SESSION_EXTEND_ON_ACTIVITY: bool = True  # Reset timer on activity
    REQUIRE_MFA_AFTER_INACTIVITY: bool = True
    INACTIVITY_TIMEOUT: int = 1800  # 30 minutes of inactivity
    CONCURRENT_SESSION_LIMIT: int = 5  # Maximum concurrent sessions

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://{REDIS_HOST}:{REDIS_PORT}/0"
    CELERY_RESULT_BACKEND: str = "redis://{REDIS_HOST}:{REDIS_PORT}/0"

    # Celery Task Settings
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"

    # Celery Beat Settings
    CELERY_BEAT_SCHEDULER: str = "django_celery_beat.schedulers:DatabaseScheduler"
    CELERY_BEAT_MAX_LOOP_INTERVAL: int = 5

    # Task Queue Settings
    CELERY_TASK_DEFAULT_QUEUE: str = "default"
    CELERY_TASK_DEFAULT_EXCHANGE: str = "default"
    CELERY_TASK_DEFAULT_ROUTING_KEY: str = "default"

    # Task Execution Settings
    CELERY_TASK_TIME_LIMIT: int = 5 * 60  # 5 minutes
    CELERY_TASK_SOFT_TIME_LIMIT: int = 60  # 1 minute
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = 1

    # Task Routing Configuration
    CELERY_TASK_ROUTES: Dict[str, Dict[str, str]] = {
        "app.tasks.high_priority.*": {
            "queue": "high_priority",
            "routing_key": "high_priority",
        },
        "app.tasks.low_priority.*": {
            "queue": "low_priority",
            "routing_key": "low_priority",
        },
    }

    CELERY_TASK_QUEUES: List[Dict[str, Any]] = [
        {
            "name": "default",
            "exchange": "default",
            "routing_key": "default",
        },
        {
            "name": "high_priority",
            "exchange": "high_priority",
            "routing_key": "high_priority",
        },
        {
            "name": "low_priority",
            "exchange": "low_priority",
            "routing_key": "low_priority",
        },
    ]

    # Rate Limiting and Security Settings
    MAX_VERIFICATION_ATTEMPTS_PER_HOUR: int = 5
    VERIFICATION_COOLDOWN_SECONDS: int = 300  # 5 minutes between attempts
    RATE_LIMIT_PERIOD_SECONDS: int = 3600  # 1 hour for rate limiting window
    # ADDED missing settings for resend verification email rate limits
    MAX_RESEND_VERIFICATION_ATTEMPTS_PER_HOUR: int = 3
    RATE_LIMIT_PERIOD_RESEND_VERIFICATION_SECONDS: int = 3600

    # Token Security
    ACCESS_TOKEN_ENTROPY_BITS: int = 256  # Entropy for token generation
    VERIFY_TOKEN_ON_EVERY_REQUEST: bool = True
    TOKEN_VERSION_ON_PASSWORD_CHANGE: bool = True  # Invalidate tokens on password change
    VALIDATE_TOKEN_IP: bool = True  # Validate token against original IP
    TOKEN_BLACKLIST_ON_LOGOUT: bool = True  # Add tokens to blacklist on logout
    TOKEN_BLACKLIST_EXPIRY: int = 86400  # Keep blacklisted tokens for 24 hours

    # Rate Limiting and Security Settings
    # MAX_VERIFICATION_ATTEMPTS_PER_HOUR: int = 5
    # VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    # VERIFICATION_COOLDOWN_SECONDS: int = 300  # 5 minutes between attempts
    # RATE_LIMIT_PERIOD_SECONDS: int = 3600  # 1 hour for rate limiting window

    # Registration Security Settings
    # MAX_REGISTRATION_ATTEMPTS_PER_HOUR: int = 5
    # MAX_REGISTRATION_ATTEMPTS_PER_EMAIL: int = 3
    # UNVERIFIED_ACCOUNT_CLEANUP_HOURS: int = 24
    # EMAIL_DOMAIN_BLACKLIST: List[str] = []
    # EMAIL_DOMAIN_ALLOWLIST: List[str] = []

    @field_validator("BACKEND_CORS_ORIGINS")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        elif isinstance(v, str):
            return [v]
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
                # Check if we have a full Postgres URL (Supabase style)
                postgres_url = info.data.get("POSTGRES_URL")
                if postgres_url:
                    # Parse the existing URL and modify it to use asyncpg
                    return postgres_url.replace("postgres://", "postgresql+asyncpg://")

                # Fallback to building the URL from components
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

    def get_celery_redis_url(self) -> str:
        """Build Redis URL for Celery broker and backend"""
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @field_validator("CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", mode="after")
    def assemble_redis_urls(cls, v: str, info: ValidationInfo) -> str:
        if isinstance(v, str) and "{" in v:  # If it's a template string
            redis_host = info.data.get("REDIS_HOST", "localhost")
            redis_port = info.data.get("REDIS_PORT", "6379")

            scheme = "redis"
            if info.data.get("MODE") == ModeEnum.production:
                # If in production, assume SSL is used based on celery_config.py modifications
                scheme = "rediss"

            return f"{scheme}://{redis_host}:{redis_port}/0"
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
                self.JWT_REFRESH_SECRET_KEY is not None
            ), "JWT_REFRESH_SECRET_KEY must be set in .env for production mode"
            assert (
                len(self.JWT_REFRESH_SECRET_KEY) >= 32
            ), "JWT_REFRESH_SECRET_KEY should be at least 32 characters in production"

            assert (
                self.JWT_RESET_SECRET_KEY is not None
            ), "JWT_RESET_SECRET_KEY must be set in .env for production mode"
            assert (
                len(self.JWT_RESET_SECRET_KEY) >= 32
            ), "JWT_RESET_SECRET_KEY should be at least 32 characters in production"

            assert self.ENCRYPT_KEY is not None, "ENCRYPT_KEY must be set in .env for production mode"
            assert len(self.ENCRYPT_KEY) >= 32, "ENCRYPT_KEY should be at least 32 characters in production"
        return self

    @model_validator(mode="after")
    def ensure_required_fields_are_loaded(self) -> "Settings":
        # These fields must be loaded from the environment (env vars or .env files)
        # and should not be None after initialization.
        # This validation runs after all sources (model_config, init_kwargs, env_vars,
        # dotenv_files, secrets_dir)
        required_fields_from_env = {
            "PROJECT_NAME",
            "TOKEN_ISSUER",
            "TOKEN_AUDIENCE",
            "REDIS_HOST",
            "REDIS_PORT",
            "FIRST_SUPERUSER_EMAIL",
            "FIRST_SUPERUSER_PASSWORD",
            "USER_CHANGED_PASSWORD_DATE",
            "JWT_REFRESH_SECRET_KEY",
            "JWT_RESET_SECRET_KEY",
            "ENCRYPT_KEY",
        }

        missing_fields = []
        for field_name in required_fields_from_env:
            if getattr(self, field_name) is None:
                missing_fields.append(field_name)

        if missing_fields:
            raise ValueError(
                f"Missing required environment settings: {', '.join(missing_fields)}. "
                "Please ensure they are set in your .env file or environment variables."
            )
        return self

    def get_environment_specific_settings(self) -> Dict[str, Any]:
        """Return a dictionary of settings that vary by environment"""
        mode = self.MODE  # Different settings based on environment
        base_settings = {}
        if mode == ModeEnum.development:
            base_settings = {
                "DEBUG": True,
                "LOG_LEVEL": "DEBUG",
                "PASSWORD_RESET_URL": "http://localhost:3000/reset-password",
                "DATABASE_TYPE": DatabaseTypeEnum.sqlite,
                # Development Celery settings
                "CELERY_TASK_ALWAYS_EAGER": True,  # Run tasks synchronously
                "CELERY_TASK_EAGER_PROPAGATES": True,
                "CELERY_WORKER_PREFETCH_MULTIPLIER": 1,
            }
        elif mode == ModeEnum.testing:
            base_settings = {
                "DEBUG": True,
                "LOG_LEVEL": "DEBUG",
                "TESTING": True,
                "PASSWORD_RESET_URL": "http://localhost:3000/reset-password",
                "USERS_OPEN_REGISTRATION": True,
                "DB_POOL_SIZE": 5,
                "WEB_CONCURRENCY": 1,
                # Testing Celery settings
                "CELERY_TASK_ALWAYS_EAGER": True,
                "CELERY_TASK_EAGER_PROPAGATES": True,
            }
        elif mode == ModeEnum.production:
            base_settings = {
                "DEBUG": False,
                "LOG_LEVEL": "INFO",
                "PASSWORD_RESET_URL": f"https://{self.TOKEN_AUDIENCE}/reset-password",
                "USERS_OPEN_REGISTRATION": False,
                "DATABASE_TYPE": DatabaseTypeEnum.postgresql,
                # Production Celery settings
                "CELERY_TASK_ALWAYS_EAGER": False,
                "CELERY_WORKER_PREFETCH_MULTIPLIER": 4,
                "CELERY_TASK_TIME_LIMIT": 30 * 60,  # 30 minutes
                "CELERY_TASK_SOFT_TIME_LIMIT": 15 * 60,  # 15 minutes
            }

        return base_settings

    # This configuration uses the new SettingsConfigDict style in Pydantic v2
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file_encoding="utf-8",
        extra="ignore",
        # env_file is now handled by settings_customise_sources
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Determine mode for .env file selection
        # The MODE field itself will be loaded by env_settings or init_settings first if set.
        # If not set, it defaults to development as per the field definition.
        # We can get an early read of MODE from environment variables if needed for file selection.
        mode_str = os.getenv("MODE", cls.model_fields["MODE"].default.value)
        mode = ModeEnum(mode_str)

        selected_env_files: List[str] = []

        # 1. Add default backend.env file if it exists (lowest priority among .env files)
        if os.path.isfile(env_file_legacy):
            selected_env_files.append(env_file_legacy)

        # 2. Add mode-specific .env file if it exists (e.g., .env.development)
        #    These will be inserted at the beginning of the list to take precedence over backend.env
        mode_specific_env_file: Optional[str] = None
        if mode == ModeEnum.development and os.path.isfile(env_development_file):
            mode_specific_env_file = env_development_file
        elif mode == ModeEnum.testing and os.path.isfile(env_test_file):
            mode_specific_env_file = env_test_file
        elif mode == ModeEnum.production and os.path.isfile(env_production_file):
            mode_specific_env_file = env_production_file

        if mode_specific_env_file:
            if env_file_legacy in selected_env_files:
                legacy_idx = selected_env_files.index(env_file_legacy)
                selected_env_files.insert(legacy_idx, mode_specific_env_file)
            else:
                selected_env_files.append(mode_specific_env_file)

        # 3. Add local .env file if it exists (highest priority among .env files)
        if os.path.isfile(env_local_file):
            selected_env_files.insert(0, env_local_file)

        # Deduplicate while preserving order (last occurrence wins for insert(0,...))
        # For .env files, earlier in the list means higher priority.
        # os.path.abspath can normalize paths if needed, but simple strings are fine.
        ordered_unique_files = list(dict.fromkeys(selected_env_files))

        final_env_files_paths: Optional[tuple[str, ...]] = None
        if ordered_unique_files:
            final_env_files_paths = tuple(ordered_unique_files)
            print(f"Loading .env files in order: {final_env_files_paths}")

        # Safely access model_config values with defaults if not present
        env_file_encoding = settings_cls.model_config.get("env_file_encoding", "utf-8")
        case_sensitive = settings_cls.model_config.get("case_sensitive", True)

        return (
            init_settings,
            env_settings,
            DotEnvSettingsSource(
                settings_cls=settings_cls,
                env_file=final_env_files_paths,
                env_file_encoding=env_file_encoding,
                case_sensitive=case_sensitive,
            ),
            file_secret_settings,
        )


@lru_cache()
def get_settings() -> Settings:
    """Retrieve and cache application settings."""
    # The settings object will now automatically use the customized sources
    # defined in settings_customise_sources.
    return Settings()


settings = get_settings()
