# Frontend Design Skill - Mega Prompt
## Cashflow.ai — Premium Fintech App Redesign (Phase 2: 8 Remaining Pages)

---

## YOUR MISSION

You are the lead designer for **Cashflow.ai**, a premium cash flow management app. You are redesigning 8 pages to match the quality of the 7 pages + sidebar you already redesigned in a previous session.

**DESIGN QUALITY BAR**: This app must look like it was designed and built by **Apple's product team**. Think Mercury Bank × Linear × Stripe Dashboard. NOT "vibecode", NOT generic AI-generated UI, NOT Bootstrap/Material. Every pixel must feel intentional, every interaction must feel crafted.

**CRITICAL**: You already redesigned Dashboard, Transactions, Login, Register, Fixed, Installments, Loans, and Sidebar. The 8 remaining pages MUST feel like they belong to the same world-class app.

### Design DNA — What Makes This App Feel Premium
- **Spacious layouts** — generous whitespace, 24-32px card padding, breathing room everywhere
- **Depth without heaviness** — subtle layered shadows, glassmorphism in dark mode, not dropshadow-heavy
- **Vibrant but controlled color** — electric accents against clean neutrals, NOT muted/washed out
- **Typography confidence** — large balance numbers (36px+), clear 3-4 step hierarchy, tabular-nums
- **Motion with purpose** — 200-350ms ease-out transitions, subtle hover lifts, no gratuitous bounce
- **Premium dark mode** — near-black layered surfaces with backdrop-blur glass cards, vibrant accents that pop
- **Financial data clarity** — left-align text, right-align numbers, color-coded positive/negative, inline trend indicators

---

## DESIGN REFERENCES — Study These

Before writing any code, internalize the design language of these premium fintech apps:

