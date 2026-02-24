# Agent 2 — Frontend Bug Fix + Backend-Frontend Sync Polish

## Your Mission

You are a full-stack polish agent. Your job:
1. Fix ALL frontend bugs found by QA audit (listed below with exact file+line)
2. Verify every backend endpoint matches what frontend expects
3. Ensure all new modules (credit cards, bank accounts, obligo, budgets, approvals, reports) work end-to-end
4. Run `npm run build` — zero errors
5. Run backend tests — zero failures

---

## Project Locations

```
Backend:  /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
Frontend: /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend
```

## Technical Constraints

- **Python 3.9.6** — `from __future__ import annotations`, NO `X | Y` syntax
- **React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS v4**
- **i18next** — Hebrew (default, RTL) + English
- API prefix: `/api/v1/`
- DataContext for all org-aware queries

## Commands

```bash
# Frontend
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend
npm run dev      # dev server
npm run build    # production build — must succeed with 0 errors

# Backend
cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v --tb=short
```

---

## PART A: Frontend Bugs — FIX ALL

### BUG-F1: Credit Cards button shows wrong text — HIGH
**File:** `src/pages/CreditCardsPage.tsx`
**Lines:** 379, 504, 739
**Problem:** Uses `t('creditCards.add')` but the translation key is `creditCards.addCard`
**Fix:** Replace all 3 occurrences:
```tsx
// BEFORE:
{t('creditCards.add')}
// AFTER:
{t('creditCards.addCard')}
```

### BUG-F2: 9 missing translation keys in CreditCardsPage — HIGH
**File:** `src/pages/CreditCardsPage.tsx` + `src/i18n/locales/he.json` + `en.json`
**Missing keys that need to be added to BOTH locale files:**

```json
// Add to he.json under "creditCards":
"subscriptionsShort": "מנויים",
"installmentsShort": "תשלומים",
"fixedShort": "קבועות",
"chargeSubscriptions": "חיובי מנויים",
"chargeInstallments": "חיובי תשלומים",
"chargeFixed": "חיובים קבועים",
"noCharges": "אין חיובים",
"totalExpected": "סה\"כ צפוי",
"availableAfterBilling": "אשראי זמין לאחר חיוב"

// Add to en.json under "creditCards":
"subscriptionsShort": "Subscriptions",
"installmentsShort": "Installments",
"fixedShort": "Fixed",
"chargeSubscriptions": "Subscription Charges",
"chargeInstallments": "Installment Charges",
"chargeFixed": "Fixed Charges",
"noCharges": "No charges",
"totalExpected": "Total Expected",
"availableAfterBilling": "Available After Billing"
```

### BUG-F3: Alerts snooze dropdown not clickable — HIGH
**File:** `src/pages/AlertsPage.tsx`
**Line:** 313
**Problem:** `overflow-hidden` clips the dropdown, preventing clicks on options
**Fix:**
```tsx
// BEFORE:
className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-hidden rounded-xl border shadow-lg"
// AFTER:
className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-visible rounded-xl border shadow-lg"
```
**Also check:** All parent containers up to root for any `overflow-hidden` that might clip the dropdown. Ensure z-index is high enough (z-50 should be fine).

### BUG-F4: Snooze re-notification missing — MEDIUM
**File:** `src/pages/AlertsPage.tsx`
**Problem:** After snoozeing, the alert disappears but there's no mechanism to re-show it when the snooze period expires. Currently relies on the 30-second polling in DesktopHeader for unread count, but the AlertsPage itself has no polling.
**Fix:** Add `refetchInterval` to the alerts query on the AlertsPage:
```tsx
const { data, refetch } = useQuery({
  queryKey: queryKeys.alerts.all,
  queryFn: () => alertsApi.list(),
  refetchInterval: 30000, // 30 seconds — catches snoozed alerts that expire
})
```
**Note:** The backend already filters out snoozed alerts where `snoozed_until > now`, so they automatically reappear when the time passes. The frontend just needs to refetch periodically.

### BUG-F5: Alert sound preference not persisted — LOW
**File:** `src/pages/AlertsPage.tsx`, Line 653
**Problem:** `const [soundEnabled, setSoundEnabled] = useState(true)` — resets on page refresh
**Fix:** Use localStorage:
```tsx
const [soundEnabled, setSoundEnabled] = useState(() => {
  return localStorage.getItem('alertSoundEnabled') !== 'false'
})
// In toggle handler:
const toggleSound = () => {
  setSoundEnabled(prev => {
    localStorage.setItem('alertSoundEnabled', String(!prev))
    return !prev
  })
}
```

### BUG-F6: Credit Cards form shows generic validation errors — LOW
**File:** `src/pages/CreditCardsPage.tsx`, Lines 296-309
**Problem:** All validation errors use `t('common.error')` — user sees "שגיאה" for every field
**Fix:** Use specific error messages:
```tsx
if (!formData.name.trim()) errors.name = t('validation.required')
if (!/^\d{4}$/.test(formData.last_four_digits)) errors.last_four_digits = t('creditCards.lastFourInvalid')
```
Add to locale files if needed:
```json
// he.json
"validation": { "required": "שדה חובה" }
// en.json
"validation": { "required": "Required field" }
```

---

## PART B: Backend-Frontend API Contract Verification

### Strategy: Use 4 sub-agents in parallel

