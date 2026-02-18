# Frontend Implementation Prompt — Credit, Banking & Organizations

## Mission

Implement the frontend for three interconnected feature modules:
1. **Credit Card Management** — Cards page, utilization UI, card selector on forms
2. **Bank Accounts & Obligo** — Accounts page, obligo dashboard widget, overdraft in forecast
3. **Organization Enhancement** — Full org UI: reports, budgets, approvals, permissions

All features must follow existing frontend patterns (React 19, TanStack Query, Tailwind v4, i18n).

---

## IMPORTANT — Technical Constraints

- **React 19** + TypeScript 5.9 + Vite 7
- **Tailwind CSS v4** with `@theme` directive (NOT v3 `@tailwind`)
- **CSS custom properties** for dark/light mode theming
- `import type` for type-only imports (`verbatimModuleSyntax: true`)
- **i18next** — Hebrew (default, RTL) + English — ALL strings must be translated
- **TanStack Query** (React Query) for ALL API calls — NO manual fetch/useEffect
- **Recharts** for charts and visualizations
- **lucide-react** for icons
- Path alias: `@/` maps to `src/`
- Brand gradient: cyan → blue → purple → magenta
- NO neon glow effects — clean, professional UI
- Existing pages: Dashboard, Transactions, Fixed, Installments, Loans, Categories, Balance, Forecast, Settings, Alerts, Subscriptions, Organizations

---

## Module 1: Credit Cards Page

### New Page: `CreditCardsPage.tsx`

**Route:** `/credit-cards`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: "כרטיסי אשראי" + "הוסף כרטיס" button           │
├─────────────────────────────────────────────────────────┤
│ Summary Bar:                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ סה"כ     │ │ ניצול    │ │ פנוי     │ │ % ניצול  │    │
│ │ מסגרות   │ │ נוכחי    │ │ אשראי    │ │ ממוצע    │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────────────────┤
│ Cards Grid (responsive: 1-3 columns):                    │
│ ┌─────────────────────┐ ┌─────────────────────┐         │
│ │ 💳 ויזה כאל ****1234│ │ 💳 מאסטרקארד ****5678│        │
│ │ מסגרת: ₪25,000      │ │ מסגרת: ₪15,000      │        │
│ │ ┌───────────────┐   │ │ ┌───────────────┐   │        │
│ │ │ ████████░░░░░│   │ │ │ ██████░░░░░░░│   │        │
│ │ │   72%        │   │ │ │   42%        │   │        │
│ │ └───────────────┘   │ │ └───────────────┘   │        │
│ │ ניצול: ₪18,000      │ │ ניצול: ₪6,300       │        │
│ │ פנוי: ₪7,000        │ │ פנוי: ₪8,700        │        │
│ │ יום חיוב: 2          │ │ יום חיוב: 10         │        │
│ │ 5 מנויים · 2 פריסות │ │ 3 מנויים · 0 פריסות │        │
│ │ [צפייה] [עריכה]     │ │ [צפייה] [עריכה]     │        │
│ └─────────────────────┘ └─────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

**Card Color Coding:**
- Utilization < 50%: Green indicator
- 50-80%: Yellow/amber indicator
- 80-90%: Orange indicator
- 90%+: Red indicator (pulsing if > 100%)

### Card Detail Modal

When clicking "צפייה" on a card:

```
┌──────────────────────────────────────────┐
│ ויזה כאל ****1234                    [X] │
│ כאל · Visa · יום חיוב: 2                │
├──────────────────────────────────────────┤
│ Utilization donut chart (center: "72%")  │
│ ₪18,000 / ₪25,000                       │
├──────────────────────────────────────────┤
│ חיובים על הכרטיס:                        │
│                                          │
│ 📋 מנויים (5):                           │
│   • Monday.com         ₪880/חודש         │
│   • SendGrid           ₪330/חודש         │
│   • Zoom               ₪240/חודש         │
│   • ...                                  │
│                                          │
│ 📅 פריסות (2):                           │
│   • חבילת AWS    ₪3,000/חודש (7/12)     │
│   • ריהוט משרד   ₪4,000/חודש (4/6)     │
│                                          │
│ 🔄 הוצאות קבועות (1):                   │
│   • ביטוח מקצועי  ₪850/חודש             │
├──────────────────────────────────────────┤
│ 📊 סיכום חיוב הבא (2 במרץ):            │
│ סה"כ צפוי: ₪18,300                      │
│ יתרת מסגרת אחרי חיוב: ₪6,700          │
└──────────────────────────────────────────┘
```

