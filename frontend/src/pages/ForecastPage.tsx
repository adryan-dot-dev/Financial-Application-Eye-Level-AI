import { useState, useEffect, useMemo, useCallback } from 'react'
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
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AreaChart,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Zap,
  GitCompareArrows,
  Sparkles,
} from 'lucide-react'
import type { ForecastMonth, ForecastSummary } from '@/types'
import { forecastApi } from '@/api/forecast'
import type { WeeklyForecastWeek } from '@/api/forecast'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'

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

function formatMonthLabel(monthStr: string): string {
  const normalized = monthStr.length > 7 ? monthStr.slice(0, 7) : monthStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return monthStr
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function formatMonthLabelLong(monthStr: string): string {
  const normalized = monthStr.length > 7 ? monthStr.slice(0, 7) : monthStr
  const date = new Date(normalized + '-01')
  if (isNaN(date.getTime())) return monthStr
  return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildMonthlyChartData(months: ForecastMonth[]): MonthlyChartDataPoint[] {
  return months.map((m) => ({
    month: formatMonthLabel(m.month),
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

function buildWeeklyChartData(weeks: WeeklyForecastWeek[]): WeeklyChartDataPoint[] {
  return weeks.map((w) => ({
    week: formatWeekLabel(w.week_start),
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
  if (maxBalance === minBalance) return balance >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'
  const normalized = (balance - minBalance) / (maxBalance - minBalance)
  if (normalized > 0.6) return `rgba(16, 185, 129, ${0.04 + normalized * 0.06})`
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
// Custom Chart Tooltip
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
      className="rounded-xl border px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      }}
    >
      <p
        className="mb-2 text-[13px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </p>
      {payload.map((entry) => {
        const val = typeof entry.value === 'number' ? entry.value : 0
        if (val === 0 && String(entry.dataKey) !== 'closingBalance') return null
        return (
          <div
            key={String(entry.dataKey)}
            className="flex items-center gap-2 py-0.5"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {fieldMap[String(entry.dataKey)] ?? String(entry.dataKey)}
            </span>
            <span
              className="fin-number ms-auto ps-4 text-xs ltr-nums"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatAmount(entry.value as number)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton rounded', className)}
    />
  )
}

function TableSkeleton() {
  return (
    <div className="card animate-fade-in-up section-delay-1 space-y-3 p-6">
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
// KPI Card (Apple-level) with trend arrow
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
      className={cn('card p-6', staggerClass, staggerClass && 'animate-fade-in-up')}
      style={{
        background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}04, var(--bg-card))`,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: accentColor + '14', color: accentColor }}
        >
          {icon}
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              backgroundColor:
                trend === 'up' ? 'rgba(16, 185, 129, 0.1)' :
                trend === 'down' ? 'rgba(239, 68, 68, 0.1)' :
                'rgba(107, 114, 128, 0.1)',
              color:
                trend === 'up' ? '#10B981' :
                trend === 'down' ? '#EF4444' :
                'var(--text-tertiary)',
            }}
          >
            {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend === 'stable' && <Minus className="h-3 w-3" />}
            {trendLabel && (
              <span className="text-[10px] font-semibold">{trendLabel}</span>
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
        className="fin-number text-xl ltr-nums mt-1.5 tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline mini chart
// ---------------------------------------------------------------------------

function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 80
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width="80" height={height} className="inline-block" style={{ verticalAlign: 'middle' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// What-If Scenario Panel
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
      className="card animate-fade-in-up overflow-hidden"
      style={{
        background: isActive
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(59, 130, 246, 0.04), var(--bg-card))'
          : undefined,
        borderColor: isActive ? 'rgba(139, 92, 246, 0.2)' : undefined,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-start transition-colors hover:opacity-80"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              backgroundColor: isActive ? 'rgba(139, 92, 246, 0.12)' : 'rgba(107, 114, 128, 0.08)',
              color: isActive ? '#8B5CF6' : 'var(--text-tertiary)',
            }}
          >
            <Zap className="h-4.5 w-4.5" />
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
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' }}
            >
              {t('forecast.scenarioActive')}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        ) : (
          <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        )}
      </button>

      {expanded && (
        <div className="border-t px-6 pb-6 pt-5" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {/* Add Monthly Income */}
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-widest"
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
                  className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium tabular-nums ltr-nums outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  dir="ltr"
                />
                <TrendingUp
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: '#10B981' }}
                />
              </div>
            </div>

            {/* Add Monthly Expense */}
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-widest"
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
                  className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium tabular-nums ltr-nums outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  dir="ltr"
                />
                <TrendingDown
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: '#EF4444' }}
                />
              </div>
            </div>

            {/* Change Starting Balance */}
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-widest"
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
                  className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium tabular-nums ltr-nums outline-none transition-all focus:ring-2"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  dir="ltr"
                />
                <Wallet
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: '#3B82F6' }}
                />
              </div>
            </div>
          </div>

          {isActive && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all hover:opacity-80"
                style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.08)',
                  color: '#8B5CF6',
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
// Month Drill-Down Modal
// ---------------------------------------------------------------------------

function MonthDrillDownModal({
  month,
  onClose,
}: {
  month: ForecastMonth
  onClose: () => void
}) {
  const { formatAmount } = useCurrency()
  const { t } = useTranslation()

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('forecast.monthBreakdown')}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatMonthLabelLong(month.month)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-70"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Balance overview */}
        <div className="grid grid-cols-3 gap-4 border-b px-6 py-4" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.openingBalance')}
            </p>
            <p
              className="fin-number text-base ltr-nums mt-1"
              style={{ color: isNegative(month.opening_balance) ? 'var(--color-expense)' : 'var(--text-primary)' }}
            >
              {formatAmount(month.opening_balance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.netChange')}
            </p>
            <p
              className="fin-number text-base ltr-nums mt-1"
              style={{ color: netChange >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {netChange >= 0 ? '+' : ''}{formatAmount(month.net_change)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.closingBalance')}
            </p>
            <p
              className="fin-number text-base ltr-nums mt-1"
              style={{ color: closingNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
            >
              {formatAmount(month.closing_balance)}
            </p>
          </div>
        </div>

        {/* Two-column: Income (right in RTL) vs Expenses (left in RTL) */}
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
          {/* Income column */}
          <div className="border-b p-6 sm:border-b-0 sm:border-e" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="mb-4 flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
              >
                <TrendingUp className="h-3.5 w-3.5" style={{ color: '#10B981' }} />
              </div>
              <h4 className="text-sm font-bold" style={{ color: '#10B981' }}>
                {t('forecast.incomeBreakdown')}
              </h4>
            </div>
            <div className="space-y-3">
              {incomeItems.map((item) => {
                const val = parseFloat(item.value)
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {item.label}
                    </span>
                    <span
                      className="fin-number text-xs ltr-nums"
                      style={{ color: val > 0 ? '#10B981' : 'var(--text-tertiary)' }}
                    >
                      {formatAmount(item.value)}
                    </span>
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
                <span className="fin-number text-sm ltr-nums" style={{ color: '#10B981' }}>
                  {formatAmount(month.total_income)}
                </span>
              </div>
            </div>
          </div>

          {/* Expense column */}
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <TrendingDown className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
              </div>
              <h4 className="text-sm font-bold" style={{ color: '#EF4444' }}>
                {t('forecast.expenseBreakdown')}
              </h4>
            </div>
            <div className="space-y-3">
              {expenseItems.map((item) => {
                const val = Math.abs(parseFloat(item.value))
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {item.label}
                    </span>
                    <span
                      className="fin-number text-xs ltr-nums"
                      style={{ color: val > 0 ? '#EF4444' : 'var(--text-tertiary)' }}
                    >
                      {formatAmount(Math.abs(parseFloat(item.value)))}
                    </span>
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
                <span className="fin-number text-sm ltr-nums" style={{ color: '#EF4444' }}>
                  {formatAmount(Math.abs(parseFloat(month.total_expenses)))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Negative balance warning */}
        {closingNeg && (
          <div
            className="mx-6 mb-6 flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              borderColor: 'rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#EF4444' }} />
            <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>
              {t('forecast.negativeBalanceAlert')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Forecast Chart with toggle (Area/Stacked Bar)
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

  return (
    <div className="card animate-fade-in-up section-delay-2 overflow-hidden p-7">
      <div className="mb-5 flex items-center justify-between">
        <h3
          className="text-base font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('dashboard.forecast')}
        </h3>
        <div className="flex items-center gap-2">
          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            {t('forecast.clickToExplore')}
          </p>
          <div className="segment-control" style={{ transform: 'scale(0.85)', transformOrigin: 'center right' }}>
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

      <div className="h-[360px] px-1" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chartView === 'area' ? (
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
              onClick={handleChartClick}
            >
              <defs>
                <linearGradient id="forecastIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
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
                content={<ForecastTooltip fieldMap={areaFieldMap} />}
                cursor={{ fill: 'var(--bg-hover)', opacity: 0.4, radius: 4 }}
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
                stroke="#34D399"
                strokeWidth={2}
                fill="url(#forecastIncomeGrad)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#34D399', stroke: 'var(--bg-card)' }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#F87171"
                strokeWidth={2}
                fill="url(#forecastExpenseGrad)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#F87171', stroke: 'var(--bg-card)' }}
              />
              <Line
                type="monotone"
                dataKey="closingBalance"
                stroke="var(--color-brand-500)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: 'var(--color-brand-500)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                activeDot={{ r: 6, strokeWidth: 2.5, fill: 'var(--color-brand-500)', stroke: 'var(--bg-card)' }}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
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
                content={<ForecastTooltip fieldMap={barFieldMap} />}
                cursor={{ fill: 'var(--bg-hover)', opacity: 0.4, radius: 4 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  paddingTop: '16px',
                }}
                formatter={(value: string) => barFieldMap[value] ?? value}
              />
              {/* Stacked income bars (greens) */}
              <Bar dataKey="fixedIncome" stackId="income" fill="#34D399" radius={[0, 0, 0, 0]} />
              <Bar dataKey="installmentIncome" stackId="income" fill="#6EE7B7" radius={[0, 0, 0, 0]} />
              <Bar dataKey="expectedIncome" stackId="income" fill="#A7F3D0" radius={[0, 0, 0, 0]} />
              <Bar dataKey="oneTimeIncome" stackId="income" fill="#D1FAE5" radius={[2, 2, 0, 0]} />
              {/* Stacked expense bars (reds) */}
              <Bar dataKey="fixedExpenses" stackId="expense" fill="#F87171" radius={[0, 0, 0, 0]} />
              <Bar dataKey="installmentExpenses" stackId="expense" fill="#FCA5A5" radius={[0, 0, 0, 0]} />
              <Bar dataKey="loanPayments" stackId="expense" fill="#FECACA" radius={[0, 0, 0, 0]} />
              <Bar dataKey="oneTimeExpenses" stackId="expense" fill="#FEE2E2" radius={[2, 2, 0, 0]} />
              {/* Line overlay for closing balance */}
              <Line
                type="monotone"
                dataKey="closingBalance"
                stroke="var(--color-brand-500)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: 'var(--color-brand-500)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                activeDot={{ r: 6, strokeWidth: 2.5, fill: 'var(--color-brand-500)', stroke: 'var(--bg-card)' }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly Forecast Chart (Premium)
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
    <div className="card animate-fade-in-up section-delay-2 overflow-hidden p-7">
      <h3
        className="mb-5 text-base font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('forecast.weekly')}
      </h3>
      <div className="h-[300px] px-1" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="weeklyIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="weeklyExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F87171" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
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
              content={<ForecastTooltip fieldMap={fieldMap} />}
              cursor={{ fill: 'var(--bg-hover)', opacity: 0.4, radius: 4 }}
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
              stroke="#34D399"
              strokeWidth={2}
              fill="url(#weeklyIncomeGrad)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#34D399', stroke: 'var(--bg-card)' }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#F87171"
              strokeWidth={2}
              fill="url(#weeklyExpenseGrad)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#F87171', stroke: 'var(--bg-card)' }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--color-brand-500)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'var(--color-brand-500)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
              activeDot={{ r: 6, strokeWidth: 2.5, fill: 'var(--color-brand-500)', stroke: 'var(--bg-card)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Monthly Table with gradient coloring and drill-down
// ---------------------------------------------------------------------------

function MonthlyTable({
  months,
  onMonthClick,
}: {
  months: ForecastMonth[]
  onMonthClick: (monthStr: string) => void
}) {
  const { t } = useTranslation()
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
                  className="whitespace-nowrap px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
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
              const closingVal = parseFloat(month.closing_balance)
              const bgColor = getBalanceGradientColor(closingVal, minBalance, maxBalance)

              return (
                <tr
                  key={month.month}
                  className={cn(
                    'border-b cursor-pointer transition-all',
                    'hover:brightness-95',
                  )}
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: bgColor,
                  }}
                  onClick={() => onMonthClick(month.month)}
                  title={t('forecast.clickToExplore')}
                >
                  {/* Month */}
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-medium"
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
                    className="whitespace-nowrap px-5 py-3.5 tabular-nums ltr-nums"
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
                    className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-income)' }}
                  >
                    {formatAmount(month.total_income)}
                  </td>

                  {/* Total expenses */}
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-expense)' }}
                  >
                    {formatAmount(month.total_expenses)}
                  </td>

                  {/* Closing balance */}
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-semibold tabular-nums ltr-nums"
                    style={{
                      color: closingNeg ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {formatAmount(month.closing_balance)}
                      <span
                        className="text-xs font-normal"
                        style={{ color: netNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
                      >
                        ({netNeg ? '' : '+'}{formatAmount(month.net_change)})
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
// Weekly Table (Apple-level)
// ---------------------------------------------------------------------------

function WeeklyTable({
  weeks,
}: {
  weeks: WeeklyForecastWeek[]
}) {
  const { t } = useTranslation()
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
                  className="whitespace-nowrap px-5 py-3.5 text-start text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const balanceNeg = isNegative(week.running_balance)
              const netNeg = isNegative(week.net_change)

              return (
                <tr
                  key={week.week_start}
                  className={cn(
                    'border-b transition-colors',
                    balanceNeg
                      ? 'bg-[rgba(239,68,68,0.04)] hover:bg-[rgba(239,68,68,0.08)]'
                      : 'hover:bg-[var(--bg-hover)]',
                  )}
                  style={{
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-medium ltr-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatWeekLabel(week.week_start)}
                  </td>
                  <td
                    className="whitespace-nowrap px-5 py-3.5 ltr-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatWeekLabel(week.week_end)}
                  </td>
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-income)' }}
                  >
                    {formatAmount(week.income)}
                  </td>
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums ltr-nums"
                    style={{ color: 'var(--color-expense)' }}
                  >
                    {formatAmount(week.expenses)}
                  </td>
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums ltr-nums"
                    style={{ color: netNeg ? 'var(--color-expense)' : 'var(--color-income)' }}
                  >
                    {netNeg ? '' : '+'}{formatAmount(week.net_change)}
                  </td>
                  <td
                    className="whitespace-nowrap px-5 py-3.5 font-semibold tabular-nums ltr-nums"
                    style={{
                      color: balanceNeg ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {formatAmount(week.running_balance)}
                      {balanceNeg && (
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
// Comparison View
// ---------------------------------------------------------------------------

function ComparisonView({
  months,
  isLoading,
}: {
  months: ForecastMonth[]
  isLoading: boolean
}) {
  const { t } = useTranslation()
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
      <div className="animate-fade-in-scale flex flex-col items-center justify-center py-16">
        <GitCompareArrows className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
      <div className="card animate-fade-in-up p-6">
        <h3 className="mb-5 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('forecast.comparisonTitle')}
        </h3>

        {/* Month selectors */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              className="mb-2 block text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('forecast.selectMonthA')}
            </label>
            <select
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonthLabelLong(m.month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-2 block text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('forecast.selectMonthB')}
            </label>
            <select
              value={selectedB}
              onChange={(e) => setSelectedB(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {formatMonthLabelLong(m.month)}
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
                    className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    &nbsp;
                  </th>
                  <th
                    className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {formatMonthLabel(monthA.month)}
                  </th>
                  <th
                    className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {formatMonthLabel(monthB.month)}
                  </th>
                  <th
                    className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('forecast.difference')}
                  </th>
                  <th
                    className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('forecast.changePercent')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFields.map((field) => {
                  const valA = parseFloat(String(monthA[field.key]))
                  const valB = parseFloat(String(monthB[field.key]))
                  const absA = field.isExpense ? Math.abs(valA) : valA
                  const absB = field.isExpense ? Math.abs(valB) : valB
                  const diff = absB - absA
                  const pctChange = absA !== 0 ? ((diff / Math.abs(absA)) * 100) : (absB !== 0 ? 100 : 0)
                  const isSignificant = Math.abs(pctChange) > 15

                  return (
                    <tr
                      key={field.key}
                      className="border-b transition-colors"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: isSignificant ? (diff > 0 && !field.isExpense ? 'rgba(16, 185, 129, 0.03)' : diff > 0 && field.isExpense ? 'rgba(239, 68, 68, 0.03)' : diff < 0 && field.isExpense ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)') : undefined,
                      }}
                    >
                      <td
                        className="whitespace-nowrap px-4 py-3 font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {field.label}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                        {formatAmount(absA)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                        {formatAmount(absB)}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 font-medium tabular-nums ltr-nums"
                        style={{
                          color: diff === 0 ? 'var(--text-tertiary)' :
                            (!field.isExpense && diff > 0) || (field.isExpense && diff < 0) ? '#10B981' : '#EF4444',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {diff > 0 && <ArrowUpRight className="h-3 w-3" />}
                          {diff < 0 && <ArrowDownRight className="h-3 w-3" />}
                          {diff === 0 && <Minus className="h-3 w-3" />}
                          {formatAmount(Math.abs(diff))}
                        </div>
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums ltr-nums"
                        style={{
                          color: pctChange === 0 ? 'var(--text-tertiary)' :
                            (!field.isExpense && pctChange > 0) || (field.isExpense && pctChange < 0) ? '#10B981' : '#EF4444',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {isSignificant && (
                            <span
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                              style={{
                                backgroundColor:
                                  (!field.isExpense && pctChange > 0) || (field.isExpense && pctChange < 0)
                                    ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
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
// Summary Tab (Apple-level) with sparklines and improved warnings
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn('card p-6 animate-fade-in-up', `stagger-${i + 1}`)}
            >
              <Skeleton className="mb-3 h-11 w-11 rounded-xl" />
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
      <div className="animate-fade-in-scale flex flex-col items-center justify-center py-16">
        <BarChart3 className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
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
          className="animate-fade-in-up rounded-2xl border-2 px-6 py-5"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02))',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold" style={{ color: '#EF4444' }}>
                {t('forecast.negativeBalanceAlert')}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('forecast.negativeBalanceDesc')}
              </p>
              {summary.alerts_count > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                  >
                    {summary.alerts_count} {t('alerts.title').toLowerCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards with trends and sparklines */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t('dashboard.monthlyIncome')}
          value={formatAmount(summary.total_expected_income)}
          accentColor="#10B981"
          staggerClass="stagger-1"
          trend={incomeTrend}
          trendLabel={t(`forecast.trend${incomeTrend === 'up' ? 'Up' : incomeTrend === 'down' ? 'Down' : 'Stable'}`)}
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5" />}
          label={t('dashboard.monthlyExpenses')}
          value={formatAmount(summary.total_expected_expenses)}
          accentColor="#EF4444"
          staggerClass="stagger-2"
          trend={expenseTrend}
          trendLabel={t(`forecast.trend${expenseTrend === 'up' ? 'Up' : expenseTrend === 'down' ? 'Down' : 'Stable'}`)}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label={t('dashboard.netCashflow')}
          value={formatAmount(summary.net_projected)}
          accentColor={netProjected >= 0 ? '#10B981' : '#EF4444'}
          staggerClass="stagger-3"
          trend={netProjected >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label={t('forecast.closingBalance')}
          value={formatAmount(summary.end_balance)}
          accentColor={parseFloat(summary.end_balance) >= 0 ? '#3B82F6' : '#EF4444'}
          staggerClass="stagger-4"
          trend={balanceTrend}
          trendLabel={t(`forecast.trend${balanceTrend === 'up' ? 'Up' : balanceTrend === 'down' ? 'Down' : 'Stable'}`)}
        />
      </div>

      {/* Sparkline summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.avgMonthlyIncome')}
              </p>
              <p className="fin-number text-base ltr-nums mt-1" style={{ color: '#10B981' }}>
                {formatAmount(avgIncome)}
              </p>
            </div>
            <Sparkline data={incomeValues} color="#10B981" />
          </div>
        </div>
        <div className="card animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.avgMonthlyExpenses')}
              </p>
              <p className="fin-number text-base ltr-nums mt-1" style={{ color: '#EF4444' }}>
                {formatAmount(avgExpenses)}
              </p>
            </div>
            <Sparkline data={expenseValues} color="#EF4444" />
          </div>
        </div>
        <div className="card animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.lowestBalance')}
              </p>
              <p
                className="fin-number text-base ltr-nums mt-1"
                style={{ color: lowestBalance < 0 ? '#EF4444' : 'var(--text-primary)' }}
              >
                {formatAmount(lowestBalance)}
              </p>
            </div>
            <Sparkline data={balanceValues} color="var(--color-brand-500)" />
          </div>
        </div>
        <div className="card animate-fade-in-up section-delay-1 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('forecast.highestBalance')}
              </p>
              <p className="fin-number text-base ltr-nums mt-1" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(highestBalance)}
              </p>
            </div>
            <Sparkline data={balanceValues} color="var(--color-brand-500)" />
          </div>
        </div>
      </div>

      {/* Current balance & forecast period info */}
      <div className="card animate-fade-in-up section-delay-2 p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('balance.current')}
            </p>
            <p className="fin-number text-xl ltr-nums mt-1.5" style={{ color: 'var(--text-primary)' }}>
              {formatAmount(summary.current_balance)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('forecast.months')}
            </p>
            <p className="mt-1.5 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {summary.forecast_months}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {t('alerts.title')}
            </p>
            <p
              className="mt-1.5 text-xl font-bold"
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
  const { t } = useTranslation()

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
    return buildMonthlyChartData(adjustedMonths)
  }, [adjustedMonths])

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
    <div className="space-y-7 p-6 md:p-8">
      {/* Page header */}
      <div className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-[1.75rem] font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('forecast.title')}
        </h1>

        {/* Negative month warning badge */}
        {rawMonthlyData?.has_negative_months && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#EF4444',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('forecast.negativeWarning')}
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

      {/* Controls row: Tabs + Month selector */}
      <div className="animate-fade-in-up section-delay-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Apple segment control for tabs */}
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

        {/* Month selector - also Apple segment style */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
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
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: 'var(--text-tertiary)' }}
            />
          )}
        </div>
      </div>

      {/* What-If active indicator */}
      {isWhatIfActive && activeTab === 'monthly' && (
        <div
          className="animate-fade-in flex items-center gap-2 rounded-xl px-4 py-2"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: '#8B5CF6' }} />
          <span className="text-xs font-semibold" style={{ color: '#8B5CF6' }}>
            {t('forecast.scenarioActive')} - {t('forecast.adjustedForecast')}
          </span>
        </div>
      )}

      {/* Error state */}
      {isCurrentTabError && (
        <div className="card animate-fade-in-scale flex items-center justify-center p-12">
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
          ) : adjustedMonths && adjustedMonths.length > 0 ? (
            <>
              <MonthlyTable months={adjustedMonths} onMonthClick={handleMonthClick} />
              <MonthlyChart
                data={chartData}
                chartView={chartView}
                setChartView={setChartView}
                onMonthClick={handleMonthClick}
              />
            </>
          ) : (
            <div className="animate-fade-in-scale flex flex-col items-center justify-center py-16">
              <BarChart3 className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
            <>
              <WeeklyTable weeks={weeklyData.weeks} />
              <WeeklyChart data={buildWeeklyChartData(weeklyData.weeks)} />
            </>
          ) : (
            <div className="animate-fade-in-scale flex flex-col items-center justify-center py-16">
              <Calendar className="mb-3 h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
