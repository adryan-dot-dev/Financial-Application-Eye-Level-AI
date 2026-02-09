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
  Landmark,
  Percent,
  DollarSign,
  Banknote,
} from 'lucide-react'
import type { Loan, Category } from '@/types'
import { loansApi } from '@/api/loans'
import type { CreateLoanData } from '@/api/loans'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  name: string
  original_amount: string
  monthly_payment: string
  interest_rate: string
  total_payments: string
  start_date: string
  day_of_month: string
  description: string
  category_id: string
}

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: FormData = {
  name: '',
  original_amount: '',
  monthly_payment: '',
  interest_rate: '',
  total_payments: '',
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
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 flex-1 rounded-lg" />
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

function StatusBadge({ status }: { status: Loan['status'] }) {
  const { t } = useTranslation()

  const config = {
    active: { bg: '#10B98115', color: '#10B981', dotColor: '#10B981' },
    completed: { bg: '#94A3B815', color: '#94A3B8', dotColor: '#94A3B8' },
    paused: { bg: '#F59E0B15', color: '#F59E0B', dotColor: '#F59E0B' },
  }

  const { bg, color, dotColor } = config[status]

  const label =
    status === 'active'
      ? t('fixed.active')
      : status === 'completed'
        ? t('loans.status')
        : t('fixed.paused')

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: bg, color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LoansPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRtl = i18n.language === 'he'

  // ---- State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Loan | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null)

  // Record payment modal
  const [paymentTarget, setPaymentTarget] = useState<Loan | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  // ---- Queries ----
  const {
    data: loans = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['loans'],
    queryFn: () => loansApi.list(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['loans'] })

  const createMutation = useMutation({
    mutationFn: (data: CreateLoanData) => loansApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLoanData> }) =>
      loansApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => loansApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      loansApi.recordPayment(id, { amount }),
    onSuccess: () => {
      invalidate()
      setPaymentTarget(null)
      setPaymentAmount('')
    },
  })

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingEntry(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (entry: Loan) => {
    setEditingEntry(entry)
    setFormData({
      name: entry.name,
      original_amount: entry.original_amount,
      monthly_payment: entry.monthly_payment,
      interest_rate: entry.interest_rate,
      total_payments: String(entry.total_payments),
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

  const openPaymentModal = (loan: Loan) => {
    setPaymentTarget(loan)
    setPaymentAmount(loan.monthly_payment)
  }

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.error')
    const origAmt = parseFloat(formData.original_amount)
    if (!formData.original_amount || isNaN(origAmt) || origAmt <= 0) errors.original_amount = t('common.error')
    const monthlyPmt = parseFloat(formData.monthly_payment)
    if (!formData.monthly_payment || isNaN(monthlyPmt) || monthlyPmt <= 0) errors.monthly_payment = t('common.error')
    const rate = parseFloat(formData.interest_rate)
    if (formData.interest_rate === '' || isNaN(rate) || rate < 0) errors.interest_rate = t('common.error')
    const totalPmts = parseInt(formData.total_payments)
    if (!formData.total_payments || isNaN(totalPmts) || totalPmts < 1) errors.total_payments = t('common.error')
    const dom = parseInt(formData.day_of_month)
    if (isNaN(dom) || dom < 1 || dom > 31) errors.day_of_month = t('common.error')
    if (!formData.start_date) errors.start_date = t('common.error')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateLoanData = {
      name: formData.name.trim(),
      original_amount: parseFloat(formData.original_amount),
      monthly_payment: parseFloat(formData.monthly_payment),
      interest_rate: parseFloat(formData.interest_rate),
      total_payments: parseInt(formData.total_payments),
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

  const handleRecordPayment = (e: FormEvent) => {
    e.preventDefault()
    if (!paymentTarget) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) return
    recordPaymentMutation.mutate({ id: paymentTarget.id, amount: amt })
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Categories for the form (loans are typically expenses)
  const formCategories = categories.filter(
    (c) => c.type === 'expense' && !c.is_archived,
  )

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
            {t('loans.title')}
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {loans.length} {t('transactions.total').toLowerCase()}
            </p>
          )}
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Plus className="h-4 w-4" />
          {t('loans.add')}
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
      ) : loans.length === 0 ? (
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
            <Landmark className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
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
            {t('loans.title')}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--border-focus)' }}
          >
            <Plus className="h-4 w-4" />
            {t('loans.add')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loans.map((loan) => {
            const cat = loan.category_id ? categoryMap.get(loan.category_id) : undefined

            return (
              <div
                key={loan.id}
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
                        {loan.name}
                      </h3>
                      {cat && (
                        <div className="mt-1">
                          <CategoryBadge category={cat} isRtl={isRtl} />
                        </div>
                      )}
                    </div>

                    {/* Status badge */}
                    <StatusBadge status={loan.status} />
                  </div>

                  {/* Original amount */}
                  <p
                    className="mb-1 text-xl font-bold tabular-nums ltr-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatCurrency(loan.original_amount, loan.currency)}
                  </p>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <ProgressBar
                      completed={loan.payments_made}
                      total={loan.total_payments}
                    />
                  </div>

                  {/* Stats grid */}
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                          {t('loans.monthlyPayment')}
                        </p>
                      </div>
                      <p
                        className="mt-0.5 text-sm font-semibold tabular-nums ltr-nums"
                        style={{ color: 'var(--color-expense)' }}
                      >
                        {formatCurrency(loan.monthly_payment, loan.currency)}
                      </p>
                    </div>
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <Percent className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                          {t('loans.interestRate')}
                        </p>
                      </div>
                      <p
                        className="mt-0.5 text-sm font-semibold tabular-nums ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {parseFloat(loan.interest_rate).toFixed(2)}%
                      </p>
                    </div>
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <Banknote className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                          {t('loans.remainingBalance')}
                        </p>
                      </div>
                      <p
                        className="mt-0.5 text-sm font-semibold tabular-nums ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatCurrency(loan.remaining_balance, loan.currency)}
                      </p>
                    </div>
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                          {t('fixed.startDate')}
                        </p>
                      </div>
                      <p
                        className="mt-0.5 text-sm font-semibold ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatDate(loan.start_date, isRtl ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-between border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    {/* Record Payment */}
                    {loan.status === 'active' && (
                      <button
                        onClick={() => openPaymentModal(loan)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: 'var(--color-income)' }}
                      >
                        <DollarSign className="h-3 w-3" />
                        {t('loans.recordPayment')}
                      </button>
                    )}
                    {loan.status !== 'active' && <div />}

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(loan)}
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
                        onClick={() => setDeleteTarget(loan)}
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
                  {loan.description && (
                    <p
                      className="mt-2 truncate text-xs"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {loan.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================================================================
          Modal: Add / Edit Loan
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
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-6"
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
                {editingEntry ? t('common.edit') : t('loans.add')}
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

              {/* Original amount + Monthly payment row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('loans.originalAmount')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.original_amount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, original_amount: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.original_amount && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.original_amount ? undefined : 'var(--border-primary)',
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
                    {t('loans.monthlyPayment')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthly_payment}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, monthly_payment: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.monthly_payment && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.monthly_payment ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Interest rate + Total payments row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('loans.interestRate')} (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.interest_rate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, interest_rate: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.interest_rate && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.interest_rate ? undefined : 'var(--border-primary)',
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
                    {t('loans.totalPayments')} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.total_payments}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, total_payments: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.total_payments && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.total_payments ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

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
          Record Payment Modal
          ================================================================== */}
      {paymentTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPaymentTarget(null)
              setPaymentAmount('')
            }
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
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('loans.recordPayment')}
              </h2>
              <button
                onClick={() => {
                  setPaymentTarget(null)
                  setPaymentAmount('')
                }}
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

            {/* Loan info */}
            <div
              className="mb-4 rounded-lg px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {paymentTarget.name}
              </p>
              <p className="mt-1 text-xs ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                {t('loans.remainingBalance')}: {formatCurrency(paymentTarget.remaining_balance, paymentTarget.currency)}
              </p>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('transactions.amount')} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentTarget(null)
                    setPaymentAmount('')
                  }}
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
                  disabled={recordPaymentMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--color-income)' }}
                >
                  {recordPaymentMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t('loans.recordPayment')}
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
