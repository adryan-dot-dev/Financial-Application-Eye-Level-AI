# BACKEND DATA INTEGRITY & CALCULATIONS AUDIT

## Mission

Audit all backend calculations, data flow, and business logic to ensure:
1. All financial calculations happen server-side (not client-only)
2. Organization data isolation works across ALL endpoints
3. Loan payment recording works correctly
4. No data corruption edge cases exist
5. All monetary operations use Decimal precision

---

## TECH STACK

- Python 3.9.6 — `from __future__ import annotations` in ALL files
- FastAPI + SQLAlchemy 2.0 (async) + asyncpg
- PostgreSQL 16 via Docker
- Pydantic v2 for schemas
- Alembic for migrations
- DECIMAL(15,2) for all financial fields
- JWT auth with refresh tokens

---

## PRIORITY 1 — ORGANIZATION DATA ISOLATION (CRITICAL)

### Problem

The `DataContext` system (`get_data_context()` in `app/api/deps.py`) was recently added to properly filter data by organization. However, **6 out of 10 endpoint modules still use the old `current_user.id` pattern** instead of `DataContext.ownership_filter()`.

### DataContext System (Already Implemented)

```python
# app/api/deps.py — DataContext class
@dataclass
class DataContext:
    user_id: UUID
    organization_id: Optional[UUID]
    is_org_context: bool

    def ownership_filter(self, model_class):
        """Personal: WHERE user_id=X AND organization_id IS NULL
           Org:      WHERE organization_id=Y"""
        if self.is_org_context:
            return model_class.organization_id == self.organization_id
        return and_(
            model_class.user_id == self.user_id,
            model_class.organization_id.is_(None),
        )

    def create_fields(self) -> dict:
        return {"user_id": self.user_id, "organization_id": self.organization_id}
```

### Modules That NEED Migration

Each module below needs to:
1. Import `get_data_context` and `DataContext` from `app.api.deps`
2. Add `ctx: DataContext = Depends(get_data_context)` to LIST/GET endpoints
3. Replace `Model.user_id == current_user.id` with `ctx.ownership_filter(Model)` in list queries
4. On CREATE: use `ctx.create_fields()` to set both `user_id` and `organization_id`
5. Keep `current_user.id` for UPDATE/DELETE ownership checks (security)

**IMPORTANT:** Each model must have an `organization_id` column. The Subscription model already has it (see `subscription.py`). Check if the other models have it. If not, create an Alembic migration to add `organization_id` (UUID, FK to organizations.id, nullable, default NULL) to each table.

| Module | File | `current_user.id` Count | Status |
|--------|------|------------------------|--------|
| `fixed.py` | `app/api/v1/endpoints/fixed.py` | ~19 | 🔴 Needs migration |
| `installments.py` | `app/api/v1/endpoints/installments.py` | ~20 | 🔴 Needs migration |
| `loans.py` | `app/api/v1/endpoints/loans.py` | ~19 | 🔴 Needs migration |
| `subscriptions.py` | `app/api/v1/endpoints/subscriptions.py` | ~15 | 🔴 Needs migration |
| `categories.py` | `app/api/v1/endpoints/categories.py` | ~8 | 🔴 Needs migration |
| `alerts.py` | `app/api/v1/endpoints/alerts.py` | ~8 | 🔴 Needs migration |

### Modules Already Migrated (reference)

These 4 modules already use `get_accessible_user_ids`. They should also be migrated to `DataContext` for consistency, but they work for now:
- `transactions.py`
- `dashboard.py`
- `forecast.py`
- `balance.py`

### Migration Pattern for Each File

**BEFORE (current — broken for orgs):**
```python
from app.api.deps import get_current_user

@router.get("", response_model=List[ItemResponse])
async def list_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Item).where(Item.user_id == current_user.id)
    )
    return result.scalars().all()

@router.post("", response_model=ItemResponse)
async def create_item(
    data: ItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = Item(user_id=current_user.id, **data.model_dump())
    db.add(item)
    ...
```

