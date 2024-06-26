from fastapi import APIRouter

from app.api.v1.endpoints import (login, permission, permission_group, role,
                                  role_group, user)

api_router = APIRouter()
api_router.include_router(login.router, prefix="/login", tags=["login"])
api_router.include_router(role.router, prefix="/role", tags=["role"])
api_router.include_router(user.router, prefix="/user", tags=["user"])
api_router.include_router(role_group.router, prefix="/role_group", tags=["role_group"])
api_router.include_router(
    permission_group.router, prefix="/permission_group", tags=["permission_group"]
)
api_router.include_router(permission.router, prefix="/permission", tags=["permission"])
