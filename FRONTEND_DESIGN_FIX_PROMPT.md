# Frontend Design Skill — Fix Prompt: Polish & Premium Animations
## Cashflow.ai — Round 2: Visual Fixes + Animation Upgrade

---

## CONTEXT

You just completed a color palette migration across 17 files. Build passes cleanly. Now we need to fix 3 specific visual issues and add premium animation polish to make this app feel truly Apple-level.

**Remember**: This is Cashflow.ai — a premium fintech app. Every detail matters. Think Mercury Bank × Linear × Stripe.

---

## FIX 1: Sidebar Section Headers — Nearly Invisible (CRITICAL)

### The Problem
The sidebar navigation group headers ("ראשי" / Main, "פיננסי" / Finance, "מערכת" / System) are extremely hard to read. They use `opacity: 0.35` on an already-subdued gray color.

### File: `frontend/src/components/layout/Sidebar.tsx`

**Current code (lines 108-117):**
```tsx
{label && !collapsed && (
  <div className="mb-1 px-3 pt-2">
    <span
      className="text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: 'var(--text-sidebar)', opacity: 0.35 }}
    >
      {label}
    </span>
  </div>
)}
```

**Also affected — company name below logo (line ~276):**
```tsx
<p className="mt-1 text-[10px] font-medium tracking-widest uppercase"
  style={{ color: 'var(--text-sidebar)', opacity: 0.4 }}
>
  {t('app.company')}
</p>
```

### The Fix
- Section headers: Change `opacity: 0.35` → remove opacity entirely, use a brighter color like `rgba(255, 255, 255, 0.5)` or even `rgba(255, 255, 255, 0.6)`. Make `font-weight: 700` (bold) and increase font size to `text-[11px]`. These headers should be clearly visible as section dividers.
- Company name: Change `opacity: 0.4` → `opacity: 0.6` minimum, or use a dedicated lighter color.
- The sidebar background is dark (`#09090B` or similar), so these labels need to be clearly WHITE-ish, not transparent gray.

### Check Other Places
Search the ENTIRE codebase for any other `opacity: 0.3` or `opacity: 0.4` patterns on text elements that might be hard to read. Fix any you find.

---

## FIX 2: Blue Focus Rectangle on Click (CRITICAL)

### The Problem
When clicking any interactive element (KPI cards, quick action cards, buttons, links), a bright blue/indigo rectangular outline with a glow halo appears around it. This looks jarring and unprofessional.

### File: `frontend/src/index.css`

**Current code (lines 232-240):**
```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(99, 91, 255, 0.12);
}

.dark *:focus-visible {
  box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.15);
}
```

### The Fix
The focus ring should ONLY appear for **keyboard navigation** (Tab key), NOT for mouse clicks. This is the standard Apple/premium app behavior.

Replace with:
```css
/* Focus ring ONLY for keyboard users (not mouse clicks) */
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(99, 91, 255, 0.08);
}

.dark *:focus-visible {
  box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.1);
}

/* Remove focus ring on mouse click for non-input elements */
*:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}
```

Also reduce the shadow spread from `0.12` to `0.08` (light) and `0.15` to `0.1` (dark) to make the keyboard focus ring more subtle.

**Also check**: The input-specific focus styles (lines ~751-759) should remain as-is — form inputs SHOULD show focus rings.

---

## FIX 3: Premium Animation Upgrade (ENHANCEMENT)

Add these animations to elevate the app from "good" to "world-class". Implement them in `index.css` and update affected page components.

### 3A. Global Smooth Scrolling
Add to `index.css`:
```css
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

### 3B. Animated Numbers (Count-Up Effect)
Create a reusable inline approach for financial number animations. When KPI values or balance amounts appear, they should count up from 0 to their final value over ~600ms.

**Implementation**: Add a CSS-based approach or a small helper component that uses `requestAnimationFrame` to animate number values. Apply to:
- Dashboard KPI cards (income, expenses, net cashflow, balance)
- Balance page hero card (current balance)
- Forecast summary KPI cards
- Any large `.fin-number-xl` or `.fin-number-lg` display

### 3C. Scroll-Triggered Entrance Animations
Add an Intersection Observer-based approach so elements animate in when they scroll into view, not just on page load.

**New CSS classes to add:**
```css
/* Elements start invisible, animate when .in-view is added */
.scroll-reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s var(--ease-smooth), transform 0.5s var(--ease-smooth);
}

