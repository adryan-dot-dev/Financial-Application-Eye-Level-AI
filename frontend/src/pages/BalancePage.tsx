import { useState, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModalA11y } from '@/hooks/useModalA11y'
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
  History,
} from 'lucide-react'
import type { BankBalance } from '@/types'
import { balanceApi } from '@/api/balance'
import type { CreateBalanceData } from '@/api/balance'
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

function buildChartData(history: BankBalance[]): ChartDataPoint[] {
  const sorted = [...history].sort(
    (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime(),
  )
  return sorted.map((entry) => ({
    date: entry.effective_date,
    dateLabel: formatDateShort(entry.effective_date),
    balance: parseFloat(entry.balance),
  }))
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Custom Chart Tooltip
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
      className="rounded-xl border px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      }}
    >
      <p
        className="mb-1.5 text-[13px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor: balance >= 0 ? 'var(--color-brand-500)' : '#F87171',
          }}
        />
        <span
          className="text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {balanceLabel}
        </span>
        <span
          className="ms-auto ps-4 text-xs font-semibold tabular-nums ltr-nums"
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
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton rounded', className)}
    />
  )
}

// ---------------------------------------------------------------------------
// Empty State (Apple-level)
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="animate-fade-in-scale flex flex-col items-center justify-center py-20">
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)' }}
      >
        <Wallet className="h-10 w-10" style={{ color: 'var(--border-focus)' }} />
      </div>
      <h3
        className="text-xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('common.noData')}
      </h3>
      <p
        className="mt-2 max-w-xs text-center text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('balance.update')}
      </p>
      <button
        onClick={onAdd}
        className="btn-primary mt-8 inline-flex items-center gap-2 px-6 py-3 text-sm"
      >
        <Plus className="h-4 w-4" />
        {t('balance.update')}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Balance Chart (Apple-level)
// ---------------------------------------------------------------------------

