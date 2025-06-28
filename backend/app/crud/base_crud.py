from typing import Any, Generic, TypeVar
from uuid import UUID

from fastapi import HTTPException
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlmodel import paginate
from pydantic import BaseModel
from sqlalchemy import exc
from sqlalchemy.sql import Executable
from sqlmodel import SQLModel, func, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import Select

from app.schemas.common_schema import IOrderEnum

ModelType = TypeVar("ModelType", bound=SQLModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)
SchemaType = TypeVar("SchemaType", bound=BaseModel)
T = TypeVar("T", bound=SQLModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).
        **Parameters**
        * `model`: A SQLModel model class
        * `schema`: A Pydantic model (schema) class
        """
        self.model = model

    async def get(self, *, id: UUID | str, db_session: AsyncSession | None = None) -> ModelType | None:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")
        query = select(self.model).where(self.model.id == id)
        result = await db_session.exec(query)
        return result.one_or_none()

    async def get_by_ids(
        self,
        *,
        list_ids: list[UUID | str],
        db_session: AsyncSession | None = None,
    ) -> list[ModelType] | None:
        """Get multiple records by their IDs."""
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")
        result = await db_session.exec(select(self.model).where(self.model.id.in_(list_ids)))
        return list(result.all())

    async def get_multi_by_ids(
        self, *, ids: list[UUID], db_session: AsyncSession | None = None
    ) -> list[ModelType]:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")
        result = await db_session.exec(select(self.model).where(self.model.id.in_(ids)))
        return list(result.all())

    async def get_count(self, db_session: AsyncSession | None = None) -> int:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")
        result = await db_session.exec(select(func.count()).select_from(select(self.model).subquery()))
        return result.one()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        query: Executable | None = None,
        db_session: AsyncSession | None = None,
    ) -> list[ModelType]:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")
        if query is None:
            query_obj = select(self.model).offset(skip).limit(limit).order_by(self.model.id)
        else:
            query_obj = query
        response = await db_session.exec(query_obj)
        return list(response.all())

    async def get_multi_paginated(
        self,
        *,
        params: Params | None = Params(),
        query: Select | None = None,
        db_session: AsyncSession | None = None,
    ) -> Page[ModelType]:
        """Get multiple records with pagination."""
        try:
            if db_session is None:
                raise ValueError("db_session must be provided to CRUD methods")
            if query is None:
                query = select(self.model)

            return await paginate(db_session, query, params, unique=True)
        except Exception as e:
            import logging

            logging.error(f"Error in get_multi_paginated: {str(e)}")
            raise Exception(f"Database pagination operation failed: {str(e)}") from e

    async def get_multi_paginated_ordered(
        self,
        *,
        params: Params | None = Params(),
        order_by: str | None = None,
        order: IOrderEnum | None = IOrderEnum.ascendent,
        query: Select | None = None,
        db_session: AsyncSession | None = None,
    ) -> Page[ModelType]:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")

        columns = self.model.__table__.columns

        if order_by is None or order_by not in columns:
            order_by = "id"

        if query is None:
            if order == IOrderEnum.ascendent:
                query_obj = select(self.model).order_by(columns[order_by].asc())
            else:
                query_obj = select(self.model).order_by(columns[order_by].desc())
        else:
            query_obj = query

        return await paginate(db_session, query_obj, params, unique=True)

    async def get_multi_ordered(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        order_by: str | None = None,
        order: IOrderEnum | None = IOrderEnum.ascendent,
        db_session: AsyncSession | None = None,
    ) -> list[ModelType]:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")

        columns = self.model.__table__.columns

        if order_by is None or order_by not in columns:
            order_by = "id"

        if order == IOrderEnum.ascendent:
            query_obj = select(self.model).offset(skip).limit(limit).order_by(columns[order_by].asc())
        else:
            query_obj = select(self.model).offset(skip).limit(limit).order_by(columns[order_by].desc())

        response = await db_session.exec(query_obj)
        return list(response.all())

    async def create(
        self,
        *,
        obj_in: CreateSchemaType | ModelType,
        created_by_id: UUID | str | None = None,
        db_session: AsyncSession | None = None,
    ) -> ModelType:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD create method")

        db_obj = self.model.model_validate(obj_in)

        if created_by_id:
            db_obj.created_by_id = created_by_id

        try:
            db_session.add(db_obj)
            await db_session.flush()  # Ensure data is flushed before commit
            await db_session.commit()
        except exc.IntegrityError:
            await db_session.rollback()  # Corrected to await
            raise HTTPException(
                status_code=409,
                detail="Resource already exists",
            )
        await db_session.refresh(db_obj)
        return db_obj

    async def update(
        self,
        *,
        obj_current: ModelType,
        obj_new: UpdateSchemaType | dict[str, Any] | ModelType,
        db_session: AsyncSession | None = None,
    ) -> ModelType:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")

        if isinstance(obj_new, dict):
            update_data = obj_new
        else:
            # Use model_dump instead of dict for Pydantic v2 compatibility
            update_data = obj_new.model_dump(
                exclude_unset=True
            )  # This tells Pydantic to not include the values that were not sent
        for field in update_data:
            setattr(obj_current, field, update_data[field])

        db_session.add(obj_current)
        await db_session.commit()
        await db_session.refresh(obj_current)
        return obj_current

    async def remove(self, *, id: UUID | str, db_session: AsyncSession | None = None) -> ModelType:
        if db_session is None:
            raise ValueError("db_session must be provided to CRUD methods")
        response = await db_session.exec(select(self.model).where(self.model.id == id))
        # Apply unique() to handle joined eager loads
        unique_response = response.unique()
        obj = unique_response.one_or_none()
        if obj is None:
            raise ValueError(f"Object with id {id} not found")
        await db_session.delete(obj)
        await db_session.commit()
        return obj