**AFTER (correct — org-aware):**
```python
from app.api.deps import get_current_user, get_data_context, DataContext

@router.get("", response_model=List[ItemResponse])
async def list_items(
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Item).where(ctx.ownership_filter(Item))
    )
    return result.scalars().all()

@router.post("", response_model=ItemResponse)
async def create_item(
    data: ItemCreate,
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    item = Item(**ctx.create_fields(), **data.model_dump())
    db.add(item)
    ...
```

**For UPDATE/DELETE — keep security check:**
```python
@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: UUID,
    data: ItemUpdate,
    current_user: User = Depends(get_current_user),
    ctx: DataContext = Depends(get_data_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Item).where(
            Item.id == item_id,
            ctx.ownership_filter(Item),  # Org-aware lookup
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("Item not found")
    ...
```

### Database Migration Required

Check each model for `organization_id` column. If missing, create migration:

```python
# alembic/versions/XXXX_add_org_id_to_all_tables.py

def upgrade():
    for table in ['fixed_income_expenses', 'installments', 'loans', 'categories', 'alerts']:
        op.add_column(table, sa.Column('organization_id', sa.UUID(), nullable=True))
        op.create_foreign_key(
            f'fk_{table}_org_id', table, 'organizations',
            ['organization_id'], ['id'], ondelete='CASCADE'
        )
        op.create_index(f'ix_{table}_organization_id', table, ['organization_id'])
```

---

## PRIORITY 2 — LOAN PAYMENT BUG

### Problem
User reports error when recording a loan payment.

### Investigation Steps

1. **Check the `record_payment` endpoint** in `app/api/v1/endpoints/loans.py` (line ~228):
   - Verify `with_for_update()` doesn't cause deadlocks
   - Check if `data.amount > loan.remaining_balance` comparison works with Decimal vs float
   - Verify `loan.payments_made` and `loan.remaining_balance` are properly initialized on loan creation

2. **Check the Pydantic schema** in `app/api/v1/schemas/loan.py`:
   - `LoanPaymentRecord.amount` is `Decimal` with `gt=0, max_digits=15, decimal_places=2`
   - Frontend sends `number` (JavaScript float). Verify Pydantic coercion works
   - The `_validate_decimal_precision` validator strips leading zeros and checks digit count — verify no false positives

3. **Test scenario:**
   ```
   1. Create a loan: original_amount=100000, monthly_payment=5000, total_payments=20
   2. Verify remaining_balance = 100000 after creation
   3. Record payment: amount=5000
   4. Expected: payments_made=1, remaining_balance=95000
   5. Record payment with amount > remaining_balance → should get clear error message
   ```

4. **Edge cases to test:**
   - Payment amount with many decimal places (e.g., 5000.999) — should be rejected (max 2 decimal places)
   - Payment of exactly remaining_balance → should complete the loan
   - Payment on already completed loan → should return clear error
   - Negative amount → should be rejected by `gt=0`
   - Zero amount → should be rejected by `gt=0`

5. **Fix if needed:**
   - Ensure `remaining_balance` is set correctly on loan creation
   - Ensure error messages are human-readable (not raw Pydantic errors)
   - Consider sending amount as string from frontend to preserve Decimal precision

---

## PRIORITY 3 — FORECAST CALCULATIONS (SERVER-SIDE)

### Current State
The forecast engine (`app/services/forecast_service.py`) runs server-side. The "What If?" feature runs client-side only.

### Verify These Calculations

1. **Balance chain integrity:**
   ```
   month[N].opening_balance == month[N-1].closing_balance
   month[0].opening_balance == current_balance (from BankBalance table)
   ```

2. **Subscription inclusion in forecast:**
   - `compute_monthly_forecast()` must include subscriptions
   - Check if billing_cycle correctly maps to months (monthly=1, quarterly=3, semi_annual=6, annual=12)
   - Verify `next_renewal_date` is properly advanced after each billing cycle

3. **Currency conversion:**
   - All amounts must be converted to user's base currency
   - Check `exchange_rate_service.convert_amount()` for edge cases (missing rate, same currency, zero amount)

4. **Installment payment tracking:**
   - Installments with `payments_made >= total_payments` should not appear in forecast
   - Verify `payments_remaining` calculation is correct

