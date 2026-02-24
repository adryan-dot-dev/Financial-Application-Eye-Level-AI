from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token, is_token_blacklisted, is_token_issued_before_password_change
from app.db.models.org_member import OrganizationMember
from app.db.models.settings import Settings
from app.db.models.user import User
from app.db.session import get_db

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise UnauthorizedException("Invalid or expired token")

    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid token type")

    # ORANGE-9: Check token blacklist
    jti = payload.get("jti")
    if jti and is_token_blacklisted(jti):
        raise UnauthorizedException("Token has been revoked")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Invalid token payload")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("User not found")

    if not user.is_active:
        raise UnauthorizedException("User is inactive")

    # Check if the token was issued before the last password change
    if is_token_issued_before_password_change(payload, user.password_changed_at):
        raise UnauthorizedException("Token invalidated by password change")

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin:
        raise ForbiddenException("Admin access required")
    return current_user


async def get_current_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_super_admin:
        raise ForbiddenException("Super admin access required")
    return current_user


async def get_accessible_user_ids(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[UUID]:
    """Returns list of user IDs whose data the current user can access.

    DEPRECATED: Use get_data_context() instead for proper org data isolation.

    - If user has no current_organization_id: returns [user.id] (just their own data)
    - If user has current_organization_id: returns all active member user_ids in that org
    """
    if current_user.current_organization_id is None:
        return [current_user.id]

    result = await db.execute(
        select(OrganizationMember.user_id).where(
            OrganizationMember.organization_id == current_user.current_organization_id,
            OrganizationMember.is_active == True,
        )
    )
    user_ids = list(result.scalars().all())

    # Safety: always include the current user even if something is wrong
    if current_user.id not in user_ids:
        user_ids.append(current_user.id)

    return user_ids


# ---------------------------------------------------------------------------
# DataContext — org-aware data access context
# ---------------------------------------------------------------------------

@dataclass
class DataContext:
    """Encapsulates the current data access context (personal vs organization)."""

    user_id: UUID                           # Always the authenticated user
    organization_id: Optional[UUID]         # None = personal, UUID = org
    is_org_context: bool                    # Convenience flag

    def ownership_filter(self, model_class):
        """Return SQLAlchemy filter clause for querying data in this context.

        Personal: WHERE model.user_id = X AND model.organization_id IS NULL
        Org:      WHERE model.organization_id = Y
        """
        if self.is_org_context:
            return model_class.organization_id == self.organization_id
        return and_(
            model_class.user_id == self.user_id,
            model_class.organization_id.is_(None),
        )

    def create_fields(self) -> dict:
        """Return dict of user_id + organization_id to set on new records."""
        return {
            "user_id": self.user_id,
            "organization_id": self.organization_id,
        }


async def get_data_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DataContext:
    """Determine the data context for the current request.

    If user has current_organization_id set AND is an active member,
    returns org context.  Otherwise returns personal context.
    """
    org_id = current_user.current_organization_id

    if org_id is None:
        return DataContext(
            user_id=current_user.id,
            organization_id=None,
            is_org_context=False,
        )

    # Verify active membership
    result = await db.execute(
        select(OrganizationMember.id).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active == True,
        )
    )
    is_member = result.scalar_one_or_none() is not None

    if not is_member:
        # Not a member — fall back to personal context
        return DataContext(
            user_id=current_user.id,
            organization_id=None,
            is_org_context=False,
        )

    return DataContext(
        user_id=current_user.id,
        organization_id=org_id,
        is_org_context=True,
    )


async def get_base_currency(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Return the user's configured base currency (default ILS)."""
    result = await db.execute(
        select(Settings.currency).where(Settings.user_id == current_user.id).limit(1)
    )
    currency = result.scalar_one_or_none()
    return currency or "ILS"


# ---------------------------------------------------------------------------
# Org permission checking
# ---------------------------------------------------------------------------

ORG_PERMISSIONS: dict = {
    "view_financial_data": ["owner", "admin", "member", "viewer"],
    "create_transactions": ["owner", "admin", "member"],
    "edit_own_transactions": ["owner", "admin", "member"],
    "edit_all_transactions": ["owner", "admin"],
    "delete_transactions": ["owner", "admin"],
    "manage_categories": ["owner", "admin"],
    "view_audit_log": ["owner", "admin"],
    "generate_reports": ["owner", "admin"],
    "manage_budgets": ["owner", "admin"],
    "approve_expenses": ["owner", "admin"],
    "submit_for_approval": ["owner", "admin", "member"],
    "manage_members": ["owner", "admin"],
    "manage_org_settings": ["owner", "admin"],
    "delete_organization": ["owner"],
}


def check_org_permission(role: Optional[str], action: str) -> None:
    """Raise ForbiddenException if role lacks permission for the action."""
    allowed = ORG_PERMISSIONS.get(action, [])
    if role is None or role not in allowed:
        raise ForbiddenException(f"Permission denied: {action}")
