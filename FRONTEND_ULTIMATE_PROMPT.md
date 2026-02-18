# FRONTEND FIX & POLISH — Final Pass

## Mission
Fix all visual bugs and eliminate every "vibecode" pattern. After this pass, the app should look like it was designed by Stripe's team — clean, restrained, professional. No neon glows, no rainbow gradients, no excessive colors.

---

## TECH STACK — MUST FOLLOW
- React 19 + TypeScript 5.9 with `verbatimModuleSyntax: true` → use `import type` for type-only imports
- Tailwind CSS v4 with `@theme` directive (NOT v3 `@tailwind`)
- TanStack React Query v5 for all API calls
- i18next — Hebrew (default, RTL) + English
- Recharts for charts
- lucide-react for icons
- Path alias: `@/` maps to `src/`
- CSS custom properties for ALL colors — NEVER hardcode hex in JSX
- RTL-first: use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `inset-inline-start/end`)
- Error handling: use `getApiErrorMessage(err)` from `@/api/client` — NEVER render error objects as JSX
- `useCurrency()` hook for financial number formatting
- `useCountUp()` hook at `@/hooks/useCountUp` — already used in Dashboard/Balance/Forecast
- `useScrollReveal()` hook at `@/hooks/useScrollReveal` — already used across pages

---

## PRIORITY 1 — FIX DASHBOARD NUMBER VISIBILITY (DO FIRST)

### Problem
Users report they cannot see numbers on the Dashboard (income, expenses, balance, etc.). The data fetching works correctly (React Query → useCountUp → formatAmount), but numbers may be invisible due to CSS issues.

### Root Cause: `scroll-reveal` opacity problem
Every major dashboard section is wrapped in `<div className="scroll-reveal ...">`. The `.scroll-reveal` class starts at `opacity: 0` and only becomes `opacity: 1` when the `useScrollReveal` IntersectionObserver adds the `in-view` class. If the observer doesn't fire (e.g., elements already in viewport on load), sections remain invisible.

### Fix 1A — Ensure scroll-reveal elements above the fold are visible

In `src/index.css`, modify the `.scroll-reveal` rule to handle elements that are already in the viewport. The safest fix is to add a fallback animation:

```css
/* Existing rule — modify it */
.scroll-reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s var(--ease-smooth), transform 0.5s var(--ease-smooth);
}
.scroll-reveal.in-view {
  opacity: 1;
  transform: translateY(0);
}

/* ADD THIS: Auto-reveal after 600ms if IntersectionObserver hasn't fired */
@keyframes scrollRevealFallback {
  to { opacity: 1; transform: translateY(0); }
}
.scroll-reveal {
  animation: scrollRevealFallback 0.5s var(--ease-smooth) 0.6s forwards;
}
.scroll-reveal.in-view {
  animation: none; /* Cancel fallback when observer fires normally */
}
```

### Fix 1B — Remove `overflow: hidden` from `card-glow` that clips KPI cards

In `src/index.css`, the `.card-glow` class has `overflow: hidden` which clips content. Change to `overflow: visible` or remove the property. The `::before` pseudo-element glow can use `border-radius` + `pointer-events: none` instead:

```css
.card-glow {
  position: relative;
  /* REMOVE: overflow: hidden; */
}
.card-glow::before {
  /* ... existing styles ... */
  border-radius: inherit;
  pointer-events: none;
}
```

### Fix 1C — Verify KPI cards render correctly in DashboardPage.tsx

Check lines ~1595-1626 in `DashboardPage.tsx`. The KPI data flow is:
```
summaryQuery.data → rawIncome/rawExpenses/rawNet → useCountUp() → formatAmount() → KpiCard.value
```
When `summary` is null, display is `'--'`. When loaded, numbers animate from 0. Verify this chain is intact.

### Fix 1D — Fix truncation on financial numbers

In `DashboardPage.tsx`:
- **Hero balance** (line ~278): Has `truncate` class. On narrow screens, large numbers like "₪1,234,567.89" get clipped. Consider using `text-xl` instead of `text-2xl` as a responsive fallback, or remove `truncate` and use `break-all`.
- **Net cashflow label** (line ~283): Both label AND number share one `<span>` with `truncate`. Split them: label gets `shrink-0`, number gets `truncate min-w-0`.
- **KPI values** (line ~434): In `min-w-0 flex-1` container with `truncate`. Ensure the icon container has `shrink-0`.

