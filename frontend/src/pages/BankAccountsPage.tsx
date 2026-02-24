import { useState, useMemo, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModalA11y } from '@/hooks/useModalA11y'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Landmark,
  Shield,
  Star,
  Link2,
  StickyNote,
  AlertTriangle,
  Wallet,
} from 'lucide-react'
import type { BankAccount, BankAccountCreate } from '@/types'
import { bankAccountsApi } from '@/api/bank-accounts'
import { balanceApi } from '@/api/balance'
import type { CreateBalanceData } from '@/api/balance'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import CurrencySelector from '@/components/CurrencySelector'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  name: string
  bank_name: string
  account_last_digits: string
  overdraft_limit: string
  currency: string
  is_primary: boolean
  notes: string
}

const EMPTY_FORM: FormData = {
  name: '',
  bank_name: '',
  account_last_digits: '',
  overdraft_limit: '',
  currency: 'ILS',
  is_primary: false,
  notes: '',
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
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PrimaryBadge({ t }: { t: (key: string) => string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide"
      style={{
        backgroundColor: 'rgba(5, 205, 153, 0.1)',
        color: 'var(--color-success)',
      }}
    >
      <Star className="h-3 w-3" />
      {t('bankAccounts.primary')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BankAccountsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { formatAmount } = useCurrency()
  useEffect(() => {
    document.title = t('bankAccounts.title')
  }, [t])

  // ---- State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<BankAccount | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null)
  const [balanceTarget, setBalanceTarget] = useState<BankAccount | null>(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0])

  // ---- Queries ----
  const {
    data: accounts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.bankAccounts.list(),
    queryFn: () => bankAccountsApi.list(),
  })

  // ---- Computed summary ----
  const summary = useMemo(() => {
    const totalOverdraft = accounts.reduce(
      (sum, a) => sum + parseFloat(a.overdraft_limit || '0'),
      0,
    )
    const primaryAccount = accounts.find((a) => a.is_primary)
    return {
      totalAccounts: accounts.length,
      totalOverdraft,
      primaryName: primaryAccount?.name ?? null,
    }
  }, [accounts])

  // ---- Mutations ----
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.bankAccounts.all })
  }

  const createMutation = useMutation({
    mutationFn: (data: BankAccountCreate) => bankAccountsApi.create(data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<BankAccountCreate> }) =>
      bankAccountsApi.update(id, data),
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
    mutationFn: (id: string) => bankAccountsApi.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const balanceMutation = useMutation({
    mutationFn: async (data: CreateBalanceData) => {
      try {
        return await balanceApi.create(data)
      } catch (error: unknown) {
        // If "resource already exists" (409 conflict), fall back to update
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } }
          if (axiosError.response?.status === 409) {
            return await balanceApi.update(data)
          }
        }
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.balance.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.bankAccounts.all })
      closeBalanceModal()
      toast.success(t('bankAccounts.balanceSaved'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  // ---- Modal helpers ----
  const openBalanceModal = (account: BankAccount) => {
    setBalanceTarget(account)
    setBalanceAmount(account.current_balance || '')
    setBalanceDate(new Date().toISOString().split('T')[0])
  }

  const closeBalanceModal = useCallback(() => {
    setBalanceTarget(null)
    setBalanceAmount('')
    setBalanceDate(new Date().toISOString().split('T')[0])
  }, [])

  const handleBalanceSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!balanceTarget) return
    const amt = parseFloat(balanceAmount)
    if (isNaN(amt)) return

    balanceMutation.mutate({
      balance: amt,
      effective_date: balanceDate,
      bank_account_id: balanceTarget.id,
    })
  }

  const openCreateModal = () => {
    setEditingEntry(null)
    setFormData(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEditModal = (entry: BankAccount) => {
    setEditingEntry(entry)
    setFormData({
      name: entry.name,
      bank_name: entry.bank_name,
      account_last_digits: entry.account_last_digits ?? '',
      overdraft_limit: entry.overdraft_limit,
      currency: entry.currency,
      is_primary: entry.is_primary,
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
  const { panelRef: balancePanelRef, closing: balanceClosing, requestClose: requestBalanceClose } = useModalA11y(!!balanceTarget, closeBalanceModal)

  // ---- Form validation & submit ----
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.error')
    if (!formData.bank_name.trim()) errors.bank_name = t('common.error')
    if (formData.account_last_digits && !/^\d{1,4}$/.test(formData.account_last_digits.trim())) {
      errors.account_last_digits = t('common.error')
    }
    const limit = parseFloat(formData.overdraft_limit)
    if (!formData.overdraft_limit || isNaN(limit) || limit < 0) errors.overdraft_limit = t('common.error')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: BankAccountCreate = {
      name: formData.name.trim(),
      bank_name: formData.bank_name.trim(),
      account_last_digits: formData.account_last_digits.trim() || undefined,
      overdraft_limit: parseFloat(formData.overdraft_limit),
      currency: formData.currency || 'ILS',
      is_primary: formData.is_primary,
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
            <Landmark className="h-6 w-6" style={{ color: 'var(--color-accent-magenta)' }} />
          </div>
          <div>
            <h1
              className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
            >
              {t('bankAccounts.title')}
            </h1>
            {!isLoading && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('transactions.total')}:{' '}
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ltr-nums"
                  style={{ backgroundColor: 'rgba(217, 70, 239, 0.1)', color: 'var(--color-accent-magenta)' }}
                >
                  {accounts.length}
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
          {t('bankAccounts.addAccount')}
        </button>
      </div>

      {/* ---- Summary cards (3 KPI) ---- */}
      {!isLoading && accounts.length > 0 && (
        <div className="animate-fade-in-up stagger-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Total accounts */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(67, 24, 255, 0.1)' }}
            >
              <Landmark className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('bankAccounts.title')}
              </p>
              <p className="text-lg font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {summary.totalAccounts}
              </p>
            </div>
          </div>

          {/* Total overdraft limit */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(238, 93, 80, 0.1)' }}
            >
              <Shield className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('bankAccounts.overdraftLimit')}
              </p>
              <p className="fin-number text-lg ltr-nums" style={{ color: 'var(--text-primary)' }}>
                {formatAmount(String(summary.totalOverdraft))}
              </p>
            </div>
          </div>

          {/* Primary account */}
          <div className="card flex items-center gap-3 p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)' }}
            >
              <Star className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t('bankAccounts.primary')}
              </p>
              <p className="truncate text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                {summary.primaryName ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Accounts grid ---- */}
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
      ) : accounts.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="animate-fade-in-up stagger-3 card flex flex-col items-center justify-center px-6 py-20">
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
            {t('bankAccounts.noAccounts')}
          </h3>
          <p
            className="mb-8 max-w-sm text-center text-sm leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('bankAccounts.noAccountsDesc')}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {t('bankAccounts.addAccount')}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, index) => {
            const balance = parseFloat(account.current_balance || '0')
            const overdraft = parseFloat(account.overdraft_limit || '0')
            const available = balance + overdraft

            return (
              <div
                key={account.id}
                className="card card-lift row-enter overflow-hidden transition-all duration-300"
                style={{
                  '--row-index': Math.min(index, 15),
                  borderInlineStartWidth: '4px',
                  borderInlineStartColor: account.is_primary ? 'var(--color-success)' : 'var(--color-brand-500)',
                } as React.CSSProperties}
              >
                <div className="p-5">
                  {/* Account header: name + primary badge */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-[15px] font-bold"
                        style={{ color: 'var(--text-primary)' }}
                        title={account.name}
                      >
                        {account.name}
                      </h3>
                      {account.account_last_digits && (
                        <p
                          className="mt-0.5 text-xs font-medium ltr-nums"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          ****{account.account_last_digits}
                        </p>
                      )}
                    </div>
                    {account.is_primary && <PrimaryBadge t={t} />}
                  </div>

                  {/* Bank name */}
                  <p
                    className="mb-3 inline-flex items-center gap-1.5 truncate text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                    title={account.bank_name}
                  >
                    <Landmark className="h-3 w-3 shrink-0" style={{ color: 'var(--border-focus)' }} />
                    {account.bank_name}
                  </p>

                  {/* Balance details */}
                  <div
                    className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('bankAccounts.currentBalance')}
                      </span>
                      <span
                        className="mt-0.5 fin-number font-bold ltr-nums"
                        style={{ color: balance >= 0 ? 'var(--color-success)' : 'var(--color-expense)' }}
                      >
                        {formatAmount(account.current_balance || '0', account.currency)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {t('bankAccounts.overdraftLimit')}
                      </span>
                      <span
                        className="mt-0.5 fin-number font-bold ltr-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatAmount(account.overdraft_limit, account.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Available balance */}
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('bankAccounts.availableBalance')}:
                    </span>
                    <span
                      className="fin-number text-sm font-bold ltr-nums"
                      style={{ color: 'var(--color-success)' }}
                    >
                      {formatAmount(
                        account.available_balance ?? String(available),
                        account.currency,
                      )}
                    </span>
                  </div>

                  {/* Linked loans */}
                  {(account.linked_loans_count ?? 0) > 0 && (
                    <div className="mb-3 flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 shrink-0" style={{ color: 'var(--border-focus)' }} />
                      <span
                        className="text-xs font-medium ltr-nums"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {account.linked_loans_count} {t('bankAccounts.linkedLoans')}
                      </span>
                    </div>
                  )}

                  {/* Notes */}
                  {account.notes && (
                    <div className="mb-4 flex items-start gap-1.5">
                      <StickyNote className="mt-0.5 h-3 w-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      <p
                        className="truncate text-xs leading-relaxed"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={account.notes}
                      >
                        {account.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div
                    className="flex items-center justify-end gap-1 border-t pt-3"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    <button
                      onClick={() => openBalanceModal(account)}
                      className="btn-press action-btn rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                      style={{ color: 'var(--color-brand-500)' }}
                      title={t('bankAccounts.updateBalance')}
                      aria-label={t('bankAccounts.updateBalance')}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(account)}
                      className="btn-press action-btn action-btn-edit rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
                      style={{ color: 'var(--text-tertiary)' }}
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(account)}
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
            )
          })}
        </div>
      )}

      {/* ==================================================================
          Modal: Add / Edit Bank Account
          ================================================================== */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ba-modal-title"
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
            {/* Accent bar */}
            <div
              className="h-1"
              style={{ backgroundColor: 'var(--color-accent-magenta)' }}
            />

            <div className="modal-body p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h2
                  id="ba-modal-title"
                  className="text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {editingEntry ? t('bankAccounts.editAccount') : t('bankAccounts.addAccount')}
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

              <form id="bank-account-form" onSubmit={handleFormSubmit} className="space-y-5">
                {/* Account name */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('bankAccounts.accountName')} *
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
                    placeholder={t('bankAccounts.accountNamePlaceholder')}
                    aria-describedby={formErrors.name ? 'ba-name-error' : undefined}
                    aria-invalid={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p id="ba-name-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Bank name + Last digits row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('bankAccounts.bankName')} *
                    </label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, bank_name: e.target.value }))
                      }
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.bank_name ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder={t('bankAccounts.bankNamePlaceholder')}
                      aria-describedby={formErrors.bank_name ? 'ba-bank-error' : undefined}
                      aria-invalid={!!formErrors.bank_name}
                    />
                    {formErrors.bank_name && (
                      <p id="ba-bank-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.bank_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('bankAccounts.accountLastDigits')}
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formData.account_last_digits}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                        setFormData((prev) => ({ ...prev, account_last_digits: val }))
                      }}
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-sm outline-none ltr-nums transition-all',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: formErrors.account_last_digits ? 'var(--border-danger)' : 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="1234"
                      aria-describedby={formErrors.account_last_digits ? 'ba-digits-error' : undefined}
                      aria-invalid={!!formErrors.account_last_digits}
                    />
                    {formErrors.account_last_digits && (
                      <p id="ba-digits-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                        {formErrors.account_last_digits}
                      </p>
                    )}
                  </div>
                </div>

                {/* Overdraft limit */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('bankAccounts.overdraftLimit')} *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.overdraft_limit}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, overdraft_limit: e.target.value }))
                    }
                    className={cn(
                      'amount-input w-full rounded-xl border px-4 py-3 outline-none ltr-nums transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: formErrors.overdraft_limit ? 'var(--border-danger)' : 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="5000"
                    aria-describedby={formErrors.overdraft_limit ? 'ba-overdraft-error' : undefined}
                    aria-invalid={!!formErrors.overdraft_limit}
                  />
                  {formErrors.overdraft_limit && (
                    <p id="ba-overdraft-error" role="alert" className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-expense)' }}>
                      {formErrors.overdraft_limit}
                    </p>
                  )}
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

                {/* Is primary toggle */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.is_primary}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, is_primary: !prev.is_primary }))
                    }
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
                    )}
                    style={{
                      backgroundColor: formData.is_primary ? 'var(--color-success)' : 'var(--bg-tertiary)',
                    }}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                        formData.is_primary ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                  <label
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('bankAccounts.primary')}
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('bankAccounts.notes')}
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
                    placeholder={t('bankAccounts.notes')}
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
                  const form = document.getElementById('bank-account-form') as HTMLFormElement
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
          aria-labelledby="ba-delete-title"
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
                  id="ba-delete-title"
                  className="mb-2 text-lg font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('bankAccounts.deleteConfirmTitle')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t('bankAccounts.deleteConfirmMessage')}
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
                    {deleteTarget.account_last_digits && (
                      <span className="ltr-nums"> (****{deleteTarget.account_last_digits})</span>
                    )}
                  </p>
                )}
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

      {/* ==================================================================
          Modal: Update Balance for Account
          ================================================================== */}
      {balanceTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${balanceClosing ? 'modal-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ba-balance-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestBalanceClose()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div
            ref={balancePanelRef}
            className="modal-panel relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Accent bar */}
            <div
              className="h-1"
              style={{ backgroundColor: 'var(--color-brand-500)' }}
            />

            <div className="p-6">
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: 'var(--bg-info)',
                      color: 'var(--color-brand-500)',
                    }}
                  >
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      id="ba-balance-title"
                      className="text-base font-bold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('bankAccounts.updateBalance')}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {balanceTarget.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={requestBalanceClose}
                  className="rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.cancel')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleBalanceSubmit} className="space-y-4">
                {/* Balance amount */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('bankAccounts.balanceAmount')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-lg font-bold ltr-nums outline-none transition-all',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                {/* Effective date */}
                <div>
                  <label
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('balance.effectiveDate')} *
                  </label>
                  <input
                    type="date"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
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

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-3 border-t pt-4"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <button
                    type="button"
                    onClick={requestBalanceClose}
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
                    disabled={balanceMutation.isPending || !balanceAmount}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {balanceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
