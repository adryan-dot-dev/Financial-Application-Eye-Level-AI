from __future__ import annotations

import logging
import time
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported currencies
# ---------------------------------------------------------------------------
SUPPORTED_CURRENCIES: List[str] = ["ILS", "USD", "EUR"]

# Frankfurter API base URL (free, no auth required)
FRANKFURTER_BASE_URL = "https://api.frankfurter.app"

# Cache TTL in seconds (1 hour)
CACHE_TTL_SECONDS = 3600


# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------
class _RateCache:
    """Simple in-memory cache for exchange rates with TTL."""

    def __init__(self) -> None:
        # Mapping: (from_currency, to_currency) -> (rate, timestamp)
        self._rates: Dict[Tuple[str, str], Tuple[Decimal, float]] = {}

    def get(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        """Return cached rate if still valid, else None."""
        key = (from_currency.upper(), to_currency.upper())
        entry = self._rates.get(key)
        if entry is None:
            return None
        rate, ts = entry
        if time.time() - ts > CACHE_TTL_SECONDS:
            return None  # expired
        return rate

    def set(self, from_currency: str, to_currency: str, rate: Decimal) -> None:
        key = (from_currency.upper(), to_currency.upper())
        self._rates[key] = (rate, time.time())

    def get_expired(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        """Return cached rate even if expired (fallback for API failures)."""
        key = (from_currency.upper(), to_currency.upper())
        entry = self._rates.get(key)
        if entry is None:
            return None
        return entry[0]

    def clear(self) -> None:
        self._rates.clear()


_cache = _RateCache()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
async def _fetch_rates_from_api(
    base_currency: str,
    target_currencies: List[str],
) -> Optional[Dict[str, Decimal]]:
    """Fetch exchange rates from Frankfurter.app API.

    Returns a dict like {"USD": Decimal("0.27"), "EUR": Decimal("0.25")}
    or None on failure.
    """
    targets = ",".join(c for c in target_currencies if c != base_currency)
    if not targets:
        return {}

    url = f"{FRANKFURTER_BASE_URL}/latest?from={base_currency}&to={targets}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        rates: Dict[str, Decimal] = {}
        for currency, rate_value in data.get("rates", {}).items():
            rates[currency] = Decimal(str(rate_value))

        return rates

    except (httpx.HTTPError, httpx.TimeoutException, KeyError, ValueError) as exc:
        logger.warning(
            "Failed to fetch exchange rates from Frankfurter API: %s", exc
        )
        return None


async def _ensure_rates_cached(base_currency: str) -> None:
    """Ensure we have cached rates for all supported currencies from the given base."""
    targets = [c for c in SUPPORTED_CURRENCIES if c != base_currency]
    needs_refresh = any(
        _cache.get(base_currency, t) is None for t in targets
    )

    if not needs_refresh:
        return

    rates = await _fetch_rates_from_api(base_currency, targets)
    if rates is not None:
        for currency, rate in rates.items():
            _cache.set(base_currency, currency, rate)
            # Also cache the inverse
            if rate != Decimal("0"):
                inverse = (Decimal("1") / rate).quantize(
                    Decimal("0.000001"), rounding=ROUND_HALF_UP
                )
                _cache.set(currency, base_currency, inverse)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """Get the exchange rate from one currency to another.

    Returns a Decimal representing how many units of to_currency you get
    for 1 unit of from_currency.

    Falls back to cached (possibly expired) rates if the API is unavailable,
    and returns Decimal("1") as a last resort if no rates are available.
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency == to_currency:
        return Decimal("1")

    # Try fresh cache first
    cached = _cache.get(from_currency, to_currency)
    if cached is not None:
        return cached

    # Try to refresh from API
    await _ensure_rates_cached(from_currency)

    # Check cache again after refresh
    cached = _cache.get(from_currency, to_currency)
    if cached is not None:
        return cached

    # Fallback: try expired cache
    expired = _cache.get_expired(from_currency, to_currency)
    if expired is not None:
        logger.warning(
            "Using expired exchange rate for %s->%s: %s",
            from_currency,
            to_currency,
            expired,
        )
        return expired

    # Last resort: return 1.0 (no conversion)
    logger.error(
        "No exchange rate available for %s->%s, defaulting to 1.0",
        from_currency,
        to_currency,
    )
    return Decimal("1")


async def convert_amount(
    amount: Decimal, from_currency: str, to_currency: str
) -> Decimal:
    """Convert an amount from one currency to another.

    Returns the converted amount rounded to 2 decimal places.
    """
    if from_currency.upper() == to_currency.upper():
        return amount

    rate = await get_exchange_rate(from_currency, to_currency)
    converted = (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return converted


async def convert_to_base(
    amount: Decimal,
    currency: str,
    base_currency: str = "ILS",
) -> Decimal:
    """Convert an amount to the user's base/preferred currency.

    Convenience wrapper around convert_amount.
    """
    return await convert_amount(amount, currency, base_currency)


async def get_all_rates(base_currency: str = "ILS") -> Dict[str, Decimal]:
    """Get exchange rates for all supported currencies from a base currency.

    Returns a dict like {"ILS": 1, "USD": 0.27, "EUR": 0.25}.
    """
    base_currency = base_currency.upper()
    await _ensure_rates_cached(base_currency)

    rates: Dict[str, Decimal] = {base_currency: Decimal("1")}
    for currency in SUPPORTED_CURRENCIES:
        if currency == base_currency:
            continue
        rate = _cache.get(base_currency, currency)
        if rate is not None:
            rates[currency] = rate
        else:
            # Try expired cache as fallback
            expired = _cache.get_expired(base_currency, currency)
            if expired is not None:
                rates[currency] = expired
            else:
                logger.warning(
                    "No rate available for %s->%s", base_currency, currency
                )

    return rates


def get_supported_currencies() -> List[Dict[str, str]]:
    """Return list of supported currencies with metadata."""
    currency_info = {
        "ILS": {"code": "ILS", "name": "Israeli New Shekel", "symbol": "\u20aa"},
        "USD": {"code": "USD", "name": "US Dollar", "symbol": "$"},
        "EUR": {"code": "EUR", "name": "Euro", "symbol": "\u20ac"},
    }
    return [currency_info[c] for c in SUPPORTED_CURRENCIES]


async def prepare_currency_fields(
    input_amount: Decimal,
    input_currency: str,
    base_currency: str,
) -> Dict[str, Decimal | str]:
    """Calculate currency conversion fields for storing multi-currency data.

    Returns dict with:
    - converted_amount: amount in base currency
    - original_amount: input amount unchanged
    - original_currency: input currency code
    - exchange_rate: rate used for conversion
    """
    input_currency = input_currency.upper()
    base_currency = base_currency.upper()

    if input_currency == base_currency:
        return {
            "converted_amount": input_amount,
            "original_amount": input_amount,
            "original_currency": input_currency,
            "exchange_rate": Decimal("1"),
        }

    rate = await get_exchange_rate(input_currency, base_currency)
    converted = (input_amount * rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return {
        "converted_amount": converted,
        "original_amount": input_amount,
        "original_currency": input_currency,
        "exchange_rate": rate,
    }


def clear_cache() -> None:
    """Clear the rate cache (useful for testing)."""
    _cache.clear()
