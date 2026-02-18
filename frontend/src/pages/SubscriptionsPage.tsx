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
  Pause,
  Play,
  RefreshCw,
  CalendarDays,
  DollarSign,
  Globe,
  ExternalLink,
  StickyNote,
} from 'lucide-react'
import type { Subscription, Category } from '@/types'
import { subscriptionsApi } from '@/api/subscriptions'
import type { CreateSubscriptionData } from '@/api/subscriptions'
import { categoriesApi } from '@/api/categories'
import { cn, formatDate } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { CategoryBadge as SharedCategoryBadge } from '@/components/ui/CategoryIcon'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import DatePicker from '@/components/ui/DatePicker'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'active' | 'paused'
type CycleFilter = '' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual'

interface FormData {
  name: string
  amount: string
  currency: string
  category_id: string
  billing_cycle: string
  next_renewal_date: string
  last_renewal_date: string
  auto_renew: boolean
  provider: string
  provider_url: string
  notes: string
}

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: FormData = {
  name: '',
  amount: '',
  currency: 'ILS',
  category_id: '',
  billing_cycle: 'monthly',
  next_renewal_date: today(),
  last_renewal_date: '',
  auto_renew: true,
  provider: '',
  provider_url: '',
  notes: '',
}

const BILLING_CYCLES = ['monthly', 'quarterly', 'semi_annual', 'annual'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any subscription amount to a monthly equivalent for summation */
function toMonthlyAmount(amount: string | number, cycle: string): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return 0
  switch (cycle) {
    case 'monthly': return num
    case 'quarterly': return num / 3
    case 'semi_annual': return num / 6
    case 'annual': return num / 12
    default: return num
  }
}

