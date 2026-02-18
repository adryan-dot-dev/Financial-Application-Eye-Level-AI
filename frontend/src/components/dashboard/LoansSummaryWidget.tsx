import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Banknote, ChevronRight } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { LoansSummaryResponse } from '@/api/dashboard'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBox({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />
}

// ---------------------------------------------------------------------------
// LoansSummaryWidget
// ---------------------------------------------------------------------------

export function LoansSummaryWidget() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'he'
  const { formatAmount } = useCurrency()

  const { data, isLoading } = useQuery<LoansSummaryResponse>({
    queryKey: queryKeys.dashboard.loansSummary(),
    queryFn: () => dashboardApi.loansSummary(),
  })

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up overflow-hidden flex flex-col">
        {/* Header skeleton */}
        <div className="flex items-center justify-between border-b px-7 py-5" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-9 w-9 rounded-xl" />
            <SkeletonBox className="h-4 w-32 rounded" />
          </div>
          <SkeletonBox className="h-3 w-16 rounded" />
        </div>
        <div className="px-7 py-5 flex flex-col gap-4">
          {/* Overall progress skeleton */}
          <SkeletonBox className="h-3 w-full rounded-full" />
          <div className="flex justify-between">
            <SkeletonBox className="h-3 w-24 rounded" />
            <SkeletonBox className="h-3 w-10 rounded" />
          </div>
          {/* KPI strip skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBox className="h-16 rounded-xl" />
            <SkeletonBox className="h-16 rounded-xl" />
          </div>
          {/* Loan items skeleton */}
          <SkeletonBox className="h-20 rounded-xl" />
          <SkeletonBox className="h-20 rounded-xl" />
        </div>
      </div>
    )
  }

  const activeCount = data?.active_count ?? 0
  const overallPct = parseFloat(data?.overall_progress_pct ?? '0')
  const hasLoans = data && activeCount > 0

  // --- Empty state ---
  if (!hasLoans) {
    return (
      <div className="card card-hover animate-fade-in-up overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-7 py-5"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'rgba(67, 24, 255, 0.08)',
                color: 'var(--color-brand-500)',
              }}
            >
              <Banknote className="h-4.5 w-4.5" />
            </div>
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.loansSummary')}
            </h3>
          </div>
        </div>
        {/* Empty body */}
        <div className="flex flex-1 flex-col items-center justify-center px-7 py-12">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <Banknote className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('dashboard.noLoans')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-hover animate-fade-in-up overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'rgba(67, 24, 255, 0.08)',
                color: 'var(--color-brand-500)',
              }}
            >
              <Banknote className="h-4.5 w-4.5" />
            </div>
            {activeCount > 0 && (
              <span
                className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--color-accent-purple)' }}
              >
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.loansSummary')}
            </h3>
            {activeCount > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--color-accent-purple)' }}
              >
                {activeCount}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/loans"
          className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
          style={{ color: 'var(--color-brand-500)' }}
        >
          {t('dashboard.viewAll')}
          <ChevronRight
            className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')}
          />
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 px-7 py-5">
        {/* Overall Progress Bar */}
        <div>
          <div
            className="h-3 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(overallPct, 100)}%`,
                backgroundColor: 'var(--color-brand-500)',
                transition: 'width 0.8s ease-out',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('dashboard.overallProgress')}
            </span>
            <span
              className="text-xs font-bold ltr-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {overallPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3">
          {/* Monthly Payments */}
          <div
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <p
              className="text-[11px] font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('dashboard.monthlyLoanPayments')}
            </p>
            <p
              className="mt-1 text-sm font-bold ltr-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatAmount(data.total_monthly_payments)}
            </p>
          </div>
          {/* Total Remaining */}
          <div
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <p
              className="text-[11px] font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('dashboard.totalRemaining')}
            </p>
            <p
              className="mt-1 text-sm font-bold ltr-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatAmount(data.total_remaining_balance)}
            </p>
          </div>
        </div>

        {/* Loan Items (scrollable) */}
        <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[240px]">
          {data.items.map((loan) => {
            const progressPct = parseFloat(loan.progress_pct || '0')

            return (
              <div
                key={loan.id}
                className="rounded-xl px-3.5 py-3.5"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                {/* Top row: icon + name + monthly payment */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: 'rgba(67, 24, 255, 0.08)',
                        color: 'var(--color-brand-500)',
                      }}
                    >
                      <Banknote className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {loan.name}
                      </p>
                      {/* Interest rate badge */}
                      <span
                        className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: 'rgba(67, 24, 255, 0.08)',
                          color: 'var(--color-brand-500)',
                        }}
                      >
                        {parseFloat(loan.interest_rate).toFixed(1)}% APR
                      </span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-sm font-bold ltr-nums whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatAmount(loan.monthly_payment, loan.currency)}/mo
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full"
                      style={{ backgroundColor: 'var(--border-primary)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(progressPct, 100)}%`,
                          backgroundColor: 'var(--color-brand-500)',
                          transition: 'width 0.8s ease-out',
                        }}
                      />
                    </div>
                    <span
                      className="shrink-0 text-[11px] font-semibold ltr-nums"
                      style={{ color: 'var(--color-brand-500)' }}
                    >
                      {progressPct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Bottom row: payments made / remaining */}
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className="text-[11px] ltr-nums"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {loan.payments_made} {t('dashboard.of')} {loan.total_payments} {t('dashboard.payments')}
                  </span>
                  <span
                    className="text-[11px] font-semibold ltr-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatAmount(loan.remaining_balance, loan.currency)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
