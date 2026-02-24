---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/ForecastPage.tsx
  - frontend/src/pages/DashboardPage.tsx
autonomous: true
requirements:
  - QUICK-1
must_haves:
  truths:
    - "ForecastPage shows a retry button when the monthly/weekly/summary query errors — not just a static red box"
    - "Dashboard forecast chart shows an error state with retry when forecastQuery fails — not silently 'no data'"
    - "Dashboard forecast chart correctly shows data when forecastQuery succeeds with non-empty months"
  artifacts:
    - path: "frontend/src/pages/ForecastPage.tsx"
      provides: "Error state with retry button on isCurrentTabError"
      contains: "monthlyQuery.refetch"
    - path: "frontend/src/pages/DashboardPage.tsx"
      provides: "Forecast chart section with proper error/empty/data states"
      contains: "forecastQuery.isError"
  key_links:
    - from: "ForecastPage isCurrentTabError state"
      to: "query refetch functions"
      via: "retry button onClick"
      pattern: "monthlyQuery.refetch"
    - from: "DashboardPage forecast chart section"
      to: "forecastQuery.isError"
      via: "conditional render"
      pattern: "forecastQuery.isError"
---

<objective>
Fix two related issues:
1. ForecastPage shows a static red error box with no retry when any tab query fails — user is stuck.
2. Dashboard forecast chart shows a generic "no data" placeholder when forecastQuery errors — misleading.

Purpose: Both bugs leave the user with no recovery path. Adding retry and distinguishing error from empty state restores usability.
Output: ForecastPage error state gains a retry button. DashboardPage chart section gains a dedicated error state separate from the empty state.
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
  <name>Task 1: Add retry button to ForecastPage error state</name>
  <files>frontend/src/pages/ForecastPage.tsx</files>
  <action>
    Locate the error state block in the ForecastPage render (around line 2403-2416):

    ```tsx
    {isCurrentTabError && (
      <div className="card animate-fade-in-scale flex flex-col items-center justify-center p-16">
        <div
          className="icon-circle icon-circle-lg mb-4"
          style={{ backgroundColor: 'var(--bg-danger)', color: 'var(--color-expense)' }}
        >
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold" style={{ color: 'var(--color-expense)' }}>
          {t('common.error')}
        </p>
      </div>
    )}
    ```

    Replace with a version that includes a retry button. The retry function should call the correct refetch based on the active tab:

    ```tsx
    {isCurrentTabError && (
      <div className="card animate-fade-in-scale flex flex-col items-center justify-center p-16">
        <div
          className="icon-circle icon-circle-lg mb-4"
          style={{ backgroundColor: 'var(--bg-danger)', color: 'var(--color-expense)' }}
        >
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold" style={{ color: 'var(--color-expense)' }}>
          {t('common.error')}
        </p>
        <button
          onClick={() => {
            if (activeTab === 'monthly' || activeTab === 'comparison') monthlyQuery.refetch()
            if (activeTab === 'weekly') weeklyQuery.refetch()
            if (activeTab === 'summary') summaryQuery.refetch()
          }}
          className="btn-press mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
          style={{
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <RotateCcw className="h-4 w-4" />
          {t('error.tryAgain')}
        </button>
      </div>
    )}
    ```

    `RotateCcw` is already imported at line 32. `t('error.tryAgain')` already exists in the i18n files.
    Do NOT change any other code in the file.
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -5</automated>
    <manual>Temporarily make the forecast API return an error (e.g. stop backend). Observe that ForecastPage shows the red error box with a "Try Again" button that calls the appropriate refetch.</manual>
  </verify>
  <done>
    - Build passes cleanly
    - The error state block in ForecastPage contains a retry button with `RotateCcw` icon
    - Clicking retry calls `monthlyQuery.refetch()`, `weeklyQuery.refetch()`, or `summaryQuery.refetch()` based on activeTab
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix Dashboard forecast chart to distinguish error from empty state</name>
  <files>frontend/src/pages/DashboardPage.tsx</files>
  <action>
    Locate the forecast chart section in DashboardPage (around line 1997-2023):

    ```tsx
    {!isAllError && (
      <div className="scroll-reveal content-reveal">
        {forecastQuery.isLoading ? (
          <div className="card animate-fade-in-up section-delay-2 p-7 skeleton-group">
            <SkeletonBox className="mb-6 h-5 w-44" />
            <SkeletonBox className="h-[340px] w-full rounded-xl" />
          </div>
        ) : chartData.length > 0 ? (
          <ForecastChart data={chartData} isRtl={isRtl} />
        ) : (
          <div className="card animate-fade-in-up section-delay-2 flex h-full items-center justify-center p-12">
            <div className="text-center">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <BarChart3 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {t('common.noData')}
              </p>
            </div>
          </div>
        )}
      </div>
    )}
    ```

    Replace with a three-state version: loading → error (with retry) → data or empty:

    ```tsx
    {!isAllError && (
      <div className="scroll-reveal content-reveal">
        {forecastQuery.isLoading ? (
          <div className="card animate-fade-in-up section-delay-2 p-7 skeleton-group">
            <SkeletonBox className="mb-6 h-5 w-44" />
            <SkeletonBox className="h-[340px] w-full rounded-xl" />
          </div>
        ) : forecastQuery.isError ? (
          <div className="card animate-fade-in-up section-delay-2 flex h-full items-center justify-center p-12">
            <div className="text-center">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--bg-danger)' }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-expense)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
                {t('common.error')}
              </p>
              <button
                onClick={() => forecastQuery.refetch()}
                className="btn-press mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('error.tryAgain')}
              </button>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <ForecastChart data={chartData} isRtl={isRtl} />
        ) : (
          <div className="card animate-fade-in-up section-delay-2 flex h-full items-center justify-center p-12">
            <div className="text-center">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <BarChart3 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {t('common.noData')}
              </p>
            </div>
          </div>
        )}
      </div>
    )}
    ```

    `AlertTriangle` is already imported at line 27. `RefreshCw` is already imported at line 27.
    `t('common.error')` and `t('error.tryAgain')` both exist in i18n files.
    Do NOT change any other code in the file.
  </action>
  <verify>
    <automated>cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build 2>&1 | tail -5</automated>
    <manual>With backend running: Dashboard shows forecast chart data correctly. Without backend (or when forecast endpoint errors): Dashboard shows red error box with retry button in the chart section — NOT "no data".</manual>
  </verify>
  <done>
    - Build passes cleanly
    - Forecast chart section in DashboardPage has three states: loading skeleton, error+retry, data/empty
    - `forecastQuery.isError` is explicitly handled before `chartData.length > 0` check
    - No other code in DashboardPage is changed
  </done>
</task>

</tasks>

<verification>
Run `cd /Users/roeiedri/dev/Financial-Application-Eye-Level-AI/frontend && npm run build` — must complete with 0 TypeScript errors and 0 build errors.
</verification>

<success_criteria>
- Build passes cleanly
- ForecastPage error state has a retry button that calls the active tab's query refetch
- Dashboard forecast chart section explicitly handles `forecastQuery.isError` with a visible error message and retry button
- The "no data" state is only shown when query succeeds but returns empty months array
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-forecastpage-error-and-dashboard-cha/1-SUMMARY.md` with what was done.
</output>
