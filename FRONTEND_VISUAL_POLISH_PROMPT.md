# FRONTEND VISUAL POLISH — Kill the Vibecode

## Mission

The app looks like a toy. Too many colors, too many decorative elements. After this pass, it should look like **Agicap**, **Wave**, or **Stripe Dashboard** — muted, professional, restrained. A financial tool, not a game.

**Golden Rule:** If a visual element doesn't help the user understand their money, remove it.

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

---

## THE PROBLEM: COLOR OVERLOAD

### Current Color Count Per Page

| Page | Distinct Accent Colors | Max Allowed | Status |
|------|----------------------|-------------|--------|
| Dashboard | 7+ (brand, income, expense, warning, info, success + 5 health score colors) | 3 | 🔴 |
| Forecast | 3 base × 4 opacity levels = 12 visual shades | 3 | 🔴 |
| Loans | 4+ (brand, success, warning, expense + PIE colors) | 3 | 🔴 |
| Installments | 4 (brand, success, warning, expense) | 3 | 🟡 |
| Alerts | 3 (danger, warning, info) | 3 | ✅ |
| Balance | 3 (income, expense, brand) | 3 | ✅ |
| Categories | 10+ preset colors | 6-8 max | 🔴 |
| Settings | 4+ (brand, info, warning, danger, cyan for exchange) | 3 | 🟡 |

### The 3-Color Rule

Every page MUST use at most **3 accent colors**:
1. **Brand** — `var(--color-brand-500)` — for primary actions, active states, navigation
2. **Positive** — `var(--color-income)` — for income, success, positive changes
3. **Negative** — `var(--color-expense)` — for expenses, danger, negative changes

Everything else uses **gray/neutral**: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`, `var(--bg-hover)`, `var(--border-primary)`.

**Warning/Amber (`var(--color-warning)`)** — ONLY use where truly necessary (e.g., "approaching limit" alerts). Do NOT use for regular status indicators.

---

## PRIORITY 1 — FORECAST BAR CHART (BIGGEST ISSUE)

### Problem
All expense categories in the stacked bar chart are the same red (#F43F5E) with different opacities. User cannot distinguish between fixed expenses, installments, loan payments, and one-time expenses. Same issue with income (all green).

### Location
`src/pages/ForecastPage.tsx` — Lines ~1173-1181

### Current Code (BROKEN)
```tsx
<Bar dataKey="fixedExpenses" stackId="expense" fill="var(--color-expense)" fillOpacity={1} />
<Bar dataKey="installmentExpenses" stackId="expense" fill="var(--color-expense)" fillOpacity={0.6} />
<Bar dataKey="loanPayments" stackId="expense" fill="var(--color-expense)" fillOpacity={0.3} />
<Bar dataKey="oneTimeExpenses" stackId="expense" fill="var(--color-expense)" fillOpacity={0.15} />
```

### Fix: Use Monochromatic Palette with Saturation Differences

Instead of opacity (which makes bars look faded/broken), use a single hue at different saturation levels. Define these CSS variables in `src/index.css`:

```css
:root {
  /* Expense shades — monochromatic rose/red */
  --chart-expense-1: oklch(0.55 0.22 12);   /* Darkest — fixed expenses */
  --chart-expense-2: oklch(0.62 0.18 12);   /* Medium-dark — installments */
  --chart-expense-3: oklch(0.70 0.14 12);   /* Medium — loan payments */
  --chart-expense-4: oklch(0.80 0.08 12);   /* Lightest — one-time */

  /* Income shades — monochromatic green */
  --chart-income-1: oklch(0.55 0.17 160);
  --chart-income-2: oklch(0.62 0.14 160);
  --chart-income-3: oklch(0.70 0.10 160);
  --chart-income-4: oklch(0.80 0.06 160);
}

