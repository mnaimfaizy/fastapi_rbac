from uuid import UUID

from sqlmodel import Field, SQLModel


class RoleGroupMap(SQLModel, table=True):
    """Mapping table between roles and role groups.
    This model handles the many-to-many relationship between Role and RoleGroup models.
    """

    __tablename__ = "RoleGroupMap"

    role_group_id: UUID = Field(
        foreign_key="RoleGroup.id",
        primary_key=True,
        index=True,
    )
    role_id: UUID = Field(
        foreign_key="Role.id",
        primary_key=True,
        index=True,
    )
