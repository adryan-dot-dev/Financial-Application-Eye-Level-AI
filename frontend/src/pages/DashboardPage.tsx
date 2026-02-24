import { useEffect, useState, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'
import NumberFlow from '@number-flow/react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  Info,
  RefreshCw,
  PlusCircle,
  BarChart3,
  CreditCard,
  ChevronRight,
  ShieldAlert,
  Banknote,
  Calendar,
  Activity,
  Target,
  CalendarDays,
  Clock,
  Repeat,
  X,
  ChevronUp,
  ChevronDown,
  Gauge,
  AlertOctagon,
} from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardSummary, DashboardPeriodData, CategoryBreakdownResponse, UpcomingPaymentsResponse, SubscriptionsSummaryResponse } from '@/api/dashboard'
import { forecastApi } from '@/api/forecast'
import { alertsApi } from '@/api/alerts'
import { MonthlyComparisonChart } from '@/components/dashboard/MonthlyComparisonChart'
import { FinancialHealthWidget } from '@/components/dashboard/FinancialHealthWidget'
import { InstallmentsSummaryWidget } from '@/components/dashboard/InstallmentsSummaryWidget'
import { LoansSummaryWidget } from '@/components/dashboard/LoansSummaryWidget'
import { TopExpensesWidget } from '@/components/dashboard/TopExpensesWidget'
import { ObligoWidget } from '@/components/dashboard/ObligoWidget'
import { creditCardsApi } from '@/api/credit-cards'
import { budgetsApi } from '@/api/budgets'
import type { CreditCardSummary } from '@/types'
import type { BudgetSummary } from '@/types'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { useCountUp } from '@/hooks/useCountUp'
import { useCursorGlow } from '@/hooks/useCursorGlow'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import PeriodSelector from '@/components/ui/PeriodSelector'
import { usePeriodSelector } from '@/hooks/usePeriodSelector'
import type { ForecastMonth, Alert } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  rawValue: number
  trend: string
  accentColor: string
  sparklineColor: string
  isLoading: boolean
  staggerClass: string
  sparklineData: number[]
  extraClassName?: string
}

interface ChartDataPoint {
  month: string
  income: number
  expenses: number
  closingBalance: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTrend(trend: string): { value: number; isPositive: boolean } {
  const num = parseFloat(trend)
  if (isNaN(num)) return { value: 0, isPositive: true }
  return { value: Math.abs(num), isPositive: num >= 0 }
}

function buildChartData(months: ForecastMonth[], locale: string = 'en-US'): ChartDataPoint[] {
  return months.map((m) => ({
    month: formatMonthLabel(m.month, locale),
    income: parseFloat(m.total_income) || 0,
    expenses: Math.abs(parseFloat(m.total_expenses) || 0),
    closingBalance: parseFloat(m.closing_balance) || 0,
  }))
}

function formatMonthLabel(monthStr: string, locale: string = 'en-US'): string {
  const normalized = monthStr.length > 7 ? monthStr.slice(0, 7) : monthStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return monthStr
  return date.toLocaleDateString(locale, { month: 'short' })
}

function severityConfig(severity: Alert['severity']) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'var(--bg-danger)',
        border: 'var(--border-danger)',
        text: 'var(--color-danger)',
        dot: 'var(--color-danger)',
        icon: <ShieldAlert className="h-4 w-4 shrink-0" />,
      }
    case 'warning':
      return {
        bg: 'var(--bg-warning)',
        border: 'var(--border-warning)',
        text: 'var(--color-warning)',
        dot: 'var(--color-warning)',
        icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      }
    case 'info':
    default:
      return {
        bg: 'var(--bg-info)',
        border: 'var(--border-info)',
        text: 'var(--color-info)',
        dot: 'var(--color-info)',
        icon: <Info className="h-4 w-4 shrink-0" />,
      }
  }
}

