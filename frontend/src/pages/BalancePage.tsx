import { useState, useCallback, useEffect } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCountUp } from '@/hooks/useCountUp'
import { useCursorGlow } from '@/hooks/useCursorGlow'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { ValueType, NameType, Payload } from 'recharts/types/component/DefaultTooltipContent'
import {
  Wallet,
  Plus,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  History,
  CalendarDays,
  StickyNote,
} from 'lucide-react'
import type { BankBalance } from '@/types'
import { balanceApi } from '@/api/balance'
import type { CreateBalanceData } from '@/api/balance'
import DatePicker from '@/components/ui/DatePicker'
import { cn, formatDate } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BalanceFormData {
  balance: string
  effective_date: string
  notes: string
}

interface ChartDataPoint {
  date: string
  dateLabel: string
  balance: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: BalanceFormData = {
  balance: '',
  effective_date: today(),
  notes: '',
}

function buildChartData(history: BankBalance[], locale: string = 'en-US'): ChartDataPoint[] {
  const sorted = [...history].sort(
    (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime(),
  )
  return sorted.map((entry) => ({
    date: entry.effective_date,
    dateLabel: formatDateShort(entry.effective_date, locale),
    balance: parseFloat(entry.balance),
  }))
}

function formatDateShort(dateStr: string, locale: string = 'en-US'): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

/** Compute trend between last two history entries */
function computeTrend(history: BankBalance[]): { direction: 'up' | 'down' | 'flat'; amount: number; percent: number } | null {
  if (history.length < 2) return null
  const sorted = [...history].sort(
    (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime(),
  )
  const current = parseFloat(sorted[0].balance)
  const previous = parseFloat(sorted[1].balance)
  const diff = current - previous
  const percent = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0

  return {
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    amount: Math.abs(diff),
    percent: Math.abs(percent),
  }
}

// ---------------------------------------------------------------------------
// Custom Chart Tooltip — Glassmorphism
// ---------------------------------------------------------------------------

function BalanceTooltip({
  active,
  payload,
  label,
  balanceLabel,
}: {
  active?: boolean
  payload?: Payload<ValueType, NameType>[]
  label?: string
  balanceLabel: string
}) {
  const { formatAmount } = useCurrency()

  if (!active || !payload || payload.length === 0) return null

  const balance = payload[0]?.value as number

  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <p
        className="mb-2 text-[13px] font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </p>
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
          }}
        />
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {balanceLabel}
        </span>
        <span
          className="fin-number ms-auto ps-6 text-sm font-bold ltr-nums"
          style={{
            color: balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
          }}
        >
          {formatAmount(balance)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton — Shimmer variant
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton rounded', className)}
    />
  )
}

// ---------------------------------------------------------------------------
// Loading State — Premium skeleton layout
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="card animate-fade-in-up stagger-1 p-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-[72px] w-[72px] rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-52" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="hidden h-14 w-14 rounded-full sm:block" />
        </div>
      </div>
      {/* Chart skeleton */}
      <div className="card animate-fade-in-up stagger-2 p-8">
        <Skeleton className="mb-5 h-4 w-32" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
      {/* Table skeleton */}
      <div className="card animate-fade-in-up stagger-3 overflow-hidden">
        <div className="px-7 py-5">
          <Skeleton className="h-4 w-36" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-6 px-7 py-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State — Premium, delightful
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="animate-fade-in-scale flex flex-col items-center justify-center py-24">
      <div
        className="empty-float relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl"
        style={{
          background: 'var(--gradient-brand-subtle)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <Wallet
          className="h-11 w-11"
          style={{ color: 'var(--color-brand-500)' }}
        />
      </div>
      <h3
        className="text-xl font-extrabold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('common.noData')}
      </h3>
      <p
        className="mt-2.5 max-w-[320px] text-center text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('balance.update')}
      </p>
      <button
        onClick={onAdd}
        className="btn-primary mt-10 inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" />
        {t('balance.update')}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Balance Chart — Premium AreaChart with split gradient
// ---------------------------------------------------------------------------

function BalanceChart({ data }: { data: ChartDataPoint[] }) {
  const { t } = useTranslation()

  if (data.length < 2) return null

  const hasNegative = data.some((d) => d.balance < 0)
  const minBalance = Math.min(...data.map((d) => d.balance))
  const maxBalance = Math.max(...data.map((d) => d.balance))

  // Calculate the split offset for negative/positive gradient coloring
  let splitOffset = 1
  if (hasNegative && maxBalance > 0) {
    const range = maxBalance - minBalance
    splitOffset = range !== 0 ? maxBalance / range : 1
  } else if (hasNegative) {
    splitOffset = 0
  }

  return (
    <div className="card card-hover animate-fade-in-up section-delay-2 overflow-hidden p-0">
      {/* Chart header */}
      <div
        className="flex items-center gap-3 px-8 pt-7 pb-2"
      >
        <div
          className="icon-circle-sm flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}
        >
          <TrendingUp className="h-4 w-4" />
        </div>
        <h3
          className="text-[15px] font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('balance.history')}
        </h3>
        {/* Data points count */}
        <span className="meta-pill ms-auto">
          {data.length} {t('balance.points')}
        </span>
      </div>

      {/* Chart body */}
      <div className="h-[320px] px-4 pb-6" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 20, left: 8, bottom: 8 }}>
            <defs>
              {hasNegative ? (
                <>
                  <linearGradient id="balanceGradSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.25} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="var(--color-brand-500)" stopOpacity={0.03} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="var(--color-expense)" stopOpacity={0.03} />
                    <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="balanceStrokeSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={1} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="var(--color-brand-500)" stopOpacity={1} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="var(--color-expense)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--color-expense)" stopOpacity={1} />
                  </linearGradient>
                </>
              ) : (
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="var(--color-brand-500)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--border-primary)"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) =>
                Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
              }
              width={52}
              dx={-4}
            />
            <Tooltip
              content={<BalanceTooltip balanceLabel={t('balance.current')} />}
              cursor={{
                stroke: 'var(--text-tertiary)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />
            {hasNegative && (
              <ReferenceLine
                y={0}
                stroke="var(--text-tertiary)"
                strokeDasharray="6 3"
                strokeOpacity={0.5}
              />
            )}
            <Area
              type="monotone"
              dataKey="balance"
              stroke={hasNegative ? 'url(#balanceStrokeSplit)' : 'var(--color-brand-500)'}
              strokeWidth={2.5}
              fill={hasNegative ? 'url(#balanceGradSplit)' : 'url(#balanceGrad)'}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              dot={{
                r: 4,
                fill: 'var(--color-brand-500)',
                strokeWidth: 2.5,
                stroke: 'var(--bg-card)',
              }}
              activeDot={{
                r: 7,
                strokeWidth: 3,
                fill: 'var(--color-brand-500)',
                stroke: 'var(--bg-card)',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BalancePage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { formatAmount } = useCurrency()
  const scrollRef = useScrollReveal()
  const { ref: glowRef, onMouseMove: handleGlow } = useCursorGlow()

  useEffect(() => {
    document.title = t('pageTitle.balance')
  }, [t])

  // State
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState<BalanceFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof BalanceFormData, string>>>({})

  // Queries
  const currentQuery = useQuery({
    queryKey: queryKeys.balance.current(),
    queryFn: () => balanceApi.getCurrent(),
    retry: false,
  })

  const historyQuery = useQuery({
    queryKey: queryKeys.balance.history(),
    queryFn: () => balanceApi.history(),
  })

  const currentBalance = currentQuery.data
  const history = historyQuery.data ?? []
  const hasBalance = !!currentBalance && !currentQuery.isError
  const isLoading = currentQuery.isLoading

  // Sort history by date descending for the table
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime(),
  )

  // Chart data
  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const chartData = buildChartData(history, locale)

  // Trend
  const trend = computeTrend(history)

  // Mutations
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.balance.all })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateBalanceData) => balanceApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
      toast.success(t('toast.balanceUpdated'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  // Modal helpers
  const openModal = () => {
    if (currentBalance) {
      setFormData({
        balance: currentBalance.balance,
        effective_date: today(),
        notes: '',
      })
    } else {
      setFormData(EMPTY_FORM)
    }
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }, [])

  // Modal accessibility (Escape key, focus trap, aria)
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)

  // Form validation & submit
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof BalanceFormData, string>> = {}
    const amt = parseFloat(formData.balance)
    if (!formData.balance || isNaN(amt)) {
      errors.balance = t('common.error')
    }
    if (!formData.effective_date) {
      errors.effective_date = t('common.error')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateBalanceData = {
      balance: parseFloat(formData.balance),
      effective_date: formData.effective_date,
      notes: formData.notes || undefined,
    }

    // Always use POST (create) to ensure every change is logged in history
    createMutation.mutate(payload)
  }

  const isMutating = createMutation.isPending

  // Parse balance for color
  const balanceNum = currentBalance ? parseFloat(currentBalance.balance) : 0
  const balanceColor = balanceNum >= 0 ? 'var(--color-income)' : 'var(--color-expense)'

  // Animated balance display
  const animatedBalance = useCountUp(currentBalance ? parseFloat(currentBalance.balance) : 0, 800)

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div ref={scrollRef} className="space-y-8 p-6 md:p-8 lg:p-10">
      {/* Page header */}
      <div className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="gradient-heading text-[1.85rem] font-extrabold tracking-tight"
          >
            {t('balance.title')}
          </h1>
          {hasBalance && currentBalance && (
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('balance.effectiveDate')}: {formatDate(currentBalance.effective_date, locale)}
            </p>
          )}
        </div>