### Fix 1E — Verify all sections render on page load

Open the dashboard in a browser. Every section should be visible within 1 second of page load. If any section is invisible (white space where cards should be), the `scroll-reveal` is not triggering. The fallback animation from Fix 1A should handle this.

---

## PRIORITY 2 — KILL ALL VIBECODE PATTERNS

### What makes it look like "vibecode":
1. **Neon glow shadows** — `boxShadow` with colored rgba (not black)
2. **Inline radial-gradient** — decorative gradient overlays in JSX
3. **Too many colors** — 6+ color families on one page
4. **Colored box-shadows** — shadows that glow in green/red/purple
5. **Redundant decorative elements** — floating shapes, blurred circles

### 2A — Remove ALL neon glow shadows (HIGHEST PRIORITY)

These are the worst offenders. Replace every one:

**AlertsPage.tsx:**
- Line ~466: `boxShadow: \`0 0 8px ${sev.accent}\`` → REMOVE the boxShadow entirely (or use `boxShadow: 'var(--shadow-xs)'`)
- Line ~499: `boxShadow: \`0 0 6px ${sev.accent}\`` → REMOVE
- Line ~440: `boxShadow: isUnread ? \`var(--shadow-xs), 0 0 24px ${sev.glowColor}\` : ...` → Change to just `boxShadow: isUnread ? 'var(--shadow-sm)' : 'var(--shadow-xs)'`

**CategoriesPage.tsx:**
- Line ~192: `boxShadow: \`0 0 8px ${category.color}50\`` → REMOVE
- Line ~998: `boxShadow: \`0 2px 8px ${formData.color}30\`` → Change to `boxShadow: 'var(--shadow-xs)'`
- Lines ~247-249: `boxShadow: '0 8px 32px rgba(16, 185, 129, 0.12)'` → `boxShadow: '0 8px 32px rgba(0,0,0,0.08)'`
- Lines ~376-378: `boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'` → `boxShadow: 'var(--shadow-xs)'`

**BalancePage.tsx:**
- Lines ~147-149: `boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)'` → REMOVE the boxShadow entirely

**InstallmentsPage.tsx:**
- Line ~254: `boxShadow: \`0 2px 8px ${barColor}40\`` → REMOVE

**ForecastPage.tsx:**
- Line ~246: `boxShadow: \`0 0 6px ${entry.color}40\`` → REMOVE

**SettingsPage.tsx:**
- Line ~1084: `boxShadow: '0 4px 14px var(--bg-danger)'` → `boxShadow: '0 4px 14px rgba(0,0,0,0.1)'`
- Line ~1186: `boxShadow: '0 4px 14px var(--bg-warning)'` → `boxShadow: '0 4px 14px rgba(0,0,0,0.1)'`

**BackupsPage.tsx:**
- Line ~770: `boxShadow: '0 4px 14px var(--bg-danger)'` → `boxShadow: '0 4px 14px rgba(0,0,0,0.1)'`

**index.css:**
- `.card-glow::before` radial-gradient: Either REMOVE the cursor-glow effect entirely OR make it very subtle (`rgba(99, 91, 255, 0.04)` instead of `0.12`)

### 2B — Remove ALL inline radial-gradients from JSX

**LoginPage.tsx:**
- Line ~120: `background: 'radial-gradient(ellipse at 50% 50%, rgba(99, 91, 255, 0.15) 0%, transparent 70%)'` → REMOVE this inline style entirely. The `.auth-brand-bg` CSS class already handles this.
- Lines ~130, 138: Floating circle decorations with `radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)` → REMOVE the inline gradient styles. Set a simple `backgroundColor: 'rgba(255,255,255,0.04)'` instead.

**RegisterPage.tsx:**
- Line ~202: Same duplicate `radial-gradient` as LoginPage → REMOVE
- Lines ~211, 218: Same floating circles → REMOVE gradients, use solid `backgroundColor`

