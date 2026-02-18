from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_data_context, DataContext
from app.api.v1.schemas.obligo import (
    ObligoDetailsResponse,
    ObligoSummaryResponse,
)
from app.db.models import User
from app.db.session import get_db
from app.services.obligo_service import compute_obligo_details, compute_obligo_summary

router = APIRouter(prefix="/obligo", tags=["Obligo"])


@router.get("", response_model=ObligoSummaryResponse)
async def get_obligo_summary(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    summary = await compute_obligo_summary(db, ctx)
    return ObligoSummaryResponse(**summary)


@router.get("/details", response_model=ObligoDetailsResponse)
async def get_obligo_details(
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    summary = await compute_obligo_summary(db, ctx)
    details = await compute_obligo_details(db, ctx)
    return ObligoDetailsResponse(
        items=details,
        summary=ObligoSummaryResponse(**summary),
    )
