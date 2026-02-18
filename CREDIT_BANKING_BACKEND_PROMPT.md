# Backend Implementation Prompt — Credit, Banking & Organizations

## Mission

Implement three interconnected feature modules in the CashFlow backend:
1. **Credit Card Management** — Track cards, limits, utilization, and link charges
2. **Bank Accounts & Obligo** — Overdraft limits, bank exposure summary
3. **Organization Enhancement** — Full org data isolation, roles, audit, budgets, approvals, reports

All features must follow existing project patterns (DataContext, audit logging, DECIMAL precision) and include comprehensive tests.

---

## IMPORTANT — Technical Constraints

- **Python 3.9.6** — `from __future__ import annotations` in ALL files, NO `X | Y` syntax
- **DECIMAL(15,2)** for all financial amounts — NEVER use float
- **DataContext** for all queries — `ctx.ownership_filter()`, `ctx.create_fields()`
- **Audit logging** — `log_action()` on every write operation
- **Multi-currency** — store `original_amount`, `original_currency`, `exchange_rate`
- All new columns MUST be `nullable=True` or have `server_default` for migration safety
- Tests required for every endpoint (happy path + edge cases + error cases + auth)
- Current baseline: **561 tests, 0 failures** — must not regress

---

## Module 1: Credit Card Management

### New Model: `CreditCard`

**Table:** `credit_cards`

```
id                  UUID PK
user_id             UUID FK -> users.id CASCADE
organization_id     UUID FK -> organizations.id CASCADE (nullable)
name                VARCHAR(200)        — e.g., "ויזה כאל - ביזנס"
last_four_digits    VARCHAR(4)          — "1234"
card_network        VARCHAR(20)         — visa | mastercard | amex | isracard | diners
issuer              VARCHAR(100)        — "כאל" | "לאומי קארד" | "מקס"
credit_limit        NUMERIC(15,2)       — total credit limit
billing_day         INTEGER (1-28)      — day the bank charges the account
currency            VARCHAR(3) DEFAULT 'ILS'
is_active           BOOLEAN DEFAULT true
color               VARCHAR(7) DEFAULT '#6366F1' — hex for UI display
notes               TEXT nullable
created_at          DATETIME(tz)
updated_at          DATETIME(tz)
```

**Indexes:** `user_id`, `organization_id`, `(user_id, is_active)`

### Schema: `CreditCardCreate`
```python
class CreditCardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    last_four_digits: str = Field(..., min_length=4, max_length=4, pattern="^[0-9]{4}$")
    card_network: str = Field(..., pattern="^(visa|mastercard|amex|isracard|diners)$")
    issuer: str = Field(..., min_length=1, max_length=100)
    credit_limit: Decimal = Field(..., gt=0, max_digits=15, decimal_places=2)
    billing_day: int = Field(..., ge=1, le=28)
    currency: str = Field(default="ILS", pattern="^[A-Z]{3}$")
    color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    notes: Optional[str] = Field(None, max_length=1000)
```

### Schema: `CreditCardResponse`
```python
class CreditCardResponse(BaseModel):
    # ... all model fields ...
    # Computed fields (populated by endpoint):
    total_monthly_charges: Decimal = Decimal("0")    # sum of linked items
    utilization_amount: Decimal = Decimal("0")        # how much is used
    utilization_percentage: float = 0.0               # (used / limit) * 100
    available_credit: Decimal = Decimal("0")          # limit - used
    linked_installments_count: int = 0
    linked_subscriptions_count: int = 0
    linked_fixed_count: int = 0
```

### Schema: `CreditCardSummaryResponse`
```python
class CreditCardSummaryResponse(BaseModel):
    cards: List[CreditCardResponse]
    total_credit_limit: Decimal
    total_utilization: Decimal
    total_available: Decimal
    average_utilization_pct: float
```

### Schema: `CardMonthlyBillingResponse`
```python
class CardMonthlyBillingResponse(BaseModel):
    card: CreditCardResponse
    billing_date: date
    charges: List[CardChargeItem]           # each linked item
    total_charge: Decimal
    remaining_after_charge: Decimal         # available credit after
```

