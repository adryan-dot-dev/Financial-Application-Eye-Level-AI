# Cash Flow Management - Comprehensive Audit Report

**Date:** February 10, 2026
**Audited Application:** Cash Flow Management - Eye Level AI
**Stack:** FastAPI + React 19 + TypeScript 5.9 + Tailwind CSS v4 + PostgreSQL 16
**Total Issues Found:** ~112

---

## Executive Summary

A comprehensive audit was conducted across the full stack of the Cash Flow Management application. The audit covered backend API logic, database models, frontend components, design consistency, accessibility, and user experience.

| Area                  | Score   | Notes                                                    |
|-----------------------|---------|----------------------------------------------------------|
| Backend Code Quality  | 6.5/10  | Functional but has race conditions, missing validations   |
| Frontend Code Quality | 7.5/10  | Well-structured but large components, some inconsistencies|
| Frontend Design       | 6.0/10  | Usable but inconsistent styling, dark mode gaps           |
| UX / Accessibility    | 6.5/10  | Basic UX in place, significant a11y gaps                  |

**Issue Breakdown:**

| Severity | Count | Description                                      |
|----------|-------|--------------------------------------------------|
| CRITICAL | 11    | Data integrity risks, security gaps, broken UI   |
| HIGH     | 28    | Validation gaps, design inconsistencies, a11y    |
| MEDIUM   | ~51   | Code quality, minor UX issues, polish            |
| LOW      | ~18   | Nice-to-haves, minor improvements                |

---

## CRITICAL Issues (11)

### Backend (5)

#### C-1. Race Condition in Balance Endpoint
- **File:** `backend/app/api/v1/balance.py` (lines 72-79)
- **Description:** Concurrent balance updates can leave a user with no current balance record. The endpoint sets all existing balances to `is_current=False` before inserting the new one, but these operations are not atomic. If two requests arrive simultaneously, both may set existing records to `False`, and one insert may fail or be lost.
- **Impact:** Users may see a zero or missing balance after concurrent updates.
- **Fix:** Wrap the deactivation and insertion in an explicit database transaction with row-level locking (`SELECT ... FOR UPDATE`), or use a single UPDATE+INSERT atomic operation.

#### C-2. No Rate Limiting on Auth Endpoints
- **File:** `backend/app/api/v1/auth.py` (lines 34-87)
- **Description:** The `/api/v1/auth/login` and `/api/v1/auth/register` endpoints have no rate limiting. An attacker can make unlimited login attempts for brute-force attacks or flood the registration endpoint.
- **Impact:** Credential brute-forcing, resource exhaustion, potential account lockout abuse.
- **Fix:** Add `slowapi` or a similar rate-limiting middleware. Recommended limits: 5 login attempts per minute per IP, 3 registrations per hour per IP.

#### C-3. Missing Decimal Field Validation
- **File:** `backend/app/schemas/transaction.py` (and other financial schemas)
- **Description:** Pydantic v2 does not automatically enforce `max_digits` and `decimal_places` constraints on `Decimal` fields unless explicitly configured with `condecimal()` or `Field()` constraints. Financial amounts could exceed `DECIMAL(15,2)` precision, causing database errors or silent truncation.
- **Impact:** Invalid financial data could be persisted or cause unhandled database errors.
- **Fix:** Add explicit `Field(max_digits=15, decimal_places=2, ge=0)` constraints on all Decimal fields in Pydantic schemas, or use `condecimal(max_digits=15, decimal_places=2)`.

#### C-4. Incorrect `await db.delete()` Usage
- **File:** `backend/app/services/alert_service.py` (line 123)
- **Description:** The code uses `await db.delete(alert)` which is not the correct SQLAlchemy async session API. The correct method is `await db.execute(delete(Alert).where(...))` or `await db.delete(alert)` only if using the synchronous-style API within an async context incorrectly.
- **Impact:** Alert deletion may silently fail or raise an unexpected runtime error.
- **Fix:** Use the correct async SQLAlchemy pattern: `await db.delete(alert)` followed by `await db.commit()`, or use `await db.execute(delete(Alert).where(Alert.id == alert_id))`.

