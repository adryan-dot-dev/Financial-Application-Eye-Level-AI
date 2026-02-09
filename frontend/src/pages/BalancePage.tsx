import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
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
import { cn, formatCurrency, formatDate } from '@/lib/utils'

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

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
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
      <button
        onClick={onAdd}
        className="brand-gradient mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg"
      >
        <Plus className="h-4 w-4" />
        {t('balance.update')}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Balance Chart
// ---------------------------------------------------------------------------

function BalanceChart({ data }: { data: ChartDataPoint[] }) {
  const { t } = useTranslation()

  if (data.length < 2) return null

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
        {t('balance.history')}
      </h3>
      <div className="h-[280px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} />
            <XAxis
              dataKey="dateLabel"
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
              formatter={(value: number | undefined) => [formatCurrency(value ?? 0), t('balance.current')]}
              labelFormatter={(label: React.ReactNode) => String(label ?? '')}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#balanceGrad)"
              dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
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
  const isRtl = i18n.language === 'he'

  // State
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState<BalanceFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof BalanceFormData, string>>>({})

  // Queries
  const currentQuery = useQuery({
    queryKey: ['balance', 'current'],
    queryFn: () => balanceApi.getCurrent(),
    retry: false,
  })

  const historyQuery = useQuery({
    queryKey: ['balance', 'history'],
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
    queryClient.invalidateQueries({ queryKey: ['balance'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateBalanceData) => balanceApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreateBalanceData) => balanceApi.update(data),
    onSuccess: () => {
      invalidate()
      closeModal()
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

  const closeModal = () => {
    setModalOpen(false)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }

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

    if (hasBalance) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Parse balance for color
  const balanceNum = currentBalance ? parseFloat(currentBalance.balance) : 0
  const balanceColor = balanceNum >= 0 ? 'var(--color-income)' : 'var(--color-expense)'

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
          {t('balance.title')}
        </h1>

        {hasBalance && (
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--border-focus)' }}
          >
            <Plus className="h-4 w-4" />
            {t('balance.update')}
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          className="rounded-xl border p-8"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasBalance && <EmptyState onAdd={openModal} />}

      {/* Current balance card */}
      {!isLoading && hasBalance && currentBalance && (
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#3B82F618', color: '#3B82F6' }}
            >
              <Wallet className="h-7 w-7" />
            </div>
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('balance.current')}
              </p>
              <p
                className="ltr-nums text-3xl font-bold tracking-tight"
                style={{ color: balanceColor }}
              >
                {formatCurrency(currentBalance.balance)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t('balance.effectiveDate')}:{' '}
                  <span className="ltr-nums">
                    {formatDate(currentBalance.effective_date, isRtl ? 'he-IL' : 'en-US')}
                  </span>
                </p>
                {currentBalance.notes && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    - {currentBalance.notes}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1" />
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: balanceNum >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: balanceColor,
              }}
            >
              <TrendingUp className={cn('h-5 w-5', balanceNum < 0 && 'rotate-180')} />
            </div>
          </div>
        </div>
      )}

      {/* Balance chart */}
      {!isLoading && hasBalance && <BalanceChart data={chartData} />}

      {/* History table */}
      {!isLoading && hasBalance && sortedHistory.length > 0 && (
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-5 py-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <History className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('balance.history')}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
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
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <th
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)', textAlign: isRtl ? 'right' : 'left' }}
                  >
                    {t('balance.effectiveDate')}
                  </th>
                  <th
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)', textAlign: isRtl ? 'right' : 'left' }}
                  >
                    {t('balance.current')}
                  </th>
                  <th
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)', textAlign: isRtl ? 'right' : 'left' }}
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
                      className="border-b transition-colors"
                      style={{ borderColor: 'var(--border-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ''
                      }}
                    >
                      <td
                        className="whitespace-nowrap px-5 py-3 ltr-nums"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {formatDate(entry.effective_date, isRtl ? 'he-IL' : 'en-US')}
                      </td>
                      <td
                        className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums ltr-nums"
                        style={{ color: entryColor }}
                      >
                        {formatCurrency(entry.balance)}
                      </td>
                      <td
                        className="max-w-[300px] truncate px-5 py-3"
                        style={{ color: 'var(--text-tertiary)' }}
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
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-md rounded-xl border p-6"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('balance.update')}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Balance amount */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
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
                    'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    formErrors.balance && 'border-red-400',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: formErrors.balance ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="0.00"
                />
                {formErrors.balance && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
                    {formErrors.balance}
                  </p>
                )}
              </div>

              {/* Effective date */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
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
                    'w-full rounded-lg border px-3 py-2 text-sm outline-none',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    formErrors.effective_date && 'border-red-400',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: formErrors.effective_date ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
                {formErrors.effective_date && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
                    {formErrors.effective_date}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
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
                    'w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
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
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
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
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--border-focus)' }}
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
