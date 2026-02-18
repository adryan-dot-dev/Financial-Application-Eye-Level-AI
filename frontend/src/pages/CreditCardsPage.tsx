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
  CreditCard as CreditCardIcon,
  Eye,
  DollarSign,
  TrendingUp,
  Wallet,
  Percent,
  CalendarDays,
  Link2,
  StickyNote,
  AlertTriangle,
} from 'lucide-react'
import type { CreditCard, CreditCardCreate } from '@/types'
import { creditCardsApi } from '@/api/credit-cards'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import CurrencySelector from '@/components/CurrencySelector'
import UtilizationBar from '@/components/ui/UtilizationBar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  name: string
  last_four_digits: string
  card_network: string
  issuer: string
  credit_limit: string
  billing_day: string
  currency: string
  color: string
  notes: string
}

const EMPTY_FORM: FormData = {
  name: '',
  last_four_digits: '',
  card_network: 'visa',
  issuer: '',
  credit_limit: '',
  billing_day: '10',
  currency: 'ILS',
  color: '#4318FF',
  notes: '',
}

const CARD_COLORS = [
  '#4318FF', // brand purple
  '#05CD99', // teal
  '#EE5D50', // coral
  '#FFB547', // amber
  '#868CFF', // light purple
  '#6AD2FF', // cyan
  '#2B3674', // navy
  '#A3AED0', // gray
] as const

const CARD_NETWORKS = ['visa', 'mastercard', 'amex', 'isracard', 'diners'] as const

const NETWORK_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'MC',
  amex: 'Amex',
  isracard: 'Isracard',
  diners: 'Diners',
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

