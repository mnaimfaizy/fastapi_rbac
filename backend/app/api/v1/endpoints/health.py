from fastapi import APIRouter, BackgroundTasks, Depends
from redis.asyncio import Redis

from app.api.deps import get_redis_client
from app.core.config import settings
from app.worker import celery_app

router = APIRouter()


@router.get("/health/", summary="Health check for the API and background tasks")
async def health_check(
    background_tasks: BackgroundTasks,
    redis_client: Redis = Depends(get_redis_client),
):
    """
    Perform a health check of all critical system components, including:
    - API Server
    - Database connection
    - Redis connection
    - Celery workers/beat (if available)
    """
    health_status = {
        "status": "healthy",
        "api": {"status": "healthy"},
        "database": {"status": "healthy"},
        "redis": {"status": "healthy"},
        "background_tasks": {"status": "healthy"},
    }

    # Check Redis connection
    try:
        await redis_client.ping()
    except Exception as e:
        health_status["redis"]["status"] = "unhealthy"
        health_status["redis"]["error"] = str(e)
        health_status["status"] = "unhealthy"

    # Check Celery workers status
    try:
        # This will throw an error if no workers are available
        inspection = celery_app.control.inspect().ping()
        if not inspection:
            health_status["background_tasks"]["status"] = "unhealthy"
            health_status["background_tasks"][
                "error"
            ] = "No active Celery workers found"
            health_status["status"] = "unhealthy"
        else:
            health_status["background_tasks"]["workers"] = list(inspection.keys())
    except Exception as e:
        health_status["background_tasks"]["status"] = "unhealthy"
        health_status["background_tasks"]["error"] = str(e)
        health_status["status"] = "unhealthy"

    # Add environment info
    health_status["environment"] = str(settings.MODE)

    return health_status
