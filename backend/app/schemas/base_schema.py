from pydantic import BaseModel, ConfigDict


class IBaseSchema(BaseModel):
    """Base schema class providing common attributes and configuration"""

    model_config = ConfigDict(
        from_attributes=True,  # Allow ORM model -> Pydantic model conversion
        populate_by_name=True,  # Allow population by field names as well as aliases
    )