.dark {
  --chart-expense-1: oklch(0.72 0.20 12);
  --chart-expense-2: oklch(0.64 0.16 12);
  --chart-expense-3: oklch(0.56 0.12 12);
  --chart-expense-4: oklch(0.48 0.08 12);

  --chart-income-1: oklch(0.72 0.16 160);
  --chart-income-2: oklch(0.64 0.13 160);
  --chart-income-3: oklch(0.56 0.09 160);
  --chart-income-4: oklch(0.48 0.06 160);
}
```

Then update the bars:
```tsx
<Bar dataKey="fixedExpenses" stackId="expense" fill="var(--chart-expense-1)" />
<Bar dataKey="installmentExpenses" stackId="expense" fill="var(--chart-expense-2)" />
<Bar dataKey="loanPayments" stackId="expense" fill="var(--chart-expense-3)" />
<Bar dataKey="oneTimeExpenses" stackId="expense" fill="var(--chart-expense-4)" />

<Bar dataKey="fixedIncome" stackId="income" fill="var(--chart-income-1)" />
<Bar dataKey="installmentIncome" stackId="income" fill="var(--chart-income-2)" />
<Bar dataKey="expectedIncome" stackId="income" fill="var(--chart-income-3)" />
<Bar dataKey="oneTimeIncome" stackId="income" fill="var(--chart-income-4)" />
```

**IMPORTANT:** If `oklch()` doesn't work in Recharts SVG, use hex fallbacks:
```css
:root {
  --chart-expense-1: #D6336C;
  --chart-expense-2: #E8608C;
  --chart-expense-3: #F08DAA;
  --chart-expense-4: #F7BED0;

  --chart-income-1: #0D9668;
  --chart-income-2: #34B88A;
  --chart-income-3: #6DD4AE;
  --chart-income-4: #A7EDCE;
}
```

Also update the chart **Legend** and **Tooltip** to use proper names:
```tsx
<Legend
  formatter={(value: string) => {
    const LABELS: Record<string, string> = {
      fixedExpenses: t('forecast.fixedExpenses'),
      installmentExpenses: t('forecast.installmentExpenses'),
      loanPayments: t('forecast.loanPayments'),
      oneTimeExpenses: t('forecast.oneTimeExpenses'),
      fixedIncome: t('forecast.fixedIncome'),
      installmentIncome: t('forecast.installmentIncome'),
      expectedIncome: t('forecast.expectedIncome'),
      oneTimeIncome: t('forecast.oneTimeIncome'),
    }
    return LABELS[value] ?? value
  }}
/>
```

---

## PRIORITY 2 — DASHBOARD: REDUCE HEALTH SCORE COLORS

### Problem
The Financial Health Score widget uses 5 distinct colors: green, light green, amber, orange, red. This creates visual noise.

### Fix: Reduce to 3 Colors

In `DashboardPage.tsx`, find the health score color logic and simplify:

```typescript
function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--color-income)'   // Good — green
  if (score >= 40) return 'var(--text-tertiary)'   // Neutral — gray
  return 'var(--color-expense)'                     // Bad — red
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'var(--bg-success)'
  if (score >= 40) return 'var(--bg-hover)'
  return 'var(--bg-danger)'
}
```

Remove the 5 separate `--color-score-*` variables if they exist. Three states (good/neutral/bad) are enough for a financial health indicator.

---

## PRIORITY 3 — ALL PAGES: REDUCE STATUS BADGE COLORS

### Problem
Status badges across pages use 4+ colors: green (completed), blue (active), amber (pending/paused), red (danger). This is standard but contributes to the "toy" feel.

### Fix: Mute the Status Badges

Instead of bold background colors, use **subtle text-only badges** with a thin border:

```tsx
// BEFORE (colorful):
<span style={{ backgroundColor: 'var(--bg-success)', color: 'var(--color-success)' }}>
  {t('status.completed')}
</span>

// AFTER (professional):
<span style={{
  color: 'var(--color-income)',
  border: '1px solid currentColor',
  borderRadius: '9999px',
  padding: '2px 10px',
  fontSize: '11px',
  fontWeight: 600,
  opacity: 0.8,
}}>
  {t('status.completed')}
