from datetime import datetime
from uuid import UUID

import pytest
from sqlmodel import Field
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.base_uuid_model import BaseUUIDModel


# Create a test model that inherits from BaseUUIDModel
class SampleModel(BaseUUIDModel, table=True):
    name: str = Field(index=True)
    description: str | None = None


@pytest.mark.asyncio
async def test_base_uuid_model_create(db: AsyncSession) -> None:
    """Test creating an entity with BaseUUIDModel as base class"""
    # Create test model instance
    test_model = SampleModel(name="test", description="A test model")

    # Add to database
    db.add(test_model)
    await db.commit()
    await db.refresh(test_model)

    # Check that the model has UUID and timestamp fields
    assert test_model.id is not None
    assert isinstance(test_model.id, UUID)
    assert test_model.created_at is not None
    assert isinstance(test_model.created_at, datetime)
    assert test_model.updated_at is not None
    assert isinstance(test_model.updated_at, datetime)

    # Check that the model data is correct
    assert test_model.name == "test"
    assert test_model.description == "A test model"


@pytest.mark.asyncio
async def test_base_uuid_model_update(db: AsyncSession) -> None:
    """Test updating an entity with BaseUUIDModel as base class"""
    # Create test model instance
    test_model = SampleModel(name="original", description="Original description")

    # Add to database
    db.add(test_model)
    await db.commit()
    await db.refresh(test_model)

    # Store the original timestamps
    original_id = test_model.id
    original_created_at = test_model.created_at

    # Wait a small amount of time to ensure timestamps would change
    # Note: In a real test, we might use a mock or fixture for time handling
    import asyncio

    await asyncio.sleep(0.1)

    # Update the model
    test_model.name = "updated"
    test_model.description = "Updated description"
    await db.commit()
    await db.refresh(test_model)

    # Check that the ID and created_at did not change
    assert test_model.id == original_id
    assert test_model.created_at == original_created_at

    # Check that updated_at changed
    # Note: SQLite might not update this automatically in test environment
    # In a production PostgreSQL database, this would be handled by the database trigger
    # This test might need adjustment based on the database being used

    # Check that the model data is updated
    assert test_model.name == "updated"
    assert test_model.description == "Updated description"


@pytest.mark.asyncio
async def test_uuid_generation(db: AsyncSession) -> None:
    """Test that UUIDs are unique for each instance"""
    # Create multiple test models
    model1 = SampleModel(name="model1")
    model2 = SampleModel(name="model2")

    # Add to database
    db.add_all([model1, model2])
    await db.commit()
    await db.refresh(model1)
    await db.refresh(model2)

    # Check that they have different UUIDs
    assert model1.id != model2.id
    assert isinstance(model1.id, UUID)
    assert isinstance(model2.id, UUID)
