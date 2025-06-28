from uuid import UUID

from fastapi import Depends, Path, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from typing_extensions import Annotated

from app import crud
from app.api import deps
from app.models.role_model import Role
from app.utils.exceptions.common_exception import IdNotFoundException, NameNotFoundException


async def get_user_role_by_name(
    role_name: Annotated[str, Query(title="String compare with name or last name")] = "",
    db_session: AsyncSession = Depends(deps.get_db),
) -> str:
    role = await crud.role.get_role_by_name(name=role_name, db_session=db_session)
    if not role:
        raise NameNotFoundException(Role, name=role_name)
    return role_name


async def get_user_role_by_id(
    role_id: Annotated[UUID, Path(title="The UUID id of the role")],
    db_session: AsyncSession = Depends(deps.get_db),
) -> Role:
    role = await crud.role.get(id=role_id, db_session=db_session)
    if not role:
        raise IdNotFoundException(Role, id=role_id)
    return role
