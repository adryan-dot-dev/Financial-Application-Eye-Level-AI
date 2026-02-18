import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardPeriodData } from '@/api/dashboard'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthlyChartDataPoint {
  month: string
  income: number
  expenses: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonthLabel(periodStr: string): string {
  const normalized = periodStr.length > 7 ? periodStr.slice(0, 7) : periodStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return periodStr
  return date.toLocaleDateString('en-US', { month: 'short' })
}

function buildMonthlyChartData(months: DashboardPeriodData[]): MonthlyChartDataPoint[] {
  return months.slice(-6).map((m) => ({
    month: formatMonthLabel(m.period),
    income: Math.abs(parseFloat(m.income) || 0),
    expenses: Math.abs(parseFloat(m.expenses) || 0),
  }))
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBox({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('skeleton', className)}
      style={style}
    />
  )
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ComparisonTooltip({
  active,
  payload,
  label,
  t,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
  t: (key: string) => string
}) {
  const { formatAmount } = useCurrency()
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="glass-tooltip">
      <p
        className="text-xs font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </p>
      {payload.map((entry) => {
        const nameKey =
          entry.dataKey === 'income'
            ? t('dashboard.monthlyIncome')
            : t('dashboard.monthlyExpenses')
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {nameKey}
              </span>
            </div>
            <span
              className="text-[11px] font-semibold ltr-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatAmount(entry.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MonthlyComparisonChart
// ---------------------------------------------------------------------------

export function MonthlyComparisonChart() {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  const monthlyQuery = useQuery<DashboardPeriodData[]>({
    queryKey: ['dashboard', 'monthly'] as const,
    queryFn: () => dashboardApi.monthly(),
  })

  const chartData = useMemo(() => {
    if (!monthlyQuery.data || monthlyQuery.data.length === 0) return []
    return buildMonthlyChartData(monthlyQuery.data)
  }, [monthlyQuery.data])

  // Calculate net for the period
  const netTotal = useMemo(() => {
    return chartData.reduce((acc, point) => acc + point.income - point.expenses, 0)
  }, [chartData])

  const isNetPositive = netTotal >= 0

  // --- Loading skeleton ---
  if (monthlyQuery.isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up p-7">
        <div className="flex items-center gap-3 mb-6">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <div>
            <SkeletonBox className="h-4 w-40 rounded" />
            <SkeletonBox className="mt-1.5 h-3 w-56 rounded" />
          </div>
        </div>
        <SkeletonBox className="h-[300px] w-full rounded-xl" />
        <SkeletonBox className="mt-4 h-4 w-48 rounded" />
      </div>
    )
  }

  // --- Empty state ---
  if (!chartData || chartData.length === 0) {
    return (
      <div className="card card-hover animate-fade-in-up flex flex-col items-center justify-center p-12">
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--bg-hover)' }}
        >
          <BarChart3 className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {t('common.noData')}
        </p>
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
              backgroundColor: 'rgba(67, 24, 255, 0.08)',
              color: 'var(--color-brand-500)',
            }}
          >
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.monthlyComparison')}
            </h3>
            <p
              className="mt-0.5 text-xs"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('dashboard.monthlyComparisonDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px] px-1" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            {/* Solid fills — no gradients */}
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--border-primary)"
              strokeOpacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
              }
              width={50}
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <ComparisonTooltip
                  active={active}
                  payload={payload as Array<{ value: number; dataKey: string; color: string }> | undefined}
                  label={label as string | undefined}
                  t={t}
                />
              )}
              cursor={{ fill: 'var(--bg-hover)', opacity: 0.4 }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                paddingTop: '16px',
              }}
              formatter={(value: string) =>
                value === 'income'
                  ? t('dashboard.monthlyIncome')
                  : t('dashboard.monthlyExpenses')
              }
            />
            <Bar
              dataKey="income"
              fill="var(--color-success)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={450}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="expenses"
              fill="var(--color-danger)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={450}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net Cashflow Summary */}
      <div
        className="mt-5 flex items-center gap-2 rounded-xl px-4 py-3"
        style={{
          backgroundColor: isNetPositive
            ? 'var(--bg-success)'
            : 'var(--bg-danger)',
        }}
      >
        {isNetPositive ? (
          <TrendingUp
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--color-success)' }}
          />
        ) : (
          <TrendingDown
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--color-danger)' }}
          />
        )}
        <span
          className="text-sm font-semibold"
          style={{
            color: isNetPositive
              ? 'var(--color-success)'
              : 'var(--color-danger)',
          }}
        >
          {isNetPositive
            ? t('dashboard.netPositive')
            : t('dashboard.netNegative')}
        </span>
        <span
          className="ltr-nums text-sm font-bold ms-auto"
          style={{
            color: isNetPositive
              ? 'var(--color-success)'
              : 'var(--color-danger)',
          }}
        >
          {formatAmount(Math.abs(netTotal))}
        </span>
      </div>
    </div>
  )
}