</span>
```

Apply this pattern to **ALL** status badges in:
- `LoansPage.tsx` — loan status (active/completed/paused)
- `InstallmentsPage.tsx` — payment status (completed/active/pending)
- `SubscriptionsPage.tsx` — subscription status
- `FixedPage.tsx` — fixed income/expense status

**Color mapping for status badges:**
- Active/In Progress → `var(--color-brand-500)` (brand blue)
- Completed/Paid → `var(--color-income)` (green)
- Paused/Pending → `var(--text-tertiary)` (gray — NOT amber)
- Cancelled/Error → `var(--color-expense)` (red)

**Key change:** Paused/Pending should be **gray**, not amber. Amber is too attention-grabbing for a passive state.

---

## PRIORITY 4 — SETTINGS PAGE: REDUCE COLORS

### Problem
Settings page has 4+ accent colors for different section icons (brand, warning, cyan, danger). The exchange rate widget uses a custom cyan color.

### Fix

1. **All section icons** — Use ONE color: `var(--color-brand-500)`. Not a different color per section.

2. **Exchange Rate Widget** (lines ~696-698):
```tsx
// BEFORE:
style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)' }}
<ArrowRightLeft style={{ color: 'rgb(6, 182, 212)' }} />

// AFTER:
style={{ backgroundColor: 'var(--bg-info)' }}
<ArrowRightLeft style={{ color: 'var(--color-brand-500)' }} />
```

3. **Danger zone (account section)** — Keep red only for the logout button. Everything else brand-colored.

---

## PRIORITY 5 — LOANS PIE CHART

### Problem
The pie chart for Principal vs Interest uses brand + amber. Two-slice pie charts look awkward.

### Fix
Replace pie chart with a **simple progress bar** or **two-stat row**:

```tsx
// Instead of a pie chart:
<div className="flex items-center gap-3">
  <div className="flex-1">
    <div className="flex justify-between text-xs mb-1">
      <span style={{ color: 'var(--text-secondary)' }}>{t('loans.principal')}</span>
      <span style={{ color: 'var(--text-primary)' }}>{formatAmount(principal)}</span>
    </div>
    <div className="h-2 w-full rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${principalPercent}%`,
          backgroundColor: 'var(--color-brand-500)',
        }}
      />
    </div>
  </div>
</div>
```

This is simpler, uses fewer colors, and communicates the same information.

---

## PRIORITY 6 — CATEGORIES: LIMIT COLOR PALETTE

### Problem
10 preset colors + unlimited custom color picker = visual chaos when user has many categories.

### Fix
Reduce `PRESET_COLORS` in `CategoriesPage.tsx` from 10 to **6**:

```typescript
const PRESET_COLORS = [
  '#635BFF', // brand (indigo)
  '#10B981', // income (green)
  '#F43F5E', // expense (rose)
  '#6B7280', // neutral (gray)
  '#06B6D4', // info (teal)
  '#F59E0B', // accent (amber)
]
```

Remove the custom color picker entirely, or hide it behind an "Advanced" toggle.

---

## PRIORITY 7 — TREND ARROWS: CONSISTENCY

### Problem
`BalancePage.tsx` still uses `ArrowUpRight`/`ArrowDownRight`. DashboardPage uses `TrendingUp`/`TrendingDown`. Inconsistent.

### Fix
Replace ALL trend icons across ALL pages with the SAME pair: `TrendingUp` / `TrendingDown`.

Files to check:
- `BalancePage.tsx` (lines ~31-32, ~662, ~850)
- `DashboardPage.tsx` — already uses TrendingUp/TrendingDown ✅
- Any other page with trend indicators

---

## PRIORITY 8 — REMOVE SPARKLES ICON

The `Sparkles` icon (✨) is the universal "AI-generated" signal. Replace it everywhere:

| File | Current | Replacement |
|------|---------|-------------|
| `SettingsPage.tsx` line ~1152 | `<Sparkles>` label icon | Remove entirely or use `<Palette>` |
| `CategoriesPage.tsx` line ~876 | `<Sparkles>` icon picker | Use `<Grid3X3>` or `<Shapes>` |
| `ForecastPage.tsx` | `<Sparkles>` scenario indicator | Use `<Sliders>` or `<BarChart3>` |
| `DashboardPage.tsx` | `<Sparkles>` in alert popup | Use `<Bell>` |

---

## PRIORITY 9 — GENERAL CLEANUP

### 9A — Remove decorative shadows from buttons

Buttons with `boxShadow: '0 4px 14px rgba(0,0,0,0.1)'` look toyish. Replace with:
```tsx
boxShadow: 'var(--shadow-xs)'  // or remove entirely
```

### 9B — Reduce card border opacity

If any card borders use `border-opacity > 0.2`, reduce them. Professional apps have barely-visible borders.

### 9C — KPI Cards: Remove `truncate` Class

In `DashboardPage.tsx`, KPI number values have `truncate` class that may clip large amounts. Replace with responsive font sizing:

```tsx
// BEFORE:
className="fin-number text-2xl ltr-nums mt-1 leading-tight truncate"

