import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModalA11y } from '@/hooks/useModalA11y'
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Copy,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Loader2,
  Calendar,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import type { Transaction, Category } from '@/types'
import { transactionsApi } from '@/api/transactions'
import type { TransactionListParams, CreateTransactionData } from '@/api/transactions'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency } from '@/lib/utils'
import { CategoryBadge } from '@/components/ui/CategoryIcon'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = 'date' | 'amount'
type SortOrder = 'asc' | 'desc'

interface Filters {
  search: string
  type: '' | 'income' | 'expense'
  category_id: string
  start_date: string
  end_date: string
  min_amount: string
  max_amount: string
}

interface FormData {
  amount: string
  type: 'income' | 'expense'
  date: string
  description: string
  category_id: string
  notes: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  type: '',
  category_id: '',
  start_date: '',
  end_date: '',
  min_amount: '',
  max_amount: '',
}

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: FormData = {
  amount: '',
  type: 'expense',
  date: today(),
  description: '',
  category_id: '',
  notes: '',
}

const PAGE_SIZE = 15

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

function TableSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

function CategoryBadgeWrapper({
  category,
  label,
}: {
  category: Category | undefined
  label: string
}) {
  return (
    <CategoryBadge
      icon={category?.icon}
      color={category?.color}
      label={label}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.transactions')
  }, [t])

  // ---- State ----
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  // Modal / dialog
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  // Search debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchInput, setSearchInput] = useState('')

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        setFilters((prev) => ({ ...prev, search: value }))
        setPage(1)
      }, 300)
    },
    [],
  )

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // ---- Build API params ----
  const buildParams = useCallback((): TransactionListParams => {
    const params: TransactionListParams = {
      page,
      page_size: PAGE_SIZE,
      sort_by: sortBy,
      sort_order: sortOrder,
    }
    if (filters.search) params.search = filters.search
    if (filters.type) params.type = filters.type
    if (filters.category_id) params.category_id = filters.category_id
    if (filters.start_date) params.start_date = filters.start_date
    if (filters.end_date) params.end_date = filters.end_date
    if (filters.min_amount) params.min_amount = parseFloat(filters.min_amount)
    if (filters.max_amount) params.max_amount = parseFloat(filters.max_amount)
    return params
  }, [page, sortBy, sortOrder, filters])

  // ---- Queries ----
  const {
    data: txData,
    isLoading: txLoading,
    isError: txError,
  } = useQuery({
    queryKey: queryKeys.transactions.list(buildParams() as Record<string, unknown>),
    queryFn: () => transactionsApi.list(buildParams()),
  })

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })

  const createMutation = useMutation({
    mutationFn: (data: CreateTransactionData) => transactionsApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) =>
      transactionsApi.update(id, data),
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
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.duplicate(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('toast.duplicateSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  // ---- Sorting ----
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  // ---- Modal helpers ----
  const openCreateModal = () => {
    setEditingTransaction(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (tx: Transaction) => {
    setEditingTransaction(tx)
    setFormData({
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      description: tx.description ?? '',
      category_id: tx.category_id ?? '',
      notes: tx.notes ?? '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingTransaction(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }, [])

  const closeDeleteDialog = useCallback(() => setDeleteTarget(null), [])

  // Modal accessibility (Escape key, focus trap, aria)
  const { panelRef: modalPanelRef } = useModalA11y(modalOpen, closeModal)
  const { panelRef: deletePanelRef } = useModalA11y(!!deleteTarget, closeDeleteDialog)

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    const amt = parseFloat(formData.amount)
    if (!formData.amount || isNaN(amt) || amt <= 0) {
      errors.amount = t('common.error')
    }
    if (!formData.date) {
      errors.date = t('common.error')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateTransactionData = {
      amount: parseFloat(formData.amount),
      type: formData.type,
      date: formData.date,
      description: formData.description || undefined,
      category_id: formData.category_id || undefined,
      notes: formData.notes || undefined,
    }

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // ---- Filter helpers ----
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.type !== '') count++
    if (filters.category_id !== '') count++
    if (filters.start_date !== '') count++
    if (filters.end_date !== '') count++
    if (filters.min_amount !== '') count++
    if (filters.max_amount !== '') count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearchInput('')
    setPage(1)
  }

  // ---- Derived ----
  const transactions = txData?.items ?? []
  const totalPages = txData?.pages ?? 1
  const totalCount = txData?.total ?? 0

  // Categories for current type filter
  const filteredCategories = filters.type
    ? categories.filter((c) => c.type === filters.type && !c.is_archived)
    : categories.filter((c) => !c.is_archived)

  // Categories for the form
  const formCategories = categories.filter(
    (c) => c.type === formData.type && !c.is_archived,
  )

  // ---- Render helpers ----
  const SortHeader = ({
    field,
    label,
    className,
  }: {
    field: SortField
    label: string
    className?: string
  }) => {
    const isActive = sortBy === field
    const SortIcon = isActive
      ? (sortOrder === 'asc' ? ChevronUp : ChevronDown)
      : ArrowUpDown

    return (
      <th
        scope="col"
        role="button"
        tabIndex={0}
        className={cn(
          'cursor-pointer select-none px-5 py-4 text-[11px] font-semibold uppercase tracking-widest',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-inset',
          className,
        )}
        style={{
          color: isActive ? 'var(--border-focus)' : 'var(--text-tertiary)',
        }}
        onClick={() => handleSort(field)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSort(field)
          }
        }}
        aria-sort={isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <span className="inline-flex items-center gap-1.5">
          {label}
          <SortIcon
            className={cn(
              'h-3.5 w-3.5 sort-arrow',
              isActive ? 'opacity-100' : 'opacity-40',
            )}
          />
        </span>
      </th>
    )
  }

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
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.08))',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.1)',
            }}
          >
            <Wallet className="h-6 w-6" style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <h1
              className="text-[1.75rem] font-extrabold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('transactions.title')}
            </h1>
            {!txLoading && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('transactions.total')}:{' '}
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ltr-nums"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}
                >
                  {totalCount}
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
          {t('transactions.add')}
        </button>
      </div>

      {/* ---- Search + filter toggle row ---- */}
      <div className="animate-fade-in-up stagger-2 card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search input */}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 start-3"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('transactions.searchPlaceholder')}
              aria-label={t('transactions.search')}
              className={cn(
                'w-full rounded-xl border py-2.5 ps-10 pe-4 text-sm outline-none transition-all',
                'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Type quick-filter */}
          <fieldset>
            <legend className="sr-only">{t('transactions.type')}</legend>
            <div
              className="flex overflow-hidden rounded-xl border"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              {(['', 'income', 'expense'] as const).map((typeVal) => {
                const active = filters.type === typeVal
                const label =
                  typeVal === ''
                    ? t('transactions.all')
                    : typeVal === 'income'
                      ? t('transactions.income')
                      : t('transactions.expense')
                return (
                  <button
                    key={typeVal}
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, type: typeVal, category_id: '' }))
                      setPage(1)
                    }}
                    className={cn(
                      'px-4 py-2 text-xs font-semibold tracking-wide transition-all',
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

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold tracking-wide transition-all',
              'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
              hasActiveFilters && 'shadow-sm',
            )}
            style={{
              borderColor: hasActiveFilters ? 'var(--border-focus)' : 'var(--border-primary)',
              color: hasActiveFilters ? 'var(--border-focus)' : 'var(--text-secondary)',
              backgroundColor: hasActiveFilters ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-input)',
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            {t('transactions.filter')}
            {hasActiveFilters && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--border-focus)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ---- Expanded filter panel ---- */}
        {showFilters && (
          <div
            className="filter-reveal mt-5 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            {/* Category – pill buttons */}
            <div className="sm:col-span-2 lg:col-span-4">
              <label
                className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('transactions.category')}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, category_id: '' }))
                    setPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                    'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
                  )}
                  style={{
                    borderColor: !filters.category_id ? 'var(--border-focus)' : 'var(--border-primary)',
                    backgroundColor: !filters.category_id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-input)',
                    color: !filters.category_id ? 'var(--border-focus)' : 'var(--text-secondary)',
                  }}
                >
                  {t('transactions.all')}
                </button>
                {filteredCategories.map((cat) => {
                  const isActive = filters.category_id === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, category_id: cat.id }))
                        setPage(1)
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                        'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
                      )}
                      style={{
                        borderColor: isActive ? (cat.color || 'var(--border-focus)') : 'var(--border-primary)',
                        backgroundColor: isActive ? `${cat.color || 'var(--border-focus)'}15` : 'var(--bg-input)',
                        color: isActive ? (cat.color || 'var(--border-focus)') : 'var(--text-secondary)',
                      }}
                    >
                      {cat.icon && <span className="text-sm">{cat.icon}</span>}
                      {isRtl ? cat.name_he : cat.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date from */}
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('transactions.from')}
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, start_date: e.target.value }))
                  setPage(1)
                }}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Date to */}
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('transactions.to')}
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, end_date: e.target.value }))
                  setPage(1)
                }}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Amount range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('transactions.minAmount')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.min_amount}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, min_amount: e.target.value }))
                    setPage(1)
                  }}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none ltr-nums transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('transactions.maxAmount')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters.max_amount}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, max_amount: e.target.value }))
                    setPage(1)
                  }}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none ltr-nums transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Clear button */}
            {hasActiveFilters && (
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                  style={{ color: 'var(--border-focus)', backgroundColor: 'rgba(59, 130, 246, 0.06)' }}
                >
                  <X className="h-3 w-3" />
                  {t('transactions.clearFilters')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Active filter chips ---- */}
      {hasActiveFilters && (
        <div className="animate-fade-in-up flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('transactions.filter')}:
          </span>

          {filters.type && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-1.5 text-xs font-semibold"
              style={{
                backgroundColor: filters.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: filters.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
              }}
            >
              {filters.type === 'income' ? t('transactions.income') : t('transactions.expense')}
              <button
                onClick={() => { setFilters((prev) => ({ ...prev, type: '', category_id: '' })); setPage(1) }}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                aria-label={t('transactions.clearFilters')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {filters.category_id && (() => {
            const cat = categoryMap.get(filters.category_id)
            return (
              <span
                className="inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: `${cat?.color || '#3B82F6'}15`,
                  color: cat?.color || '#3B82F6',
                }}
              >
                {cat?.icon && <span className="text-sm">{cat.icon}</span>}
                {cat ? (isRtl ? cat.name_he : cat.name) : filters.category_id}
                <button
                  onClick={() => { setFilters((prev) => ({ ...prev, category_id: '' })); setPage(1) }}
                  className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                  aria-label={t('transactions.clearFilters')}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )
          })()}

          {filters.start_date && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-1.5 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}
            >
              <Calendar className="h-3 w-3" />
              {t('transactions.from')}: {filters.start_date}
              <button
                onClick={() => { setFilters((prev) => ({ ...prev, start_date: '' })); setPage(1) }}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                aria-label={t('transactions.clearFilters')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {filters.end_date && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-1.5 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}
            >
              <Calendar className="h-3 w-3" />
              {t('transactions.to')}: {filters.end_date}
              <button
                onClick={() => { setFilters((prev) => ({ ...prev, end_date: '' })); setPage(1) }}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                aria-label={t('transactions.clearFilters')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {(filters.min_amount || filters.max_amount) && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-1.5 text-xs font-semibold ltr-nums"
              style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}
            >
              {filters.min_amount && filters.max_amount
                ? `${filters.min_amount} – ${filters.max_amount}`
                : filters.min_amount
                  ? `≥ ${filters.min_amount}`
                  : `≤ ${filters.max_amount}`}
              <button
                onClick={() => { setFilters((prev) => ({ ...prev, min_amount: '', max_amount: '' })); setPage(1) }}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10"
                aria-label={t('transactions.clearFilters')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all hover:opacity-80"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="h-3 w-3" />
            {t('transactions.clearFilters')}
          </button>
        </div>
      )}

      {/* ---- Table card ---- */}
      <div className="animate-fade-in-up stagger-3 card overflow-hidden">
        {txLoading ? (
          <TableSkeleton />
        ) : txError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
              {t('common.error')}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          /* ---- Empty state – SVG illustration ---- */
          <div className="flex flex-col items-center justify-center px-6 py-24">
            {/* Illustrated SVG */}
            <div className="empty-float mb-8">
              <svg width="180" height="140" viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Desk / base surface */}
                <ellipse cx="90" cy="128" rx="80" ry="10" fill="var(--bg-hover)" opacity="0.6" />
                {/* Receipt paper */}
                <rect x="55" y="22" width="70" height="96" rx="8" fill="var(--bg-card)" stroke="var(--border-primary)" strokeWidth="1.5" />
                {/* Receipt lines */}
                <rect x="68" y="40" width="44" height="4" rx="2" fill="var(--border-primary)" opacity="0.5" />
                <rect x="68" y="52" width="36" height="4" rx="2" fill="var(--border-primary)" opacity="0.35" />
                <rect x="68" y="64" width="40" height="4" rx="2" fill="var(--border-primary)" opacity="0.25" />
                <rect x="68" y="76" width="28" height="4" rx="2" fill="var(--border-primary)" opacity="0.15" />
                {/* Receipt dollar icon circle */}
                <circle cx="90" cy="100" r="10" fill="rgba(59, 130, 246, 0.1)" />
                <text x="90" y="105" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#3B82F6">$</text>
                {/* Decorative floating circles */}
                <circle cx="38" cy="48" r="14" fill="rgba(16, 185, 129, 0.12)" />
                <path d="M32 48L36 52L44 44" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="148" cy="38" r="12" fill="rgba(239, 68, 68, 0.10)" />
                <path d="M144 34L152 42M152 34L144 42" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="142" cy="90" r="8" fill="rgba(139, 92, 246, 0.10)" />
                {/* Small sparkle */}
                <path d="M30 88L32 84L34 88L32 92Z" fill="rgba(251, 191, 36, 0.4)" />
                <path d="M152 68L154 64L156 68L154 72Z" fill="rgba(59, 130, 246, 0.3)" />
              </svg>
            </div>
            <h3
              className="mb-2 text-xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('transactions.noTransactions')}
            </h3>
            <p
              className="mb-10 max-w-md text-center text-sm leading-relaxed"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('transactions.noTransactionsDesc')}
            </p>
            <button
              onClick={openCreateModal}
              className="btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
            >
              <Plus className="h-5 w-5" />
              {t('transactions.add')}
            </button>
          </div>
        ) : (
          /* ---- Data table ---- */
          <div className="overflow-x-auto">
            <table className="tx-table w-full text-sm">
              <thead>
                <tr
                  className="border-b-2"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                  }}
                >
                  <SortHeader field="date" label={t('transactions.date')} />
                  <th
                    scope="col"
                    className="px-5 py-4 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.description')}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.category')}
                  </th>
                  <SortHeader
                    field="amount"
                    label={t('transactions.amount')}
                    className="text-end"
                  />
                  <th
                    scope="col"
                    className="px-5 py-4 text-start text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.type')}
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-center text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => {
                  const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined
                  const catLabel = cat
                    ? (isRtl ? cat.name_he : cat.name)
                    : t('transactions.uncategorized')
                  const isIncome = tx.type === 'income'

                  return (
                    <tr
                      key={tx.id}
                      className={cn(
                        'row-animate border-b transition-all duration-200',
                        isIncome ? 'row-income' : 'row-expense',
                      )}
                      style={{
                        borderColor: 'var(--border-primary)',
                        animationDelay: `${index * 30}ms`,
                        borderInlineStartWidth: '3px',
                        borderInlineStartColor: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {/* Date */}
                      <td
                        className="whitespace-nowrap px-5 py-5 text-[13px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold ltr-nums"
                            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                          >
                            {new Date(tx.date).getDate()}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-[11px] font-medium ltr-nums" style={{ color: 'var(--text-tertiary)' }}>
                              {new Date(tx.date).toLocaleDateString(isRtl ? 'he-IL' : 'en-US', { month: 'short' })}
                            </span>
                            <span className="text-[11px] ltr-nums" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
                              {new Date(tx.date).getFullYear()}
                            </span>
                          </span>
                        </span>
                      </td>

                      {/* Description */}
                      <td
                        className="max-w-[260px] overflow-hidden truncate px-5 py-5 text-[13px] font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                        title={tx.description || undefined}
                      >
                        {tx.description || '\u2014'}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-5">
                        <CategoryBadgeWrapper category={cat} label={catLabel} />
                      </td>

                      {/* Amount – larger with arrow icon */}
                      <td className="whitespace-nowrap px-5 py-5 text-end">
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ color: isIncome ? 'var(--color-income)' : 'var(--color-expense)' }}
                        >
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            }}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span className="text-base fin-number font-bold ltr-nums">
                            {isIncome ? '+' : '\u2212'}{formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </span>
                      </td>

                      {/* Type – prominent pill badge */}
                      <td className="px-5 py-5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)',
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
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(tx)}
                            className="action-btn action-btn-edit rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 tooltip-wrap"
                            style={{ color: 'var(--text-tertiary)' }}
                            data-tooltip={t('transactions.edit')}
                            aria-label={t('transactions.edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => duplicateMutation.mutate(tx.id)}
                            className="action-btn action-btn-duplicate rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 tooltip-wrap"
                            style={{ color: 'var(--text-tertiary)' }}
                            data-tooltip={t('transactions.duplicate')}
                            aria-label={t('transactions.duplicate')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(tx)}
                            className="action-btn action-btn-delete rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 tooltip-wrap"
                            style={{ color: 'var(--text-tertiary)' }}
                            data-tooltip={t('transactions.delete')}
                            aria-label={t('transactions.delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Pagination ---- */}
        {!txLoading && transactions.length > 0 && totalPages > 1 && (
          <div
            className="flex items-center justify-between border-t px-6 py-5"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <p className="text-xs font-semibold ltr-nums" style={{ color: 'var(--text-tertiary)' }}>
              {t('common.page')}{' '}
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{page}</span>{' '}
              {t('common.of')} {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg p-2 transition-all disabled:opacity-30 hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={t('common.previousPage')}
              >
                {isRtl ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                const isCurrentPage = page === pageNum
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all',
                      'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
                      !isCurrentPage && 'hover:bg-[var(--bg-hover)]',
                      isCurrentPage && 'page-btn-active',
                    )}
                    style={{
                      backgroundColor: isCurrentPage ? 'var(--border-focus)' : 'transparent',
                      color: isCurrentPage ? '#fff' : 'var(--text-secondary)',
                    }}
                    aria-label={t('common.goToPage', { page: pageNum })}
                    aria-current={isCurrentPage ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg p-2 transition-all disabled:opacity-30 hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={t('common.nextPage')}
              >
                {isRtl ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================
          Modal: Add / Edit Transaction
          ================================================================== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={modalPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border p-0"
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
                background: formData.type === 'income'
                  ? 'linear-gradient(90deg, #34D399, #10B981)'
                  : 'linear-gradient(90deg, #F87171, #EF4444)',
              }}
            />

            <div className="p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2
                  id="tx-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingTransaction
                    ? t('transactions.editTransaction')
                    : t('transactions.add')}
                </h2>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5">
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

                {/* Amount + Date row */}
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
                        formErrors.amount && 'border-red-400',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.amount
                          ? undefined
                          : 'var(--border-primary)',
                        color: formData.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.amount ? 'tx-amount-error' : undefined}
                      aria-invalid={!!formErrors.amount}
                    />
                    {formErrors.amount && (
                      <p id="tx-amount-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.amount}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('transactions.date')} *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                        formErrors.date && 'border-red-400',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.date
                          ? undefined
                          : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      aria-describedby={formErrors.date ? 'tx-date-error' : undefined}
                      aria-invalid={!!formErrors.date}
                    />
                    {formErrors.date && (
                      <p id="tx-date-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.date}
                      </p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.description')}
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
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
                    placeholder={t('transactions.description')}
                  />
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

                {/* Notes */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
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
                      'w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all',
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
                <div className="flex items-center justify-end gap-3 border-t pt-5" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    type="button"
                    onClick={closeModal}
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
                    type="submit"
                    disabled={isMutating}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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

      {/* ==================================================================
          Delete Confirmation Dialog
          ================================================================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null)
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={deletePanelRef}
            className="modal-panel relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Red accent bar */}
            <div
              className="h-1"
              style={{ background: 'linear-gradient(90deg, #F87171, #EF4444, #DC2626)' }}
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
                  id="tx-delete-title"
                  className="mb-2 text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('transactions.deleteConfirmTitle')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t('transactions.deleteConfirmMessage')}
                </p>
                {deleteTarget.description && (
                  <p
                    className="mt-2 rounded-lg px-3 py-1.5 text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    &ldquo;{deleteTarget.description}&rdquo;
                  </p>
                )}
                {deleteTarget.amount && (
                  <p
                    className="mt-2 text-base fin-number ltr-nums"
                    style={{
                      color: deleteTarget.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                    }}
                  >
                    {formatCurrency(deleteTarget.amount, deleteTarget.currency)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
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
                    background: 'linear-gradient(135deg, #F87171, #EF4444)',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
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