function formatTodayDate(locale: string): string {
  return new Date().toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Extract sparkline-friendly number arrays from weekly period data */
function extractSparklineData(
  weeklyData: DashboardPeriodData[],
  field: 'income' | 'expenses' | 'net' | 'balance',
): number[] {
  if (!weeklyData || weeklyData.length === 0) return [0, 0, 0, 0]
  return weeklyData.map((w) => {
    const val = parseFloat(w[field]) || 0
    return field === 'expenses' ? Math.abs(val) : val
  })
}

// ---------------------------------------------------------------------------
// Skeleton helpers
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
// Mini Sparkline Component
// ---------------------------------------------------------------------------

function MiniSparkline({
  data,
  color,
  height = 48,
}: {
  data: number[]
  color: string
  height?: number
}) {
  const chartData = data.map((value, index) => ({ index, value }))
  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).slice(2, 6)}`

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero Balance Card (Glassmorphism)
// ---------------------------------------------------------------------------

function HeroBalanceCard({
  balance: _balance,
  netCashflow: _netCashflow,
  balanceTrend,
  isLoading,
  expectedBalance: _expectedBalance,
  isNetPositive,
  rawBalance,
  rawNetCashflow,
  rawExpectedBalance,
}: {
  balance: string
  netCashflow: string
  balanceTrend: string
  isLoading: boolean
  expectedBalance: string
  isNetPositive: boolean
  rawBalance: number
  rawNetCashflow: number
  rawExpectedBalance: number
}) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const { value: trendVal } = parseTrend(balanceTrend)

  if (isLoading) {
    return (
      <div
        className="hero-balance-card relative overflow-hidden rounded-2xl p-5 sm:p-8 animate-fade-in-up stagger-1 h-full"
        style={{
          background: 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 50%, var(--color-brand-400) 100%)',
          minHeight: 180,
        }}
      >
        {/* Decorative floating shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -end-20 h-56 w-56 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(40px)' }} />
          <div className="absolute -bottom-16 -start-16 h-40 w-40 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', filter: 'blur(30px)' }} />
        </div>
        <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-[1px]" />
        <div className="relative z-10 skeleton-group">
          <SkeletonBox className="h-4 w-28 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <SkeletonBox className="mt-4 h-10 w-52 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <SkeletonBox className="mt-3 h-4 w-36 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <SkeletonBox className="mt-4 h-16 w-64 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="hero-balance-card relative overflow-hidden rounded-2xl p-5 sm:p-8 animate-fade-in-up stagger-1 h-full"
      style={{
        background: 'linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 50%, var(--color-brand-400) 100%)',
      }}
    >
      {/* Decorative floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -end-20 h-56 w-56 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', filter: 'blur(40px)' }} />
        <div className="absolute -bottom-16 -start-16 h-40 w-40 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', filter: 'blur(30px)' }} />
      </div>
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/[0.03] backdrop-blur-[1px]" />

      <div className="relative z-10 flex flex-col gap-5">
        {/* Top row: balance + trend badge */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-white/70" />
              <p className="text-white/70 text-sm font-medium">
                {t('dashboard.currentBalance')}
              </p>
            </div>
            <p className="text-white fin-number-lg mt-2 sm:mt-3 ltr-nums truncate text-xl sm:text-2xl md:text-[2rem]">
              <span dir="ltr">
                <NumberFlow
                  value={rawBalance}
                  format={{ style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                  transformTiming={{ duration: 750, easing: 'ease-out' }}
                  spinTiming={{ duration: 750, easing: 'ease-out' }}
                />
              </span>
            </p>
            <p className="text-white/60 text-sm mt-2 flex items-center gap-2 overflow-hidden">
              <Activity className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {t('dashboard.netCashflow')}:{' '}
                <span dir="ltr">
                  <NumberFlow
                    value={rawNetCashflow}
                    format={{ style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                    transformTiming={{ duration: 750, easing: 'ease-out' }}
                    spinTiming={{ duration: 750, easing: 'ease-out' }}
                  />
                </span>
              </span>
            </p>
          </div>

          {/* Trend badge on hero */}
          {Math.abs(trendVal) >= 0.1 && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold self-start sm:self-auto"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                color: 'white',
              }}
            >
              {trendVal >= 0 ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {Math.abs(trendVal).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Expected Balance - prominent display */}
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-4"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px) saturate(150%)',
            WebkitBackdropFilter: 'blur(16px) saturate(150%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: isNetPositive
                ? 'rgba(5, 205, 153, 0.25)'
                : 'rgba(238, 93, 80, 0.25)',
            }}
          >
            {isNetPositive ? (
              <TrendingUp className="h-5 w-5" style={{ color: 'var(--color-success-light)' }} />
            ) : (
              <TrendingDown className="h-5 w-5" style={{ color: 'var(--color-danger-light)' }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider">
              {t('dashboard.expectedBalance')}
            </p>
            <p className="text-white text-2xl font-bold ltr-nums tracking-tight mt-0.5 fin-number truncate">
              <span dir="ltr">
                <NumberFlow
                  value={rawExpectedBalance}
                  format={{ style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                  transformTiming={{ duration: 750, easing: 'ease-out' }}
                  spinTiming={{ duration: 750, easing: 'ease-out' }}
                />
              </span>
            </p>
          </div>
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0"
            style={{
              backgroundColor: isNetPositive
                ? 'rgba(5, 205, 153, 0.25)'
                : 'rgba(238, 93, 80, 0.25)',
              color: isNetPositive ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            }}
          >
            {isNetPositive ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {isNetPositive
              ? t('dashboard.expectedUp')
              : t('dashboard.expectedDown')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card with Sparkline
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value: _value,
  rawValue,
  trend,
  accentColor,
  sparklineColor,
  isLoading,
  staggerClass,
  sparklineData,
  extraClassName,
}: KpiCardProps) {
  const { currency } = useCurrency()
  const { value: trendVal, isPositive } = parseTrend(trend)

  if (isLoading) {
    return (
      <div className={cn('card overflow-hidden', staggerClass, 'animate-fade-in-up')}>
        <div className="h-1 skeleton" />
        <div className="p-5 skeleton-group">
          <div className="flex items-center gap-4">
            <SkeletonBox className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-3 w-20 rounded" />
              <SkeletonBox className="h-7 w-28 rounded" />
            </div>
            <SkeletonBox className="h-16 w-14 rounded-xl" />
          </div>
          <SkeletonBox className="mt-4 h-12 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'card overflow-hidden transition-all duration-300',
        'card-lift',
        'card-entrance',
        staggerClass,
        'animate-fade-in-up',
        extraClassName,
      )}
    >
      {/* Colored accent bar at top */}
      <div className="h-1" style={{ background: accentColor }} />

      <div className="p-4">
        {/* Label row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${accentColor}14`,
                color: accentColor,
              }}
            >
              {icon}
            </div>
            <p
              className="text-xs font-semibold"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {label}
            </p>
          </div>

          {/* Trend indicator */}
          {trendVal > 0 ? (
            <div
              className="flex items-center gap-1 rounded-lg px-2 py-1"
              style={{
                backgroundColor: isPositive
                  ? 'rgba(5, 205, 153, 0.1)'
                  : 'rgba(238, 93, 80, 0.1)',
                color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {isPositive ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-bold ltr-nums">
                {trendVal.toFixed(1)}%
              </span>
            </div>
          ) : null}
        </div>

        {/* Value - full width, no competing elements */}
        <p
          className="stat-highlight active fin-number text-2xl font-bold ltr-nums leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          <span className="tabular-nums" dir="ltr">
            <NumberFlow
              value={rawValue}
              format={{ style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              transformTiming={{ duration: 750, easing: 'ease-out' }}
              spinTiming={{ duration: 750, easing: 'ease-out' }}
            />
          </span>
        </p>

        {/* Sparkline in tinted container */}
        <div
          className="mt-4 -mx-1 overflow-hidden rounded-lg"
          style={{ backgroundColor: `${accentColor}06` }}
        >
          <MiniSparkline data={sparklineData} color={sparklineColor} height={52} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Forecast Chart
// ---------------------------------------------------------------------------

function CustomChartTooltip({
  active,
  payload,
  label,
  t,
  formatAmount,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
  t: (key: string) => string
  formatAmount: (amount: string | number | undefined | null, overrideCurrency?: string) => string
}) {
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
            : entry.dataKey === 'expenses'
              ? t('dashboard.monthlyExpenses')
              : t('forecast.closingBalance')
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
// Forecast Chart - Premium Gradient Area
// ---------------------------------------------------------------------------

function ForecastChart({
  data,
  isRtl,
}: {
  data: ChartDataPoint[]
  isRtl: boolean
}) {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  return (
    <div className="card card-hover animate-fade-in-up section-delay-2 overflow-hidden">
      {/* Widget header bar with icon circle */}
      <div
        className="flex items-center justify-between border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'rgba(67, 24, 255, 0.08)',
            }}
          >
            <BarChart3 className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
          </div>
          <div>
            <h3
              className="text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.forecast')}
            </h3>
            <p
              className="text-[11px]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {data.length > 0
                ? `${data[0].month} - ${data[data.length - 1].month}`
                : ''}
            </p>
          </div>
        </div>
        <Link
          to="/forecast"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:shadow-sm"
          style={{
            color: 'var(--border-focus)',
            backgroundColor: 'var(--bg-hover)',
          }}
        >
          {t('forecast.title')}
          <ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')} />
        </Link>
      </div>

      {/* Chart content area */}
      <div className="h-[240px] sm:h-[340px] px-3 sm:px-6 pt-4 sm:pt-6 pb-3" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-danger)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-danger)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-brand-500)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--color-brand-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
                <CustomChartTooltip
                  active={active}
                  payload={payload as Array<{ value: number; dataKey: string; color: string }> | undefined}
                  label={label as string | undefined}
                  t={t}
                  formatAmount={formatAmount}
                />
              )}
              cursor={{ stroke: 'var(--border-primary)', strokeDasharray: '4 4', strokeOpacity: 0.5 }}
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
                  : value === 'expenses'
                    ? t('dashboard.monthlyExpenses')
                    : t('forecast.closingBalance')
              }
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="var(--color-income)"
              fill="url(#incomeGradient)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-income)', style: { filter: 'drop-shadow(0 0 6px rgba(5, 205, 153, 0.4))' } }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="var(--color-danger)"
              fill="url(#expenseGradient)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-danger)', style: { filter: 'drop-shadow(0 0 6px rgba(238, 93, 80, 0.4))' } }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="closingBalance"
              stroke="var(--color-brand-500)"
              fill="url(#balanceGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-brand-500)', style: { filter: 'drop-shadow(0 0 6px rgba(108, 99, 255, 0.4))' } }}
              strokeDasharray="6 3"
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alerts Panel - Premium with severity borders & badge
// ---------------------------------------------------------------------------

