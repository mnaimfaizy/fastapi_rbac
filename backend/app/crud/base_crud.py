from typing import Any, Generic, TypeVar
from uuid import UUID

from fastapi import HTTPException
from fastapi_async_sqlalchemy import db
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlmodel import paginate
from pydantic import BaseModel
from sqlalchemy import exc
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
        self.db = db

    def get_db(self) -> Any:
        """
        Returns the db object. This method is kept for backwards compatibility.
        New code should always pass in the db_session parameter explicitly.
        """
        return self.db

    async def get(self, *, id: UUID | str, db_session: AsyncSession | None = None) -> ModelType | None:
        """Get a single record by ID."""
        db_session = db_session or self.db.session
        query = select(self.model).where(self.model.id == id)
        result = await db_session.execute(query)
        response = result.unique()
        return response.scalar_one_or_none()

    async def get_by_ids(
        self,
        *,
        list_ids: list[UUID | str],
        db_session: AsyncSession | None = None,
    ) -> list[ModelType] | None:
        """Get multiple records by their IDs."""
        db_session = db_session or self.db.session
        response = await db_session.execute(select(self.model).where(self.model.id.in_(list_ids)))
        return response.scalars().all()

    async def get_multi_by_ids(
        self, *, ids: list[UUID], db_session: AsyncSession | None = None
    ) -> list[ModelType]:
        """
        Get multiple records by their IDs

        Args:
            ids: List of UUIDs to fetch
            db_session: Optional database session

        Returns:
            List of found records
        """
        db_session = db_session or self.db.session
        response = await db_session.execute(select(self.model).where(self.model.id.in_(ids)))
        return response.scalars().all()

    async def get_count(self, db_session: AsyncSession | None = None) -> ModelType | None:
        """Get the total count of records."""
        db_session = db_session or self.db.session
        response = await db_session.execute(select(func.count()).select_from(select(self.model).subquery()))
        return response.scalar_one()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        query: T | Select[T] | None = None,
        db_session: AsyncSession | None = None,
    ) -> list[ModelType]:
        """Get multiple records with optional pagination."""
        db_session = db_session or self.db.session
        if query is None:
            query_obj: Select[ModelType] = (
                select(self.model).offset(skip).limit(limit).order_by(self.model.id)
            )
        else:
            query_obj = query
        response = await db_session.execute(query_obj)
        # Apply unique() to handle joined eager loads
        unique_response = response.unique()
        return unique_response.scalars().all()

    async def get_multi_paginated(
        self,
        *,
        params: Params | None = Params(),
        query: T | Select[T] | None = None,
        db_session: AsyncSession | None = None,
    ) -> Page[ModelType]:
        """Get multiple records with pagination."""
        try:
            db_session = db_session or self.db.session
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
        query: T | Select[T] | None = None,
        db_session: AsyncSession | None = None,
    ) -> Page[ModelType]:
        db_session = db_session or self.db.session

        columns = self.model.__table__.columns

        if order_by is None or order_by not in columns:
            order_by = "id"

        if query is None:
            query_obj: Select[ModelType]
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
        db_session = db_session or self.db.session

        columns = self.model.__table__.columns

        if order_by is None or order_by not in columns:
            order_by = "id"

        query_obj: Select[ModelType]
        if order == IOrderEnum.ascendent:
            query_obj = select(self.model).offset(skip).limit(limit).order_by(columns[order_by].asc())
        else:
            query_obj = select(self.model).offset(skip).limit(limit).order_by(columns[order_by].desc())

        response = await db_session.execute(query_obj)
        return response.scalars().all()

    async def create(
        self,
        *,
        obj_in: CreateSchemaType | ModelType,
        created_by_id: UUID | str | None = None,
        db_session: AsyncSession | None = None,
    ) -> ModelType:
        if not db_session:
            # This should ideally not happen if db_session is always provided.
            # If it does, it means self.db.session (middleware-managed) would have been used.
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
        db_session = db_session or self.db.session

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
        db_session = db_session or self.db.session
        response = await db_session.execute(select(self.model).where(self.model.id == id))
        # Apply unique() to handle joined eager loads
        unique_response = response.unique()
        obj = unique_response.scalar_one()
        await db_session.delete(obj)
        await db_session.commit()
        return obj
