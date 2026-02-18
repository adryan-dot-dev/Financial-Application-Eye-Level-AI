"""drop audit_logs user_id fk

Revision ID: 3ff79e0f3942
Revises: b15ab5ff4373
Create Date: 2026-02-17 16:25:52.744612

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3ff79e0f3942'
down_revision: Union[str, None] = 'b15ab5ff4373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('audit_logs_user_id_fkey', 'audit_logs', type_='foreignkey')


def downgrade() -> None:
    op.create_foreign_key(
        'audit_logs_user_id_fkey', 'audit_logs', 'users',
        ['user_id'], ['id'], ondelete='SET NULL',
    )