#### C-5. Authorization Validation Missing in Dashboard/Forecast Services
- **Files:** `backend/app/services/dashboard_service.py`, `backend/app/services/forecast_service.py`
- **Description:** These services aggregate data across multiple tables but do not consistently verify that the `user_id` filter is applied to all underlying queries. A missing `user_id` filter on any sub-query could leak data from other users.
- **Impact:** Potential cross-user data leakage in dashboard KPIs or forecast calculations.
- **Fix:** Audit every query in these services to ensure `filter(Model.user_id == user_id)` is applied. Add integration tests that verify user isolation.

---

### Frontend (6)

#### C-6. Missing CSS Semantic Variables
- **Files:** `frontend/src/index.css`, various component files
- **Description:** Multiple components reference CSS custom properties that are never defined: `--bg-danger`, `--text-danger`, `--bg-danger-subtle`, `--bg-warning-subtle`, `--text-warning`. These variables are used in alert badges, status indicators, and error states, but are absent from both light and dark theme definitions.
- **Impact:** Affected elements render with no background or text color, making them invisible or unreadable.
- **Fix:** Define all semantic color variables in the `:root` and `[data-theme="dark"]` blocks in `index.css`.

#### C-7. Hardcoded Chart Colors Don't Adapt to Theme
- **Files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/BalancePage.tsx`, `frontend/src/pages/ForecastPage.tsx`
- **Description:** Recharts components use hardcoded hex colors (`#34D399`, `#F87171`, `#6366F1`) that do not change between light and dark mode. In dark mode, some colors have poor contrast against the dark background.
- **Impact:** Charts are difficult to read in dark mode; accessibility contrast ratios fail WCAG AA.
- **Fix:** Use CSS custom properties for chart colors and read them via JavaScript (`getComputedStyle`), or maintain a theme-aware color map consumed by chart components.

#### C-8. Select Dropdown SVG Arrow Hardcoded to Light Mode
- **Files:** Multiple form components using `<select>` elements
- **Description:** The custom dropdown arrow SVG uses a hardcoded fill color suited for light backgrounds. In dark mode, the arrow becomes invisible against the dark input background.
- **Impact:** Users cannot see the dropdown indicator in dark mode, making selects appear as plain text inputs.
- **Fix:** Use `currentColor` in the SVG fill or define a CSS variable for the arrow color that adapts to the theme.

#### C-9. No Global 401/403 Error Handler
- **Files:** `frontend/src/lib/api.ts`, `frontend/src/contexts/AuthContext.tsx`
- **Description:** When a JWT token expires mid-session, API calls return 401 but there is no global interceptor to handle this. Users see a generic error message instead of being redirected to login or having their token refreshed.
- **Impact:** Confusing user experience on token expiry; users may lose unsaved work.
- **Fix:** Add an Axios/fetch response interceptor that catches 401 responses, attempts token refresh, and redirects to login if refresh fails. Show a user-friendly "Session expired" message.

#### C-10. Transaction Page Has No Retry Mechanism on API Failure
- **File:** `frontend/src/pages/TransactionsPage.tsx`
- **Description:** When the transactions API call fails (network error, server error), the page shows an error state with no retry button or automatic retry logic. React Query's default retry is either disabled or not configured for this query.
- **Impact:** Users must manually refresh the entire page to recover from a transient API failure.
- **Fix:** Enable React Query's `retry` option (e.g., `retry: 3` with exponential backoff) and add a visible "Retry" button in the error state UI.

#### C-11. Token Validation Error Doesn't Show User-Facing Recovery
- **File:** `frontend/src/contexts/AuthContext.tsx`
- **Description:** On application mount, the AuthContext validates the stored JWT. If validation fails (malformed token, server unreachable), the error is caught silently. The user remains on a blank or loading screen with no indication of what happened and no way to recover.
- **Impact:** Users can get stuck on a blank screen after token corruption or server downtime.
- **Fix:** On validation failure, clear the stored token, redirect to the login page, and show a toast notification explaining the session has ended.

---

## HIGH Issues (28)

### Backend Validation and Logic (10)

#### H-1. Missing Payment Validation in Loan Payment Recording
- **File:** `backend/app/services/loan_service.py`
- **Description:** When recording a loan payment, there is no validation that the payment amount does not exceed the remaining balance. Overpayments are silently accepted.
- **Fix:** Add validation: `if payment_amount > remaining_balance: raise HTTPException(400)`.

#### H-2. Race Condition in Installment Payment Completion
- **File:** `backend/app/services/installment_service.py`
- **Description:** When the final installment payment is recorded, the status update to "completed" is not atomic with the payment insertion. Concurrent requests could record duplicate final payments.
- **Fix:** Use `SELECT ... FOR UPDATE` on the installment record before checking remaining payments.

