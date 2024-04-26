"""mapping

Revision ID: f222f6b8f5de
Revises: 74a7cd91e8fa
Create Date: 2024-04-24 14:51:27.331801

"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f222f6b8f5de'
down_revision: Union[str, None] = '74a7cd91e8fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('RoleGroupMap',
    sa.Column('id', sqlmodel.sql.sqltypes.GUID(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('role_group_id', sqlmodel.sql.sqltypes.GUID(), nullable=False),
    sa.Column('role_id', sqlmodel.sql.sqltypes.GUID(), nullable=False),
    sa.ForeignKeyConstraint(['role_group_id'], ['RoleGroup.id'], ),
    sa.ForeignKeyConstraint(['role_id'], ['Role.id'], ),
    sa.PrimaryKeyConstraint('id', 'role_group_id', 'role_id')
    )
    op.create_index(op.f('ix_RoleGroupMap_id'), 'RoleGroupMap', ['id'], unique=False)
    op.create_index(op.f('ix_RoleGroupMap_role_group_id'), 'RoleGroupMap', ['role_group_id'], unique=False)
    op.create_index(op.f('ix_RoleGroupMap_role_id'), 'RoleGroupMap', ['role_id'], unique=False)
    op.drop_index('ix_rolegroupmap_role_group_id', table_name='rolegroupmap')
    op.drop_index('ix_rolegroupmap_role_id', table_name='rolegroupmap')
    op.drop_table('rolegroupmap')
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('rolegroupmap',
    sa.Column('role_group_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('role_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['role_group_id'], ['RoleGroup.id'], name='rolegroupmap_role_group_id_fkey'),
    sa.ForeignKeyConstraint(['role_id'], ['Role.id'], name='rolegroupmap_role_id_fkey'),
    sa.PrimaryKeyConstraint('role_group_id', 'role_id', name='rolegroupmap_pkey')
    )
    op.create_index('ix_rolegroupmap_role_id', 'rolegroupmap', ['role_id'], unique=False)
    op.create_index('ix_rolegroupmap_role_group_id', 'rolegroupmap', ['role_group_id'], unique=False)
    op.drop_index(op.f('ix_RoleGroupMap_role_id'), table_name='RoleGroupMap')
    op.drop_index(op.f('ix_RoleGroupMap_role_group_id'), table_name='RoleGroupMap')
    op.drop_index(op.f('ix_RoleGroupMap_id'), table_name='RoleGroupMap')
    op.drop_table('RoleGroupMap')
    # ### end Alembic commands ###