import { useState, useEffect, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import {
  BarChart3,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Loader2,
  Minus,
  AreaChart,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Zap,
  GitCompareArrows,
  Sliders,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react'
import type { ForecastMonth, ForecastSummary } from '@/types'
import { forecastApi } from '@/api/forecast'
import type { WeeklyForecastWeek } from '@/api/forecast'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useCountUp } from '@/hooks/useCountUp'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabValue = 'monthly' | 'weekly' | 'summary' | 'comparison'
type ChartViewMode = 'area' | 'bar'

interface MonthlyChartDataPoint {
  month: string
  rawMonth: string
  income: number
  expenses: number
  closingBalance: number
  // Stacked breakdown fields
  fixedIncome: number
  installmentIncome: number
  expectedIncome: number
  oneTimeIncome: number
  fixedExpenses: number
  installmentExpenses: number
  loanPayments: number
  oneTimeExpenses: number
}

interface WeeklyChartDataPoint {
  week: string
  income: number
  expenses: number
  balance: number
}

interface WhatIfState {
  addedIncome: number
  addedExpense: number
  balanceAdjustment: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_OPTIONS = [1, 3, 6, 12] as const

function formatMonthLabel(monthStr: string, locale: string = 'en-US'): string {
  const normalized = monthStr.length > 7 ? monthStr.slice(0, 7) : monthStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return monthStr
  return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
}

function formatMonthLabelLong(monthStr: string, locale: string = 'en-US'): string {
  const normalized = monthStr.length > 7 ? monthStr.slice(0, 7) : monthStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return monthStr
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

function formatWeekLabel(dateStr: string, locale: string = 'en-US'): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function buildMonthlyChartData(months: ForecastMonth[], locale: string = 'en-US'): MonthlyChartDataPoint[] {
  return months.map((m) => ({
    month: formatMonthLabel(m.month, locale),
    rawMonth: m.month,
    income: parseFloat(m.total_income),
    expenses: Math.abs(parseFloat(m.total_expenses)),
    closingBalance: parseFloat(m.closing_balance),
    fixedIncome: parseFloat(m.fixed_income),
    installmentIncome: parseFloat(m.installment_income),
    expectedIncome: parseFloat(m.expected_income),
    oneTimeIncome: parseFloat(m.one_time_income),
    fixedExpenses: Math.abs(parseFloat(m.fixed_expenses)),
    installmentExpenses: Math.abs(parseFloat(m.installment_expenses)),
    loanPayments: Math.abs(parseFloat(m.loan_payments)),
    oneTimeExpenses: Math.abs(parseFloat(m.one_time_expenses)),
  }))
}

function buildWeeklyChartData(weeks: WeeklyForecastWeek[], locale: string = 'en-US'): WeeklyChartDataPoint[] {
  return weeks.map((w) => ({
    week: formatWeekLabel(w.week_start, locale),
    income: parseFloat(w.income),
    expenses: Math.abs(parseFloat(w.expenses)),
    balance: parseFloat(w.running_balance),
  }))
}

function isNegative(val: string | undefined | null): boolean {
  if (val == null) return false
  const num = parseFloat(val)
  return !isNaN(num) && num < 0
}

function getBalanceGradientColor(balance: number, minBalance: number, maxBalance: number): string {
  if (maxBalance === minBalance) return balance >= 0 ? 'rgba(5, 205, 153, 0.08)' : 'rgba(238, 93, 80, 0.08)'
  const normalized = (balance - minBalance) / (maxBalance - minBalance)
  if (normalized > 0.6) return `rgba(5, 205, 153, ${0.04 + normalized * 0.06})`
  if (normalized > 0.3) return `rgba(234, 179, 8, ${0.04 + (0.6 - normalized) * 0.06})`
  return `rgba(239, 68, 68, ${0.04 + (0.3 - normalized) * 0.08})`
}

function calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable'
  const first = values.slice(0, Math.ceil(values.length / 2))
  const second = values.slice(Math.ceil(values.length / 2))
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length
  const pctChange = ((avgSecond - avgFirst) / Math.abs(avgFirst || 1)) * 100
  if (pctChange > 5) return 'up'
  if (pctChange < -5) return 'down'
  return 'stable'
}

function applyWhatIf(
  months: ForecastMonth[],
  whatIf: WhatIfState,
): ForecastMonth[] {
  if (whatIf.addedIncome === 0 && whatIf.addedExpense === 0 && whatIf.balanceAdjustment === 0) {
    return months
  }
  let runningAdjustment = whatIf.balanceAdjustment
  return months.map((m) => {
    const addedNet = whatIf.addedIncome - whatIf.addedExpense
    runningAdjustment += addedNet
    const origIncome = parseFloat(m.total_income)
    const origExpenses = parseFloat(m.total_expenses)
    const origOpening = parseFloat(m.opening_balance)
    const origClosing = parseFloat(m.closing_balance)
    return {
      ...m,
      total_income: String(origIncome + whatIf.addedIncome),
      total_expenses: String(origExpenses - whatIf.addedExpense),
      opening_balance: String(origOpening + runningAdjustment - addedNet),
      closing_balance: String(origClosing + runningAdjustment),
      net_change: String(parseFloat(m.net_change) + addedNet),
    }
  })
}

// ---------------------------------------------------------------------------
// Custom Chart Tooltip — Glassmorphism
// ---------------------------------------------------------------------------

interface ChartTooltipPayload {
  dataKey?: string | number
  value?: ValueType
  name?: NameType
  color?: string
}

function ForecastTooltip({
  active,
  payload,
  label,
  fieldMap,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string | number
  fieldMap: Record<string, string>
}) {
  const { formatAmount } = useCurrency()
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      className="glass-tooltip"
      style={{ minWidth: '200px' }}
    >
      <p
        className="mb-2.5 text-[13px] font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => {
          const val = typeof entry.value === 'number' ? entry.value : 0
          if (val === 0 && String(entry.dataKey) !== 'closingBalance' && String(entry.dataKey) !== 'balance') return null
          return (
            <div
              key={String(entry.dataKey)}
              className="flex items-center gap-2.5 py-0.5"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: entry.color,
                }}
              />
              <span
                className="text-[12px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {fieldMap[String(entry.dataKey)] ?? String(entry.dataKey)}
              </span>
              <span
                className="fin-number ms-auto ps-6 text-[12px] ltr-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {formatAmount(entry.value as number)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('skeleton rounded', className)}
      style={style}
    />
  )
}