#### H-3. Missing Category Type Constraint Validation
- **File:** `backend/app/services/category_service.py`
- **Description:** Categories can be created with any `type` string value. There is no validation against the expected enum values (`income`, `expense`).
- **Fix:** Add an enum constraint in the schema and validate at the service layer.

#### H-4. Missing Date Range Validation on Fixed Create
- **File:** `backend/app/services/fixed_service.py`
- **Description:** Fixed recurring transactions accept `start_date` after `end_date` without validation, which would produce incorrect forecast calculations.
- **Fix:** Validate `start_date < end_date` in the creation schema or service.

#### H-5. Incorrect Weekly Forecast Day-of-Month Logic
- **File:** `backend/app/services/forecast_service.py`
- **Description:** The weekly forecast calculation uses day-of-month arithmetic that breaks for months with fewer than 31 days. Forecasts for February, for example, may skip or double-count entries.
- **Fix:** Use `dateutil.relativedelta` or proper week-based iteration instead of day-of-month arithmetic.

#### H-6. N+1 Query in Transactions
- **File:** `backend/app/services/transaction_service.py`
- **Description:** When listing transactions, the category relationship is not eagerly loaded. Each transaction triggers a separate query to fetch its category name, resulting in N+1 queries.
- **Fix:** Add `selectinload(Transaction.category)` or `joinedload(Transaction.category)` to the query options.

#### H-7. Missing Currency Field in BankBalance Model
- **File:** `backend/app/models/balance.py`
- **Description:** The `BankBalance` model does not include a `currency` field, unlike all other financial models. This breaks the architecture decision that all financial tables include `VARCHAR(3) DEFAULT 'ILS'`.
- **Fix:** Add `currency = Column(String(3), default="ILS", nullable=False)` to the model and create an Alembic migration.

#### H-8. Missing CHECK Constraints on Financial Amounts
- **Files:** `backend/app/models/fixed.py`, `backend/app/models/installment.py`, `backend/app/models/loan.py`
- **Description:** The `monthly_amount`, `monthly_payment`, and `expected_amount` columns lack database-level CHECK constraints to prevent negative values.
- **Fix:** Add `CheckConstraint('monthly_amount >= 0')` to the relevant model columns and generate an Alembic migration.

#### H-9. Missing Pagination Upper Bound
- **File:** `backend/app/api/v1/transactions.py` (and other list endpoints)
- **Description:** The `limit` query parameter has no upper bound. A client could request `limit=1000000`, causing excessive memory usage and slow queries.
- **Fix:** Cap `limit` at a reasonable maximum (e.g., 100) in the query parameter validation.

#### H-10. HTML/XSS Content Not Sanitized in Text Fields
- **Files:** `backend/app/schemas/transaction.py`, `backend/app/schemas/category.py`
- **Description:** User-provided text fields (description, category name, notes) are not sanitized for HTML or script content. While the React frontend escapes output by default, the API could be consumed by other clients.
- **Fix:** Add a Pydantic validator that strips HTML tags from string fields, or use a library like `bleach`.

---

### Frontend Design Consistency (10)

#### H-11. Inconsistent Border Radius Across Components
- **Files:** Various page and component files
- **Description:** Cards use `rounded-lg`, `rounded-xl`, and `rounded-2xl` inconsistently. Modals use `rounded-lg` while some cards use `rounded-2xl`. This creates visual inconsistency.
- **Fix:** Standardize on a single border-radius scale: cards = `rounded-xl`, modals = `rounded-xl`, buttons = `rounded-lg`, inputs = `rounded-lg`.

#### H-12. Hardcoded Severity/Status Colors Missing Dark Mode
- **Files:** `frontend/src/pages/AlertsPage.tsx`, `frontend/src/pages/LoansPage.tsx`, `frontend/src/pages/InstallmentsPage.tsx`
- **Description:** Status badges and severity indicators use hardcoded Tailwind color classes (e.g., `bg-red-100 text-red-800`) that don't adapt to dark mode. In dark mode, light backgrounds clash with the dark theme.
- **Fix:** Replace with semantic CSS variables or use Tailwind's `dark:` variant for all badge colors.

#### H-13. Inconsistent Modal Styling and Padding
- **Files:** Multiple modal components across pages
- **Description:** Modals have inconsistent internal padding (ranging from `p-4` to `p-8`), different header styles, and inconsistent close button placement.
- **Fix:** Extract a shared `Modal` component with standardized padding, header, and close button placement.