1. **Mercury Bank** (https://mercury.com / https://demo.mercury.com/dashboard) — The gold standard for fintech dashboard UI. Study their spacing, card design, balance display, charts, and how they show transactions. Clean, confident, Apple-level polish.

2. **Linear** (https://linear.app) — Defined "Linear-style design" — ultra-minimal, fast-feeling, bold typography, beautiful dark mode with glassmorphism, keyboard-first interactions. Their brand indigo (#5E6AD2) is a masterclass in calm authority.

3. **Stripe Dashboard** (https://stripe.com) — Pioneered "developer-friendly but beautiful". Study their accessible color system, KPI cards, table designs, and chart visualizations. Their accent indigo (#635BFF) is vibrant yet professional.

4. **Revolut** (https://revolut.com) — Bridges consumer-friendly vibrance with financial professionalism. Bold color usage against dark backgrounds without being garish.

### Apple Design Principles to Apply
- **Liquid Glass** — glassmorphism with `backdrop-filter: blur(12-16px)`, semi-transparent surfaces, subtle inner light borders (`inset 0 1px 0 rgba(255,255,255,0.1)`)
- **3-layer depth** — highlight layer (light), shadow layer (depth), illumination layer (material properties)
- **Spring physics** — interactive elements use spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
- **Color vibrancy** — colors maintain saturation even at low opacity, never muted/washed out
- **Purposeful motion** — every animation communicates state change, nothing decorative

---

## BRAND IDENTITY UPDATE

### Logo
- **New logo**: `/frontend/public/logo.webp` — "Cashflow.ai" with a circuit-board/dashboard icon in a black circle
- **App name**: Cashflow.ai
- Replace all references to the old logo (`logo.jpeg`) with `logo.webp`
- The logo is black & white — in dark mode, invert it or use a white variant (CSS `filter: invert(1)` when in `.dark` mode)

### Color Palette — VIBRANT & ALIVE

**The old muted slate palette is being upgraded.** These colors should feel electric and premium, like a Bloomberg terminal meets Apple's design language.

#### Brand Gradient (Updated — More Vibrant)
```css
--gradient-brand: linear-gradient(135deg, #00D4FF, #635BFF, #D946EF);
```
- Electric Cyan: `#00D4FF` — alive, modern, tech-forward
- Deep Indigo: `#635BFF` — Stripe-inspired, premium authority
- Hot Magenta: `#D946EF` — energy accent, creative pop

#### Brand Scale (Updated)
```css
--color-brand-50:  #EEF2FF;
--color-brand-100: #E0E7FF;
--color-brand-200: #C7D2FE;
--color-brand-300: #A5B4FC;
--color-brand-400: #818CF8;
--color-brand-500: #635BFF;  /* Primary brand — Stripe-inspired indigo */
--color-brand-600: #4F46E5;
--color-brand-700: #4338CA;
--color-brand-800: #3730A3;
--color-brand-900: #312E81;
```

#### Financial Colors (Vibrant, Not Muted)
```css
/* Income — Vibrant Emerald */
--color-income: #10B981;
/* Income bright for charts: #34D399 */
/* Income deep for emphasis: #059669 */
/* Income background: rgba(16, 185, 129, 0.12) */

/* Expense — Vibrant Rose (NOT aggressive red) */
--color-expense: #F43F5E;
/* Expense bright for charts: #FB7185 */
/* Expense deep for emphasis: #E11D48 */
/* Expense background: rgba(244, 63, 94, 0.12) */
```

#### Dark Mode Palette (Premium — Near-Black Layered)
```css
/* NOT generic slate-800/900. Use zinc-based near-black with layering: */
Background Level 0 (deepest):  #09090B  /* zinc-950, near-black */
Background Level 1 (cards):    #111113  /* slightly elevated */
Background Level 2 (hover):    #18181B  /* zinc-900 */
Background Level 3 (active):   #1F1F23  /* elevated surface */
Border subtle:                 rgba(255, 255, 255, 0.06)
Border default:                rgba(255, 255, 255, 0.10)
Border emphasis:               rgba(255, 255, 255, 0.15)
Text primary:                  #FAFAFA  /* zinc-50 */
Text secondary:                #A1A1AA  /* zinc-400 */
Text muted:                    #71717A  /* zinc-500 */
```

#### Light Mode Palette (Clean, Warm)
```css
Background Level 0:  #FAFAFA  /* warm off-white, NOT pure white */
Background Level 1:  #FFFFFF  /* cards */
Background Level 2:  #F4F4F5  /* hover states */
Border subtle:       #E4E4E7  /* zinc-200 */
Border default:      #D4D4D8  /* zinc-300 */
Text primary:        #09090B  /* zinc-950 */
Text secondary:      #52525B  /* zinc-600 */
Text muted:          #A1A1AA  /* zinc-400 */
```

#### Chart Series Colors (Vibrant & Distinguishable)
```
Series 1: #635BFF  (indigo — brand)
Series 2: #00D4FF  (cyan — electric)
Series 3: #10B981  (emerald — income)
Series 4: #F59E0B  (amber — warning)
Series 5: #F43F5E  (rose — expense)
Series 6: #D946EF  (magenta — accent)
Series 7: #14B8A6  (teal)
Series 8: #EC4899  (pink)
```

### CSS Variable Updates Required

**IMPORTANT**: You MUST update the CSS custom properties in `index.css` to use these new vibrant colors. Update BOTH `:root` (light) and `.dark` sections. The pages you redesign should reference these updated variables, NOT hardcode hex values.

Key variables to update:
- `--gradient-brand` — new 3-stop gradient
- `--color-brand-*` scale — new indigo-based scale
- `--color-expense` — change from `#EF4444` to `#F43F5E` (rose)
- `--border-focus` — change to `#635BFF` (brand indigo)
- Dark mode backgrounds — deeper, near-black zinc palette
- Dark mode borders — more subtle, lower opacity whites

Also update the **Sidebar** component (`Sidebar.tsx`) to use the new `logo.webp` and brand colors — but do NOT change its layout or functionality.

---

## TECH STACK & CONSTRAINTS

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 19 | Hooks only, no class components |
| Language | TypeScript 5.9 | `verbatimModuleSyntax: true` → MUST use `import type` for type-only imports |
| Styling | Tailwind CSS v4 | Uses `@theme` directive (NOT v3 `@tailwind`) |
| State | TanStack React Query v5 | All API calls via `useQuery`/`useMutation` |
| i18n | i18next | Hebrew (default, RTL) + English |
| Icons | lucide-react | All icons from this library |
| Charts | Recharts | For any data visualization |
| Router | React Router v7 | Lazy-loaded pages |
| Path alias | `@/` → `src/` | All imports use this alias |
| Logo | `/frontend/public/logo.webp` | **NEW** — Cashflow.ai logo |

### MUST-FOLLOW Rules
1. **`import type`** for ALL type-only imports: `import type { User } from '@/types'`
2. **CSS variables** for ALL colors — NEVER hardcode hex values in JSX
3. **RTL-first** — use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `inset-inline-start/end`)
4. **Dark mode** — all colors via CSS custom properties that auto-adapt
5. **`ltr-nums`** class on ALL financial numbers in RTL context
6. **`getApiErrorMessage(err)`** for ALL error handling — NEVER render error objects directly as JSX
7. **Existing `useModalA11y` hook** for modal focus management
8. **`useCurrency()` hook** for formatting: `const { formatAmount } = useCurrency()`
9. **`queryKeys.*` helper** for all React Query keys
10. **`useToast()` context** for notifications
11. **`cn()` utility** from `@/lib/utils` for conditional classes

---

## DESIGN SYSTEM REFERENCE

### Reusable CSS Classes (already defined in index.css)
```
Cards: .card, .card-hover, .glass
Buttons: .btn-primary, .btn-secondary, .btn-ghost
Financial: .fin-number, .fin-number-lg, .fin-number-xl, .amount-income, .amount-expense
Badges: .badge-active, .badge-pending, .badge-completed, .badge-paused, .badge-income, .badge-expense, .type-pill, .type-pill-income, .type-pill-expense, .meta-pill
Progress: .progress-bar, .progress-fill, .progress-fill-success/warning/danger
Inputs: .input, .input-error, .amount-input
Animations: .animate-fade-in-up, .animate-fade-in, .animate-fade-in-scale, .skeleton, .empty-float
Modals: .modal-backdrop, .modal-panel
Stagger: .stagger-1 through .stagger-8, .section-delay-1 through .section-delay-4
Layout: .segment-control, .segment-control-btn, .icon-circle-sm/md/lg
Tables: .tx-table, .row-animate, .row-income, .row-expense
Severity: .severity-info, .severity-warning, .severity-critical
Auth: .auth-brand-bg, .auth-glass-card, .auth-gradient-text, .auth-stagger, .auth-error-animate
Onboarding: .onboarding-page, .onboarding-bg-decoration, .onboarding-glass-card, .onboarding-btn-gradient, .onboarding-logo-pulse, .onboarding-slide-in, .onboarding-slide-out-left/right, .onboarding-card-selected/unselected, .onboarding-dot-active/completed/pending, .onboarding-done-icon, .onboarding-confetti
```

### @theme Tokens (Tailwind v4)
```
Radius: --radius-xs(4px), --radius-sm(6px), --radius-md(10px), --radius-lg(14px), --radius-xl(20px), --radius-2xl(24px), --radius-full
Easing: --ease-smooth(cubic-bezier(0.4,0,0.2,1)), --ease-spring(cubic-bezier(0.34,1.56,0.64,1))
Duration: --duration-fast(150ms), --duration-normal(300ms), --duration-slow(500ms)
```

### Typography
```
Body: 'Inter', 'Heebo', system-ui, -apple-system, sans-serif
Hebrew: 'Heebo' first, then 'Inter'
Monospace: 'JetBrains Mono', ui-monospace, monospace
Financial numbers: font-weight 700, tabular-nums, letter-spacing -0.02em
Large balance: font-size 36px, font-weight 800, letter-spacing -0.03em
```

---

## 8 PAGES TO REDESIGN

Each page: purpose, line count, functionality to preserve, data types, API calls, i18n keys, edge cases.

---

### PAGE 1: OnboardingPage.tsx (1542 lines) — HIGHEST PRIORITY

**Purpose**: Multi-step wizard for new user setup after registration. Steps: Welcome → Personal Info → Language & Theme → Currency & Balance → Categories → Fixed Income/Expenses → Done

**Functionality to preserve**:
- 7-step wizard with animated transitions between steps
- Step 1 (Welcome): Animated Cashflow.ai logo (use new `logo.webp`), brand gradient, "Let's start" button
- Step 2 (Personal Info): Full name, phone, email (readonly from registration)
- Step 3 (Language & Theme): Language picker (Hebrew/English) + theme picker (light/dark/system)
- Step 4 (Currency & Balance): Currency selector (ILS/USD/EUR) + initial bank balance input with date
- Step 5 (Categories): Toggle default categories (income/expense) + add custom categories
- Step 6 (Fixed): Add recurring monthly income/expenses (name, amount, day, type)
- Step 7 (Done): Confetti animation, setup summary, "Go to Dashboard" button
- Progress dots at bottom showing current/completed/pending steps
- Skip buttons on optional steps
- Persists step data and calls API on completion
- sessionStorage flag `onboarding_completed` set after finish

**API calls**: `settingsApi.update()`, `balanceApi.create()`, `categoriesApi.create()`, `fixedApi.create()`

**Edge cases to handle**:
- Empty state on final step with no data entered
- Currency symbol positioning in RTL
- Long category names (truncate + tooltip)
- Balance validation (required field)
- Fixed items day_of_month validation (1-31)
- Confetti animation clipping on mobile < 320px
- Animation state during API loading (show overlay, prevent double-submit)

**i18n keys**: `onboarding.*` (84 keys including welcome, stepPersonalInfo, stepLanguageTheme, stepCurrency, stepBalance, stepCategories, stepFixed, stepDone, etc.)

---

### PAGE 2: CategoriesPage.tsx (1009 lines)

**Purpose**: CRUD for income/expense categories with two-column layout, color picker, icon picker, archive/unarchive

**Functionality to preserve**:
- Two columns: Income categories (left/start) | Expense categories (right/end)
- Each category card shows: icon, name (localized), color dot, type badge
- Add/Edit modal with: name (EN), name_he (HE), icon picker (emoji grid), color picker, type selector
- Archive button (soft delete with is_archived flag)
- Unarchive from "Archived" section at bottom
- Drag-reorder support (display_order field)
- Empty state per column

**Data type**: `Category { id, name, name_he, type, icon, color, is_archived, display_order }`

**API calls**: `categoriesApi.list()`, `categoriesApi.create()`, `categoriesApi.update()`, `categoriesApi.delete()`, `categoriesApi.reorder()`

**Edge cases to handle**:
- Very long category names (60+ chars) — truncate with ellipsis
- Icon picker overflow on mobile < 375px — reduce to 6 columns
- Color picker input invisible in dark mode — add explicit border
- Empty column state — show specific message ("No income categories yet")
- Modal focus trap via `useModalA11y`
- Archive confirmation dialog

**i18n keys**: `categories.*` (9 keys: title, add, name, nameHe, icon, color, namePlaceholder, nameHePlaceholder, iconPlaceholder)

---

### PAGE 3: BalancePage.tsx (812 lines)

**Purpose**: View/update bank balance with history chart and table

**Functionality to preserve**:
- Hero card showing current balance (large `.fin-number-xl`), effective date, last updated
- "Update Balance" button opens modal (amount, effective_date, notes)
- Balance history chart (Recharts area/line chart)
- History table with columns: date, balance, notes, actions
- Edit/delete existing balance entries

**Data type**: `BankBalance { id, balance, effective_date, is_current, notes }`

**API calls**: `balanceApi.getCurrent()`, `balanceApi.create()`, `balanceApi.update()`, `balanceApi.history()`

**Edge cases to handle**:
- Chart with only 1 data point — show single point or empty state
- Very large balance amounts (999,999,999+) — abbreviate on Y-axis
- Negative balance styling — clear rose/red indicators
- History table timestamps on mobile — abbreviated date format
- Notes with newlines — `whitespace-normal` + `max-w-xs`

**i18n keys**: `balance.*` (5 keys: title, current, update, history, effectiveDate)

---

### PAGE 4: ForecastPage.tsx (2136 lines) — MOST COMPLEX

**Purpose**: Multi-tab cash flow forecast with charts, comparison, what-if scenario, and drill-down

**Functionality to preserve**:
- Tab navigation: Monthly | Weekly | Summary | Comparison
- **Monthly tab**: Area/Bar chart (toggle), forecast table with month rows, click-to-drill-down modal
- **Weekly tab**: Similar but weekly granularity
- **Summary tab**: KPI cards (avg income, avg expenses, lowest/highest balance, trend), negative balance alert
- **Comparison tab**: Select Month A vs Month B, side-by-side comparison with difference/percentage
- **What-If panel**: Slide-out panel to adjust: add monthly income, add monthly expense, change starting balance
- Month drill-down modal: Opening/closing balance, itemized income/expense breakdown
- Sparkline mini-charts in summary cards
- Negative balance warning indicators

**Data types**: `ForecastMonth`, `ForecastResponse`, `ForecastSummary`, `WeeklyForecastWeek`

**API calls**: `forecastApi.monthly()`, `forecastApi.weekly()`, `forecastApi.summary()`

**Edge cases to handle**:
- Month drill-down modal scrolling with long content — `overflow-y-auto max-h-[85vh]`
- Sparklines with < 2 data points — check before rendering
- Chart tooltip text cut off — increase tooltip width
- What-if fields accepting negative numbers — add `min={0}`
- Month selector overflow on mobile — stack vertically
- Comparison with < 2 months — show "Need 2+ months" message
- Negative balance indicator in table rows
- Loading state per tab (not global)

**i18n keys**: `forecast.*` (60 keys: monthly/weekly/summary/comparison tabs, whatIf panel, income/expense breakdown, trend labels, negative balance alerts)

---

### PAGE 5: AlertsPage.tsx (995 lines)

**Purpose**: View/manage financial alerts with severity filtering, snooze, mark read/dismiss

**Functionality to preserve**:
- Filter tabs: All | Unread | Critical | Warning | Info
- Alert count badges per severity
- Alert cards with: severity border (left), icon, title, message, timestamp, actions
- Actions dropdown: Mark read/unread, snooze (1hr/tomorrow/1week/custom date), dismiss
- "Mark all read" button with unread count
- Sound toggle button
- Severity indicator colors: critical=rose, warning=amber, info=indigo
- Relative timestamps ("2 hours ago", "yesterday")
- Empty states per filter ("No critical alerts", etc.)

**Data type**: `Alert { id, alert_type, severity, title, message, is_read, is_dismissed, created_at }`

**API calls**: `alertsApi.list()`, `alertsApi.unread()`, `alertsApi.markRead()`, `alertsApi.markUnread()`, `alertsApi.markAllRead()`, `alertsApi.dismiss()`, `alertsApi.snooze()`

**Edge cases to handle**:
- Very long alert messages (500+ chars) — max-width with overflow
- Snooze dropdown closes on date input click — add `stopPropagation()`
- Unread count badge RTL alignment
- Filter counts showing "0" — hide badge when count = 0
- Alert card glow effect too subtle in light mode — increase opacity
- Sound button needs `aria-label`

**i18n keys**: `alerts.*` (41 keys: title, filter tabs, actions, snooze options, empty states, severity labels, sound toggle, alert types)

---

### PAGE 6: SettingsPage.tsx (828 lines)

**Purpose**: User preferences with theme/language toggle, currency, notifications, forecast default

**Functionality to preserve**:
- Sections: General | Appearance | Preferences | Account
- **General**: Display currency selector (ILS/USD/EUR) with confirmation dialog
- **Appearance**: Theme picker (light/dark/system) with preview cards, language toggle (HE/EN)
- **Preferences**: Notifications toggle, default forecast months dropdown, week start day
- **Account**: Email display, change password button, user info
- Auto-save preferences on change (debounced `settingsApi.update()`)
- Currency change confirmation dialog with warning message

**Data type**: `Settings { id, currency, language, date_format, theme, notifications_enabled, forecast_months_default, week_start_day, onboarding_completed }`

**API calls**: `settingsApi.get()`, `settingsApi.update()`

**Edge cases to handle**:
- Currency change dialog must be properly modal (block interactions behind)
- Toggle switch thumb position in RTL
- Language change flash of unstyled content (FOUC) — loading overlay
- Long email overflow — truncate + title
- Theme preview cards matching actual theme
- Saving state indicator — use toast on save
- Password change button (currently placeholder)

**i18n keys**: `settings.*` (29 keys: sections, currency options, theme names, notification labels, week days)

---

### PAGE 7: UsersPage.tsx (942 lines) — ADMIN ONLY

**Purpose**: Admin-only user management with CRUD, role assignment, activation/deactivation

**Functionality to preserve**:
- Admin-only guard (redirect if not admin)
- User table: username, email, role (admin/user), status (active/inactive), created_at, last_login, actions
- Add user modal: username, email, password, admin toggle
- Edit user modal: username, email, admin toggle (no password field on edit)
- Delete confirmation dialog with username
- Activate/deactivate toggle per user
- Cannot modify/delete yourself (disabled with tooltip)
- User count in header
- Avatar with first letter of username

**Data type**: `User { id, username, email, full_name, phone_number, is_admin, is_active, created_at, last_login_at }`

**API calls**: Uses auth/user management endpoints

**Edge cases to handle**:
- Self-modification prevention — clear UI feedback, not just disabled
- Long usernames (50+ chars) — truncate in avatar and table
- Admin toggle visual state in RTL
- Form error banner visibility — darker background
- Delete confirmation with long username — truncate
- Modal preserves form data on API error
- Empty state when no other users

**i18n keys**: `users.*` (35 keys: title, subtitle, CRUD labels, roles, status, form fields, confirmations, self-action warnings)

---

### PAGE 8: ErrorPage.tsx (227 lines) — SMALLEST

**Purpose**: Error display for 404/500/403/generic errors with debug details

**Functionality to preserve**:
- Props: `statusCode`, `message?`, `debugInfo?`
- Large animated error code display with gradient
- Error title and descriptive message (localized)
- "Go Home" and "Try Again" buttons
- Collapsible debug details section (code block with copy button)
- Used as global error boundary fallback AND as 404 page in router

**Edge cases to handle**:
- Debug details with very long content — max-height with scroll
- Error messages must all be localized — use i18n keys
- Copy button feedback — show "Copied!" for 3-4 seconds
- Error code gradient readability — ensure contrast
- Mobile scrolling when content overflows

**i18n keys**: `error.*` (14 keys: notFoundTitle, serverErrorTitle, forbiddenTitle, genericTitle, corresponding messages, goHome, tryAgain, debugDetails, copyDebug, copied)

---

## CRITICAL RULES — DO NOT BREAK

### Error Handling Safety
```typescript
// CORRECT — always use this pattern:
import { getApiErrorMessage } from '@/api/client'

catch (err: unknown) {
  setError(getApiErrorMessage(err))
  // OR
  toast.error(getApiErrorMessage(err))
}

// NEVER DO THIS — will crash React with "Objects are not valid as React child":
catch (err: any) {
  setError(err.response?.data?.detail) // detail can be an ARRAY of objects!
}
```

### Import Types Correctly
```typescript
// CORRECT:
import type { Category, Transaction } from '@/types'
import type { CreateCategoryData } from '@/api/categories'

// INCORRECT (will fail TypeScript):
import { Category, Transaction } from '@/types'
```

### Financial Number Display
```typescript
// CORRECT:
const { formatAmount } = useCurrency()
<span className="fin-number ltr-nums">{formatAmount(item.amount, item.currency)}</span>

// INCORRECT:
<span>{item.amount}</span>  // raw string, no formatting
<span>₪{parseFloat(item.amount).toFixed(2)}</span>  // hardcoded symbol
```

### RTL Awareness
```typescript
// CORRECT:
const { i18n } = useTranslation()
const isRtl = i18n.language === 'he'
<div className="ps-4 pe-2">  // logical properties
<ChevronRight className={cn('h-4 w-4', isRtl && 'rotate-180')} />

// INCORRECT:
<div className="pl-4 pr-2">  // physical properties break in RTL
```

### Dark Mode
```typescript
// CORRECT:
style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}

// INCORRECT:
style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
className="bg-white text-black"
```

---

## OUTPUT FORMAT

For each page, output the COMPLETE redesigned file content. Each file should be a self-contained `.tsx` file with:
1. All imports at the top (with `import type` for types)
2. Type definitions
3. Constants
4. Helper functions
5. Sub-components (Skeleton, etc.)
6. Main component (default export)

**Do NOT split pages into multiple component files.** Each page is one file in `frontend/src/pages/`.

**You MAY and SHOULD update `index.css`** to implement the new vibrant color palette — update CSS custom properties, @theme tokens, and add any new utility classes needed for the premium design.

**You MAY update `Sidebar.tsx`** to use the new `logo.webp` and updated brand colors.

**Do NOT modify** router, contexts, API modules, hooks, or the 7 already-redesigned pages (Dashboard, Transactions, Login, Register, Fixed, Installments, Loans) unless updating their color variable references.

---

## DESIGN PHILOSOPHY — THE ANTI-VIBECODE MANIFESTO

What makes something look "vibecoded" (generic AI UI):
- ❌ Predictable blue-gray color schemes with no personality
- ❌ Uniform shadow depths everywhere
- ❌ Generic card layouts with identical padding
- ❌ No micro-interactions or hover states
- ❌ Skeleton loaders that don't match content
- ❌ Empty states with sad generic icons
- ❌ Flat, lifeless charts with default Recharts styling

What makes something look Apple-designed:
- ✅ **Intentional color hierarchy** — 1 vibrant accent, 2-3 supporting tones, clean neutrals
- ✅ **Variable depth** — hero cards have more depth than secondary cards
- ✅ **Asymmetric layouts** where appropriate — not everything in identical grid
- ✅ **Custom-styled chart tooltips** with glassmorphism and shadows
- ✅ **Skeleton loaders with shimmer gradients** that match exact content dimensions
- ✅ **Empty states that delight** — illustrated icons with subtle animation, encouraging copy
- ✅ **Hover states that reward exploration** — subtle scale, shadow shift, color warmth
- ✅ **Data visualization that tells a story** — gradient fills under area charts, animated data transitions
- ✅ **Glassmorphism in dark mode** — `backdrop-filter: blur(12px)`, semi-transparent backgrounds, inner light borders

Process the pages in this order: **index.css (color updates) → Sidebar (logo) → OnboardingPage → CategoriesPage → BalancePage → ForecastPage → AlertsPage → SettingsPage → UsersPage → ErrorPage**