.scroll-reveal.in-view {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger variants for lists */
.scroll-reveal-stagger > *:nth-child(1) { transition-delay: 0ms; }
.scroll-reveal-stagger > *:nth-child(2) { transition-delay: 60ms; }
.scroll-reveal-stagger > *:nth-child(3) { transition-delay: 120ms; }
.scroll-reveal-stagger > *:nth-child(4) { transition-delay: 180ms; }
.scroll-reveal-stagger > *:nth-child(5) { transition-delay: 240ms; }
.scroll-reveal-stagger > *:nth-child(6) { transition-delay: 300ms; }
```

**Create a small hook** `useScrollReveal` (or inline IntersectionObserver) and apply to:
- Dashboard: KPI cards section, chart section, alerts section, quick actions
- Balance: History chart, history table
- Forecast: Chart section, data table
- Any page with below-the-fold content

### 3D. Skeleton → Content Cross-Fade
Instead of a hard cut from skeleton to real content, add a smooth cross-fade:
```css
.content-reveal {
  animation: contentFadeIn 0.3s var(--ease-smooth) forwards;
}

@keyframes contentFadeIn {
  from { opacity: 0; transform: scale(0.99); }
  to { opacity: 1; transform: scale(1); }
}
```

Apply this class to the content wrapper that replaces skeleton loaders on all pages.

### 3E. Enhanced Hover States
Add hover effects to elements that currently lack them:

1. **Alert items** (AlertsPage) — add subtle lift + shadow on hover:
```css
.alert-item {
  transition: transform 0.2s var(--ease-smooth), box-shadow 0.2s var(--ease-smooth);
}
.alert-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
```

2. **Balance history rows** — add hover background + slight lift
3. **Forecast table rows** — add interactive feel on hover
4. **Settings section cards** — add hover depth
5. **User table rows** — add hover highlight

### 3F. Progress Bar Entrance Animation
Progress bars should animate from 0% width to their target on mount:
```css
.progress-fill-animated {
  width: 0%;
  animation: progressGrow 0.8s var(--ease-smooth) 0.3s forwards;
}

@keyframes progressGrow {
  to { width: var(--target-width); }
}
```

Apply to installment progress bars, loan payment progress, and any other progress indicators.

### 3G. Chart Tooltip Glassmorphism
Style Recharts tooltips to match the premium aesthetic:
```css
.recharts-default-tooltip {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(0, 0, 0, 0.06) !important;
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-lg) !important;
  padding: 12px 16px !important;
}

.dark .recharts-default-tooltip {
  background: rgba(17, 17, 19, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
```

---

## OUTPUT FORMAT

Output the COMPLETE updated files for:
1. **`index.css`** — Focus fix + new animation classes + smooth scrolling + tooltip glassmorphism
2. **`Sidebar.tsx`** — Section header visibility fix + company name fix
3. **Any page files** that need the scroll-reveal hook, count-up numbers, or content-reveal class applied

For page files, you can output JUST the changed sections (diff-style) since these are large files. For `index.css` and `Sidebar.tsx`, output the COMPLETE file.

---

## RULES REMINDER (Same as Before)

- `import type` for type-only imports
- CSS variables for ALL colors — NEVER hardcode hex
- RTL-first with logical properties
- `getApiErrorMessage(err)` for ALL error handling
- `cn()` utility for conditional classes
- `useCurrency()` hook for financial formatting
- Respect `prefers-reduced-motion` for ALL new animations

---

## QUALITY CHECK

After implementing, mentally verify:
- [ ] Sidebar section headers are clearly visible in BOTH light sidebar and dark sidebar
- [ ] No blue rectangle appears when CLICKING elements with mouse
- [ ] Blue focus ring DOES appear when TAB-navigating with keyboard (accessibility!)
- [ ] Smooth scrolling works globally
- [ ] At least dashboard KPI numbers have count-up animation
- [ ] Chart tooltips have glassmorphism effect
- [ ] No existing functionality is broken
- [ ] Build passes cleanly
