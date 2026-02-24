import { useState, useMemo, useCallback, useEffect } from 'react'
import type { FormEvent, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModalA11y } from '@/hooks/useModalA11y'
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
  Check,
  AlertTriangle,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  ListOrdered,
} from 'lucide-react'
import type { Installment, Category, PaymentMethod } from '@/types'
import { installmentsApi } from '@/api/installments'
import type { CreateInstallmentData, InstallmentPayment } from '@/api/installments'
import { categoriesApi } from '@/api/categories'
import { cn, formatDate } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import CurrencySelector from '@/components/CurrencySelector'
import DatePicker from '@/components/ui/DatePicker'
import PaymentMethodSelector from '@/components/ui/PaymentMethodSelector'
import { CategoryBadge as SharedCategoryBadge } from '@/components/ui/CategoryIcon'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TypeFilter = 'all' | 'income' | 'expense'

interface FormData {
  name: string
  total_amount: string
  number_of_payments: string
  type: 'income' | 'expense'
  start_date: string
  day_of_month: string
  description: string
  category_id: string
  currency: string
  first_payment_made: boolean
  payment_method: PaymentMethod
  credit_card_id: string
  bank_account_id: string
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
  currency: 'ILS',
  first_payment_made: false,
  payment_method: 'cash',
  credit_card_id: '',
  bank_account_id: '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a date is within the next 7 days */
function isWithin7Days(dateStr: string): boolean {
  const target = new Date(dateStr)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton rounded', className)}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="card p-5"
        >
          <div className="space-y-3 skeleton-group">
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
  const label = isRtl ? category.name_he : category.name

  return (
    <SharedCategoryBadge
      icon={category.icon}
      color={category.color}
      label={label}
    />
  )
}

function StatusBadge({ status, t }: { status: Installment['status']; t: (key: string) => string }) {
  const config = {
    completed: { color: 'var(--color-income)', label: t('installments.statusCompleted') },
    active: { color: 'var(--color-brand-500)', label: t('installments.statusActive') },
    pending: { color: 'var(--text-tertiary)', label: t('installments.statusPending') },
    overdue: { color: 'var(--color-expense)', label: t('installments.statusOverdue') },
  }

  const c = config[status] || config.active

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color: c.color, border: '1px solid currentColor', opacity: 0.8 }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: c.color }}
      />
      {c.label}
    </span>
  )
}

function OnTrackIndicator({ isOnTrack, t }: { isOnTrack: boolean; t: (key: string) => string }) {
  if (isOnTrack) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t('installments.onTrack')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
      <AlertTriangle className="h-3.5 w-3.5" />
      {t('installments.behind')}
    </span>
  )
}

