import gc
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi_async_sqlalchemy import SQLAlchemyMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_limiter import FastAPILimiter
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import NullPool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

# Import Celery beat schedule to ensure it's registered
import app.celery_beat_schedule as celery_beat_schedule  # noqa
from app.api.deps import get_redis_client
from app.api.v1.api import api_router as api_router_v1

# Import Celery app from centralized configuration
from app.celery_app import celery_app
from app.core.config import ModeEnum, settings
from app.core.security import decode_token

# Import our environment-specific service settings
from app.core.service_config import service_settings
from app.schemas.response_schema import ErrorDetail, create_error_response
from app.utils.exceptions.user_exceptions import UserSelfDeleteException
from app.utils.fastapi_globals import GlobalsMiddleware, g

# Configure logger
logger = logging.getLogger("fastapi_rbac")
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
logger.addHandler(handler)


# Flag to indicate whether Celery is available based on environment
CELERY_AVAILABLE = service_settings.use_celery

# Expose the Celery application instance
# This allows CLI commands like 'celery -A app.main.celery worker' to work
celery = celery_app


async def user_id_identifier(request: Request) -> Optional[str]:
    if request.scope["type"] == "http":
        # Retrieve the Authorization header from the request
        auth_header = request.headers.get("Authorization")

        if auth_header is not None:
            # Check that the header is in the correct format
            header_parts = auth_header.split()
            if len(header_parts) == 2 and header_parts[0].lower() == "bearer":
                token = header_parts[1]
                try:
                    payload = decode_token(token)
                except ExpiredSignatureError:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your token has expired. Please log in again.",
                    )
                except DecodeError:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=("Error when decoding the token. " "Please check your request."),
                    )
                except MissingRequiredClaimError:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=(
                            "There is no required field in your token. " "Please contact the administrator."
                        ),
                    )

                user_id = payload["sub"]

                return str(user_id)

    if request.scope["type"] == "websocket":
        return str(request.scope["path"])

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return str(forwarded.split(",")[0])

    client = request.client
    ip = getattr(client, "host", "0.0.0.0")
    return str(ip) + ":" + str(request.scope["path"])


@asynccontextmanager
async def lifespan(fastapi_instance: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    redis_client = None

    # Get the Redis client using the async generator
    async for client in get_redis_client():
        redis_client = client
        break  # Just get the first client from the generator

    if redis_client:
        FastAPICache.init(RedisBackend(redis_client), prefix="fastapi-cache")
        await FastAPILimiter.init(redis_client, identifier=user_id_identifier)

    print("startup fastapi")
    yield
    # shutdown
    await FastAPICache.clear()
    await FastAPILimiter.close()
    if redis_client:
        await redis_client.close()
    g.cleanup()
    gc.collect()


# Core Application Instance
fastapi_app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.API_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description=("FastAPI RBAC system with comprehensive " "authentication and authorization features"),
    lifespan=lifespan,
)


fastapi_app.add_middleware(
    SQLAlchemyMiddleware,
    db_url=str(settings.ASYNC_DATABASE_URI),
    engine_args={
        "echo": False,
        "poolclass": NullPool if settings.MODE == ModeEnum.testing else None,
        # "pool_pre_ping": True,
        # "pool_size": settings.POOL_SIZE,
        # "max_overflow": 64,
    },
)
fastapi_app.add_middleware(GlobalsMiddleware)

# Set all CORS origins enabled
if settings.BACKEND_CORS_ORIGINS:
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class CustomException(Exception):
    http_code: int
    code: str
    message: str

    def __init__(
        self,
        http_code: int = 500,
        code: str | None = None,
        message: str = "This is an error message",
    ):
        self.http_code = http_code
        self.code = code if code else str(self.http_code)
        self.message = message


@fastapi_app.get("/")
async def root() -> Dict[str, str]:
    """
    An example "Hello world" FastAPI route.
    """
    # if oso.is_allowed(user, "read", message):
    return {"message": "Hello World"}


# Add Routers
fastapi_app.include_router(api_router_v1, prefix=settings.API_V1_STR)


# Exception handlers for consistent error responses
@fastapi_app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle validation errors with standardized format for frontend consumption
    """
    errors = []
    for error in exc.errors():
        field = ".".join([str(loc) for loc in error["loc"] if loc != "body"])
        errors.append(
            ErrorDetail(
                field=field,
                code="validation_error",
                message=error["msg"],
            )
        )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=create_error_response(
            message="Validation error",
            errors=errors,
        ).model_dump(),
    )


@fastapi_app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle HTTP exceptions with standardized format for frontend consumption
    """
    # Extract field-specific errors from detail if it's a dict
    errors: list[ErrorDetail] = []

    detail: Any = exc.detail

    if isinstance(detail, dict) and "field_name" in detail:
        errors.append(
            ErrorDetail(
                field=detail.get("field_name"),
                message=detail.get("message", "An error occurred"),
                code=str(exc.status_code),
            )
        )
        message = "Request error"
    else:
        message = detail if isinstance(detail, str) else "Request error"

    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            message=message,
            errors=errors,
        ).model_dump(),
    )


@fastapi_app.exception_handler(CustomException)
async def custom_exception_handler(request: Request, exc: CustomException) -> JSONResponse:
    """
    Handle custom exceptions with standardized format for frontend consumption
    """
    return JSONResponse(
        status_code=exc.http_code,
        content=create_error_response(
            message=exc.message,
            errors=[ErrorDetail(code=exc.code, message=exc.message)],
        ).model_dump(),
    )


@fastapi_app.exception_handler(UserSelfDeleteException)
async def user_self_delete_exception_handler(request: Request, exc: UserSelfDeleteException) -> JSONResponse:
    """
    Handle attempts by users to delete their own account.
    """
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=create_error_response(
            message="Bad Request",
            errors=[ErrorDetail(code="user_self_delete", message=str(exc))],
        ).model_dump(),
    )


@fastapi_app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handle database errors with standardized format for frontend consumption.
    Logs the full error internally but returns a generic message to the client.
    """
    # Log the full exception for internal debugging
    logger.error(f"Database error occurred: {exc}", exc_info=True)

    # Determine the message to send to the client
    if settings.MODE == ModeEnum.development:
        # In development, include the specific error string for easier debugging
        error_message = f"Database operation failed: {str(exc)}"
    else:
        # In production or other modes, use a generic message
        error_message = "A database error occurred. Please try again later or contact support."

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            message="Database error",
            errors=[ErrorDetail(code="database_error", message=error_message)],
        ).model_dump(),
    )


@fastapi_app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle general exceptions with standardized format for frontend consumption
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            message="Internal server error",
            errors=[ErrorDetail(code="internal_error", message="An unexpected error occurred")],
        ).model_dump(),
    )
