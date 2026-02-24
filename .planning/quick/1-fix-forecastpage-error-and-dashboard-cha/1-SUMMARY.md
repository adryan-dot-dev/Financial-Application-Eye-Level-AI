---
phase: quick
plan: 1
subsystem: frontend
tags: [ux, error-handling, retry, forecast, dashboard]
dependency_graph:
  requires: []
  provides: [forecast-error-recovery, dashboard-forecast-error-state]
  affects: [ForecastPage, DashboardPage]
tech_stack:
  added: []
  patterns: [error-boundary-retry, three-state-conditional-render]
key_files:
  created: []
  modified:
    - frontend/src/pages/ForecastPage.tsx
    - frontend/src/pages/DashboardPage.tsx
decisions:
  - "Retry in ForecastPage dispatches to the active tab's query refetch — comparison tab shares monthlyQuery"
  - "Dashboard forecast chart uses three-way conditional: isLoading → isError → data/empty"
metrics:
  duration: 4min
  completed: 2026-02-24
---

# Quick Task 1: Fix ForecastPage Error and Dashboard Chart Error State — Summary

**One-liner:** Added retry buttons to ForecastPage tab error state and split Dashboard forecast chart into three distinct states (loading / error+retry / data or empty).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add retry button to ForecastPage error state | ff26f5b | frontend/src/pages/ForecastPage.tsx |
| 2 | Fix Dashboard forecast chart to distinguish error from empty state | 627773f | frontend/src/pages/DashboardPage.tsx |

## What Was Done

### Task 1 — ForecastPage retry button

The `isCurrentTabError` block previously showed a static red error box with no recovery path. A retry button was added with a `RotateCcw` icon. The `onClick` handler dispatches to the correct query refetch based on `activeTab`:

- `monthly` or `comparison` → `monthlyQuery.refetch()`
- `weekly` → `weeklyQuery.refetch()`
- `summary` → `summaryQuery.refetch()`

Both `RotateCcw` and `t('error.tryAgain')` were already available; no new imports or i18n keys were needed.

### Task 2 — Dashboard forecast chart three-state render

The forecast chart section previously collapsed both error and empty into the same "no data" placeholder. A new `forecastQuery.isError` branch was inserted between the loading skeleton and the `chartData.length > 0` check.

The error state shows:
- `AlertTriangle` icon with `var(--bg-danger)` background
- `t('common.error')` label in expense red
- Retry button with `RefreshCw` icon calling `forecastQuery.refetch()`

The "no data" state is now only shown when the query succeeds but the months array is empty — correctly distinguishing a failure from absence of data.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

Both tasks verified by `npm run build` completing with zero TypeScript errors and zero build errors. Chunk size warnings are pre-existing and unrelated.

## Self-Check

- [x] `frontend/src/pages/ForecastPage.tsx` modified — RotateCcw retry button present
- [x] `frontend/src/pages/DashboardPage.tsx` modified — forecastQuery.isError branch present
- [x] Commit ff26f5b exists
- [x] Commit 627773f exists
- [x] Build passes cleanly (2.07s, 0 errors)

## Self-Check: PASSED