### Create/Edit Card Modal

```
┌──────────────────────────────────────────┐
│ הוספת כרטיס אשראי                   [X] │
├──────────────────────────────────────────┤
│ שם הכרטיס:     [ויזה כאל - ביזנס    ]   │
│ 4 ספרות אחרונות: [1234]                  │
│ רשת:           [▼ Visa/MC/Amex/...]      │
│ חברת אשראי:    [כאל                 ]    │
│ מסגרת אשראי:   [25,000   ] ₪            │
│ יום חיוב:      [2] (1-28)               │
│ צבע:           [🔵🟣🔴🟡🟢] color picker │
│ הערות:         [                    ]    │
├──────────────────────────────────────────┤
│              [ביטול]  [שמור]             │
└──────────────────────────────────────────┘
```

### Card Selector Component

A reusable `<CreditCardSelector />` dropdown component to add to:
- **InstallmentsPage** — create/edit modal
- **SubscriptionsPage** — create/edit modal
- **FixedPage** — create/edit modal
- **TransactionsPage** — create/edit modal

```tsx
<CreditCardSelector
  value={selectedCardId}
  onChange={setSelectedCardId}
  optional={true}  // shows "ללא כרטיס" option
/>
```

Renders as a select with card name + last 4 digits + utilization color dot.

---

## Module 2: Bank Accounts & Obligo

### New Page: `BankAccountsPage.tsx`

**Route:** `/bank-accounts`

Simple card layout showing:
- Account name + bank name
- Current balance (from linked bank_balance)
- Overdraft limit (מסגרת מינוס)
- Available (balance + overdraft_limit)
- Linked loans count

### Obligo Dashboard Widget

Add to `DashboardPage.tsx` — a new widget:

```
┌─────────────────────────────────────────┐
│ 🏦 אובליגו בנקאי                       │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Stacked horizontal bar chart:       │ │
│ │ [████ הלוואות ██ אשראי ░░░ פנוי]  │ │
│ │ ₪185K / ₪280K (66%)               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ הלוואות פעילות:    ₪142,000            │
│ ניצול אשראי:      ₪43,000             │
│ סה"כ מסגרות:      ₪280,000            │
│ פנוי:             ₪95,000              │
└─────────────────────────────────────────┘
```

### Enhanced Forecast Chart

In `ForecastPage.tsx`:
- Add a **dashed red line** at the overdraft limit level (not at 0)
- If forecast line crosses overdraft limit → highlight in red
- Tooltip shows: "מרחק ממסגרת מינוס: ₪X"

### Enhanced Balance Page

In `BalancePage.tsx`:
- Show bank account selector (if multiple accounts)
- Display overdraft limit as reference line on chart
- "Available" = balance + overdraft_limit

---

## Module 3: Organization Enhancement

### Enhanced Organization Page

Currently basic. Expand to a full org management center:

```
┌───────────────────────────────────────────────────────┐
│ Eye Level AI · ארגון                                   │
├──────┬──────┬──────┬──────┬──────┬──────┬────────────┤
│ סקירה│חברים │תקציב │דוחות │אישור │לוג   │ הגדרות    │
│      │      │      │      │הוצאות│פעולות│            │
└──────┴──────┴──────┴──────┴──────┴──────┴────────────┘
```

**7 tabs:**

#### Tab 1: Overview (סקירה)
Dashboard-style overview of org financials:
- KPI cards: income, expenses, net, balance
- Recent activity feed
- Budget alerts
- Credit utilization summary

#### Tab 2: Members (חברים)
- List of members with role badges
- Invite member button (by email)
- Change role dropdown (owner/admin only)
- Remove member (owner/admin only)
- Activity indicator (last action date)

