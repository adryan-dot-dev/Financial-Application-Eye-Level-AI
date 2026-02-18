import { useState, useCallback, useEffect, useMemo } from 'react'
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
  Landmark,
  Percent,
  DollarSign,
  Banknote,
  ChevronDown,
  TableProperties,
  Check,
} from 'lucide-react'
import type { Loan, Category } from '@/types'
import { loansApi } from '@/api/loans'
import type { CreateLoanData, LoanBreakdownEntry } from '@/api/loans'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { CategoryBadge as SharedCategoryBadge } from '@/components/ui/CategoryIcon'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { useCurrency } from '@/hooks/useCurrency'
import DatePicker from '@/components/ui/DatePicker'
import CurrencySelector from '@/components/CurrencySelector'

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
  currency: string
  first_payment_made: boolean
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
  currency: 'ILS',
  first_payment_made: false,
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
  const label = isRtl ? category.name_he : category.name

  return (
    <SharedCategoryBadge
      icon={category.icon}
      color={category.color}
      label={label}
    />
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
  const isHalfway = percentage >= 50 && !isComplete

  // Color coding: green if complete, amber if halfway, blue otherwise
  let barColor = 'var(--border-focus)' // blue
  let barGradient = 'var(--color-brand-500)'
  if (isComplete) {
    barColor = 'var(--color-success)' // green
    barGradient = 'var(--color-success)'
  } else if (isHalfway) {
    barColor = 'var(--color-warning)' // amber
    barGradient = 'var(--color-warning)'
  }

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="text-xs font-semibold ltr-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {completed} / {total}
        </span>
        <span
          className="text-xs font-bold ltr-nums"
          style={{ color: barColor }}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div
        className="progress-premium h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div
          className="progress-fill h-full rounded-full progress-fill-animated"
          style={{
            '--target-width': `${percentage}%`,
            backgroundColor: barGradient,
          } as CSSProperties}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Loan['status'] }) {
  const { t } = useTranslation()

  const config = {
    active: 'var(--color-brand-500)',
    completed: 'var(--color-income)',
    paused: 'var(--text-tertiary)',
  }

  const color = config[status]

  const label =
    status === 'active'
      ? t('loans.statusActive')
      : status === 'completed'
        ? t('loans.statusCompleted')
        : t('loans.statusPaused')

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color, border: '1px solid currentColor', opacity: 0.8 }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Paid vs Remaining visual bar
// ---------------------------------------------------------------------------

