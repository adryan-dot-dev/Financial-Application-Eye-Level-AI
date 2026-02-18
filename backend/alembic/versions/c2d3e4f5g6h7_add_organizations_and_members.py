"""add_organizations_and_members

Revision ID: c2d3e4f5g6h7
Revises: b1c2d3e4f5g6
Create Date: 2026-02-17 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5g6h7'
down_revision: Union[str, None] = 'b1c2d3e4f5g6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(200), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('slug'),
    )

    # Create organization_members table
    op.create_table(
        'organization_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_org_member_org_user'),
    )

    # Add indexes for organization_members
    op.create_index('ix_org_members_org_id', 'organization_members', ['organization_id'])
    op.create_index('ix_org_members_user_id', 'organization_members', ['user_id'])

    # Add current_organization_id to users table
    op.add_column(
        'users',
        sa.Column(
            'current_organization_id',
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        'fk_users_current_organization_id',
        'users',
        'organizations',
        ['current_organization_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    # Remove current_organization_id from users
    op.drop_constraint('fk_users_current_organization_id', 'users', type_='foreignkey')
    op.drop_column('users', 'current_organization_id')

    # Drop organization_members indexes and table
    op.drop_index('ix_org_members_user_id', table_name='organization_members')
    op.drop_index('ix_org_members_org_id', table_name='organization_members')
    op.drop_table('organization_members')

    # Drop organizations table
    op.drop_table('organizations')
