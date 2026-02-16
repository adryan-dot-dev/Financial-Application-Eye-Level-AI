import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
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
  ArrowUpRight,
  ArrowDownRight,
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
} from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardSummary, DashboardPeriodData, CategoryBreakdownResponse, UpcomingPaymentsResponse } from '@/api/dashboard'
import { forecastApi } from '@/api/forecast'
import { alertsApi } from '@/api/alerts'
import { MonthlyComparisonChart } from '@/components/dashboard/MonthlyComparisonChart'
import { FinancialHealthWidget } from '@/components/dashboard/FinancialHealthWidget'
import { InstallmentsSummaryWidget } from '@/components/dashboard/InstallmentsSummaryWidget'
import { LoansSummaryWidget } from '@/components/dashboard/LoansSummaryWidget'
import { TopExpensesWidget } from '@/components/dashboard/TopExpensesWidget'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import type { ForecastMonth, Alert } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  trend: string
  accentColor: string
  sparklineColor: string
  isLoading: boolean
  staggerClass: string
  sparklineData: number[]
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

function buildChartData(months: ForecastMonth[]): ChartDataPoint[] {
  return months.map((m) => ({
    month: formatMonthLabel(m.month),
    income: parseFloat(m.total_income) || 0,
    expenses: Math.abs(parseFloat(m.total_expenses) || 0),
    closingBalance: parseFloat(m.closing_balance) || 0,
  }))
}