function AlertsPanel({
  alerts,
  isRtl,
}: {
  alerts: Alert[]
  isRtl: boolean
}) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const displayAlerts = alerts.slice(0, 5)
  const unreadCount = displayAlerts.filter((a) => !a.is_read).length

  return (
    <div className="card card-hover animate-fade-in-up section-delay-2 flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <Bell className="h-4.5 w-4.5" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            {unreadCount > 0 && (
              <span
                className="badge-pulse absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--color-danger)' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3
              className="text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('dashboard.alerts')}
            </h3>
            {unreadCount > 0 && (
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {t('dashboard.unreadCount', { count: unreadCount })}
              </p>
            )}
          </div>
        </div>
        <Link
          to="/alerts"
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all hover:shadow-sm"
          style={{
            color: 'var(--border-focus)',
            backgroundColor: 'var(--bg-hover)',
          }}
        >
          {t('alerts.title')}
          <ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')} />
        </Link>
      </div>

      {/* Alert items — compact with expand */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {displayAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <Bell className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {t('dashboard.noAlerts')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayAlerts.map((alert) => {
              const sev = severityConfig(alert.severity)
              const isUnread = !alert.is_read
              const isExpanded = expandedId === alert.id

              return (
                <div key={alert.id}>
                  {/* Compact row: title + severity badge + expand arrow */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      backgroundColor: isUnread ? sev.bg : 'transparent',
                    }}
                  >
                    {/* Severity dot */}
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: sev.dot }}
                    />

                    {/* Title */}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[13px]',
                        isUnread ? 'font-semibold' : 'font-medium',
                      )}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {alert.title}
                    </span>

                    {/* Severity pill */}
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: sev.bg, color: sev.text }}
                    >
                      {t(`alerts.${alert.severity}`)}
                    </span>

                    {/* Expand arrow */}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                        isExpanded && 'rotate-180',
                      )}
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="mx-3 mb-1 rounded-lg px-3 py-2.5 animate-fade-in-up"
                      style={{ backgroundColor: 'var(--bg-hover)' }}
                    >
                      <p
                        className="text-[12px] leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {alert.message}
                      </p>
                      <Link
                        to="/alerts"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold"
                        style={{ color: 'var(--color-brand-500)' }}
                      >
                        {t('dashboard.viewAll')}
                        <ChevronRight className={cn('h-3 w-3', isRtl && 'rotate-180')} />
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick Actions - Gradient Icon Cards with hover lift
// ---------------------------------------------------------------------------

