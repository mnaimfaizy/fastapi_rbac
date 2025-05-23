from collections.abc import Sequence
from math import ceil
from typing import Any, Dict, Generic, TypeVar, cast  # Added Dict import

from fastapi_pagination import Page, Params
from fastapi_pagination.bases import AbstractPage, AbstractParams
from pydantic import BaseModel, Field

DataType = TypeVar("DataType")
T = TypeVar("T")


class PageBase(Page[T], Generic[T]):
    previous_page: int | None = Field(default=None, description="Page number of the previous page")
    next_page: int | None = Field(default=None, description="Page number of the next page")


class IResponseBase(BaseModel, Generic[T]):
    message: str = ""
    meta: dict | Any | None = {}
    data: T | None = None


class IGetResponsePaginated(AbstractPage[T], Generic[T]):
    message: str | None = ""
    meta: dict = {}
    data: PageBase[T]

    __params_type__ = Params  # Set params related to Page

    @classmethod
    def create(
        cls,
        items: Sequence[T],
        params: AbstractParams,
        **kwargs: Any,
    ) -> "IGetResponsePaginated[T]":
        # Ensure params is of type Params
        params = cast(Params, params)
        total = kwargs.get("total", 0)

        if params.size is not None and total is not None and params.size != 0:
            pages = ceil(total / params.size)
        else:
            pages = 0

        return cls(
            data=PageBase[T](
                items=items,
                page=params.page,
                size=params.size,
                total=total,
                pages=pages,
                next_page=params.page + 1 if params.page < pages else None,
                previous_page=params.page - 1 if params.page > 1 else None,
            )
        )


class IGetResponseBase(IResponseBase[DataType], Generic[DataType]):
    message: str = "Data got correctly"  # Changed from str | None to str


class IPostResponseBase(IResponseBase[DataType], Generic[DataType]):
    message: str = "Data created correctly"  # Changed from str | None to str


class IPutResponseBase(IResponseBase[DataType], Generic[DataType]):
    message: str = "Data updated correctly"  # Changed from str | None to str


class IDeleteResponseBase(IResponseBase[DataType], Generic[DataType]):
    message: str = "Data deleted correctly"  # Changed from str | None to str


class ErrorDetail(BaseModel):
    """Detailed error information for frontend consumption"""

    field: str | None = None  # Field that caused the error (if applicable)
    code: str | None = None  # Error code for programmatic handling
    message: str  # Human-readable error message


class IErrorResponse(BaseModel):
    """Standardized error response schema for frontend consumption"""

    status: str = "error"
    message: str  # General error message
    errors: list[ErrorDetail] = []  # Detailed errors list
    meta: dict | Any | None = {}


def create_error_response(
    message: str,
    errors: list[ErrorDetail] | None = None,
    meta: dict | Any | None = None,
) -> IErrorResponse:
    """Create a standardized error response"""
    return IErrorResponse(
        message=message,
        errors=errors or [],
        meta=meta or {},
    )


def create_response(
    data: DataType,
    message: str | None = None,
    meta: Dict[str, Any] | None = None,  # Refined meta type hint
) -> (
    IResponseBase[DataType]
    | IGetResponsePaginated[DataType]
    | IGetResponseBase[DataType]
    | IPutResponseBase[DataType]
    | IDeleteResponseBase[DataType]
    | IPostResponseBase[DataType]
):
    if isinstance(data, IGetResponsePaginated):
        data.message = "Data paginated correctly" if message is None else message
        # Ensure meta is a dict before assignment
        data.meta = meta if meta is not None else {}
        return data
    # Ensure meta is a dict for other response types as well
    meta_dict = meta if meta is not None else {}
    if message is None:
        return IGetResponseBase[DataType](data=data, meta=meta_dict)
    return IGetResponseBase[DataType](data=data, message=message, meta=meta_dict)
