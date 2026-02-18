# Frontend Design Implementation Review Checklist

**Component:** ___________________________
**Reviewer:** ___________________________
**Date:** ___________________________
**Status:** ☐ Pass ☐ Revisions Required ☐ Blocker

---

## 1. TypeScript Compliance

### Type Safety
- [ ] **YES** | **NO** All imports of types use `import type` (verbatimModuleSyntax: true)
  - Example: `import type { User } from '@/types'` not `import { User }`
- [ ] **YES** | **NO** No `any` types used without explicit justification
- [ ] **YES** | **NO** Props interface defined and properly typed
  - Example: `interface ComponentProps { ... }` or `type ComponentProps = { ... }`
- [ ] **YES** | **NO** Return types explicit on functions
- [ ] **YES** | **NO** Event handlers properly typed (e.g., `React.MouseEvent<HTMLButtonElement>`)
- [ ] **YES** | **NO** API response types imported from `@/api/*`
- [ ] **YES** | **NO** No type assertions (`as`) unless absolutely necessary
- [ ] **YES** | **NO** useQuery/useMutation types properly specified: `useQuery<ResponseType>({ ... })`

**Notes:**
```
TypeScript issues found:
```

---

## 2. Design System Adherence

### CSS Variables & Theming
- [ ] **YES** | **NO** All colors use CSS variables, NOT hardcoded hex/rgb
  - ✓ Correct: `style={{ backgroundColor: 'var(--bg-primary)' }}`
  - ✗ Incorrect: `style={{ backgroundColor: '#FFFFFF' }}`
- [ ] **YES** | **NO** Text colors use semantic variables
  - Examples: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`, `var(--text-sidebar)`
- [ ] **YES** | **NO** Background colors use semantic variables
  - Examples: `var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-card)`, `var(--bg-hover)`
- [ ] **YES** | **NO** Border colors use `var(--border-primary)` or semantic borders
- [ ] **YES** | **NO** Shadows use predefined variables: `var(--shadow-xs/sm/md/lg/xl)`
- [ ] **YES** | **NO** Border radius uses theme system: `var(--radius-xs/sm/md/lg/xl/2xl/full)`

### Design Utility Classes
- [ ] **YES** | **NO** Cards use `.card` or `.card-hover` base class
- [ ] **YES** | **NO** Buttons use `.btn-primary`, `.btn-secondary`, or `.btn-ghost`
- [ ] **YES** | **NO** Financial numbers use `.fin-number`, `.fin-number-lg`, or `.fin-number-xl`
- [ ] **YES** | **NO** Icons use existing `.icon-circle-sm/md/lg` for backgrounds
- [ ] **YES** | **NO** Badges use semantic classes: `.badge-income`, `.badge-expense`, `.badge-active`, etc.
- [ ] **YES** | **NO** Alerts use `.severity-info`, `.severity-warning`, `.severity-critical`

### Animations & Transitions
- [ ] **YES** | **NO** Uses predefined transitions: `var(--duration-fast/normal/slow)` + `var(--ease-smooth/spring)`
- [ ] **YES** | **NO** Entrance animations use existing keyframes: `.animate-fade-in-up`, `.animate-fade-in`, `.animate-fade-in-scale`
- [ ] **YES** | **NO** Animations respect `prefers-reduced-motion`
- [ ] **YES** | **NO** No custom CSS with hardcoded animation timings

### Brand Identity
- [ ] **YES** | **NO** Brand gradient uses `var(--gradient-brand)` not hardcoded
- [ ] **YES** | **NO** Brand colors use Tailwind scale: `var(--color-brand-50)` through `var(--color-brand-900)`
- [ ] **YES** | **NO** Primary action buttons use brand gradient
- [ ] **YES** | **NO** Logo positioned consistently with `/frontend/public/logo.jpeg`

**Notes:**
```
Design system issues found:
```

---

## 3. RTL (Right-to-Left) Support

### Logical Properties
- [ ] **YES** | **NO** Uses logical margin: `ms-*` (margin-start) not `ml-*` (margin-left)
- [ ] **YES** | **NO** Uses logical padding: `ps-*` (padding-start), `pe-*` (padding-end) not `pl-*`, `pr-*`
- [ ] **YES** | **NO** Uses logical positioning: `inset-inline-start`, `inset-inline-end`
- [ ] **YES** | **NO** Flex gap used instead of margin for spacing

### Direction Handling
- [ ] **YES** | **NO** No hardcoded `left:`, `right:` in CSS (use `inset-inline-start:` or `inset-inline-end:`)
- [ ] **YES** | **NO** Icon flipping logic applied for RTL context
  - Example: `ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')}`