function QuickActions({ isRtl }: { isRtl: boolean }) {
  const { t } = useTranslation()

  const actions = [
    {
      label: t('transactions.add'),
      description: t('transactions.title'),
      icon: <PlusCircle className="h-5 w-5" />,
      href: '/transactions',
      gradient: 'var(--color-brand-600)',
      bgLight: 'rgba(67, 24, 255, 0.08)',
    },
    {
      label: t('balance.update'),
      description: t('balance.title'),
      icon: <Banknote className="h-5 w-5" />,
      href: '/balance',
      gradient: 'var(--color-success)',
      bgLight: 'rgba(5, 205, 153, 0.08)',
    },
    {
      label: t('forecast.title'),
      description: t('dashboard.forecast'),
      icon: <BarChart3 className="h-5 w-5" />,
      href: '/forecast',
      gradient: 'var(--color-brand-700)',
      bgLight: 'rgba(67, 24, 255, 0.06)',
    },
    {
      label: t('loans.title'),
      description: t('loans.title'),
      icon: <CreditCard className="h-5 w-5" />,
      href: '/loans',
      gradient: 'var(--color-accent-purple)',
      bgLight: 'rgba(134, 140, 255, 0.08)',
    },
  ]

  return (
    <div className="card card-hover animate-fade-in-up section-delay-3 overflow-hidden">
      {/* Widget header bar */}
      <div
        className="flex items-center gap-3 border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'rgba(67, 24, 255, 0.08)',
          }}
        >
          <PlusCircle className="h-5 w-5" style={{ color: 'var(--color-brand-600)' }} />
        </div>
        <h3
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.quickActions')}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-6 md:grid-cols-4">
        {actions.map((action, index) => (
          <Link
            key={action.href}
            to={action.href}
            className={cn(
              'quick-action-card card-lift group flex flex-col items-center gap-3.5 rounded-xl px-4 py-5 text-center transition-all duration-200',
              `animate-fade-in-up stagger-${index + 5}`,
              index === 0 && 'glow-ring',
            )}
            style={{
              backgroundColor: action.bgLight,
            }}
          >
            {/* Gradient icon circle */}
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
              style={{ background: action.gradient }}
            >
              {action.icon}
            </div>
            <div>
              <span
                className="block text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {action.label}
              </span>
            </div>
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform group-hover:translate-x-0.5',
                isRtl && 'rotate-180 group-hover:-translate-x-0.5'
              )}
              style={{ color: 'var(--text-tertiary)' }}
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category Donut Chart Widget
// ---------------------------------------------------------------------------

function CategoryDonutChart() {
  const { t, i18n } = useTranslation()
  const isHe = i18n.language === 'he'
  const { formatAmount } = useCurrency()

  const { data, isLoading } = useQuery<CategoryBreakdownResponse>({
    queryKey: queryKeys.dashboard.categoryBreakdown(),
    queryFn: () => dashboardApi.categoryBreakdown(),
  })

  const items = data?.items ?? []
  const totalExpenses = data ? parseFloat(data.total_expenses) || 0 : 0

  // Prepare chart data
  const chartData = items.map((item) => ({
    name: isHe ? item.category_name_he : item.category_name,
    value: parseFloat(item.total_amount) || 0,
    color: item.category_color || 'var(--text-tertiary)',
    percentage: item.percentage,
    count: item.transaction_count,
  }))

  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up section-delay-3 p-7 skeleton-group">
        <div className="mb-6 flex items-center gap-3">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <SkeletonBox className="h-5 w-40" />
        </div>
        <div className="flex items-center justify-center py-8">
          <SkeletonBox className="h-[200px] w-[200px] rounded-full" />
        </div>
        <div className="mt-4 space-y-3 skeleton-group">
          <SkeletonBox className="h-4 w-full rounded" />
          <SkeletonBox className="h-4 w-3/4 rounded" />
          <SkeletonBox className="h-4 w-5/6 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card card-hover animate-fade-in-up section-delay-3 overflow-hidden">
      {/* Widget header bar */}
      <div
        className="flex items-center gap-3 border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'rgba(134, 140, 255, 0.08)',
          }}
        >
          <Target className="h-5 w-5" style={{ color: 'var(--color-accent-purple)' }} />
        </div>
        <h3
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.categoryBreakdown')}
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-7">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <Target className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('dashboard.noCategoryData')}
          </p>
        </div>
      ) : (
        <>
          {/* Donut chart */}
          <div className="flex items-center justify-center px-7 pt-6" dir="ltr">
            <div className="relative h-[220px] w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={true}
                    animationDuration={600}
                    animationBegin={200}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const d = payload[0].payload as (typeof chartData)[0]
                      return (
                        <div className="glass-tooltip">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: d.color }}
                            />
                            <span
                              className="text-xs font-semibold"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {d.name}
                            </span>
                          </div>
                          <p
                            className="text-[11px] ltr-nums font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {formatAmount(d.value)}
                          </p>
                          <p
                            className="text-[10px]"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            {d.percentage}% &middot; {t('dashboard.transactions_count', { count: d.count })}
                          </p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 overflow-hidden">
                <p
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('transactions.total')}
                </p>
                <p
                  className="text-lg font-bold ltr-nums mt-0.5 truncate max-w-full"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatAmount(totalExpenses)}
                </p>
              </div>
            </div>
          </div>

          {/* Legend list */}
          <div className="mt-5 space-y-2.5 max-h-[180px] overflow-y-auto px-7 pb-6">
            {items.map((item) => (
              <div
                key={item.category_id ?? 'uncategorized'}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.category_color || 'var(--text-tertiary)' }}
                  />
                  <span
                    className="text-[13px] font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {isHe ? item.category_name_he : item.category_name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {item.percentage}%
                  </span>
                  <span
                    className="text-[13px] font-semibold ltr-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatAmount(item.total_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upcoming Payments Widget
// ---------------------------------------------------------------------------

function UpcomingPaymentsWidget() {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  const { data, isLoading } = useQuery<UpcomingPaymentsResponse>({
    queryKey: queryKeys.dashboard.upcomingPayments(30),
    queryFn: () => dashboardApi.upcomingPayments(30),
  })

  const items = data?.items ?? []
  const totalExpenses = data?.total_upcoming_expenses ?? '0'
  const totalIncome = data?.total_upcoming_income ?? '0'

  function getSourceIcon(sourceType: 'fixed' | 'installment' | 'loan' | 'subscription') {
    switch (sourceType) {
      case 'fixed':
        return <Repeat className="h-4 w-4" />
      case 'installment':
        return <CreditCard className="h-4 w-4" />
      case 'loan':
        return <Banknote className="h-4 w-4" />
      case 'subscription':
        return <CalendarDays className="h-4 w-4" />
    }
  }

  function getSourceLabel(sourceType: 'fixed' | 'installment' | 'loan' | 'subscription') {
    switch (sourceType) {
      case 'fixed':
        return t('dashboard.fixed')
      case 'installment':
        return t('dashboard.installment')
      case 'loan':
        return t('dashboard.loan')
      case 'subscription':
        return t('nav.subscriptions')
    }
  }

  function getDueBadge(daysUntil: number) {
    if (daysUntil === 0) {
      return {
        label: t('dashboard.dueToday'),
        bg: 'var(--bg-danger)',
        text: 'var(--color-danger)',
      }
    }
    if (daysUntil === 1) {
      return {
        label: t('dashboard.dueTomorrow'),
        bg: 'var(--bg-warning)',
        text: 'var(--color-warning)',
      }
    }
    return {
      label: t('dashboard.dueInDays', { count: daysUntil }),
      bg: 'var(--bg-hover)',
      text: 'var(--text-tertiary)',
    }
  }

  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up section-delay-3 p-7 skeleton-group">
        <div className="mb-6 flex items-center gap-3">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <SkeletonBox className="h-5 w-36" />
        </div>
        <div className="space-y-3 skeleton-group">
          <SkeletonBox className="h-14 w-full rounded-xl" />
          <SkeletonBox className="h-14 w-full rounded-xl" />
          <SkeletonBox className="h-14 w-full rounded-xl" />
          <SkeletonBox className="h-14 w-full rounded-xl" />
        </div>
        <SkeletonBox className="mt-5 h-12 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="card card-hover animate-fade-in-up section-delay-3 overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-3 border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(67, 24, 255, 0.08)' }}
        >
          <CalendarDays className="h-4.5 w-4.5" style={{ color: 'var(--color-brand-500)' }} />
        </div>
        <div>
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('dashboard.upcomingPayments')}
          </h3>
          {items.length > 0 && (
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {t('dashboard.transactions_count', { count: items.length })}
            </p>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 px-7">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <CalendarDays className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('dashboard.noUpcoming')}
          </p>
        </div>
      ) : (
        <>
          {/* Payment list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[340px]">
            <div className="space-y-1.5">
              {items.map((item, index) => {
                const dueBadge = getDueBadge(item.days_until_due)
                const isExpense = item.type === 'expense'

                return (
                  <div
                    key={item.id}
                    className="row-enter flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors"
                    style={{ '--row-index': Math.min(index, 15), backgroundColor: 'var(--bg-hover)' } as CSSProperties}
                  >
                    {/* Source type icon */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: isExpense
                          ? 'rgba(238, 93, 80, 0.08)'
                          : 'rgba(5, 205, 153, 0.08)',
                        color: isExpense ? 'var(--color-danger)' : 'var(--color-success)',
                      }}
                    >
                      {getSourceIcon(item.source_type)}
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {item.category_color && (
                          <div
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: item.category_color }}
                          />
                        )}
                        <p
                          className="text-[13px] font-semibold truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.name}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className="text-[10px] font-medium uppercase tracking-wide"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {getSourceLabel(item.source_type)}
                        </span>
                        {item.installment_info && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                            style={{
                              backgroundColor: 'rgba(134, 140, 255, 0.1)',
                              color: 'var(--color-brand-500)',
                            }}
                          >
                            {item.installment_info}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount + due badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1 max-w-[45%]">
                      <span
                        className="text-[13px] font-bold ltr-nums truncate max-w-full"
                        style={{
                          color: isExpense ? 'var(--color-danger)' : 'var(--color-income)',
                        }}
                      >
                        {isExpense ? '-' : '+'}{formatAmount(item.amount, item.currency)}
                      </span>
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: dueBadge.bg,
                          color: dueBadge.text,
                        }}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {dueBadge.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary footer */}
          <div
            className="border-t px-7 py-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('dashboard.totalUpcoming')}
              </span>
              <div className="flex items-center gap-4 shrink-0">
                <span
                  className="text-xs font-bold ltr-nums whitespace-nowrap"
                  style={{ color: 'var(--color-danger)' }}
                >
                  -{formatAmount(totalExpenses)}
                </span>
                <span
                  className="text-xs font-bold ltr-nums whitespace-nowrap"
                  style={{ color: 'var(--color-income)' }}
                >
                  +{formatAmount(totalIncome)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subscriptions Summary Widget
// ---------------------------------------------------------------------------

function SubscriptionsWidget() {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  const { data, isLoading } = useQuery<SubscriptionsSummaryResponse>({
    queryKey: queryKeys.dashboard.subscriptionsSummary(),
    queryFn: () => dashboardApi.subscriptionsSummary(),
  })

  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up section-delay-3 p-7 skeleton-group">
        <div className="mb-6 flex items-center gap-3">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <SkeletonBox className="h-5 w-36" />
        </div>
        <div className="space-y-3 skeleton-group">
          <SkeletonBox className="h-14 w-full rounded-xl" />
          <SkeletonBox className="h-14 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const items = data?.items ?? []
  const activeCount = data?.active_subscriptions_count ?? 0
  const monthlyCost = data?.total_monthly_subscription_cost ?? '0'
  const upcomingCount = data?.upcoming_renewals_count ?? 0

  return (
    <div className="card card-hover animate-fade-in-up section-delay-4 overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-7 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-info)' }}
          >
            <CalendarDays className="h-4.5 w-4.5" style={{ color: 'var(--color-brand-500)' }} />
          </div>
          <div>
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('nav.subscriptions')}
            </h3>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {activeCount} {t('dashboard.active')}
            </p>
          </div>
        </div>
        <Link
          to="/subscriptions"
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--color-brand-500)' }}
        >
          {t('common.viewAll')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-2 gap-px border-b"
        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--border-primary)' }}
      >
        <div className="px-5 py-4" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('dashboard.monthlyExpenses')}
          </p>
          <p className="fin-number text-lg ltr-nums mt-1" style={{ color: 'var(--color-danger)' }}>
            {formatAmount(monthlyCost)}
          </p>
        </div>
        <div className="px-5 py-4" style={{ backgroundColor: 'var(--bg-card)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {t('dashboard.upcomingRenewals')}
          </p>
          <p className="fin-number text-lg ltr-nums mt-1" style={{ color: 'var(--text-primary)' }}>
            {upcomingCount}
          </p>
        </div>
      </div>

      {/* Subscription list */}
      {items.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[240px]">
          <div className="space-y-1.5">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: item.is_active ? 'var(--bg-info)' : 'var(--bg-hover)',
                    color: item.is_active ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                  }}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </p>
                  <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {item.billing_cycle}
                  </p>
                </div>
                <span className="text-[13px] font-bold ltr-nums shrink-0" style={{ color: 'var(--color-danger)' }}>
                  {formatAmount(item.monthly_equivalent, item.currency)}/{t('common.month')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  const { t } = useTranslation()

  return (
    <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(67, 24, 255, 0.05)' }}>
        <Wallet className="h-10 w-10" style={{ color: 'var(--border-focus)' }} />
      </div>
      <h3
        className="text-xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('common.noData')}
      </h3>
      <p
        className="mt-2 max-w-sm text-center text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('balance.update')}
      </p>
      <Link
        to="/balance"
        className="btn-primary mt-8 inline-flex items-center gap-2 px-6 py-3 text-sm"
      >
        <PlusCircle className="h-4 w-4" />
        {t('balance.update')}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-danger)' }}
      >
        <AlertTriangle className="h-10 w-10" style={{ color: 'var(--color-danger)' }} />
      </div>
      <h3
        className="text-xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('common.error')}
      </h3>
      <button
        onClick={onRetry}
        className="btn-press card-hover mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <RefreshCw className="h-4 w-4" />
        {t('error.tryAgain')}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'he'
  const queryClient = useQueryClient()
  const toast = useToast()
  const { formatAmount } = useCurrency()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [alertPopupDismissed, setAlertPopupDismissed] = useState(false)
  const scrollRef = useScrollReveal()
  const { ref: glowRef, onMouseMove: handleGlow } = useCursorGlow()
  const { period, setPeriod } = usePeriodSelector()

  useEffect(() => {
    document.title = t('pageTitle.dashboard')
  }, [t])

  // --- Data queries ---
  const summaryQuery = useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard.summary(period.startDate, period.endDate),
    queryFn: () => dashboardApi.summary(period.startDate, period.endDate),
  })

  const forecastMonths = useMemo(() => {
    const start = new Date(period.startDate)
    const end = new Date(period.endDate)
    const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    return Math.max(1, Math.min(diff + 1, 12))
  }, [period.startDate, period.endDate])

  const forecastQuery = useQuery({
    queryKey: queryKeys.forecast.monthly(forecastMonths),
    queryFn: () => forecastApi.monthly(forecastMonths),
  })

  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts.list(),
    queryFn: () => alertsApi.list(),
  })

  // Weekly data for sparklines
  const weeklyQuery = useQuery({
    queryKey: ['dashboard', 'weekly-sparkline'] as const,
    queryFn: () => dashboardApi.weekly(),
  })

  // Credit card summary for utilization widget
  const creditCardSummaryQuery = useQuery<CreditCardSummary>({
    queryKey: queryKeys.creditCards.summary(),
    queryFn: () => creditCardsApi.getSummary(),
    retry: 1,
  })

  // Budget summary for budget alerts widget
  const budgetSummaryQuery = useQuery<BudgetSummary>({
    queryKey: queryKeys.budgets.summary(),
    queryFn: () => budgetsApi.getSummary(),
    retry: 1,
  })

  // --- Derived state ---
  const summary = summaryQuery.data
  const forecastData = forecastQuery.data
  const alerts = alertsQuery.data
  const weeklyData = weeklyQuery.data ?? []

  const isSummaryLoading = summaryQuery.isLoading
  const isAllError =
    summaryQuery.isError && forecastQuery.isError && alertsQuery.isError

  const isNoData =
    summaryQuery.isError &&
    forecastQuery.isError &&
    !isSummaryLoading

  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const chartData = forecastData ? buildChartData(forecastData.months, locale) : []

  // Build sparkline data from weekly breakdowns
  const incomeSparkline = extractSparklineData(weeklyData, 'income')
  const expensesSparkline = extractSparklineData(weeklyData, 'expenses')
  const netSparkline = extractSparklineData(weeklyData, 'net')

  // Animated KPI values
  const rawIncome = summary ? (parseFloat(summary.monthly_income) || 0) : 0
  const rawExpenses = summary ? (parseFloat(summary.monthly_expenses) || 0) : 0
  const rawNet = summary ? (parseFloat(summary.net_cashflow) || 0) : 0
  const animatedIncome = useCountUp(rawIncome, 800)
  const animatedExpenses = useCountUp(rawExpenses, 800)
  const animatedNet = useCountUp(rawNet, 800)

  // Calculate expected balance = current_balance + net_cashflow
  const currentBalanceNum = summary ? (parseFloat(summary.current_balance) || 0) : 0
  const netCashflowNum = summary ? (parseFloat(summary.net_cashflow) || 0) : 0
  const expectedBalanceNum = currentBalanceNum + netCashflowNum
  const isNetPositive = netCashflowNum >= 0

  const handleRetry = () => {
    summaryQuery.refetch()
    forecastQuery.refetch()
    alertsQuery.refetch()
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.balance.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.forecast.all }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'weekly-sparkline'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.obligo.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
      ])
      toast.success(t('dashboard.refreshed'))
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient, toast, t])

  // --- KPI definitions (no balance - it's in the hero card) ---
  const periodKey = period.preset
  const incomeLabel = t(`dashboard.income${periodKey}`, { defaultValue: t('dashboard.monthlyIncome') })
  const expensesLabel = t(`dashboard.expenses${periodKey}`, { defaultValue: t('dashboard.monthlyExpenses') })
  const netLabel = t(`dashboard.net${periodKey}`, { defaultValue: t('dashboard.netCashflow') })

  const kpis: Omit<KpiCardProps, 'isLoading'>[] = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: incomeLabel,
      value: summary ? formatAmount(animatedIncome) : '--',
      rawValue: rawIncome,
      trend: summary?.income_trend ?? '0',
      accentColor: 'var(--color-income)',
      sparklineColor: 'var(--color-income)',
      staggerClass: 'stagger-2',
      sparklineData: incomeSparkline,
      extraClassName: 'card-noise',
    },
    {
      icon: <TrendingDown className="h-5 w-5" />,
      label: expensesLabel,
      value: summary ? formatAmount(animatedExpenses) : '--',
      rawValue: rawExpenses,
      trend: summary?.expense_trend ?? '0',
      accentColor: 'var(--color-expense)',
      sparklineColor: 'var(--color-expense)',
      staggerClass: 'stagger-3',
      sparklineData: expensesSparkline,
      extraClassName: 'card-noise',
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: netLabel,
      value: summary ? formatAmount(animatedNet) : '--',
      rawValue: rawNet,
      trend: '0',
      accentColor: 'var(--color-brand-500)',
      sparklineColor: 'var(--color-brand-500)',
      staggerClass: 'stagger-4',
      sparklineData: netSparkline,
      extraClassName: 'card-noise',
    },
  ]

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const unreadAlertCount = alerts?.items?.filter((a: Alert) => !a.is_read).length ?? 0

  // Auto-dismiss alert popup after 8 seconds
  useEffect(() => {
    if (unreadAlertCount > 0 && !alertPopupDismissed) {
      const timer = setTimeout(() => setAlertPopupDismissed(true), 8000)
      return () => clearTimeout(timer)
    }
  }, [unreadAlertCount, alertPopupDismissed])

  return (
    <div ref={scrollRef} dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 sm:space-y-8 p-4 sm:p-6 md:p-8">
      {/* --- Alert popup notification --- */}
      {unreadAlertCount > 0 && !alertPopupDismissed && (
        <div
          className="fixed top-4 z-50 toast-spring-enter"
          style={{ insetInlineEnd: '1rem' }}
        >
          <div
            className="card flex items-center gap-3 rounded-xl px-4 py-3 max-w-xs"
            style={{
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-primary)',
              backdropFilter: 'blur(16px) saturate(150%)',
              WebkitBackdropFilter: 'blur(16px) saturate(150%)',
            }}
          >
            <div
              className="badge-pulse flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--bg-warning)', color: 'var(--color-warning)' }}
            >
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('dashboard.unreadCount', { count: unreadAlertCount })}
              </p>
              <Link
                to="/alerts"
                className="text-xs font-medium"
                style={{ color: 'var(--color-brand-500)' }}
              >
                {t('dashboard.alerts')} →
              </Link>
            </div>
            <button
              onClick={() => setAlertPopupDismissed(true)}
              className="btn-press shrink-0 rounded-md p-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- Page Header --- */}
      <div className="animate-fade-in flex items-start sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="gradient-heading text-xl sm:text-[1.75rem] font-extrabold tracking-tight"
          >
            {t('dashboard.title')}
          </h1>
          <div
            className="mt-1 sm:mt-2 flex items-center gap-2 text-xs sm:text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatTodayDate(i18n.language)}</span>
          </div>
        </div>

        {/* Refresh button */}
        {!isAllError && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn-press card card-hover flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-medium transition-all disabled:opacity-60 shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </button>
        )}
      </div>

      {/* --- Period Selector --- */}
      {!isAllError && (
        <div className="animate-fade-in">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      )}

      {/* --- Error / empty state --- */}
      {isAllError && !isSummaryLoading && (
        <ErrorState onRetry={handleRetry} />
      )}

      {isNoData && !isAllError && (
        <EmptyState />
      )}

      {/* --- Hero + KPI Cards in unified grid --- */}
      {!isAllError && (
        <div ref={glowRef} onMouseMove={handleGlow} className="scroll-reveal content-reveal card-glow grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-5">
          {/* Hero balance card - spans 2 columns */}
          <div className="md:col-span-2 lg:col-span-2">
            <HeroBalanceCard
              balance={summary ? formatAmount(summary.current_balance) : '--'}
              netCashflow={summary ? formatAmount(summary.net_cashflow) : '--'}
              balanceTrend={summary?.balance_trend ?? '0'}
              isLoading={isSummaryLoading}
              expectedBalance={summary ? formatAmount(expectedBalanceNum) : '--'}
              isNetPositive={isNetPositive}
              rawBalance={currentBalanceNum}
              rawNetCashflow={netCashflowNum}
              rawExpectedBalance={expectedBalanceNum}
            />
          </div>
          {/* 3 KPI cards - 1 column each */}
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} isLoading={isSummaryLoading} />
          ))}
        </div>
      )}

      {/* --- Forecast Chart (full width) --- */}
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

      {/* --- Financial Health Score (full width, compact) --- */}
      {!isAllError && (
        <div className="scroll-reveal">
          <FinancialHealthWidget />
        </div>
      )}

      {/* --- Category Breakdown + Top Expenses --- */}
      {!isAllError && (
        <div className="scroll-reveal grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
          <CategoryDonutChart />
          <TopExpensesWidget />
        </div>
      )}

      {/* --- Installments + Loans Summary --- */}
      {!isAllError && (
        <div className="scroll-reveal grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
          <InstallmentsSummaryWidget />
          <LoansSummaryWidget />
        </div>
      )}

      {/* --- Monthly Comparison Chart (full width) --- */}
      {!isAllError && (
        <div className="scroll-reveal">
          <MonthlyComparisonChart />
        </div>
      )}

      {/* --- Upcoming Payments + Alerts --- */}
      {!isAllError && (
        <div className="scroll-reveal grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
          <UpcomingPaymentsWidget />
          <div>
            {alertsQuery.isLoading ? (
              <div className="card animate-fade-in-up section-delay-2 p-6 skeleton-group">
                <SkeletonBox className="mb-5 h-5 w-28" />
                <div className="space-y-3 skeleton-group">
                  <SkeletonBox className="h-16 w-full rounded-xl" />
                  <SkeletonBox className="h-16 w-full rounded-xl" />
                  <SkeletonBox className="h-16 w-full rounded-xl" />
                </div>
              </div>
            ) : (
              <AlertsPanel
                alerts={alerts?.items ?? []}
                isRtl={isRtl}
              />
            )}
          </div>
        </div>
      )}

      {/* --- Subscriptions Summary --- */}
      {!isAllError && (
        <div className="scroll-reveal">
          <SubscriptionsWidget />
        </div>
      )}

      {/* --- Obligo Widget --- */}
      {!isAllError && (
        <div className="scroll-reveal">
          <ObligoWidget />
        </div>
      )}

      {/* --- Credit Utilization + Budget Alerts --- */}
      {!isAllError && (
        <div className="scroll-reveal grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-2">
          {/* Credit Utilization Mini-Widget */}
          <div className="card card-hover animate-fade-in-up overflow-hidden flex flex-col">
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-7 py-5"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                >
                  <Gauge className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
                </div>
                <h3
                  className="text-sm font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('dashboard.creditUtilization')}
                </h3>
              </div>
              <Link
                to="/credit-cards"
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--color-brand-500)' }}
              >
                {t('common.viewAll')}
                <ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')} />
              </Link>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              {creditCardSummaryQuery.isLoading ? (
                <div className="skeleton-group space-y-4">
                  <SkeletonBox className="h-5 w-full rounded-full" />
                  <SkeletonBox className="h-4 w-40 rounded" />
                  <SkeletonBox className="h-12 w-full rounded-xl" />
                </div>
              ) : creditCardSummaryQuery.isError || !creditCardSummaryQuery.data ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <Gauge className="h-6 w-6 mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {t('common.noData')}
                  </p>
                </div>
              ) : (() => {
                const ccSummary = creditCardSummaryQuery.data
                const totalUtil = parseFloat(ccSummary.total_utilization) || 0
                const totalLimit = parseFloat(ccSummary.total_credit_limit) || 0
                const avgPct = ccSummary.average_utilization_pct ?? 0
                const utilizationBarColor = avgPct >= 80
                  ? 'var(--color-danger)'
                  : avgPct >= 60
                    ? 'var(--color-warning)'
                    : 'var(--color-income)'

                return (
                  <div className="space-y-4">
                    {/* Total utilization bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {formatAmount(totalUtil)} / {formatAmount(totalLimit)}
                        </span>
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-bold"
                          style={{
                            color: utilizationBarColor,
                            backgroundColor: `color-mix(in srgb, ${utilizationBarColor} 12%, transparent)`,
                          }}
                        >
                          {avgPct.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        className="h-3 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--bg-hover)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(avgPct, 100)}%`,
                            backgroundColor: utilizationBarColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Per-card bars */}
                    {ccSummary.cards.length > 0 && (
                      <div className="space-y-2.5 max-h-[200px] overflow-y-auto">
                        {ccSummary.cards.map((card) => {
                          const cardPct = card.utilization_percentage ?? 0
                          const cardColor = cardPct >= 80
                            ? 'var(--color-danger)'
                            : cardPct >= 60
                              ? 'var(--color-warning)'
                              : 'var(--color-income)'
                          return (
                            <div key={card.id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span
                                  className="text-[12px] font-medium truncate"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {card.name} ****{card.last_four_digits}
                                </span>
                                <span
                                  className="text-[11px] font-semibold ltr-nums shrink-0"
                                  style={{ color: cardColor }}
                                >
                                  {cardPct.toFixed(0)}%
                                </span>
                              </div>
                              <div
                                className="h-1.5 w-full overflow-hidden rounded-full"
                                style={{ backgroundColor: 'var(--bg-hover)' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(cardPct, 100)}%`,
                                    backgroundColor: cardColor,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Budget Alerts Widget */}
          <div className="card card-hover animate-fade-in-up overflow-hidden flex flex-col">
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-7 py-5"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}
                >
                  <AlertOctagon className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
                </div>
                <div>
                  <h3
                    className="text-sm font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('dashboard.budgetAlerts')}
                  </h3>
                  {budgetSummaryQuery.data && budgetSummaryQuery.data.over_budget_count > 0 && (
                    <p className="text-[10px] font-medium" style={{ color: 'var(--color-danger)' }}>
                      {budgetSummaryQuery.data.over_budget_count} {t('dashboard.overBudget')}
                    </p>
                  )}
                </div>
              </div>
              <Link
                to="/alerts"
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: 'var(--color-brand-500)' }}
              >
                {t('common.viewAll')}
                <ChevronRight className={cn('h-3.5 w-3.5', isRtl && 'rotate-180')} />
              </Link>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              {budgetSummaryQuery.isLoading ? (
                <div className="skeleton-group space-y-3">
                  <SkeletonBox className="h-14 w-full rounded-xl" />
                  <SkeletonBox className="h-14 w-full rounded-xl" />
                  <SkeletonBox className="h-14 w-full rounded-xl" />
                </div>
              ) : budgetSummaryQuery.isError || !budgetSummaryQuery.data ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <AlertOctagon className="h-6 w-6 mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {t('common.noData')}
                  </p>
                </div>
              ) : (() => {
                const budgetData = budgetSummaryQuery.data
                const isHe = i18n.language === 'he'
                // Show budgets that are over or approaching limit (>= 75%)
                const alertBudgets = budgetData.budgets
                  .filter((b) => b.usage_percentage >= 75)
                  .sort((a, b) => b.usage_percentage - a.usage_percentage)

                if (alertBudgets.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-6">
                      <div
                        className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: 'rgba(5, 205, 153, 0.08)' }}
                      >
                        <Target className="h-5 w-5" style={{ color: 'var(--color-income)' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        {t('dashboard.allBudgetsOk')}
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {alertBudgets.map((budget) => {
                      const isOver = budget.is_over_budget
                      const pct = budget.usage_percentage
                      const barColor = isOver
                        ? 'var(--color-danger)'
                        : pct >= 90
                          ? 'var(--color-warning)'
                          : 'var(--color-accent-teal)'
                      const categoryName = isHe
                        ? (budget.category_name_he || budget.category_name || '')
                        : (budget.category_name || '')

                      return (
                        <div
                          key={budget.id}
                          className="rounded-xl px-4 py-3 transition-colors"
                          style={{ backgroundColor: 'var(--bg-hover)' }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              {budget.category_color && (
                                <div
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: budget.category_color }}
                                />
                              )}
                              <span
                                className="text-[13px] font-semibold truncate"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {categoryName}
                              </span>
                              {isOver && (
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase"
                                  style={{
                                    backgroundColor: 'var(--bg-danger)',
                                    color: 'var(--color-danger)',
                                  }}
                                >
                                  {t('dashboard.overBudget')}
                                </span>
                              )}
                            </div>
                            <span
                              className="text-[12px] font-bold ltr-nums shrink-0"
                              style={{ color: barColor }}
                            >
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div
                            className="h-1.5 w-full overflow-hidden rounded-full"
                            style={{ backgroundColor: 'var(--bg-card)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: barColor,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span
                              className="text-[10px] font-medium ltr-nums"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              {formatAmount(budget.actual_amount)} / {formatAmount(budget.amount)}
                            </span>
                            <span
                              className="text-[10px] font-medium ltr-nums"
                              style={{ color: parseFloat(budget.remaining) < 0 ? 'var(--color-danger)' : 'var(--color-income)' }}
                            >
                              {t('dashboard.remaining')}: {formatAmount(budget.remaining)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* --- Quick Actions --- */}
      {!isAllError && !isSummaryLoading && (
        <div className="scroll-reveal">
          <QuickActions isRtl={isRtl} />
        </div>
      )}
    </div>
  )
}
