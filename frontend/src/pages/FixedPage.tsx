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
  Pause,
  Play,
  Repeat,
} from 'lucide-react'
import type { FixedEntry, Category } from '@/types'
import { fixedApi } from '@/api/fixed'
import type { CreateFixedData } from '@/api/fixed'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FixedPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRtl = i18n.language === 'he'

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
    queryKey: ['fixed', filterType ? { type: filterType } : undefined],
    queryFn: () => fixedApi.list(filterType ? { type: filterType } : undefined),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fixed'] })

  const createMutation = useMutation({
    mutationFn: (data: CreateFixedData) => fixedApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFixedData> }) =>
      fixedApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fixedApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const pauseMutation = useMutation({
    mutationFn: (id: string) => fixedApi.pause(id),
    onSuccess: () => invalidate(),
  })

  const resumeMutation = useMutation({
    mutationFn: (id: string) => fixedApi.resume(id),
    onSuccess: () => invalidate(),
  })

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingEntry(null)
    setFormData(EMPTY_FORM)
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('fixed.title')}
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {entries.length} {t('transactions.total').toLowerCase()}
            </p>
          )}
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Plus className="h-4 w-4" />
          {t('fixed.add')}
        </button>
      </div>

      {/* ---- Filter tabs ---- */}
      <div
        className="rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
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
                className="flex-1 px-4 py-2 text-sm font-medium transition-colors first:rounded-s-lg last:rounded-e-lg"
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
      ) : entries.length === 0 ? (
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
            <Repeat className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
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
            {t('fixed.title')}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--border-focus)' }}
          >
            <Plus className="h-4 w-4" />
            {t('fixed.add')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const isIncome = entry.type === 'income'
            const cat = entry.category_id ? categoryMap.get(entry.category_id) : undefined

            return (
              <div
                key={entry.id}
                className="group rounded-xl border p-5 transition-shadow"
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
                {/* Card header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {entry.name}
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

                {/* Amount */}
                <p
                  className="mb-3 text-xl font-bold tabular-nums ltr-nums"
                  style={{
                    color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                  }}
                >
                  {isIncome ? '+' : '-'}{formatCurrency(entry.amount, entry.currency)}
                </p>

                {/* Details */}
                <div
                  className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {t('fixed.dayOfMonth')}: <span className="font-medium ltr-nums">{entry.day_of_month}</span>
                  </span>
                  <span className="ltr-nums">
                    {t('fixed.startDate')}: {formatDate(entry.start_date, isRtl ? 'he-IL' : 'en-US')}
                  </span>
                  {entry.end_date && (
                    <span className="ltr-nums">
                      {t('fixed.endDate')}: {formatDate(entry.end_date, isRtl ? 'he-IL' : 'en-US')}
                    </span>
                  )}
                </div>

                {/* Status + Actions */}
                <div
                  className="flex items-center justify-between border-t pt-3"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  {/* Status badge */}
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: entry.is_active ? '#10B98115' : '#F59E0B15',
                      color: entry.is_active ? '#10B981' : '#F59E0B',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: entry.is_active ? '#10B981' : '#F59E0B',
                      }}
                    />
                    {entry.is_active ? t('fixed.active') : t('fixed.paused')}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    {/* Pause / Resume */}
                    {entry.is_active ? (
                      <button
                        onClick={() => pauseMutation.mutate(entry.id)}
                        disabled={pauseMutation.isPending}
                        className="rounded-md p-1.5 transition-colors"
                        style={{ color: '#F59E0B' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = ''
                        }}
                        title={t('fixed.pause')}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => resumeMutation.mutate(entry.id)}
                        disabled={resumeMutation.isPending}
                        className="rounded-md p-1.5 transition-colors"
                        style={{ color: 'var(--color-income)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = ''
                        }}
                        title={t('fixed.resume')}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(entry)}
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

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTarget(entry)}
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
                {entry.description && (
                  <p
                    className="mt-2 truncate text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {entry.description}
                  </p>
                )}
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
                {editingEntry ? t('common.edit') : t('fixed.add')}
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

              {/* Amount + Day of month row */}
              <div className="grid grid-cols-2 gap-4">
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
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.amount && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.amount ? undefined : 'var(--border-primary)',
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

              {/* Start date + End date row */}
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
                    {t('fixed.endDate')}
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_date: e.target.value }))
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