#### H-14. No Button Variant System
- **Files:** All page components
- **Description:** Buttons are styled inline with varying combinations of Tailwind classes. There is no consistent button variant system (primary, secondary, ghost, danger).
- **Fix:** Create a `Button` component with variant props that map to consistent styles.

#### H-15. Inconsistent Input Field Styling
- **Files:** Form components across all CRUD pages
- **Description:** Input fields have varying border colors, focus ring styles, padding, and placeholder colors across different forms.
- **Fix:** Create a shared `Input` component or standardize Tailwind classes via a CSS `@apply` rule.

#### H-16. Inconsistent Card Padding
- **Files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/FixedPage.tsx`, `frontend/src/pages/LoansPage.tsx`
- **Description:** Card components use padding ranging from `p-4` to `p-8` with no clear pattern. KPI cards use `p-4`, detail cards use `p-6`, and some use `p-8`.
- **Fix:** Standardize card padding: compact cards = `p-4`, standard cards = `p-6`.

#### H-17. Hardcoded Colors in Badges and Status Indicators
- **Files:** Multiple pages with status badges
- **Description:** Badge background and text colors are hardcoded hex values or specific Tailwind color stops that do not adapt to the current theme.
- **Fix:** Define badge color tokens as CSS variables and reference them in component styles.

#### H-18. Select Dropdown Broken in Dark Mode
- **Files:** All pages with `<select>` elements
- **Description:** Beyond the arrow issue (C-8), the select dropdown options list renders with the OS default styling, which may show light text on a light background or dark text on a dark background depending on the browser.
- **Fix:** Use a custom select component (e.g., headless UI) that fully controls the dropdown rendering, or apply explicit dark mode styles.

#### H-19. Inconsistent Chart Tooltip/Legend Styling
- **Files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/BalancePage.tsx`, `frontend/src/pages/ForecastPage.tsx`
- **Description:** Chart tooltips and legends use different background colors, font sizes, and border styles across pages.
- **Fix:** Create a shared `ChartTooltip` component and pass it to all Recharts `<Tooltip>` content props.

#### H-20. Mixed `focus:` and `focus-visible:` Styles
- **Files:** Various interactive elements
- **Description:** Some elements use `focus:ring-2` while others use `focus-visible:ring-2`. This inconsistency means some elements show focus rings on click (undesirable for mouse users) while others only show them on keyboard navigation.
- **Fix:** Standardize on `focus-visible:` for all interactive elements to improve both mouse and keyboard UX.

---

### Frontend UX and Accessibility (8)

#### H-21. No Loading States on Pause/Resume and Record Payment
- **Files:** `frontend/src/pages/FixedPage.tsx`, `frontend/src/pages/LoansPage.tsx`, `frontend/src/pages/InstallmentsPage.tsx`
- **Description:** Action buttons for pause/resume (fixed transactions) and record payment (loans, installments) do not show a loading spinner or disabled state during the API call. Users may click multiple times.
- **Fix:** Add `isLoading` state from the mutation and disable the button + show a spinner during the operation.

