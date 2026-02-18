"""add_backups_table

Revision ID: b1c2d3e4f5g6
Revises: b1c2d3e4f5a6
Create Date: 2026-02-17 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'backups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('backup_type', sa.String(20), nullable=False, server_default='full'),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('verification_checksum', sa.String(64), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index('ix_backups_status', 'backups', ['status'])
    op.create_index('ix_backups_created_at', 'backups', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_backups_created_at', table_name='backups')
    op.drop_index('ix_backups_status', table_name='backups')
    op.drop_table('backups')