- [ ] **YES** | **NO** Component checks `i18n.language === 'he'` or uses RTL context
- [ ] **YES** | **NO** Stagger animations respect RTL: `[dir="rtl"] .onboarding-slide-out-left { transform: translateX(20px); }`

### Number & Date Formatting
- [ ] **YES** | **NO** Financial numbers wrapped with `ltr-nums` class to keep LTR in RTL context
  - Example: `<span className="ltr-nums">₪ 1,234.56</span>`
- [ ] **YES** | **NO** Dates formatted with locale-specific formatting: `formatDate(date, isHe ? 'he-IL' : 'en-US')`
- [ ] **YES** | **NO** Numbers remain numeric direction (LTR) in RTL text

### Translation Support
- [ ] **YES** | **NO** Uses `const { t, i18n } = useTranslation()`
- [ ] **YES** | **NO** All user-facing text uses `t('key.path')` not hardcoded strings
- [ ] **YES** | **NO** Locale-specific text selection: `isHe ? item.name_he : item.name`
- [ ] **YES** | **NO** Plural forms handled: `t('key', { count: number })`

**Notes:**
```
RTL/i18n issues found:
```

---

## 4. Dark Mode Support

### Color Scheme
- [ ] **YES** | **NO** All colors use CSS variables (adapts automatically with `.dark` class)
- [ ] **YES** | **NO** No hardcoded white (`#FFFFFF`, `white`) or black (`#000000`, `black`) backgrounds
- [ ] **YES** | **NO** Background colors adapt: `var(--bg-primary)`, `var(--bg-secondary)`, `var(--bg-card)`
- [ ] **YES** | **NO** Text colors adapt: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`

### Shadow & Depth
- [ ] **YES** | **NO** Shadows use CSS variables: `var(--shadow-sm/md/lg)` not hardcoded `box-shadow`
- [ ] **YES** | **NO** Shadows are heavier in dark mode (already in variables)
- [ ] **YES** | **NO** Borders use `var(--border-primary)` which adapts to dark mode

### Component States
- [ ] **YES** | **NO** Hover states adapt to dark mode automatically
- [ ] **YES** | **NO** Focus states visible in both light and dark modes
- [ ] **YES** | **NO** Badge backgrounds and text adapt: `.badge-income`, `.badge-expense` etc.
- [ ] **YES** | **NO** Alert backgrounds use semantic semantic variables

### Testing in Dark Mode
- [ ] **YES** | **NO** Component visually tested in both light and dark modes
- [ ] **YES** | **NO** No contrast issues in either theme (use WCAG AA minimum 4.5:1)
- [ ] **YES** | **NO** Images/logos remain visible in both modes

**Notes:**
```
Dark mode issues found:
```

---

## 5. Accessibility (A11y)

### Interactive Elements
- [ ] **YES** | **NO** All buttons/links have semantic HTML: `<button>`, `<a>`, `<input>`
- [ ] **YES** | **NO** Clickable elements are keyboard accessible (Tab, Enter, Space)
- [ ] **YES** | **NO** `aria-label` on icon-only buttons
  - Example: `<button aria-label={t('actions.edit')}><Edit size={16} /></button>`
- [ ] **YES** | **NO** Form inputs have associated labels: `<label htmlFor="id">Label</label>`
- [ ] **YES** | **NO** Error messages linked with `aria-describedby`
- [ ] **YES** | **NO** Loading states announced: `aria-live="polite"` or `aria-busy="true"`

### Focus Management
- [ ] **YES** | **NO** Focus visible on all interactive elements (outlined in `var(--border-focus)`)
- [ ] **YES** | **NO** Focus order logical (top-to-bottom, left-to-right or end-to-start for RTL)
- [ ] **YES** | **NO** Focus trap in modals/dialogs (focus returns to trigger after close)
- [ ] **YES** | **NO** No focus lost when navigating with keyboard

### Semantic HTML
- [ ] **YES** | **NO** Headings use correct hierarchy: `<h1>`, `<h2>`, `<h3>` (not divs with large text)
- [ ] **YES** | **NO** Lists use `<ul>`, `<ol>`, `<li>` not divs
- [ ] **YES** | **NO** Tables use `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`
- [ ] **YES** | **NO** Form inputs use semantic elements: `<input>`, `<select>`, `<textarea>`

### Color & Contrast
- [ ] **YES** | **NO** Text contrast ratio ≥ 4.5:1 (normal text), ≥ 3:1 (large text)
- [ ] **YES** | **NO** Color not used as sole indicator (income/expense also uses icons or text)
- [ ] **YES** | **NO** Icons have sufficient size (minimum 16x16px or 1em)
- [ ] **YES** | **NO** Important information not conveyed by color alone

### Screen Reader Testing
- [ ] **YES** | **NO** Tested with screen reader (VoiceOver/NVDA/JAWS)
- [ ] **YES** | **NO** Announcements clear and non-redundant
- [ ] **YES** | **NO** Hidden decorative elements marked with `aria-hidden="true"`
- [ ] **YES** | **NO** Skip links available if needed

**Notes:**
```
Accessibility issues found:
```

---

## 6. Error Handling & UX States

### Error Messages
- [ ] **YES** | **NO** API errors use `getApiErrorMessage(error)` helper
  - Location: Check `/api/error.ts` or similar
- [ ] **YES** | **NO** Error state NEVER renders objects/arrays as JSX children
  - ✓ Correct: `<p>{typeof error === 'string' ? error : 'Unknown error'}</p>`
  - ✗ Incorrect: `<p>{error}</p>` where error is `{ message, status }`
- [ ] **YES** | **NO** Error messages are user-friendly, not raw stack traces
- [ ] **YES** | **NO** Errors use semantic styling: `var(--color-danger)`, `.severity-critical`

### Loading States
- [ ] **YES** | **NO** Loading skeleton shown while fetching data
- [ ] **YES** | **NO** Skeleton matches layout of actual content (same height/width)
- [ ] **YES** | **NO** Loading state shown on buttons during submission
  - Example: `disabled={isLoading}` with loading indicator
- [ ] **YES** | **NO** Multiple queries/mutations properly show individual loading states

### Empty States
- [ ] **YES** | **NO** Empty state displayed when data list is empty
- [ ] **YES** | **NO** Empty state includes icon, message, and optional CTA
- [ ] **YES** | **NO** Empty state uses `.empty-float` animation for icon
- [ ] **YES** | **NO** Helpful message with next action (e.g., "Create your first transaction")

### Validation
- [ ] **YES** | **NO** Form fields validated on blur and submit
- [ ] **YES** | **NO** Invalid fields marked: `.input-error` class or `aria-invalid="true"`
- [ ] **YES** | **NO** Error messages appear below/near field
- [ ] **YES** | **NO** Required fields marked with asterisk or aria-required

**Notes:**
```
Error handling issues found:
```

---

## 7. Performance Optimization

### Rendering
- [ ] **YES** | **NO** No unnecessary re-renders (check React DevTools Profiler)
- [ ] **YES** | **NO** Heavy computations memoized: `useMemo` or extracted to `utils/`
- [ ] **YES** | **NO** List items have unique, stable keys (not array index)
  - ✓ Correct: `key={item.id}`
  - ✗ Incorrect: `key={index}`
- [ ] **YES** | **NO** Event handlers memoized if passed to child components: `useCallback`
- [ ] **YES** | **NO** Component memoized if receives complex props: `React.memo`

### Images & Assets
- [ ] **YES** | **NO** Large images use next-gen format (WebP, AVIF) or optimized PNG/JPG
- [ ] **YES** | **NO** Images have explicit width/height to prevent layout shift
- [ ] **YES** | **NO** Images lazy-loaded if below fold: `loading="lazy"`
- [ ] **YES** | **NO** SVG icons used from lucide-react (lightweight, scalable)
- [ ] **YES** | **NO** No base64 encoded images in JSX

### Data Fetching
- [ ] **YES** | **NO** Uses React Query (`@tanstack/react-query`) with proper `queryKey`
- [ ] **YES** | **NO** Query keys from `queryKeys` helper file
- [ ] **YES** | **NO** Data cached appropriately: `staleTime`, `cacheTime`
- [ ] **YES** | **NO** Pagination/infinite scroll doesn't re-fetch all data
- [ ] **YES** | **NO** No API calls in render function or without `useQuery`

### Bundle Size
- [ ] **YES** | **NO** No large unused dependencies imported
- [ ] **YES** | **NO** Routes use lazy loading: `lazy(() => import('@/pages/...'))`
- [ ] **YES** | **NO** Heavy libraries (charts, maps) only imported when needed
- [ ] **YES** | **NO** Tree-shaking enabled in Vite config

**Notes:**
```
Performance issues found:
```

---

## 8. Financial Data Handling

### Amount Formatting
- [ ] **YES** | **NO** All amounts formatted with currency symbol using `formatAmount()`
  - Example: `₪ 1,234.56` for ILS, `$ 1,234.56` for USD
- [ ] **YES** | **NO** Amounts from API are strings (DECIMAL precision), not numbers
  - Type: `amount: string` not `amount: number`
- [ ] **YES** | **NO** No floating-point arithmetic on amounts
  - ✓ Correct: Display `parseFloat(amount)` only for UI
  - ✗ Incorrect: `amount + 10` directly on string
- [ ] **YES** | **NO** Negative amounts display correctly (e.g., `(₪ 100.00)` or `-₪ 100.00`)

### Display Classes
- [ ] **YES** | **NO** Large financial numbers use `.fin-number-lg` or `.fin-number-xl`
- [ ] **YES** | **NO** All numeric values use `.fin-number` class (monospace, tabular-nums)
  - Fonts: `'JetBrains Mono'`, `ui-monospace`, `monospace`
- [ ] **YES** | **NO** Income/expense coloring applied consistently
  - Income: `.amount-income` = `var(--color-success)` (green)
  - Expense: `.amount-expense` = `var(--color-danger)` (red)

### Currency Support
- [ ] **YES** | **NO** Currency field present in all API responses
- [ ] **YES** | **NO** Currency passed to `formatAmount()`: `formatAmount(amount, currency)`
- [ ] **YES** | **NO** Default currency is ILS (Israeli Shekel) per spec
- [ ] **YES** | **NO** Multi-currency display doesn't mix symbols (e.g., no `₪ $ 100`)

### Precision & Validation
- [ ] **YES** | **NO** Amounts displayed with exactly 2 decimal places (DECIMAL(15,2))
- [ ] **YES** | **NO** Input fields validate numeric-only: `type="number"` or `inputMode="decimal"`
- [ ] **YES** | **NO** Form prevents submission with invalid amounts
- [ ] **YES** | **NO** Calculated totals don't have floating-point errors

**Notes:**
```
Financial data issues found:
```

---

## 9. Component Structure & Code Quality

### File Organization
- [ ] **YES** | **NO** Component file uses clear sections with comments
  - Sections: Constants, Helpers, Skeleton, Main Component
- [ ] **YES** | **NO** Related types exported from component or from `@/types`
- [ ] **YES** | **NO** Props interface defined at top of file
- [ ] **YES** | **NO** Imports organized: React → Next → Libraries → Locals

### Constants & Magic Numbers
- [ ] **YES** | **NO** No magic numbers in component (extract to constants)
  - ✓ Correct: `const HIGH_EXPENSE_THRESHOLD = 5000` at top
  - ✗ Incorrect: Hardcoded `5000` in conditions
- [ ] **YES** | **NO** Threshold values documented with comments
- [ ] **YES** | **NO** Color values use CSS variables, not magic hex strings

### Function Extraction
- [ ] **YES** | **NO** Long JSX broken into smaller, named functions
- [ ] **YES** | **NO** Utility functions extracted to `@/lib/utils.ts` or `@/hooks`
- [ ] **YES** | **NO** Components under 300 lines (or justified)
- [ ] **YES** | **NO** Prop drilling minimized (use context if deep nesting)

### Comments & Documentation
- [ ] **YES** | **NO** Complex logic has explanatory comments
- [ ] **YES** | **NO** Section comments use consistent format: `// --- Description ---`
- [ ] **YES** | **NO** Props interface has JSDoc: `/** Description of prop */`
- [ ] **YES** | **NO** Non-obvious calculations explained

