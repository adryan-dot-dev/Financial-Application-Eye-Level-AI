import { useState, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileBarChart, Plus, X, Loader2, TrendingUp, TrendingDown, DollarSign, CalendarDays } from 'lucide-react'
import type { OrgReport } from '@/types'
import { orgReportsApi } from '@/api/org-reports'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { useModalA11y } from '@/hooks/useModalA11y'

export default function OrgReportsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [reportType, setReportType] = useState<'monthly' | 'quarterly'>('monthly')
  const [period, setPeriod] = useState('')

  const closeModal = useCallback(() => { setShowGenerateModal(false); setReportType('monthly'); setPeriod('') }, [])
  const { panelRef } = useModalA11y(showGenerateModal, closeModal)

  const { data: reports = [], isLoading } = useQuery<OrgReport[]>({
    queryKey: queryKeys.orgReports.all(orgId),
    queryFn: () => orgReportsApi.list(orgId),
  })

  const generateMutation = useMutation({
    mutationFn: () => orgReportsApi.generate(orgId, reportType, period),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.orgReports.all(orgId) }); closeModal(); toast.success(t('toast.createSuccess')) },
    onError: (err: unknown) => toast.error(t('toast.error'), getApiErrorMessage(err)),
  })

  const handleGenerate = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (!period) return
    generateMutation.mutate()
  }, [period, generateMutation])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgReports.title')}</h3>
        <button onClick={() => setShowGenerateModal(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          {t('orgReports.generateReport')}
        </button>
      </div>

      {/* Report list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card flex items-center gap-4 p-5">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2"><div className="skeleton h-4 w-36 rounded" /><div className="skeleton h-3 w-20 rounded" /></div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-4 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--bg-hover)' }}>
            <FileBarChart className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('orgReports.noReports')}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('orgReports.noReportsDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => {
            const net = parseFloat(report.net)
            return (
              <div key={report.id} className="card space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}>
                    {t(`orgReports.${report.report_type}`)}
                  </span>
                  <span className="text-xs font-medium ltr-nums" style={{ color: 'var(--text-tertiary)' }}>{report.period}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--color-income)' }} />
                      {t('orgReports.totalIncome')}
                    </span>
                    <span className="font-semibold ltr-nums" style={{ color: 'var(--color-income)' }}>{formatCurrency(report.total_income)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <TrendingDown className="h-3.5 w-3.5" style={{ color: 'var(--color-expense)' }} />
                      {t('orgReports.totalExpenses')}
                    </span>
                    <span className="font-semibold ltr-nums" style={{ color: 'var(--color-expense)' }}>{formatCurrency(report.total_expenses)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-sm" style={{ borderColor: 'var(--border-primary)' }}>
                    <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('orgReports.net')}
                    </span>
                    <span className="font-bold ltr-nums" style={{ color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>{formatCurrency(report.net)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  <CalendarDays className="h-3 w-3" />
                  {t('orgReports.generatedAt')}: {formatDate(report.generated_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div ref={panelRef} className="modal-panel relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="h-1" style={{ backgroundColor: 'var(--color-brand-500)' }} />
            <form onSubmit={handleGenerate} className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('orgReports.generateReport')}</h3>
                <button type="button" onClick={closeModal} className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-tertiary)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label htmlFor="report-type" className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('orgReports.selectType')}</label>
                <select id="report-type" value={reportType} onChange={(e) => setReportType(e.target.value as 'monthly' | 'quarterly')} className="input w-full text-sm">
                  <option value="monthly">{t('orgReports.monthly')}</option>
                  <option value="quarterly">{t('orgReports.quarterly')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="report-period" className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t('orgReports.selectPeriod')}</label>
                <input id="report-period" type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} className="input w-full text-sm" dir="ltr" />
              </div>
              <div className="flex items-center justify-end gap-3 border-t pt-5" style={{ borderColor: 'var(--border-primary)' }}>
                <button type="button" onClick={closeModal} className="btn-secondary px-4 py-2 text-sm">{t('common.cancel')}</button>
                <button type="submit" disabled={generateMutation.isPending} className="btn-primary inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold disabled:opacity-60">
                  {generateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('orgReports.generate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