function CardGridSkeleton() {
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
            <Skeleton className="h-3 w-full rounded-full" />
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

function NetworkBadge({ network }: { network: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide"
      style={{
        backgroundColor: 'rgba(67, 24, 255, 0.08)',
        color: 'var(--color-brand-500)',
      }}
    >
      {NETWORK_LABELS[network] ?? network}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CreditCardsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { formatAmount } = useCurrency()
  useEffect(() => {
    document.title = t('creditCards.title')
  }, [t])

  // ---- State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CreditCard | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<CreditCard | null>(null)
  const [detailTarget, setDetailTarget] = useState<CreditCard | null>(null)

  // ---- Queries ----
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useQuery({
    queryKey: queryKeys.creditCards.summary(),
    queryFn: () => creditCardsApi.getSummary(),
  })

  const {
    data: cards = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.creditCards.list(),
    queryFn: () => creditCardsApi.list(),
  })

  // Detail modal queries
  const { data: chargesData } = useQuery({
    queryKey: queryKeys.creditCards.charges(detailTarget?.id ?? ''),
    queryFn: () => creditCardsApi.getCharges(detailTarget!.id),
    enabled: !!detailTarget,
  })

  const { data: nextBillingData } = useQuery({
    queryKey: queryKeys.creditCards.nextBilling(detailTarget?.id ?? ''),
    queryFn: () => creditCardsApi.getNextBilling(detailTarget!.id),
    enabled: !!detailTarget,
  })

  // ---- Computed summary ----
  const summary = useMemo(() => {
    if (summaryData) {
      return {
        totalLimits: summaryData.total_credit_limit,
        currentUtilization: summaryData.total_utilization,
        availableCredit: summaryData.total_available,
        avgUtilization: summaryData.average_utilization_pct,
      }
    }
    // Fallback: compute from cards
    const totalLimit = cards.reduce((sum, c) => sum + parseFloat(c.credit_limit || '0'), 0)
    const totalUsed = cards.reduce((sum, c) => sum + parseFloat(c.utilization_amount || '0'), 0)
    const totalAvailable = totalLimit - totalUsed
    const avgPct = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0
    return {
      totalLimits: String(totalLimit),
      currentUtilization: String(totalUsed),
      availableCredit: String(totalAvailable),
      avgUtilization: avgPct,
    }
  }, [summaryData, cards])

  // ---- Mutations ----
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.creditCards.all })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreditCardCreate) => creditCardsApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreditCardCreate> }) =>
      creditCardsApi.update(id, data),
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
    mutationFn: (id: string) => creditCardsApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
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

  const openEditModal = (entry: CreditCard) => {
    setEditingEntry(entry)
    setFormData({
      name: entry.name,
      last_four_digits: entry.last_four_digits,
      card_network: entry.card_network,
      issuer: entry.issuer,
      credit_limit: entry.credit_limit,
      billing_day: String(entry.billing_day),
      currency: entry.currency,
      color: entry.color || '#4318FF',
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
  const closeDetailModal = useCallback(() => setDetailTarget(null), [])

  // Modal accessibility
  const { panelRef: modalPanelRef, closing: modalClosing, requestClose: requestModalClose } = useModalA11y(modalOpen, closeModal)
  const { panelRef: deletePanelRef, closing: deleteClosing, requestClose: requestDeleteClose } = useModalA11y(!!deleteTarget, closeDeleteDialog)
  const { panelRef: detailPanelRef, closing: detailClosing, requestClose: requestDetailClose } = useModalA11y(!!detailTarget, closeDetailModal)

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('validation.required')
    if (!formData.last_four_digits.trim() || !/^\d{4}$/.test(formData.last_four_digits.trim())) {
      errors.last_four_digits = t('creditCards.lastFourInvalid')
    }
    if (!formData.issuer.trim()) errors.issuer = t('validation.required')
    const limit = parseFloat(formData.credit_limit)
    if (!formData.credit_limit || isNaN(limit) || limit <= 0) errors.credit_limit = t('validation.required')
    const day = parseInt(formData.billing_day, 10)
    if (!formData.billing_day || isNaN(day) || day < 1 || day > 28) errors.billing_day = t('validation.required')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: CreditCardCreate = {
      name: formData.name.trim(),
      last_four_digits: formData.last_four_digits.trim(),
      card_network: formData.card_network as CreditCardCreate['card_network'],
      issuer: formData.issuer.trim(),
      credit_limit: parseFloat(formData.credit_limit),
      billing_day: parseInt(formData.billing_day, 10),
      currency: formData.currency || 'ILS',
      color: formData.color || '#4318FF',
      notes: formData.notes || undefined,
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

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
            <CreditCardIcon className="h-6 w-6" style={{ color: 'var(--color-accent-magenta)' }} />
          </div>
          <div>
            <h1
              className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
            >
              {t('creditCards.title')}
            </h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('transactions.total')}:{' '}
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ltr-nums"
                  style={{ backgroundColor: 'rgba(217, 70, 239, 0.1)', color: 'var(--color-accent-magenta)' }}
                >
                  {cards.length}
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
          {t('creditCards.addCard')}
        </button>
      </div>

      {/* ---- Summary cards (4 KPI) ---- */}
      {!isLoading && !isSummaryLoading && cards.length > 0 && (
        <div className="animate-fade-in-up stagger-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total credit limits */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(67, 24, 255, 0.1)' }}
            >
              <Wallet className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('creditCards.totalLimits')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(summary.totalLimits)}
              </p>
            </div>
          </div>

          {/* Current utilization */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(238, 93, 80, 0.1)' }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('creditCards.currentUtilization')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--color-expense)' }}>
                {formatAmount(summary.currentUtilization)}
              </p>
            </div>
          </div>

          {/* Available credit */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)' }}
            >
              <DollarSign className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('creditCards.availableCredit')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--color-success)' }}>
                {formatAmount(summary.availableCredit)}
              </p>
            </div>
          </div>

          {/* Average utilization % */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
            >
              <Percent className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('creditCards.avgUtilization')}
              </p>
              <p className="text-lg font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.avgUtilization.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Cards grid ---- */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : isError ? (
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-16">
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
      ) : cards.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-20">
          <div
            className="empty-float mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background: 'rgba(67, 24, 255, 0.08)',
              border: '1px solid rgba(67, 24, 255, 0.1)',
            }}
          >
            <CreditCardIcon className="h-9 w-9" style={{ color: 'var(--border-focus)' }} />
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
            {t('creditCards.emptyDesc')}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t('creditCards.addCard')}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => {
            const linkedTotal =
              card.linked_subscriptions_count +
              card.linked_installments_count +
              card.linked_fixed_count

            return (
              <div
                key={card.id}
                className="card card-lift row-enter overflow-hidden transition-all duration-300"
                style={{
                  '--row-index': Math.min(index, 15),
                  borderInlineStartWidth: '4px',
                  borderInlineStartColor: card.color || 'var(--color-brand-500)',
                } as CSSProperties}
              >
                <div className="p-5">
                  {/* Card header: name + network badge */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-[15px] font-bold"
                        style={{ color: 'var(--text-primary)' }}
                        title={card.name}
                      >
                        {card.name}
                      </h3>
                      <p
                        className="mt-0.5 text-xs font-medium ltr-nums"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        ****{card.last_four_digits}
                      </p>
                    </div>
                    <NetworkBadge network={card.card_network} />
                  </div>

                  {/* Issuer */}
                  <p
                    className="mb-3 truncate text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                    title={card.issuer}
                  >
                    {card.issuer}
                  </p>

                  {/* Utilization bar */}
                  <UtilizationBar
                    percentage={card.utilization_percentage}
                    used={formatAmount(card.utilization_amount, card.currency)}
                    total={formatAmount(card.credit_limit, card.currency)}
                    size="md"
                    className="mb-3"
                  />

                  {/* Available credit */}
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('creditCards.available')}:
                    </span>
                    <span
                      className="fin-number text-sm font-bold ltr-nums"
                      style={{ color: 'var(--color-success)' }}
                    >
                      {formatAmount(card.available_credit, card.currency)}
                    </span>
                  </div>

                  {/* Details row: billing day + linked items */}
                  <div
                    className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('creditCards.billingDay')}
                      </span>
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 font-bold ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <CalendarDays
                          className="h-3 w-3"
                          style={{ color: 'var(--border-focus)' }}
                        />
                        {card.billing_day}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('creditCards.linkedItems')}
                      </span>
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 font-bold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Link2
                          className="h-3 w-3"
                          style={{ color: 'var(--border-focus)' }}
                        />
                        <span className="ltr-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {card.linked_subscriptions_count} {t('creditCards.subscriptionsShort')}
                          {' · '}
                          {card.linked_installments_count} {t('creditCards.installmentsShort')}
                          {' · '}
                          {card.linked_fixed_count} {t('creditCards.fixedShort')}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {card.notes && (
                    <div className="mb-4 flex items-start gap-1.5">
                      <StickyNote className="mt-0.5 h-3 w-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      <p
                        className="truncate text-xs leading-relaxed"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={card.notes}
                      >
                        {card.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div
                    className="flex items-center justify-between border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    {/* Linked items total */}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        color: linkedTotal > 0 ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                        border: '1px solid currentColor',
                        opacity: 0.8,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: linkedTotal > 0 ? 'var(--color-brand-500)' : 'var(--text-tertiary)',
                        }}
                      />
                      {linkedTotal} {t('creditCards.charges')}
                    </span>

                    {/* View / Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDetailTarget(card)}
                        className="btn-press action-btn rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.view')}
                        aria-label={t('common.view')}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(card)}
                        className="btn-press action-btn action-btn-edit rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(card)}
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
          Modal: Add / Edit Credit Card
          ================================================================== */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-modal-title"
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
              style={{ backgroundColor: formData.color || 'var(--color-accent-magenta)' }}
            />

            <div className="modal-body p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2
                  id="cc-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingEntry ? t('common.edit') : t('creditCards.addCard')}
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

              <form id="credit-card-form" onSubmit={handleFormSubmit} className="space-y-5">
                {/* Name */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('creditCards.cardName')} *
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
                    placeholder={t('creditCards.namePlaceholder')}
                    aria-describedby={formErrors.name ? 'cc-name-error' : undefined}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p id="cc-name-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Last 4 digits + Network row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('creditCards.lastFour')} *
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formData.last_four_digits}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                        setFormData((prev) => ({ ...prev, last_four_digits: val }))
                      }}
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.last_four_digits ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="1234"
                      aria-describedby={formErrors.last_four_digits ? 'cc-digits-error' : undefined}
                      aria-invalid={!!formErrors.last_four_digits}
                    />
                    {formErrors.last_four_digits && (
                      <p id="cc-digits-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.last_four_digits}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('creditCards.network')} *
                    </label>
                    <select
                      value={formData.card_network}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, card_network: e.target.value }))
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
                      {CARD_NETWORKS.map((net) => (
                        <option key={net} value={net}>
                          {NETWORK_LABELS[net]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Issuer */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('creditCards.issuer')} *
                  </label>
                  <input
                    type="text"
                    value={formData.issuer}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, issuer: e.target.value }))
                    }
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.issuer ? 'var(--border-danger)' : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder={t('creditCards.issuerPlaceholder')}
                    aria-describedby={formErrors.issuer ? 'cc-issuer-error' : undefined}
                    aria-invalid={!!formErrors.issuer}
                  />
                  {formErrors.issuer && (
                    <p id="cc-issuer-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.issuer}
                    </p>
                  )}
                </div>

                {/* Credit limit + Billing day row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('creditCards.creditLimit')} *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.credit_limit}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, credit_limit: e.target.value }))
                      }
                      className={cn(
                        'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.credit_limit ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="10000"
                      aria-describedby={formErrors.credit_limit ? 'cc-limit-error' : undefined}
                      aria-invalid={!!formErrors.credit_limit}
                    />
                    {formErrors.credit_limit && (
                      <p id="cc-limit-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.credit_limit}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('creditCards.billingDay')} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={formData.billing_day}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, billing_day: e.target.value }))
                      }
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.billing_day ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="10"
                      aria-describedby={formErrors.billing_day ? 'cc-billing-error' : undefined}
                      aria-invalid={!!formErrors.billing_day}
                    />
                    {formErrors.billing_day && (
                      <p id="cc-billing-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.billing_day}
                      </p>
                    )}
                  </div>
                </div>

                {/* Currency */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('creditCards.currency')}
                  </label>
                  <CurrencySelector
                    value={formData.currency}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, currency: val }))
                    }
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                  />
                </div>

                {/* Color picker */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('creditCards.color')}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {CARD_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, color }))}
                        className={cn(
                          'h-8 w-8 rounded-full border-2 transition-all hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
                        )}
                        style={{
                          backgroundColor: color,
                          borderColor: formData.color === color ? 'var(--text-primary)' : 'transparent',
                          boxShadow: formData.color === color ? '0 0 0 2px var(--bg-card), 0 0 0 4px ' + color : undefined,
                        }}
                        aria-label={color}
                        aria-pressed={formData.color === color}
                      />
                    ))}
                  </div>
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
                  const form = document.getElementById('credit-card-form') as HTMLFormElement
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
          Modal: Card Detail (View)
          ================================================================== */}
      {detailTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${detailClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cc-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestDetailClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={detailPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border p-0"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Colored accent bar using card color */}
            <div
              className="h-1"
              style={{ backgroundColor: detailTarget.color || 'var(--color-accent-magenta)' }}
            />

            <div className="p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2
                    id="cc-detail-title"
                    className="text-lg font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {detailTarget.name}
                  </h2>
                  <NetworkBadge network={detailTarget.card_network} />
                </div>
                <button
                  onClick={requestDetailClose}
                  className="rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Card info */}
              <div
                className="mb-4 flex flex-wrap items-center gap-4 text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="ltr-nums">****{detailTarget.last_four_digits}</span>
                <span>{detailTarget.issuer}</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" style={{ color: 'var(--border-focus)' }} />
                  {t('creditCards.billingDay')}: {detailTarget.billing_day}
                </span>
              </div>

              {/* Large utilization bar */}
              <UtilizationBar
                percentage={detailTarget.utilization_percentage}
                used={formatAmount(detailTarget.utilization_amount, detailTarget.currency)}
                total={formatAmount(detailTarget.credit_limit, detailTarget.currency)}
                size="lg"
                className="mb-6"
              />

              {/* Charges grouped by type */}
              {chargesData && (
                <div className="mb-6 space-y-4">
                  {/* Subscriptions */}
                  {chargesData.subscriptions.length > 0 && (
                    <div>
                      <h4
                        className="mb-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {t('creditCards.chargeSubscriptions')} ({chargesData.subscriptions.length})
                      </h4>
                      <div className="space-y-1.5">
                        {chargesData.subscriptions.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            <span
                              className="truncate text-sm font-medium"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {sub.name}
                            </span>
                            <span
                              className="fin-number text-sm font-bold ltr-nums"
                              style={{ color: 'var(--color-expense)' }}
                            >
                              {formatAmount(sub.amount, sub.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Installments */}
                  {chargesData.installments.length > 0 && (
                    <div>
                      <h4
                        className="mb-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {t('creditCards.chargeInstallments')} ({chargesData.installments.length})
                      </h4>
                      <div className="space-y-1.5">
                        {chargesData.installments.map((inst) => (
                          <div
                            key={inst.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <span
                                className="truncate text-sm font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {inst.name}
                              </span>
                              <span
                                className="ms-2 text-xs ltr-nums"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                ({inst.payments_completed}/{inst.total_payments})
                              </span>
                            </div>
                            <span
                              className="fin-number text-sm font-bold ltr-nums"
                              style={{ color: 'var(--color-expense)' }}
                            >
                              {formatAmount(inst.monthly_amount, inst.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fixed charges */}
                  {chargesData.fixed.length > 0 && (
                    <div>
                      <h4
                        className="mb-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {t('creditCards.chargeFixed')} ({chargesData.fixed.length})
                      </h4>
                      <div className="space-y-1.5">
                        {chargesData.fixed.map((fix) => (
                          <div
                            key={fix.id}
                            className="flex items-center justify-between rounded-lg px-3 py-2"
                            style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            <span
                              className="truncate text-sm font-medium"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {fix.name}
                            </span>
                            <span
                              className="fin-number text-sm font-bold ltr-nums"
                              style={{ color: 'var(--color-expense)' }}
                            >
                              {formatAmount(fix.amount, fix.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty charges state */}
                  {chargesData.subscriptions.length === 0 &&
                   chargesData.installments.length === 0 &&
                   chargesData.fixed.length === 0 && (
                    <p
                      className="text-center text-sm"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('creditCards.noCharges')}
                    </p>
                  )}
                </div>
              )}

              {/* Next billing summary */}
              {nextBillingData && (
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                >
                  <h4
                    className="mb-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('creditCards.nextBilling')}
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {t('creditCards.totalExpected')}
                      </p>
                      <p
                        className="fin-number text-lg font-bold ltr-nums"
                        style={{ color: 'var(--color-expense)' }}
                      >
                        {formatAmount(nextBillingData.total_expected, detailTarget.currency)}
                      </p>
                    </div>
                    <div className="text-end">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {t('creditCards.availableAfterBilling')}
                      </p>
                      <p
                        className="fin-number text-lg font-bold ltr-nums"
                        style={{ color: 'var(--color-success)' }}
                      >
                        {formatAmount(nextBillingData.available_after_billing, detailTarget.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Close button at bottom */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={requestDetailClose}
                  className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-input)',
                  }}
                >
                  {t('common.close')}
                </button>
              </div>
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
          aria-labelledby="cc-delete-title"
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
                  id="cc-delete-title"
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
                    &ldquo;{deleteTarget.name}&rdquo; (****{deleteTarget.last_four_digits})
                  </p>
                )}
                <p
                  className="mt-2 text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('creditCards.creditLimit')}: {formatAmount(deleteTarget.credit_limit, deleteTarget.currency)}
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
