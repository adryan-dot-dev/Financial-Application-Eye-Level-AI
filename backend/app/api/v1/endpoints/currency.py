from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_current_user
from app.api.v1.schemas.currency import (
    CurrencyConvertResponse,
    ExchangeRateResponse,
    SupportedCurrenciesResponse,
    SupportedCurrencyItem,
)
from app.db.models import User
from app.core.cache import set_cache_headers
from app.services.exchange_rate_service import (
    convert_amount,
    get_all_rates,
    get_exchange_rate,
    get_supported_currencies,
)

router = APIRouter(prefix="/currency", tags=["Currency"])


@router.get("/rates", response_model=ExchangeRateResponse)
async def get_rates(
    response: Response,
    base: str = Query(default="ILS", pattern="^[A-Z]{3}$"),
    current_user: User = Depends(get_current_user),
):
    """Get current exchange rates for all supported currencies."""
    set_cache_headers(response, max_age=3600, public=True)
    rates = await get_all_rates(base)
    return ExchangeRateResponse(base_currency=base, rates=rates)


@router.get("/convert", response_model=CurrencyConvertResponse)
async def convert(
    amount: Decimal = Query(..., gt=0),
    from_currency: str = Query(..., alias="from", pattern="^[A-Z]{3}$"),
    to: str = Query(..., pattern="^[A-Z]{3}$"),
    current_user: User = Depends(get_current_user),
):
    """Convert an amount from one currency to another."""
    rate = await get_exchange_rate(from_currency, to)
    converted = await convert_amount(amount, from_currency, to)
    return CurrencyConvertResponse(
        from_currency=from_currency,
        to_currency=to,
        original_amount=amount,
        converted_amount=converted,
        exchange_rate=rate,
    )


@router.get("/supported", response_model=SupportedCurrenciesResponse)
async def supported_currencies(
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """List all supported currencies."""
    set_cache_headers(response, max_age=3600, public=True)
    currencies = get_supported_currencies()
    return SupportedCurrenciesResponse(
        currencies=[SupportedCurrencyItem(**c) for c in currencies]
    )