**Notes:**
```
Code quality issues found:
```

---

## 10. Integration & Dependencies

### API Integration
- [ ] **YES** | **NO** Uses typed API client from `@/api/*.ts`
- [ ] **YES** | **NO** Error responses handled with `getApiErrorMessage(error)`
- [ ] **YES** | **NO** Loading and error states checked before rendering
- [ ] **YES** | **NO** Optimistic updates used where appropriate (useMutation)

### React Query
- [ ] **YES** | **NO** Query keys use `queryKeys.module.function()` pattern
- [ ] **YES** | **NO** Mutations invalidate relevant queries: `queryClient.invalidateQueries()`
- [ ] **YES** | **NO** Proper error boundary around async operations
- [ ] **YES** | **NO** Retry logic configured appropriately

### Context & State
- [ ] **YES** | **NO** Uses `useThemeContext()` for theme (light/dark/system)
- [ ] **YES** | **NO** Uses `useAuthContext()` for current user/auth state
- [ ] **YES** | **NO** Uses `useToast()` for notifications
- [ ] **YES** | **NO** Currency formatting uses `useCurrency()` hook
- [ ] **YES** | **NO** No prop drilling for common states (use context)

### Hooks & Custom Logic
- [ ] **YES** | **NO** Custom hooks extracted to `@/hooks/*.ts`
- [ ] **YES** | **NO** Hooks follow naming: `useFeatureName`
- [ ] **YES** | **NO** Hooks properly typed with return types
- [ ] **YES** | **NO** useEffect has proper dependencies array

