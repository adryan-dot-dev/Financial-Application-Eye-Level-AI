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
  Shapes,
  LayoutGrid,
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
  '#4318FF', // brand (indigo)
  '#05CD99', // income (green)
  '#EE5D50', // expense (rose)
  '#6B7280', // neutral (gray)
  '#06B6D4', // info (teal)
  '#FFB547', // accent (amber)
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
      className={cn(
        'animate-fade-in-up rounded-2xl p-5',
        `stagger-${Math.min(index + 1, 8)}`,
      )}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="skeleton h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2.5">
          <div className="skeleton h-4 w-24 rounded-md" />
          <div className="skeleton h-3 w-16 rounded-md" />
        </div>
        <div className="skeleton h-6 w-6 rounded-full" />
      </div>
    </div>
  )
}

function CategoryListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <CategoryCardSkeleton key={i} index={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category Card — Premium Design
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
        'animate-fade-in-up group relative overflow-hidden rounded-2xl border transition-all duration-300',
        'card-lift',
        `stagger-${Math.min(index + 1, 8)}`,
      )}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Subtle accent line at top */}
      <div
        className="h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: category.color
            ? `${category.color}`
            : 'var(--color-brand-500)',
        }}
      />

      <div className="flex items-center gap-4 p-4 ps-5 pe-4">
        {/* Icon with glow effect on hover */}
        <div className="relative">
          <CategoryIcon
            icon={category.icon}
            color={category.color}
            size="md"
            className="transition-transform duration-300 group-hover:scale-110"
          />
          {/* Glow behind icon on hover */}
          <div
            className="absolute inset-0 -z-10 rounded-xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-40"
            style={{ backgroundColor: category.color || 'var(--color-brand-500)' }}
          />
        </div>

        {/* Name + secondary */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold leading-tight tracking-tight"
            style={{ color: 'var(--text-primary)' }}
            title={displayName}
          >
            {displayName}
          </p>
          {secondaryName && (
            <p
              className="mt-0.5 truncate text-xs"
              style={{ color: 'var(--text-tertiary)' }}
              title={secondaryName}
            >
              {secondaryName}
            </p>
          )}
        </div>

        {/* Color dot — always visible */}
        {category.color && (
          <div className="relative flex-shrink-0">
            <div
              className="h-3 w-3 rounded-full transition-transform duration-300 group-hover:scale-125"
              style={{
                backgroundColor: category.color,
              }}
            />
          </div>
        )}

        {/* Actions — fade in on hover with refined styling */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center gap-1',
            'translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100',
          )}
        >
          <button
            onClick={() => onEdit(category)}
            className="btn-press action-btn action-btn-edit flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: 'var(--text-secondary)' }}
            title={t('common.edit')}
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onArchive(category)}
            className="btn-press action-btn action-btn-delete flex h-8 w-8 items-center justify-center rounded-lg"
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
// Empty Column State — Delightful
// ---------------------------------------------------------------------------

function EmptyColumnState({ type }: { type: 'income' | 'expense' }) {
  const { t } = useTranslation()
  const isIncome = type === 'income'

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* Animated floating icon container with gradient background */}
      <div className="relative mb-5">
        <div
          className="empty-float flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{
            backgroundColor: isIncome
              ? 'var(--bg-success)'
              : 'var(--bg-danger)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {isIncome ? (
            <TrendingUp className="h-9 w-9" style={{ color: 'var(--color-income)' }} />
          ) : (
            <TrendingDown className="h-9 w-9" style={{ color: 'var(--color-expense)' }} />
          )}
        </div>
        {/* Decorative rings */}
        <div
          className="absolute inset-0 -z-10 animate-pulse rounded-3xl"
          style={{
            transform: 'scale(1.3)',
            backgroundColor: isIncome
              ? 'rgba(5, 205, 153, 0.04)'
              : 'rgba(238, 93, 80, 0.04)',
          }}
        />
      </div>
      <p
        className="text-sm font-semibold tracking-tight"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('common.noData')}
      </p>
      <p
        className="mt-1.5 max-w-[200px] text-center text-xs leading-relaxed"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {isIncome ? t('transactions.income') : t('transactions.expense')}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column Component — Encapsulates header + list
// ---------------------------------------------------------------------------

