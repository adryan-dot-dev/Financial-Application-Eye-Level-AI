# Cash Flow Management - Manual Testing Guide
## Eye Level AI

---

## How to Start the System

### 1. Start PostgreSQL (Docker)
```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI
docker-compose up -d
```

### 2. Start Backend Server
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload
```
Backend runs at: **http://localhost:8000**
API Docs (Swagger): **http://localhost:8000/docs**

### 3. Start Frontend (when available)
```bash
cd frontend
npm run dev
```
Frontend runs at: **http://localhost:5173**

---

## Testing via Swagger UI (http://localhost:8000/docs)

The Swagger UI lets you test ALL API endpoints directly from the browser.

---

## Test Scenarios

### Test 1: Health Check
**Endpoint:** `GET /health`
**Expected:** `{"status": "healthy", "version": "0.1.0"}`

---

### Test 2: Login as Admin
**Endpoint:** `POST /api/v1/auth/login`
```json
{
  "username": "admin",
  "password": "admin123"
}
```
**Expected:** 200 with `access_token` and `refresh_token`
**Save the `access_token`** - you'll need it for all other requests.

In Swagger UI: Click "Authorize" button (top right) and paste: `Bearer <your_token>`

---

### Test 3: View Your Profile
**Endpoint:** `GET /api/v1/auth/me`
**Expected:** 200 with your admin user details

---

### Test 4: Categories
#### List all categories
**Endpoint:** `GET /api/v1/categories`
**Expected:** 13 default categories (salary, freelance, rent, etc.)

#### Create a custom category
**Endpoint:** `POST /api/v1/categories`
```json
{
  "name": "subscriptions",
  "name_he": "מנויים",
  "type": "expense",
  "icon": "credit-card",
  "color": "#9333EA"
}
```
**Expected:** 201 Created

---

### Test 5: Transactions
#### Create income transaction
**Endpoint:** `POST /api/v1/transactions`
```json
{
  "amount": 15000,
  "type": "income",
  "date": "2026-02-01",
  "description": "Monthly salary",
  "notes": "February payment"
}
```

#### Create expense transaction
```json
{
  "amount": 5000,
  "type": "expense",
  "date": "2026-02-05",
  "description": "Office rent"
}
```

#### List transactions with filters
**Endpoint:** `GET /api/v1/transactions?type=expense&sort_by=amount&sort_order=desc`
**Expected:** Only expense transactions, sorted by amount descending

#### Duplicate a transaction
**Endpoint:** `POST /api/v1/transactions/{id}/duplicate`
**Expected:** 201 with a new copy of the transaction

---

### Test 6: Fixed Income/Expenses
#### Create fixed income (salary)
**Endpoint:** `POST /api/v1/fixed`
```json
{
  "name": "Monthly Salary",
  "amount": 25000,
  "type": "income",
  "day_of_month": 10,
  "start_date": "2026-01-01"
}
```

#### Create fixed expense (rent)
```json
{
  "name": "Office Rent",
  "amount": 8000,
  "type": "expense",
  "day_of_month": 1,
  "start_date": "2026-01-01"
}
```

#### Pause/Resume a fixed entry
- `POST /api/v1/fixed/{id}/pause` - Pauses the entry
- `POST /api/v1/fixed/{id}/resume` - Resumes the entry

---

### Test 7: Installments (Payment Plans)
**Endpoint:** `POST /api/v1/installments`
```json
{
  "name": "New Laptop",
  "total_amount": 12000,
  "number_of_payments": 12,
  "type": "expense",
  "start_date": "2026-02-01",
  "day_of_month": 15
}
```
**Expected:** 201 with `monthly_amount` auto-calculated as 1000.00

#### View payment schedule
**Endpoint:** `GET /api/v1/installments/{id}`
**Expected:** Installment details + full schedule with payment dates and statuses

---

### Test 8: Loans
#### Create a loan
**Endpoint:** `POST /api/v1/loans`
```json
{
  "name": "Car Loan",
  "original_amount": 120000,
  "monthly_payment": 3000,
  "interest_rate": 4.5,
  "start_date": "2026-01-01",
  "day_of_month": 10,
  "total_payments": 48
}
```

#### View loan with amortization schedule
**Endpoint:** `GET /api/v1/loans/{id}`
**Expected:** Loan details + amortization schedule with principal/interest breakdown

#### Record a payment
**Endpoint:** `POST /api/v1/loans/{id}/payment`
```json
{
  "amount": 3000
}
```
**Expected:** payments_made increases, remaining_balance decreases

---

### Test 9: Bank Balance
#### Set initial balance
**Endpoint:** `POST /api/v1/balance`
```json
{
  "balance": 50000,
  "effective_date": "2026-02-01",
  "notes": "Opening balance"
}
```

#### View current balance
**Endpoint:** `GET /api/v1/balance`

#### View history
**Endpoint:** `GET /api/v1/balance/history`

---

### Test 10: Cash Flow Forecast (Key Feature!)
#### Prerequisites
Before testing forecast, make sure you have:
1. A bank balance set (Test 9)
2. At least one fixed income (Test 6)
3. At least one fixed expense (Test 6)
4. Optionally: installments and loans

#### Monthly forecast
**Endpoint:** `GET /api/v1/forecast?months=6`
**Expected:** 6-month projection showing:
- `opening_balance` / `closing_balance` per month
- `fixed_income` / `fixed_expenses`
- `installment_payments` / `loan_payments`
- `has_negative_months` flag
- `first_negative_month` if applicable

#### Weekly forecast
**Endpoint:** `GET /api/v1/forecast/weekly?weeks=12`
**Expected:** 12-week projection with income/expenses per week

#### Forecast summary
**Endpoint:** `GET /api/v1/forecast/summary?months=6`
**Expected:** Aggregated summary with total income, expenses, net projected, alerts count

---

### Test 11: Alerts
#### Check for alerts
**Endpoint:** `GET /api/v1/alerts`
**Expected:** If your forecast shows negative months, alerts will be auto-generated

#### Check unread count
**Endpoint:** `GET /api/v1/alerts/unread`

#### Test negative balance alert
1. Set a low balance (e.g., 1000)
2. Add large fixed expense (e.g., 10000/month)
3. Call `GET /api/v1/forecast/summary?months=3`
4. Check `GET /api/v1/alerts` - should see "negative_cashflow" alerts

---

### Test 12: Expected Income
**Endpoint:** `PUT /api/v1/expected-income/2026-03-01`
```json
{
  "expected_amount": 30000,
  "notes": "Expected bonus + salary"
}
```
**Expected:** Expected income saved for March 2026

---

### Test 13: Settings
#### View settings
**Endpoint:** `GET /api/v1/settings`

#### Update settings
**Endpoint:** `PUT /api/v1/settings`
```json
{
  "currency": "USD",
  "language": "en",
  "theme": "dark",
  "forecast_months_default": 12
}
```

---

### Test 14: Edge Cases to Try Manually

| Test | Action | Expected |
|------|--------|----------|
| Negative amount | Create transaction with amount: -100 | 422 Validation Error |
| Zero amount | Create transaction with amount: 0 | 422 Validation Error |
| Invalid type | Create transaction with type: "gift" | 422 Validation Error |
| Very long text | Description > 500 chars | 422 Validation Error |
| Wrong password | Login with wrong password | 401 Unauthorized |
| No token | Call /api/v1/auth/me without token | 403 Forbidden |
| Invalid token | Use random string as Bearer token | 401 Unauthorized |
| End before start | Fixed entry with end_date < start_date | 422 Validation Error |
| Day 32 | Fixed entry with day_of_month: 32 | 422 Validation Error |

---

## Running Automated Tests

```bash
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```

**Current test count: 155 tests (all passing)**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| test_auth.py | 8 | Login, register, refresh, password change |
| test_categories.py | 5 | CRUD + filter by type |
| test_transactions.py | 6 | CRUD + duplicate + pagination |
| test_fixed.py | 7 | CRUD + pause/resume |
| test_installments.py | 7 | CRUD + schedule + payments |
| test_loans.py | 9 | CRUD + amortization + payments |
| test_balance.py | 5 | CRUD + history |
| test_expected_income.py | 5 | CRUD + month normalization |
| test_forecast.py | 7 | Monthly, weekly, summary, negative detection |
| test_alerts.py | 5 | CRUD + auto-generation |
| test_settings.py | 3 | Get + update + validation |
| test_edge_cases.py | 88 | Auth, IDOR, boundaries, validation |

---

## API Routes Summary (67 routes)

| Group | Routes | Prefix |
|-------|--------|--------|
| Auth | 7 | /api/v1/auth/ |
| Users (admin) | 4 | /api/v1/users/ |
| Settings | 2 | /api/v1/settings |
| Categories | 7 | /api/v1/categories/ |
| Transactions | 9 | /api/v1/transactions/ |
| Fixed Income/Expenses | 7 | /api/v1/fixed/ |
| Installments | 6 | /api/v1/installments/ |
| Loans | 7 | /api/v1/loans/ |
| Balance | 4 | /api/v1/balance/ |
| Expected Income | 3 | /api/v1/expected-income/ |
| Forecast | 3 | /api/v1/forecast/ |
| Alerts | 4 | /api/v1/alerts/ |
| Dashboard | 4 | /api/v1/dashboard/ |
