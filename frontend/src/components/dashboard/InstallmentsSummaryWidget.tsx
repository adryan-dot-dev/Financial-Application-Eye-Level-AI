import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CreditCard, ChevronRight } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { InstallmentsSummaryResponse, InstallmentSummaryItem } from '@/api/dashboard'
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
// Segmented Progress Bar
// ---------------------------------------------------------------------------

function SegmentedProgressBar({
  completed,
  total,
  accentColor,
}: {
  completed: number
  total: number
  accentColor: string
}) {
  const maxSegments = Math.min(total, 12)
  const filledSegments = Math.round((completed / total) * maxSegments)

  return (
    <div className="flex gap-1">
      {Array.from({ length: maxSegments }).map((_, i) => (
        <div
          key={i}
          className="h-2 flex-1 rounded-full"
          style={{
            backgroundColor: i < filledSegments ? accentColor : 'var(--bg-tertiary)',
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item Row
// ---------------------------------------------------------------------------

function InstallmentItemRow({
  item,
  t,
}: {
  item: InstallmentSummaryItem
  t: (key: string) => string
}) {
  const { formatAmount } = useCurrency()
  const isExpense = item.type === 'expense'
  const accentColor = isExpense ? 'var(--color-brand-500)' : 'var(--color-success)'
  const amountColor = isExpense ? 'var(--color-danger)' : 'var(--color-income)'

  return (
    <div
      className="rounded-xl px-3.5 py-3 transition-colors"
      style={{ backgroundColor: 'var(--bg-hover)' }}
    >
      {/* Top row: name + amount */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span
            className="text-[13px] font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {item.name}
          </span>
        </div>
        <span
          className="text-[13px] font-bold ltr-nums shrink-0"
          style={{ color: amountColor }}
        >
          {isExpense ? '-' : '+'}{formatAmount(item.monthly_amount, item.currency)}
        </span>
      </div>

      {/* Segmented progress bar */}
      <div className="mt-2.5">
        <SegmentedProgressBar
          completed={item.payments_completed}
          total={item.total_payments}
          accentColor={accentColor}
        />
      </div>

      {/* Meta: payments progress text */}
      <p
        className="mt-1.5 text-[10px] font-medium"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {item.payments_completed} {t('dashboard.of')} {item.total_payments} {t('dashboard.payments')}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InstallmentsSummaryWidget
// ---------------------------------------------------------------------------

export function InstallmentsSummaryWidget() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'he'
  const { formatAmount } = useCurrency()

  const { data, isLoading } = useQuery<InstallmentsSummaryResponse>({
    queryKey: queryKeys.dashboard.installmentsSummary(),
    queryFn: () => dashboardApi.installmentsSummary(),
  })

  const items = data?.items ?? []
  const activeCount = data?.active_count ?? 0
  const totalMonthlyExpense = data?.total_monthly_expense ?? '0'
  const totalMonthlyIncome = data?.total_monthly_income ?? '0'
  const totalRemaining = data?.total_remaining ?? '0'

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up overflow-hidden flex flex-col">
        <div
          className="flex items-center justify-between border-b px-7 py-5"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <SkeletonBox className="h-9 w-9 rounded-xl" />
            <SkeletonBox className="h-5 w-40 rounded" />
          </div>
          <SkeletonBox className="h-7 w-20 rounded-xl" />
        </div>
        <div className="px-7 py-4">
          <div className="flex items-center justify-between gap-4">
            <SkeletonBox className="h-10 w-24 rounded-lg" />
            <SkeletonBox className="h-10 w-24 rounded-lg" />
            <SkeletonBox className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 px-4 py-3 space-y-2">
          <SkeletonBox className="h-[72px] w-full rounded-xl" />
          <SkeletonBox className="h-[72px] w-full rounded-xl" />
          <SkeletonBox className="h-[72px] w-full rounded-xl" />
        </div>
        <div
          className="border-t px-7 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <SkeletonBox className="h-4 w-48 rounded" />
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
              style={{ backgroundColor: 'rgba(67, 24, 255, 0.08)' }}
            >
              <CreditCard className="h-4.5 w-4.5" style={{ color: 'var(--color-brand-500)' }} />
            </div>
            {/* Count badge */}
            {activeCount > 0 && (
              <span
                className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--color-brand-500)' }}
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
              {t('dashboard.installmentsSummary')}
            </h3>
            {activeCount > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--color-brand-500)' }}
              >
                {activeCount}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/installments"
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all hover:shadow-sm"
          style={{
            color: 'var(--border-focus)',
            backgroundColor: 'var(--bg-hover)',
          }}
        >
          {t('dashboard.viewAll')}
          <ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')} />
        </Link>
      </div>

      {/* KPI strip */}
      <div
        className="grid grid-cols-3 gap-3 border-b px-7 py-4"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {/* Active count */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('dashboard.activeInstallments')}
          </span>
          <span
            className="text-lg font-bold ltr-nums"
            style={{ color: 'var(--text-primary)' }}
          >
            {activeCount}
          </span>
        </div>

        {/* Monthly expense */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('dashboard.monthlyInstExpense')}
          </span>
          <span
            className="text-sm font-bold ltr-nums"
            style={{ color: 'var(--color-danger)' }}
          >
            {formatAmount(totalMonthlyExpense)}
          </span>
        </div>

        {/* Monthly income */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('dashboard.monthlyInstIncome')}
          </span>
          <span
            className="text-sm font-bold ltr-nums"
            style={{ color: 'var(--color-income)' }}
          >
            {formatAmount(totalMonthlyIncome)}
          </span>
        </div>
      </div>

      {/* Items list or empty state */}
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 px-7">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <CreditCard className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('dashboard.noInstallments')}
          </p>
        </div>
      ) : (
        <>
          {/* Scrollable items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[280px]">
            <div className="space-y-2">
              {items.map((item) => (
                <InstallmentItemRow key={item.id} item={item} t={t} />
              ))}
            </div>
          </div>

          {/* Footer: total remaining */}
          <div
            className="border-t px-7 py-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('dashboard.remainingTotal')}
              </span>
              <span
                className="text-sm font-bold ltr-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {formatAmount(totalRemaining)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