        {hasBalance && (
          <button
            onClick={openModal}
            className="btn-primary inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            {t('balance.update')}
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <LoadingSkeleton />}

      {/* Empty state */}
      {!isLoading && !hasBalance && <EmptyState onAdd={openModal} />}

      {/* ================================================================
          HERO BALANCE CARD
          ================================================================ */}
      {!isLoading && hasBalance && currentBalance && (
        <div
          ref={glowRef}
          onMouseMove={handleGlow}
          className="hero-balance-card card card-glow content-reveal animate-fade-in-up stagger-1 relative overflow-hidden"
          style={{
            boxShadow: 'var(--shadow-lg)',
            padding: '2rem',
          }}
        >
          {/* Brand gradient accent line at top */}
          <div
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
          />

          <div className="flex items-start gap-6">
            {/* Icon container */}
            <div
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: 'var(--bg-info)',
                color: 'var(--color-brand-500)',
              }}
            >
              <Wallet className="h-9 w-9" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('balance.current')}
              </p>

              <p
                className="fin-number-xl ltr-nums mt-1.5 text-[2.75rem] font-extrabold leading-none tracking-tight"
                style={{ color: balanceColor }}
              >
                <span className="tabular-nums">{formatAmount(animatedBalance)}</span>
              </p>

              {/* Meta row: date + trend + notes */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="meta-pill">
                  <CalendarDays className="h-3 w-3" />
                  <span className="ltr-nums">
                    {formatDate(currentBalance.effective_date, locale)}
                  </span>
                </span>

                {currentBalance.notes && (
                  <span className="meta-pill">
                    <StickyNote className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">
                      {currentBalance.notes}
                    </span>
                  </span>
                )}

                {/* Trend indicator */}
                {trend && trend.direction !== 'flat' && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: trend.direction === 'up'
                        ? 'var(--bg-success)'
                        : 'var(--bg-danger)',
                      color: trend.direction === 'up'
                        ? 'var(--color-success)'
                        : 'var(--color-danger)',
                      border: `1px solid ${trend.direction === 'up' ? 'var(--border-success)' : 'var(--border-danger)'}`,
                    }}
                  >
                    {trend.direction === 'up' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="ltr-nums">
                      {trend.percent.toFixed(1)}%
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Trend direction icon — desktop only */}
            <div
              className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full sm:flex"
              style={{
                backgroundColor: balanceNum >= 0
                  ? 'var(--bg-success)'
                  : 'var(--bg-danger)',
                color: balanceColor,
              }}
            >
              {balanceNum >= 0 ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
            </div>
          </div>

          {/* Overdraft indicator */}
          {balanceNum < 0 && (
            <div
              className="mt-5 flex items-center gap-2.5 rounded-xl px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-danger-subtle)',
                border: '1px solid var(--border-danger)',
              }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: 'var(--color-expense)',
                  boxShadow: '0 0 6px rgba(0,0,0,0.15)',
                }}
              />
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--color-danger)' }}
              >
                {t('balance.current')}: {formatAmount(currentBalance.balance)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          Balance Chart
          ================================================================ */}
      <div className="scroll-reveal">
        {!isLoading && hasBalance && <BalanceChart data={chartData} />}
      </div>

      {/* ================================================================
          History Table — Premium styling
          ================================================================ */}
      {!isLoading && hasBalance && sortedHistory.length > 0 && (
        <div className="scroll-reveal card card-hover animate-fade-in-up section-delay-3 overflow-hidden">
          {/* Table header */}
          <div
            className="flex items-center gap-3 border-b px-7 py-5"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
              }}
            >
              <History className="h-4 w-4" />
            </div>
            <h3
              className="text-[15px] font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('balance.history')}
            </h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {sortedHistory.length}
            </span>
          </div>

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
                  <th
                    scope="col"
                    className="px-7 py-3.5 text-start text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('balance.effectiveDate')}
                  </th>
                  <th
                    scope="col"
                    className="px-7 py-3.5 text-start text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('balance.current')}
                  </th>
                  <th
                    scope="col"
                    className="px-7 py-3.5 text-start text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.notes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((entry, index) => {
                  const entryBal = parseFloat(entry.balance)
                  const entryColor = entryBal >= 0 ? 'var(--color-income)' : 'var(--color-expense)'
                  // Determine change from previous entry
                  const prevEntry = sortedHistory[index + 1]
                  const prevBal = prevEntry ? parseFloat(prevEntry.balance) : null
                  const change = prevBal !== null ? entryBal - prevBal : null

                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        'row-enter row-animate border-b transition-colors hover:bg-[var(--bg-hover)]',
                      )}
                      style={{
                        '--row-index': Math.min(index, 15),
                        borderColor: 'var(--border-primary)',
                        animationDelay: `${index * 30}ms`,
                      } as CSSProperties}
                    >
                      <td
                        className="whitespace-nowrap px-7 py-4 font-medium ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <CalendarDays
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: 'var(--text-tertiary)' }}
                          />
                          {formatDate(entry.effective_date, locale)}
                        </div>
                      </td>
                      <td
                        className="whitespace-nowrap px-7 py-4"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="fin-number font-bold ltr-nums"
                            style={{ color: entryColor }}
                          >
                            {formatAmount(entry.balance)}
                          </span>
                          {/* Inline change indicator */}
                          {change !== null && change !== 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
                              style={{
                                color: change > 0
                                  ? 'var(--color-success)'
                                  : 'var(--color-danger)',
                              }}
                            >
                              {change > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="max-w-[300px] overflow-hidden truncate px-7 py-4"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={entry.notes || undefined}
                      >
                        {entry.notes || '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================
          Modal: Update Balance — Glassmorphism
          ================================================================ */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="balance-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestModalClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={modalPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Brand accent line */}
            <div
              className="h-[3px] w-full"
              style={{ backgroundColor: 'var(--color-brand-500)' }}
            />

            <div className="p-7">
              {/* Header */}
              <div className="mb-7 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: 'var(--bg-info)',
                      color: 'var(--color-brand-500)',
                    }}
                  >
                    <Wallet className="h-5 w-5" />
                  </div>
                  <h2
                    id="balance-modal-title"
                    className="text-lg font-extrabold tracking-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('balance.update')}
                  </h2>
                </div>
                <button
                  onClick={requestModalClose}
                  className="rounded-xl p-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Balance amount */}
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('balance.current')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, balance: e.target.value }))
                    }
                    className={cn(
                      'input w-full rounded-xl border px-4 py-3.5 text-lg font-bold ltr-nums',
                      formErrors.balance && 'input-error',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.balance ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="0.00"
                    aria-describedby={formErrors.balance ? 'balance-balance-error' : undefined}
                    aria-invalid={!!formErrors.balance}
                  />
                  {formErrors.balance && (
                    <p
                      id="balance-balance-error"
                      role="alert"
                      className="mt-1.5 text-xs font-semibold"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      {formErrors.balance}
                    </p>
                  )}
                </div>

                {/* Effective date */}
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('balance.effectiveDate')} *
                  </label>
                  <DatePicker
                    value={formData.effective_date}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, effective_date: val }))
                    }
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                      formErrors.effective_date && 'input-error',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.effective_date ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    aria-describedby={formErrors.effective_date ? 'balance-date-error' : undefined}
                    aria-invalid={!!formErrors.effective_date}
                  />
                  {formErrors.effective_date && (
                    <p
                      id="balance-date-error"
                      role="alert"
                      className="mt-1.5 text-xs font-semibold"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      {formErrors.effective_date}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label
                    className="mb-2 block text-sm font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('transactions.notes')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                    className={cn(
                      'input w-full resize-none rounded-xl border px-4 py-3 text-sm',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder={t('transactions.notes')}
                  />
                </div>

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-3 border-t pt-5"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <button
                    type="button"
                    onClick={requestModalClose}
                    className="btn-press btn-secondary rounded-xl px-5 py-2.5 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
