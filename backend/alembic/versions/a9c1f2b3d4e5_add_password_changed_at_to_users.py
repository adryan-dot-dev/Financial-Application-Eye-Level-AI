"""add_password_changed_at_to_users

Revision ID: a9c1f2b3d4e5
Revises: 73e472d76fbc
Create Date: 2026-02-17 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9c1f2b3d4e5'
down_revision: Union[str, None] = '73e472d76fbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'password_changed_at')