**index.css:**
- `.hero-balance-card::before` at line ~639: radial-gradient with `rgba(99, 91, 255, 0.04)` → This is very subtle (4%), acceptable to keep OR remove entirely.
- `.auth-brand-bg` at line ~1169: This is the SOURCE definition for auth page background — KEEP this one, it's the single source of truth.
- `.card-glow::before` at line ~1714: cursor-glow effect — reduce opacity from `0.12` to `0.04` or remove.

### 2C — Reduce color palette on RegisterPage.tsx password strength

Currently uses 6 color families (red, orange, yellow, emerald, cyan, amber). Replace with 3:

```tsx
function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 4) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { score, labelKey: 'validation.strengthWeak', color: 'var(--color-danger)', bgColor: 'var(--color-danger)' }
  if (score <= 3) return { score, labelKey: 'validation.strengthFair', color: 'var(--text-tertiary)', bgColor: 'var(--text-tertiary)' }
  if (score <= 4) return { score, labelKey: 'validation.strengthGood', color: 'var(--color-success)', bgColor: 'var(--color-success)' }
  return { score, labelKey: 'validation.strengthExcellent', color: 'var(--color-success)', bgColor: 'var(--color-success)' }
}
```

Then update the JSX that uses `passwordStrength.color` and `passwordStrength.bgColor` to apply these via inline `style` instead of Tailwind classes:
```tsx
<span style={{ color: passwordStrength.color }}>{t(passwordStrength.labelKey)}</span>
```
For the progress bars:
```tsx
<div style={passwordStrength.score >= level ? { backgroundColor: passwordStrength.bgColor } : { backgroundColor: 'var(--bg-tertiary)' }} />
```

### 2D — Remove decorative floating shapes from auth pages

In LoginPage.tsx and RegisterPage.tsx, there are floating `<div>` elements with `animation: 'float ...'` that look like a generic AI template. Remove the entire "Floating decorative shapes" section (the `<div className="absolute inset-0 overflow-hidden pointer-events-none">` container with 4-6 animated circles/squares inside).

Keep ONLY:
- The `.auth-brand-bg` background (from CSS)
- The logo
- The title and subtitle
- The divider line (make it a simple `<div>` with `backgroundColor: 'rgba(255,255,255,0.15)'`, no gradient)

---

## PRIORITY 3 — REPLACE ALL HARDCODED HEX WITH CSS VARIABLES

### Master replacement table:

| Hardcoded | CSS Variable | Where Used |
|-----------|-------------|-----------|
| `#10B981` | `var(--color-income)` | DashboardPage (KPI accent x2), ForecastPage (chart), OnboardingPage |
| `#34D399` | `var(--color-success-light)` | ForecastPage (chart stops, stacked bar) |
| `#6EE7B7` | `var(--color-success-light)` at 70% opacity | ForecastPage (stacked bar shade) |
| `#A7F3D0`, `#D1FAE5` | Use `var(--bg-success)` or `var(--bg-success-subtle)` | ForecastPage stacked bar shades |
| `#F43F5E` | `var(--color-expense)` or `var(--color-danger)` | DashboardPage (KPI accent x2), ForecastPage, LoansPage |
| `#FB7185` | `var(--color-danger-light)` | ForecastPage (chart stops, stacked bar) |
| `#FCA5A5`, `#FECACA`, `#FEE2E2` | Use `var(--bg-danger)` or `var(--bg-danger-subtle)` | ForecastPage stacked bar shades |
| `#635BFF` | `var(--color-brand-500)` | DashboardPage (KPI accent x2), ForecastPage, LoansPage (PIE_COLORS) |
| `#F59E0B` | `var(--color-warning)` | LoansPage (PIE_COLORS) |
| `#94a3b8` | `var(--text-tertiary)` | DashboardPage (category fallback) |
| `#6B7280` | `var(--chart-neutral)` | InstallmentsPage (pending status) |
| `#9CA3AF` | `var(--text-tertiary)` | InstallmentsPage (pending progress bar) |

### DashboardPage.tsx specific fixes (lines ~1595-1626):
```tsx
// BEFORE (hardcoded):
accentColor: '#10B981',
sparklineColor: '#10B981',

// AFTER (CSS variable):
accentColor: 'var(--color-income)',
sparklineColor: 'var(--color-income)',
```