function PaidRemainingBar({
  paid,
  remaining,
  currency,
}: {
  paid: number
  remaining: number
  currency: string
}) {
  const { t } = useTranslation()
  const total = paid + remaining
  const paidPct = total > 0 ? (paid / total) * 100 : 0

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold">
        <span style={{ color: 'var(--color-success)' }}>
          {t('loans.totalPaid')}: {formatCurrency(paid, currency)}
        </span>
        <span style={{ color: 'var(--color-expense)' }}>
          {t('loans.totalRemaining')}: {formatCurrency(remaining, currency)}
        </span>
      </div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div
          className="h-full rounded-s-full transition-all duration-700 ease-out"
          style={{
            width: `${paidPct}%`,
            backgroundColor: 'var(--color-success)',
          }}
        />
        <div
          className="h-full rounded-e-full transition-all duration-700 ease-out"
          style={{
            width: `${100 - paidPct}%`,
            backgroundColor: 'var(--color-danger)',
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini principal vs interest pie chart
// ---------------------------------------------------------------------------

function PrincipalInterestMiniChart({
  originalAmount,
  totalPayments,
  monthlyPayment,
  currency,
}: {
  originalAmount: number
  totalPayments: number
  monthlyPayment: number
  currency: string
}) {
  const { t } = useTranslation()

  const totalCost = monthlyPayment * totalPayments
  const totalInterest = Math.max(0, totalCost - originalAmount)
  const principal = originalAmount
  const total = principal + totalInterest
  const principalPercent = total > 0 ? Math.round((principal / total) * 100) : 100

  if (totalInterest <= 0) return null

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <p
        className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {t('loans.principalVsInterest')}
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-[10px]">
          <span style={{ color: 'var(--text-secondary)' }}>{t('loans.principalPortion')}</span>
          <span className="font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(principal, currency)}</span>
        </div>
        <div className="h-2 w-full rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${principalPercent}%`,
              backgroundColor: 'var(--color-brand-500)',
            }}
          />
        </div>
        <div className="flex justify-between text-[10px]">
          <span style={{ color: 'var(--text-secondary)' }}>{t('loans.interestPortion')}</span>
          <span className="font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalInterest, currency)}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Amortization Schedule component
// ---------------------------------------------------------------------------

function AmortizationSchedule({
  loanId,
  currency,
  isRtl,
}: {
  loanId: string
  currency: string
  isRtl: boolean
}) {
  const { t } = useTranslation()

  const { data: breakdown = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.loans.breakdown(loanId),
    queryFn: () => loansApi.breakdown(loanId),
  })

  // Compute totals
  const totals = useMemo(() => {
    let totalPayment = 0
    let totalPrincipal = 0
    let totalInterest = 0
    for (const item of breakdown) {
      totalPayment += parseFloat(item.payment_amount) || 0
      totalPrincipal += parseFloat(item.principal) || 0
      totalInterest += parseFloat(item.interest) || 0
    }
    return { totalPayment, totalPrincipal, totalInterest }
  }, [breakdown])

  const statusColor = (status: LoanBreakdownEntry['status']) => {
    switch (status) {
      case 'paid':
        return { bg: 'rgba(5, 205, 153, 0.08)', color: 'var(--color-success)' }
      case 'upcoming':
        return { bg: 'rgba(67, 24, 255, 0.08)', color: 'var(--color-brand-500)' }
      case 'future':
      default:
        return { bg: 'transparent', color: 'var(--text-tertiary)' }
    }
  }

  const statusLabel = (status: LoanBreakdownEntry['status']) => {
    switch (status) {
      case 'paid':
        return t('loans.statusPaid')
      case 'upcoming':
        return t('loans.statusUpcoming')
      case 'future':
        return t('loans.statusFuture')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-4 text-center text-sm" style={{ color: 'var(--color-expense)' }}>
        {t('common.error')}
      </div>
    )
  }

  if (breakdown.length === 0) {
    return (
      <div className="py-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t('common.noData')}
      </div>
    )
  }

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border-primary)' }}
    >
      <div className="max-h-[400px] overflow-y-auto overscroll-contain">
        <table className="w-full text-xs" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-primary)',
              }}
            >
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationNumber')}
              </th>
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationDate')}
              </th>
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationPayment')}
              </th>
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationPrincipal')}
              </th>
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationInterest')}
              </th>
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationBalance')}
              </th>
              <th className="sticky top-0 px-3 py-2.5 text-start font-semibold" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t('loans.amortizationStatus')}
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => {
              const sc = statusColor(item.status)
              const isPaid = item.status === 'paid'
              const isUpcoming = item.status === 'upcoming'
              return (
                <tr
                  key={item.payment_number}
                  style={{
                    backgroundColor: isUpcoming ? 'rgba(67, 24, 255, 0.06)' : sc.bg,
                    borderBottom: '1px solid var(--border-primary)',
                    borderInlineStartWidth: isUpcoming ? '3px' : undefined,
                    borderInlineStartColor: isUpcoming ? 'var(--color-brand-500)' : undefined,
                  }}
                >
                  <td className="px-3 py-2.5 ltr-nums font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold" style={{
                      backgroundColor: isPaid ? 'rgba(5, 205, 153, 0.1)' : isUpcoming ? 'rgba(67, 24, 255, 0.1)' : 'var(--bg-tertiary)',
                      color: isPaid ? 'var(--color-success)' : isUpcoming ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                    }}>
                      {isPaid ? <Check className="h-3 w-3" /> : item.payment_number}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 ltr-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(item.date, isRtl ? 'he-IL' : 'en-US')}
                  </td>
                  <td className="px-3 py-2.5 ltr-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(item.payment_amount, currency)}
                  </td>
                  <td className="px-3 py-2.5 ltr-nums" style={{ color: 'var(--color-brand-500)' }}>
                    {formatCurrency(item.principal, currency)}
                  </td>
                  <td className="px-3 py-2.5 ltr-nums" style={{ color: 'var(--color-warning)' }}>
                    {formatCurrency(item.interest, currency)}
                  </td>
                  <td className="px-3 py-2.5 ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(item.remaining_balance, currency)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: sc.bg === 'transparent' ? 'var(--bg-tertiary)' : sc.bg, color: sc.color, border: `1px solid ${sc.color}20` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                      {statusLabel(item.status)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Summary row */}
          <tfoot>
            <tr
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderTop: '2px solid var(--border-primary)',
              }}
            >
              <td
                className="px-3 py-2.5 font-bold"
                colSpan={2}
                style={{ color: 'var(--text-primary)' }}
              >
                {t('loans.amortizationTotal')}
              </td>
              <td className="px-3 py-2.5 ltr-nums font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(totals.totalPayment, currency)}
              </td>
              <td className="px-3 py-2.5 ltr-nums font-bold" style={{ color: 'var(--color-brand-500)' }}>
                {formatCurrency(totals.totalPrincipal, currency)}
              </td>
              <td className="px-3 py-2.5 ltr-nums font-bold" style={{ color: 'var(--color-warning)' }}>
                {formatCurrency(totals.totalInterest, currency)}
              </td>
              <td className="px-3 py-2.5" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: compute estimated end date
