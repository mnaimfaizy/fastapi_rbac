import datetime

from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.config import settings
from app.schemas.user_schema import IUserCreate

# roles: list[IRoleCreate] = [
#     IRoleCreate(name="admin", description="This the Admin role"),
#     IRoleCreate(name="manager", description="Manager role"),
#     IRoleCreate(name="user", description="User role"),
# ]

users: list[dict[str, str | IUserCreate]] = [
    {
        "data": IUserCreate(
            first_name="Admin",
            last_name="FastAPI",
            password=settings.FIRST_SUPERUSER_PASSWORD,
            email=settings.FIRST_SUPERUSER_EMAIL,
            is_superuser=True,
            is_active=True,
            last_changed_password_date=datetime.datetime.utcnow(),
            expirty_date=datetime.datetime.utcnow(),
            needs_to_change_password=False,
            roles=[],
        )
    },
    {
        "data": IUserCreate(
            first_name="Manager",
            last_name="FastAPI",
            password=settings.FIRST_SUPERUSER_PASSWORD,
            email="manager@example.com",
            is_superuser=False,
            is_active=True,
            last_changed_password_date=datetime.datetime.utcnow(),
            expirty_date=datetime.datetime.utcnow(),
            needs_to_change_password=False,
            roles=[],
        )
    },
    {
        "data": IUserCreate(
            first_name="User",
            last_name="FastAPI",
            password=settings.FIRST_SUPERUSER_PASSWORD,
            email="user@example.com",
            is_superuser=False,
            is_active=True,
            last_changed_password_date=datetime.datetime.utcnow(),
            expirty_date=datetime.datetime.utcnow(),
            needs_to_change_password=False,
            roles=[],
        )
    },
]


async def init_db(db_session: AsyncSession) -> None:
    # for role in roles:
    #     role_current = await crud.role.get_role_by_name(
    #         name=role.name, db_session=db_session
    #     )
    #     if not role_current:
    #         await crud.role.create(obj_in=role, db_session=db_session)

    for user in users:
        current_user = await crud.user.get_by_email(email=user["data"].email, db_session=db_session)
        # role = await crud.role.get_role_by_name(
        #     name=user["role"], db_session=db_session
        # )
        if not current_user:
            # user["data"].role_id = role.id
            await crud.user.create_with_role(obj_in=user["data"], db_session=db_session)

    # for group in groups:
    #     current_group = await crud.group.get_group_by_name(
    #         name=group.name, db_session=db_session
    #     )
    #     if not current_group:
    #         current_user = await crud.user.get_by_email(
    #             email=users[0]["data"].email, db_session=db_session
    #         )
    #         new_group = await crud.group.create(
    #             obj_in=group, created_by_id=current_user.id, db_session=db_session
    #         )
    #         current_users = []
    #         for user in users:
    #             current_users.append(
    #                 await crud.user.get_by_email(
    #                     email=user["data"].email, db_session=db_session
    #                 )
    #             )
    #         await crud.group.add_users_to_group(
    #             users=current_users, group_id=new_group.id, db_session=db_session
    #         )
