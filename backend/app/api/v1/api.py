from fastapi import APIRouter

from app.api.v1.endpoints import dashboard  # Add dashboard
from app.api.v1.endpoints import auth, permission, permission_group, role, role_group, user

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(user.router, prefix="/users", tags=["users"])
api_router.include_router(role.router, prefix="/roles", tags=["roles"])
api_router.include_router(permission.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(role_group.router, prefix="/role-groups", tags=["role-groups"])
api_router.include_router(
    permission_group.router,
    prefix="/permission-groups",
    tags=["permission-groups"],
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])  # Add this line
