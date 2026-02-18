# Finebank UI Kit — Design Direction & Implementation Prompts

## מה זה הקובץ הזה?

אני רוצה שה-Cashflow.ai app שלנו ייראה **בדיוק כמו Finebank UI Kit** — Financial Management Dashboard.

**מקור:** https://www.figma.com/community/file/1227525441534506928
**קובץ .fig בהורדות:** `~/Downloads/Finebank-Financial-Management-Dashboard.fig`

הקובץ הזה מכיל:
1. **Design Brief** — הכיוון העיצובי המלא של Finebank
2. **סדרת פרומפטים ל-Mode 2** — מוכנים להעתקה ישירה לארכיטקט/frontend-design

---

## PART A — Design Brief (הכיוון)

### הזהות של Finebank

Finebank הוא UI Kit לדשבורדים פיננסיים עם שפה עיצובית מאוד ספציפית: **פינות מאוד מעוגלות, צללים רכים ומפוזרים, sidebar כהה, רקע בהיר-סגלגל, ואווירה של "premium fintech"**. זה נקי, מרווח, לא צפוף, עם היררכיה טיפוגרפית ברורה.

### מה משתנה מהעיצוב הנוכחי שלנו

| אלמנט | עכשיו | Finebank |
|--------|--------|----------|
| **Brand Color** | `#635BFF` (Indigo) | `#4318FF` (Violet-Blue — יותר עמוק) |
| **Background** | `#FAFAFA` (אפור ניטרלי) | `#F4F7FE` (אפור-כחלחל — הסימן המסחרי של Finebank) |
| **Card radius** | `14px` | `20px` (פינות מאוד מעוגלות) |
| **Shadow** | subtle multi-layer | `0px 18px 40px rgba(112,144,176,0.12)` — רך ומפוזר |
| **Font** | Inter + Heebo | **DM Sans** + Heebo (לעברית) |
| **Sidebar** | `#09090B` (שחור מוצק) | Gradient `#1A1F37` → `#111C44` (כחול-כהה) |
| **Dark BG** | `#09090B` (שחור) | `#111C44` (Navy כהה) |
| **Dark Card** | `#111113` | `#1B254B` (Navy) |
| **Income green** | `#10B981` | `#05CD99` (טורקיז-ירוק בהיר יותר) |
| **Expense red** | `#F43F5E` (Rose) | `#EE5D50` (Coral — חם יותר) |
| **Warning** | `#F59E0B` | `#FFB547` (יותר בהיר) |
| **Text secondary** | `#52525B` (Zinc) | `#A3AED0` (Lavender-gray) |
| **Accent count** | 5 (teal, purple, amber, cyan, magenta) | **2-3 max** (violet, teal, accent) |
| **Button radius** | `10px` | `16px` |
| **Input radius** | `10px` | `12px` |
| **Badge radius** | `6px` | `10px` |

### פלטת Finebank המלאה

```
PRIMARY:
  --finebank-primary:       #4318FF   (main accent — buttons, links, active states)
  --finebank-primary-light: #868CFF   (hover, secondary accents)
  --finebank-primary-bg:    rgba(67, 24, 255, 0.08)   (active item backgrounds)

NAVY (Sidebar & Dark Mode):
  --finebank-navy-900:      #1A1F37   (sidebar top)
  --finebank-navy-800:      #111C44   (sidebar bottom, dark mode bg)
  --finebank-navy-700:      #1B254B   (dark mode cards)
  --finebank-navy-600:      #2D3250   (dark mode hover)

BACKGROUNDS:
  --finebank-bg-light:      #F4F7FE   (main background — light mode)
  --finebank-bg-card:       #FFFFFF   (card background)
  --finebank-bg-sidebar:    linear-gradient(180deg, #1A1F37 0%, #111C44 100%)

TEXT:
  --finebank-text-primary:  #2B3674   (headings, bold text — dark blue)
  --finebank-text-secondary:#A3AED0   (labels, descriptions — lavender gray)
  --finebank-text-tertiary: #8F9BBA   (placeholders)
  --finebank-text-on-dark:  #FFFFFF   (text on dark backgrounds)

FINANCIAL:
  --finebank-income:        #05CD99   (success/income — turquoise green)
  --finebank-expense:       #EE5D50   (danger/expense — warm coral)
  --finebank-warning:       #FFB547   (warning — warm yellow)

CHARTS:
  --finebank-chart-1:       #4318FF   (primary violet)
  --finebank-chart-2:       #05CD99   (green)
  --finebank-chart-3:       #EE5D50   (red/coral)
  --finebank-chart-4:       #FFB547   (yellow)
  --finebank-chart-5:       #868CFF   (light violet)
  --finebank-chart-6:       #6AD2FF   (light blue)
```

