import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
} from 'lucide-react'
import type { Installment, Category } from '@/types'
import { installmentsApi } from '@/api/installments'
import type { CreateInstallmentData, InstallmentPayment } from '@/api/installments'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  name: string
  total_amount: string
  number_of_payments: string
  type: 'income' | 'expense'
  start_date: string
  day_of_month: string
  description: string
  category_id: string
}

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: FormData = {
  name: '',
  total_amount: '',
  number_of_payments: '',
  type: 'expense',
  start_date: today(),
  day_of_month: '1',
  description: '',
  category_id: '',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded', className)}
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CategoryBadge({
  category,
  isRtl,
}: {
  category: Category | undefined
  isRtl: boolean
}) {
  if (!category) return null
  const bgColor = category.color ? `${category.color}20` : 'var(--bg-tertiary)'
  const textColor = category.color ?? 'var(--text-secondary)'
  const label = isRtl ? category.name_he : category.name

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {category.icon && <span className="text-sm leading-none">{category.icon}</span>}
      {label}
    </span>
  )
}

function ProgressBar({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  const percentage = total > 0 ? Math.min(100, (completed / total) * 100) : 0
  const isComplete = completed >= total

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <span
          className="text-xs font-medium ltr-nums"
          style={{ color: 'var(--text-secondary)' }}
        >
          {completed} / {total}
        </span>
        <span
          className="text-xs font-medium ltr-nums"
          style={{ color: isComplete ? 'var(--color-income)' : 'var(--text-tertiary)' }}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: isComplete ? '#10B981' : 'var(--border-focus)',
          }}
        />
      </div>
    </div>
  )
}

