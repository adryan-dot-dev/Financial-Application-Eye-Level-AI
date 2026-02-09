import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  BarChart3,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { ForecastMonth, ForecastSummary } from '@/types'
import { forecastApi } from '@/api/forecast'
import type { WeeklyForecastWeek } from '@/api/forecast'
import { cn, formatCurrency } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabValue = 'monthly' | 'weekly' | 'summary'

interface MonthlyChartDataPoint {
  month: string
  income: number
  expenses: number
  closingBalance: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_OPTIONS = [3, 6, 12] as const

function formatMonthLabel(monthStr: string): string {
  const date = new Date(monthStr + '-01')
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildMonthlyChartData(months: ForecastMonth[]): MonthlyChartDataPoint[] {
  return months.map((m) => ({
    month: formatMonthLabel(m.month),
    income: parseFloat(m.total_income),
    expenses: Math.abs(parseFloat(m.total_expenses)),
    closingBalance: parseFloat(m.closing_balance),
  }))
}

function isNegative(val: string): boolean {
  return parseFloat(val) < 0
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded', className)}
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    />
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value,
  accentColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accentColor: string
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: accentColor + '18', color: accentColor }}
      >
        {icon}
      </div>
      <p
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="ltr-nums mt-1 text-xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Forecast Chart
// ---------------------------------------------------------------------------

function MonthlyChart({ data }: { data: MonthlyChartDataPoint[] }) {
  const { t } = useTranslation()

  if (data.length === 0) return null

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="h-[320px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-primary)' }}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-primary)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                color: 'var(--text-primary)',
                fontSize: '12px',
              }}
              formatter={(value: number | undefined, name: string | undefined) => [
                formatCurrency(value ?? 0),
                (name ?? '') === 'income'
                  ? t('dashboard.monthlyIncome')
                  : (name ?? '') === 'expenses'
                    ? t('dashboard.monthlyExpenses')
                    : t('forecast.closingBalance'),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}
              formatter={(value: string) =>
                value === 'income'
                  ? t('dashboard.monthlyIncome')
                  : value === 'expenses'
                    ? t('dashboard.monthlyExpenses')
                    : t('forecast.closingBalance')
              }
            />
            <Bar
              dataKey="income"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
              barSize={24}
              opacity={0.85}
            />
            <Bar
              dataKey="expenses"
              fill="#EF4444"
              radius={[4, 4, 0, 0]}
              barSize={24}
              opacity={0.85}
            />
            <Line
              type="monotone"
              dataKey="closingBalance"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Table
// ---------------------------------------------------------------------------

function MonthlyTable({
  months,
  isRtl,
}: {
  months: ForecastMonth[]
  isRtl: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              {[
                t('forecast.months'),
                t('forecast.openingBalance'),
                t('dashboard.monthlyIncome'),
                t('dashboard.monthlyExpenses'),
                t('forecast.closingBalance'),
              ].map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)', textAlign: isRtl ? 'right' : 'left' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => {
              const closingNeg = isNegative(month.closing_balance)
              const netNeg = isNegative(month.net_change)

              return (
                <tr
                  key={month.month}
                  className="border-b transition-colors"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: closingNeg ? 'rgba(239, 68, 68, 0.05)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = closingNeg
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = closingNeg
                      ? 'rgba(239, 68, 68, 0.05)'
                      : ''
                  }}
                >
                  {/* Month */}
                  <td
                    className="whitespace-nowrap px-4 py-3 font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div className="flex items-center gap-2">
                      {formatMonthLabel(month.month)}
                      {closingNeg && (
                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--color-expense)' }} />
                      )}
                    </div>
                  </td>

                  {/* Opening balance */}
                  <td
                    className="whitespace-nowrap px-4 py-3 tabular-nums ltr-nums"
                    style={{
                      color: isNegative(month.opening_balance)
                        ? 'var(--color-expense)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {formatCurrency(month.opening_balance)}
                  </td>

                  {/* Total income */}
                  <td
                    className="whitespace-nowrap px-4 py-3 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-income)' }}
                  >
                    {formatCurrency(month.total_income)}
                  </td>

                  {/* Total expenses */}
                  <td
                    className="whitespace-nowrap px-4 py-3 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-expense)' }}
                  >
                    {formatCurrency(month.total_expenses)}
                  </td>

                  {/* Closing balance */}
                  <td
                    className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums ltr-nums"
                    style={{
                      color: closingNeg ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {formatCurrency(month.closing_balance)}
                      <span
                        className="text-xs font-normal"
                        style={{ color: netNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
                      >
                        ({netNeg ? '' : '+'}{formatCurrency(month.net_change)})
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly Table
// ---------------------------------------------------------------------------

function WeeklyTable({
  weeks,
  isRtl,
}: {
  weeks: WeeklyForecastWeek[]
  isRtl: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              {[
                t('transactions.from'),
                t('transactions.to'),
                t('transactions.income'),
                t('transactions.expense'),
                t('dashboard.netCashflow'),
                t('balance.current'),
              ].map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)', textAlign: isRtl ? 'right' : 'left' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const closingNeg = isNegative(week.closing_balance)
              const netNeg = isNegative(week.net_change)

              return (
                <tr
                  key={week.week_start}
                  className="border-b transition-colors"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: closingNeg ? 'rgba(239, 68, 68, 0.05)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = closingNeg
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = closingNeg
                      ? 'rgba(239, 68, 68, 0.05)'
                      : ''
                  }}
                >
                  <td
                    className="whitespace-nowrap px-4 py-3 ltr-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatWeekLabel(week.week_start)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 ltr-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatWeekLabel(week.week_end)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-income)' }}
                  >
                    {formatCurrency(week.income)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-expense)' }}
                  >
                    {formatCurrency(week.expenses)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 font-medium tabular-nums ltr-nums"
                    style={{ color: netNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
                  >
                    {netNeg ? '' : '+'}{formatCurrency(week.net_change)}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums ltr-nums"
                    style={{
                      color: closingNeg ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {formatCurrency(week.closing_balance)}
                      {closingNeg && (
                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--color-expense)' }} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary Tab
// ---------------------------------------------------------------------------

function SummaryView({
  summary,
  isLoading,
}: {
  summary: ForecastSummary | undefined
  isLoading: boolean
}) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-5"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-6 w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('common.noData')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Negative balance warning */}
      {summary.has_negative_months && (
        <div
          className="flex items-center gap-3 rounded-xl border px-5 py-4"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: '#EF4444' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>
              {t('forecast.negativeWarning')}
            </p>
            {summary.alerts_count > 0 && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {summary.alerts_count} {t('alerts.title').toLowerCase()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t('dashboard.monthlyIncome')}
          value={formatCurrency(summary.total_expected_income)}
          accentColor="#10B981"
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5" />}
          label={t('dashboard.monthlyExpenses')}
          value={formatCurrency(summary.total_expected_expenses)}
          accentColor="#EF4444"
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label={t('dashboard.netCashflow')}
          value={formatCurrency(summary.net_projected)}
          accentColor={parseFloat(summary.net_projected) >= 0 ? '#10B981' : '#EF4444'}
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label={t('forecast.closingBalance')}
          value={formatCurrency(summary.end_balance)}
          accentColor={parseFloat(summary.end_balance) >= 0 ? '#3B82F6' : '#EF4444'}
        />
      </div>

      {/* Current balance & forecast period info */}
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('balance.current')}
            </p>
            <p className="ltr-nums mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(summary.current_balance)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.months')}
            </p>
            <p className="mt-1 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {summary.forecast_months}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('alerts.title')}
            </p>
            <p
              className="mt-1 text-lg font-bold"
              style={{
                color: summary.alerts_count > 0 ? 'var(--color-expense)' : 'var(--color-income)',
              }}
            >
              {summary.alerts_count}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ForecastPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'he'

  // State
  const [activeTab, setActiveTab] = useState<TabValue>('monthly')
  const [months, setMonths] = useState<number>(6)

  // Queries
  const monthlyQuery = useQuery({
    queryKey: ['forecast', 'monthly', months],
    queryFn: () => forecastApi.monthly(months),
    enabled: activeTab === 'monthly',
  })

  const weeklyQuery = useQuery({
    queryKey: ['forecast', 'weekly', months * 4],
    queryFn: () => forecastApi.weekly(months * 4),
    enabled: activeTab === 'weekly',
  })

  const summaryQuery = useQuery({
    queryKey: ['forecast', 'summary', months],
    queryFn: () => forecastApi.summary(months),
    enabled: activeTab === 'summary',
  })

  // Derived
  const monthlyData = monthlyQuery.data
  const weeklyData = weeklyQuery.data
  const summaryData = summaryQuery.data

  const chartData = monthlyData ? buildMonthlyChartData(monthlyData.months) : []

  // Tab configuration
  const tabs: { value: TabValue; label: string; icon: React.ReactNode }[] = [
    { value: 'monthly', label: t('forecast.monthly'), icon: <Calendar className="h-3.5 w-3.5" /> },
    { value: 'weekly', label: t('forecast.weekly'), icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { value: 'summary', label: t('forecast.summary'), icon: <TrendingUp className="h-3.5 w-3.5" /> },
  ]

  const isCurrentTabLoading =
    (activeTab === 'monthly' && monthlyQuery.isLoading) ||
    (activeTab === 'weekly' && weeklyQuery.isLoading) ||
    (activeTab === 'summary' && summaryQuery.isLoading)

  const isCurrentTabError =
    (activeTab === 'monthly' && monthlyQuery.isError) ||
    (activeTab === 'weekly' && weeklyQuery.isError) ||
    (activeTab === 'summary' && summaryQuery.isError)

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('forecast.title')}
        </h1>

        {/* Negative month warning badge */}
        {monthlyData?.has_negative_months && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('forecast.negativeWarning')}
          </div>
        )}
      </div>

      {/* Controls row: Tabs + Month selector */}
      <div
        className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Tab switcher */}
        <div
          className="flex rounded-lg border"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors first:rounded-s-lg last:rounded-e-lg"
                style={{
                  backgroundColor: active ? 'var(--border-focus)' : 'var(--bg-input)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('forecast.months')}:
          </span>
          <div
            className="flex rounded-lg border"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            {MONTH_OPTIONS.map((opt) => {
              const active = months === opt
              return (
                <button
                  key={opt}
                  onClick={() => setMonths(opt)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors first:rounded-s-lg last:rounded-e-lg"
                  style={{
                    backgroundColor: active ? 'var(--border-focus)' : 'var(--bg-input)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>

          {/* Loading indicator */}
          {isCurrentTabLoading && (
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: 'var(--text-tertiary)' }}
            />
          )}
        </div>
      </div>

      {/* Error state */}
      {isCurrentTabError && (
        <div
          className="flex items-center justify-center rounded-xl border p-12"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      )}

      {/* ================================================================
          Monthly Tab
          ================================================================ */}
      {activeTab === 'monthly' && !isCurrentTabError && (
        <>
          {monthlyQuery.isLoading ? (
            <TableSkeleton />
          ) : monthlyData && monthlyData.months.length > 0 ? (
            <>
              <MonthlyTable months={monthlyData.months} isRtl={isRtl} />
              <MonthlyChart data={chartData} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('common.noData')}
              </p>
            </div>
          )}
        </>
      )}

      {/* ================================================================
          Weekly Tab
          ================================================================ */}
      {activeTab === 'weekly' && !isCurrentTabError && (
        <>
          {weeklyQuery.isLoading ? (
            <TableSkeleton />
          ) : weeklyData && weeklyData.weeks.length > 0 ? (
            <WeeklyTable weeks={weeklyData.weeks} isRtl={isRtl} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Calendar className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('common.noData')}
              </p>
            </div>
          )}
        </>
      )}

      {/* ================================================================
          Summary Tab
          ================================================================ */}
      {activeTab === 'summary' && !isCurrentTabError && (
        <SummaryView summary={summaryData} isLoading={summaryQuery.isLoading} />
      )}
    </div>
  )
}