function ProgressBar({
  completed,
  total,
  status,
  isOnTrack,
  t,
}: {
  completed: number
  total: number
  status: Installment['status']
  isOnTrack: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const percentage = total > 0 ? Math.min(100, (completed / total) * 100) : 0

  // Color based on status/on-track
  let barColor = 'var(--border-focus)' // default blue for active
  if (status === 'completed') {
    barColor = 'var(--color-success)' // green
  } else if (status === 'overdue' || !isOnTrack) {
    barColor = 'var(--color-danger)' // red
  } else if (status === 'pending') {
    barColor = 'var(--text-tertiary)' // gray
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-sm font-bold ltr-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('installments.xOfYPayments', { completed, total })}
        </span>
        <span
          className="text-sm font-bold ltr-nums"
          style={{ color: barColor }}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div
        className="progress-premium h-3.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div
          className="progress-fill h-full rounded-full progress-fill-animated"
          style={{
            '--target-width': `${percentage}%`,
            backgroundColor: status === 'completed'
              ? 'var(--color-success)'
              : status === 'overdue' || !isOnTrack
                ? 'var(--color-danger)'
                : status === 'pending'
                  ? 'var(--text-tertiary)'
                  : 'var(--color-brand-500)',
          } as CSSProperties}
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
  const { formatAmount } = useCurrency()

  const { data: payments = [], isLoading } = useQuery({
    queryKey: queryKeys.installments.payments(installmentId),
    queryFn: () => installmentsApi.payments(installmentId),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <p className="p-4 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t('common.noData')}
      </p>
    )
  }

  return (
    <div className="max-h-96 overflow-y-auto overscroll-contain px-5 py-4">
      {/* Vertical stepper timeline */}
      <div className="relative">
        {payments.map((payment: InstallmentPayment, idx: number) => {
          const isCompleted = payment.status === 'completed'
          const isUpcoming = payment.status === 'upcoming'
          const isLast = idx === payments.length - 1

          const dotColor = isCompleted
            ? 'var(--color-success)'
            : isUpcoming
              ? 'var(--color-brand-500)'
              : 'var(--border-primary)'

          const dotBg = isCompleted
            ? 'rgba(5, 205, 153, 0.15)'
            : isUpcoming
              ? 'rgba(67, 24, 255, 0.15)'
              : 'var(--bg-hover)'

          return (
            <div key={payment.payment_number} className="relative flex gap-4 pb-4 last:pb-0">
              {/* Vertical line connector */}
              {!isLast && (
                <div
                  className="absolute start-[11px] top-6 bottom-0 w-0.5"
                  style={{
                    backgroundColor: isCompleted ? 'color-mix(in srgb, var(--color-success) 19%, transparent)' : 'var(--border-primary)',
                  }}
                />
              )}

              {/* Dot */}
              <div className="relative z-10 shrink-0">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: dotBg, border: `2px solid ${dotColor}` }}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" style={{ color: dotColor }} />
                  ) : (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-1 items-center justify-between pb-1">
                <div>
                  <p
                    className="text-xs font-bold ltr-nums"
                    style={{ color: isCompleted ? 'var(--text-primary)' : isUpcoming ? 'var(--color-brand-500)' : 'var(--text-tertiary)' }}
                  >
                    #{payment.payment_number} &middot; {formatDate(payment.date, isRtl ? 'he-IL' : 'en-US')}
                  </p>
                  <p
                    className="mt-0.5 text-[10px] font-semibold"
                    style={{
                      color: isCompleted ? 'var(--color-success)' : isUpcoming ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                    }}
                  >
                    {isCompleted
                      ? t('loans.statusCompleted')
                      : isUpcoming
                        ? t('installments.upcoming')
                        : t('installments.future')}
                  </p>
                </div>
                <span
                  className="fin-number text-xs ltr-nums"
                  style={{ color: isCompleted ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                >
                  {formatAmount(payment.amount)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InstallmentsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { currency: defaultCurrency, formatAmount } = useCurrency()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.installments')
  }, [t])

  // ---- State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Installment | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<Installment | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [markPaymentTarget, setMarkPaymentTarget] = useState<Installment | null>(null)

  // ---- Queries ----
  const {
    data: installments = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.installments.list(),
    queryFn: () => installmentsApi.list(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.installments.all })

  const createMutation = useMutation({
    mutationFn: (data: CreateInstallmentData) => installmentsApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
      toast.success(t('toast.createSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInstallmentData> }) =>
      installmentsApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
      toast.success(t('toast.updateSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => installmentsApi.markPaid(id),
    onSuccess: () => {
      invalidate()
      setMarkPaymentTarget(null)
      toast.success(t('toast.markPaymentSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  // ---- Computed data ----
  const filteredInstallments = useMemo(() => {
    if (typeFilter === 'all') return installments
    return installments.filter((inst) => inst.type === typeFilter)
  }, [installments, typeFilter])

  const activeInstallments = useMemo(
    () => installments.filter((inst) => inst.payments_completed < inst.number_of_payments),
    [installments],
  )

  const summaryData = useMemo(() => {
    const remainingExpense = activeInstallments
      .filter((inst) => inst.type === 'expense')
      .reduce((sum, inst) => sum + parseFloat(inst.remaining_amount), 0)

    const remainingIncome = activeInstallments
      .filter((inst) => inst.type === 'income')
      .reduce((sum, inst) => sum + parseFloat(inst.remaining_amount), 0)

    // Find the nearest next_payment_date across all active installments
    let nearestPaymentDate: string | null = null
    for (const inst of activeInstallments) {
      if (inst.next_payment_date) {
        if (!nearestPaymentDate || inst.next_payment_date < nearestPaymentDate) {
          nearestPaymentDate = inst.next_payment_date
        }
      }
    }

    return {
      activeCount: activeInstallments.length,
      remainingExpense,
      remainingIncome,
      nearestPaymentDate,
    }
  }, [activeInstallments])

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingEntry(null)
    setFormData({ ...EMPTY_FORM, currency: defaultCurrency })
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
      currency: entry.currency ?? defaultCurrency,
      first_payment_made: false,
      payment_method: entry.payment_method ?? 'cash',
      credit_card_id: entry.credit_card_id ?? '',
      bank_account_id: entry.bank_account_id ?? '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingEntry(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }, [])

  const closeDeleteDialog = useCallback(() => setDeleteTarget(null), [])
  const closeMarkPaymentDialog = useCallback(() => setMarkPaymentTarget(null), [])

  // Modal accessibility (Escape key, focus trap, aria)
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)
  const { panelRef: deletePanelRef, closing: deleteClosing, requestClose: requestDeleteClose } = useModalA11y(!!deleteTarget, closeDeleteDialog)
  const { panelRef: markPaymentPanelRef, closing: markPaymentClosing, requestClose: requestMarkPaymentClose } = useModalA11y(!!markPaymentTarget, closeMarkPaymentDialog)

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
      currency: formData.currency,
      payment_method: formData.payment_method,
      credit_card_id: formData.payment_method === 'credit_card' && formData.credit_card_id ? formData.credit_card_id : undefined,
      bank_account_id: formData.payment_method === 'bank_transfer' && formData.bank_account_id ? formData.bank_account_id : undefined,
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload })
    } else {
      payload.first_payment_made = formData.first_payment_made
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
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
          >
            {t('installments.title')}
          </h1>
          {/* Active count bubble */}
          {!isLoading && summaryData.activeCount > 0 && (
            <span
              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold text-white ltr-nums"
              style={{
                backgroundColor: 'var(--color-brand-500)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {summaryData.activeCount}
            </span>
          )}
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          {t('installments.add')}
        </button>
      </div>

      {/* ---- Summary bar ---- */}
      {!isLoading && installments.length > 0 && (
        <div
          className="animate-fade-in-up stagger-1 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {/* Active count */}
          <div
            className="card flex items-center gap-3 p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(67, 24, 255, 0.1)' }}
            >
              <CreditCard className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('installments.summaryTotalActive')}
              </p>
              <p className="text-lg font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {summaryData.activeCount}
              </p>
            </div>
          </div>

          {/* Remaining to pay (expenses) */}
          <div
            className="card flex items-center gap-3 p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(238, 93, 80, 0.1)' }}
            >
              <ArrowDownCircle className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('installments.summaryRemainingExpense')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--color-expense)' }}>
                {formatAmount(summaryData.remainingExpense)}
              </p>
            </div>
          </div>

          {/* Remaining to receive (income) */}
          <div
            className="card flex items-center gap-3 p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)' }}
            >
              <ArrowUpCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('installments.summaryRemainingIncome')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--color-income)' }}>
                {formatAmount(summaryData.remainingIncome)}
              </p>
            </div>
          </div>

          {/* Next payment date */}
          <div
            className="card flex items-center gap-3 p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
            >
              <CalendarDays className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('installments.summaryNextPayment')}
              </p>
              <p className="text-sm font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {summaryData.nearestPaymentDate
                  ? formatDate(summaryData.nearestPaymentDate, isRtl ? 'he-IL' : 'en-US')
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Type filter (segmented control) ---- */}
      {!isLoading && installments.length > 0 && (
        <div className="animate-fade-in-up stagger-1">
          <div
            className="inline-flex overflow-hidden rounded-xl border p-1"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {([
              { value: 'all' as TypeFilter, label: t('installments.filterAll'), icon: null },
              { value: 'income' as TypeFilter, label: t('installments.filterIncome'), icon: TrendingUp },
              { value: 'expense' as TypeFilter, label: t('installments.filterExpense'), icon: TrendingDown },
            ]).map((option) => {
              const active = typeFilter === option.value
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => setTypeFilter(option.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1',
                  )}
                  style={{
                    backgroundColor: active ? 'var(--bg-card)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    boxShadow: active ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))' : 'none',
                  }}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- Cards grid ---- */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <div className="animate-fade-in-up stagger-2 card flex flex-col items-center justify-center px-6 py-16">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-danger)' }}
          >
            <CreditCard className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      ) : installments.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="animate-fade-in-up stagger-2 card flex flex-col items-center justify-center px-6 py-20">
          <div
            className="empty-float mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background: 'rgba(67, 24, 255, 0.08)',
              border: '1px solid rgba(67, 24, 255, 0.1)',
            }}
          >
            <CreditCard className="h-9 w-9" style={{ color: 'var(--border-focus)' }} />
          </div>
          <h3
            className="mb-2 text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('common.noData')}
          </h3>
          <p
            className="mb-8 max-w-sm text-center text-sm leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('installments.title')}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t('installments.add')}
          </button>
        </div>
      ) : filteredInstallments.length === 0 ? (
        /* ---- Filtered empty state ---- */
        <div className="animate-fade-in-up stagger-2 card flex flex-col items-center justify-center px-6 py-16">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(67, 24, 255, 0.08)' }}
          >
            <CreditCard className="h-6 w-6" style={{ color: 'var(--border-focus)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {t('installments.noActiveInstallments')}
          </p>
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInstallments.map((inst, index) => {
            const isIncome = inst.type === 'income'
            const cat = inst.category_id ? categoryMap.get(inst.category_id) : undefined
            const isExpanded = expandedId === inst.id
            const nextPaymentSoon = inst.next_payment_date && isWithin7Days(inst.next_payment_date)

            // Status-based accent color
            const accentColor = inst.status === 'completed'
              ? 'var(--color-success)'
              : inst.status === 'overdue'
                ? 'var(--color-danger)'
                : inst.status === 'pending'
                  ? 'var(--text-tertiary)'
                  : 'var(--color-brand-500)'

            return (
              <div
                key={inst.id}
                className="row-enter card card-lift overflow-hidden transition-all duration-300"
                style={{ '--row-index': Math.min(index, 15), animationDelay: `${index * 40}ms` } as CSSProperties}
              >
                {/* Status accent bar */}
                <div
                  className="h-1.5"
                  style={{ backgroundColor: accentColor }}
                />

                <div className="p-5">
                  {/* Card header */}
                  <div className="mb-3 flex w-full items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-[15px] font-bold"
                        style={{ color: 'var(--text-primary)' }}
                        title={inst.name}
                      >
                        {inst.name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {cat && <CategoryBadge category={cat} isRtl={isRtl} />}
                        {/* Type badge (small) */}
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: isIncome ? 'color-mix(in srgb, var(--color-success) 6%, transparent)' : 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
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
                    </div>

                    {/* Status badge */}
                    <StatusBadge status={inst.status} t={t} />
                  </div>

                  {/* Amounts row */}
                  <div className="mb-3 flex items-baseline gap-3">
                    <p
                      className="fin-number text-2xl ltr-nums"
                      style={{
                        color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {formatAmount(inst.total_amount, inst.currency)}
                    </p>
                    <span
                      className="text-xs font-medium ltr-nums"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {formatAmount(inst.monthly_amount, inst.currency)} / {t('installments.monthlyAmount').toLowerCase()}
                    </span>
                  </div>

                  {/* Remaining amount */}
                  {inst.status !== 'completed' && (
                    <div
                      className="mb-3 rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('installments.remainingAmount')}
                        </span>
                        <span
                          className="fin-number text-sm ltr-nums"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {formatAmount(inst.remaining_amount, inst.currency)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="mb-3">
                    <ProgressBar
                      completed={inst.payments_completed}
                      total={inst.number_of_payments}
                      status={inst.status}
                      isOnTrack={inst.is_on_track}
                      t={t}
                    />
                  </div>

                  {/* On-track indicator */}
                  {inst.status !== 'completed' && inst.status !== 'pending' && (
                    <div className="mb-3">
                      <OnTrackIndicator isOnTrack={inst.is_on_track} t={t} />
                    </div>
                  )}

                  {/* Details grid */}
                  <div
                    className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {/* Next payment date */}
                    {inst.next_payment_date && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('installments.nextPayment')}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 inline-flex items-center gap-1 font-bold ltr-nums',
                          )}
                          style={{
                            color: nextPaymentSoon ? 'var(--color-warning)' : 'var(--text-primary)',
                          }}
                        >
                          <CalendarDays
                            className="h-3 w-3"
                            style={{ color: nextPaymentSoon ? 'var(--color-warning)' : 'var(--border-focus)' }}
                          />
                          {formatDate(inst.next_payment_date, isRtl ? 'he-IL' : 'en-US')}
                        </span>
                      </div>
                    )}

                    {/* End date */}
                    {inst.end_date && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('installments.endDate')}
                        </span>
                        <span className="mt-0.5 font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                          {formatDate(inst.end_date, isRtl ? 'he-IL' : 'en-US')}
                        </span>
                      </div>
                    )}

                    {/* Day of month */}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('fixed.dayOfMonth')}
                      </span>
                      <span className="mt-0.5 font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                        {inst.day_of_month}
                      </span>
                    </div>

                    {/* Start date */}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('fixed.startDate')}
                      </span>
                      <span className="mt-0.5 font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                        {formatDate(inst.start_date, isRtl ? 'he-IL' : 'en-US')}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {inst.description && (
                    <p
                      className="mb-4 truncate text-xs leading-relaxed"
                      style={{ color: 'var(--text-tertiary)' }}
                      title={inst.description}
                    >
                      {inst.description}
                    </p>
                  )}

                  {/* View Details toggle button */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                    aria-expanded={isExpanded}
                    className="btn-press mb-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all"
                    style={{
                      borderColor: isExpanded ? 'var(--color-brand-500)' : 'var(--border-primary)',
                      backgroundColor: isExpanded ? 'rgba(67, 24, 255, 0.08)' : 'transparent',
                      color: isExpanded ? 'var(--color-brand-500)' : 'var(--text-secondary)',
                    }}
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                    {isExpanded ? t('installments.hideSchedule') : t('installments.viewSchedule')}
                    <span
                      className="inline-flex transition-transform duration-300"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  </button>

                  {/* Actions */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Mark Payment button */}
                      {inst.payments_completed < inst.number_of_payments && (
                        <button
                          onClick={() => setMarkPaymentTarget(inst)}
                          className="btn-press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                          style={{
                            backgroundColor: 'var(--color-success)',
                            boxShadow: 'var(--shadow-xs)',
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {isIncome ? t('installments.markReceipt') : t('installments.markPayment')}
                        </button>
                      )}
                    </div>

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(inst)}
                        className="btn-press action-btn action-btn-edit rounded-lg p-2 transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(inst)}
                        className="btn-press action-btn action-btn-delete rounded-lg p-2 transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
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
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inst-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestModalClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={modalPanelRef}
            className="modal-panel modal-form-layout relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border p-0"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Colored accent bar */}
            <div
              className="h-1"
              style={{
                backgroundColor: formData.type === 'income'
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
              }}
            />

            <div className="modal-body p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2
                  id="inst-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingEntry ? t('common.edit') : t('installments.add')}
                </h2>
                <button
                  onClick={requestModalClose}
                  className="rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form id="installment-form" onSubmit={handleFormSubmit} className="space-y-5">
                {/* Type toggle */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.type')}
                  </label>
                  <div
                    className="flex overflow-hidden rounded-xl border"
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
                          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all"
                          style={{
                            backgroundColor: active ? colorVar : 'var(--bg-input)',
                            color: active ? '#fff' : 'var(--text-secondary)',
                          }}
                        >
                          {typeVal === 'income' ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
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
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
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
                      'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                          )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.name ? 'var(--border-danger)' : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder={t('fixed.name')}
                    aria-describedby={formErrors.name ? 'inst-name-error' : undefined}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p id="inst-name-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Total amount + Number of payments row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.total_amount ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: formData.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.total_amount ? 'inst-total-error' : undefined}
                      aria-invalid={!!formErrors.total_amount}
                    />
                    {formErrors.total_amount && (
                      <p id="inst-total-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.total_amount}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.number_of_payments ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      aria-describedby={formErrors.number_of_payments ? 'inst-num-payments-error' : undefined}
                      aria-invalid={!!formErrors.number_of_payments}
                    />
                    {formErrors.number_of_payments && (
                      <p id="inst-num-payments-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.number_of_payments}
                      </p>
                    )}
                  </div>
                </div>

                {/* Auto-calculated monthly amount */}
                {computedMonthly && (
                  <div
                    className="rounded-xl border px-4 py-3"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      {t('installments.monthlyAmount')}
                    </p>
                    <p
                      className="mt-0.5 fin-number text-lg ltr-nums"
                      style={{ color: 'var(--border-focus)' }}
                    >
                      {formatAmount(computedMonthly)}
                    </p>
                  </div>
                )}

                {/* Start date + Day of month row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('fixed.startDate')} *
                    </label>
                    <DatePicker
                      value={formData.start_date}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, start_date: val }))
                      }
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.start_date ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      aria-describedby={formErrors.start_date ? 'inst-start-date-error' : undefined}
                      aria-invalid={!!formErrors.start_date}
                    />
                    {formErrors.start_date && (
                      <p id="inst-start-date-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.start_date}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.day_of_month ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      aria-describedby={formErrors.day_of_month ? 'inst-day-error' : undefined}
                      aria-invalid={!!formErrors.day_of_month}
                    />
                    {formErrors.day_of_month && (
                      <p id="inst-day-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.day_of_month}
                      </p>
                    )}
                  </div>
                </div>

                {/* First payment already made - only show on create, not edit */}
                {!editingEntry && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="first_payment_made"
                      checked={formData.first_payment_made}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, first_payment_made: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border accent-[var(--color-brand-500)]"
                      style={{
                        borderColor: 'var(--border-primary)',
                      }}
                    />
                    <label
                      htmlFor="first_payment_made"
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('installments.firstPaymentMade')}
                    </label>
                  </div>
                )}

                {/* Category */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.category')}
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, category_id: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
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

                {/* Payment Method */}
                <PaymentMethodSelector
                  paymentMethod={formData.payment_method}
                  onPaymentMethodChange={(method) => setFormData((prev) => ({ ...prev, payment_method: method }))}
                  creditCardId={formData.credit_card_id || null}
                  onCreditCardChange={(id) => setFormData((prev) => ({ ...prev, credit_card_id: id ?? '' }))}
                  bankAccountId={formData.bank_account_id || null}
                  onBankAccountChange={(id) => setFormData((prev) => ({ ...prev, bank_account_id: id ?? '' }))}
                  showForType={formData.type}
                />

                {/* Currency */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('currency.label')}
                  </label>
                  <CurrencySelector
                    value={formData.currency}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, currency: val }))
                    }
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
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
                      'w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder={t('transactions.description')}
                  />
                </div>

              </form>
            </div>
            {/* Sticky footer */}
            <div className="modal-footer flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={requestModalClose}
                className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById('installment-form') as HTMLFormElement
                  form?.requestSubmit()
                }}
                disabled={isMutating}
                className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          Delete Confirmation Dialog
          ================================================================== */}
      {deleteTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${deleteClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inst-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestDeleteClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={deletePanelRef}
            className="modal-panel relative z-10 w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Red accent bar */}
            <div
              className="h-1"
              style={{ backgroundColor: 'var(--color-danger)' }}
            />

            <div className="p-6">
              <div className="mb-5 flex flex-col items-center text-center">
                <div
                  className="warning-pulse mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: 'var(--bg-danger)' }}
                >
                  <Trash2 className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
                </div>
                <h3
                  id="inst-delete-title"
                  className="mb-2 text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('common.delete')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t('transactions.deleteConfirmMessage')}
                </p>
                {deleteTarget.name && (
                  <p
                    className="mt-2 rounded-lg px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    &ldquo;{deleteTarget.name}&rdquo;
                  </p>
                )}
                <p
                  className="mt-2 fin-number text-base ltr-nums"
                  style={{
                    color: deleteTarget.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                  }}
                >
                  {formatAmount(deleteTarget.total_amount, deleteTarget.currency)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={requestDeleteClose}
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
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
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--color-danger)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          Mark Payment Confirmation Dialog
          ================================================================== */}
      {markPaymentTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${markPaymentClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inst-mark-payment-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestMarkPaymentClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={markPaymentPanelRef}
            className="modal-panel relative z-10 w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Green accent bar */}
            <div
              className="h-1"
              style={{ backgroundColor: 'var(--color-success)' }}
            />

            <div className="p-6">
              <div className="mb-5 flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)' }}
                >
                  <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--color-success)' }} />
                </div>
                <h3
                  id="inst-mark-payment-title"
                  className="mb-2 text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {markPaymentTarget.type === 'income'
                    ? t('installments.markReceipt')
                    : t('installments.markPayment')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {markPaymentTarget.type === 'income'
                    ? t('installments.markReceiptConfirm')
                    : t('installments.markPaymentConfirm')}
                </p>
                <p
                  className="mt-2 rounded-lg px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  &ldquo;{markPaymentTarget.name}&rdquo;
                </p>
                <p
                  className="mt-2 text-sm font-semibold ltr-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('installments.xOfYPayments', {
                    completed: markPaymentTarget.payments_completed + 1,
                    total: markPaymentTarget.number_of_payments,
                  })}
                </p>
                <p
                  className="mt-1 fin-number text-base ltr-nums"
                  style={{ color: 'var(--color-success)' }}
                >
                  {formatAmount(markPaymentTarget.monthly_amount, markPaymentTarget.currency)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={requestMarkPaymentClose}
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-input)',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => markPaidMutation.mutate(markPaymentTarget.id)}
                  disabled={markPaidMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--color-success)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {markPaidMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <Check className="h-4 w-4" />
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