function PaymentSchedulePanel({
  installmentId,
  isRtl,
}: {
  installmentId: string
  isRtl: boolean
}) {
  const { t } = useTranslation()

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['installment-payments', installmentId],
    queryFn: () => installmentsApi.payments(installmentId),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <p className="p-3 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t('common.noData')}
      </p>
    )
  }

  return (
    <div className="max-h-48 overflow-y-auto">
      <table className="w-full text-xs">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <th
              className="px-3 py-2 text-start font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              #
            </th>
            <th
              className="px-3 py-2 text-start font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('transactions.date')}
            </th>
            <th
              className="px-3 py-2 text-start font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('transactions.amount')}
            </th>
            <th
              className="px-3 py-2 text-start font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('loans.status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment: InstallmentPayment) => (
            <tr
              key={payment.id}
              className="border-b last:border-b-0"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <td className="px-3 py-2 ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                {payment.payment_number}
              </td>
              <td className="px-3 py-2 ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                {formatDate(payment.due_date, isRtl ? 'he-IL' : 'en-US')}
              </td>
              <td className="px-3 py-2 font-medium ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(payment.amount)}
              </td>
              <td className="px-3 py-2">
                {payment.is_paid ? (
                  <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-income)' }}>
                    <Check className="h-3 w-3" />
                    {payment.paid_date
                      ? formatDate(payment.paid_date, isRtl ? 'he-IL' : 'en-US')
                      : t('fixed.active')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    <Clock className="h-3 w-3" />
                    {t('fixed.paused')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InstallmentsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRtl = i18n.language === 'he'

  // ---- State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Installment | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<Installment | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ---- Queries ----
  const {
    data: installments = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['installments'],
    queryFn: () => installmentsApi.list(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['installments'] })

  const createMutation = useMutation({
    mutationFn: (data: CreateInstallmentData) => installmentsApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInstallmentData> }) =>
      installmentsApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingEntry(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (entry: Installment) => {
    setEditingEntry(entry)
    setFormData({
      name: entry.name,
      total_amount: entry.total_amount,
      number_of_payments: String(entry.number_of_payments),
      type: entry.type,
      start_date: entry.start_date,
      day_of_month: String(entry.day_of_month),
      description: entry.description ?? '',
      category_id: entry.category_id ?? '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingEntry(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.error')
    const totalAmt = parseFloat(formData.total_amount)
    if (!formData.total_amount || isNaN(totalAmt) || totalAmt <= 0) errors.total_amount = t('common.error')
    const numPayments = parseInt(formData.number_of_payments)
    if (!formData.number_of_payments || isNaN(numPayments) || numPayments < 1) errors.number_of_payments = t('common.error')
    const dom = parseInt(formData.day_of_month)
    if (isNaN(dom) || dom < 1 || dom > 31) errors.day_of_month = t('common.error')
    if (!formData.start_date) errors.start_date = t('common.error')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateInstallmentData = {
      name: formData.name.trim(),
      total_amount: parseFloat(formData.total_amount),
      number_of_payments: parseInt(formData.number_of_payments),
      type: formData.type,
      start_date: formData.start_date,
      day_of_month: parseInt(formData.day_of_month),
      description: formData.description || undefined,
      category_id: formData.category_id || undefined,
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Categories for the form
  const formCategories = categories.filter(
    (c) => c.type === formData.type && !c.is_archived,
  )

  // Computed monthly amount for the form
  const computedMonthly = (() => {
    const total = parseFloat(formData.total_amount)
    const num = parseInt(formData.number_of_payments)
    if (!isNaN(total) && !isNaN(num) && num > 0 && total > 0) {
      return (total / num).toFixed(2)
    }
    return null
  })()

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* ---- Page header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('installments.title')}
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {installments.length} {t('transactions.total').toLowerCase()}
            </p>
          )}
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Plus className="h-4 w-4" />
          {t('installments.add')}
        </button>
      </div>

      {/* ---- Cards grid ---- */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
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
      ) : installments.length === 0 ? (
        /* ---- Empty state ---- */
        <div
          className="flex flex-col items-center justify-center rounded-xl border px-6 py-16"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <CreditCard className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <h3
            className="mb-1 text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('common.noData')}
          </h3>
          <p
            className="mb-6 max-w-xs text-center text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('installments.title')}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--border-focus)' }}
          >
            <Plus className="h-4 w-4" />
            {t('installments.add')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {installments.map((inst) => {
            const isIncome = inst.type === 'income'
            const cat = inst.category_id ? categoryMap.get(inst.category_id) : undefined
            const isExpanded = expandedId === inst.id

            return (
              <div
                key={inst.id}
                className="rounded-xl border transition-shadow"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                }}
              >
                <div className="p-5">
                  {/* Card header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {inst.name}
                      </h3>
                      {cat && (
                        <div className="mt-1">
                          <CategoryBadge category={cat} isRtl={isRtl} />
                        </div>
                      )}
                    </div>

                    {/* Type badge */}
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: isIncome ? '#10B98120' : '#EF444420',
                        color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {isIncome ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {isIncome ? t('transactions.income') : t('transactions.expense')}
                    </span>
                  </div>

                  {/* Amounts */}
                  <div className="mb-3 flex items-baseline gap-3">
                    <p
                      className="text-xl font-bold tabular-nums ltr-nums"
                      style={{
                        color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {formatCurrency(inst.total_amount, inst.currency)}
                    </p>
                    <span
                      className="text-xs font-medium ltr-nums"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {formatCurrency(inst.monthly_amount, inst.currency)} / {t('installments.monthlyAmount').toLowerCase()}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <ProgressBar
                      completed={inst.payments_completed}
                      total={inst.number_of_payments}
                    />
                  </div>

                  {/* Details */}
                  <div
                    className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {t('fixed.dayOfMonth')}: <span className="font-medium ltr-nums">{inst.day_of_month}</span>
                    </span>
                    <span className="ltr-nums">
                      {t('fixed.startDate')}: {formatDate(inst.start_date, isRtl ? 'he-IL' : 'en-US')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-between border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    {/* Payment schedule toggle */}
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : inst.id)
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: 'var(--border-focus)' }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {t('installments.schedule')}
                    </button>

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(inst)}
                        className="rounded-md p-1.5 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = ''
                        }}
                        title={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(inst)}
                        className="rounded-md p-1.5 transition-colors"
                        style={{ color: 'var(--color-expense)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = ''
                        }}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {inst.description && (
                    <p
                      className="mt-2 truncate text-xs"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {inst.description}
                    </p>
                  )}
                </div>

                {/* Expanded payment schedule */}
                {isExpanded && (
                  <div
                    className="border-t"
                    style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <PaymentSchedulePanel installmentId={inst.id} isRtl={isRtl} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ==================================================================
          Modal: Add / Edit Installment
          ================================================================== */}
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
            className="relative z-10 w-full max-w-lg rounded-xl border p-6"
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
                {editingEntry ? t('common.edit') : t('installments.add')}
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
              {/* Type toggle */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('transactions.type')}
                </label>
                <div
                  className="flex rounded-lg border"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  {(['income', 'expense'] as const).map((typeVal) => {
                    const active = formData.type === typeVal
                    const colorVar =
                      typeVal === 'income' ? 'var(--color-income)' : 'var(--color-expense)'
                    return (
                      <button
                        key={typeVal}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            type: typeVal,
                            category_id: '',
                          }))
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors first:rounded-s-lg last:rounded-e-lg"
                        style={{
                          backgroundColor: active ? colorVar : 'var(--bg-input)',
                          color: active ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {typeVal === 'income' ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {typeVal === 'income'
                          ? t('transactions.income')
                          : t('transactions.expense')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Name */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('fixed.name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm outline-none',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    formErrors.name && 'border-red-400',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: formErrors.name ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('fixed.name')}
                />
              </div>

              {/* Total amount + Number of payments row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('installments.totalAmount')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_amount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, total_amount: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.total_amount && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.total_amount ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('installments.numberOfPayments')} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.number_of_payments}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, number_of_payments: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.number_of_payments && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.number_of_payments ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Auto-calculated monthly amount */}
              {computedMonthly && (
                <div
                  className="rounded-lg border px-4 py-3"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t('installments.monthlyAmount')}
                  </p>
                  <p
                    className="mt-0.5 text-lg font-bold tabular-nums ltr-nums"
                    style={{ color: 'var(--border-focus)' }}
                  >
                    {formatCurrency(computedMonthly)}
                  </p>
                </div>
              )}

              {/* Start date + Day of month row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('fixed.startDate')} *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.start_date && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.start_date ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('fixed.dayOfMonth')} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day_of_month}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, day_of_month: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.day_of_month && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.day_of_month ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('transactions.category')}
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, category_id: e.target.value }))
                  }
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm outline-none',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">{t('transactions.selectCategory')}</option>
                  {formCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {isRtl ? cat.name_he : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('transactions.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className={cn(
                    'w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('transactions.description')}
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

      {/* ==================================================================
          Delete Confirmation Dialog
          ================================================================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null)
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-sm rounded-xl border p-6"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: '#EF444420' }}
              >
                <Trash2 className="h-5 w-5" style={{ color: 'var(--color-expense)' }} />
              </div>
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('common.delete')}
              </h3>
            </div>

            <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('transactions.deleteConfirmMessage')}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
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
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-expense)' }}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