function BalanceChart({ data }: { data: ChartDataPoint[] }) {
  const { t } = useTranslation()

  if (data.length < 2) return null

  const hasNegative = data.some((d) => d.balance < 0)
  const minBalance = Math.min(...data.map((d) => d.balance))
  const maxBalance = Math.max(...data.map((d) => d.balance))

  // Calculate the split offset for negative/positive gradient coloring
  // offset = proportion of the chart area that is positive (above 0)
  let splitOffset = 1
  if (hasNegative && maxBalance > 0) {
    splitOffset = maxBalance / (maxBalance - minBalance)
  } else if (hasNegative) {
    splitOffset = 0
  }

  return (
    <div className="card animate-fade-in-up section-delay-2 overflow-hidden p-7">
      <h3
        className="mb-5 text-base font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('balance.history')}
      </h3>
      <div className="h-[300px] px-1" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <defs>
              {hasNegative ? (
                <>
                  <linearGradient id="balanceGradSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="#3B82F6" stopOpacity={0.05} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="#F87171" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="#F87171" stopOpacity={0.25} />
                  </linearGradient>
                  <linearGradient id="balanceStrokeSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="#3B82F6" stopOpacity={1} />
                    <stop offset={`${(splitOffset * 100).toFixed(1)}%`} stopColor="#F87171" stopOpacity={1} />
                    <stop offset="100%" stopColor="#F87171" stopOpacity={1} />
                  </linearGradient>
                </>
              ) : (
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
              tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: number) =>
                Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
              }
              width={50}
            />
            <Tooltip
              content={<BalanceTooltip balanceLabel={t('balance.current')} />}
              cursor={{ stroke: 'var(--text-tertiary)', strokeWidth: 1, strokeDasharray: '4 4' }}
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
              stroke={hasNegative ? 'url(#balanceStrokeSplit)' : '#3B82F6'}
              strokeWidth={2.5}
              fill={hasNegative ? 'url(#balanceGradSplit)' : 'url(#balanceGrad)'}
              dot={{ r: 3.5, fill: 'var(--color-brand-500)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
              activeDot={{ r: 6, strokeWidth: 2.5, fill: 'var(--color-brand-500)', stroke: 'var(--bg-card)' }}
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
  const isRtl = i18n.language === 'he'

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
  const chartData = buildChartData(history)

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
  const { panelRef: modalPanelRef } = useModalA11y(modalOpen, closeModal)

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

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-7 p-6 md:p-8">
      {/* Page header */}
      <div className="animate-fade-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-[1.7rem] font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('balance.title')}
        </h1>

        {hasBalance && (
          <button
            onClick={openModal}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            {t('balance.update')}
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="card animate-fade-in-up stagger-1 p-8">
          <div className="flex flex-col items-center gap-5">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-56" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasBalance && <EmptyState onAdd={openModal} />}

      {/* Current balance card -- HERO element */}
      {!isLoading && hasBalance && currentBalance && (
        <div
          className="card hero-balance-card animate-fade-in-up stagger-1 p-8"
          style={{
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="flex items-center gap-5">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: '#3B82F614', color: '#3B82F6' }}
            >
              <Wallet className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <p
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('balance.current')}
              </p>
              <p
                className="ltr-nums mt-1 text-[2.5rem] font-bold leading-tight tracking-tight"
                style={{ color: balanceColor }}
              >
                {formatAmount(currentBalance.balance)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('balance.effectiveDate')}:{' '}
                  <span className="ltr-nums font-medium">
                    {formatDate(currentBalance.effective_date, isRtl ? 'he-IL' : 'en-US')}
                  </span>
                </p>
                {currentBalance.notes && (
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    - {currentBalance.notes}
                  </span>
                )}
              </div>
            </div>
            <div
              className="hidden h-12 w-12 items-center justify-center rounded-full sm:flex"
              style={{
                backgroundColor: balanceNum >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                color: balanceColor,
              }}
            >
              <TrendingUp className={cn('h-6 w-6', balanceNum < 0 && 'rotate-180')} />
            </div>
          </div>

          {/* Overdraft indicator */}
          {balanceNum < 0 && (
            <div
              className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--color-expense)' }}
              />
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--color-expense)' }}
              >
                {t('balance.current')}: {formatAmount(currentBalance.balance)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Balance chart */}
      {!isLoading && hasBalance && <BalanceChart data={chartData} />}

      {/* History table */}
      {!isLoading && hasBalance && sortedHistory.length > 0 && (
        <div className="card animate-fade-in-up section-delay-3 overflow-hidden">
          <div
            className="flex items-center gap-3 border-b px-6 py-5"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <History className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <h3
              className="text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('balance.history')}
            </h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
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
                    className="px-6 py-3.5 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('balance.effectiveDate')}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('balance.current')}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.notes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((entry) => {
                  const entryBal = parseFloat(entry.balance)
                  const entryColor = entryBal >= 0 ? 'var(--color-income)' : 'var(--color-expense)'

                  return (
                    <tr
                      key={entry.id}
                      className="border-b transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ borderColor: 'var(--border-primary)' }}
                    >
                      <td
                        className="whitespace-nowrap px-6 py-3.5 font-medium ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatDate(entry.effective_date, isRtl ? 'he-IL' : 'en-US')}
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-3.5 font-semibold tabular-nums ltr-nums"
                        style={{ color: entryColor }}
                      >
                        {formatAmount(entry.balance)}
                      </td>
                      <td
                        className="max-w-[300px] overflow-hidden truncate px-6 py-3.5"
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
          Modal: Update Balance
          ================================================================ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="balance-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={modalPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg rounded-2xl border p-7"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2
                id="balance-modal-title"
                className="text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('balance.update')}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-hover)]"
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
                    'w-full rounded-xl border px-4 py-3 text-lg font-semibold outline-none ltr-nums',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    formErrors.balance && 'border-red-400',
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
                  <p id="balance-balance-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
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
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, effective_date: e.target.value }))
                  }
                  className={cn(
                    'w-full rounded-xl border px-4 py-2.5 text-sm outline-none',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    formErrors.effective_date && 'border-red-400',
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
                  <p id="balance-date-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
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
                    'w-full resize-none rounded-xl border px-4 py-2.5 text-sm outline-none',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
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
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-input)',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60"
                >
                  {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
