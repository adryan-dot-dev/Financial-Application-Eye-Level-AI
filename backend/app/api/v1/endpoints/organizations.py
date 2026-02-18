from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_data_context, DataContext, check_org_permission
from app.api.v1.schemas.organization import (
    ChangeMemberRoleRequest,
    InviteMemberRequest,
    OrgMemberResponse,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    SwitchOrganizationRequest,
)
from sqlalchemy import func as sa_func

from app.api.v1.schemas.audit_log import AuditLogListResponse, AuditLogResponse
from app.api.v1.schemas.org_report import ReportGenerateRequest, ReportListResponse, ReportResponse
from app.api.v1.schemas.expense_approval import (
    ApprovalListResponse,
    ApprovalRejectRequest,
    ApprovalResponse,
    ApprovalSubmitRequest,
    PendingApprovalsResponse,
)
from app.core.exceptions import ForbiddenException, NotFoundException
from app.db.models.org_member import OrganizationMember
from app.db.models.organization import Organization, _generate_slug
from app.db.models.audit_log import AuditLog
from app.db.models.expense_approval import ExpenseApproval
from app.db.models.org_report import OrgReport
from app.db.models.transaction import Transaction
from app.db.models.user import User
from app.db.session import get_db
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_member_role(
    db: AsyncSession, org_id: UUID, user_id: UUID
) -> Optional[str]:
    """Return the role of a user in an organization, or None if not a member."""
    result = await db.execute(
        select(OrganizationMember.role).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active == True,
        )
    )
    return result.scalar_one_or_none()


def _require_role(role: Optional[str], allowed: List[str], action: str) -> None:
    """Raise ForbiddenException if role is not in the allowed list."""
    if role is None:
        raise ForbiddenException(f"You are not a member of this organization")
    if role not in allowed:
        raise ForbiddenException(f"Only {', '.join(allowed)} can {action}")


# ---------------------------------------------------------------------------
# POST /organizations/ - create org
# ---------------------------------------------------------------------------

@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization. The creator becomes the owner."""
    # Check for duplicate name
    existing = await db.execute(
        select(Organization).where(Organization.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Organization name already exists")

    slug = _generate_slug(data.name)

    # Ensure slug uniqueness by appending a suffix if needed
    base_slug = slug
    counter = 1
    while True:
        existing_slug = await db.execute(
            select(Organization).where(Organization.slug == slug)
        )
        if not existing_slug.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(
        name=data.name,
        slug=slug,
        owner_id=current_user.id,
    )
    db.add(org)
    await db.flush()

    # Auto-add creator as owner member
    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)
    await log_action(db, user_id=current_user.id, action="create", entity_type="organization", entity_id=str(org.id), user_email=current_user.email, organization_id=org.id)
    await db.commit()
    await db.refresh(org)

    logger.info("User %s created organization %s", current_user.id, org.id)
    return org


# ---------------------------------------------------------------------------
# GET /organizations/ - list user's organizations
# ---------------------------------------------------------------------------

@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations the current user is a member of."""
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.is_active == True,
            Organization.is_active == True,
        )
        .order_by(Organization.name)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /organizations/{id} - get org details
# ---------------------------------------------------------------------------