#### H-22. Expandable Payment Schedule Not Keyboard Accessible
- **File:** `frontend/src/pages/InstallmentsPage.tsx`
- **Description:** The expandable payment schedule section is toggled by clicking a `<div>`, which is not keyboard accessible. It lacks `role="button"`, `tabIndex`, and `onKeyDown` handlers.
- **Fix:** Use a `<button>` element or add `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) handler.

#### H-23. Chart Tooltips Only on Hover
- **Files:** All chart components
- **Description:** Recharts tooltips are only triggered on mouse hover. Keyboard users navigating through data points cannot access tooltip information.
- **Impact:** Keyboard and screen reader users cannot access chart data details.
- **Fix:** Add an accessible data table alternative below each chart, or implement keyboard-navigable chart points.

#### H-24. Alert Animations Don't Respect `prefers-reduced-motion`
- **File:** `frontend/src/pages/AlertsPage.tsx`
- **Description:** Alert entry/exit animations (fade, slide) play regardless of the user's motion preferences. Users with vestibular disorders may experience discomfort.
- **Fix:** Wrap animations in a `@media (prefers-reduced-motion: no-preference)` check or use a `motion-safe:` Tailwind variant.

#### H-25. Missing Plural Forms in i18n
- **Files:** `frontend/src/locales/he.json`, `frontend/src/locales/en.json`
- **Description:** Translation strings for countable items (e.g., "X transactions", "X alerts") do not use i18next plural forms. Hebrew has complex plural rules that are not handled.
- **Fix:** Use i18next's `_one`, `_two`, `_many`, `_other` suffixes for Hebrew pluralization.

#### H-26. Network Offline Indicator Missing
- **File:** Global application level
- **Description:** When the user loses network connectivity, no indicator is shown. API calls fail silently or show generic error messages.
- **Fix:** Add a `useOnlineStatus` hook and display a persistent banner when `navigator.onLine` is `false`.

#### H-27. Retry Button Loading State Missing on Dashboard Error
- **File:** `frontend/src/pages/DashboardPage.tsx`
- **Description:** The dashboard error state has a retry button, but it does not show a loading state while the retry is in progress.
- **Fix:** Connect the retry button to the React Query `isFetching` state and show a spinner.

#### H-28. Pagination Buttons Missing ARIA Labels
- **Files:** `frontend/src/pages/TransactionsPage.tsx` and other paginated pages
- **Description:** Pagination buttons (previous, next, page numbers) lack `aria-label` attributes and `aria-current="page"` on the active page. Screen readers announce them as unlabeled buttons.
- **Fix:** Add `aria-label="Go to page X"`, `aria-label="Previous page"`, `aria-label="Next page"`, and `aria-current="page"` on the active button.

---

## MEDIUM Issues (~51)

### Backend (12)

| #   | Issue                                                    | File(s)                                         |
|-----|----------------------------------------------------------|-------------------------------------------------|
| M-1 | Inconsistent error messages across endpoints             | Various service files                           |
| M-2 | Missing pagination upper bound validation                | All list endpoints                              |
| M-3 | No structured logging (uses print statements)            | Various service files                           |
| M-4 | Missing request ID tracking for debugging                | `app/main.py`                                   |
| M-5 | Alembic migrations not tested in CI                      | `backend/alembic/`                              |
| M-6 | No database connection pool size configuration           | `backend/app/database.py`                       |
| M-7 | Missing index on `transaction.date` column               | `backend/app/models/transaction.py`             |
| M-8 | Inconsistent HTTP status codes for validation errors     | Various API route files                         |
| M-9 | No health check endpoint                                 | `backend/app/main.py`                           |
| M-10| Settings schema allows arbitrary keys                    | `backend/app/schemas/settings.py`               |
| M-11| Missing cascade delete configuration on some relations   | Various model files                             |
| M-12| Test fixtures share mutable state                        | `backend/tests/conftest.py`                     |

### Frontend Code Quality (15)

| #    | Issue                                                   | File(s)                                          |
|------|---------------------------------------------------------|--------------------------------------------------|
| M-13 | Query key inconsistency in React Query                  | Various page files                               |
| M-14 | Large components exceed 1000 lines                      | `TransactionsPage.tsx`, `DashboardPage.tsx`      |
| M-15 | Skeleton/loading component duplicated across pages      | Multiple page files                              |
| M-16 | Missing `React.memo` on table row sub-components        | `TransactionsPage.tsx`                           |
| M-17 | Missing API response type generics                      | `frontend/src/lib/api.ts`                        |
| M-18 | No centralized error boundary                           | Application root                                 |
| M-19 | Form validation logic duplicated across CRUD pages      | Multiple page files                              |
| M-20 | useEffect dependencies missing in some components       | Various                                          |
| M-21 | Console.log statements left in production code          | Various                                          |
| M-22 | No TypeScript strict null checks on API responses       | Various                                          |
| M-23 | React Query `staleTime` not configured consistently     | Various                                          |
| M-24 | Import order not standardized                           | All files                                        |
| M-25 | No shared constants file for magic numbers              | Various                                          |
| M-26 | Inline styles mixed with Tailwind classes               | `DashboardPage.tsx`, `ForecastPage.tsx`          |
| M-27 | Missing error boundaries around chart components        | Chart-containing pages                           |

### Frontend Design (14)

| #    | Issue                                                   | File(s)                                          |
|------|---------------------------------------------------------|--------------------------------------------------|
| M-28 | Dark mode color contrast below WCAG AA ratio            | Sidebar, subtle text elements                    |
| M-29 | Sidebar active state too subtle in dark mode            | Sidebar component                                |
| M-30 | Typography hierarchy inconsistent (font sizes/weights)  | Various pages                                    |
| M-31 | Empty state styling differs across pages                | All CRUD pages                                   |
| M-32 | Missing breadcrumb navigation                           | All sub-pages                                    |
| M-33 | Form error messages too generic ("Invalid input")       | All form modals                                  |
| M-34 | Tablet breakpoint (768px-1024px) not optimized          | Grid layouts on multiple pages                   |
| M-35 | Toast notification position not RTL-aware               | Toast component                                  |
| M-36 | Gradient text unreadable on some backgrounds            | Dashboard header                                 |
| M-37 | Icon sizes inconsistent (16px, 18px, 20px, 24px)       | Various                                          |
| M-38 | Table header alignment inconsistent                     | `TransactionsPage.tsx`                           |
| M-39 | Mobile card layout has too much whitespace              | Fixed, Loans pages                               |
| M-40 | Footer not implemented                                  | Layout component                                 |
| M-41 | Scrollbar not styled for dark mode                      | Global                                           |

### Frontend UX/Accessibility (10)

| #    | Issue                                                   | File(s)                                          |
|------|---------------------------------------------------------|--------------------------------------------------|
| M-42 | Missing keyboard shortcuts for common actions           | Global                                           |
| M-43 | Missing logout confirmation dialog                      | Sidebar/AuthContext                               |
| M-44 | Language change not announced to screen readers          | Settings page                                    |
| M-45 | No skip-to-content link                                 | Layout component                                 |
| M-46 | Modal focus trap not implemented                        | All modal components                             |
| M-47 | Color-only differentiation for income vs expense        | Transaction list, charts                         |
| M-48 | Missing page title updates on navigation                | All pages (document.title)                       |
| M-49 | Auto-save in settings has no visual confirmation        | Settings page                                    |
| M-50 | Search/filter not persisted across page navigation      | Transactions, Alerts pages                       |
| M-51 | Date picker not localized for Hebrew                    | Transaction and Fixed forms                      |

---

## LOW Issues (~18)

### Backend (6)

| #   | Issue                                                    | File(s)                                          |
|-----|----------------------------------------------------------|--------------------------------------------------|
| L-1 | Missing timezone info in datetime fields                 | All models using `DateTime`                      |
| L-2 | Incomplete schema validation for settings                | `backend/app/schemas/settings.py`                |
| L-3 | Missing audit logging for data mutations                 | All service files                                |
| L-4 | Response size not limited (no max response cap)          | API middleware                                   |
| L-5 | No database query timeout configuration                  | `backend/app/database.py`                        |
| L-6 | Missing API versioning header in responses               | `backend/app/main.py`                            |

### Frontend (12)

| #    | Issue                                                   | File(s)                                          |
|------|---------------------------------------------------------|--------------------------------------------------|
| L-7  | Inconsistent date/number formatting across pages        | Various                                          |
| L-8  | Missing required field indicators (asterisk) on forms   | All form modals                                  |
| L-9  | Horizontal scroll indicator missing on mobile tables    | `TransactionsPage.tsx`                           |
| L-10 | Loading state timing inconsistent across pages          | Various                                          |
| L-11 | No pagination limit indicator ("Page X of Y")           | Paginated pages                                  |
| L-12 | Favicon is default Vite icon                            | `frontend/index.html`                            |
| L-13 | No 404 page for unknown routes                          | Router configuration                             |
| L-14 | Console warnings from React strict mode not addressed   | Various                                          |
| L-15 | Bundle size not analyzed or optimized                   | `frontend/vite.config.ts`                        |
| L-16 | No service worker for offline caching                   | Frontend root                                    |
| L-17 | Missing OpenGraph meta tags                             | `frontend/index.html`                            |
| L-18 | No CSP (Content Security Policy) headers configured     | `frontend/index.html` or server config           |

---

## Action Plan

### Phase 1 - CRITICAL (Priority: Immediate)
**Target:** Fix all 11 critical issues
**Estimated Effort:** 3-5 days
**Scope:**

| Issue | Task                                                       | Effort |
|-------|------------------------------------------------------------|--------|
| C-1   | Add row-level locking to balance update endpoint           | 4h     |
| C-2   | Integrate `slowapi` rate limiting on auth endpoints        | 3h     |
| C-3   | Add `Field(max_digits=15, decimal_places=2)` to all schemas| 2h     |
| C-4   | Fix async delete pattern in alert service                  | 1h     |
| C-5   | Audit and fix user_id filtering in dashboard/forecast      | 4h     |
| C-6   | Define all missing CSS semantic variables                  | 2h     |
| C-7   | Create theme-aware chart color system                      | 4h     |
| C-8   | Fix select dropdown arrow for dark mode                    | 1h     |
| C-9   | Add global 401/403 Axios interceptor with token refresh    | 4h     |
| C-10  | Add React Query retry config and error retry button        | 2h     |
| C-11  | Handle token validation failure with redirect to login     | 2h     |

### Phase 2 - HIGH (Priority: Next Sprint)
**Target:** Fix all 28 high-priority issues
**Estimated Effort:** 8-12 days
**Key Deliverables:**
- Backend validation hardening (H-1 through H-10)
- Shared UI component library: Button, Input, Modal, Badge, Card (H-11 through H-20)
- Accessibility improvements: ARIA labels, keyboard navigation, reduced motion (H-21 through H-28)

### Phase 3 - MEDIUM (Priority: Following Sprint)
**Target:** Fix ~51 medium-priority issues
**Estimated Effort:** 10-15 days
**Key Deliverables:**
- Backend: structured logging, request tracking, health check, index optimization
- Frontend: component splitting, React Query standardization, error boundaries
- Design: typography scale, consistent spacing, tablet breakpoints, RTL polish
- Accessibility: focus traps, skip links, screen reader announcements

### Phase 4 - LOW (Priority: Backlog)
**Target:** Fix ~18 low-priority issues
**Estimated Effort:** 5-7 days
**Key Deliverables:**
- Backend: timezone-aware datetimes, audit logging, query timeouts
- Frontend: date/number formatting, 404 page, bundle optimization, meta tags, CSP headers

---

## Appendix: Files Referenced

### Backend
| File Path                                      | Issues Referenced          |
|------------------------------------------------|----------------------------|
| `backend/app/api/v1/balance.py`                | C-1                        |
| `backend/app/api/v1/auth.py`                   | C-2                        |
| `backend/app/schemas/transaction.py`           | C-3, H-10                  |
| `backend/app/services/alert_service.py`        | C-4                        |
| `backend/app/services/dashboard_service.py`    | C-5                        |
| `backend/app/services/forecast_service.py`     | C-5, H-5                   |
| `backend/app/services/loan_service.py`         | H-1                        |
| `backend/app/services/installment_service.py`  | H-2                        |
| `backend/app/services/category_service.py`     | H-3                        |
| `backend/app/services/fixed_service.py`        | H-4                        |
| `backend/app/services/transaction_service.py`  | H-6                        |
| `backend/app/models/balance.py`                | H-7                        |
| `backend/app/models/fixed.py`                  | H-8                        |
| `backend/app/models/installment.py`            | H-8                        |
| `backend/app/models/loan.py`                   | H-8                        |
| `backend/app/database.py`                      | M-6, L-5                   |
| `backend/app/main.py`                          | M-4, M-9, L-6              |

### Frontend
| File Path                                      | Issues Referenced          |
|------------------------------------------------|----------------------------|
| `frontend/src/index.css`                       | C-6                        |
| `frontend/src/pages/DashboardPage.tsx`         | C-7, M-14, M-26, M-36     |
| `frontend/src/pages/BalancePage.tsx`           | C-7                        |
| `frontend/src/pages/ForecastPage.tsx`          | C-7, M-26                  |
| `frontend/src/pages/TransactionsPage.tsx`      | C-10, M-14, M-16, H-28    |
| `frontend/src/pages/AlertsPage.tsx`            | H-12, H-24                 |
| `frontend/src/pages/LoansPage.tsx`             | H-12, H-21                 |
| `frontend/src/pages/InstallmentsPage.tsx`      | H-12, H-21, H-22          |
| `frontend/src/pages/FixedPage.tsx`             | H-21                       |
| `frontend/src/lib/api.ts`                      | C-9, M-17                  |
| `frontend/src/contexts/AuthContext.tsx`         | C-9, C-11                  |
| `frontend/src/locales/he.json`                 | H-25                       |
| `frontend/src/locales/en.json`                 | H-25                       |
| `frontend/index.html`                          | L-12, L-17, L-18           |
| `frontend/vite.config.ts`                      | L-15                       |

---

*End of Audit Report*
