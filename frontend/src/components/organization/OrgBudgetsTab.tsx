import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, PiggyBank, AlertTriangle } from 'lucide-react'
import type { Budget, BudgetCreate, Category } from '@/types'
import { budgetsApi } from '@/api/budgets'
import { categoriesApi } from '@/api/categories'
import { queryKeys } from '@/lib/queryKeys'
import { formatCurrency, getCurrencySymbol } from '@/lib/utils'
import BudgetProgressBar from '@/components/ui/BudgetProgressBar'
import DatePicker from '@/components/ui/DatePicker'

type PeriodType = 'monthly' | 'quarterly' | 'annual'
interface FormState {
  category_id: string; period_type: PeriodType; amount: string
  alert_at_percentage: string; start_date: string
}
const EMPTY_FORM: FormState = {
  category_id: '', period_type: 'monthly', amount: '',
  alert_at_percentage: '80', start_date: new Date().toISOString().split('T')[0],
}
const PERIODS: PeriodType[] = ['monthly', 'quarterly', 'annual']
const INPUT_STYLE = { borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }

export default function OrgBudgetsTab({ orgId: _orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation()
  const isHe = i18n.language === 'he'
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: queryKeys.budgets.list(), queryFn: budgetsApi.list,
  })
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.all, queryFn: () => categoriesApi.list(),
  })
  const expCats = useMemo(
    () => categories.filter((c: Category) => c.type === 'expense' && !c.is_archived), [categories],
  )

  const closeModal = useCallback(() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM) }, [])
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.budgets.all })

  const createMut = useMutation({ mutationFn: (d: BudgetCreate) => budgetsApi.create(d), onSuccess: () => { invalidate(); closeModal() } })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BudgetCreate> }) => budgetsApi.update(id, data),
    onSuccess: () => { invalidate(); closeModal() },
  })
  const deleteMut = useMutation({ mutationFn: (id: string) => budgetsApi.delete(id), onSuccess: () => { invalidate(); setDeleteConfirmId(null) } })

  const summary = useMemo(() => ({
    totalBudgeted: budgets.reduce((s, b) => s + parseFloat(b.amount || '0'), 0),
    totalActual: budgets.reduce((s, b) => s + parseFloat(b.actual_amount || '0'), 0),
    overCount: budgets.filter((b) => b.is_over_budget).length,
  }), [budgets])

  const openCreate = useCallback(() => { setForm(EMPTY_FORM); setEditingId(null); setModalOpen(true) }, [])
  const openEdit = useCallback((b: Budget) => {
    setForm({ category_id: b.category_id, period_type: b.period_type, amount: parseFloat(b.amount).toString(), alert_at_percentage: b.alert_at_percentage.toString(), start_date: b.start_date })
    setEditingId(b.id); setModalOpen(true)
  }, [])
  const handleSubmit = useCallback(() => {
    const p: BudgetCreate = { category_id: form.category_id, period_type: form.period_type, amount: parseFloat(form.amount), start_date: form.start_date, alert_at_percentage: parseInt(form.alert_at_percentage, 10) || 80 }
    editingId ? updateMut.mutate({ id: editingId, data: p }) : createMut.mutate(p)
  }, [form, editingId, createMut, updateMut])

  const isFormValid = form.category_id && form.amount && parseFloat(form.amount) > 0 && form.start_date
  const isSaving = createMut.isPending || updateMut.isPending

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-brand-500)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-3" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
        <SummaryCell label={t('budgets.totalBudgeted')} value={formatCurrency(summary.totalBudgeted)} color="var(--color-brand-500)" />
        <SummaryCell label={t('budgets.totalActual')} value={formatCurrency(summary.totalActual)} color="var(--text-primary)" />
        <SummaryCell label={t('budgets.overBudgetCount')} value={summary.overCount.toString()} color={summary.overCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'} icon={summary.overCount > 0 ? <AlertTriangle className="h-4 w-4" /> : undefined} />
      </div>

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('budgets.title')}</h3>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90" style={{ backgroundColor: 'var(--color-brand-500)' }}>
          <Plus className="h-4 w-4" />{t('budgets.add')}
        </button>
      </div>

      {/* Budget list or empty */}
      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed py-16" style={{ borderColor: 'var(--border-primary)' }}>
          <PiggyBank className="h-12 w-12" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('budgets.empty')}</p>
          <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-brand-500)' }}>
            <Plus className="h-4 w-4" />{t('budgets.addFirst')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {budgets.map((b) => (
            <div key={b.id} className="relative group">
              <BudgetProgressBar
                actual={b.actual_amount} budget={b.amount} usagePercentage={b.usage_percentage}
                isOverBudget={b.is_over_budget} remaining={b.remaining} currency={getCurrencySymbol(b.currency)}
                categoryName={isHe ? (b.category_name_he || b.category_name) : b.category_name} categoryColor={b.category_color}
              />
              <span className="absolute top-3 end-12 text-[10px] font-medium rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                {t(`budgets.period.${b.period_type}`)}
              </span>
              <div className="absolute top-3 end-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => openEdit(b)} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-tertiary)' }} aria-label={t('common.edit')}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setDeleteConfirmId(b.id)} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)]" style={{ color: 'var(--color-danger)' }} aria-label={t('common.delete')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {deleteConfirmId === b.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <button type="button" onClick={() => deleteMut.mutate(b.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-danger)' }}>{t('common.confirmDelete')}</button>
                  <button type="button" onClick={() => setDeleteConfirmId(null)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>{t('common.cancel')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="w-full max-w-md animate-fade-in-up rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
            <h3 className="mb-5 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {editingId ? t('budgets.edit') : t('budgets.create')}
            </h3>
            <div className="space-y-4">
              <Field label={t('budgets.category')}>
                <select value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" style={INPUT_STYLE}>
                  <option value="">{t('budgets.selectCategory')}</option>
                  {expCats.map((c) => <option key={c.id} value={c.id}>{isHe ? c.name_he : c.name}</option>)}
                </select>
              </Field>
              <Field label={t('budgets.periodType')}>
                <div className="flex gap-2">
                  {PERIODS.map((pt) => (
                    <button key={pt} type="button" onClick={() => setForm((p) => ({ ...p, period_type: pt }))} className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all" style={{ backgroundColor: form.period_type === pt ? 'var(--color-brand-500)' : 'var(--bg-secondary)', color: form.period_type === pt ? '#fff' : 'var(--text-secondary)' }}>
                      {t(`budgets.period.${pt}`)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('budgets.amount')}>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full rounded-lg border px-3 py-2 text-sm" style={INPUT_STYLE} />
              </Field>
              <Field label={t('budgets.alertAt')}>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="100" value={form.alert_at_percentage} onChange={(e) => setForm((p) => ({ ...p, alert_at_percentage: e.target.value }))} className="w-24 rounded-lg border px-3 py-2 text-sm" style={INPUT_STYLE} />
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>%</span>
                </div>
              </Field>
              <Field label={t('budgets.startDate')}>
                <DatePicker value={form.start_date} onChange={(v) => setForm((p) => ({ ...p, start_date: v }))} className="w-full rounded-lg border px-3 py-2" style={INPUT_STYLE} />
              </Field>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button type="button" onClick={handleSubmit} disabled={!isFormValid || isSaving} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--color-brand-500)' }}>
                {isSaving ? t('common.saving') : editingId ? t('common.save') : t('budgets.create')}
              </button>
              <button type="button" onClick={closeModal} className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCell({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="mt-1 flex items-center justify-center gap-1 text-xl font-bold" style={{ color }}>{icon}{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
      {children}
    </div>
  )
}
