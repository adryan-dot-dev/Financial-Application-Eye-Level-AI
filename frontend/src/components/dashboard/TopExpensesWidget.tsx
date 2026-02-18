import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { TrendingDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { TopExpensesResponse } from '@/api/dashboard'
import { cn, formatDate } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGH_EXPENSE_THRESHOLD = 5000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEmoji(str: string | null | undefined): boolean {
  if (!str) return false
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u
  return emojiRegex.test(str)
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBox({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} />
}

// ---------------------------------------------------------------------------
// TopExpensesWidget
// ---------------------------------------------------------------------------

export function TopExpensesWidget() {
  const { t, i18n } = useTranslation()
  const isHe = i18n.language === 'he'
  const isRtl = isHe
  const { formatAmount } = useCurrency()

  const { data, isLoading } = useQuery<TopExpensesResponse>({
    queryKey: queryKeys.dashboard.topExpenses(),
    queryFn: () => dashboardApi.topExpenses(),
  })

  const items = data?.items ?? []

  // Calculate max amount for relative bar widths
  const maxAmount = items.reduce((max, item) => {
    const val = parseFloat(item.amount) || 0
    return val > max ? val : max
  }, 0)

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up overflow-hidden p-7">
        <div className="flex items-center gap-3 mb-6">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <div>
            <SkeletonBox className="h-4 w-32 rounded" />
            <SkeletonBox className="mt-1.5 h-3 w-48 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3">
                <SkeletonBox className="h-6 w-6 rounded-full" />
                <SkeletonBox className="h-4 w-28 rounded" />
                <div className="flex-1" />
                <SkeletonBox className="h-4 w-16 rounded" />
              </div>
              <SkeletonBox className="h-1.5 rounded-full" style={{ width: `${90 - i * 12}%` }} />
            </div>
          ))}
        </div>
        <SkeletonBox className="mt-6 h-4 w-20 rounded" />
      </div>
    )
  }

  // --- Empty state ---
  if (items.length === 0) {
    return (
      <div className="card card-hover animate-fade-in-up overflow-hidden p-7">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'rgba(238, 93, 80, 0.08)',
              color: 'var(--color-danger)',
            }}
          >
            <TrendingDown className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.topExpenses')}
            </h3>
            <p
              className="mt-0.5 text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('dashboard.topExpensesDesc')}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-10">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <TrendingDown className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('dashboard.noExpenses')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-hover animate-fade-in-up overflow-hidden p-7">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'rgba(238, 93, 80, 0.08)',
              color: 'var(--color-danger)',
            }}
          >
            <TrendingDown className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.topExpenses')}
            </h3>
            <p
              className="mt-0.5 text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('dashboard.topExpensesDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Expense items */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const amount = parseFloat(item.amount) || 0
          const barWidthPct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
          const categoryColor = item.category_color || 'var(--color-danger)'
          const categoryName = isHe
            ? (item.category_name_he ?? item.category_name)
            : (item.category_name ?? item.category_name_he)
          const dateLocale = isHe ? 'he-IL' : 'en-US'
          const isHighExpense = amount > HIGH_EXPENSE_THRESHOLD

          return (
            <div
              key={item.id}
              className="space-y-1.5 rounded-xl px-2.5 py-2 transition-colors"
              style={{
                backgroundColor: isHighExpense ? 'rgba(238, 93, 80, 0.06)' : 'transparent',
                border: isHighExpense ? '1px solid rgba(238, 93, 80, 0.15)' : '1px solid transparent',
              }}
            >
              {/* Top row: rank, icon/dot, description, date, amount */}
              <div className="flex items-center gap-2.5">
                {/* Rank number */}
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isHighExpense ? 'rgba(238, 93, 80, 0.12)' : 'var(--bg-hover)',
                  }}
                >
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: isHighExpense ? 'var(--color-danger)' : 'var(--text-tertiary)' }}
                  >
                    {index + 1}
                  </span>
                </div>

                {/* Category indicator (emoji, letter, or dot) */}
                {item.category_icon && isEmoji(item.category_icon) ? (
                  <span className="shrink-0 text-sm leading-none">
                    {item.category_icon}
                  </span>
                ) : item.category_icon ? (
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: categoryColor }}
                  >
                    {item.category_icon.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                )}

                {/* Description */}
                <span
                  className="min-w-0 flex-1 truncate text-[13px] font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.description}
                </span>

                {/* Date */}
                <span
                  className="shrink-0 text-[10px] font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {formatDate(item.date, dateLocale)}
                </span>

                {/* Amount */}
                <span
                  className="shrink-0 text-[13px] font-bold ltr-nums"
                  style={{ color: 'var(--color-danger)' }}
                >
                  {formatAmount(item.amount, item.currency)}
                </span>
              </div>

              {/* Bottom row: relative bar + category badge + high expense badge */}
              <div className="flex items-center gap-2.5 ps-8">
                {/* Relative bar */}
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidthPct}%`,
                    backgroundColor: categoryColor,
                    opacity: 0.6,
                  }}
                />

                {/* Category badge */}
                {categoryName && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${categoryColor}14`,
                      color: categoryColor,
                    }}
                  >
                    {categoryName}
                  </span>
                )}

                {/* High expense warning badge */}
                {isHighExpense && (
                  <span
                    className="shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: 'rgba(238, 93, 80, 0.12)',
                      color: 'var(--color-danger)',
                    }}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {t('dashboard.highExpense')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* View All link */}
      <div className="mt-6">
        <Link
          to="/transactions"
          className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
          style={{ color: 'var(--border-focus)' }}
        >
          {t('dashboard.viewAll')}
          <ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')} />
        </Link>
      </div>
    </div>
  )
}
