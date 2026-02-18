import { useState, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, Plus, X, Loader2, FileCheck, ListFilter } from 'lucide-react'
import type { ExpenseApproval, ExpenseApprovalCreate } from '@/types'
import { approvalsApi } from '@/api/approvals'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { useModalA11y } from '@/hooks/useModalA11y'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_STYLES: Record<ExpenseApproval['status'], { bg: string; color: string; border: string }> = {
  pending: { bg: 'var(--bg-warning)', color: 'var(--color-warning)', border: 'var(--border-warning)' },
  approved: { bg: 'var(--bg-success)', color: 'var(--color-success)', border: 'var(--border-success)' },
  rejected: { bg: 'var(--bg-danger)', color: 'var(--color-danger)', border: 'var(--border-danger)' },
}

const STATUS_ICONS: Record<ExpenseApproval['status'], typeof Clock> = {
  pending: Clock, approved: CheckCircle2, rejected: XCircle,
}

export default function OrgApprovalsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [submitAmount, setSubmitAmount] = useState('')
  const [submitDescription, setSubmitDescription] = useState('')

  const closeSubmitModal = useCallback(() => { setShowSubmitModal(false); setSubmitAmount(''); setSubmitDescription('') }, [])
  const closeRejectDialog = useCallback(() => { setShowRejectDialog(null); setRejectReason('') }, [])

  const { panelRef: submitPanelRef } = useModalA11y(showSubmitModal, closeSubmitModal)
  const { panelRef: rejectPanelRef } = useModalA11y(!!showRejectDialog, closeRejectDialog)

  const apiStatus = filter === 'all' ? undefined : filter
  const { data: approvals = [], isLoading } = useQuery<ExpenseApproval[]>({
    queryKey: queryKeys.approvals.list(orgId, apiStatus),
    queryFn: () => approvalsApi.list(orgId, apiStatus),
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all(orgId) })
  }, [queryClient, orgId])

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(orgId, id),
    onSuccess: () => { invalidate(); toast.success(t('approvals.approved')) },
    onError: (err: unknown) => toast.error(t('toast.error'), getApiErrorMessage(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => approvalsApi.reject(orgId, id, reason),
    onSuccess: () => { invalidate(); closeRejectDialog(); toast.success(t('approvals.rejected')) },
    onError: (err: unknown) => toast.error(t('toast.error'), getApiErrorMessage(err)),
  })

  const submitMutation = useMutation({
    mutationFn: (data: ExpenseApprovalCreate) => approvalsApi.submit(orgId, data),
    onSuccess: () => { invalidate(); closeSubmitModal(); toast.success(t('toast.createSuccess')) },
    onError: (err: unknown) => toast.error(t('toast.error'), getApiErrorMessage(err)),
  })

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(submitAmount)
    if (isNaN(amount) || amount <= 0 || !submitDescription.trim()) return
    submitMutation.mutate({ amount, description: submitDescription.trim() })
  }, [submitAmount, submitDescription, submitMutation])

  const handleReject = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!showRejectDialog || !rejectReason.trim()) return
    rejectMutation.mutate({ id: showRejectDialog, reason: rejectReason.trim() })
  }, [showRejectDialog, rejectReason, rejectMutation])

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('approvals.title') },
    { key: 'pending', label: t('approvals.pending') },
    { key: 'approved', label: t('approvals.approved') },
    { key: 'rejected', label: t('approvals.rejected') },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <ListFilter className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
              style={{
                backgroundColor: filter === f.key ? 'var(--color-brand-500)' : 'var(--bg-hover)',
                color: filter === f.key ? 'white' : 'var(--text-secondary)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowSubmitModal(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          {t('approvals.submitExpense')}
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card flex items-center gap-4 p-5">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton h-3 w-24 rounded" /></div>
            </div>
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-4 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--bg-hover)' }}>
            <FileCheck className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('approvals.noApprovals')}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('approvals.noApprovalsDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((item) => {
            const st = STATUS_STYLES[item.status]
            const StatusIcon = STATUS_ICONS[item.status]
            return (
              <div key={item.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: st.bg }}>
                  <StatusIcon className="h-5 w-5" style={{ color: st.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{t('approvals.requestedBy')}: {item.requested_by_email ?? item.requested_by}</span>
                    <span className="ltr-nums">{formatCurrency(item.amount, item.currency)}</span>
                    <span>{formatDate(item.requested_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                    {t(`approvals.${item.status}`)}
                  </span>
                  {item.status === 'pending' && (
                    <>
                      <button onClick={() => approveMutation.mutate(item.id)} disabled={approveMutation.isPending} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors" style={{ backgroundColor: 'var(--bg-success)', color: 'var(--color-success)' }}>
                        {t('approvals.approve')}
                      </button>
                      <button onClick={() => setShowRejectDialog(item.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors" style={{ backgroundColor: 'var(--bg-danger)', color: 'var(--color-danger)' }}>
                        {t('approvals.reject')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) closeRejectDialog() }}>
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div ref={rejectPanelRef} className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="h-1" style={{ backgroundColor: 'var(--color-danger)' }} />
            <form onSubmit={handleReject} className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('approvals.reject')}</h3>
                <button type="button" onClick={closeRejectDialog} className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-tertiary)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label htmlFor="reject-reason" className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('approvals.rejectionReason')}</label>
                <textarea id="reject-reason" required rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="input w-full text-sm" placeholder={t('approvals.rejectionReasonPlaceholder')} />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={closeRejectDialog} className="btn-secondary px-4 py-2 text-sm">{t('common.cancel')}</button>
                <button type="submit" disabled={rejectMutation.isPending} className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-5 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60" style={{ backgroundColor: 'var(--color-danger)' }}>
                  {rejectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('approvals.reject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Expense Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) closeSubmitModal() }}>
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div ref={submitPanelRef} className="modal-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="h-1" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}><Plus className="h-4 w-4" /></div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('approvals.submitExpense')}</h3>
                </div>
                <button type="button" onClick={closeSubmitModal} className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-tertiary)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label htmlFor="submit-amount" className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('approvals.amount')}</label>
                <input id="submit-amount" type="number" required min="0.01" step="0.01" value={submitAmount} onChange={(e) => setSubmitAmount(e.target.value)} className="input w-full text-sm" dir="ltr" />
              </div>
              <div>
                <label htmlFor="submit-desc" className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('approvals.description')}</label>
                <textarea id="submit-desc" required rows={3} value={submitDescription} onChange={(e) => setSubmitDescription(e.target.value)} className="input w-full text-sm" placeholder={t('approvals.descriptionPlaceholder')} />
              </div>
              <div className="flex items-center justify-end gap-3 border-t pt-5" style={{ borderColor: 'var(--border-primary)' }}>
                <button type="button" onClick={closeSubmitModal} className="btn-secondary px-4 py-2 text-sm">{t('common.cancel')}</button>
                <button type="submit" disabled={submitMutation.isPending} className="btn-primary inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold disabled:opacity-60">
                  {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('approvals.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