#### Tab 3: Budgets (תקציבים)
- Budget list per category with progress bars
- Create budget modal
- Actual vs budget comparison chart
- Alert when approaching/exceeding

```
┌────────────────────────────────────────────┐
│ שיווק ופרסום                               │
│ ┌──────────────────────────────────────┐   │
│ │ ████████████████░░░░░░             │   │
│ │ ₪14,500 / ₪20,000    72.5%        │   │
│ └──────────────────────────────────────┘   │
│ נותר: ₪5,500 · קצב: ₪18,200 צפוי        │
├────────────────────────────────────────────┤
│ תוכנה ומנויים                              │
│ ┌──────────────────────────────────────┐   │
│ │ ████████████████████████████████    │   │
│ │ ₪9,200 / ₪8,000     115% ⚠️       │   │
│ └──────────────────────────────────────┘   │
│ חריגה: ₪1,200                             │
└────────────────────────────────────────────┘
```

#### Tab 4: Reports (דוחות)
- Generate report button (monthly/quarterly)
- List of generated reports
- Report view with charts:
  - Income vs expenses trend
  - Category breakdown (pie chart)
  - Member activity summary
  - Cash flow chart
- Export to PDF option (future)

#### Tab 5: Expense Approvals (אישור הוצאות)
- Pending approvals list (for admin/owner)
- Submit expense button (for members)
- Approve/reject with one click
- Rejection reason input

```
┌────────────────────────────────────────────────────┐
│ 🔔 3 הוצאות ממתינות לאישור                        │
├────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐  │
│ │ נועה בקשה · לפני 2 שעות                     │  │
│ │ ציוד משרדי · ₪3,200                          │  │
│ │ "רכישת מדפסת לייזר צבעונית"                  │  │
│ │ [✓ אישור]  [✗ דחייה]                         │  │
│ └──────────────────────────────────────────────┘  │
│ ┌──────────────────────────────────────────────┐  │
│ │ דן בקשה · לפני 1 יום                        │  │
│ │ נסיעות · ₪5,800                              │  │
│ │ "כנס AI Tel Aviv - כרטיסים + מלון"           │  │
│ │ [✓ אישור]  [✗ דחייה]                         │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

#### Tab 6: Audit Log (לוג פעולות)
- Filterable table: by user, action, entity, date range
- Each row: timestamp, user email, action, entity, details
- Pagination

#### Tab 7: Settings (הגדרות)
- Org name, currency, date format
- Approval threshold (above X requires approval)
- Notification preferences
- Danger zone: delete org (owner only)

### Organization Switcher Enhancement

The existing `OrgSwitcher.tsx` should:
- Show current context clearly (personal / org name)
- Badge showing pending approvals count (for admins)
- Quick switch without page reload

---

## New API Client Files

```
src/api/
├── credit-cards.ts     ← NEW
├── bank-accounts.ts    ← NEW
├── obligo.ts           ← NEW
├── budgets.ts          ← NEW
├── approvals.ts        ← NEW
├── org-reports.ts      ← NEW
```

Each file follows the existing pattern in `src/api/`:
```typescript
import api from './client';

export const creditCardsApi = {
  list: () => api.get('/credit-cards'),
  get: (id: string) => api.get(`/credit-cards/${id}`),
  create: (data: CreditCardCreate) => api.post('/credit-cards', data),
  update: (id: string, data: CreditCardUpdate) => api.put(`/credit-cards/${id}`, data),
  delete: (id: string) => api.delete(`/credit-cards/${id}`),
  getSummary: () => api.get('/credit-cards/summary'),
  getCharges: (id: string) => api.get(`/credit-cards/${id}/charges`),
  getNextBilling: (id: string) => api.get(`/credit-cards/${id}/next-billing`),
};
```

## New Types

Add to `src/types/index.ts`:

```typescript
// Credit Cards
export interface CreditCard {
  id: string;
  name: string;
  last_four_digits: string;
  card_network: 'visa' | 'mastercard' | 'amex' | 'isracard' | 'diners';
  issuer: string;
  credit_limit: string;  // Decimal as string
  billing_day: number;
  currency: string;
  is_active: boolean;
  color: string;
  notes?: string;
  total_monthly_charges: string;
  utilization_amount: string;
  utilization_percentage: number;
  available_credit: string;
  linked_installments_count: number;
  linked_subscriptions_count: number;
  linked_fixed_count: number;
}