/** Check if a date is within the next N days */
function isWithinDays(dateStr: string, days: number): boolean {
  const target = new Date(dateStr)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
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

export default function SubscriptionsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { formatAmount } = useCurrency()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.subscriptions')
  }, [t])

  // ---- State ----
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [cycleFilter, setCycleFilter] = useState<CycleFilter>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Subscription | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null)

  // ---- Queries ----
  const listParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (statusFilter !== 'all') p.status = statusFilter
    if (cycleFilter) p.billing_cycle = cycleFilter
    return Object.keys(p).length > 0 ? p : undefined
  }, [statusFilter, cycleFilter])

  const {
    data: subscriptions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.subscriptions.list(listParams),
    queryFn: () => subscriptionsApi.list(listParams as Record<string, string> | undefined),
  })

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: () => categoriesApi.list(),
  })

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // ---- Computed summary ----
  const summary = useMemo(() => {
    // Use all subscriptions (not filtered) for summary
    const allSubs = subscriptions
    const activeSubs = allSubs.filter((s) => s.is_active)
    const totalMonthly = activeSubs.reduce(
      (sum, s) => sum + toMonthlyAmount(s.amount, s.billing_cycle),
      0,
    )
    const upcomingCount = activeSubs.filter(
      (s) => s.next_renewal_date && isWithinDays(s.next_renewal_date, 30),
    ).length

    return {
      activeCount: activeSubs.length,
      totalMonthly,
      upcomingCount,
    }
  }, [subscriptions])

  // ---- Mutations ----
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all })

  const createMutation = useMutation({
    mutationFn: (data: CreateSubscriptionData) => subscriptionsApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSubscriptionData> }) =>
      subscriptionsApi.update(id, data),
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
    mutationFn: (id: string) => subscriptionsApi.delete(id),
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
    mutationFn: (id: string) => subscriptionsApi.pause(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('toast.pauseSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const resumeMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.resume(id),
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
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (entry: Subscription) => {
    setEditingEntry(entry)
    setFormData({
      name: entry.name,
      amount: entry.amount,
      currency: entry.currency,
      category_id: entry.category_id ?? '',
      billing_cycle: entry.billing_cycle,
      next_renewal_date: entry.next_renewal_date,
      last_renewal_date: entry.last_renewal_date ?? '',
      auto_renew: entry.auto_renew,
      provider: entry.provider ?? '',
      provider_url: entry.provider_url ?? '',
      notes: entry.notes ?? '',
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

  // Modal accessibility
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)
  const { panelRef: deletePanelRef, closing: deleteClosing, requestClose: requestDeleteClose } = useModalA11y(!!deleteTarget, closeDeleteDialog)

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.error')
    const amt = parseFloat(formData.amount)
    if (!formData.amount || isNaN(amt) || amt <= 0) errors.amount = t('common.error')
    if (!formData.billing_cycle) errors.billing_cycle = t('common.error')
    if (!formData.next_renewal_date) errors.next_renewal_date = t('common.error')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreateSubscriptionData = {
      name: formData.name.trim(),
      amount: parseFloat(formData.amount),
      currency: formData.currency || 'ILS',
      category_id: formData.category_id || undefined,
      billing_cycle: formData.billing_cycle,
      next_renewal_date: formData.next_renewal_date,
      last_renewal_date: formData.last_renewal_date || undefined,
      auto_renew: formData.auto_renew,
      provider: formData.provider || undefined,
      provider_url: formData.provider_url || undefined,
      notes: formData.notes || undefined,
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Categories for the form (expense type for subscriptions)
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
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: 'rgba(67, 24, 255, 0.08)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <RefreshCw className="h-6 w-6" style={{ color: 'var(--color-accent-magenta)' }} />
          </div>
          <div>
            <h1
              className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
            >
              {t('subscriptions.title')}
            </h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('transactions.total')}:{' '}
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ltr-nums"
                  style={{ backgroundColor: 'rgba(217, 70, 239, 0.1)', color: 'var(--color-accent-magenta)' }}
                >
                  {subscriptions.length}
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
          {t('subscriptions.add')}
        </button>
      </div>

      {/* ---- Summary cards ---- */}
      {!isLoading && subscriptions.length > 0 && (
        <div className="animate-fade-in-up stagger-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Total monthly cost */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(238, 93, 80, 0.1)' }}
            >
              <DollarSign className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('subscriptions.totalMonthly')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--color-expense)' }}>
                {formatAmount(summary.totalMonthly)}
              </p>
            </div>
          </div>

          {/* Active count */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)' }}
            >
              <RefreshCw className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('subscriptions.activeCount')}
              </p>
              <p className="text-lg font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.activeCount}
              </p>
            </div>
          </div>

          {/* Upcoming renewals */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
            >
              <CalendarDays className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('subscriptions.upcomingRenewals')}
              </p>
              <p className="text-lg font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.upcomingCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Filter tabs ---- */}
      {!isLoading && (
        <div className="animate-fade-in-up stagger-2 card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Status filter */}
            <fieldset>
              <legend className="sr-only">{t('subscriptions.status')}</legend>
              <div
                className="flex overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                {(['all', 'active', 'paused'] as StatusFilter[]).map((val) => {
                  const active = statusFilter === val
                  const label =
                    val === 'all'
                      ? t('transactions.all')
                      : val === 'active'
                        ? t('fixed.active')
                        : t('fixed.paused')
                  return (
                    <button
                      key={val}
                      onClick={() => setStatusFilter(val)}
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

            {/* Billing cycle filter */}
            <div className="flex items-center gap-2">
              <label
                className="text-xs font-semibold"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('subscriptions.billingCycle')}:
              </label>
              <select
                value={cycleFilter}
                onChange={(e) => setCycleFilter(e.target.value as CycleFilter)}
                className="rounded-xl border px-3 py-2 text-xs outline-none transition-all focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">{t('transactions.all')}</option>
                {BILLING_CYCLES.map((cycle) => (
                  <option key={cycle} value={cycle}>
                    {t(`subscriptions.cycle_${cycle}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ---- Cards grid ---- */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-16">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-danger)' }}
          >
            <RefreshCw className="h-6 w-6" style={{ color: 'var(--color-expense)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
            {t('common.error')}
          </p>
        </div>
      ) : subscriptions.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-20">
          <div
            className="empty-float mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background: 'rgba(67, 24, 255, 0.08)',
              border: '1px solid rgba(67, 24, 255, 0.1)',
            }}
          >
            <RefreshCw className="h-9 w-9" style={{ color: 'var(--border-focus)' }} />
          </div>
          <h3
            className="mb-2 text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {statusFilter !== 'all'
              ? t('subscriptions.noFilteredResults', { filter: t(`subscriptions.${statusFilter}`) })
              : t('common.noData')}
          </h3>
          <p
            className="mb-8 max-w-sm text-center text-sm leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {statusFilter !== 'all'
              ? t('subscriptions.noFilteredDesc', { filter: t(`subscriptions.${statusFilter}`) })
              : t('subscriptions.emptyDesc')}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={openCreateModal}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              {t('subscriptions.add')}
            </button>
          )}
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub, index) => {
            const cat = sub.category_id ? categoryMap.get(sub.category_id) : undefined
            const renewingSoon = sub.next_renewal_date && isWithinDays(sub.next_renewal_date, 7)

            return (
              <div
                key={sub.id}
                className="card card-lift row-enter overflow-hidden transition-all duration-300"
                style={{
                  '--row-index': Math.min(index, 15),
                  borderInlineStartWidth: '4px',
                  borderInlineStartColor: sub.is_active ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                } as CSSProperties}
              >
                <div className="p-5">
                  {/* Card header: name + toggle switch */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-[15px] font-bold"
                        style={{ color: 'var(--text-primary)' }}
                        title={sub.name}
                      >
                        {sub.name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {cat && <CategoryBadge category={cat} isRtl={isRtl} />}
                        {/* Billing cycle badge */}
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: 'rgba(67, 24, 255, 0.08)',
                            color: 'var(--color-brand-500)',
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t(`subscriptions.cycle_${sub.billing_cycle}`)}
                        </span>
                      </div>
                    </div>

                    {/* Animated toggle switch for active/paused */}
                    <button
                      onClick={() =>
                        sub.is_active
                          ? pauseMutation.mutate(sub.id)
                          : resumeMutation.mutate(sub.id)
                      }
                      disabled={pauseMutation.isPending || resumeMutation.isPending}
                      className="relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                      style={{
                        backgroundColor: sub.is_active ? 'var(--color-success)' : 'var(--bg-hover)',
                      }}
                      role="switch"
                      aria-checked={sub.is_active}
                      aria-label={sub.is_active ? t('fixed.pause') : t('fixed.resume')}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300"
                        style={{
                          transform: sub.is_active
                            ? (isRtl ? 'translateX(-20px)' : 'translateX(20px)')
                            : 'translateX(0)',
                        }}
                      >
                        {(pauseMutation.isPending || resumeMutation.isPending) ? (
                          <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                        ) : sub.is_active ? (
                          <Play className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <Pause className="h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Amount */}
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: 'rgba(238, 93, 80, 0.12)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <DollarSign className="h-4 w-4" />
                    </span>
                    <p
                      className="fin-number text-2xl ltr-nums"
                      style={{ color: 'var(--color-expense)' }}
                    >
                      {formatAmount(sub.amount, sub.currency)}
                    </p>
                  </div>

                  {/* Provider */}
                  {sub.provider && (
                    <div className="mb-3 flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      <span
                        className="truncate text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                        title={sub.provider}
                      >
                        {sub.provider}
                      </span>
                      {sub.provider_url && (
                        <a
                          href={sub.provider_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 transition-colors hover:opacity-70"
                          title={sub.provider_url}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" style={{ color: 'var(--color-brand-500)' }} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Next renewal + details */}
                  <div
                    className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {/* Next renewal */}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('subscriptions.nextRenewal')}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 inline-flex items-center gap-1 font-bold ltr-nums',
                        )}
                        style={{
                          color: renewingSoon ? 'var(--color-warning)' : 'var(--text-primary)',
                        }}
                      >
                        <CalendarDays
                          className="h-3 w-3"
                          style={{ color: renewingSoon ? 'var(--color-warning)' : 'var(--border-focus)' }}
                        />
                        {formatDate(sub.next_renewal_date, isRtl ? 'he-IL' : 'en-US')}
                      </span>
                    </div>

                    {/* Auto-renew */}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('subscriptions.autoRenew')}
                      </span>
                      <span className="mt-0.5 font-bold" style={{ color: 'var(--text-primary)' }}>
                        {sub.auto_renew ? t('subscriptions.yes') : t('subscriptions.no')}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {sub.notes && (
                    <div className="mb-4 flex items-start gap-1.5">
                      <StickyNote className="mt-0.5 h-3 w-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      <p
                        className="truncate text-xs leading-relaxed"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={sub.notes}
                      >
                        {sub.notes}
                      </p>
                    </div>
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
                        color: sub.is_active ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                        border: '1px solid currentColor',
                        opacity: 0.8,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: sub.is_active ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                        }}
                      />
                      {sub.is_active ? t('fixed.active') : t('fixed.paused')}
                    </span>

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="btn-press action-btn action-btn-edit rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(sub)}
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
          Modal: Add / Edit Subscription
          ================================================================== */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sub-modal-title"
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
              style={{ backgroundColor: 'var(--color-accent-magenta)' }}
            />

            <div className="modal-body p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2
                  id="sub-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingEntry ? t('common.edit') : t('subscriptions.add')}
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

              <form id="subscription-form" onSubmit={handleFormSubmit} className="space-y-5">
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
                    placeholder={t('subscriptions.namePlaceholder')}
                    aria-describedby={formErrors.name ? 'sub-name-error' : undefined}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p id="sub-name-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Amount + Billing Cycle row */}
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
                        color: 'var(--color-expense)',
                      }}
                      placeholder="0.00"
                      aria-describedby={formErrors.amount ? 'sub-amount-error' : undefined}
                      aria-invalid={!!formErrors.amount}
                    />
                    {formErrors.amount && (
                      <p id="sub-amount-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.amount}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('subscriptions.billingCycle')} *
                    </label>
                    <select
                      value={formData.billing_cycle}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, billing_cycle: e.target.value }))
                      }
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                              )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.billing_cycle ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      aria-describedby={formErrors.billing_cycle ? 'sub-cycle-error' : undefined}
                      aria-invalid={!!formErrors.billing_cycle}
                    >
                      {BILLING_CYCLES.map((cycle) => (
                        <option key={cycle} value={cycle}>
                          {t(`subscriptions.cycle_${cycle}`)}
                        </option>
                      ))}
                    </select>
                    {formErrors.billing_cycle && (
                      <p id="sub-cycle-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.billing_cycle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Next renewal date */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('subscriptions.nextRenewal')} *
                  </label>
                  <DatePicker
                    value={formData.next_renewal_date}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, next_renewal_date: val }))
                    }
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                                          )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.next_renewal_date ? 'var(--border-danger)' : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    aria-describedby={formErrors.next_renewal_date ? 'sub-date-error' : undefined}
                    aria-invalid={!!formErrors.next_renewal_date}
                  />
                  {formErrors.next_renewal_date && (
                    <p id="sub-date-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.next_renewal_date}
                    </p>
                  )}
                </div>

                {/* Provider + Provider URL */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('subscriptions.provider')}
                    </label>
                    <input
                      type="text"
                      value={formData.provider}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, provider: e.target.value }))
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
                      placeholder={t('subscriptions.providerPlaceholder')}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('subscriptions.providerUrl')}
                    </label>
                    <input
                      type="url"
                      value={formData.provider_url}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, provider_url: e.target.value }))
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
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Auto-renew toggle */}
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('subscriptions.autoRenew')}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, auto_renew: !prev.auto_renew }))
                    }
                    className="relative flex h-7 w-12 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                    style={{
                      backgroundColor: formData.auto_renew ? 'var(--color-success)' : 'var(--bg-hover)',
                    }}
                    role="switch"
                    aria-checked={formData.auto_renew}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300"
                      style={{
                        transform: formData.auto_renew
                          ? (isRtl ? 'translateX(-20px)' : 'translateX(20px)')
                          : 'translateX(0)',
                      }}
                    />
                  </button>
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
                    placeholder={t('transactions.notes')}
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
                  const form = document.getElementById('subscription-form') as HTMLFormElement
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
          aria-labelledby="sub-delete-title"
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
                  id="sub-delete-title"
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
                  style={{ color: 'var(--color-expense)' }}
                >
                  {formatAmount(deleteTarget.amount, deleteTarget.currency)}
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
