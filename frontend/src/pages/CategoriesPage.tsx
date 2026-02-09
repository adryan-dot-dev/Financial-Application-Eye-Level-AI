import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Archive,
  X,
  Loader2,
  Tag,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { Category } from '@/types'
import { categoriesApi } from '@/api/categories'
import type { CreateCategoryData } from '@/api/categories'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#EF4444', // red
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
]

interface CategoryFormData {
  name: string
  name_he: string
  type: 'income' | 'expense'
  icon: string
  color: string
}

const EMPTY_FORM: CategoryFormData = {
  name: '',
  name_he: '',
  type: 'expense',
  icon: '',
  color: PRESET_COLORS[0],
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

function CategoryListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category Card
// ---------------------------------------------------------------------------

function CategoryCard({
  category,
  isRtl,
  onEdit,
  onArchive,
}: {
  category: Category
  isRtl: boolean
  onEdit: (cat: Category) => void
  onArchive: (cat: Category) => void
}) {
  const { t } = useTranslation()
  const displayName = isRtl ? category.name_he : category.name
  const secondaryName = isRtl ? category.name : category.name_he

  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-card)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-card)'
      }}
    >
      {/* Icon circle */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{
          backgroundColor: category.color ? `${category.color}20` : 'var(--bg-tertiary)',
          color: category.color || 'var(--text-secondary)',
        }}
      >
        {category.icon || <Tag className="h-4 w-4" />}
      </div>

      {/* Name */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {displayName}
        </p>
        {secondaryName && (
          <p
            className="truncate text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {secondaryName}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onEdit(category)}
          className="rounded-md p-1.5 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = ''
          }}
          title={t('common.edit')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onArchive(category)}
          className="rounded-md p-1.5 transition-colors"
          style={{ color: 'var(--color-expense)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = ''
          }}
          title={t('common.delete')}
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty Column State
// ---------------------------------------------------------------------------

function EmptyColumnState({ type }: { type: 'income' | 'expense' }) {
  const { t } = useTranslation()
  const isIncome = type === 'income'

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        {isIncome ? (
          <TrendingUp className="h-5 w-5" style={{ color: 'var(--color-income)' }} />
        ) : (
          <TrendingDown className="h-5 w-5" style={{ color: 'var(--color-expense)' }} />
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t('common.noData')}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRtl = i18n.language === 'he'

  // State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({})
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null)

  // Queries
  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  // Split categories by type (exclude archived)
  const incomeCategories = categories.filter((c) => c.type === 'income' && !c.is_archived)
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.is_archived)

  // Mutations
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] })

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryData) => categoriesApi.create(data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategoryData> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      invalidate()
      setArchiveTarget(null)
    },
  })

  // Modal helpers
  const openCreateModal = (type: 'income' | 'expense') => {
    setEditingCategory(null)
    setFormData({ ...EMPTY_FORM, type })
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat)
    setFormData({
      name: cat.name,
      name_he: cat.name_he,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingCategory(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
  }

  // Form validation & submit
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CategoryFormData, string>> = {}
    if (!formData.name.trim()) {
      errors.name = t('common.error')
    }
    if (!formData.name_he.trim()) {
      errors.name_he = t('common.error')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateCategoryData = {
      name: formData.name.trim(),
      name_he: formData.name_he.trim(),
      type: formData.type,
      icon: formData.icon || undefined,
      color: formData.color || undefined,
    }

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('categories.title')}
          </h1>
          {!isLoading && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {incomeCategories.length + expenseCategories.length} {t('categories.title').toLowerCase()}
            </p>
          )}
        </div>

        <button
          onClick={() => openCreateModal('expense')}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Plus className="h-4 w-4" />
          {t('categories.add')}
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="rounded-xl border p-6 text-center"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      )}

      {/* Two-column layout */}
      {!isError && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Income column */}
          <div
            className="rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-income)' }} />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('transactions.income')}
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--color-income)',
                  }}
                >
                  {incomeCategories.length}
                </span>
              </div>
              <button
                onClick={() => openCreateModal('income')}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: 'var(--color-income)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
                title={t('categories.add')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Income list */}
            <div className="p-3">
              {isLoading ? (
                <CategoryListSkeleton />
              ) : incomeCategories.length === 0 ? (
                <EmptyColumnState type="income" />
              ) : (
                <div className="space-y-2">
                  {incomeCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      isRtl={isRtl}
                      onEdit={openEditModal}
                      onArchive={setArchiveTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expense column */}
          <div
            className="rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Column header */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" style={{ color: 'var(--color-expense)' }} />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('transactions.expense')}
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--color-expense)',
                  }}
                >
                  {expenseCategories.length}
                </span>
              </div>
              <button
                onClick={() => openCreateModal('expense')}
                className="rounded-md p-1.5 transition-colors"
                style={{ color: 'var(--color-expense)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
                title={t('categories.add')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Expense list */}
            <div className="p-3">
              {isLoading ? (
                <CategoryListSkeleton />
              ) : expenseCategories.length === 0 ? (
                <EmptyColumnState type="expense" />
              ) : (
                <div className="space-y-2">
                  {expenseCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      isRtl={isRtl}
                      onEdit={openEditModal}
                      onArchive={setArchiveTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          Modal: Add / Edit Category
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
                {editingCategory ? t('common.edit') : t('categories.add')}
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
                          setFormData((prev) => ({ ...prev, type: typeVal }))
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

              {/* Name + Name Hebrew */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('categories.name')} *
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
                    placeholder="Category name"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('categories.nameHe')} *
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.name_he}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name_he: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-sm outline-none',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                      formErrors.name_he && 'border-red-400',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.name_he ? undefined : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="שם קטגוריה"
                  />
                  {formErrors.name_he && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name_he}
                    </p>
                  )}
                </div>
              </div>

              {/* Icon */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('categories.icon')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, icon: e.target.value }))
                    }
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm outline-none',
                      'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="e.g. emoji or icon name"
                  />
                  {/* Preview */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{
                      backgroundColor: formData.color ? `${formData.color}20` : 'var(--bg-tertiary)',
                      color: formData.color || 'var(--text-secondary)',
                    }}
                  >
                    {formData.icon || <Tag className="h-4 w-4" />}
                  </div>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('categories.color')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, color }))}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all',
                        formData.color === color
                          ? 'ring-2 ring-offset-2 scale-110'
                          : 'hover:scale-105',
                      )}
                      style={{
                        backgroundColor: color,
                        '--tw-ring-color': color,
                      } as React.CSSProperties}
                      title={color}
                    />
                  ))}
                </div>
                {/* Custom color input */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="h-8 w-8 cursor-pointer rounded border-0"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="w-24 rounded-lg border px-2 py-1 text-xs font-mono outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
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

      {/* ================================================================
          Archive Confirmation Dialog
          ================================================================ */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setArchiveTarget(null)
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
                <Archive className="h-5 w-5" style={{ color: 'var(--color-expense)' }} />
              </div>
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('common.delete')}
              </h3>
            </div>

            <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isRtl ? archiveTarget.name_he : archiveTarget.name}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setArchiveTarget(null)}
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
                onClick={() => archiveMutation.mutate(archiveTarget.id)}
                disabled={archiveMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-expense)' }}
              >
                {archiveMutation.isPending && (
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