function ChartSkeleton() {
  return (
    <div className="card animate-fade-in-up section-delay-2 overflow-hidden p-8">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-44 rounded-xl" />
      </div>
      <div className="flex items-end gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1">
            <Skeleton
              className="w-full rounded-lg"
              style={{ height: `${60 + Math.random() * 200}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="card animate-fade-in-up section-delay-1 overflow-hidden">
      <div className="p-6">
        <Skeleton className="mb-6 h-5 w-40" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b px-6 py-4"
            style={{ borderColor: 'var(--border-primary)', opacity: 1 - i * 0.1 }}
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card — Premium with gradient accent + trend
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value,
  accentColor,
  staggerClass,
  trend,
  trendLabel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accentColor: string
  staggerClass?: string
  trend?: 'up' | 'down' | 'stable'
  trendLabel?: string
}) {
  return (
    <div
      className={cn(
        'card card-hover group relative overflow-hidden p-6',
        staggerClass,
        staggerClass && 'animate-fade-in-up',
      )}
    >
      {/* Accent glow behind icon */}
      <div
        className="pointer-events-none absolute -top-8 -end-8 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-500 group-hover:opacity-[0.12]"
        style={{ backgroundColor: accentColor }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundColor: accentColor + '14', color: accentColor }}
        >
          {icon}
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              backgroundColor:
                trend === 'up' ? 'var(--bg-success)' :
                trend === 'down' ? 'var(--bg-danger)' :
                'var(--bg-hover)',
              color:
                trend === 'up' ? 'var(--color-success)' :
                trend === 'down' ? 'var(--color-danger)' :
                'var(--text-tertiary)',
            }}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trend === 'stable' && <Minus className="h-3 w-3" />}
            {trendLabel && (
              <span className="text-[10px] font-bold">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
      <p
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p
        className="fin-number text-[22px] ltr-nums mt-1.5 tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="tabular-nums">{value}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline mini chart — Premium with gradient fill
// ---------------------------------------------------------------------------

function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 88

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 6) - 3
    return { x, y }
  })

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Build area path for gradient fill
  const areaPath = `M ${points[0].x},${height} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x},${height} Z`

  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}-${data.length}`

  return (
    <svg width={width} height={height} className="inline-block" style={{ verticalAlign: 'middle' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={color}
        stroke="var(--bg-card)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// What-If Scenario Panel — Premium slide-out
// ---------------------------------------------------------------------------

function WhatIfPanel({
  whatIf,
  setWhatIf,
  isActive,
}: {
  whatIf: WhatIfState
  setWhatIf: (w: WhatIfState) => void
  isActive: boolean
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const handleReset = () => {
    setWhatIf({ addedIncome: 0, addedExpense: 0, balanceAdjustment: 0 })
  }

  return (
    <div
      className={cn(
        'card animate-fade-in-up overflow-hidden transition-all duration-300',
        isActive && 'ring-1',
      )}
      style={{
        backgroundColor: isActive
          ? 'rgba(67, 24, 255, 0.04)'
          : undefined,
        borderColor: isActive ? 'rgba(134, 140, 255, 0.2)' : undefined,
        // @ts-expect-error CSS custom property for ring
        '--tw-ring-color': isActive ? 'rgba(134, 140, 255, 0.15)' : 'transparent',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-7 py-5 text-start transition-colors hover:opacity-80"
      >
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
            style={{
              backgroundColor: isActive ? 'rgba(134, 140, 255, 0.12)' : 'var(--bg-hover)',
              color: isActive ? 'var(--color-accent-purple)' : 'var(--text-tertiary)',
              boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Zap className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('forecast.whatIf')}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.whatIfDesc')}
            </p>
          </div>
          {isActive && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(134, 140, 255, 0.12)', color: 'var(--color-accent-purple)' }}
            >
              {t('forecast.scenarioActive')}
            </span>
          )}
        </div>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bg-hover)' }}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-7 pb-7 pt-6" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Add Monthly Income */}
            <div>
              <label
                className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('forecast.addMonthlyIncome')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={whatIf.addedIncome || ''}
                  onChange={(e) => setWhatIf({ ...whatIf, addedIncome: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="input w-full rounded-xl pe-10 tabular-nums ltr-nums"
                  dir="ltr"
                />
                <TrendingUp
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--color-income)' }}
                />
              </div>
            </div>

            {/* Add Monthly Expense */}
            <div>
              <label
                className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('forecast.addMonthlyExpense')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={whatIf.addedExpense || ''}
                  onChange={(e) => setWhatIf({ ...whatIf, addedExpense: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="input w-full rounded-xl pe-10 tabular-nums ltr-nums"
                  dir="ltr"
                />
                <TrendingDown
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--color-expense)' }}
                />
              </div>
            </div>

            {/* Change Starting Balance */}
            <div>
              <label
                className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('forecast.changeStartingBalance')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={100}
                  value={whatIf.balanceAdjustment || ''}
                  onChange={(e) => setWhatIf({ ...whatIf, balanceAdjustment: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="input w-full rounded-xl pe-10 tabular-nums ltr-nums"
                  dir="ltr"
                />
                <Wallet
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--color-brand-500)' }}
                />
              </div>
            </div>
          </div>

          {isActive && (
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleReset}
                className="btn-press flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: 'rgba(134, 140, 255, 0.08)',
                  color: 'var(--color-accent-purple)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('forecast.resetScenario')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month Drill-Down Modal — Premium glassmorphism
// ---------------------------------------------------------------------------

function MonthDrillDownModal({
  month,
  onClose,
}: {
  month: ForecastMonth
  onClose: () => void
}) {
  const { formatAmount } = useCurrency()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'

  const incomeItems = [
    { label: t('forecast.fixedIncome'), value: month.fixed_income },
    { label: t('forecast.installmentIncome'), value: month.installment_income },
    { label: t('forecast.expectedIncome'), value: month.expected_income },
    { label: t('forecast.oneTimeIncome'), value: month.one_time_income },
  ]

  const expenseItems = [
    { label: t('forecast.fixedExpenses'), value: month.fixed_expenses },
    { label: t('forecast.installmentExpenses'), value: month.installment_expenses },
    { label: t('forecast.loanPayments'), value: month.loan_payments },
    { label: t('forecast.oneTimeExpenses'), value: month.one_time_expenses },
  ]

  const netChange = parseFloat(month.net_change)
  const closingNeg = isNegative(month.closing_balance)

  // Calculate percentage of each item
  const totalIncome = parseFloat(month.total_income) || 1
  const totalExpenses = Math.abs(parseFloat(month.total_expenses)) || 1

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="modal-panel relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-7 py-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div>
            <h3 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {t('forecast.monthBreakdown')}
            </h3>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatMonthLabelLong(month.month, locale)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-press flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:scale-105"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Balance overview — hero row */}
        <div
          className="grid grid-cols-3 gap-0 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="px-7 py-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.openingBalance')}
            </p>
            <p
              className="fin-number text-lg ltr-nums mt-1.5"
              style={{ color: isNegative(month.opening_balance) ? 'var(--color-expense)' : 'var(--text-primary)' }}
            >
              {formatAmount(month.opening_balance)}
            </p>
          </div>
          <div
            className="border-x px-7 py-5 text-center"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.netChange')}
            </p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5">
              {netChange >= 0 ? (
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-income)' }} />
              ) : (
                <TrendingDown className="h-4 w-4" style={{ color: 'var(--color-expense)' }} />
              )}
              <p
                className="fin-number text-lg ltr-nums"
                style={{ color: netChange >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
              >
                {netChange >= 0 ? '+' : ''}{formatAmount(month.net_change)}
              </p>
            </div>
          </div>
          <div className="px-7 py-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.closingBalance')}
            </p>
            <p
              className="fin-number text-lg ltr-nums mt-1.5"
              style={{ color: closingNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
            >
              {formatAmount(month.closing_balance)}
            </p>
          </div>
        </div>

        {/* Two-column: Income vs Expenses */}
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
          {/* Income column */}
          <div className="border-b p-7 sm:border-b-0 sm:border-e" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="mb-5 flex items-center gap-2.5">
              <div
                className="icon-circle icon-circle-sm"
                style={{ backgroundColor: 'var(--bg-success)', color: 'var(--color-income)' }}
              >
                <TrendingUp className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold" style={{ color: 'var(--color-income)' }}>
                {t('forecast.incomeBreakdown')}
              </h4>
            </div>
            <div className="space-y-3">
              {incomeItems.map((item) => {
                const val = parseFloat(item.value)
                const pct = totalIncome > 0 ? (val / totalIncome) * 100 : 0
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {item.label}
                      </span>
                      <span
                        className="fin-number text-xs ltr-nums"
                        style={{ color: val > 0 ? 'var(--color-income)' : 'var(--text-tertiary)' }}
                      >
                        {formatAmount(item.value)}
                      </span>
                    </div>
                    {val > 0 && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-hover)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: 'var(--color-income)',
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              <div
                className="flex items-center justify-between border-t pt-3"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('forecast.totalIncome')}
                </span>
                <span className="fin-number text-sm ltr-nums font-extrabold" style={{ color: 'var(--color-income)' }}>
                  {formatAmount(month.total_income)}
                </span>
              </div>
            </div>
          </div>

          {/* Expense column */}
          <div className="p-7">
            <div className="mb-5 flex items-center gap-2.5">
              <div
                className="icon-circle icon-circle-sm"
                style={{ backgroundColor: 'var(--bg-danger)', color: 'var(--color-expense)' }}
              >
                <TrendingDown className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold" style={{ color: 'var(--color-expense)' }}>
                {t('forecast.expenseBreakdown')}
              </h4>
            </div>
            <div className="space-y-3">
              {expenseItems.map((item) => {
                const val = Math.abs(parseFloat(item.value))
                const pct = totalExpenses > 0 ? (val / totalExpenses) * 100 : 0
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {item.label}
                      </span>
                      <span
                        className="fin-number text-xs ltr-nums"
                        style={{ color: val > 0 ? 'var(--color-expense)' : 'var(--text-tertiary)' }}
                      >
                        {formatAmount(Math.abs(parseFloat(item.value)))}
                      </span>
                    </div>
                    {val > 0 && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-hover)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: 'var(--color-expense)',
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
              <div
                className="flex items-center justify-between border-t pt-3"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('forecast.totalExpenses')}
                </span>
                <span className="fin-number text-sm ltr-nums font-extrabold" style={{ color: 'var(--color-expense)' }}>
                  {formatAmount(Math.abs(parseFloat(month.total_expenses)))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Negative balance warning */}
        {closingNeg && (
          <div
            className="mx-7 mb-7 flex items-center gap-3 rounded-xl border-2 px-5 py-4"
            style={{
              backgroundColor: 'var(--bg-danger-subtle)',
              borderColor: 'var(--border-danger)',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-expense)' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-expense)' }}>
                {t('forecast.negativeBalanceAlert')}
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {t('forecast.negativeBalanceDesc')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Forecast Chart — Premium with Area/Bar toggle
// ---------------------------------------------------------------------------

function MonthlyChart({
  data,
  chartView,
  setChartView,
  onMonthClick,
}: {
  data: MonthlyChartDataPoint[]
  chartView: ChartViewMode
  setChartView: (v: ChartViewMode) => void
  onMonthClick: (rawMonth: string) => void
}) {
  const { t } = useTranslation()
  const [showBalance, setShowBalance] = useState(true)

  if (data.length === 0) return null

  const areaFieldMap: Record<string, string> = {
    income: t('dashboard.monthlyIncome'),
    expenses: t('dashboard.monthlyExpenses'),
    closingBalance: t('forecast.closingBalance'),
  }

  const barFieldMap: Record<string, string> = {
    fixedIncome: t('forecast.fixedIncome'),
    installmentIncome: t('forecast.installmentIncome'),
    expectedIncome: t('forecast.expectedIncome'),
    oneTimeIncome: t('forecast.oneTimeIncome'),
    fixedExpenses: t('forecast.fixedExpenses'),
    installmentExpenses: t('forecast.installmentExpenses'),
    loanPayments: t('forecast.loanPayments'),
    oneTimeExpenses: t('forecast.oneTimeExpenses'),
    closingBalance: t('forecast.closingBalance'),
  }

  const handleChartClick = (state: Record<string, unknown>) => {
    const label = state?.activeLabel as string | undefined
    if (!label) return
    const point = data.find((d) => d.month === label)
    if (point) onMonthClick(point.rawMonth)
  }

  // Detect if any closing balance is negative
  const hasNegativeBalance = data.some((d) => d.closingBalance < 0)

  return (
    <div className="card animate-fade-in-up section-delay-2 overflow-hidden">
      {/* Chart header bar */}
      <div className="flex items-center justify-between border-b px-7 py-5" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-3">
          <h3
            className="text-base font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('dashboard.forecast')}
          </h3>
          {hasNegativeBalance && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: 'var(--bg-danger)',
                color: 'var(--color-expense)',
              }}
            >
              <AlertTriangle className="h-3 w-3" />
              !
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Balance line toggle */}
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="btn-press flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all"
            style={{
              backgroundColor: showBalance ? 'var(--bg-info)' : 'var(--bg-hover)',
              color: showBalance ? 'var(--color-info)' : 'var(--text-tertiary)',
            }}
          >
            {showBalance ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {t('forecast.closingBalance')}
          </button>

          {/* Chart view toggle */}
          <div className="segment-control" style={{ transform: 'scale(0.85)', transformOrigin: 'center end' }}>
            <button
              onClick={() => setChartView('area')}
              className="segment-control-btn"
              data-active={chartView === 'area' ? 'true' : undefined}
            >
              <AreaChart className="h-3.5 w-3.5" />
              {t('forecast.chartViewArea')}
            </button>
            <button
              onClick={() => setChartView('bar')}
              className="segment-control-btn"
              data-active={chartView === 'bar' ? 'true' : undefined}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {t('forecast.chartViewBar')}
            </button>
          </div>
        </div>
      </div>

      {/* Click hint */}
      <div className="flex items-center gap-1.5 px-7 pt-4">
        <Info className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {t('forecast.clickToExplore')}
        </p>
      </div>

      <div className="h-[380px] px-5 pb-6 pt-3" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chartView === 'area' ? (
            <ComposedChart
              data={data}
              margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
              onClick={handleChartClick}
            >
              <defs>
                <linearGradient id="forecastIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-brand-500)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="var(--border-primary)"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}
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
                width={52}
              />
              <Tooltip
                content={<ForecastTooltip fieldMap={areaFieldMap} />}
                cursor={{ fill: 'var(--bg-hover)', opacity: 0.4, radius: 8 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  paddingTop: '16px',
                }}
                formatter={(value: string) => areaFieldMap[value] ?? value}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="var(--color-income)"
                strokeWidth={2.5}
                fill="url(#forecastIncomeGrad)"
                dot={false}
                activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-income)', style: { filter: 'drop-shadow(0 0 6px rgba(5, 205, 153, 0.4))' } }}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="var(--color-expense)"
                strokeWidth={2.5}
                fill="url(#forecastExpenseGrad)"
                dot={false}
                activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-expense)', style: { filter: 'drop-shadow(0 0 6px rgba(238, 93, 80, 0.4))' } }}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
              {showBalance && (
                <Line
                  type="monotone"
                  dataKey="closingBalance"
                  stroke="var(--color-brand-500)"
                  strokeWidth={2.5}
                  strokeDasharray="0"
                  dot={{ r: 4, fill: 'var(--color-brand-500)', strokeWidth: 2.5, stroke: 'var(--bg-card)' }}
                  activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-brand-500)', style: { filter: 'drop-shadow(0 0 6px rgba(108, 99, 255, 0.4))' } }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              )}
              <Brush
                dataKey="month"
                height={28}
                stroke="var(--color-brand-400)"
                fill="var(--bg-hover)"
                travellerWidth={10}
                startIndex={0}
                endIndex={Math.min(data.length - 1, 5)}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={data}
              margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
              onClick={handleChartClick}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="var(--border-primary)"
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}
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
                width={52}
              />
              <Tooltip
                content={<ForecastTooltip fieldMap={barFieldMap} />}
                cursor={{ fill: 'var(--bg-hover)', opacity: 0.4, radius: 8 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  paddingTop: '16px',
                }}
                formatter={(value: string) => barFieldMap[value] ?? value}
              />
              {/* Stacked income bars (monochromatic greens) */}
              <Bar dataKey="fixedIncome" stackId="income" fill="var(--chart-income-1)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              <Bar dataKey="installmentIncome" stackId="income" fill="var(--chart-income-2)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              <Bar dataKey="expectedIncome" stackId="income" fill="var(--chart-income-3)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              <Bar dataKey="oneTimeIncome" stackId="income" fill="var(--chart-income-4)" radius={[2, 2, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              {/* Stacked expense bars (monochromatic reds) */}
              <Bar dataKey="fixedExpenses" stackId="expense" fill="var(--chart-expense-1)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              <Bar dataKey="installmentExpenses" stackId="expense" fill="var(--chart-expense-2)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              <Bar dataKey="loanPayments" stackId="expense" fill="var(--chart-expense-3)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              <Bar dataKey="oneTimeExpenses" stackId="expense" fill="var(--chart-expense-4)" radius={[2, 2, 0, 0]} isAnimationActive={true} animationDuration={450} animationEasing="ease-out" />
              {/* Line overlay for closing balance */}
              {showBalance && (
                <Line
                  type="monotone"
                  dataKey="closingBalance"
                  stroke="var(--color-brand-500)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--color-brand-500)', strokeWidth: 2.5, stroke: 'var(--bg-card)' }}
                  activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-brand-500)', style: { filter: 'drop-shadow(0 0 6px rgba(108, 99, 255, 0.4))' } }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              )}
              <Brush
                dataKey="month"
                height={28}
                stroke="var(--color-brand-400)"
                fill="var(--bg-hover)"
                travellerWidth={10}
                startIndex={0}
                endIndex={Math.min(data.length - 1, 5)}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly Forecast Chart — Premium
// ---------------------------------------------------------------------------

function WeeklyChart({ data }: { data: WeeklyChartDataPoint[] }) {
  const { t } = useTranslation()

  if (data.length < 2) return null

  const fieldMap: Record<string, string> = {
    income: t('transactions.income'),
    expenses: t('transactions.expense'),
    balance: t('balance.current'),
  }

  return (
    <div className="card animate-fade-in-up section-delay-2 overflow-hidden">
      <div className="flex items-center gap-3 border-b px-7 py-5" style={{ borderColor: 'var(--border-primary)' }}>
        <div
          className="icon-circle icon-circle-sm"
          style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}
        >
          <Calendar className="h-4 w-4" />
        </div>
        <h3
          className="text-base font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('forecast.weekly')}
        </h3>
      </div>

      <div className="h-[320px] px-5 pb-6 pt-4" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="weeklyIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="weeklyExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--border-primary)"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500 }}
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
              width={52}
            />
            <Tooltip
              content={<ForecastTooltip fieldMap={fieldMap} />}
              cursor={{ fill: 'var(--bg-hover)', opacity: 0.4, radius: 8 }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                paddingTop: '16px',
              }}
              formatter={(value: string) => fieldMap[value] ?? value}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="var(--color-income)"
              strokeWidth={2.5}
              fill="url(#weeklyIncomeGrad)"
              dot={false}
              activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-income)', style: { filter: 'drop-shadow(0 0 6px rgba(5, 205, 153, 0.4))' } }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="var(--color-expense)"
              strokeWidth={2.5}
              fill="url(#weeklyExpenseGrad)"
              dot={false}
              activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-expense)', style: { filter: 'drop-shadow(0 0 6px rgba(238, 93, 80, 0.4))' } }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--color-brand-500)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'var(--color-brand-500)', strokeWidth: 2.5, stroke: 'var(--bg-card)' }}
              activeDot={{ r: 7, stroke: 'white', strokeWidth: 3, fill: 'var(--color-brand-500)', style: { filter: 'drop-shadow(0 0 6px rgba(108, 99, 255, 0.4))' } }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Table — Premium with gradient rows and drill-down
// ---------------------------------------------------------------------------

function MonthlyTable({
  months,
  onMonthClick,
}: {
  months: ForecastMonth[]
  onMonthClick: (monthStr: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const { formatAmount } = useCurrency()

  const closingBalances = months.map((m) => parseFloat(m.closing_balance))
  const minBalance = Math.min(...closingBalances)
  const maxBalance = Math.max(...closingBalances)

  return (
    <div className="card animate-fade-in-up section-delay-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-hover)',
              }}
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
                  scope="col"
                  className="whitespace-nowrap px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month, idx) => {
              const closingNeg = isNegative(month.closing_balance)
              const netNeg = isNegative(month.net_change)
              const closingVal = parseFloat(month.closing_balance)
              const bgColor = getBalanceGradientColor(closingVal, minBalance, maxBalance)

              return (
                <tr
                  key={month.month}
                  className={cn(
                    'row-enter border-b cursor-pointer transition-all duration-200 row-animate',
                    'hover:brightness-[0.97]',
                  )}
                  style={{
                    '--row-index': Math.min(idx, 15),
                    borderColor: 'var(--border-primary)',
                    backgroundColor: bgColor,
                    animationDelay: `${idx * 30}ms`,
                  } as CSSProperties}
                  onClick={() => onMonthClick(month.month)}
                  title={t('forecast.clickToExplore')}
                >
                  {/* Month */}
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span>{formatMonthLabel(month.month, locale)}</span>
                      {closingNeg && (
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md"
                          style={{ backgroundColor: 'var(--bg-danger)' }}
                        >
                          <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-expense)' }} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Opening balance */}
                  <td
                    className="whitespace-nowrap px-6 py-4 tabular-nums ltr-nums font-medium"
                    style={{
                      color: isNegative(month.opening_balance)
                        ? 'var(--color-expense)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {formatAmount(month.opening_balance)}
                  </td>

                  {/* Total income */}
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold tabular-nums ltr-nums"
                    style={{ color: 'var(--color-income)' }}
                  >
                    {formatAmount(month.total_income)}
                  </td>

                  {/* Total expenses */}
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold tabular-nums ltr-nums"
                    style={{ color: 'var(--color-expense)' }}
                  >
                    {formatAmount(month.total_expenses)}
                  </td>

                  {/* Closing balance */}
                  <td
                    className="whitespace-nowrap px-6 py-4 font-bold tabular-nums ltr-nums"
                    style={{
                      color: closingNeg ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{formatAmount(month.closing_balance)}</span>
                      <span
                        className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: netNeg ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)',
                          color: netNeg ? 'var(--color-expense)' : 'var(--color-income)',
                        }}
                      >
                        {netNeg ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
                        {netNeg ? '' : '+'}{formatAmount(month.net_change)}
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
// Weekly Table — Premium
// ---------------------------------------------------------------------------

function WeeklyTable({
  weeks,
}: {
  weeks: WeeklyForecastWeek[]
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const { formatAmount } = useCurrency()

  return (
    <div className="card animate-fade-in-up section-delay-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-hover)',
              }}
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
                  scope="col"
                  className="whitespace-nowrap px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, idx) => {
              const balanceNeg = isNegative(week.running_balance)
              const netNeg = isNegative(week.net_change)

              return (
                <tr
                  key={week.week_start}
                  className={cn(
                    'row-enter border-b transition-colors duration-200 row-animate',
                    balanceNeg
                      ? 'hover:bg-[rgba(238,93,80,0.06)]'
                      : 'hover:bg-[var(--bg-hover)]',
                  )}
                  style={{
                    '--row-index': Math.min(idx, 15),
                    borderColor: 'var(--border-primary)',
                    backgroundColor: balanceNeg ? 'rgba(238, 93, 80, 0.03)' : undefined,
                    animationDelay: `${idx * 30}ms`,
                  } as CSSProperties}
                >
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold ltr-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatWeekLabel(week.week_start, locale)}
                  </td>
                  <td
                    className="whitespace-nowrap px-6 py-4 ltr-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatWeekLabel(week.week_end, locale)}
                  </td>
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold tabular-nums ltr-nums"
                    style={{ color: 'var(--color-income)' }}
                  >
                    {formatAmount(week.income)}
                  </td>
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold tabular-nums ltr-nums"
                    style={{ color: 'var(--color-expense)' }}
                  >
                    {formatAmount(week.expenses)}
                  </td>
                  <td
                    className="whitespace-nowrap px-6 py-4 font-semibold tabular-nums ltr-nums"
                    style={{ color: netNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
                  >
                    <div className="flex items-center gap-1">
                      {netNeg ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {netNeg ? '' : '+'}{formatAmount(week.net_change)}
                    </div>
                  </td>
                  <td
                    className="whitespace-nowrap px-6 py-4 font-bold tabular-nums ltr-nums"
                    style={{
                      color: balanceNeg ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{formatAmount(week.running_balance)}</span>
                      {balanceNeg && (
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md"
                          style={{ backgroundColor: 'var(--bg-danger)' }}
                        >
                          <AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-expense)' }} />
                        </span>
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
// Comparison View — Premium side-by-side
// ---------------------------------------------------------------------------

function ComparisonView({
  months,
  isLoading,
}: {
  months: ForecastMonth[]
  isLoading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const { formatAmount } = useCurrency()
  const [selectedA, setSelectedA] = useState<string>('')
  const [selectedB, setSelectedB] = useState<string>('')

  useEffect(() => {
    if (months.length >= 2 && !selectedA && !selectedB) {
      setSelectedA(months[0].month)
      setSelectedB(months[1].month)
    }
  }, [months, selectedA, selectedB])

  if (isLoading) {
    return <TableSkeleton />
  }

  if (months.length < 2) {
    return (
      <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
        <div
          className="icon-circle icon-circle-lg mb-4 empty-float"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
        >
          <GitCompareArrows className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>
          {t('common.noData')}
        </p>
      </div>
    )
  }

  const monthA = months.find((m) => m.month === selectedA)
  const monthB = months.find((m) => m.month === selectedB)

  const comparisonFields: { key: keyof ForecastMonth; label: string; isExpense?: boolean }[] = [
    { key: 'total_income', label: t('forecast.totalIncome') },
    { key: 'total_expenses', label: t('forecast.totalExpenses'), isExpense: true },
    { key: 'fixed_income', label: t('forecast.fixedIncome') },
    { key: 'fixed_expenses', label: t('forecast.fixedExpenses'), isExpense: true },
    { key: 'installment_income', label: t('forecast.installmentIncome') },
    { key: 'installment_expenses', label: t('forecast.installmentExpenses'), isExpense: true },
    { key: 'loan_payments', label: t('forecast.loanPayments'), isExpense: true },
    { key: 'expected_income', label: t('forecast.expectedIncome') },
    { key: 'one_time_income', label: t('forecast.oneTimeIncome') },
    { key: 'one_time_expenses', label: t('forecast.oneTimeExpenses'), isExpense: true },
    { key: 'net_change', label: t('forecast.netChange') },
    { key: 'closing_balance', label: t('forecast.closingBalance') },
  ]

  return (
    <div className="space-y-6">
      <div className="card animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-7 py-5" style={{ borderColor: 'var(--border-primary)' }}>
          <div
            className="icon-circle icon-circle-sm"
            style={{ backgroundColor: 'rgba(217, 70, 239, 0.1)', color: 'var(--color-accent-magenta)' }}
          >
            <GitCompareArrows className="h-4 w-4" />
          </div>
          <h3 className="text-base font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('forecast.comparisonTitle')}
          </h3>
        </div>

        {/* Month selectors */}
        <div className="grid grid-cols-1 gap-5 border-b px-7 py-6 sm:grid-cols-2" style={{ borderColor: 'var(--border-primary)' }}>
          <div>
            <label
              className="mb-2 block text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('forecast.selectMonthA')}
            </label>
            <select
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="input w-full rounded-xl"
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonthLabelLong(m.month, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-2 block text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('forecast.selectMonthB')}
            </label>
            <select
              value={selectedB}
              onChange={(e) => setSelectedB(e.target.value)}
              className="input w-full rounded-xl"
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonthLabelLong(m.month, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison table */}
        {monthA && monthB && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-hover)' }}
                >
                  <th
                    className="px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    &nbsp;
                  </th>
                  <th
                    className="px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {formatMonthLabel(monthA.month, locale)}
                  </th>
                  <th
                    className="px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {formatMonthLabel(monthB.month, locale)}
                  </th>
                  <th
                    className="px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('forecast.difference')}
                  </th>
                  <th
                    className="px-6 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('forecast.changePercent')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFields.map((field, idx) => {
                  const valA = parseFloat(String(monthA[field.key]))
                  const valB = parseFloat(String(monthB[field.key]))
                  const absA = field.isExpense ? Math.abs(valA) : valA
                  const absB = field.isExpense ? Math.abs(valB) : valB
                  const diff = absB - absA
                  const pctChange = absA !== 0 ? ((diff / Math.abs(absA)) * 100) : (absB !== 0 ? 100 : 0)
                  const isSignificant = Math.abs(pctChange) > 15

                  // Determine if the change is "good" or "bad"
                  const isPositiveChange = (!field.isExpense && diff > 0) || (field.isExpense && diff < 0)
                  const isNegativeChange = (!field.isExpense && diff < 0) || (field.isExpense && diff > 0)

                  // Separator row for summary items
                  const isSummaryRow = field.key === 'net_change' || field.key === 'closing_balance'

                  return (
                    <tr
                      key={field.key}
                      className={cn(
                        'row-enter border-b transition-colors duration-200 row-animate',
                        isSummaryRow && 'font-semibold',
                      )}
                      style={{
                        '--row-index': Math.min(idx, 15),
                        borderColor: 'var(--border-primary)',
                        backgroundColor: isSignificant
                          ? (isPositiveChange
                            ? 'var(--bg-success-subtle)'
                            : isNegativeChange
                            ? 'var(--bg-danger-subtle)'
                            : undefined)
                          : isSummaryRow
                          ? 'var(--bg-hover)'
                          : undefined,
                        animationDelay: `${idx * 25}ms`,
                      } as CSSProperties}
                    >
                      <td
                        className="whitespace-nowrap px-6 py-3.5 font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {field.label}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 tabular-nums ltr-nums font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {formatAmount(absA)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 tabular-nums ltr-nums font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {formatAmount(absB)}
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-3.5 font-semibold tabular-nums ltr-nums"
                        style={{
                          color: diff === 0 ? 'var(--text-tertiary)' :
                            isPositiveChange ? 'var(--color-income)' : 'var(--color-expense)',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {diff > 0 && <TrendingUp className="h-3 w-3" />}
                          {diff < 0 && <TrendingDown className="h-3 w-3" />}
                          {diff === 0 && <Minus className="h-3 w-3" />}
                          {formatAmount(Math.abs(diff))}
                        </div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-3.5 font-bold tabular-nums ltr-nums"
                        style={{
                          color: pctChange === 0 ? 'var(--text-tertiary)' :
                            isPositiveChange ? 'var(--color-income)' : 'var(--color-expense)',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {isSignificant && (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-extrabold"
                              style={{
                                backgroundColor: isPositiveChange
                                  ? 'var(--bg-success)' : 'var(--bg-danger)',
                                color: isPositiveChange
                                  ? 'var(--color-income)' : 'var(--color-expense)',
                              }}
                            >
                              !
                            </span>
                          )}
                          {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary Tab — Premium with sparklines and enhanced cards
// ---------------------------------------------------------------------------

function SummaryView({
  summary,
  monthlyData,
  isLoading,
}: {
  summary: ForecastSummary | undefined
  monthlyData: ForecastMonth[] | undefined
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const { formatAmount } = useCurrency()

  // useCountUp must be called before any early returns (rules of hooks)
  const animatedIncome = useCountUp(
    summary ? parseFloat(summary.total_expected_income) : 0,
    800,
  )
  const animatedExpenses = useCountUp(
    summary ? Math.abs(parseFloat(summary.total_expected_expenses)) : 0,
    800,
  )
  const animatedNet = useCountUp(
    summary ? parseFloat(summary.net_projected) : 0,
    800,
  )
  const animatedEndBalance = useCountUp(
    summary ? parseFloat(summary.end_balance) : 0,
    800,
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn('card p-6 animate-fade-in-up', `stagger-${i + 1}`)}
            >
              <Skeleton className="mb-4 h-11 w-11 rounded-xl" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2.5 h-6 w-36" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
        <div
          className="icon-circle icon-circle-lg mb-4 empty-float"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
        >
          <BarChart3 className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>
          {t('common.noData')}
        </p>
      </div>
    )
  }

  // Compute trends and sparkline data from monthly data
  const incomeValues = monthlyData?.map((m) => parseFloat(m.total_income)) ?? []
  const expenseValues = monthlyData?.map((m) => Math.abs(parseFloat(m.total_expenses))) ?? []
  const balanceValues = monthlyData?.map((m) => parseFloat(m.closing_balance)) ?? []

  const incomeTrend = calculateTrend(incomeValues)
  const expenseTrend = calculateTrend(expenseValues)
  const netProjected = parseFloat(summary.net_projected)
  const balanceTrend = calculateTrend(balanceValues)

  // Compute summary stats
  const avgIncome = incomeValues.length > 0 ? incomeValues.reduce((a, b) => a + b, 0) / incomeValues.length : 0
  const avgExpenses = expenseValues.length > 0 ? expenseValues.reduce((a, b) => a + b, 0) / expenseValues.length : 0
  const lowestBalance = balanceValues.length > 0 ? Math.min(...balanceValues) : 0
  const highestBalance = balanceValues.length > 0 ? Math.max(...balanceValues) : 0

  return (
    <div className="space-y-7">
      {/* Enhanced negative balance warning */}
      {summary.has_negative_months && (
        <div
          className="animate-fade-in-up card overflow-hidden"
          style={{
            backgroundColor: 'rgba(238, 93, 80, 0.05)',
            borderColor: 'var(--border-danger)',
            borderWidth: '2px',
          }}
        >
          <div className="flex items-start gap-4 p-6">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: 'var(--bg-danger)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
            </div>
            <div className="flex-1">
              <p className="text-base font-extrabold tracking-tight" style={{ color: 'var(--color-expense)' }}>
                {t('forecast.negativeBalanceAlert')}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('forecast.negativeBalanceDesc')}
              </p>
              {summary.alerts_count > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: 'var(--bg-danger)', color: 'var(--color-expense)' }}
                  >
                    {summary.alerts_count} {t('alerts.title').toLowerCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards with trends */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t('dashboard.monthlyIncome')}
          value={formatAmount(animatedIncome)}
          accentColor="var(--color-income)"
          staggerClass="stagger-1"
          trend={incomeTrend}
          trendLabel={t(`forecast.trend${incomeTrend === 'up' ? 'Up' : incomeTrend === 'down' ? 'Down' : 'Stable'}`)}
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5" />}
          label={t('dashboard.monthlyExpenses')}
          value={formatAmount(animatedExpenses)}
          accentColor="var(--color-expense)"
          staggerClass="stagger-2"
          trend={expenseTrend}
          trendLabel={t(`forecast.trend${expenseTrend === 'up' ? 'Up' : expenseTrend === 'down' ? 'Down' : 'Stable'}`)}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label={t('dashboard.netCashflow')}
          value={formatAmount(animatedNet)}
          accentColor={netProjected >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
          staggerClass="stagger-3"
          trend={netProjected >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label={t('forecast.closingBalance')}
          value={formatAmount(animatedEndBalance)}
          accentColor={parseFloat(summary.end_balance) >= 0 ? 'var(--color-brand-500)' : 'var(--color-expense)'}
          staggerClass="stagger-4"
          trend={balanceTrend}
          trendLabel={t(`forecast.trend${balanceTrend === 'up' ? 'Up' : balanceTrend === 'down' ? 'Down' : 'Stable'}`)}
        />
      </div>

      {/* Sparkline summary cards — premium layout */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card card-hover animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.avgMonthlyIncome')}
              </p>
              <p className="fin-number text-[17px] ltr-nums mt-1.5" style={{ color: 'var(--color-income)' }}>
                {formatAmount(avgIncome)}
              </p>
            </div>
            <Sparkline data={incomeValues} color="var(--color-income)" />
          </div>
        </div>
        <div className="card card-hover animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.avgMonthlyExpenses')}
              </p>
              <p className="fin-number text-[17px] ltr-nums mt-1.5" style={{ color: 'var(--color-expense)' }}>
                {formatAmount(avgExpenses)}
              </p>
            </div>
            <Sparkline data={expenseValues} color="var(--color-expense)" />
          </div>
        </div>
        <div className="card card-hover animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.lowestBalance')}
              </p>
              <p
                className="fin-number text-[17px] ltr-nums mt-1.5"
                style={{ color: lowestBalance < 0 ? 'var(--color-expense)' : 'var(--text-primary)' }}
              >
                {formatAmount(lowestBalance)}
              </p>
            </div>
            <Sparkline data={balanceValues} color="var(--color-brand-500)" />
          </div>
        </div>
        <div className="card card-hover animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.highestBalance')}
              </p>
              <p className="fin-number text-[17px] ltr-nums mt-1.5" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(highestBalance)}
              </p>
            </div>
            <Sparkline data={balanceValues} color="var(--color-brand-500)" />
          </div>
        </div>
      </div>

      {/* Forecast period info — premium hero-style */}
      <div className="card animate-fade-in-up section-delay-2 overflow-hidden">
        <div
          className="grid grid-cols-1 gap-0 sm:grid-cols-3"
        >
          <div className="border-b p-7 sm:border-b-0 sm:border-e" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle-sm"
                style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}
              >
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  {t('balance.current')}
                </p>
                <p className="fin-number text-xl ltr-nums mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatAmount(summary.current_balance)}
                </p>
              </div>
            </div>
          </div>
          <div className="border-b p-7 sm:border-b-0 sm:border-e" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle-sm"
                style={{ backgroundColor: 'rgba(217, 70, 239, 0.1)', color: 'var(--color-accent-magenta)' }}
              >
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  {t('forecast.months')}
                </p>
                <p className="mt-1 text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {summary.forecast_months}
                </p>
              </div>
            </div>
          </div>
          <div className="p-7">
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle-sm"
                style={{
                  backgroundColor: summary.alerts_count > 0 ? 'var(--bg-danger)' : 'var(--bg-success)',
                  color: summary.alerts_count > 0 ? 'var(--color-expense)' : 'var(--color-income)',
                }}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                  {t('alerts.title')}
                </p>
                <p
                  className="mt-1 text-xl font-extrabold tracking-tight"
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
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ForecastPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const scrollRef = useScrollReveal()

  useEffect(() => {
    document.title = t('pageTitle.forecast')
  }, [t])

  // State
  const [activeTab, setActiveTab] = useState<TabValue>('monthly')
  const [months, setMonths] = useState<number>(6)
  const [chartView, setChartView] = useState<ChartViewMode>('area')
  const [drillDownMonth, setDrillDownMonth] = useState<string | null>(null)
  const [whatIf, setWhatIf] = useState<WhatIfState>({
    addedIncome: 0,
    addedExpense: 0,
    balanceAdjustment: 0,
  })

  const isWhatIfActive = whatIf.addedIncome !== 0 || whatIf.addedExpense !== 0 || whatIf.balanceAdjustment !== 0

  // Queries
  const monthlyQuery = useQuery({
    queryKey: queryKeys.forecast.monthly(months),
    queryFn: () => forecastApi.monthly(months),
    enabled: activeTab === 'monthly' || activeTab === 'comparison',
  })

  const weeklyQuery = useQuery({
    queryKey: queryKeys.forecast.weekly(months * 4),
    queryFn: () => forecastApi.weekly(months * 4),
    enabled: activeTab === 'weekly',
  })

  const summaryQuery = useQuery({
    queryKey: queryKeys.forecast.summary(months),
    queryFn: () => forecastApi.summary(months),
    enabled: activeTab === 'summary',
  })

  // Also fetch monthly data for summary sparklines
  const monthlyForSummaryQuery = useQuery({
    queryKey: queryKeys.forecast.monthly(months),
    queryFn: () => forecastApi.monthly(months),
    enabled: activeTab === 'summary',
  })

  // Derived data with what-if applied
  const rawMonthlyData = monthlyQuery.data
  const weeklyData = weeklyQuery.data
  const summaryData = summaryQuery.data
  const monthlyForSummary = monthlyForSummaryQuery.data

  const adjustedMonths = useMemo(() => {
    if (!rawMonthlyData?.months) return undefined
    return applyWhatIf(rawMonthlyData.months, whatIf)
  }, [rawMonthlyData, whatIf])

  const chartData = useMemo(() => {
    if (!adjustedMonths) return []
    return buildMonthlyChartData(adjustedMonths, locale)
  }, [adjustedMonths, locale])

  // Drill-down handler
  const handleMonthClick = useCallback((monthStr: string) => {
    setDrillDownMonth(monthStr)
  }, [])

  const drillDownMonthData = useMemo(() => {
    if (!drillDownMonth || !adjustedMonths) return null
    const normalized = drillDownMonth.length > 7 ? drillDownMonth.slice(0, 7) : drillDownMonth
    return adjustedMonths.find((m) => {
      const mNorm = m.month.length > 7 ? m.month.slice(0, 7) : m.month
      return mNorm === normalized
    }) ?? null
  }, [drillDownMonth, adjustedMonths])

  // Tab configuration
  const tabs: { value: TabValue; label: string; icon: React.ReactNode }[] = [
    { value: 'monthly', label: t('forecast.monthly'), icon: <Calendar className="h-3.5 w-3.5" /> },
    { value: 'weekly', label: t('forecast.weekly'), icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { value: 'summary', label: t('forecast.summary'), icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { value: 'comparison', label: t('forecast.comparison'), icon: <GitCompareArrows className="h-3.5 w-3.5" /> },
  ]

  const isCurrentTabLoading =
    (activeTab === 'monthly' && monthlyQuery.isLoading) ||
    (activeTab === 'weekly' && weeklyQuery.isLoading) ||
    (activeTab === 'summary' && summaryQuery.isLoading) ||
    (activeTab === 'comparison' && monthlyQuery.isLoading)

  const isCurrentTabError =
    (activeTab === 'monthly' && monthlyQuery.isError) ||
    (activeTab === 'weekly' && weeklyQuery.isError) ||
    (activeTab === 'summary' && summaryQuery.isError) ||
    (activeTab === 'comparison' && monthlyQuery.isError)

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div ref={scrollRef} className="space-y-7 p-6 md:p-8">
      {/* Page header — premium */}
      <div className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
          >
            {t('forecast.title')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('forecast.monthly')} &middot; {t('forecast.weekly')} &middot; {t('forecast.summary')}
          </p>
        </div>

        {/* Negative month warning badge */}
        {rawMonthlyData?.has_negative_months && (
          <div
            className="inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-danger-subtle)',
              borderColor: 'var(--border-danger)',
              color: 'var(--color-expense)',
            }}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            {t('forecast.negativeWarning')}
            {rawMonthlyData.first_negative_month != null && (
              <span className="ltr-nums">
                ({formatMonthLabel(rawMonthlyData.first_negative_month, locale)})
              </span>
            )}
          </div>
        )}
      </div>

      {/* What-If Panel (only on monthly tab) */}
      {activeTab === 'monthly' && (
        <WhatIfPanel
          whatIf={whatIf}
          setWhatIf={setWhatIf}
          isActive={isWhatIfActive}
        />
      )}

      {/* Controls row: Tabs + Month selector — premium layout */}
      <div className="animate-fade-in-up section-delay-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Segment control for tabs */}
        <div className="segment-control">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className="segment-control-btn"
              data-active={activeTab === tab.value ? 'true' : undefined}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>
            {t('forecast.months')}:
          </span>
          <div className="segment-control">
            {MONTH_OPTIONS.map((opt) => {
              const labelKey = opt === 1 ? 'forecast.month1' : opt === 3 ? 'forecast.months3' : opt === 6 ? 'forecast.months6' : 'forecast.months12'
              return (
                <button
                  key={opt}
                  onClick={() => setMonths(opt)}
                  className="segment-control-btn"
                  data-active={months === opt ? 'true' : undefined}
                >
                  {t(labelKey)}
                </button>
              )
            })}
          </div>

          {/* Loading indicator */}
          {isCurrentTabLoading && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: 'var(--color-brand-500)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* What-If active indicator */}
      {isWhatIfActive && activeTab === 'monthly' && (
        <div
          className="animate-fade-in flex items-center gap-2.5 rounded-xl px-5 py-3"
          style={{
            backgroundColor: 'rgba(134, 140, 255, 0.06)',
            border: '1px solid rgba(134, 140, 255, 0.15)',
          }}
        >
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ backgroundColor: 'rgba(134, 140, 255, 0.12)' }}
          >
            <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--color-accent-purple)' }} />
          </div>
          <span className="text-xs font-bold" style={{ color: 'var(--color-accent-purple)' }}>
            {t('forecast.scenarioActive')} &mdash; {t('forecast.adjustedForecast')}
          </span>
        </div>
      )}

      {/* Error state */}
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

      {/* ================================================================
          Monthly Tab
          ================================================================ */}
      {activeTab === 'monthly' && !isCurrentTabError && (
        <>
          {monthlyQuery.isLoading ? (
            <>
              <TableSkeleton />
              <ChartSkeleton />
            </>
          ) : adjustedMonths && adjustedMonths.length > 0 ? (
            <>
              <div className="scroll-reveal">
                <MonthlyTable months={adjustedMonths} onMonthClick={handleMonthClick} />
              </div>
              <div className="scroll-reveal">
                <MonthlyChart
                  data={chartData}
                  chartView={chartView}
                  setChartView={setChartView}
                  onMonthClick={handleMonthClick}
                />
              </div>
            </>
          ) : (
            <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
              <div
                className="icon-circle icon-circle-lg mb-4 empty-float"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
              >
                <BarChart3 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>
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
            <>
              <TableSkeleton />
              <ChartSkeleton />
            </>
          ) : weeklyData?.weeks && weeklyData.weeks.length > 0 ? (
            <>
              <WeeklyTable weeks={weeklyData.weeks} />
              <WeeklyChart data={buildWeeklyChartData(weeklyData.weeks, locale)} />
            </>
          ) : (
            <div className="card animate-fade-in-scale flex flex-col items-center justify-center py-20">
              <div
                className="icon-circle icon-circle-lg mb-4 empty-float"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
              >
                <Calendar className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>
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
        <SummaryView
          summary={summaryData}
          monthlyData={monthlyForSummary?.months}
          isLoading={summaryQuery.isLoading}
        />
      )}

      {/* ================================================================
          Comparison Tab
          ================================================================ */}
      {activeTab === 'comparison' && !isCurrentTabError && (
        <ComparisonView
          months={rawMonthlyData?.months ?? []}
          isLoading={monthlyQuery.isLoading}
        />
      )}

      {/* ================================================================
          Month Drill-Down Modal
          ================================================================ */}
      {drillDownMonthData && (
        <MonthDrillDownModal
          month={drillDownMonthData}
          onClose={() => setDrillDownMonth(null)}
        />
      )}
    </div>
  )
}
