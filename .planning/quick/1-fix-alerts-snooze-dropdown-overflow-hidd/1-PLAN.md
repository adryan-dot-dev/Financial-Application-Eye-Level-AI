---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/AlertsPage.tsx
autonomous: true
requirements:
  - QUICK-1
must_haves:
  truths:
    - "Snooze dropdown is fully visible when opened — not clipped by the card boundary"
    - "Alert cards maintain their normal rounded/contained appearance when snooze is closed"
  artifacts:
    - path: "frontend/src/pages/AlertsPage.tsx"
      provides: "AlertCard with conditional overflow based on snooze dropdown state"
      contains: "isSnoozeOpen"
  key_links:
    - from: "AlertCard article element"
      to: "isSnoozeOpen state"
      via: "conditional className"
      pattern: "overflow-hidden.*overflow-visible"
---

<objective>
Fix the snooze dropdown in AlertCard so it is not clipped by the card's overflow property.

Purpose: When the snooze dropdown opens, it renders absolutely-positioned content that extends beyond the card boundary. If the card has overflow-hidden (or an inherited overflow constraint), the dropdown is visually cut off. The fix toggles overflow-visible on the card only while the dropdown is open.

Output: AlertsPage.tsx with the article wrapper using `overflow-hidden` by default and `overflow-visible` when `isSnoozeOpen === true`.
</objective>

<execution_context>
@/Users/roeiedri/.claude/get-shit-done/workflows/execute-plan.md
@/Users/roeiedri/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Conditionally toggle overflow on AlertCard article wrapper</name>
  <files>frontend/src/pages/AlertsPage.tsx</files>
  <action>
    In the `AlertCard` function component, locate the `<article>` element (around line 447).

    Its current `className` prop starts with:
    ```
    'row-enter hover-lift group overflow-visible rounded-2xl border transition-all duration-200'
    ```

    Change `overflow-visible` to be conditional based on `isSnoozeOpen`:
    - When `isSnoozeOpen` is false: use `overflow-hidden` so the card clips its contents normally (clean card appearance)
    - When `isSnoozeOpen` is true: use `overflow-visible` so the absolutely-positioned dropdown panel is not clipped

    The `isSnoozeOpen` state variable is already declared at line 439:
    ```ts
    const [isSnoozeOpen, setIsSnoozeOpen] = useState(false)
    ```
    And `onOpenChange={setIsSnoozeOpen}` is already wired to `<SnoozeDropdown>` at line 634.

    Replace the hardcoded `overflow-visible` in the article className with a conditional:
    ```tsx
    className={cn(
      'row-enter hover-lift group rounded-2xl border transition-all duration-200',
      isSnoozeOpen ? 'overflow-visible' : 'overflow-hidden',
      isUnread ? 'card-hover' : '',
    )}
    ```

    Do NOT change any other logic. Do NOT change the style prop, the zIndex logic, or any other class.

    Note: The `transition-all` class will animate the overflow change, but overflow transitions are not visually animated by browsers — this is acceptable and harmless.
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -20</automated>
    <manual>Open the Alerts page in the browser. Click the Snooze button on any alert card. Verify the dropdown panel is fully visible (not clipped). Close it and verify the card returns to its normal contained appearance.</manual>
  </verify>
  <done>
    - TypeScript build passes with no errors
    - The article element's className includes `overflow-hidden` when snooze is closed and `overflow-visible` when snooze is open
    - No other logic in the file is changed
  </done>
</task>

</tasks>

<verification>
Run `cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build` — must complete with 0 errors.
</verification>

<success_criteria>
- Build passes cleanly
- AlertCard article uses `overflow-hidden` by default and `overflow-visible` when `isSnoozeOpen` is true
- No other code in AlertsPage.tsx is changed
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-alerts-snooze-dropdown-overflow-hidd/1-SUMMARY.md` with what was done.
</output>