### Endpoints: `/api/v1/credit-cards`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create credit card |
| GET | `/` | List all cards with utilization |
| GET | `/summary` | All cards summary (totals) |
| GET | `/{id}` | Single card with full details |
| PUT | `/{id}` | Update card |
| DELETE | `/{id}` | Delete card |
| GET | `/{id}/charges` | All linked charges on this card |
| GET | `/{id}/next-billing` | What will be charged next billing cycle |

### Changes to Existing Models

Add `credit_card_id` (nullable UUID FK → credit_cards.id, SET NULL) to:
- `installments`
- `subscriptions`
- `fixed_income_expenses`
- `transactions`

Add `credit_card_id` to Create/Update schemas for all 4 modules.

### Utilization Calculation Logic

```python
def compute_card_utilization(card: CreditCard, db: AsyncSession, ctx: DataContext) -> dict:
    """
    Total monthly charges = sum of:
    - Active installments linked to this card → monthly_amount
    - Active subscriptions linked to this card → monthly equivalent
      (annual / 12, quarterly / 3, etc.)
    - Active fixed expenses linked to this card → amount
    """
    # Query all linked items WHERE credit_card_id = card.id AND is_active
    # Convert subscription amounts to monthly equivalent
    # Sum up = utilization
    # Return: total, percentage, available
```

### Alert Integration

New alert type in `alert_service.py`:

```python
ALERT_TYPE_CREDIT_LIMIT = "credit_limit_approaching"
ALERT_TYPE_CREDIT_EXCEEDED = "credit_limit_exceeded"

# In generate_alerts():
# For each active credit card:
#   if utilization_pct >= 90% → warning alert
#   if utilization_pct >= 100% → critical alert
```

---

## Module 2: Bank Accounts & Obligo

### New Model: `BankAccount`

**Table:** `bank_accounts`

```
id                  UUID PK
user_id             UUID FK -> users.id CASCADE
organization_id     UUID FK -> organizations.id CASCADE (nullable)
name                VARCHAR(200)        — "חשבון עסקי - בנק הפועלים"
bank_name           VARCHAR(100)        — "בנק הפועלים" | "לאומי" | "דיסקונט"
account_last_digits VARCHAR(4) nullable — "5678"
overdraft_limit     NUMERIC(15,2) DEFAULT 0  — מסגרת מינוס (positive number)
currency            VARCHAR(3) DEFAULT 'ILS'
is_primary          BOOLEAN DEFAULT false
notes               TEXT nullable
created_at          DATETIME(tz)
updated_at          DATETIME(tz)
```

### Link to Existing Balance

- Add `bank_account_id` (nullable FK) to `bank_balances` table
- When creating a balance entry, optionally link to a bank account
- If bank account has overdraft_limit, the "danger zone" is `-overdraft_limit`, not `0`

### Link to Loans

- Add `bank_account_id` (nullable FK) to `loans` table
- Loans linked to a bank account count toward that bank's obligo

### Endpoints: `/api/v1/bank-accounts`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create bank account |
| GET | `/` | List all accounts |
| GET | `/{id}` | Single account with balance + overdraft |
| PUT | `/{id}` | Update (change overdraft limit, etc.) |
| DELETE | `/{id}` | Delete |

### Obligo Endpoint: `/api/v1/obligo`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Full obligo summary |
| GET | `/details` | Detailed breakdown by type |

### Obligo Calculation

```python
class ObligoSummaryResponse(BaseModel):
    total_credit_card_limits: Decimal    # sum of all card limits
    total_credit_utilization: Decimal    # sum of all card usage
    total_loan_outstanding: Decimal      # sum of remaining_balance on all active loans
    total_overdraft_limits: Decimal      # sum of all bank account overdraft limits
    total_obligo: Decimal                # total_loan + total_credit_util
    total_available_credit: Decimal      # total_limits - total_obligo
    obligo_utilization_pct: float        # (total_obligo / total_limits) * 100

class ObligoDetailItem(BaseModel):
    type: str       # "credit_card" | "loan" | "overdraft"
    name: str       # card/loan/account name
    limit: Decimal
    utilized: Decimal
    available: Decimal
```

