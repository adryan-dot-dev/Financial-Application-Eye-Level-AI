"""merge snoozed_until and onboarding_completed

Revision ID: 5d7bb6143603
Revises: ea39ef3b496c, a1b2c3d4e5f6
Create Date: 2026-02-16 14:27:11.421541

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d7bb6143603'
down_revision: Union[str, None] = ('ea39ef3b496c', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
