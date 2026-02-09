import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
} from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardSummary } from '@/api/dashboard'
import { forecastApi } from '@/api/forecast'
import { alertsApi } from '@/api/alerts'
import { cn, formatCurrency } from '@/lib/utils'
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
  isLoading: boolean
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
  return { value: Math.abs(num), isPositive: num >= 0 }
}

function buildChartData(months: ForecastMonth[]): ChartDataPoint[] {
  return months.map((m) => ({
    month: formatMonthLabel(m.month),
    income: parseFloat(m.total_income),
    expenses: Math.abs(parseFloat(m.total_expenses)),
    closingBalance: parseFloat(m.closing_balance),
  }))
}

function formatMonthLabel(monthStr: string): string {
  // monthStr format: "YYYY-MM" or "2025-03"
  const date = new Date(monthStr + '-01')
  return date.toLocaleDateString('en-US', { month: 'short' })
}

function severityConfig(severity: Alert['severity']) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.3)',
        text: '#EF4444',
        icon: <ShieldAlert className="h-4 w-4 shrink-0" />,
      }
    case 'warning':
      return {
        bg: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.3)',
        text: '#F59E0B',
        icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      }
    case 'info':
    default:
      return {
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.3)',
        text: '#3B82F6',
        icon: <Info className="h-4 w-4 shrink-0" />,
      }
  }
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonBox({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded-lg', className)}
      style={{ backgroundColor: 'var(--bg-hover)', ...style }}
    />
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ icon, label, value, trend, accentColor, isLoading }: KpiCardProps) {
  const prevValueRef = useRef(value)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prevValueRef.current !== value && cardRef.current) {
      cardRef.current.classList.remove('kpi-pulse')
      // Force reflow
      void cardRef.current.offsetWidth
      cardRef.current.classList.add('kpi-pulse')
    }
    prevValueRef.current = value
  }, [value])

  const { value: trendVal, isPositive } = parseTrend(trend)

  if (isLoading) {
    return (
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-10 w-10 rounded-lg" />
          <SkeletonBox className="h-5 w-16 rounded" />
        </div>
        <SkeletonBox className="mt-4 h-4 w-24 rounded" />
        <SkeletonBox className="mt-2 h-7 w-32 rounded" />
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: accentColor + '18', color: accentColor }}
        >
          {icon}
        </div>
        {trendVal > 0 && (
          <div
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium'
            )}
            style={{
              backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isPositive ? '#10B981' : '#EF4444',
            }}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trendVal.toFixed(1)}%
          </div>
        )}
      </div>
      <p
        className="mt-3 text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="ltr-nums mt-1 text-2xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forecast Chart
// ---------------------------------------------------------------------------