function formatMonthLabel(monthStr: string): string {
  const normalized = monthStr.length > 7 ? monthStr.slice(0, 7) : monthStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return monthStr
  return date.toLocaleDateString('en-US', { month: 'short' })
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
  balance,
  netCashflow,
  balanceTrend,
  isLoading,
  expectedBalance,
  isNetPositive,
}: {
  balance: string
  netCashflow: string
  balanceTrend: string
  isLoading: boolean
  expectedBalance: string
  isNetPositive: boolean
}) {
  const { t } = useTranslation()
  const { value: trendVal, isPositive } = parseTrend(balanceTrend)

  if (isLoading) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl p-8 animate-fade-in-up stagger-1"
        style={{
          background: 'var(--color-brand-600)',
          minHeight: 180,
        }}
      >
        <div className="absolute inset-0 bg-white/5" />
        <div className="relative z-10">
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
      className="relative overflow-hidden rounded-2xl p-8 animate-fade-in-up stagger-1"
      style={{
        background: 'var(--color-brand-600)',
      }}
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5" />

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
            <p className="text-white text-4xl font-bold mt-3 ltr-nums tracking-tight">
              {balance}
            </p>
            <p className="text-white/60 text-sm mt-2 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              {t('dashboard.netCashflow')}: {netCashflow}
            </p>
          </div>

          {/* Trend badge on hero */}
          {trendVal > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold self-start sm:self-auto"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                color: 'white',
              }}
            >
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {trendVal.toFixed(1)}%
            </div>
          )}
        </div>

        {/* Expected Balance - prominent display */}
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-4"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: isNetPositive
                ? 'rgba(16, 185, 129, 0.25)'
                : 'rgba(239, 68, 68, 0.25)',
            }}
          >
            {isNetPositive ? (
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider">
              {t('dashboard.expectedBalance')}
            </p>
            <p className="text-white text-2xl font-bold ltr-nums tracking-tight mt-0.5">
              {expectedBalance}
            </p>
          </div>
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0"
            style={{
              backgroundColor: isNetPositive
                ? 'rgba(16, 185, 129, 0.25)'
                : 'rgba(239, 68, 68, 0.25)',
              color: isNetPositive ? '#6EE7B7' : '#FCA5A5',
            }}
          >
            {isNetPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
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
  value,
  trend,
  accentColor,
  sparklineColor,
  isLoading,
  staggerClass,
  sparklineData,
}: KpiCardProps) {
  const { value: trendVal, isPositive } = parseTrend(trend)

  if (isLoading) {
    return (
      <div className={cn('card p-5', staggerClass, 'animate-fade-in-up')}>
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-10 w-10 rounded-xl" />
          <SkeletonBox className="h-5 w-14 rounded-full" />
        </div>
        <SkeletonBox className="mt-4 h-3 w-20 rounded" />
        <SkeletonBox className="mt-2.5 h-7 w-28 rounded" />
        <SkeletonBox className="mt-3 h-10 w-full rounded" />
      </div>
    )
  }

  return (
    <div
      className={cn('card widget-hover p-5 relative overflow-hidden', staggerClass, 'animate-fade-in-up')}
      style={{
        borderInlineStart: `3px solid ${accentColor}`,
      }}
    >
      <div className="flex items-center justify-between">
        {/* Icon box */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${accentColor}14`,
            color: accentColor,
          }}
        >
          {icon}
        </div>

        {/* Trend badge */}
        {trendVal > 0 ? (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: isPositive
                ? 'var(--bg-success)'
                : 'var(--bg-danger)',
              color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trendVal.toFixed(1)}%
          </div>
        ) : (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-tertiary)',
            }}
          >
            --
          </div>
        )}
      </div>

      <p
        className="mt-3 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="ltr-nums mt-1.5 text-[1.5rem] font-bold leading-tight tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>

      {/* Mini Sparkline */}
      <div className="mt-3">
        <MiniSparkline data={sparklineData} color={sparklineColor} height={48} />
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
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)',
      }}
    >
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
    <div className="card card-hover animate-fade-in-up section-delay-2 overflow-hidden p-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('dashboard.forecast')}
          </h3>
          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {data.length > 0
              ? `${data[0].month} - ${data[data.length - 1].month}`
              : ''}
          </p>
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

      <div className="h-[340px] px-1" dir="ltr">
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
              activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={300}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="var(--color-danger)"
              fill="url(#expenseGradient)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={300}
            />
            <Area
              type="monotone"
              dataKey="closingBalance"
              stroke="var(--color-brand-500)"
              fill="url(#balanceGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: 'white', strokeWidth: 2, fill: 'var(--color-brand-500)' }}
              strokeDasharray="6 3"
              isAnimationActive={true}
              animationDuration={300}
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
            {/* Red badge with count */}
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
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

      {/* Alert items */}
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
          <div className="space-y-1.5">
            {displayAlerts.map((alert) => {
              const sev = severityConfig(alert.severity)
              const isUnread = !alert.is_read
              return (
                <Link
                  key={alert.id}
                  to="/alerts"
                  className="alert-item relative flex items-start gap-3 rounded-xl px-3.5 py-3.5 transition-colors"
                  style={{
                    backgroundColor: isUnread ? sev.bg : 'transparent',
                    borderInlineStart: `3px solid ${sev.text}`,
                  }}
                >
                  {/* Severity icon */}
                  <div className="mt-0.5 flex shrink-0 items-center" style={{ color: sev.dot }}>
                    {sev.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-[13px] leading-snug',
                        isUnread ? 'font-semibold' : 'font-medium'
                      )}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {alert.title}
                    </p>
                    <p
                      className="mt-0.5 text-[11px] leading-snug"
                      style={{
                        color: 'var(--text-secondary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {alert.message}
                    </p>
                  </div>

                  {/* Severity pill */}
                  <span
                    className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: sev.bg,
                      color: sev.text,
                    }}
                  >
                    {t(`alerts.${alert.severity}`)}
                  </span>
                </Link>
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
      gradient: '#2563EB',
      bgLight: 'rgba(37, 99, 235, 0.08)',
    },
    {
      label: t('balance.update'),
      description: t('balance.title'),
      icon: <Banknote className="h-5 w-5" />,
      href: '/balance',
      gradient: '#10B981',
      bgLight: 'rgba(16, 185, 129, 0.08)',
    },
    {
      label: t('forecast.title'),
      description: t('dashboard.forecast'),
      icon: <BarChart3 className="h-5 w-5" />,
      href: '/forecast',
      gradient: '#1D4ED8',
      bgLight: 'rgba(29, 78, 216, 0.08)',
    },
    {
      label: t('loans.title'),
      description: t('loans.title'),
      icon: <CreditCard className="h-5 w-5" />,
      href: '/loans',
      gradient: '#7C3AED',
      bgLight: 'rgba(124, 58, 237, 0.08)',
    },
  ]

  return (
    <div className="card card-hover animate-fade-in-up section-delay-3 overflow-hidden p-6">
      <h3
        className="mb-5 text-base font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('dashboard.quickActions')}
      </h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {actions.map((action, index) => (
          <Link
            key={action.href}
            to={action.href}
            className={cn(
              'quick-action-card group flex flex-col items-center gap-3.5 rounded-xl px-4 py-5 text-center transition-all duration-200',
              `animate-fade-in-up stagger-${index + 5}`,
            )}
            style={{
              backgroundColor: action.bgLight,
            }}
          >
            {/* Gradient icon circle */}
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm"
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
    color: item.category_color || '#94a3b8',
    percentage: item.percentage,
    count: item.transaction_count,
  }))

  if (isLoading) {
    return (
      <div className="card card-hover animate-fade-in-up section-delay-3 p-7">
        <div className="mb-6 flex items-center gap-3">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <SkeletonBox className="h-5 w-40" />
        </div>
        <div className="flex items-center justify-center py-8">
          <SkeletonBox className="h-[200px] w-[200px] rounded-full" />
        </div>
        <div className="mt-4 space-y-3">
          <SkeletonBox className="h-4 w-full rounded" />
          <SkeletonBox className="h-4 w-3/4 rounded" />
          <SkeletonBox className="h-4 w-5/6 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card card-hover animate-fade-in-up section-delay-3 overflow-hidden p-7">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)' }}
        >
          <Target className="h-4.5 w-4.5" style={{ color: '#3B82F6' }} />
        </div>
        <h3
          className="text-base font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.categoryBreakdown')}
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
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
          <div className="flex items-center justify-center" dir="ltr">
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
                        <div
                          className="rounded-xl border px-4 py-3"
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            borderColor: 'var(--border-primary)',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)',
                          }}
                        >
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('transactions.total')}
                </p>
                <p
                  className="text-lg font-bold ltr-nums mt-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatAmount(totalExpenses)}
                </p>
              </div>
            </div>
          </div>

          {/* Legend list */}
          <div className="mt-5 space-y-2.5 max-h-[180px] overflow-y-auto px-1">
            {items.map((item) => (
              <div
                key={item.category_id ?? 'uncategorized'}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.category_color || '#94a3b8' }}
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

  function getSourceIcon(sourceType: 'fixed' | 'installment' | 'loan') {
    switch (sourceType) {
      case 'fixed':
        return <Repeat className="h-4 w-4" />
      case 'installment':
        return <CreditCard className="h-4 w-4" />
      case 'loan':
        return <Banknote className="h-4 w-4" />
    }
  }

  function getSourceLabel(sourceType: 'fixed' | 'installment' | 'loan') {
    switch (sourceType) {
      case 'fixed':
        return t('dashboard.fixed')
      case 'installment':
        return t('dashboard.installment')
      case 'loan':
        return t('dashboard.loan')
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
      <div className="card card-hover animate-fade-in-up section-delay-3 p-7">
        <div className="mb-6 flex items-center gap-3">
          <SkeletonBox className="h-9 w-9 rounded-xl" />
          <SkeletonBox className="h-5 w-36" />
        </div>
        <div className="space-y-3">
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
          style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
        >
          <CalendarDays className="h-4.5 w-4.5" style={{ color: '#3B82F6' }} />
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
              {items.map((item) => {
                const dueBadge = getDueBadge(item.days_until_due)
                const isExpense = item.type === 'expense'

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors"
                    style={{ backgroundColor: 'var(--bg-hover)' }}
                  >
                    {/* Source type icon */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: isExpense
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(16, 185, 129, 0.08)',
                        color: isExpense ? '#EF4444' : '#10B981',
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
                              backgroundColor: 'rgba(139, 92, 246, 0.1)',
                              color: '#3B82F6',
                            }}
                          >
                            {item.installment_info}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount + due badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className="text-[13px] font-bold ltr-nums"
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
              <div className="flex items-center gap-4">
                <span
                  className="text-xs font-bold ltr-nums"
                  style={{ color: 'var(--color-danger)' }}
                >
                  -{formatAmount(totalExpenses)}
                </span>
                <span
                  className="text-xs font-bold ltr-nums"
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
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  const { t } = useTranslation()

  return (
    <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>
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
        className="card-hover mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <RefreshCw className="h-4 w-4" />
        {t('common.loading')}
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

  useEffect(() => {
    document.title = t('pageTitle.dashboard')
  }, [t])

  // --- Data queries ---
  const summaryQuery = useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => dashboardApi.summary(),
  })

  const forecastQuery = useQuery({
    queryKey: queryKeys.forecast.monthly(6),
    queryFn: () => forecastApi.monthly(6),
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

  const chartData = forecastData ? buildChartData(forecastData.months) : []

  // Build sparkline data from weekly breakdowns
  const incomeSparkline = extractSparklineData(weeklyData, 'income')
  const expensesSparkline = extractSparklineData(weeklyData, 'expenses')
  const netSparkline = extractSparklineData(weeklyData, 'net')

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
      ])
      toast.success(t('dashboard.refreshed'))
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient, toast, t])

  // --- KPI definitions (no balance - it's in the hero card) ---
  const kpis: Omit<KpiCardProps, 'isLoading'>[] = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: t('dashboard.monthlyIncome'),
      value: summary ? formatAmount(summary.monthly_income) : '--',
      trend: summary?.income_trend ?? '0',
      accentColor: '#10B981',
      sparklineColor: '#10B981',
      staggerClass: 'stagger-2',
      sparklineData: incomeSparkline,
    },
    {
      icon: <TrendingDown className="h-5 w-5" />,
      label: t('dashboard.monthlyExpenses'),
      value: summary ? formatAmount(summary.monthly_expenses) : '--',
      trend: summary?.expense_trend ?? '0',
      accentColor: '#EF4444',
      sparklineColor: '#EF4444',
      staggerClass: 'stagger-3',
      sparklineData: expensesSparkline,
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: t('dashboard.netCashflow'),
      value: summary ? formatAmount(summary.net_cashflow) : '--',
      trend: '0',
      accentColor: '#3B82F6',
      sparklineColor: '#3B82F6',
      staggerClass: 'stagger-4',
      sparklineData: netSparkline,
    },
  ]

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-8 p-6 md:p-8">
      {/* --- Page Header --- */}
      <div className="animate-fade-in flex items-end justify-between">
        <div>
          <h1
            className="text-[1.7rem] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('dashboard.title')}
          </h1>
          <div
            className="mt-2 flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatTodayDate(i18n.language)}</span>
          </div>
        </div>

        {/* Refresh button */}
        {!isAllError && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="card card-hover flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all disabled:opacity-60"
            style={{ color: 'var(--text-secondary)' }}
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </button>
        )}
      </div>

      {/* --- Error / empty state --- */}
      {isAllError && !isSummaryLoading && (
        <ErrorState onRetry={handleRetry} />
      )}

      {isNoData && !isAllError && (
        <EmptyState />
      )}

      {/* --- Hero Balance Card (full width) --- */}
      {!isAllError && (
        <HeroBalanceCard
          balance={summary ? formatAmount(summary.current_balance) : '--'}
          netCashflow={summary ? formatAmount(summary.net_cashflow) : '--'}
          balanceTrend={summary?.balance_trend ?? '0'}
          isLoading={isSummaryLoading}
          expectedBalance={summary ? formatAmount(expectedBalanceNum) : '--'}
          isNetPositive={isNetPositive}
        />
      )}

      {/* --- KPI Cards: 3 in a row below hero --- */}
      {!isAllError && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} isLoading={isSummaryLoading} />
          ))}
        </div>
      )}

      {/* --- Forecast Chart (full width) --- */}
      {!isAllError && (
        <div>
          {forecastQuery.isLoading ? (
            <div className="card animate-fade-in-up section-delay-2 p-7">
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

      {/* --- Financial Health Score (full width, compact) --- */}
      {!isAllError && (
        <FinancialHealthWidget />
      )}

      {/* --- Category Breakdown + Top Expenses --- */}
      {!isAllError && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <CategoryDonutChart />
          <TopExpensesWidget />
        </div>
      )}

      {/* --- Installments + Loans Summary --- */}
      {!isAllError && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <InstallmentsSummaryWidget />
          <LoansSummaryWidget />
        </div>
      )}

      {/* --- Monthly Comparison Chart (full width) --- */}
      {!isAllError && (
        <MonthlyComparisonChart />
      )}

      {/* --- Upcoming Payments + Alerts --- */}
      {!isAllError && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <UpcomingPaymentsWidget />
          <div>
            {alertsQuery.isLoading ? (
              <div className="card animate-fade-in-up section-delay-2 p-6">
                <SkeletonBox className="mb-5 h-5 w-28" />
                <div className="space-y-3">
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

      {/* --- Quick Actions --- */}
      {!isAllError && !isSummaryLoading && (
        <QuickActions isRtl={isRtl} />
      )}
    </div>
  )
}