**Sub-agent A — Core Financial Modules (7 modules):**
Verify these backend endpoints match frontend expectations:
1. **Transactions** — `POST/GET/PUT/DELETE /transactions`, `POST /{id}/duplicate`, `POST /bulk-delete`, `PUT /bulk-update`
2. **Categories** — `GET/POST /categories`, `GET/PUT/DELETE /{id}`, `POST /reorder`
3. **Fixed** — `GET/POST /fixed`, `GET/PUT/DELETE /{id}`, `POST /{id}/pause`, `POST /{id}/resume`
4. **Installments** — `GET/POST /installments`, `GET/PUT/DELETE /{id}`, `GET /{id}/payments`, `POST /{id}/mark-paid`
5. **Loans** — `GET/POST /loans`, `GET/PUT/DELETE /{id}`, `POST /{id}/payment`, `GET /{id}/breakdown`
6. **Balance** — `GET/POST/PUT /balance`, `GET /balance/history`
7. **Subscriptions** — `GET/POST /subscriptions`, `GET/PUT/DELETE /{id}`, `POST /{id}/pause`, `POST /{id}/resume`, `GET /upcoming`

For each: verify `credit_card_id` and `bank_account_id` are accepted where frontend sends them.

**Sub-agent B — New Financial Modules (3 modules):**
1. **Credit Cards** — 8 endpoints: CRUD + summary + charges + next-billing
   - Response MUST include computed fields: `total_monthly_charges`, `utilization_amount`, `utilization_percentage`, `available_credit`, `linked_*_count`
2. **Bank Accounts** — 5 endpoints: CRUD
   - Response MUST include: `overdraft_limit`, `is_primary`
3. **Obligo** — `GET /obligo`
   - Response: `total_credit_limit`, `total_credit_utilization`, `total_loan_outstanding`, `total_overdraft_limits`, `total_obligo`, `total_available_credit`, `obligo_utilization_pct`, `details[]`

**Sub-agent C — Organization Modules (4 modules):**
1. **Organizations** — CRUD + members CRUD + switch context
2. **Budgets** — CRUD + summary (6 endpoints)
   - Response MUST include: `actual_amount`, `remaining`, `usage_percentage`, `is_over_budget`
3. **Expense Approvals** — list, create, approve, reject
4. **Org Reports** — list, get, generate

**Sub-agent D — Dashboard + Support Modules (6 modules):**
1. **Dashboard** — 11 sub-endpoints (summary, weekly, monthly, quarterly, category-breakdown, upcoming-payments, financial-health, installments-summary, loans-summary, top-expenses, subscriptions-summary)
2. **Forecast** — 3 endpoints (monthly, weekly, summary)
3. **Alerts** — list, unread, read, unread, read-all, dismiss, snooze
4. **Currency** — rates, convert, supported
5. **Settings** — get, update
6. **Expected Income** — list, put by month, delete by month

---

## PART C: Cross-Module Sync Verification

After Parts A and B, verify:
1. **Credit card linking** — Create transaction with `credit_card_id` → appears in card's charges
2. **Bank account linking** — Create balance with `bank_account_id` → appears in account details
3. **Obligo calculation** — Includes credit card utilization + loan outstanding
4. **Dashboard widgets** — Credit utilization, budget alerts, obligo widget all show correct data
5. **Org context switch** — All new modules (credit cards, bank accounts, budgets) respect DataContext
6. **Exchange rate** — Enter transaction in USD → `amount` stored as ILS, `original_amount`/`original_currency`/`exchange_rate` stored correctly

---

## PART D: Exchange Rate Deep Verification

User reported wrong conversion. Investigate:
1. Read `backend/app/services/exchange_rate_service.py` — verify conversion formula
2. Read `frontend/src/pages/SettingsPage.tsx` lines 649-896 — verify ExchangeRateWidget
3. Create a test transaction in USD (e.g., 100 USD) via API
4. Check: does `amount` = 100 * rate(USD→ILS)? Or is it inverted?
5. Check: is the rate being displayed correctly in Settings page?
6. If the rate is stale (1-hour cache), verify fallback behavior

---

## PART E: Bank Balance Save/Update Verification

User reported can't save bank balance. Investigate:
1. Read `backend/app/api/v1/endpoints/balance.py` — POST and PUT endpoints
2. Read `backend/app/api/v1/schemas/balance.py` — what fields are required?
3. Read `frontend/src/pages/BalancePage.tsx` (or wherever balance is managed)
4. Check: is the frontend sending the right payload?
5. Check: does the schema match what frontend sends?
6. Check: is DataContext applied correctly?

---

## Important Rules

1. **Frontend is the source of truth for UI** — if frontend sends a field, backend MUST accept it
2. **Don't break existing tests** — changes should be additive
3. **Read before you fix** — understand current code before changing
4. **`npm run build` must succeed** — no TypeScript errors after changes
5. **All locale files must be in sync** — every key in he.json must exist in en.json and vice versa

## Expected Output

1. **Frontend fixes** — list of all files changed, bugs fixed
2. **API contract audit** — table: module | status (OK/Fixed/Missing) | details
3. **Cross-module sync** — confirmation each integration point works
4. **Exchange rate** — confirmation conversion is correct with example
5. **Bank balance** — confirmation save/update works
6. **Build result** — `npm run build` output (0 errors)
7. **Test result** — `pytest` output (0 failures)