function ForecastChart({
  data,
  isRtl,
}: {
  data: ChartDataPoint[]
  isRtl: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.forecast')}
        </h3>
        <Link
          to="/forecast"
          className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--border-focus)' }}
        >
          {t('forecast.title')}
          <ChevronRight className={cn('h-3 w-3', isRtl && 'rotate-180')} />
        </Link>
      </div>
      <div className="h-[280px]" dir="ltr">
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
              formatter={(value: number | undefined, name: string | undefined) => {
                const v = value ?? 0
                const n = name ?? ''
                return [
                  formatCurrency(v),
                  n === 'income'
                    ? t('dashboard.monthlyIncome')
                    : n === 'expenses'
                      ? t('dashboard.monthlyExpenses')
                      : t('forecast.closingBalance'),
                ]
              }}
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
// Alerts Panel
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

  return (
    <div
      className="flex h-full flex-col rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('dashboard.alerts')}
          </h3>
        </div>
        <Link
          to="/alerts"
          className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--border-focus)' }}
        >
          {t('alerts.title')}
          <ChevronRight className={cn('h-3 w-3', isRtl && 'rotate-180')} />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {displayAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Bell className="mb-2 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('dashboard.noAlerts')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAlerts.map((alert) => {
              const sev = severityConfig(alert.severity)
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
                  style={{
                    backgroundColor: sev.bg,
                    borderColor: sev.border,
                  }}
                >
                  <div style={{ color: sev.text }} className="mt-0.5">
                    {sev.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-semibold leading-snug"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {alert.title}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-snug"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {alert.message}
                    </p>
                  </div>
                  {!alert.is_read && (
                    <div
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: sev.text }}
                    />
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
// Quick Actions
// ---------------------------------------------------------------------------

function QuickActions({ isRtl }: { isRtl: boolean }) {
  const { t } = useTranslation()

  const actions = [
    {
      label: t('transactions.add'),
      icon: <PlusCircle className="h-4 w-4" />,
      href: '/transactions',
      color: '#10B981',
    },
    {
      label: t('balance.update'),
      icon: <Banknote className="h-4 w-4" />,
      href: '/balance',
      color: '#3B82F6',
    },
    {
      label: t('forecast.title'),
      icon: <BarChart3 className="h-4 w-4" />,
      href: '/forecast',
      color: '#8B5CF6',
    },
    {
      label: t('loans.title'),
      icon: <CreditCard className="h-4 w-4" />,
      href: '/loans',
      color: '#F59E0B',
    },
  ]

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h3
        className="mb-4 text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('dashboard.quickActions')}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="flex flex-col items-center gap-2 rounded-lg border px-3 py-4 transition-all hover:scale-[1.02]"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: action.color + '18', color: action.color }}
            >
              {action.icon}
            </div>
            <span
              className="text-center text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {action.label}
            </span>
            <ChevronRight
              className={cn('h-3 w-3', isRtl && 'rotate-180')}
              style={{ color: 'var(--text-tertiary)' }}
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        <Wallet className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('common.noData')}
      </h3>
      <p
        className="mt-1 max-w-xs text-center text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('balance.update')}
      </p>
      <Link
        to="/balance"
        className="brand-gradient mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg"
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
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
      >
        <AlertTriangle className="h-8 w-8" style={{ color: '#EF4444' }} />
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('common.error')}
      </h3>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-primary)',
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

  // --- Data queries ---
  const summaryQuery = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  })

  const forecastQuery = useQuery({
    queryKey: ['forecast', 'monthly', 6],
    queryFn: () => forecastApi.monthly(6),
  })

  const alertsQuery = useQuery({
    queryKey: ['alerts', 'list'],
    queryFn: () => alertsApi.list(),
  })

  // --- Derived state ---
  const summary = summaryQuery.data
  const forecastData = forecastQuery.data
  const alerts = alertsQuery.data

  const isSummaryLoading = summaryQuery.isLoading
  const isAllError =
    summaryQuery.isError && forecastQuery.isError && alertsQuery.isError

  // Determine if the user has no data at all (both summary and forecast failed with 404)
  const isNoData =
    summaryQuery.isError &&
    forecastQuery.isError &&
    !isSummaryLoading

  const chartData = forecastData ? buildChartData(forecastData.months) : []

  const handleRetry = () => {
    summaryQuery.refetch()
    forecastQuery.refetch()
    alertsQuery.refetch()
  }

  // --- KPI definitions ---
  const kpis: Omit<KpiCardProps, 'isLoading'>[] = [
    {
      icon: <Wallet className="h-5 w-5" />,
      label: t('dashboard.currentBalance'),
      value: summary ? formatCurrency(summary.current_balance) : '--',
      trend: summary?.balance_trend ?? '0',
      accentColor: '#3B82F6',
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: t('dashboard.monthlyIncome'),
      value: summary ? formatCurrency(summary.monthly_income) : '--',
      trend: summary?.income_trend ?? '0',
      accentColor: '#10B981',
    },
    {
      icon: <TrendingDown className="h-5 w-5" />,
      label: t('dashboard.monthlyExpenses'),
      value: summary ? formatCurrency(summary.monthly_expenses) : '--',
      trend: summary?.expense_trend ?? '0',
      accentColor: '#EF4444',
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: t('dashboard.netCashflow'),
      value: summary ? formatCurrency(summary.net_cashflow) : '--',
      trend: '0',
      accentColor: '#8B5CF6',
    },
  ]

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 p-6">
      {/* --- Inline keyframe style for KPI pulse --- */}
      <style>{`
        @keyframes kpiPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.015); }
          100% { transform: scale(1); }
        }
        .kpi-pulse {
          animation: kpiPulse 0.35s ease-in-out;
        }
      `}</style>

      {/* --- Page title --- */}
      <h1
        className="text-2xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('dashboard.title')}
      </h1>

      {/* --- Error / empty state --- */}
      {isAllError && !isSummaryLoading && (
        <ErrorState onRetry={handleRetry} />
      )}

      {isNoData && !isAllError && (
        <EmptyState />
      )}

      {/* --- KPI Cards --- */}
      {!isAllError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} isLoading={isSummaryLoading} />
          ))}
        </div>
      )}

      {/* --- Chart + Alerts row --- */}
      {!isAllError && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Forecast chart - spans 2 cols */}
          <div className="lg:col-span-2">
            {forecastQuery.isLoading ? (
              <div
                className="rounded-xl border p-5"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <SkeletonBox className="mb-4 h-5 w-40 rounded" />
                <SkeletonBox className="h-[280px] w-full rounded-lg" />
              </div>
            ) : chartData.length > 0 ? (
              <ForecastChart data={chartData} isRtl={isRtl} />
            ) : (
              <div
                className="flex h-full items-center justify-center rounded-xl border p-10"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {t('common.noData')}
                </p>
              </div>
            )}
          </div>

          {/* Alerts panel - spans 1 col */}
          <div className="lg:col-span-1">
            {alertsQuery.isLoading ? (
              <div
                className="rounded-xl border p-5"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <SkeletonBox className="mb-4 h-5 w-24 rounded" />
                <div className="space-y-3">
                  <SkeletonBox className="h-14 w-full rounded-lg" />
                  <SkeletonBox className="h-14 w-full rounded-lg" />
                  <SkeletonBox className="h-14 w-full rounded-lg" />
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