// ---------------------------------------------------------------------------

function getEstimatedEndDate(startDate: string, totalPayments: number, dayOfMonth: number): string {
  const start = new Date(startDate)
  if (isNaN(start.getTime())) return ''
  const endMonth = start.getMonth() + totalPayments
  const endDate = new Date(start.getFullYear(), endMonth, dayOfMonth)
  return endDate.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LoansPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { currency: defaultCurrency } = useCurrency()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.loans')
  }, [t])

  // ---- State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Loan | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null)

  // Record payment modal
  const [paymentTarget, setPaymentTarget] = useState<Loan | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  // Amortization expand state
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null)

  // ---- Queries ----
  const {
    data: loans = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.loans.list(),
    queryFn: () => loansApi.list(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Active loans count for the badge
  const activeLoansCount = useMemo(
    () => loans.filter((l) => l.status === 'active').length,
    [loans],
  )

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.loans.all })

  const createMutation = useMutation({
    mutationFn: (data: CreateLoanData) => loansApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLoanData> }) =>
      loansApi.update(id, data),
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
    mutationFn: (id: string) => loansApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      loansApi.recordPayment(id, { amount }),
    onSuccess: () => {
      invalidate()
      setPaymentTarget(null)
      setPaymentAmount('')
      toast.success(t('toast.paymentSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingEntry(null)
    setFormData({ ...EMPTY_FORM, currency: defaultCurrency })
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
      currency: entry.currency ?? defaultCurrency,
      first_payment_made: false,
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

  const closePaymentDialog = useCallback(() => {
    setPaymentTarget(null)
    setPaymentAmount('')
  }, [])

  const openPaymentModal = (loan: Loan) => {
    setPaymentTarget(loan)
    setPaymentAmount(loan.monthly_payment)
  }

  const toggleAmortization = (loanId: string) => {
    setExpandedLoanId((prev) => (prev === loanId ? null : loanId))
  }

  // Modal accessibility (Escape key, focus trap, aria)
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)
  const { panelRef: deletePanelRef, closing: deleteClosing, requestClose: requestDeleteClose } = useModalA11y(!!deleteTarget, closeDeleteDialog)
  const { panelRef: paymentPanelRef, closing: paymentClosing, requestClose: requestPaymentClose } = useModalA11y(!!paymentTarget, closePaymentDialog)

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
      currency: formData.currency,
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload })
    } else {
      payload.first_payment_made = formData.first_payment_made
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
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Gradient icon circle */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg"
            style={{
              backgroundColor: 'var(--color-brand-500)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <Landmark className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1
                className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
              >
                {t('loans.title')}
              </h1>
              {!isLoading && activeLoansCount > 0 && (
                <span
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2.5 text-xs font-bold text-white"
                  style={{
                    backgroundColor: 'var(--color-brand-500)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  {activeLoansCount}
                </span>
              )}
            </div>
            {!isLoading && (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('transactions.total')}: <span className="font-medium ltr-nums" style={{ color: 'var(--text-secondary)' }}>{loans.length}</span>
                {activeLoansCount > 0 && activeLoansCount < loans.length && (
                  <span className="ms-2" style={{ color: 'var(--text-tertiary)' }}>
                    ({t('loans.activeLoansCount', { count: activeLoansCount })})
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.04] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          style={{ boxShadow: 'var(--shadow-xs)' }}
        >
          <Plus className="h-4 w-4" />
          {t('loans.add')}
        </button>
      </div>

      {/* ---- Cards grid ---- */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <div className="animate-fade-in-up stagger-2 card flex flex-col items-center justify-center px-6 py-16">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-danger)' }}
          >
            <Landmark className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      ) : loans.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="animate-fade-in-up stagger-2 card flex flex-col items-center justify-center px-6 py-20">
          <div
            className="empty-float mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background: 'rgba(67, 24, 255, 0.08)',
              border: '1px solid rgba(67, 24, 255, 0.1)',
            }}
          >
            <Landmark className="h-9 w-9" style={{ color: 'var(--border-focus)' }} />
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
            {t('loans.title')}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t('loans.add')}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loans.map((loan, index) => {
            const cat = loan.category_id ? categoryMap.get(loan.category_id) : undefined
            const interestRate = parseFloat(loan.interest_rate)
            const originalAmount = parseFloat(loan.original_amount)
            const monthlyPayment = parseFloat(loan.monthly_payment)
            const remainingBalance = parseFloat(loan.remaining_balance)
            const totalPaid = originalAmount - remainingBalance
            const estimatedEnd = getEstimatedEndDate(loan.start_date, loan.total_payments, loan.day_of_month)
            const isExpanded = expandedLoanId === loan.id

            return (
              <div
                key={loan.id}
                className={cn(
                  'row-enter card card-lift overflow-hidden transition-all duration-300',
                  isExpanded && 'sm:col-span-2 lg:col-span-3',
                )}
                style={{ '--row-index': Math.min(index, 15), animationDelay: `${index * 40}ms` } as CSSProperties}
              >
                {/* Top accent bar – thicker */}
                <div
                  className="h-1.5"
                  style={{
                    backgroundColor: loan.status === 'completed'
                      ? 'var(--color-success)'
                      : loan.status === 'paused'
                        ? 'var(--color-warning)'
                        : 'var(--color-brand-500)',
                  }}
                />

                <div className="p-5">
                  {/* Card header */}
                  <div className="mb-3 flex w-full items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className="truncate text-base font-bold"
                          style={{ color: 'var(--text-primary)' }}
                          title={loan.name}
                        >
                          {loan.name}
                        </h3>
                        {/* Interest rate highlight */}
                        {interestRate > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ltr-nums"
                            style={{
                              backgroundColor: 'rgba(245, 158, 11, 0.1)',
                              color: 'var(--color-warning)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                            }}
                          >
                            <Percent className="h-2.5 w-2.5" />
                            {interestRate.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {cat && <CategoryBadge category={cat} isRtl={isRtl} />}
                        <StatusBadge status={loan.status} />
                      </div>
                    </div>
                  </div>

                  {/* Original amount – larger with icon */}
                  <div className="mb-3 flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: 'rgba(67, 24, 255, 0.1)',
                        color: 'var(--color-brand-500)',
                      }}
                    >
                      <DollarSign className="h-4.5 w-4.5" />
                    </div>
                    <p
                      className="fin-number text-2xl ltr-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {formatCurrency(loan.original_amount, loan.currency)}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <ProgressBar
                      completed={loan.payments_made}
                      total={loan.total_payments}
                    />
                  </div>

                  {/* Paid vs Remaining visual bar */}
                  <div className="mb-4">
                    <PaidRemainingBar
                      paid={Math.max(0, totalPaid)}
                      remaining={Math.max(0, remainingBalance)}
                      currency={loan.currency}
                    />
                  </div>

                  {/* Stats grid */}
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <div
                      className="rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('loans.monthlyPayment')}
                        </p>
                      </div>
                      <p
                        className="mt-1 fin-number text-sm ltr-nums"
                        style={{ color: 'var(--color-expense)' }}
                      >
                        {formatCurrency(loan.monthly_payment, loan.currency)}
                      </p>
                    </div>
                    <div
                      className="rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <Banknote className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('loans.remainingBalance')}
                        </p>
                      </div>
                      <p
                        className="mt-1 fin-number text-sm ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatCurrency(loan.remaining_balance, loan.currency)}
                      </p>
                    </div>
                    <div
                      className="rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('fixed.startDate')}
                        </p>
                      </div>
                      <p
                        className="mt-1 text-sm font-bold ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatDate(loan.start_date, isRtl ? 'he-IL' : 'en-US')}
                      </p>
                    </div>
                    <div
                      className="rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                          {t('loans.estimatedEndDate')}
                        </p>
                      </div>
                      <p
                        className="mt-1 text-sm font-bold ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {estimatedEnd ? formatDate(estimatedEnd, isRtl ? 'he-IL' : 'en-US') : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Mini chart: Principal vs Interest */}
                  {interestRate > 0 && (
                    <div className="mb-4">
                      <PrincipalInterestMiniChart
                        originalAmount={originalAmount}
                        totalPayments={loan.total_payments}
                        monthlyPayment={monthlyPayment}
                        currency={loan.currency}
                      />
                    </div>
                  )}

                  {/* Description */}
                  {loan.description && (
                    <p
                      className="mb-4 truncate text-xs leading-relaxed"
                      style={{ color: 'var(--text-tertiary)' }}
                      title={loan.description}
                    >
                      {loan.description}
                    </p>
                  )}

                  {/* Actions footer */}
                  <div
                    className="flex items-center justify-between border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Record Payment */}
                      {loan.status === 'active' && (
                        <button
                          onClick={() => openPaymentModal(loan)}
                          disabled={recordPaymentMutation.isPending}
                          className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {recordPaymentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
                          {t('loans.recordPayment')}
                        </button>
                      )}

                      {/* View Amortization Schedule button */}
                      <button
                        onClick={() => toggleAmortization(loan.id)}
                        className="btn-press inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
                        style={{
                          borderColor: isExpanded ? 'var(--color-brand-500)' : 'var(--border-primary)',
                          backgroundColor: isExpanded ? 'rgba(67, 24, 255, 0.08)' : 'transparent',
                          color: isExpanded ? 'var(--color-brand-500)' : 'var(--text-secondary)',
                        }}
                      >
                        <TableProperties className="h-3.5 w-3.5" />
                        {isExpanded ? t('loans.hideAmortization') : t('loans.viewAmortization')}
                        <span
                          className="inline-flex transition-transform duration-300"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </span>
                      </button>
                    </div>

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(loan)}
                        className="btn-press action-btn action-btn-edit rounded-lg p-2 transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(loan)}
                        className="btn-press action-btn action-btn-delete rounded-lg p-2 transition-all focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Amortization Schedule */}
                  {isExpanded && (
                    <AmortizationSchedule
                      loanId={loan.id}
                      currency={loan.currency}
                      isRtl={isRtl}
                    />
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
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-modal-title"
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
            {/* Colored accent bar - blue for loans */}
            <div
              className="h-1"
              style={{
                backgroundColor: 'var(--color-brand-500)',
              }}
            />

            <div className="modal-body p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2
                  id="loan-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingEntry ? t('common.edit') : t('loans.add')}
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

              <form id="loan-form" onSubmit={handleFormSubmit} className="space-y-5">
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
                    aria-describedby={formErrors.name ? 'loan-name-error' : undefined}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p id="loan-name-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Original amount + Monthly payment row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.original_amount ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.original_amount ? 'loan-principal-error' : undefined}
                      aria-invalid={!!formErrors.original_amount}
                    />
                    {formErrors.original_amount && (
                      <p id="loan-principal-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.original_amount}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.monthly_payment ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--color-expense)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.monthly_payment ? 'loan-monthly-error' : undefined}
                      aria-invalid={!!formErrors.monthly_payment}
                    />
                    {formErrors.monthly_payment && (
                      <p id="loan-monthly-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.monthly_payment}
                      </p>
                    )}
                  </div>
                </div>

                {/* Interest rate + Total payments row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.interest_rate ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.interest_rate ? 'loan-rate-error' : undefined}
                      aria-invalid={!!formErrors.interest_rate}
                    />
                    {formErrors.interest_rate && (
                      <p id="loan-rate-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.interest_rate}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
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
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.total_payments ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      aria-describedby={formErrors.total_payments ? 'loan-total-payments-error' : undefined}
                      aria-invalid={!!formErrors.total_payments}
                    />
                    {formErrors.total_payments && (
                      <p id="loan-total-payments-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.total_payments}
                      </p>
                    )}
                  </div>
                </div>

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
                      aria-describedby={formErrors.start_date ? 'loan-start-date-error' : undefined}
                      aria-invalid={!!formErrors.start_date}
                    />
                    {formErrors.start_date && (
                      <p id="loan-start-date-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
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
                      aria-describedby={formErrors.day_of_month ? 'loan-day-error' : undefined}
                      aria-invalid={!!formErrors.day_of_month}
                    />
                    {formErrors.day_of_month && (
                      <p id="loan-day-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
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
                      id="loan_first_payment_made"
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
                      htmlFor="loan_first_payment_made"
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('loans.firstPaymentMade')}
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
                  const form = document.getElementById('loan-form') as HTMLFormElement
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
          Record Payment Modal
          ================================================================== */}
      {paymentTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${paymentClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-payment-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              requestPaymentClose()
            }
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={paymentPanelRef}
            className="modal-panel relative z-10 w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border p-0"
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
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <h2
                  id="loan-payment-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('loans.recordPayment')}
                </h2>
                <button
                  onClick={requestPaymentClose}
                  className="rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Loan info */}
              <div
                className="mb-5 rounded-xl px-4 py-3"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <p
                  className="text-sm font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {paymentTarget.name}
                </p>
                <p className="mt-1 text-xs ltr-nums" style={{ color: 'var(--text-secondary)' }}>
                  {t('loans.remainingBalance')}: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(paymentTarget.remaining_balance, paymentTarget.currency)}</span>
                </p>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-5">
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
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
                      'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--color-income)',
                    }}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex items-center gap-3 border-t pt-5" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    type="button"
                    onClick={requestPaymentClose}
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
                    type="submit"
                    disabled={recordPaymentMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{
                      backgroundColor: 'var(--color-success)',
                      boxShadow: 'var(--shadow-xs)',
                    }}
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
          aria-labelledby="loan-delete-title"
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
                  id="loan-delete-title"
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
                  style={{ color: 'var(--text-primary)' }}
                >
                  {formatCurrency(deleteTarget.original_amount, deleteTarget.currency)}
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
    </div>
  )
}