@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organization details. Must be a member."""
    role = await _get_member_role(db, org_id, current_user.id)
    if role is None:
        raise NotFoundException("Organization")

    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise NotFoundException("Organization")
    return org


# ---------------------------------------------------------------------------
# PUT /organizations/{id} - update org
# ---------------------------------------------------------------------------

@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    data: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update organization details. Owner or admin only."""
    role = await _get_member_role(db, org_id, current_user.id)
    _require_role(role, ["owner", "admin"], "update organization")

    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise NotFoundException("Organization")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        # Check for duplicate name
        existing = await db.execute(
            select(Organization).where(
                Organization.name == update_data["name"],
                Organization.id != org_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Organization name already exists")

        org.name = update_data["name"]
        org.slug = _generate_slug(update_data["name"])

        # Ensure slug uniqueness
        base_slug = org.slug
        counter = 1
        while True:
            existing_slug = await db.execute(
                select(Organization).where(
                    Organization.slug == org.slug,
                    Organization.id != org_id,
                )
            )
            if not existing_slug.scalar_one_or_none():
                break
            org.slug = f"{base_slug}-{counter}"
            counter += 1

    await log_action(db, user_id=current_user.id, action="update", entity_type="organization", entity_id=str(org.id), user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(org)
    logger.info("User %s updated organization %s", current_user.id, org.id)
    return org


# ---------------------------------------------------------------------------
# DELETE /organizations/{id} - delete org
# ---------------------------------------------------------------------------

@router.delete("/{org_id}")
async def delete_organization(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an organization. Owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    _require_role(role, ["owner"], "delete organization")

    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise NotFoundException("Organization")

    # Clear current_organization_id for any users pointing to this org
    users_result = await db.execute(
        select(User).where(User.current_organization_id == org_id)
    )
    for user in users_result.scalars().all():
        user.current_organization_id = None

    await log_action(db, user_id=current_user.id, action="delete", entity_type="organization", entity_id=str(org_id), user_email=current_user.email, organization_id=org_id)
    await db.delete(org)
    await db.commit()
    logger.info("User %s deleted organization %s", current_user.id, org_id)
    return {"message": "Organization deleted successfully"}


# ---------------------------------------------------------------------------
# POST /organizations/{id}/members - add member
# ---------------------------------------------------------------------------

@router.post("/{org_id}/members", response_model=OrgMemberResponse, status_code=201)
async def add_member(
    org_id: UUID,
    data: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a member to the organization. Owner or admin only."""
    role = await _get_member_role(db, org_id, current_user.id)
    _require_role(role, ["owner", "admin"], "add members")

    # Verify the org exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise NotFoundException("Organization")

    # Find the user to add
    if data.user_id:
        user_result = await db.execute(
            select(User).where(User.id == data.user_id)
        )
        target_user = user_result.scalar_one_or_none()
    elif data.email:
        user_result = await db.execute(
            select(User).where(User.email == data.email)
        )
        target_user = user_result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=422, detail="Either user_id or email is required")

    if not target_user:
        raise NotFoundException("User")

    # Check if already a member
    existing = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == target_user.id,
        )
    )
    existing_member = existing.scalar_one_or_none()
    if existing_member:
        if existing_member.is_active:
            raise HTTPException(status_code=409, detail="User is already a member of this organization")
        # Reactivate inactive member
        existing_member.is_active = True
        existing_member.role = data.role
        await log_action(db, user_id=current_user.id, action="add_member", entity_type="organization_member", entity_id=str(target_user.id), details=f"role={data.role},reactivated=true", user_email=current_user.email, organization_id=org_id)
        await db.commit()
        await db.refresh(existing_member)
        return OrgMemberResponse(
            id=existing_member.id,
            user_id=existing_member.user_id,
            username=target_user.username,
            email=target_user.email,
            role=existing_member.role,
            joined_at=existing_member.joined_at,
            is_active=existing_member.is_active,
        )

    member = OrganizationMember(
        organization_id=org_id,
        user_id=target_user.id,
        role=data.role,
    )
    db.add(member)
    await log_action(db, user_id=current_user.id, action="add_member", entity_type="organization_member", entity_id=str(target_user.id), details=f"role={data.role}", user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(member)

    logger.info(
        "User %s added user %s to organization %s",
        current_user.id, target_user.id, org_id,
    )
    return OrgMemberResponse(
        id=member.id,
        user_id=member.user_id,
        username=target_user.username,
        email=target_user.email,
        role=member.role,
        joined_at=member.joined_at,
        is_active=member.is_active,
    )


# ---------------------------------------------------------------------------
# GET /organizations/{id}/members - list members
# ---------------------------------------------------------------------------

@router.get("/{org_id}/members", response_model=List[OrgMemberResponse])
async def list_members(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all members of an organization. Must be a member to view."""
    role = await _get_member_role(db, org_id, current_user.id)
    if role is None:
        raise ForbiddenException("You are not a member of this organization")

    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.is_active == True,
        )
        .order_by(OrganizationMember.joined_at)
    )
    rows = result.all()

    members: List[OrgMemberResponse] = []
    for member, user in rows:
        members.append(OrgMemberResponse(
            id=member.id,
            user_id=member.user_id,
            username=user.username,
            email=user.email,
            role=member.role,
            joined_at=member.joined_at,
            is_active=member.is_active,
        ))
    return members


# ---------------------------------------------------------------------------
# PUT /organizations/{id}/members/{user_id} - change member role
# ---------------------------------------------------------------------------

@router.put("/{org_id}/members/{member_user_id}", response_model=OrgMemberResponse)
async def change_member_role(
    org_id: UUID,
    member_user_id: UUID,
    data: ChangeMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a member's role. Owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    _require_role(role, ["owner"], "change member roles")

    # Cannot change own role
    if member_user_id == current_user.id:
        raise HTTPException(status_code=422, detail="Cannot change your own role")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == member_user_id,
            OrganizationMember.is_active == True,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise NotFoundException("Member")

    member.role = data.role

    # Fetch user info for response
    user_result = await db.execute(
        select(User).where(User.id == member_user_id)
    )
    user = user_result.scalar_one_or_none()

    await log_action(db, user_id=current_user.id, action="change_role", entity_type="organization_member", entity_id=str(member_user_id), details=f"new_role={data.role}", user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(member)

    logger.info(
        "User %s changed role of user %s to %s in org %s",
        current_user.id, member_user_id, data.role, org_id,
    )
    return OrgMemberResponse(
        id=member.id,
        user_id=member.user_id,
        username=user.username if user else None,
        email=user.email if user else None,
        role=member.role,
        joined_at=member.joined_at,
        is_active=member.is_active,
    )


# ---------------------------------------------------------------------------
# DELETE /organizations/{id}/members/{user_id} - remove member
# ---------------------------------------------------------------------------

@router.delete("/{org_id}/members/{member_user_id}")
async def remove_member(
    org_id: UUID,
    member_user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the organization. Owner/admin can remove others, anyone can remove self."""
    is_self_removal = member_user_id == current_user.id
    role = await _get_member_role(db, org_id, current_user.id)

    if not is_self_removal:
        _require_role(role, ["owner", "admin"], "remove members")
    else:
        if role is None:
            raise ForbiddenException("You are not a member of this organization")

    # Owner cannot remove themselves (they must delete the org or transfer ownership)
    if is_self_removal and role == "owner":
        raise HTTPException(
            status_code=422,
            detail="Owner cannot leave the organization. Delete the org or transfer ownership first.",
        )

    # Admins cannot remove other admins or owner
    if not is_self_removal and role == "admin":
        target_role = await _get_member_role(db, org_id, member_user_id)
        if target_role in ("owner", "admin"):
            raise ForbiddenException("Admins cannot remove other admins or the owner")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == member_user_id,
            OrganizationMember.is_active == True,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise NotFoundException("Member")

    member.is_active = False

    # Clear current_organization_id if the removed user was viewing this org
    user_result = await db.execute(
        select(User).where(User.id == member_user_id)
    )
    removed_user = user_result.scalar_one_or_none()
    if removed_user and removed_user.current_organization_id == org_id:
        removed_user.current_organization_id = None

    await log_action(db, user_id=current_user.id, action="remove_member", entity_type="organization_member", entity_id=str(member_user_id), user_email=current_user.email, organization_id=org_id)
    await db.commit()
    logger.info(
        "User %s removed user %s from organization %s",
        current_user.id, member_user_id, org_id,
    )
    return {"message": "Member removed successfully"}


# ---------------------------------------------------------------------------
# POST /organizations/switch - switch org context
# ---------------------------------------------------------------------------

@router.post("/switch")
async def switch_organization(
    data: SwitchOrganizationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch the user's current organization context.

    Set organization_id to null to switch back to personal view.
    """
    if data.organization_id is None:
        # Switch to personal view
        current_user.current_organization_id = None
        await db.commit()
        return {"message": "Switched to personal view", "current_organization_id": None}

    # Verify user is a member of the target org
    role = await _get_member_role(db, data.organization_id, current_user.id)
    if role is None:
        raise ForbiddenException("You are not a member of this organization")

    # Verify org exists and is active
    org_result = await db.execute(
        select(Organization).where(
            Organization.id == data.organization_id,
            Organization.is_active == True,
        )
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise NotFoundException("Organization")

    current_user.current_organization_id = data.organization_id
    await log_action(db, user_id=current_user.id, action="switch_context", entity_type="organization", entity_id=str(data.organization_id), user_email=current_user.email, organization_id=data.organization_id)
    await db.commit()

    logger.info(
        "User %s switched to organization %s",
        current_user.id, data.organization_id,
    )
    return {
        "message": f"Switched to organization: {org.name}",
        "current_organization_id": str(data.organization_id),
    }


# ── Audit Log ─────────────────────────────────────────────────────


@router.get("/{org_id}/audit-log", response_model=AuditLogListResponse)
async def get_organization_audit_log(
    org_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get audit log for an organization. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    if role not in ("owner", "admin"):
        raise ForbiddenException("Only admins and owners can view audit logs")

    query = select(AuditLog).where(AuditLog.organization_id == org_id)

    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)

    # Total count
    count_query = select(sa_func.count()).select_from(
        query.subquery()
    )
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    offset = (page - 1) * per_page
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
    )


# ── Reports ────────────────────────────────────────────────────────


@router.post("/{org_id}/reports", response_model=ReportResponse, status_code=201)
async def generate_report(
    org_id: UUID,
    data: ReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a report for the organization. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "generate_reports")

    # Build report data — aggregate transactions in period
    tx_query = select(
        sa_func.count(Transaction.id).label("transaction_count"),
        sa_func.coalesce(
            sa_func.sum(
                sa_func.case(
                    (Transaction.type == "income", Transaction.amount),
                    else_=Decimal("0"),
                )
            ),
            Decimal("0"),
        ).label("total_income"),
        sa_func.coalesce(
            sa_func.sum(
                sa_func.case(
                    (Transaction.type == "expense", Transaction.amount),
                    else_=Decimal("0"),
                )
            ),
            Decimal("0"),
        ).label("total_expenses"),
    ).where(
        Transaction.organization_id == org_id,
        Transaction.date >= data.period_start,
        Transaction.date <= data.period_end,
    )
    row = (await db.execute(tx_query)).one()

    report_data = {
        "transaction_count": row.transaction_count,
        "total_income": str(row.total_income),
        "total_expenses": str(row.total_expenses),
        "net": str(row.total_income - row.total_expenses),
    }

    report = OrgReport(
        organization_id=org_id,
        report_type=data.report_type,
        period_start=data.period_start,
        period_end=data.period_end,
        data=report_data,
        generated_by=current_user.id,
    )
    db.add(report)
    await log_action(db, user_id=current_user.id, action="generate_report", entity_type="org_report", entity_id=str(report.id), user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(report)
    logger.info("User %s generated report %s for org %s", current_user.id, report.id, org_id)
    return report


@router.get("/{org_id}/reports", response_model=ReportListResponse)
async def list_reports(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List reports for the organization. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "generate_reports")

    result = await db.execute(
        select(OrgReport)
        .where(OrgReport.organization_id == org_id)
        .order_by(OrgReport.generated_at.desc())
    )
    items = result.scalars().all()

    return ReportListResponse(
        items=[ReportResponse.model_validate(r) for r in items],
        total=len(items),
    )


@router.get("/{org_id}/reports/{report_id}", response_model=ReportResponse)
async def get_report(
    org_id: UUID,
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific report. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "generate_reports")

    result = await db.execute(
        select(OrgReport).where(
            OrgReport.id == report_id,
            OrgReport.organization_id == org_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("Report not found")
    return report


@router.delete("/{org_id}/reports/{report_id}")
async def delete_report(
    org_id: UUID,
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a report. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "generate_reports")

    result = await db.execute(
        select(OrgReport).where(
            OrgReport.id == report_id,
            OrgReport.organization_id == org_id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("Report not found")

    await log_action(db, user_id=current_user.id, action="delete_report", entity_type="org_report", entity_id=str(report_id), user_email=current_user.email, organization_id=org_id)
    await db.delete(report)
    await db.commit()
    logger.info("User %s deleted report %s", current_user.id, report_id)
    return {"detail": "Report deleted"}


# ── Expense Approvals ──────────────────────────────────────────────


@router.post("/{org_id}/approvals", response_model=ApprovalResponse, status_code=201)
async def submit_approval(
    org_id: UUID,
    data: ApprovalSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an expense for approval. Owner/admin/member."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "submit_for_approval")

    approval = ExpenseApproval(
        organization_id=org_id,
        requested_by=current_user.id,
        amount=data.amount,
        currency=data.currency,
        category_id=data.category_id,
        description=data.description,
    )
    db.add(approval)
    await log_action(db, user_id=current_user.id, action="submit_approval", entity_type="expense_approval", entity_id=str(approval.id), user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(approval)
    logger.info("User %s submitted approval %s in org %s", current_user.id, approval.id, org_id)

    resp = ApprovalResponse.model_validate(approval)
    resp.requester_email = current_user.email
    return resp


@router.get("/{org_id}/approvals/pending", response_model=PendingApprovalsResponse)
async def get_pending_approvals(
    org_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pending approvals. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "approve_expenses")

    result = await db.execute(
        select(ExpenseApproval)
        .where(
            ExpenseApproval.organization_id == org_id,
            ExpenseApproval.status == "pending",
        )
        .order_by(ExpenseApproval.requested_at.desc())
    )
    items = result.scalars().all()

    responses = []
    for item in items:
        resp = ApprovalResponse.model_validate(item)
        # Enrich with requester email
        user_result = await db.execute(
            select(User.email).where(User.id == item.requested_by)
        )
        resp.requester_email = user_result.scalar_one_or_none()
        responses.append(resp)

    return PendingApprovalsResponse(count=len(responses), items=responses)


@router.get("/{org_id}/approvals", response_model=ApprovalListResponse)
async def list_approvals(
    org_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all approvals for the org. Admin/owner see all, members see own."""
    role = await _get_member_role(db, org_id, current_user.id)
    if role is None:
        raise ForbiddenException("You are not a member of this organization")

    query = select(ExpenseApproval).where(ExpenseApproval.organization_id == org_id)

    # Non-admin/owner can only see their own
    if role not in ("owner", "admin"):
        query = query.where(ExpenseApproval.requested_by == current_user.id)

    if status:
        query = query.where(ExpenseApproval.status == status)

    count_query = select(sa_func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(ExpenseApproval.requested_at.desc()).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    responses = []
    for item in items:
        resp = ApprovalResponse.model_validate(item)
        user_result = await db.execute(
            select(User.email).where(User.id == item.requested_by)
        )
        resp.requester_email = user_result.scalar_one_or_none()
        if item.approved_by:
            approver_result = await db.execute(
                select(User.email).where(User.id == item.approved_by)
            )
            resp.approver_email = approver_result.scalar_one_or_none()
        responses.append(resp)

    return ApprovalListResponse(
        items=responses,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/{org_id}/approvals/{approval_id}/approve", response_model=ApprovalResponse)
async def approve_expense(
    org_id: UUID,
    approval_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve an expense. Admin/owner only. Auto-creates a transaction."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "approve_expenses")

    result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.id == approval_id,
            ExpenseApproval.organization_id == org_id,
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise NotFoundException("Approval not found")

    if approval.status != "pending":
        raise HTTPException(status_code=422, detail=f"Approval is already {approval.status}")

    approval.status = "approved"
    approval.approved_by = current_user.id
    approval.resolved_at = datetime.utcnow()

    # Auto-create transaction from approved expense
    tx = Transaction(
        user_id=approval.requested_by,
        organization_id=org_id,
        amount=approval.amount,
        currency=approval.currency,
        type="expense",
        category_id=approval.category_id,
        description=approval.description or "Approved expense",
        date=datetime.utcnow().date(),
    )
    db.add(tx)
    await db.flush()

    approval.transaction_id = tx.id

    await log_action(db, user_id=current_user.id, action="approve_expense", entity_type="expense_approval", entity_id=str(approval_id), details=f"transaction_id={tx.id}", user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(approval)
    logger.info("User %s approved expense %s in org %s", current_user.id, approval_id, org_id)

    resp = ApprovalResponse.model_validate(approval)
    resp.approver_email = current_user.email
    return resp


@router.post("/{org_id}/approvals/{approval_id}/reject", response_model=ApprovalResponse)
async def reject_expense(
    org_id: UUID,
    approval_id: UUID,
    data: ApprovalRejectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject an expense. Admin/owner only."""
    role = await _get_member_role(db, org_id, current_user.id)
    check_org_permission(role, "approve_expenses")

    result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.id == approval_id,
            ExpenseApproval.organization_id == org_id,
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise NotFoundException("Approval not found")

    if approval.status != "pending":
        raise HTTPException(status_code=422, detail=f"Approval is already {approval.status}")

    approval.status = "rejected"
    approval.approved_by = current_user.id
    approval.rejection_reason = data.rejection_reason
    approval.resolved_at = datetime.utcnow()

    await log_action(db, user_id=current_user.id, action="reject_expense", entity_type="expense_approval", entity_id=str(approval_id), user_email=current_user.email, organization_id=org_id)
    await db.commit()
    await db.refresh(approval)
    logger.info("User %s rejected expense %s in org %s", current_user.id, approval_id, org_id)

    resp = ApprovalResponse.model_validate(approval)
    resp.approver_email = current_user.email
    return resp