### Enhanced Forecast

Modify `forecast_service.py`:

```python
# In compute_monthly_forecast():
# Add to ForecastResponse:
#   overdraft_limit: Decimal  — the max negative the user can go
#   effective_floor: Decimal  — -overdraft_limit (the real "zero")
#   distance_from_floor: Decimal  — balance + overdraft_limit

# In has_negative_months calculation:
# If bank_account with overdraft exists:
#   negative = balance < -overdraft_limit (not balance < 0)
```

### Enhanced Alerts

```python
# New alert types:
ALERT_TYPE_APPROACHING_OVERDRAFT = "approaching_overdraft_limit"
# When forecast shows balance approaching -overdraft_limit → warning

ALERT_TYPE_HIGH_OBLIGO = "high_obligo_utilization"
# When total obligo > 80% of total limits → warning
```

---

## Module 3: Organization Enhancement

### Current State
Organizations exist with:
- `DataContext` for data isolation (personal vs org)
- `organization_id` FK on all financial tables
- Member management (add/remove/change role)
- Basic org settings
- Audit logging on org actions

### What Needs to Be Built

#### A. Org Audit Trail (Enhanced)
Already partially implemented. Enhance with:

- **GET `/organizations/{org_id}/audit-log`** — already exists, enhance with:
  - Filter by user_email
  - Filter by date range (start_date, end_date params)
  - Group by user view
  - Export to CSV

#### B. Monthly/Quarterly Reports

**New model: `OrgReport`**
```
id                  UUID PK
organization_id     UUID FK CASCADE
report_type         VARCHAR(20)     — 'monthly' | 'quarterly' | 'annual'
period_start        DATE
period_end          DATE
data                JSONB           — computed report data
generated_by        UUID FK -> users.id
generated_at        DATETIME(tz)
```

**Endpoints: `/api/v1/organizations/{org_id}/reports`**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate` | Generate report for period |
| GET | `/` | List generated reports |
| GET | `/{id}` | Get report data |
| DELETE | `/{id}` | Delete report |

**Report Data Structure:**
```python
class ReportData(BaseModel):
    period: str                         # "2026-02" or "2026-Q1"
    total_income: Decimal
    total_expenses: Decimal
    net_cashflow: Decimal
    top_expense_categories: List[CategoryBreakdown]
    top_income_sources: List[CategoryBreakdown]
    balance_trend: List[BalancePoint]   # daily/weekly balance
    subscription_total: Decimal
    loan_payments_total: Decimal
    installment_payments_total: Decimal
    credit_utilization_summary: dict
    member_activity: List[MemberActivity]  # who did what
```

#### C. Budgets per Category

**New model: `OrgBudget`**
```
id                  UUID PK
user_id             UUID FK -> users.id CASCADE
organization_id     UUID FK -> organizations.id CASCADE (nullable)
category_id         UUID FK -> categories.id CASCADE
period_type         VARCHAR(20)     — 'monthly' | 'quarterly' | 'annual'
amount              NUMERIC(15,2)   — budget limit
currency            VARCHAR(3) DEFAULT 'ILS'
start_date          DATE
end_date            DATE nullable   — NULL = ongoing
is_active           BOOLEAN DEFAULT true
alert_at_percentage INTEGER DEFAULT 80  — alert when usage hits this %
created_at          DATETIME(tz)
updated_at          DATETIME(tz)
```

**Endpoints: `/api/v1/budgets`**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create budget for a category |
| GET | `/` | List all budgets with actual vs budget |
| GET | `/{id}` | Single budget with usage details |
| PUT | `/{id}` | Update budget |
| DELETE | `/{id}` | Delete budget |
| GET | `/summary` | All budgets overview with alerts |

**Budget vs Actual Calculation:**
```python
class BudgetResponse(BaseModel):
    # ... model fields ...
    actual_amount: Decimal      # actual spend in current period
    remaining: Decimal          # budget - actual
    usage_percentage: float     # (actual / budget) * 100
    is_over_budget: bool
    forecast_end_of_period: Decimal  # projected based on current pace