### טיפוגרפיה

```css
/* Primary Font */
font-family: 'DM Sans', 'Heebo', system-ui, -apple-system, sans-serif;

/* Hierarchy */
h1: 34px / bold / #2B3674
h2: 24px / bold / #2B3674
h3: 18px / semibold / #2B3674
body: 14px / regular / #2B3674
small: 12px / medium / #A3AED0
caption: 11px / regular / #A3AED0

/* Financial Numbers */
font-variant-numeric: tabular-nums;
font-weight: 700 (bold for big numbers), 500 (medium for table values)
```

### Shadows

```css
/* Finebank signature shadow — soft & diffused */
--shadow-card:     0px 18px 40px rgba(112, 144, 176, 0.12);
--shadow-hover:    0px 21px 44px rgba(112, 144, 176, 0.18);
--shadow-sm:       0px 3.5px 5.5px rgba(0, 0, 0, 0.02);
--shadow-dropdown: 0px 40px 58px -16px rgba(112, 144, 176, 0.26);

/* Dark mode shadows */
--shadow-card-dark:  0px 18px 40px rgba(0, 0, 0, 0.30);
--shadow-hover-dark: 0px 21px 44px rgba(0, 0, 0, 0.40);
```

### Border Radius

```css
--radius-card:    20px;    /* Cards — המאפיין הבולט של Finebank */
--radius-btn:     16px;    /* Buttons */
--radius-input:   12px;    /* Input fields */
--radius-badge:   10px;    /* Tags, badges, pills */
--radius-avatar:  9999px;  /* Circular */
--radius-chart:   16px;    /* Chart containers */
```

### Component Patterns של Finebank

**KPI Cards:**
- Card לבן, radius 20px, shadow רך
- בצד שמאל: אייקון בתוך עיגול צבעוני (gradient עדין)
- מספר גדול bold (24-34px) בצבע `#2B3674`
- תיאור קטן מתחת (12px, `#A3AED0`)
- פינה ימנית עליונה: trend arrow (▲ ירוק / ▼ אדום) + אחוז

**Sidebar:**
- Gradient כהה (navy)
- Logo/שם בראש
- פריטי ניווט: אייקון + טקסט, רווח נדיב
- פריט פעיל: רקע `rgba(67,24,255,0.1)` + פס שמאלי/ימני (RTL) `#4318FF`
- Separator lines דקים בין סקציות
- User avatar + name בתחתית

**Tables:**
- Card wrapper עם radius 20px
- Header row: text `#A3AED0`, font-weight 500, uppercase, letter-spacing 0.5px
- Body rows: text `#2B3674`, hover bg `#F4F7FE`
- Status badges: pill shape (radius 10px), רקע שקוף צבעוני
- No visible borders between rows — רק hover effect ו-subtle separator

**Charts:**
- Container: card wrapper, radius 20px
- Title + period selector (dropdown) בכותרת
- Grid lines: `rgba(163,174,208,0.1)` — כמעט שקוף
- Tooltip: card with shadow, radius 12px
- Legend: simple dots + text, horizontal

---

## PART B — סדרת פרומפטים ל-Mode 2

העתק כל פרומפט בנפרד לארכיטקט / ל-Claude Code. **עבוד לפי הסדר!**

---

### PROMPT 1/7 — Design System Foundation (index.css)

