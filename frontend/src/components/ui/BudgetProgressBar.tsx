import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface BudgetProgressBarProps {
  /** Actual amount spent */
  actual: string
  /** Budget limit amount */
  budget: string
  /** Usage percentage (0-100+) */
  usagePercentage: number
  /** Whether over budget */
  isOverBudget: boolean
  /** Remaining amount (can be negative) */
  remaining: string
  /** Currency symbol */
  currency?: string
  /** Category name */
  categoryName?: string
  /** Category color */
  categoryColor?: string
  /** Optional class */
  className?: string
}

function getStatusColor(pct: number, isOver: boolean): string {
  if (isOver) return 'var(--color-danger)'
  if (pct >= 80) return 'var(--color-warning)'
  return 'var(--color-success)'
}

export default function BudgetProgressBar({
  actual,
  budget,
  usagePercentage,
  isOverBudget,
  remaining,
  currency = '₪',
  categoryName,
  categoryColor,
  className = '',
}: BudgetProgressBarProps) {
  const { t } = useTranslation()
  const clampedWidth = useMemo(() => Math.min(usagePercentage, 100), [usagePercentage])
  const statusColor = useMemo(() => getStatusColor(usagePercentage, isOverBudget), [usagePercentage, isOverBudget])

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${className}`}
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* Header: category name + percentage */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {categoryColor && (
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
          )}
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {categoryName || t('budgets.budget')}
          </span>
        </div>
        <span
          className="text-sm font-bold"
          style={{ color: statusColor }}
        >
          {usagePercentage.toFixed(usagePercentage % 1 === 0 ? 0 : 1)}%
          {isOverBudget && ' ⚠'}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-3 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: isOverBudget ? 'var(--bg-danger)' : 'var(--bg-success)' }}
        role="progressbar"
        aria-valuenow={usagePercentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`absolute inset-y-0 start-0 rounded-full transition-all duration-500 ease-out ${
            isOverBudget ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${clampedWidth}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>

      {/* Amounts row */}
      <div
        className="mt-2 flex items-center justify-between text-xs"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>
          {currency}{actual} / {currency}{budget}
        </span>
        <span style={{ color: isOverBudget ? 'var(--color-danger)' : 'var(--text-tertiary)' }}>
          {isOverBudget
            ? `${t('budgets.overage')}: ${currency}${remaining.replace('-', '')}`
            : `${t('budgets.remaining')}: ${currency}${remaining}`
          }
        </span>
      </div>
    </div>
  )
}