export interface CreditCardSummary {
  cards: CreditCard[];
  total_credit_limit: string;
  total_utilization: string;
  total_available: string;
  average_utilization_pct: number;
}

// Bank Accounts
export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_last_digits?: string;
  overdraft_limit: string;
  currency: string;
  is_primary: boolean;
  notes?: string;
}

// Obligo
export interface ObligoSummary {
  total_credit_card_limits: string;
  total_credit_utilization: string;
  total_loan_outstanding: string;
  total_overdraft_limits: string;
  total_obligo: string;
  total_available_credit: string;
  obligo_utilization_pct: number;
}

// Budgets
export interface Budget {
  id: string;
  category_id: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  amount: string;
  currency: string;
  start_date: string;
  is_active: boolean;
  alert_at_percentage: number;
  actual_amount: string;
  remaining: string;
  usage_percentage: number;
  is_over_budget: boolean;
}

// Expense Approvals
export interface ExpenseApproval {
  id: string;
  requested_by: string;
  requested_by_email?: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: string;
  description: string;
  rejection_reason?: string;
  requested_at: string;
  resolved_at?: string;
}
```

## New Query Keys

Add to `src/lib/queryKeys.ts`:
```typescript
export const queryKeys = {
  // ... existing ...
  creditCards: {
    all: ['credit-cards'] as const,
    summary: ['credit-cards', 'summary'] as const,
    detail: (id: string) => ['credit-cards', id] as const,
    charges: (id: string) => ['credit-cards', id, 'charges'] as const,
    nextBilling: (id: string) => ['credit-cards', id, 'next-billing'] as const,
  },
  bankAccounts: {
    all: ['bank-accounts'] as const,
    detail: (id: string) => ['bank-accounts', id] as const,
  },
  obligo: {
    summary: ['obligo'] as const,
    details: ['obligo', 'details'] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    summary: ['budgets', 'summary'] as const,
    detail: (id: string) => ['budgets', id] as const,
  },
  approvals: {
    all: (orgId: string) => ['approvals', orgId] as const,
    pending: (orgId: string) => ['approvals', orgId, 'pending'] as const,
  },
  orgReports: {
    all: (orgId: string) => ['org-reports', orgId] as const,
    detail: (orgId: string, id: string) => ['org-reports', orgId, id] as const,
  },
};
```

## i18n Translations

Add to both Hebrew and English locale files:

```json
{
  "creditCards": {
    "title": "כרטיסי אשראי",
    "addCard": "הוסף כרטיס",
    "creditLimit": "מסגרת אשראי",
    "utilization": "ניצול",
    "available": "פנוי",
    "billingDay": "יום חיוב",
    "lastFour": "4 ספרות אחרונות",
    "network": "רשת",
    "issuer": "חברת אשראי",
    "charges": "חיובים",
    "nextBilling": "חיוב הבא",
    "noCards": "לא הוגדרו כרטיסי אשראי",
    "utilizationWarning": "ניצול מסגרת גבוה",
    "utilizationCritical": "חריגה ממסגרת אשראי"
  },
  "bankAccounts": {
    "title": "חשבונות בנק",
    "overdraftLimit": "מסגרת מינוס",
    "addAccount": "הוסף חשבון",
    "bankName": "שם הבנק",
    "primary": "חשבון ראשי"
  },
  "obligo": {
    "title": "אובליגו בנקאי",
    "totalLimits": "סה\"כ מסגרות",
    "totalUtilized": "סה\"כ ניצול",
    "totalAvailable": "סה\"כ פנוי",
    "loans": "הלוואות",
    "credit": "אשראי"
  },
  "budgets": {
    "title": "תקציבים",
    "addBudget": "הגדר תקציב",
    "actual": "בפועל",
    "budget": "תקציב",
    "remaining": "נותר",
    "overBudget": "חריגה מתקציב",
    "forecast": "צפי לסוף תקופה"
  },
  "approvals": {
    "title": "אישור הוצאות",
    "pending": "ממתינים לאישור",
    "approve": "אשר",
    "reject": "דחה",
    "submit": "הגש לאישור",
    "rejectionReason": "סיבת דחייה"
  },
  "orgReports": {
    "title": "דוחות",
    "generate": "צור דוח",
    "monthly": "חודשי",
    "quarterly": "רבעוני"
  }
}
```

## Routing Updates

In `src/router.tsx`, add:

```tsx
// New routes
{ path: '/credit-cards', element: <CreditCardsPage /> },
{ path: '/bank-accounts', element: <BankAccountsPage /> },