function CategoryColumn({
  type,
  categories,
  isLoading,
  isRtl,
  onAdd,
  onEdit,
  onArchive,
  staggerClass,
}: {
  type: 'income' | 'expense'
  categories: Category[]
  isLoading: boolean
  isRtl: boolean
  onAdd: () => void
  onEdit: (cat: Category) => void
  onArchive: (cat: Category) => void
  staggerClass: string
}) {
  const { t } = useTranslation()
  const isIncome = type === 'income'

  return (
    <div className={cn('animate-fade-in-up', staggerClass)}>
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        {/* Column header with accent gradient top border */}
        <div
          className="h-[3px]"
          style={{
            background: isIncome
              ? 'var(--color-success)'
              : 'var(--color-danger)',
          }}
        />

        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 hover:scale-105"
              style={{
                backgroundColor: isIncome
                  ? 'var(--bg-success)'
                  : 'var(--bg-danger)',
                color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                boxShadow: isIncome
                  ? '0 4px 12px rgba(0,0,0,0.1)'
                  : '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {isIncome ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2
                className="text-[15px] font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {isIncome ? t('transactions.income') : t('transactions.expense')}
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {categories.length} {t('categories.title').toLowerCase()}
              </p>
            </div>
          </div>

          {/* Add button — circular with hover effect */}
          <button
            onClick={onAdd}
            className="btn-press flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              backgroundColor: isIncome
                ? 'var(--bg-success)'
                : 'var(--bg-danger)',
              color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
              boxShadow: 'var(--shadow-xs)',
            }}
            title={t('categories.add')}
            aria-label={t('categories.add')}
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Category list */}
        <div className="p-4">
          {isLoading ? (
            <CategoryListSkeleton />
          ) : categories.length === 0 ? (
            <EmptyColumnState type={type} />
          ) : (
            <div className="space-y-2.5">
              {categories.map((cat, idx) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  isRtl={isRtl}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  index={idx}
                />
              ))}
            </div>
          )}
        </div>
      </div>
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
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)
  const { panelRef: archivePanelRef, closing: archiveClosing, requestClose: requestArchiveClose } = useModalA11y(!!archiveTarget, closeArchiveDialog)

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
    <div className="page-reveal space-y-8">
      {/* ── Page Header ── */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--color-brand-500)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <LayoutGrid className="h-4.5 w-4.5 text-white" />
            </div>
            <h1
              className="gradient-heading text-2xl font-extrabold tracking-tight"
            >
              {t('categories.title')}
            </h1>
          </div>
          {!isLoading && (
            <p className="mt-1 ps-[46px] text-sm" style={{ color: 'var(--text-tertiary)' }}>
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

      {/* ── Error State ── */}
      {isError && (
        <div
          className="animate-fade-in-up stagger-2 overflow-hidden rounded-2xl border p-10 text-center"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div
            className="empty-float mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              backgroundColor: 'var(--bg-danger)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Tag className="h-9 w-9" style={{ color: 'var(--color-expense)' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      )}

      {/* ── Two-column layout ── */}
      {!isError && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <CategoryColumn
            type="income"
            categories={incomeCategories}
            isLoading={isLoading}
            isRtl={isRtl}
            onAdd={() => openCreateModal('income')}
            onEdit={openEditModal}
            onArchive={setArchiveTarget}
            staggerClass="stagger-2"
          />
          <CategoryColumn
            type="expense"
            categories={expenseCategories}
            isLoading={isLoading}
            isRtl={isRtl}
            onAdd={() => openCreateModal('expense')}
            onEdit={openEditModal}
            onArchive={setArchiveTarget}
            staggerClass="stagger-3"
          />
        </div>
      )}

      {/* ================================================================
          Modal: Add / Edit Category — Glassmorphism
          ================================================================ */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestModalClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={modalPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border p-0"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Accent bar — gradient based on type */}
            <div
              className="h-[3px]"
              style={{
                background: formData.type === 'income'
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
              }}
            />

            <div className="p-7">
              {/* Header */}
              <div className="mb-7 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: formData.type === 'income'
                        ? 'var(--bg-success)'
                        : 'var(--bg-danger)',
                      color: formData.type === 'income'
                        ? 'var(--color-income)'
                        : 'var(--color-expense)',
                      boxShadow: formData.type === 'income'
                        ? '0 4px 12px rgba(5, 205, 153, 0.15)'
                        : '0 4px 12px rgba(238, 93, 80, 0.15)',
                    }}
                  >
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      id="cat-modal-title"
                      className="text-lg font-bold tracking-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {editingCategory ? t('common.edit') : t('categories.add')}
                    </h2>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formData.type === 'income' ? t('transactions.income') : t('transactions.expense')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={requestModalClose}
                  className="btn-press flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* Type toggle — Apple segment control */}
                <div>
                  <label
                    className="mb-2.5 block text-xs font-semibold uppercase tracking-wider"
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
                        'input w-full',
                        formErrors.name && 'input-error',
                      )}
                      placeholder={t('categories.namePlaceholder')}
                      aria-describedby={formErrors.name ? 'cat-name-error' : undefined}
                      aria-invalid={!!formErrors.name}
                    />
                    {formErrors.name && (
                      <p id="cat-name-error" role="alert" className="mt-1.5 text-xs" style={{ color: 'var(--color-expense)' }}>
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
                        'input w-full',
                        formErrors.name_he && 'input-error',
                      )}
                      placeholder={t('categories.nameHePlaceholder')}
                      aria-describedby={formErrors.name_he ? 'cat-name-he-error' : undefined}
                      aria-invalid={!!formErrors.name_he}
                    />
                    {formErrors.name_he && (
                      <p id="cat-name-he-error" role="alert" className="mt-1.5 text-xs" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.name_he}
                      </p>
                    )}
                  </div>
                </div>

                {/* Icon picker section */}
                <div>
                  <label
                    className="mb-2.5 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('categories.icon')}
                  </label>
                  <div className="flex items-start gap-4">
                    {/* Preview — larger, with subtle shadow */}
                    <div className="flex flex-col items-center gap-2">
                      <CategoryIcon
                        icon={formData.icon}
                        color={formData.color}
                        size="lg"
                        className="ring-2 ring-[var(--border-primary)]"
                      />
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        Preview
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={formData.icon}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, icon: e.target.value }))
                          }
                          className="input flex-1"
                          placeholder={t('categories.iconPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(!showIconPicker)}
                          className={cn(
                            'btn-press flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-all duration-200',
                            showIconPicker
                              ? 'scale-95 ring-2 ring-[var(--border-focus)]/30'
                              : 'hover:scale-105',
                          )}
                          style={{
                            backgroundColor: showIconPicker
                              ? 'var(--bg-info)'
                              : 'var(--bg-input)',
                            borderColor: showIconPicker
                              ? 'var(--border-focus)'
                              : 'var(--border-primary)',
                            color: showIconPicker
                              ? 'var(--color-info)'
                              : 'var(--text-secondary)',
                          }}
                          title="Pick an icon"
                        >
                          <Shapes className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Emoji grid — refined with hover effects */}
                      {showIconPicker && (
                        <div
                          className="animate-fade-in-scale mt-3 grid grid-cols-8 gap-1.5 rounded-xl border p-3 max-[375px]:grid-cols-6"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-primary)',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          {PRESET_ICONS.map((icon) => {
                            const selected = formData.icon === icon
                            return (
                              <button
                                key={icon}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, icon }))
                                  setShowIconPicker(false)
                                }}
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all duration-150',
                                  selected
                                    ? 'scale-110 ring-2 ring-[var(--border-focus)]'
                                    : 'hover:scale-110 hover:bg-[var(--bg-hover)]',
                                )}
                                style={{
                                  backgroundColor: selected
                                    ? 'var(--bg-info)'
                                    : undefined,
                                }}
                              >
                                {icon}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Color picker — refined */}
                <div>
                  <label
                    className="mb-3 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5" />
                      {t('categories.color')}
                    </span>
                  </label>

                  {/* Color preset grid */}
                  <div className="flex flex-wrap gap-3">
                    {PRESET_COLORS.map((color) => {
                      const isSelected = formData.color === color
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, color }))}
                          className={cn(
                            'relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200',
                            isSelected
                              ? 'scale-110'
                              : 'hover:scale-110 active:scale-95',
                          )}
                          style={{
                            backgroundColor: color,
                            boxShadow: isSelected
                              ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${color}, 0 4px 12px ${color}40`
                              : `0 2px 8px ${color}25`,
                          }}
                          title={color}
                        >
                          {isSelected && (
                            <Check className="h-4.5 w-4.5 text-white drop-shadow-md" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom color input row */}
                  <div
                    className="mt-4 flex items-center gap-3 rounded-xl border p-2.5"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                    }}
                  >
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
                      className="input w-24 font-mono text-xs"
                    />
                    <div
                      className="ms-auto h-7 w-7 rounded-lg"
                      style={{
                        backgroundColor: formData.color,
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    />
                  </div>
                </div>

                {/* Actions — separated by divider */}
                <div
                  className="flex items-center justify-end gap-3 border-t pt-6"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <button
                    type="button"
                    onClick={requestModalClose}
                    className="btn-press btn-secondary px-5 py-2.5 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
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
          Archive Confirmation Dialog — Premium Warning
          ================================================================ */}
      {archiveTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${archiveClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cat-archive-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestArchiveClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={archivePanelRef}
            className="modal-panel relative z-10 w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Red accent bar */}
            <div
              className="h-[3px]"
              style={{ backgroundColor: 'var(--color-danger)' }}
            />

            <div className="p-7">
              <div className="mb-6 flex items-center gap-4">
                <div
                  className="warning-pulse flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: 'var(--bg-danger)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <Archive className="h-7 w-7" style={{ color: 'var(--color-expense)' }} />
                </div>
                <div>
                  <h3
                    id="cat-archive-title"
                    className="text-base font-bold tracking-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('common.delete')}
                  </h3>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isRtl ? archiveTarget.name_he : archiveTarget.name}
                  </p>
                </div>
              </div>

              {/* Category info box */}
              <div
                className="mb-6 rounded-xl border px-5 py-4"
                style={{
                  backgroundColor: 'var(--bg-danger-subtle)',
                  borderColor: 'var(--border-danger)',
                }}
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon
                    icon={archiveTarget.icon}
                    color={archiveTarget.color}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {isRtl
                        ? `${archiveTarget.name_he}`
                        : `${archiveTarget.name}`}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {isRtl ? archiveTarget.name : archiveTarget.name_he}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={requestArchiveClose}
                  className="btn-press btn-secondary px-5 py-2.5 text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => archiveMutation.mutate(archiveTarget.id)}
                  disabled={archiveMutation.isPending}
                  className="btn-press inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--color-expense)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
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