```

**Alert Integration:**
```python
ALERT_TYPE_BUDGET_WARNING = "budget_warning"    # at alert_at_percentage
ALERT_TYPE_BUDGET_EXCEEDED = "budget_exceeded"  # over 100%
```

#### D. Expense Approval Workflow

**New model: `ExpenseApproval`**
```
id                  UUID PK
organization_id     UUID FK CASCADE
transaction_id      UUID FK -> transactions.id CASCADE (nullable)
requested_by        UUID FK -> users.id
approved_by         UUID FK -> users.id (nullable)
status              VARCHAR(20) DEFAULT 'pending'  — pending | approved | rejected
amount              NUMERIC(15,2)
category_id         UUID FK nullable
description         TEXT
rejection_reason    TEXT nullable
requested_at        DATETIME(tz)
resolved_at         DATETIME(tz) nullable
```

**Endpoints: `/api/v1/organizations/{org_id}/approvals`**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Submit expense for approval |
| GET | `/` | List approvals (filterable by status) |
| GET | `/pending` | Pending approvals count + list |
| POST | `/{id}/approve` | Approve (admin/owner only) |
| POST | `/{id}/reject` | Reject with reason (admin/owner only) |

**Business Rules:**
- Members submit, admins/owners approve
- When approved, auto-create transaction if amount provided
- Owner can set threshold: expenses above X require approval
- Notification to admins when new approval pending

#### E. Role Permissions Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View financial data | ✓ | ✓ | ✓ | ✓ |
| Create transactions | ✓ | ✓ | ✓ | ✗ |
| Edit transactions | ✓ | ✓ | Own only | ✗ |
| Delete transactions | ✓ | ✓ | ✗ | ✗ |
| Manage categories | ✓ | ✓ | ✗ | ✗ |
| View audit log | ✓ | ✓ | ✗ | ✗ |
| Generate reports | ✓ | ✓ | ✗ | ✗ |
| Manage budgets | ✓ | ✓ | ✗ | ✗ |
| Approve expenses | ✓ | ✓ | ✗ | ✗ |
| Submit for approval | ✓ | ✓ | ✓ | ✗ |
| Manage members | ✓ | ✓ | ✗ | ✗ |
| Manage org settings | ✓ | ✓ | ✗ | ✗ |
| Delete organization | ✓ | ✗ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ |

Implement as a `check_org_permission(role, action)` helper in `deps.py`.

---

## Execution Order

### Phase 1: Database (Single Migration)
1. Create `credit_cards` table
2. Create `bank_accounts` table
3. Create `org_budgets` table
4. Create `org_reports` table
5. Create `expense_approvals` table
6. Add `credit_card_id` to: installments, subscriptions, fixed_income_expenses, transactions
7. Add `bank_account_id` to: bank_balances, loans
8. Add indexes

### Phase 2: Models & Schemas
1. `app/db/models/credit_card.py` — NEW
2. `app/db/models/bank_account.py` — NEW
3. `app/db/models/org_budget.py` — NEW
4. `app/db/models/org_report.py` — NEW
5. `app/db/models/expense_approval.py` — NEW
6. Update existing models (add FK columns)
7. Register all in `__init__.py`
8. Create all schemas

### Phase 3: Services
1. `app/services/credit_card_service.py` — utilization computation
2. `app/services/obligo_service.py` — obligo calculation
3. `app/services/budget_service.py` — budget vs actual
4. Update `alert_service.py` — new alert types
5. Update `forecast_service.py` — overdraft awareness

### Phase 4: Endpoints
1. `app/api/v1/endpoints/credit_cards.py` — NEW (8 endpoints)
2. `app/api/v1/endpoints/bank_accounts.py` — NEW (5 endpoints)
3. `app/api/v1/endpoints/obligo.py` — NEW (2 endpoints)
4. `app/api/v1/endpoints/budgets.py` — NEW (6 endpoints)
5. Update `organizations.py` — reports + approvals endpoints
6. Update existing endpoints — add `credit_card_id` support
7. Register all routers

### Phase 5: Tests
1. `tests/test_credit_cards.py` — NEW (~20 tests)
2. `tests/test_bank_accounts.py` — NEW (~10 tests)
3. `tests/test_obligo.py` — NEW (~8 tests)
4. `tests/test_budgets.py` — NEW (~12 tests)
5. `tests/test_expense_approvals.py` — NEW (~15 tests)
6. `tests/test_org_reports.py` — NEW (~8 tests)
7. `tests/test_org_permissions.py` — NEW (~20 tests)
8. Update `tests/conftest.py` — new cleanup order + fixtures

### Phase 6: Validation
1. Run full test suite — ALL must pass
2. Verify migration up + down
3. Verify all new endpoints in Swagger
4. Verify org permission matrix manually

---

## API Contract for Frontend Sync

### New Endpoints Summary

```
# Credit Cards
POST   /api/v1/credit-cards
GET    /api/v1/credit-cards
GET    /api/v1/credit-cards/summary
GET    /api/v1/credit-cards/{id}
PUT    /api/v1/credit-cards/{id}
DELETE /api/v1/credit-cards/{id}
GET    /api/v1/credit-cards/{id}/charges
GET    /api/v1/credit-cards/{id}/next-billing