**Notes:**
```
Integration issues found:
```

---

## 11. Tailwind CSS v4 Compliance

### Theme Directive
- [ ] **YES** | **NO** Uses `@theme` directive for design tokens (v4 syntax)
- [ ] **YES** | **NO** NO `@tailwind directives` (v3 style) - using v4 import instead
- [ ] **YES** | **NO** All custom colors in `@theme` block, not arbitrary values
- [ ] **YES** | **NO** Responsive classes use correct v4 syntax (e.g., `sm:`, `md:`, `lg:`)

### Utility Usage
- [ ] **YES** | **NO** Uses Tailwind utilities correctly: `flex`, `items-center`, `gap-3`, etc.
- [ ] **YES** | **NO** Responsive utilities used: `sm:`, `md:`, `lg:`, `xl:`
- [ ] **YES** | **NO** Dark mode utilities: `dark:bg-slate-900`
- [ ] **YES** | **NO** No custom CSS for things Tailwind can do (e.g., padding, sizing)

### Custom CSS
- [ ] **YES** | **NO** Custom CSS only in `index.css` or component-scoped modules
- [ ] **YES** | **NO** No conflicting Tailwind utilities with inline styles
- [ ] **YES** | **NO** CSS custom properties use `var(--name)` syntax
- [ ] **YES** | **NO** Scoped component styles don't conflict globally

