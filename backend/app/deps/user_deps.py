from uuid import UUID

from fastapi import Depends, HTTPException, Path, status
from sqlmodel.ext.asyncio.session import AsyncSession
from typing_extensions import Annotated

from app import crud
from app.api import deps
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, IUserRead
from app.utils.exceptions.common_exception import IdNotFoundException


async def user_exists(new_user: IUserCreate, db_session: AsyncSession = Depends(deps.get_db)) -> IUserCreate:
    user = await crud.user.get_by_email(email=new_user.email, db_session=db_session)
    if user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is already a user with same email",
        )

    # Handle role validation
    if new_user.role_id:
        # Get all roles at once
        result = await crud.role.get_multi_by_ids(ids=new_user.role_id, db_session=db_session)
        found_roles = result

        # Check if all roles were found
        if len(found_roles) != len(new_user.role_id):
            found_role_ids = {role.id for role in found_roles}
            missing_role_ids = [str(role_id) for role_id in new_user.role_id if role_id not in found_role_ids]
            raise IdNotFoundException(Role, id=", ".join(missing_role_ids))

    return new_user


async def is_valid_user(
    user_id: Annotated[UUID, Path(title="The UUID id of the user")],
    db_session: AsyncSession = Depends(deps.get_db),
) -> IUserRead:
    user = await crud.user.get(id=user_id, db_session=db_session)
    if not user:
        raise IdNotFoundException(User, id=user_id)

    return user


async def is_valid_user_id(
    user_id: Annotated[UUID, Path(title="The UUID id of the user")],
    db_session: AsyncSession = Depends(deps.get_db),
) -> IUserRead:
    user = await crud.user.get(id=user_id, db_session=db_session)
    if not user:
        raise IdNotFoundException(User, id=user_id)

    return user_id