```
# Design System — Finebank Theme Override

## Target Files
- `src/index.css` (lines 1-220) — כל ה-CSS variables

## Design Direction
מעבר מלא לשפת Finebank: navy sidebar, bg כחלחל, פינות מעוגלות 20px, shadow רך ומפוזר, DM Sans font, צבעים warmier. זה שינוי ב-CSS variables בלבד — אף קומפוננטה לא משתנה.

## Specific Changes

### 1. Add DM Sans font
**File: `index.html`** — הוסף ב-<head>:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet">
```

### 2. @theme block — Replace colors & tokens

**Replace brand colors:**
```css
/* OLD */
--color-brand-50: #EEF2FF;
--color-brand-100: #E0E7FF;
--color-brand-200: #C7D2FE;
--color-brand-300: #A5B4FC;
--color-brand-400: #818CF8;
--color-brand-500: #635BFF;
--color-brand-600: #4F46E5;
--color-brand-700: #4338CA;
--color-brand-800: #3730A3;
--color-brand-900: #312E81;

/* NEW */
--color-brand-50: #F0ECFF;
--color-brand-100: #DCD5FF;
--color-brand-200: #B9ABFF;
--color-brand-300: #968CFF;
--color-brand-400: #868CFF;
--color-brand-500: #4318FF;
--color-brand-600: #3311DB;
--color-brand-700: #2508B7;
--color-brand-800: #1B0593;
--color-brand-900: #11036B;
```

**Replace accent colors (reduce from 5 to 3):**
```css
/* OLD */
--color-accent-teal: #14B8A6;
--color-accent-purple: #8B5CF6;
--color-accent-amber: #F59E0B;
--color-accent-cyan: #00D4FF;
--color-accent-magenta: #D946EF;

/* NEW */
--color-accent-teal: #05CD99;
--color-accent-purple: #868CFF;
--color-accent-amber: #FFB547;
--color-accent-cyan: #6AD2FF;
--color-accent-magenta: #868CFF;
```

**Replace financial colors:**
```css
/* OLD */
--color-income: #10B981;
--color-expense: #F43F5E;

/* NEW */
--color-income: #05CD99;
--color-expense: #EE5D50;
```

**Replace radius system:**
```css
/* OLD */
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 20px;
--radius-2xl: 24px;

/* NEW */
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-2xl: 24px;
```

### 3. :root (Light Mode) — Replace backgrounds, text, shadows

```css
/* OLD → NEW */
--bg-primary: #FAFAFA → #F4F7FE;
--bg-secondary: #F4F4F5 → #EDF1F9;
--bg-tertiary: #F4F4F5 → #E9EDF7;
--bg-sidebar: #09090B → #1A1F37;
--bg-card: #FFFFFF → #FFFFFF;  /* stays same */
--bg-hover: #F4F4F5 → #EDF1F9;

--text-primary: #09090B → #2B3674;
--text-secondary: #52525B → #A3AED0;
--text-tertiary: #A1A1AA → #8F9BBA;
--text-sidebar: #71717A → #A3AED0;

--border-primary: #E4E4E7 → #E2E8F0;
--border-focus: #635BFF → #4318FF;

--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04) → 0px 3.5px 5.5px rgba(0, 0, 0, 0.02);
--shadow-sm: ... → 0px 5px 14px rgba(112, 144, 176, 0.08);
--shadow-md: ... → 0px 18px 40px rgba(112, 144, 176, 0.12);
--shadow-lg: ... → 0px 21px 44px rgba(112, 144, 176, 0.18);
--shadow-xl: ... → 0px 40px 58px rgba(112, 144, 176, 0.26);

--color-success: #10B981 → #05CD99;
--color-warning: #F59E0B → #FFB547;
--color-danger: #F43F5E → #EE5D50;
--color-info: #635BFF → #4318FF;

--bg-success: rgba(16, 185, 129, 0.08) → rgba(5, 205, 153, 0.1);
--bg-danger: rgba(244, 63, 94, 0.08) → rgba(238, 93, 80, 0.1);
--bg-warning: rgba(245, 158, 11, 0.08) → rgba(255, 181, 71, 0.1);
--bg-info: rgba(99, 91, 255, 0.08) → rgba(67, 24, 255, 0.08);

--chart-primary: #635BFF → #4318FF;
--chart-secondary: #00D4FF → #6AD2FF;
--chart-tertiary: #D946EF → #868CFF;
--chart-income: #10B981 → #05CD99;
--chart-expense: #F43F5E → #EE5D50;
--chart-warning: #F59E0B → #FFB547;

--gradient-brand: linear-gradient(135deg, #00D4FF, #635BFF, #D946EF)
  → linear-gradient(135deg, #868CFF, #4318FF);
```

