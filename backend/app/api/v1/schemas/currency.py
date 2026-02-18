from __future__ import annotations

from decimal import Decimal
from typing import Dict, List

from pydantic import BaseModel


class ExchangeRateResponse(BaseModel):
    base_currency: str
    rates: Dict[str, Decimal]


class CurrencyConvertResponse(BaseModel):
    from_currency: str
    to_currency: str
    original_amount: Decimal
    converted_amount: Decimal
    exchange_rate: Decimal


class SupportedCurrencyItem(BaseModel):
    code: str
    name: str
    symbol: str


class SupportedCurrenciesResponse(BaseModel):
    currencies: List[SupportedCurrencyItem]
