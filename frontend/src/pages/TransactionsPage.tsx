import { useState, useCallback, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react'
import type { Transaction, Category } from '@/types'
import { transactionsApi } from '@/api/transactions'
import type { TransactionListParams, CreateTransactionData } from '@/api/transactions'
import { categoriesApi } from '@/api/categories'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = 'date' | 'amount' | 'description' | 'type'
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
      className={cn('animate-pulse rounded', className)}
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    />
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

function CategoryBadge({
  category,
  label,
}: {
  category: Category | undefined
  label: string
}) {
  const bgColor = category?.color ? `${category.color}20` : 'var(--bg-tertiary)'
  const textColor = category?.color ?? 'var(--text-secondary)'

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {category?.icon && <span className="text-sm leading-none">{category.icon}</span>}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRtl = i18n.language === 'he'

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
    queryKey: ['transactions', buildParams()],
    queryFn: () => transactionsApi.list(buildParams()),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Mutations ----
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['transactions'] })

  const createMutation = useMutation({
    mutationFn: (data: CreateTransactionData) => transactionsApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) =>
      transactionsApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.duplicate(id),
    onSuccess: () => invalidate(),
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

  const closeModal = () => {
    setModalOpen(false)
    setEditingTransaction(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }

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
  const hasActiveFilters =
    filters.type !== '' ||
    filters.category_id !== '' ||
    filters.start_date !== '' ||
    filters.end_date !== '' ||
    filters.min_amount !== '' ||
    filters.max_amount !== ''

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
  }) => (
    <th
      className={cn('cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider', className)}
      style={{ color: 'var(--text-secondary)' }}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            'h-3 w-3 transition-colors',
            sortBy === field ? 'opacity-100' : 'opacity-30',
          )}
        />
      </span>
    </th>
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
            {t('transactions.title')}
          </h1>
          {!txLoading && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('transactions.total')}: {totalCount}
            </p>
          )}
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Plus className="h-4 w-4" />
          {t('transactions.add')}
        </button>
      </div>

      {/* ---- Search + filter toggle row ---- */}
      <div
        className="rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search input */}
          <div className="relative flex-1">
            <Search
              className={cn(
                'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2',
                isRtl ? 'right-3' : 'left-3',
              )}
              style={{ color: 'var(--text-tertiary)' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('transactions.searchPlaceholder')}
              className={cn(
                'w-full rounded-lg border py-2 text-sm outline-none transition-colors',
                'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3',
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Type quick-filter */}
          <div className="flex rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
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
                    'px-3 py-2 text-xs font-medium transition-colors first:rounded-s-lg last:rounded-e-lg',
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

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            )}
            style={{
              borderColor: hasActiveFilters ? 'var(--border-focus)' : 'var(--border-primary)',
              color: hasActiveFilters ? 'var(--border-focus)' : 'var(--text-secondary)',
              backgroundColor: 'var(--bg-input)',
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            {t('transactions.filter')}
            {hasActiveFilters && (
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: 'var(--border-focus)' }}
              >
                !
              </span>
            )}
          </button>
        </div>

        {/* ---- Expanded filter panel ---- */}
        {showFilters && (
          <div
            className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            {/* Category */}
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('transactions.category')}
              </label>
              <select
                value={filters.category_id}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, category_id: e.target.value }))
                  setPage(1)
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('transactions.selectCategory')}</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {isRtl ? cat.name_he : cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
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
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
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
                className="mb-1 block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
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
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
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
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
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
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
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
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none ltr-nums"
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--border-focus)' }}
                >
                  <X className="h-3 w-3" />
                  {t('transactions.clearFilters')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Table card ---- */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {txLoading ? (
          <TableSkeleton />
        ) : txError ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
              {t('common.error')}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          /* ---- Empty state ---- */
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <TrendingUp className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <h3
              className="mb-1 text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('transactions.noTransactions')}
            </h3>
            <p
              className="mb-6 max-w-xs text-center text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('transactions.noTransactionsDesc')}
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--border-focus)' }}
            >
              <Plus className="h-4 w-4" />
              {t('transactions.add')}
            </button>
          </div>
        ) : (
          /* ---- Data table ---- */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <SortHeader field="date" label={t('transactions.date')} />
                  <SortHeader field="description" label={t('transactions.description')} />
                  <th
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('transactions.category')}
                  </th>
                  <SortHeader field="amount" label={t('transactions.amount')} />
                  <SortHeader field="type" label={t('transactions.type')} />
                  <th
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('transactions.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined
                  const catLabel = cat
                    ? (isRtl ? cat.name_he : cat.name)
                    : t('transactions.uncategorized')
                  const isIncome = tx.type === 'income'

                  return (
                    <tr
                      key={tx.id}
                      className="border-b transition-colors"
                      style={{
                        borderColor: 'var(--border-primary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ''
                      }}
                    >
                      {/* Date */}
                      <td
                        className="whitespace-nowrap px-4 py-3 ltr-nums"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {formatDate(tx.date, isRtl ? 'he-IL' : 'en-US')}
                      </td>

                      {/* Description */}
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {tx.description || '\u2014'}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <CategoryBadge category={cat} label={catLabel} />
                      </td>

                      {/* Amount */}
                      <td
                        className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums ltr-nums"
                        style={{ color: isIncome ? 'var(--color-income)' : 'var(--color-expense)' }}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium"
                          style={{ color: isIncome ? 'var(--color-income)' : 'var(--color-expense)' }}
                        >
                          {isIncome ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {isIncome ? t('transactions.income') : t('transactions.expense')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(tx)}
                            className="rounded-md p-1.5 transition-colors hover:opacity-80"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = ''
                            }}
                            title={t('transactions.edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => duplicateMutation.mutate(tx.id)}
                            className="rounded-md p-1.5 transition-colors hover:opacity-80"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = ''
                            }}
                            title={t('transactions.duplicate')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(tx)}
                            className="rounded-md p-1.5 transition-colors hover:opacity-80"
                            style={{ color: 'var(--color-expense)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = ''
                            }}
                            title={t('transactions.delete')}
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
            className="flex items-center justify-between border-t px-4 py-3"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('common.page')} {page} {t('common.of')} {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md p-1.5 transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled)
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
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
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors',
                    )}
                    style={{
                      backgroundColor:
                        page === pageNum ? 'var(--border-focus)' : 'transparent',
                      color: page === pageNum ? '#fff' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (page !== pageNum)
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (page !== pageNum) e.currentTarget.style.backgroundColor = ''
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md p-1.5 transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled)
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
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
                {editingTransaction
                  ? t('transactions.editTransaction')
                  : t('transactions.add')}
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

              {/* Amount + Date row */}
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
                      borderColor: formErrors.amount
                        ? undefined
                        : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="0.00"
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.amount}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
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
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.date && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.date
                        ? undefined
                        : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
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
                    'w-full rounded-lg border px-3 py-2 text-sm outline-none',
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
                {t('transactions.deleteConfirmTitle')}
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