5. **Fixed income/expense:**
   - Only `is_active=True` entries should appear in forecast
   - Paused entries (if `paused_at` is set) should be excluded

---

## PRIORITY 4 — SETTINGS ENDPOINT FIX

### Problem
The Pydantic schema `SettingsUpdate` had field definitions placed after a `@field_validator` method. This has been partially fixed (fields moved before validators), but verify:

1. **Test:** `PUT /api/v1/settings` with `{"theme": "dark"}` → should return updated settings
2. **Test:** `PUT /api/v1/settings` with `{"currency": "XYZ"}` → should return validation error
3. **Test:** `GET /api/v1/settings` for a user with no settings → should auto-create with defaults

---

## PRIORITY 5 — DECIMAL PRECISION EVERYWHERE

### Audit all monetary operations for Decimal safety

1. **No float arithmetic on monetary values:**
   ```python
   # BAD:
   total = float(amount1) + float(amount2)

   # GOOD:
   total = amount1 + amount2  # Both are Decimal
   ```

2. **Check all models use DECIMAL(15,2):**
   - `transactions.amount`
   - `fixed_income_expenses.amount`
   - `installments.amount`, `total_amount`
   - `loans.original_amount`, `monthly_payment`, `remaining_balance`
   - `subscriptions.amount`
   - `bank_balances.balance`

3. **Check Pydantic schemas use `Decimal` not `float`:**
   - Every `amount` field in create/update schemas should be `Decimal`
   - Response schemas should also use `Decimal`

---

## PRIORITY 6 — EDGE CASES TO HANDLE

### 6A — Concurrent Modification
When two users in the same org modify the same data simultaneously:
- Use `select(...).with_for_update()` for critical operations (payments, balance updates)
- Already used in loan payment — verify it's used in other payment/balance operations

### 6B — Cascade Deletes
When deleting an organization:
- All related data (fixed, installments, loans, etc.) with `organization_id = org_id` should be cleaned up
- Verify FK cascade rules are correct

### 6C — Orphaned Data
After a user is removed from an org:
- Their personal data (where `organization_id IS NULL`) should remain intact
- Their contributions to the org (where `organization_id = org_id`) should remain for other members
- Verify no data is lost on member removal

### 6D — Settings per User, Not per Org
Settings (theme, language, etc.) are personal — they should NOT be affected by org switching.
Verify `settings.py` endpoint does NOT use `DataContext` or `get_accessible_user_ids()`.

---

## PROCESSING ORDER

1. **Check models for `organization_id`** → Create migration if missing
2. **Migrate 6 endpoint files** to use `DataContext` (Priority 1)
3. **Debug and fix loan payment** (Priority 2)
4. **Verify forecast calculations** (Priority 3)
5. **Test settings endpoint** (Priority 4)
6. **Audit Decimal precision** (Priority 5)
7. **Test edge cases** (Priority 6)
8. **Run full test suite** → `cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v`

---

## TESTING COMMANDS

```bash
# Run all tests
cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v

# Run specific test module
PYTHONPATH=. pytest tests/test_loans.py -v

# Run with coverage
PYTHONPATH=. pytest tests/ --cov=app --cov-report=term-missing

# Test a single endpoint manually
curl -X POST http://localhost:8000/api/v1/loans/{id}/payment \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"amount": "5000.00"}'
```

---

## WHAT "DONE" LOOKS LIKE

### Data Isolation:
- [ ] All 6 endpoint modules migrated to `DataContext`
- [ ] All models have `organization_id` column
- [ ] Alembic migration created and tested
- [ ] Personal view shows ONLY personal data
- [ ] Org view shows ALL org members' data
- [ ] Creating data in org view sets `organization_id` correctly

### Calculations:
- [ ] Forecast balance chain is mathematically correct
- [ ] Subscription billing cycles correctly calculated
- [ ] Loan payment recording works end-to-end
- [ ] No float arithmetic on monetary values

### Tests:
- [ ] All existing tests pass
- [ ] New tests for org data isolation
- [ ] New tests for loan payment edge cases
- [ ] `pytest tests/ -v` = 0 failures
