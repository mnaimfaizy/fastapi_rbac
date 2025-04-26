import gc
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi_async_sqlalchemy import SQLAlchemyMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_limiter import FastAPILimiter
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

# Import Celery beat schedule to ensure it's registered
import app.celery_beat_schedule  # noqa
from app.api.deps import get_redis_client
from app.api.v1.api import api_router as api_router_v1
# Import Celery app from centralized configuration
from app.celery_app import celery_app
from app.core.config import ModeEnum, settings
from app.core.security import decode_token
# Import our environment-specific service settings
from app.core.service_config import service_settings
from app.schemas.response_schema import ErrorDetail, create_error_response
from app.utils.fastapi_globals import GlobalsMiddleware, g

# Flag to indicate whether Celery is available based on environment
CELERY_AVAILABLE = service_settings.use_celery

# Expose the Celery application instance
# This allows CLI commands like 'celery -A app.main.celery worker' to work
celery = celery_app


async def user_id_identifier(request: Request):
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
                        detail="Error when decoding the token. Please check your request.",
                    )
                except MissingRequiredClaimError:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="There is no required field in your token. Please contact the administrator.",
                    )

                user_id = payload["sub"]

                return user_id

    if request.scope["type"] == "websocket":
        return request.scope["path"]

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]

    client = request.client
    ip = getattr(client, "host", "0.0.0.0")
    return ip + ":" + request.scope["path"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Use the get_redis_client as an async context manager
    async for redis_client in get_redis_client():
        FastAPICache.init(RedisBackend(redis_client), prefix="fastapi-cache")
        await FastAPILimiter.init(redis_client, identifier=user_id_identifier)

        print("startup fastapi")
        yield
        # shutdown
        await FastAPICache.clear()
        await FastAPILimiter.close()
        g.cleanup()
        gc.collect()
        # Redis client will be closed automatically after exiting this context


# Core Application Instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.API_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="FastAPI RBAC system with comprehensive authentication and authorization features",
    lifespan=lifespan,
)


app.add_middleware(
    SQLAlchemyMiddleware,
    db_url=str(settings.ASYNC_DATABASE_URI),
    engine_args={
        "echo": False,
        "poolclass": (
            NullPool if settings.MODE == ModeEnum.testing else AsyncAdaptedQueuePool
        ),
        # "pool_pre_ping": True,
        # "pool_size": settings.POOL_SIZE,
        # "max_overflow": 64,
    },
)
app.add_middleware(GlobalsMiddleware)

# Set all CORS origins enabled
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
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


@app.get("/")
async def root():
    """
    An example "Hello world" FastAPI route.
    """
    # if oso.is_allowed(user, "read", message):
    return {"message": "Hello World"}


# Add Routers
app.include_router(api_router_v1, prefix=settings.API_V1_STR)


# Exception handlers for consistent error responses
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
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


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTP exceptions with standardized format for frontend consumption
    """
    # Extract field-specific errors from detail if it's a dict
    errors = []
    if isinstance(exc.detail, dict) and "field_name" in exc.detail:
        errors.append(
            ErrorDetail(
                field=exc.detail.get("field_name"),
                message=exc.detail.get("message", "An error occurred"),
                code=str(exc.status_code),
            )
        )
        message = "Request error"
    else:
        message = exc.detail if isinstance(exc.detail, str) else "Request error"

    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            message=message,
            errors=errors,
        ).model_dump(),
    )


@app.exception_handler(CustomException)
async def custom_exception_handler(request: Request, exc: CustomException):
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


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Handle database errors with standardized format for frontend consumption
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            message="Database error",
            errors=[ErrorDetail(code="database_error", message=str(exc))],
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle general exceptions with standardized format for frontend consumption
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            message="Internal server error",
            errors=[
                ErrorDetail(
                    code="internal_error", message="An unexpected error occurred"
                )
            ],
        ).model_dump(),
    )