Same pattern for expenses (`'var(--color-expense)'`) and net (`'var(--color-brand-500)'`).

**IMPORTANT for Recharts**: Recharts SVG elements accept CSS variable strings in `stroke`, `fill`, and `stopColor` attributes. This works:
```tsx
<stop stopColor="var(--color-income)" stopOpacity={0.3} />
<Line stroke="var(--color-income)" />
```

For the ForecastPage stacked bar chart (8 hardcoded hex shades), simplify to 2 colors with opacity:
```tsx
// Instead of 4 income shades (#34D399, #6EE7B7, #A7F3D0, #D1FAE5)
// Use: var(--color-income) at different opacities
<Bar fill="var(--color-income)" fillOpacity={1} />
<Bar fill="var(--color-income)" fillOpacity={0.6} />
<Bar fill="var(--color-income)" fillOpacity={0.3} />
<Bar fill="var(--color-income)" fillOpacity={0.15} />
```

### DashboardPage.tsx — Replace Tailwind color classes:
- Line ~325: `text-emerald-300` → `style={{ color: 'var(--color-success-light)' }}`
- Line ~327: `text-red-300` → `style={{ color: 'var(--color-danger-light)' }}`

### Sidebar.tsx:
- Line ~177: `bg-red-500` → `style={{ backgroundColor: 'var(--color-danger)' }}`
- Line ~360: `hover:bg-red-500/10 hover:text-red-400` → Use inline `onMouseEnter`/`onMouseLeave` state with CSS variables, or create a `.sidebar-logout-hover` class in index.css
- Line ~112: `rgba(255, 255, 255, 0.55)` → create CSS var `--text-sidebar-label` or use existing `--text-sidebar`
- Line ~143: `rgba(99, 91, 255, 0.1)` → use `var(--bg-info)` which is already `rgba(99, 91, 255, 0.08)`

### InstallmentsPage.tsx:
- Line ~152-154: Replace `'#6B728012'`, `'#6B7280'` with `var(--bg-hover)`, `var(--text-tertiary)`
- Line ~220, 252, 848: Replace `'#9CA3AF'` with `var(--text-tertiary)`

### LoansPage.tsx:
- Line ~265: `const PIE_COLORS = ['#635BFF', '#F59E0B']` → `['var(--color-brand-500)', 'var(--color-warning)']`

### OnboardingPage.tsx:
- Line ~202: Confetti colors `['#00D4FF', '#635BFF', '#D946EF', '#10B981', '#F59E0B', '#F43F5E']` → These are intentionally varied for a celebration effect. Reduce to 3: `['var(--color-brand-500)', 'var(--color-income)', 'var(--color-expense)']`

### Form validation borders across ALL pages:
Replace `border-red-400` (Tailwind class) with a CSS variable approach. Add to index.css:
```css
.input-error {
  border-color: var(--border-danger) !important;
}
```
Then replace `border-red-400` in className with the `input-error` class (or inline `style={{ borderColor: 'var(--border-danger)' }}`).

Similarly, `border-emerald-400` in RegisterPage → `style={{ borderColor: 'var(--border-success)' }}`.

### Validation error text:
Replace `text-red-500` in error messages → `style={{ color: 'var(--color-danger)' }}`
Replace `text-emerald-500` → `style={{ color: 'var(--color-success)' }}`
Replace `text-amber-500` → `style={{ color: 'var(--color-warning)' }}`

---

## PRIORITY 4 — CSS SYSTEM CLEANUP

### 4A — Fix dark mode missing variables

In `src/index.css`, the `.dark {}` block is missing overrides for these:
- `--color-success-light` / `--color-danger-light` — These are used on the hero card's expected balance badge. Add to `.dark`:
```css
.dark {
  --color-success-light: #6EE7B7;  /* Slightly brighter green for dark bg */
  --color-danger-light: #FCA5A5;   /* Slightly brighter red for dark bg */
}
```

### 4B — Remove dead CSS

