import { useState, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModalA11y } from '@/hooks/useModalA11y'
import {
  Plus,
  Pencil,
  Archive,
  X,
  Loader2,
  Tag,
  TrendingUp,
  TrendingDown,
  Check,
  Palette,
  Sparkles,
} from 'lucide-react'
import type { Category } from '@/types'
import { categoriesApi } from '@/api/categories'
import type { CreateCategoryData } from '@/api/categories'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#EF4444', // red
  '#F59E0B', // amber
  '#3B82F6', // blue (brand)
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#2563EB', // blue dark (brand)
]

const PRESET_ICONS = [
  '🏠', '🍔', '🚗', '💊', '📚', '🎮', '✈️', '🛒',
  '💰', '📱', '🎵', '⚡', '🏋️', '🎬', '🐾', '🌿',
  '💼', '🎁', '📦', '🔧', '🏦', '📊', '💳', '🎯',
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

function CategoryCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className={cn('animate-fade-in-up card card-hover p-4', `stagger-${Math.min(index + 1, 8)}`)}
    >
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
        <div className="skeleton h-7 w-14 rounded-lg" />
      </div>
    </div>
  )
}

function CategoryListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <CategoryCardSkeleton key={i} index={i} />
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
  index,
}: {
  category: Category
  isRtl: boolean
  onEdit: (cat: Category) => void
  onArchive: (cat: Category) => void
  index: number
}) {
  const { t } = useTranslation()
  const displayName = isRtl ? category.name_he : category.name
  const secondaryName = isRtl ? category.name : category.name_he

  return (
    <div
      className={cn(
        'animate-fade-in-up card card-hover group relative overflow-hidden rounded-xl p-4 transition-all',
        `stagger-${Math.min(index + 1, 8)}`,
      )}
      style={{
        background: category.color
          ? `linear-gradient(135deg, ${category.color}0A, ${category.color}05, var(--bg-card))`
          : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Icon circle */}
        <CategoryIcon
          icon={category.icon}
          color={category.color}
          size="md"
          className="transition-all duration-300"
        />

        {/* Name */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
            title={displayName}
          >
            {displayName}
          </p>
          {secondaryName && (
            <p
              className="truncate text-xs"
              style={{ color: 'var(--text-tertiary)' }}
              title={secondaryName}
            >
              {secondaryName}
            </p>
          )}
        </div>

        {/* Color dot indicator */}
        {category.color && (
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: category.color,
              boxShadow: `0 0 6px ${category.color}40`,
            }}
          />
        )}

        {/* Actions - visible on hover */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            onClick={() => onEdit(category)}
            className="action-btn action-btn-edit rounded-lg p-2"
            style={{ color: 'var(--text-secondary)' }}
            title={t('common.edit')}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onArchive(category)}
            className="action-btn action-btn-delete rounded-lg p-2"
            style={{ color: 'var(--text-secondary)' }}
            title={t('common.delete')}
            aria-label={t('common.delete')}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
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
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className="empty-float mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: isIncome ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        }}
      >
        {isIncome ? (
          <TrendingUp className="h-7 w-7" style={{ color: 'var(--color-income)' }} />
        ) : (
          <TrendingDown className="h-7 w-7" style={{ color: 'var(--color-expense)' }} />
        )}
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {t('common.noData')}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
        {isIncome ? t('transactions.income') : t('transactions.expense')}
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
  const toast = useToast()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.categories')
  }, [t])

  // State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({})
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // Queries
  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
  })

  // Split categories by type (exclude archived)
  const incomeCategories = categories.filter((c) => c.type === 'income' && !c.is_archived)
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.is_archived)

  // Mutations
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryData) => categoriesApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategoryData> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
      toast.success(t('toast.updateSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      invalidate()
      setArchiveTarget(null)
      toast.success(t('toast.archiveSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  // Modal helpers
  const openCreateModal = (type: 'income' | 'expense') => {
    setEditingCategory(null)
    setFormData({ ...EMPTY_FORM, type })
    setFormErrors({})
    setShowIconPicker(false)
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
    setShowIconPicker(false)
    setModalOpen(true)
  }

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingCategory(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setShowIconPicker(false)
  }, [])

  const closeArchiveDialog = useCallback(() => setArchiveTarget(null), [])

  // Modal accessibility (Escape key, focus trap, aria)
  const { panelRef: modalPanelRef } = useModalA11y(modalOpen, closeModal)
  const { panelRef: archivePanelRef } = useModalA11y(!!archiveTarget, closeArchiveDialog)

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
    <div className="page-reveal space-y-6">
      {/* Page header */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          {t('categories.add')}
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="animate-fade-in-up stagger-2 card p-8 text-center">
          <div className="empty-float mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--bg-danger)' }}>
            <Tag className="h-7 w-7" style={{ color: 'var(--color-expense)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      )}

      {/* Two-column layout */}
      {!isError && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Income column */}
          <div className="animate-fade-in-up stagger-2">
            <div className="card overflow-hidden">
              {/* Column header */}
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--color-income)',
                    }}
                  >
                    <TrendingUp className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('transactions.income')}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {incomeCategories.length} {t('categories.title').toLowerCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openCreateModal('income')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--color-income)',
                  }}
                  title={t('categories.add')}
                  aria-label={t('categories.add')}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Income list */}
              <div className="p-4">
                {isLoading ? (
                  <CategoryListSkeleton />
                ) : incomeCategories.length === 0 ? (
                  <EmptyColumnState type="income" />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {incomeCategories.map((cat, idx) => (
                      <CategoryCard
                        key={cat.id}
                        category={cat}
                        isRtl={isRtl}
                        onEdit={openEditModal}
                        onArchive={setArchiveTarget}
                        index={idx}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expense column */}
          <div className="animate-fade-in-up stagger-3">
            <div className="card overflow-hidden">
              {/* Column header */}
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--color-expense)',
                    }}
                  >
                    <TrendingDown className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('transactions.expense')}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {expenseCategories.length} {t('categories.title').toLowerCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openCreateModal('expense')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--color-expense)',
                  }}
                  title={t('categories.add')}
                  aria-label={t('categories.add')}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Expense list */}
              <div className="p-4">
                {isLoading ? (
                  <CategoryListSkeleton />
                ) : expenseCategories.length === 0 ? (
                  <EmptyColumnState type="expense" />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {expenseCategories.map((cat, idx) => (
                      <CategoryCard
                        key={cat.id}
                        category={cat}
                        isRtl={isRtl}
                        onEdit={openEditModal}
                        onArchive={setArchiveTarget}
                        index={idx}
                      />
                    ))}
                  </div>
                )}
              </div>
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-modal-title"
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
            {/* Accent bar */}
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
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: formData.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: formData.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                    }}
                  >
                    <Tag className="h-5 w-5" />
                  </div>
                  <h2
                    id="cat-modal-title"
                    className="text-lg font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {editingCategory ? t('common.edit') : t('categories.add')}
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Type toggle - Apple segment control */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('transactions.type')}
                  </label>
                  <div className="segment-control w-full">
                    {(['income', 'expense'] as const).map((typeVal) => {
                      const active = formData.type === typeVal
                      return (
                        <button
                          key={typeVal}
                          type="button"
                          data-active={active}
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, type: typeVal }))
                          }
                          className="segment-control-btn flex-1 justify-center"
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
                        'w-full rounded-lg border px-3 py-2.5 text-sm outline-none',
                        formErrors.name && 'border-red-400',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.name ? undefined : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder={t('categories.namePlaceholder')}
                      aria-describedby={formErrors.name ? 'cat-name-error' : undefined}
                      aria-invalid={!!formErrors.name}
                    />
                    {formErrors.name && (
                      <p id="cat-name-error" role="alert" className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
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
                        'w-full rounded-lg border px-3 py-2.5 text-sm outline-none',
                        formErrors.name_he && 'border-red-400',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.name_he ? undefined : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder={t('categories.nameHePlaceholder')}
                      aria-describedby={formErrors.name_he ? 'cat-name-he-error' : undefined}
                      aria-invalid={!!formErrors.name_he}
                    />
                    {formErrors.name_he && (
                      <p id="cat-name-he-error" role="alert" className="mt-1 text-xs" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.name_he}
                      </p>
                    )}
                  </div>
                </div>

                {/* Icon */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('categories.icon')}
                  </label>
                  <div className="flex items-center gap-3">
                    {/* Preview circle */}
                    <CategoryIcon
                      icon={formData.icon}
                      color={formData.color}
                      size="lg"
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={formData.icon}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, icon: e.target.value }))
                          }
                          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            borderColor: 'var(--border-primary)',
                            color: 'var(--text-primary)',
                          }}
                          placeholder={t('categories.iconPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(!showIconPicker)}
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all',
                            showIconPicker && 'ring-2 ring-[var(--border-focus)]/30',
                          )}
                          style={{
                            backgroundColor: showIconPicker ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-input)',
                            borderColor: showIconPicker ? 'var(--border-focus)' : 'var(--border-primary)',
                            color: showIconPicker ? 'var(--border-focus)' : 'var(--text-secondary)',
                          }}
                          title="Pick an icon"
                        >
                          <Sparkles className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Quick icon picker */}
                      {showIconPicker && (
                        <div
                          className="mt-2 grid grid-cols-8 gap-1 rounded-lg border p-2"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-primary)',
                          }}
                        >
                          {PRESET_ICONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, icon }))
                                setShowIconPicker(false)
                              }}
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all hover:opacity-80',
                                formData.icon === icon ? 'ring-2 ring-[var(--border-focus)]' : '',
                              )}
                              style={{
                                backgroundColor: formData.icon === icon ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                              }}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5" />
                      {t('categories.color')}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {PRESET_COLORS.map((color) => {
                      const isSelected = formData.color === color
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, color }))}
                          className="relative flex h-9 w-9 items-center justify-center rounded-full transition-all hover:opacity-80"
                          style={{
                            backgroundColor: color,
                            boxShadow: isSelected
                              ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${color}`
                              : `0 2px 6px ${color}30`,
                          }}
                          title={color}
                        >
                          {isSelected && (
                            <Check className="h-4 w-4 text-white drop-shadow-sm" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {/* Custom color input */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, color: e.target.value }))
                      }
                      className="h-8 w-8 cursor-pointer rounded-lg border-0"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, color: e.target.value }))
                      }
                      className="w-24 rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <div
                      className="h-6 w-6 rounded-md"
                      style={{ backgroundColor: formData.color }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 border-t pt-5" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
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

      {/* ================================================================
          Archive Confirmation Dialog
          ================================================================ */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-archive-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setArchiveTarget(null)
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={archivePanelRef}
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
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="warning-pulse flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--bg-danger)' }}
                >
                  <Archive className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
                </div>
                <div>
                  <h3
                    id="cat-archive-title"
                    className="text-base font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('common.delete')}
                  </h3>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRtl ? archiveTarget.name_he : archiveTarget.name}
                  </p>
                </div>
              </div>

              <div
                className="mb-5 rounded-lg border px-4 py-3"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.04)',
                  borderColor: 'rgba(239, 68, 68, 0.15)',
                }}
              >
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {isRtl
                    ? `"${archiveTarget.name_he}" - ${archiveTarget.name}`
                    : `"${archiveTarget.name}" - ${archiveTarget.name_he}`
                  }
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setArchiveTarget(null)}
                  className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => archiveMutation.mutate(archiveTarget.id)}
                  disabled={archiveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#EF4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}
                >
                  {archiveMutation.isPending && (
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