// Existing org page gets tabs handled internally
// /organizations already exists — enhance it
```

## Sidebar Updates

In `src/components/layout/Sidebar.tsx`, add new nav items:

```
📊 Dashboard
💰 עסקאות
🔄 הוצאות קבועות
📅 פריסות
🏦 הלוואות
💳 כרטיסי אשראי     ← NEW
🏛️ חשבונות בנק      ← NEW
📋 מנויים
📊 תקציבים           ← NEW (if in org context)
📈 תחזית
⚠️ התראות
⚙️ הגדרות
🏢 ארגון             ← ENHANCED
```

## Dashboard Updates

Add to `DashboardPage.tsx`:
1. **Obligo widget** (described above)
2. **Credit utilization widget** — small bar per card
3. **Budget alerts widget** — categories approaching budget
4. **Pending approvals badge** (org context only)

---

## Sync Points with Backend

| Frontend Component | Backend Endpoint | Notes |
|-------------------|-----------------|-------|
| CreditCardsPage | `/credit-cards` + `/credit-cards/summary` | List + summary |
| Card Detail Modal | `/credit-cards/{id}/charges` + `/credit-cards/{id}/next-billing` | |
| Card Selector | `/credit-cards` (cached) | Reusable across forms |
| BankAccountsPage | `/bank-accounts` | CRUD |
| Obligo Widget | `/obligo` | Dashboard widget |
| ForecastPage | `/forecast` (enhanced response) | Uses `overdraft_limit` |
| Budgets Tab | `/budgets` + `/budgets/summary` | Org context |
| Approvals Tab | `/organizations/{id}/approvals` | Org context |
| Reports Tab | `/organizations/{id}/reports` | Org context |
| Audit Tab | `/organizations/{id}/audit-log` | Org context |
| All Create Forms | Modified endpoints with `credit_card_id` | Optional field |

---

## Execution Order

### Phase 1: Types & API Layer
1. Add all new types to `types/index.ts`
2. Create API client files (6 new files)
3. Add query keys
4. Add i18n translations (he + en)

### Phase 2: Shared Components
1. `CreditCardSelector` component
2. `UtilizationBar` component (reusable progress bar with color coding)
3. `BudgetProgressBar` component

### Phase 3: Credit Cards
1. `CreditCardsPage.tsx`
2. Card create/edit modal
3. Card detail modal
4. Add `CreditCardSelector` to Installments/Subscriptions/Fixed/Transactions forms

### Phase 4: Bank Accounts & Obligo
1. `BankAccountsPage.tsx`
2. Obligo dashboard widget
3. Enhanced forecast chart (overdraft line)
4. Enhanced balance page

### Phase 5: Organization
1. Expand `OrganizationPage.tsx` to tabbed layout
2. Members tab (enhance existing)
3. Budgets tab
4. Reports tab
5. Approvals tab
6. Audit log tab
7. Settings tab

### Phase 6: Dashboard Integration
1. Obligo widget on Dashboard
2. Credit summary widget
3. Budget alerts widget
4. Pending approvals badge in header

### Phase 7: Routing & Nav
1. Update router
2. Update sidebar
3. Update mobile bottom nav
4. Permission-based visibility (hide org tabs for viewers)

---

## Bug Fixes — Must Fix Before New Features

### BUG-1: Snooze Dropdown Unclickable (AlertsPage)

**File:** `src/pages/AlertsPage.tsx` — SnoozeDropdown component (~line 313)

**Problem:** When clicking the snooze (נודניק) button on an alert, the dropdown opens but the user CANNOT click on any option (e.g., "הזכר בעוד שעה"). The dropdown options overlap with the alert card below and clicks don't register.

**Root Cause:** The dropdown container has `overflow-hidden` in its className:
```tsx
// CURRENT (broken):
className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-hidden rounded-xl border shadow-lg"
```

The `overflow-hidden` clips the dropdown content, preventing click events from reaching the snooze option buttons.

**Fix:**
```tsx
// FIXED — remove overflow-hidden, add overflow-visible:
className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-visible rounded-xl border shadow-lg"
```

If rounded corners are needed on inner content, apply `overflow-hidden` only to the **inner sections** (the buttons container), NOT the outer dropdown wrapper.

**Additional fix if needed:** Ensure the dropdown has a higher stacking context than sibling AlertCards by wrapping in a container with `position: relative; z-index: 60;` on the parent AlertCard when the dropdown is open.

---

## Currency Display — Exchange Rate Awareness

### Current Backend Behavior
- Exchange rates cached for **15 minutes** (backend improvement), stored in DB for persistence
- Supported: ILS, USD, EUR (GBP, CHF may be added later)
- All amounts stored in base currency (ILS) with original currency preserved

### Frontend Requirements

#### 1. Currency Display on Forms
Every financial form (Transaction, Fixed, Installment, Loan, Subscription) shows:
- Currency selector (ILS/USD/EUR)
- When non-ILS selected: show live converted amount below input
- Format: "≈ ₪3,650 (שער: 3.65)" in muted text

#### 2. Rate Freshness Indicator
In Settings or Dashboard footer, show:
- "שערי מטבע עודכנו לפני X דקות"
- Green dot if < 15min, yellow if < 1hr, red if > 1hr
- Click to force refresh: `POST /api/v1/currency/rates?refresh=true`

#### 3. Transaction List — Original Amount Column
When a transaction was entered in USD/EUR, show both:
- Primary: ₪3,650 (converted, used for calculations)
- Secondary (muted): $1,000 (original amount entered)

#### 4. Stale Rate Warning
If backend returns `exchange_rates_stale` alert → show banner:
"שערי המטבע לא עודכנו מזה 24 שעות — הסכומים המומרים עשויים להיות לא מדויקים"

---

## Testing Requirements — Comprehensive Coverage

### Reference Documents
Read these FULL test specifications before implementing:
- `TEST_PLAN_FRONTEND.md` — 562 test cases across 18 pages
- `TEST_PLAN_FRONTEND_E2E.md` — 307 test cases for components, contexts, E2E flows

### Test Categories for EVERY New Component/Page

For each page/component created in this prompt:

**Unit Tests (React Testing Library):**
1. Renders without crash
2. Correct data displayed from API mock
3. Loading state shows skeleton/spinner
4. Error state shows error message
5. Empty state shows "no data" message
6. i18n — Hebrew text renders (default)
7. Dark mode classes applied
8. RTL layout direction correct

**Integration Tests:**
1. Form submission sends correct API request
2. CRUD flow — create, verify in list, edit, delete
3. Pagination/filtering modifies API params
4. Cache invalidation after mutation (list refreshes)
5. Modal open/close/escape/outside-click

**E2E Flows (Playwright):**
1. Full credit card flow — create card → link to subscription → view utilization
2. Bank account flow — create account → set overdraft → see in forecast
3. Org flow — create budget → add expense → approve → see in report
4. Dashboard flow — all widgets load, obligo displays correctly

### Priority Order for Testing
- **P0 (Critical):** Auth guard, CRUD operations, data isolation
- **P1 (High):** Form validation, API error handling, cache invalidation
- **P2 (Medium):** i18n, dark mode, responsive layout
- **P3 (Low):** Animations, accessibility, bundle size

### Grand Total Test Coverage Target
| Layer | Tests |
|-------|-------|
| Backend (existing + new) | 700+ |
| Frontend Pages | 562 |
| Frontend E2E | 307 |
| Database & Infra | 247 |
| **Total** | **1,816+** |