### 4. .dark — Replace dark mode colors

```css
/* OLD → NEW */
--bg-primary: #09090B → #111C44;
--bg-secondary: #111113 → #1B254B;
--bg-tertiary: #18181B → #2D3250;
--bg-sidebar: #09090B → #111C44;
--bg-card: #111113 → #1B254B;
--bg-hover: #1F1F23 → #2D3250;

--text-primary: #FAFAFA → #FFFFFF;
--text-secondary: #A1A1AA → #A3AED0;
--text-tertiary: #71717A → #8F9BBA;

--border-primary: rgba(255, 255, 255, 0.10) → rgba(255, 255, 255, 0.08);
```

### 5. Font update — Typography base

**In the `html` / `body` rules (around line 221+), replace:**
```css
/* OLD */
font-family: 'Inter', 'Heebo', system-ui, -apple-system, sans-serif;

/* NEW */
font-family: 'DM Sans', 'Heebo', system-ui, -apple-system, sans-serif;
```

Keep Heebo as fallback for Hebrew characters.

## Rules
- All colors MUST use CSS variables (no hardcoded hex in JSX)
- Both light and dark mode must be updated
- RTL layout must not break
- Do NOT change any component files in this prompt
- Only change `index.css` and `index.html`

## Validation
- [ ] Light mode: background is soft blue-gray (#F4F7FE), not flat gray
- [ ] Dark mode: background is navy (#111C44), not pure black
- [ ] DM Sans font loads correctly
- [ ] All cards have softer, more diffused shadows
- [ ] Brand accent is deeper violet (#4318FF)
- [ ] Income green is turquoise-tinted (#05CD99)
- [ ] Expense red is warm coral (#EE5D50)
- [ ] `npm run build` succeeds with no errors
```

---

### PROMPT 2/7 — Sidebar + Layout

```
# Sidebar & AppLayout — Finebank Navy Style

## Target Files
- `src/components/layout/Sidebar.tsx` — Sidebar redesign
- `src/components/layout/AppLayout.tsx` — Background update
- `src/components/layout/Header.tsx` — Header cleanup
- `src/index.css` — Add sidebar-specific styles if needed

## Design Direction
Sidebar הופך ל-navy gradient כהה בסגנון Finebank. Content area background הוא #F4F7FE (כבר מוגדר ב-variables). Active state עם פס צד ו-bg שקוף סגול.

## Specific Changes

### Sidebar.tsx
1. **Container background:**
   - Light: `background: linear-gradient(180deg, var(--bg-sidebar) 0%, #111C44 100%)`
   - Dark: same gradient (sidebar is always dark in Finebank)
   - Border-radius: `0` (sidebar מודבק לקצה)

2. **Logo area (top):**
   - Logo/app name "Cashflow.ai" in white, DM Sans Bold, 20px
   - Padding: `24px`

3. **Nav items:**
   - Default: icon + text in `#A3AED0`, padding `12px 24px`, gap 12px between icon and text
   - Hover: bg `rgba(255,255,255,0.06)`, text stays `#A3AED0`, border-radius `12px`
   - Active: bg `rgba(67, 24, 255, 0.15)`, text `#FFFFFF`, icon `#FFFFFF`
   - Active indicator: 3px solid bar on inline-end side (right in RTL) colored `#4318FF`
   - Icon size: 20px
   - Font: 14px medium

4. **Section separators:**
   - Thin line: `border-top: 1px solid rgba(255,255,255,0.08)`
   - Margin: `12px 24px`

5. **User section (bottom):**
   - Avatar (40px circle) + name (white 14px) + role (12px #A3AED0)
   - Padding: `20px 24px`
   - Separator line above

### AppLayout.tsx
- Content area: `bg-[var(--bg-primary)]` (which is now #F4F7FE)
- Padding: `24px` on desktop, `16px` on mobile

### Header.tsx
- Clean/minimal — no heavy decoration
- Page title: DM Sans Bold, 24px, `var(--text-primary)`
- Breadcrumb or subtitle: 14px, `var(--text-secondary)`

## Rules
- Sidebar is ALWAYS dark (even in light mode) — Finebank pattern
- RTL: active indicator bar is on the RIGHT side (inline-end)
- Collapsed sidebar: only icons, tooltip on hover
- Do NOT change navigation logic, routes, or active state detection
- Only change visual classes and inline styles

## Validation
- [ ] Sidebar has navy gradient background
- [ ] Active item has violet highlight + white text + side bar indicator
- [ ] Hover state is subtle white overlay
- [ ] Content area background is soft blue-gray
- [ ] RTL: sidebar on right, indicator bar on right
- [ ] Collapsed mode still looks good
- [ ] Mobile nav still works
```

---

### PROMPT 3/7 — Dashboard Page

```
# Dashboard — Finebank KPI Cards + Charts

## Target Files
- `src/pages/DashboardPage.tsx` — Main dashboard layout
- `src/components/dashboard/FinancialHealthWidget.tsx`
- `src/components/dashboard/MonthlyComparisonChart.tsx`
- `src/components/dashboard/TopExpensesWidget.tsx`
- `src/components/dashboard/InstallmentsSummaryWidget.tsx`
- `src/components/dashboard/LoansSummaryWidget.tsx`

## Design Direction
דשבורד Finebank: KPI cards עם אייקונים בעיגולים צבעוניים, מספרים גדולים ב-bold, trend indicators. כל card עם radius 20px ו-shadow רך. Charts נקיים עם grid lines כמעט שקופים.

## Specific Changes

### DashboardPage.tsx
1. **Page title:** "לוח מחוונים" — 34px bold, `var(--text-primary)`
2. **Grid layout:**
   - KPI row: 4 columns on desktop, 2 on tablet, 1 on mobile
   - Charts: 2 columns, full width on mobile
3. **KPI Cards pattern:**
   - Card: `var(--bg-card)`, border-radius `var(--radius-xl)` (20px), shadow `var(--shadow-md)`
   - Left: icon in 48px circle with gradient bg (each card different color)
     - Income: gradient `linear-gradient(135deg, rgba(5,205,153,0.15), rgba(5,205,153,0.05))`
     - Expense: gradient `linear-gradient(135deg, rgba(238,93,80,0.15), rgba(238,93,80,0.05))`
     - Balance: gradient `linear-gradient(135deg, rgba(67,24,255,0.15), rgba(67,24,255,0.05))`
   - Right: big number (24px bold `var(--text-primary)`) + label (12px `var(--text-secondary)`)
   - Top-right corner: trend badge — ▲ 2.5% green or ▼ 1.3% red
4. **Card padding:** `24px`
5. **Card gap:** `20px` (gap between grid items)

### Chart Components
- **Container:** same card style (white, radius 20px, shadow)
- **Header:** card title (16px semibold) + period dropdown on same line
- **Recharts customization:**
  - Grid: `stroke="rgba(163,174,208,0.1)"` — almost invisible
  - Axis tick: `fill="var(--text-secondary)"` font-size 12px
  - Tooltip: bg white, padding 12px, border-radius 12px, shadow-md
  - No heavy borders on chart area

### FinancialHealthWidget
- Use 3-tier colors only: green (>70), gray (40-70), red (<40)
- Score number: 48px bold
- Progress ring or bar with rounded caps
- Remove any sparkle/emoji decorations

### TopExpensesWidget
- List items with subtle horizontal bars
- Bar color: `var(--color-brand-500)` with opacity variation
- Text: category name (14px, primary), amount (14px bold, primary)

## Rules
- No vibecode patterns (sparkles, neon glows, rainbow gradients)
- All colors through CSS variables
- Keep all existing data fetching, hooks, formatters
- Remove any Sparkles icons or decorative emojis if present

## Validation
- [ ] KPI cards have colored icon circles (not flat icons)
- [ ] Numbers are large and readable
- [ ] Charts have near-invisible grid lines
- [ ] Shadow is soft and diffused (Finebank signature)
- [ ] Dark mode: cards are navy (#1B254B), text is white/lavender
- [ ] No vibecode elements remain
```

---

### PROMPT 4/7 — Auth Pages (Login + Register)

```
# Auth Pages — Finebank Clean Login

## Target Files
- `src/pages/LoginPage.tsx`
- `src/pages/RegisterPage.tsx`

## Design Direction
Login/Register בסגנון Finebank: centered card על רקע #F4F7FE (light) / #111C44 (dark). Card לבן גדול עם radius 20px. Inputs עם radius 12px. Button primary בסגול #4318FF עם radius 16px.

## Specific Changes

### LoginPage.tsx + RegisterPage.tsx
1. **Full page background:** `var(--bg-primary)` (#F4F7FE)
2. **Center card:** max-width 480px, padding 40px, radius 20px, shadow-lg
3. **Logo/App name:** centered at top of card, 28px bold
4. **Title:** "התחברות" / "הרשמה" — 24px bold, `var(--text-primary)`
5. **Subtitle:** "הזן את הפרטים שלך" — 14px, `var(--text-secondary)`
6. **Form inputs:**
   - border: 1px solid `var(--border-primary)`
   - border-radius: `var(--radius-md)` (12px)
   - padding: 12px 16px
   - font-size: 14px
   - focus: border-color `var(--border-focus)`, ring 3px `rgba(67,24,255,0.1)`
   - label above: 13px medium, `var(--text-primary)`, margin-bottom 6px
7. **Primary button:**
   - bg: `var(--color-brand-500)` (#4318FF)
   - text: white, 14px semibold
   - border-radius: `var(--radius-lg)` (16px)
   - height: 48px, full width
   - hover: darken 10%
   - disabled: opacity 0.5
8. **Links:** "שכחת סיסמה?" / "אין לך חשבון?" — 14px, `var(--color-brand-500)`
9. **Remember me checkbox:** rounded checkbox style

## Rules
- Do NOT change form validation logic or submit handlers
- Dark mode card should be `var(--bg-card)` (#1B254B)
- RTL: text aligned right, labels above inputs

## Validation
- [ ] Card centered on clean background
- [ ] Inputs have 12px radius and proper focus state
- [ ] Button is deep violet with 16px radius
- [ ] Dark mode looks good
- [ ] RTL alignment correct
- [ ] Form submission still works
```

---

### PROMPT 5/7 — Tables (Transactions, Fixed, Installments, Loans, Subscriptions)

```
# Data Tables — Finebank Clean Table Style

## Target Files
- `src/pages/TransactionsPage.tsx`
- `src/pages/FixedPage.tsx`
- `src/pages/InstallmentsPage.tsx`
- `src/pages/LoansPage.tsx`
- `src/pages/SubscriptionsPage.tsx`

## Design Direction
טבלאות בסגנון Finebank: card wrapper (radius 20px), header אפור-כחלחל קטן, שורות נקיות בלי borders מוגזמים, hover עדין, status badges כ-pills עגולים. הכל רך ומרווח.

## Specific Changes

### Table Container
- Wrapped in card: bg white, radius 20px, shadow-md, padding 24px
- Title above table: 18px semibold, `var(--text-primary)`
- Filter/search bar: below title, rounded inputs

### Table Header Row
- Text: 12px, uppercase, letter-spacing 0.5px, `var(--text-secondary)`, font-weight 500
- No background — transparent
- Bottom border: 1px solid `var(--border-primary)`

### Table Body Rows
- Text: 14px, `var(--text-primary)`
- Padding: 16px per cell
- No visible borders between rows (or very subtle 1px `rgba(226,232,240,0.5)`)
- Hover: bg `var(--bg-primary)` (#F4F7FE)
- Financial numbers: font-weight 500, tabular-nums

### Status Badges (all pages)
- Border-radius: 10px (pill shape)
- Padding: 4px 12px
- Font-size: 12px, font-weight 500
- Active/Paid: bg `rgba(5,205,153,0.1)`, text `#05CD99`
- Pending: bg `rgba(255,181,71,0.1)`, text `#FFB547`
- Overdue/Paused: bg `rgba(238,93,80,0.1)`, text `#EE5D50`
- Completed: bg `rgba(163,174,208,0.1)`, text `#A3AED0`

### Pagination
- Rounded buttons, `var(--radius-md)` (12px)
- Active page: bg `var(--color-brand-500)`, text white
- Other pages: text `var(--text-secondary)`, hover bg `var(--bg-hover)`

### Income/Expense Row Indicators
- Income amounts: `var(--color-income)` (#05CD99)
- Expense amounts: `var(--color-expense)` (#EE5D50)
- Optional: thin 3px left/right border indicator on row

## Rules
- Apply consistently across ALL 5 table pages
- Keep sorting, filtering, pagination logic unchanged
- Keep modal/form functionality unchanged
- RTL: text aligned right, amounts aligned left

## Validation
- [ ] Tables wrapped in rounded cards
- [ ] Header row is subtle gray text
- [ ] Status badges are pill-shaped with transparent bg
- [ ] Hover is soft blue-gray
- [ ] Income/expense amounts clearly colored
- [ ] Dark mode: table on navy card, text in lavender/white
- [ ] All 5 pages updated consistently
```

---

### PROMPT 6/7 — Forecast, Balance, Alerts, Categories

```
# Secondary Pages — Finebank Style Consistency

## Target Files
- `src/pages/ForecastPage.tsx`
- `src/pages/BalancePage.tsx`
- `src/pages/AlertsPage.tsx`
- `src/pages/CategoriesPage.tsx`

## Design Direction
כל הדפים המשניים עוברים לשפת Finebank: cards 20px radius, shadows רכים, typography DM Sans hierarchy, alert severity עם 3 צבעים (ירוק/צהוב/אדום), categories עם icon circles.

## Specific Changes

### ForecastPage
- Chart container: card style (radius 20px, shadow-md)
- Bar chart colors: use chart palette (#4318FF, #05CD99, #EE5D50, #FFB547)
- Period tabs: rounded pill segments, active = brand-500 bg + white text
- Summary cards at top: same KPI card pattern as Dashboard

### BalancePage
- Balance hero card: large number (34px bold), trend indicator, rounded card
- History chart: soft line chart with gradient fill under the line
- Color: `var(--color-brand-500)` for line, gradient fade to transparent

### AlertsPage
- Alert cards: radius 20px, left/right (RTL) border 3px in severity color
- Severity colors:
  - Info: `var(--color-brand-500)` (#4318FF)
  - Warning: `var(--color-warning)` (#FFB547)
  - Critical: `var(--color-danger)` (#EE5D50)
- Unread indicator: small dot 8px, brand color
- Read/dismiss buttons: ghost style, subtle

### CategoriesPage
- Category items: card per category (radius 16px), icon in colored circle (40px)
- Grid: 2-3 columns
- Color picker: reduce to 6-8 colors (not 10+)
- Archive action: subtle, not scary red

## Rules
- Same card/shadow/typography system as dashboard
- Do NOT change chart data logic or API calls
- Alert filtering and dismiss logic stays same
- Category CRUD operations stay same

## Validation
- [ ] Forecast bars use Finebank chart palette
- [ ] Balance chart has gradient fill
- [ ] Alerts have colored side border
- [ ] Categories have icon circles
- [ ] Dark mode consistent
- [ ] RTL intact
```

---

### PROMPT 7/7 — Settings, Users, Backups, Organization, Onboarding

```
# Admin & Settings Pages — Finebank Polish

## Target Files
- `src/pages/SettingsPage.tsx`
- `src/pages/UsersPage.tsx`
- `src/pages/BackupsPage.tsx`
- `src/pages/OrganizationPage.tsx`
- `src/pages/OnboardingPage.tsx`

## Design Direction
דפי Admin/Settings בסגנון Finebank: sections ב-cards מעוגלים, toggles ו-selects נקיים, user avatars בעיגולים. Onboarding עם steps indicator ו-progress bar מעוגל.

## Specific Changes

### SettingsPage
- Each settings section in its own card (radius 20px, shadow-sm)
- Section title: 18px semibold, `var(--text-primary)`
- Toggle switches: rounded pill, brand color when active
- Select/Dropdown: radius 12px, clean border

### UsersPage
- User list: table or card format
- Avatar: 40px circle, initials if no image
- Role badge: pill shaped, subtle color
- Invite button: primary style (brand-500)

### BackupsPage
- Backup items in cards with timestamp + status
- Restore button: secondary style (outline)
- Download button: ghost style

### OrganizationPage
- Org info card at top: logo/name/description
- Members list below: avatar + name + role
- Settings: form inputs with radius 12px

### OnboardingPage
- Steps indicator: horizontal circles connected by line
- Active step: brand-500 filled circle, white text
- Completed step: success color filled circle + checkmark
- Future step: gray outline circle
- Step content: centered card, max-width 600px
- Progress bar below steps: rounded, brand color fill

## Rules
- Keep all form logic, validation, and submission handlers
- Keep toggle/switch state management
- Do NOT change user management API calls
- Consistent card style across all admin pages

## Validation
- [ ] Settings sections in clean rounded cards
- [ ] User avatars in circles
- [ ] Onboarding has clear step progress
- [ ] All inputs have 12px radius
- [ ] Dark mode: navy cards, proper contrast
- [ ] RTL: forms align right
- [ ] All existing functionality preserved
```

---

## סדר ביצוע מומלץ

| # | פרומפט | מה כולל | זמן מוערך |
|---|--------|---------|-----------|
| 1 | Design System Foundation | CSS variables + font | 10-15 דק |
| 2 | Sidebar + Layout | Sidebar, AppLayout, Header | 15-20 דק |
| 3 | Dashboard | KPI cards, charts, widgets | 20-30 דק |
| 4 | Auth Pages | Login, Register | 10-15 דק |
| 5 | Tables | 5 דפי טבלאות | 20-30 דק |
| 6 | Secondary Pages | Forecast, Balance, Alerts, Categories | 20-30 דק |
| 7 | Admin & Settings | Settings, Users, Backups, Org, Onboarding | 15-20 דק |

**סה"כ מוערך: 2-3 שעות**

### טיפים

1. **אחרי כל prompt — עשה `npm run build`** ותקן שגיאות לפני שממשיכים
2. **בדוק dark mode** אחרי כל prompt
3. **בדוק RTL** — במיוחד sidebar (מימין) ו-tables (כיוון טקסט)
4. **Commit אחרי כל prompt שעובד** — כדי שתוכל לחזור אחורה
5. **Prompt 1 הוא הבסיס** — אם הוא מיושם נכון, כל השאר קל יותר

---

## הערה חשובה על קובץ ה-.fig

הקובץ `Finebank-Financial-Management-Dashboard.fig` בהורדות הוא **קובץ Figma בינארי** — Claude Code לא יכול לקרוא אותו ישירות. אם אתה רוצה שהארכיטקט יתייחס לעיצוב ספציפי ממנו:

1. **פתח את הקובץ ב-Figma** (figma.com → Import file)
2. **צלם screenshots** של המסכים הרלוונטיים
3. **תשלח את ה-screenshots לארכיטקט** (Mode 1 — Design Discovery)
4. או פשוט **השתמש בפרומפטים למעלה** — הם כבר מבוססים על שפת העיצוב של Finebank