// AFTER:
className="fin-number text-xl sm:text-2xl ltr-nums mt-1 leading-tight"
```

### 9D — Reduce animation intensity

- Remove `animate-ping` on any element (currently on currency warning icon pulse ring in SettingsPage)
- Reduce any `transition-all duration-300` to `transition-colors duration-200` where the `all` is unnecessary

---

## PROCESSING ORDER

Execute in this order. Run `npx tsc --noEmit` after each step.

1. **ForecastPage.tsx** + **index.css** — Fix bar chart colors (Priority 1)
2. **DashboardPage.tsx** — Reduce health score to 3 colors (Priority 2)
3. **LoansPage.tsx, InstallmentsPage.tsx, SubscriptionsPage.tsx, FixedPage.tsx** — Mute status badges (Priority 3)
4. **SettingsPage.tsx** — Unify section colors, fix exchange widget (Priority 4)
5. **LoansPage.tsx** — Replace pie chart with progress bar (Priority 5)
6. **CategoriesPage.tsx** — Reduce preset colors to 6 (Priority 6)
7. **BalancePage.tsx** — Fix trend arrows (Priority 7)
8. **All files** — Replace Sparkles icon (Priority 8)
9. **All files** — General cleanup (Priority 9)
10. **Final** — `npx tsc --noEmit` && `npm run build` — 0 errors

---

## CRITICAL RULES — NEVER BREAK THESE

1. **`import type`** — ALL type-only imports MUST use `import type { ... }`
2. **Error safety** — NEVER render error objects in JSX. Always use `getApiErrorMessage(err)`
3. **RTL** — ALL directional properties use logical variants (ps, pe, ms, me, start, end)
4. **MAX 3 accent colors per page** — brand, income, expense. Everything else gray.
5. **Dark mode** — EVERY visual change must work in both light AND dark mode
6. **No new dependencies** — No new packages allowed
7. **MUTED > COLORFUL** — When in doubt, use gray/neutral instead of a color
8. **SOLID > GRADIENT** — Always choose solid colors over gradients
9. **SUBTLE > FLASHY** — Shadows max 0.1 opacity. Borders max 0.15 opacity.
10. **No `Sparkles` icon** — Replace every instance with a neutral icon

---

## WHAT "DONE" LOOKS LIKE

### Visual (must all pass):
- [ ] Forecast bar chart: each expense type has a DISTINCT shade (not same red at different opacities)
- [ ] Dashboard health score: uses only 3 colors (green/gray/red)
- [ ] Status badges across ALL pages: muted, text-only with thin border (no bold backgrounds)
- [ ] Settings page: ONE accent color for all section icons
- [ ] Loans page: NO pie chart — replaced with progress bar
- [ ] Category preset colors: MAX 6 colors
- [ ] Trend arrows: SAME icon pair across ALL pages (TrendingUp/TrendingDown)
- [ ] Zero `Sparkles` icon anywhere in the codebase
- [ ] No `animate-ping` anywhere
- [ ] Professional overall feel — "boring" is better than "colorful"

### Build:
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 0 errors

### Color Audit (run these checks):
```bash
# Should return ZERO results (no vibecode icons):
grep -rn "Sparkles" src/pages/ src/components/

# Count distinct CSS color variables used per page (should be ≤ 5 per page):
grep -on "var(--color-[^)]*)" src/pages/DashboardPage.tsx | sort -u | wc -l
```
