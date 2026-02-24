import { useState, useCallback, useEffect } from 'react'
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
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  Repeat,
} from 'lucide-react'
import type { FixedEntry, Category, PaymentMethod } from '@/types'
import { fixedApi } from '@/api/fixed'
import type { CreateFixedData } from '@/api/fixed'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { CategoryBadge as SharedCategoryBadge } from '@/components/ui/CategoryIcon'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { useCurrency } from '@/hooks/useCurrency'
import CurrencySelector from '@/components/CurrencySelector'
import DatePicker from '@/components/ui/DatePicker'
import PaymentMethodSelector from '@/components/ui/PaymentMethodSelector'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterType = '' | 'income' | 'expense'

interface FormData {
  name: string
  amount: string
  type: 'income' | 'expense'
  day_of_month: string
  start_date: string
  end_date: string
  description: string
  category_id: string
  currency: string
  payment_method: PaymentMethod
  credit_card_id: string
  bank_account_id: string
}

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: FormData = {
  name: '',
  amount: '',
  type: 'expense',
  day_of_month: '1',
  start_date: today(),
  end_date: '',
  description: '',
  category_id: '',
  currency: 'ILS',
  payment_method: 'cash',
  credit_card_id: '',
  bank_account_id: '',
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
            <Skeleton className="h-7 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FixedPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { currency: defaultCurrency } = useCurrency()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.fixed')
  }, [t])

  // ---- State ----
  const [filterType, setFilterType] = useState<FilterType>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FixedEntry | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<FixedEntry | null>(null)

  // ---- Queries ----
  const {
    data: entries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.fixed.list(filterType ? { type: filterType } : undefined),
    queryFn: () => fixedApi.list(filterType ? { type: filterType } : undefined),
  })

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.fixed.all })

  const createMutation = useMutation({
    mutationFn: (data: CreateFixedData) => fixedApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFixedData> }) =>
      fixedApi.update(id, data),
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
    mutationFn: (id: string) => fixedApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const pauseMutation = useMutation({
    mutationFn: (id: string) => fixedApi.pause(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('toast.pauseSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const resumeMutation = useMutation({
    mutationFn: (id: string) => fixedApi.resume(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('toast.resumeSuccess'))
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

  const openEditModal = (entry: FixedEntry) => {
    setEditingEntry(entry)
    setFormData({
      name: entry.name,
      amount: entry.amount,
      type: entry.type,
      day_of_month: String(entry.day_of_month),
      start_date: entry.start_date,
      end_date: entry.end_date ?? '',
      description: entry.description ?? '',
      category_id: entry.category_id ?? '',
      currency: entry.currency ?? defaultCurrency,
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

  // Modal accessibility (Escape key, focus trap, aria)
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)
  const { panelRef: deletePanelRef, closing: deleteClosing, requestClose: requestDeleteClose } = useModalA11y(!!deleteTarget, closeDeleteDialog)

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.error')
    const amt = parseFloat(formData.amount)
    if (!formData.amount || isNaN(amt) || amt <= 0) errors.amount = t('common.error')
    const dom = parseInt(formData.day_of_month)
    if (isNaN(dom) || dom < 1 || dom > 31) errors.day_of_month = t('common.error')
    if (!formData.start_date) errors.start_date = t('common.error')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateFixedData = {
      name: formData.name.trim(),
      amount: parseFloat(formData.amount),
      type: formData.type,
      day_of_month: parseInt(formData.day_of_month),
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
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
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Categories for the form
  const formCategories = categories.filter(
    (c) => c.type === formData.type && !c.is_archived,
  )

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* ---- Page header ---- */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: 'rgba(67, 24, 255, 0.08)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <Repeat className="h-6 w-6" style={{ color: 'var(--color-accent-magenta)' }} />
          </div>
          <div>
            <h1
              className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
            >
              {t('fixed.title')}
            </h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('transactions.total')}:{' '}
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ltr-nums"
                  style={{ backgroundColor: 'rgba(217, 70, 239, 0.1)', color: 'var(--color-accent-magenta)' }}
                >
                  {entries.length}
                </span>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
        >
          <Plus className="h-5 w-5" />
          {t('fixed.add')}
        </button>
      </div>

      {/* ---- Filter tabs ---- */}
      <div className="animate-fade-in-up stagger-2 card p-5">
        <fieldset>
          <legend className="sr-only">{t('transactions.type')}</legend>
          <div
            className="flex overflow-hidden rounded-xl border"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            {(['' as FilterType, 'income' as FilterType, 'expense' as FilterType]).map((typeVal) => {
              const active = filterType === typeVal
              const label =
                typeVal === ''
                  ? t('transactions.all')
                  : typeVal === 'income'
                    ? t('transactions.income')
                    : t('transactions.expense')
              return (
                <button
                  key={typeVal}
                  onClick={() => setFilterType(typeVal)}
                  className={cn(
                    'btn-press flex-1 px-4 py-2.5 text-xs font-semibold tracking-wide transition-all',
                    'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
                    active && 'shadow-sm',
                  )}
                  style={{
                    backgroundColor: active ? 'var(--border-focus)' : 'var(--bg-input)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>

      {/* ---- Cards grid ---- */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-16">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-danger)' }}
          >
            <Repeat className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      ) : entries.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-20">
          <div
            className="empty-float mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background: 'rgba(67, 24, 255, 0.08)',
              border: '1px solid rgba(67, 24, 255, 0.1)',
            }}
          >
            <Repeat className="h-9 w-9" style={{ color: 'var(--border-focus)' }} />
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
            {t('fixed.title')}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t('fixed.add')}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => {
            const isIncome = entry.type === 'income'
            const cat = entry.category_id ? categoryMap.get(entry.category_id) : undefined

            return (
              <div
                key={entry.id}
                className="card card-lift row-enter overflow-hidden transition-all duration-300"
                style={{
                  '--row-index': Math.min(index, 15),
                  borderInlineStartWidth: '4px',
                  borderInlineStartColor: isIncome ? 'var(--color-success)' : 'var(--color-danger)',
                } as CSSProperties}
              >
                <div className="p-5">
                  {/* Card header: name + toggle switch */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-[15px] font-bold"
                        style={{ color: 'var(--text-primary)' }}
                        title={entry.name}
                      >
                        {entry.name}
                      </h3>
                      {cat && (
                        <div className="mt-1.5">
                          <CategoryBadge category={cat} isRtl={isRtl} />
                        </div>
                      )}
                    </div>

                    {/* Animated toggle switch for active/paused */}
                    <button
                      onClick={() =>
                        entry.is_active
                          ? pauseMutation.mutate(entry.id)
                          : resumeMutation.mutate(entry.id)
                      }
                      disabled={pauseMutation.isPending || resumeMutation.isPending}
                      className="relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                      style={{
                        backgroundColor: entry.is_active ? 'var(--color-success)' : 'var(--bg-hover)',
                      }}
                      role="switch"
                      aria-checked={entry.is_active}
                      aria-label={entry.is_active ? t('fixed.pause') : t('fixed.resume')}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300"
                        style={{
                          transform: entry.is_active
                            ? (isRtl ? 'translateX(-20px)' : 'translateX(20px)')
                            : 'translateX(0)',
                        }}
                      >
                        {(pauseMutation.isPending || resumeMutation.isPending) ? (
                          <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                        ) : entry.is_active ? (
                          <Play className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <Pause className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Amount with arrow icon */}
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: isIncome ? 'rgba(5, 205, 153, 0.12)' : 'rgba(238, 93, 80, 0.12)',
                        color: isIncome ? 'var(--color-success)' : 'var(--color-danger)',
                      }}
                    >
                      {isIncome ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </span>
                    <p
                      className="fin-number text-2xl ltr-nums"
                      style={{
                        color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {isIncome ? '+' : '\u2212'}{formatCurrency(entry.amount, entry.currency)}
                    </p>
                  </div>

                  {/* Calendar badge + dates row */}
                  <div className="mb-4 flex items-center gap-3">
                    {/* Calendar day badge */}
                    <div
                      className="flex flex-col items-center overflow-hidden rounded-lg"
                      style={{ border: '1px solid var(--border-primary)' }}
                    >
                      <div
                        className="w-full px-2.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white"
                        style={{ backgroundColor: 'var(--color-brand-500)' }}
                      >
                        {t('fixed.dayOfMonth')}
                      </div>
                      <div
                        className="flex items-center justify-center px-3 py-1"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <span
                          className="text-lg font-extrabold ltr-nums"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {entry.day_of_month}
                        </span>
                      </div>
                    </div>

                    {/* Date info stacked */}
                    <div className="flex flex-col gap-1 text-xs">
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {t('fixed.startDate')}:{' '}
                        <span className="font-semibold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                          {formatDate(entry.start_date, isRtl ? 'he-IL' : 'en-US')}
                        </span>
                      </span>
                      {entry.end_date && (
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {t('fixed.endDate')}:{' '}
                          <span className="font-semibold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                            {formatDate(entry.end_date, isRtl ? 'he-IL' : 'en-US')}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {entry.description && (
                    <p
                      className="mb-4 truncate text-xs leading-relaxed"
                      style={{ color: 'var(--text-tertiary)' }}
                      title={entry.description}
                    >
                      {entry.description}
                    </p>
                  )}

                  {/* Actions footer */}
                  <div
                    className="flex items-center justify-between border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    {/* Status label */}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        color: entry.is_active ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                        border: '1px solid currentColor',
                        opacity: 0.8,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: entry.is_active ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                        }}
                      />
                      {entry.is_active ? t('fixed.active') : t('fixed.paused')}
                    </span>

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(entry)}
                        className="btn-press action-btn action-btn-edit rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        className="btn-press action-btn action-btn-delete rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.delete')}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================================================================
          Modal: Add / Edit Fixed Entry
          ================================================================== */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fixed-modal-title"
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
                  id="fixed-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingEntry ? t('common.edit') : t('fixed.add')}
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

              <form id="fixed-form" onSubmit={handleFormSubmit} className="space-y-5">
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
                    aria-describedby={formErrors.name ? 'fixed-name-error' : undefined}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p id="fixed-name-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Amount + Day of month row */}
                <div className="grid grid-cols-2 gap-4">
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
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      className={cn(
                        'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.amount ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: formData.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.amount ? 'fixed-amount-error' : undefined}
                      aria-invalid={!!formErrors.amount}
                    />
                    {formErrors.amount && (
                      <p id="fixed-amount-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.amount}
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
                      aria-describedby={formErrors.day_of_month ? 'fixed-day-error' : undefined}
                      aria-invalid={!!formErrors.day_of_month}
                    />
                    {formErrors.day_of_month && (
                      <p id="fixed-day-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.day_of_month}
                      </p>
                    )}
                  </div>
                </div>

                {/* Start date + End date row */}
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
                      aria-describedby={formErrors.start_date ? 'fixed-start-date-error' : undefined}
                      aria-invalid={!!formErrors.start_date}
                    />
                    {formErrors.start_date && (
                      <p id="fixed-start-date-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.start_date}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('fixed.endDate')}
                    </label>
                    <DatePicker
                      value={formData.end_date}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, end_date: val }))
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
                    />
                  </div>
                </div>

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

            <div className="modal-footer flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={requestModalClose}
                className="btn-press rounded-xl border px-5 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
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
                onClick={() => (document.getElementById('fixed-form') as HTMLFormElement | null)?.requestSubmit()}
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
          aria-labelledby="fixed-delete-title"
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
                  id="fixed-delete-title"
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
                  {formatCurrency(deleteTarget.amount, deleteTarget.currency)}
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