**Notes:**
```
Tailwind compliance issues found:
```

---

## 12. Browser & Cross-Browser Testing

### Compatibility
- [ ] **YES** | **NO** Tested in Chrome/Edge (Chromium)
- [ ] **YES** | **NO** Tested in Firefox
- [ ] **YES** | **NO** Tested in Safari (macOS and iOS)
- [ ] **YES** | **NO** No console errors or warnings

### Responsive Design
- [ ] **YES** | **NO** Mobile layout (320px) works correctly
- [ ] **YES** | **NO** Tablet layout (768px) works correctly
- [ ] **YES** | **NO** Desktop layout (1440px) works correctly
- [ ] **YES** | **NO** Touch targets ≥ 48px (mobile accessibility)

### RTL Testing
- [ ] **YES** | **NO** Tested with `<html dir="rtl">` or `.dark.rtl`
- [ ] **YES** | **NO** All text flows right-to-left in Hebrew
- [ ] **YES** | **NO** Numbers display correctly (LTR in RTL context)
- [ ] **YES** | **NO** Icons flip/rotate correctly in RTL

**Notes:**
```
Browser/testing issues found:
```

---

## Summary

**Total Items Reviewed:** ___/144
**Items Passing:** ___
**Items Failing:** ___
**N/A Items:** ___

**Review Status:**
- [ ] ✅ APPROVED - All critical items pass
- [ ] 🔶 REVISIONS REQUIRED - Minor issues to fix
- [ ] ❌ BLOCKER - Critical issues preventing merge

**Critical Issues Found:**
```
1.
2.
3.
```

**Minor Issues to Fix:**
```
1.
2.
3.
```

**Approved By:** ___________________________
**Date Approved:** ___________________________

---

## Quick Reference Links

- **Design System:** See `frontend/src/index.css` (@theme directives and CSS variables)
- **Component Examples:** See `frontend/src/components/dashboard/`
- **Type Definitions:** See `frontend/src/types/` and `frontend/src/api/`
- **Hooks:** See `frontend/src/hooks/`
- **Utils:** See `frontend/src/lib/utils.ts`
- **API Client:** See `frontend/src/api/`
- **i18n Translations:** See `frontend/public/locales/`

---

**Version:** 1.0
**Last Updated:** February 2026
**Applicable To:** React 19 + TypeScript 5.9 + Tailwind CSS v4 + i18next