# Bank Accounts
POST   /api/v1/bank-accounts
GET    /api/v1/bank-accounts
GET    /api/v1/bank-accounts/{id}
PUT    /api/v1/bank-accounts/{id}
DELETE /api/v1/bank-accounts/{id}

# Obligo
GET    /api/v1/obligo
GET    /api/v1/obligo/details

# Budgets
POST   /api/v1/budgets
GET    /api/v1/budgets
GET    /api/v1/budgets/{id}
PUT    /api/v1/budgets/{id}
DELETE /api/v1/budgets/{id}
GET    /api/v1/budgets/summary

# Org Reports
POST   /api/v1/organizations/{org_id}/reports/generate
GET    /api/v1/organizations/{org_id}/reports
GET    /api/v1/organizations/{org_id}/reports/{id}
DELETE /api/v1/organizations/{org_id}/reports/{id}

# Expense Approvals
POST   /api/v1/organizations/{org_id}/approvals
GET    /api/v1/organizations/{org_id}/approvals
GET    /api/v1/organizations/{org_id}/approvals/pending
POST   /api/v1/organizations/{org_id}/approvals/{id}/approve
POST   /api/v1/organizations/{org_id}/approvals/{id}/reject
```

### Modified Endpoints

All financial create/update endpoints now accept optional `credit_card_id`:
- POST/PUT `/api/v1/installments`
- POST/PUT `/api/v1/subscriptions`
- POST/PUT `/api/v1/fixed`
- POST/PUT `/api/v1/transactions`

Balance endpoints now accept optional `bank_account_id`:
- POST `/api/v1/balance`

Loan endpoints now accept optional `bank_account_id`:
- POST/PUT `/api/v1/loans`

### Enhanced Forecast Response
```python
class ForecastResponse(BaseModel):
    # ... existing fields ...
    overdraft_limit: Optional[Decimal] = None
    effective_floor: Optional[Decimal] = None    # -overdraft_limit
```

---

## Exchange Rate Service — Current State & Required Improvements

### Current Implementation (`app/services/exchange_rate_service.py`)
- **Provider:** Frankfurter.app (free, no API key)
- **Cache:** In-memory only, TTL = 3600s (1 hour)
- **Supported currencies:** ILS, USD, EUR
- **Fallback:** expired cache → 1:1 rate (no conversion)
- **Problem:** Cache is lost on restart, not shared across workers

### Required Improvements

#### 1. Reduce TTL for Fresher Rates
```python
# CURRENT:
CACHE_TTL_SECONDS = 3600  # 1 hour