These @keyframes are defined but never used by any class:
- `authBgShift` (line ~1179) — REMOVE
- `gradientShift` (line ~1287) — REMOVE
- `accordionClose` (line ~1549) — REMOVE (or add a class that uses it)

### 4C — Fix naming inconsistency

`--ease-spring` and `--ease-overshoot` are identical (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Remove `--ease-overshoot` and replace all usages with `--ease-spring` (or vice versa).

### 4D — Fix `--bg-primary` / `--bg-secondary` duplication

Both are `#FAFAFA` in light mode and `#09090B` in dark mode — they're identical. Either:
- Give `--bg-secondary` a distinct value (e.g., `#F4F4F5` in light / `#111113` in dark)
- Or remove `--bg-secondary` and replace all usages with `--bg-primary`

### 4E — Rename `.brand-gradient` class

The class name is misleading — it applies `background-color: var(--color-brand-500)` (solid), not a gradient. Rename to `.brand-bg` or `.bg-brand`.

---

## PRIORITY 5 — FUNCTIONAL BUGS & NEW FEATURES

### 5A — CRITICAL: Modal Forms Can't Scroll (Blocks User Input!)

Users cannot fill forms because modal content is clipped and unscrollable. The root cause: `overflow-hidden` on modal panels prevents scrolling.

**Fix every modal panel** — replace `overflow-hidden` with `max-h-[85vh] overflow-y-auto`:

| File | Line | Current | Fix |
|------|------|---------|-----|
| `FixedPage.tsx` | ~658 | `overflow-hidden` (no max-h, no scroll) | Add `max-h-[85vh] overflow-y-auto`, REMOVE `overflow-hidden` |
| `FixedPage.tsx` | ~1035 | `overflow-hidden` (delete dialog) | Same fix |
| `InstallmentsPage.tsx` | ~1127 | `overflow-hidden` (no max-h) | Same fix |
| `InstallmentsPage.tsx` | ~1534 | `overflow-hidden` (delete dialog) | Same fix |
| `InstallmentsPage.tsx` | ~1637 | `overflow-hidden` | Same fix |
| `LoansPage.tsx` | ~1209 | `overflow-y-auto overflow-hidden` | REMOVE `overflow-hidden` (it overrides `overflow-y-auto`) |
| `SubscriptionsPage.tsx` | check | Likely same issue | Same fix |
| `CategoriesPage.tsx` | check | Likely same issue | Same fix |

The correct modal panel className pattern:
```tsx
className="modal-panel relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border p-0"
```

Also check `src/index.css` line ~2022-2025: the CSS rule `.fixed.inset-0.z-50.flex` with `align-items: flex-end !important` may not match Tailwind v4 generated classes. If this rule doesn't fire, modals won't convert to bottom-sheets on mobile. Test on a narrow viewport (<768px) and fix if needed.

### 5B — Add Subscriptions Widget to Dashboard

The Dashboard has NO subscriptions section. The backend endpoint `/dashboard/subscriptions-summary` exists and returns data, but the frontend never calls it.

**Add to `src/api/dashboard.ts`:**
1. Add a `subscriptionsSummary()` method that calls `GET /dashboard/subscriptions-summary`
2. Add TypeScript types for the response

**Add to `DashboardPage.tsx`:**
1. Add a new query: `subscriptionsQuery` calling `dashboardApi.subscriptionsSummary()`
2. Create a `SubscriptionsWidget` component showing:
   - Total monthly subscription cost
   - Active subscriptions count
   - Upcoming renewals count (next 7 days)
   - List of subscriptions with amounts
   - "View all" link to `/subscriptions`
3. Place it in the dashboard grid, after the Upcoming Payments section

### 5C — Add Subscriptions to Upcoming Payments Widget

The backend has been updated to include subscriptions in `/dashboard/upcoming-payments` with `source_type="subscription"`. Now update the frontend:

**In `src/api/dashboard.ts`:**
- Add `'subscription'` to the `UpcomingPaymentItem.source_type` union type

**In `DashboardPage.tsx` → `UpcomingPaymentsWidget`:**
- Add `case 'subscription'` to `getSourceIcon()` — use `CalendarClock` or `RotateCw` icon from lucide-react
- Add `case 'subscription'` to `getSourceLabel()` — return `t('nav.subscriptions')` or a dedicated key
- Import the new icon at the top of the file

### 5D — Alert Popup Notifications

When new alerts arrive, show a toast/popup notification at the top-right of the screen:

1. In `DashboardPage.tsx`, detect when `alertsQuery.data` changes and has new unread items
2. Show a popup card (NOT a toast — a dedicated card) at the top-right corner with:
   - Alert title and severity icon
   - "Go to alerts" button (links to `/alerts`)
   - "Mark as read" button
   - "Dismiss" (X) button
   - Auto-dismiss after 8 seconds
3. Style: card with border, small shadow, slide-in from the right
4. Stack multiple notifications if several alerts arrive

Alternatively, create a reusable `AlertNotification` component in `src/components/` that can be used across pages.

### 5E — Fix Mobile Menu Z-Index Conflict

The Header hamburger button opens the Sidebar drawer, but the sidebar overlay backdrop has `z-40` — same as `MobileBottomNav`. This means the bottom nav bar covers part of the overlay.

**Fix in `Sidebar.tsx`:**
- Change the mobile overlay backdrop from `z-40` to `z-[45]` (higher than bottom nav's `z-40`)
- Or change the sidebar itself to `z-[55]` and backdrop to `z-[45]`

**Fix in `MobileBottomNav.tsx`:**
- Verify the "More" button's sheet overlay also uses proper z-index stacking

### 5F — Clean Up Trend Arrow Indicators

The `ArrowUpRight` / `ArrowDownRight` icons from lucide-react are technically correct but may look too "AI-generated" in their current styling. Make them more professional:

1. **Reduce icon size** — from `h-4 w-4` to `h-3 w-3` in trend badges
2. **Use simpler icons** — replace `ArrowUpRight`/`ArrowDownRight` with `ChevronUp`/`ChevronDown` or `TrendingUp`/`TrendingDown` (already imported). Simpler = more professional.
3. **Tone down the trend badge** — remove any background color or reduce opacity. A small colored text `+5.2%` with a tiny chevron is more professional than a colored pill with an arrow.
4. **Consistency** — use the SAME icon pair across ALL trend indicators (KPI cards, hero card, expected balance badge). Currently different sections use different icon pairs.

---

## PROCESSING ORDER

Process in this exact order. Run `npx tsc --noEmit` after each group.

### Round 0 — Critical Functional Bugs (fix FIRST — these block users)
1. ALL modal files — Fix `overflow-hidden` → `max-h-[85vh] overflow-y-auto` (5A)
2. `src/index.css` — Fix scroll-reveal fallback, card-glow overflow (1A, 1B)
3. `src/pages/DashboardPage.tsx` — Fix number visibility, remove `truncate` on KPI values (1C, 1D)
4. Verify: Open dashboard, confirm numbers visible. Open any create form, confirm scrollable.

### Round 1 — Dashboard Features
5. `src/api/dashboard.ts` — Add `subscriptionsSummary()` method, update `UpcomingPaymentItem` type (5B, 5C)
6. `src/pages/DashboardPage.tsx` — Add SubscriptionsWidget, add subscription to UpcomingPayments, add alert popup (5B, 5C, 5D)
7. `src/components/layout/Sidebar.tsx` — Fix z-index for mobile overlay (5E)
8. `src/components/layout/MobileBottomNav.tsx` — Verify "More" sheet works (5E)

### Round 2 — Neon Glow Removal (7 files)
9. `src/pages/AlertsPage.tsx` — Remove 3 neon glows, improve alert card design (Issue 3)
10. `src/pages/CategoriesPage.tsx` — Remove 4 colored shadows
11. `src/pages/BalancePage.tsx` — Remove neon dot
12. `src/pages/InstallmentsPage.tsx` — Remove progress bar glow, replace hardcoded hex
13. `src/pages/ForecastPage.tsx` — Remove tooltip glow, replace 9+ hardcoded hex
14. `src/pages/LoansPage.tsx` — Replace PIE_COLORS hex
15. `src/pages/SettingsPage.tsx` — Replace colored button shadows

### Round 3 — Auth & Onboarding Cleanup (3 files)
16. `src/pages/LoginPage.tsx` — Remove duplicate radial-gradient, floating shapes
17. `src/pages/RegisterPage.tsx` — Same + fix password strength colors
18. `src/pages/OnboardingPage.tsx` — Reduce confetti colors

### Round 4 — Visual Polish
19. `src/components/layout/Sidebar.tsx` — Replace Tailwind color classes with CSS vars
20. ALL pages — Replace `border-red-400` / `text-red-500` with CSS variable approach
21. DashboardPage.tsx — Clean up trend arrow icons (5F)
22. `src/index.css` — Dead keyframes removal, dark mode vars, CSS cleanup (4A-4E)

### Round 5 — Final Verification
23. `npx tsc --noEmit` — 0 errors
24. `npm run build` — 0 errors
25. Visual check: dashboard numbers visible, subscriptions widget present, modals scrollable
26. Dark mode check: everything readable
27. Mobile check: bottom toolbar works, sidebar drawer opens, modals are bottom-sheets

---

## CRITICAL RULES — NEVER BREAK THESE

1. **`import type`** — ALL type-only imports MUST use `import type { ... }`
2. **Error safety** — NEVER render error objects in JSX. Always use `getApiErrorMessage(err)`
3. **RTL** — ALL directional properties use logical variants (ps, pe, ms, me, start, end)
4. **No hardcoded hex in JSX** — Use CSS variables (except `COLOR_PALETTE` in CategoriesPage)
5. **Dark mode** — EVERY visual change must look good in both light AND dark mode
6. **Reduced motion** — ALL animations must be disabled under `prefers-reduced-motion: reduce`
7. **`tabular-nums`** — ALL financial numbers must have this class
8. **TypeScript** — Zero errors after every file change
9. **No new dependencies** — No Framer Motion, no GSAP, no new packages
10. **NO NEON GLOWS** — `boxShadow` must only use `rgba(0,0,0,X)`. No colored shadows anywhere.
11. **NO INLINE GRADIENTS** — Zero `linear-gradient` or `radial-gradient` in JSX/TSX inline styles. CSS classes in index.css are acceptable if subtle.
12. **MAX 3 ACCENT COLORS PER PAGE** — brand (`--color-brand-500`), income (`--color-income`), expense (`--color-expense`). Everything else uses gray/neutral.
13. **SOLID OVER GRADIENT** — When choosing between a gradient and a solid color, always choose solid.
14. **SUBTLE OVER FLASHY** — Shadows: max 0.15 opacity. Hover effects: max 2px translate. Borders: max 0.2 opacity.

---

## WHAT "DONE" LOOKS LIKE

### Functional (must all work):
- [ ] Dashboard: ALL numbers visible (balance, income, expenses, net, forecast, category totals)
- [ ] Dashboard: Numbers animate from 0 on load (useCountUp working)
- [ ] Dashboard: Numbers NOT truncated/clipped — full amounts show
- [ ] Dashboard: Subscriptions widget present with active count and monthly cost
- [ ] Dashboard: Upcoming payments includes subscriptions with next renewal dates
- [ ] Dashboard: Alert popup appears at top-right when unread alerts exist
- [ ] ALL modals: Can scroll form content on mobile and desktop (no clipping)
- [ ] Mobile: Bottom toolbar "More" button opens secondary nav sheet
- [ ] Mobile: Header hamburger opens sidebar drawer (z-index correct)

### Visual (must look professional):
- [ ] Zero neon/colored glow shadows in entire codebase
- [ ] Zero inline radial-gradient in TSX files
- [ ] Zero hardcoded hex colors in TSX (except CategoriesPage color picker)
- [ ] Zero Tailwind color classes like `text-red-500` or `bg-red-500` — all use CSS variables
- [ ] Trend arrows: consistent, small, professional (no vibecode arrows)
- [ ] Password strength: 3 colors max (danger, neutral, success)
- [ ] Auth pages: no floating animated shapes, clean single-tone background
- [ ] Sidebar: all colors from CSS variables
- [ ] Dark mode: all text readable, all backgrounds correct
- [ ] MAX 3 accent colors per page

### Build:
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors
