---
phase: quick
plan: 1
subsystem: frontend
tags: [ui, overflow, dropdown, alerts]
dependency_graph:
  requires: []
  provides: [alerts-snooze-dropdown-visible]
  affects: [frontend/src/pages/AlertsPage.tsx]
tech_stack:
  added: []
  patterns: [conditional-className, cn-utility]
key_files:
  created: []
  modified:
    - frontend/src/pages/AlertsPage.tsx
decisions:
  - Use conditional overflow class driven by isSnoozeOpen state (already existed) — no new state needed
metrics:
  duration: "~3min"
  completed: "2026-02-24T10:59:56Z"
  tasks_completed: 1
  files_modified: 1
---

# Quick Fix 1: Fix Alerts Snooze Dropdown Overflow Hidden — Summary

**One-liner:** Toggle overflow-hidden/overflow-visible on AlertCard article wrapper based on isSnoozeOpen state so the snooze dropdown is never clipped.

## What Was Done

Single targeted fix in `AlertsPage.tsx`: the `<article>` wrapper in `AlertCard` had `overflow-visible` hardcoded in its className. This was changed to a conditional expression using the already-existing `isSnoozeOpen` state variable.

**Before:**
```tsx
className={cn(
  'row-enter hover-lift group overflow-visible rounded-2xl border transition-all duration-200',
  isUnread ? 'card-hover' : '',
)}
```

**After:**
```tsx
className={cn(
  'row-enter hover-lift group rounded-2xl border transition-all duration-200',
  isSnoozeOpen ? 'overflow-visible' : 'overflow-hidden',
  isUnread ? 'card-hover' : '',
)}
```

## Why

When the snooze dropdown opens, it renders an absolutely-positioned panel that extends beyond the card boundary. With `overflow-hidden` always active, the dropdown was visually clipped. The fix switches to `overflow-visible` only when the dropdown is open, then returns to `overflow-hidden` when it closes — preserving the clean card appearance the rest of the time.

## Verification

- TypeScript build: `npm run build` passed with 0 errors (2.09s build time)
- The `isSnoozeOpen` state and `onOpenChange={setIsSnoozeOpen}` wiring were already in place — no additional logic changes needed

## Deviations from Plan

None — plan executed exactly as written.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Conditionally toggle overflow on AlertCard article wrapper | f15c46c | frontend/src/pages/AlertsPage.tsx |

## Self-Check: PASSED

- FOUND: frontend/src/pages/AlertsPage.tsx
- FOUND: commit f15c46c