# CHANGE TO:
CACHE_TTL_SECONDS = 900   # 15 minutes — rates stay fresh
```

#### 2. Add DB-backed Rate Storage (Persistent Cache)
Create a `currency_rates` table to survive restarts and share across workers:
```
currency_rates:
  id              BIGSERIAL PK
  from_currency   VARCHAR(3) NOT NULL
  to_currency     VARCHAR(3) NOT NULL
  rate            NUMERIC(15,6) NOT NULL
  fetched_at      TIMESTAMPTZ NOT NULL
  UNIQUE(from_currency, to_currency)
```

On fetch: write to DB. On cache miss: read from DB before calling API.
Fallback chain: **memory cache → DB cache → API → expired DB → 1:1**

#### 3. Startup Preload
On app startup (`app/main.py` lifespan), preload rates for all supported currency pairs so the first request doesn't wait for API call:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await preload_exchange_rates()  # fetch ILS↔USD, ILS↔EUR, USD↔EUR
    yield
```

#### 4. Add More Currencies (Optional)
Extend `SUPPORTED_CURRENCIES` to include GBP, CHF, JPY if needed:
```python
SUPPORTED_CURRENCIES = ["ILS", "USD", "EUR", "GBP", "CHF"]
```

#### 5. Rate Staleness Alert
Add alert type when rates haven't been refreshed in 24+ hours:
```python
ALERT_TYPE_STALE_RATES = "exchange_rates_stale"
```

---

## Testing Requirements — Comprehensive Coverage

### Reference Documents
The following test plan documents contain the FULL specification of every test case needed. Read them before writing tests:
- `TEST_PLAN_BACKEND.md` — 565 test cases across 21 modules, 113 endpoints
- `TEST_PLAN_DATABASE.md` — 247 test cases for schema, migrations, integrity, security

### Critical Gaps Identified by QA Audit

**Must fix before production:**

| Module | Existing | Required | Gap |
|--------|----------|----------|-----|
| Categories | 5 | 26 | Circular ref detection, type change prevention, soft delete |
| Organizations | 25 | 44 | Role permissions, data isolation, member management |
| Installments | — | — | Enrichment testing, RED-8 rounding, concurrency |
| Loans | — | — | Amortization correctness, status transitions, reverse-payment |
| Balance | — | — | Concurrency, effective_date logic |
| Alerts | — | — | Auto-dismiss, snooze logic, unread count |
| Settings | — | — | Auto-create on first access |

### Architecture Issues Found

1. **Two audit tables** — `audit_log` (DB trigger, BIGSERIAL+JSONB) AND `audit_logs` (model, UUID+Text) — consolidate to one
2. **`organizations.owner_id`** — FK without ON DELETE — deleting user-owner will fail with IntegrityError
3. **`.env.production` contains SECRET_KEY** — ensure not committed to Git
4. **Token blacklist in-memory** — not persistent across restart/multi-worker
5. **`c418f49cdb52` migration** — NOT NULL without server_default may fail on DB with existing data

### Test Categories Required for EVERY New Endpoint

For each endpoint created in this prompt, write tests covering:
1. Happy path (basic CRUD)
2. Input validation (invalid data, boundary values, max lengths)
3. Auth (no token, expired token, wrong user)
4. Permissions (personal vs org, viewer/member/admin/owner)
5. Edge cases (zero amounts, huge numbers, decimal precision)
6. Business logic (status transitions, calculations)
7. Data isolation (user A can't see user B's data)
8. Multi-currency (conversion, rate storage)
9. Audit (every write creates log entry)
10. Error responses (correct status codes)

### Test Baseline
- Current: **561 tests, 0 failures**
- Target after this prompt: **700+ tests, 0 failures**
- Run with: `cd backend && source venv/bin/activate && PYTHONPATH=. pytest tests/ -v`
