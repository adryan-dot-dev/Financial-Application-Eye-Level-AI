import { useState, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Loader2, Trash2 } from 'lucide-react'
import type { OrgMember } from '@/types'
import { organizationsApi } from '@/api/organizations'
import { getApiErrorMessage } from '@/api/client'
import CurrencySelector from '@/components/CurrencySelector'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { queryKeys } from '@/lib/queryKeys'

interface OrgSettingsTabProps { orgId: string }

export default function OrgSettingsTab({ orgId }: OrgSettingsTabProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: org, isLoading } = useQuery({
    queryKey: queryKeys.organizations.detail(orgId),
    queryFn: () => organizationsApi.get(orgId),
  })
  const { data: members = [] } = useQuery<OrgMember[]>({
    queryKey: queryKeys.organizations.members(orgId),
    queryFn: () => organizationsApi.listMembers(orgId),
  })

  const isOwner = members.find((m) => m.user_id === user?.id)?.role === 'owner'

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('ILS')
  const [approvalThreshold, setApprovalThreshold] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  if (org && !initialized) { setName(org.name); setInitialized(true) }

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string }) => organizationsApi.update(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(orgId) })
      toast.success(t('settings.saved'))
    },
    onError: (err: unknown) => toast.error(t('common.error'), getApiErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => organizationsApi.delete(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (err: unknown) => toast.error(t('common.error'), getApiErrorMessage(err)),
  })

  const handleSave = useCallback((e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) updateMutation.mutate({ name: trimmed })
  }, [name, updateMutation])

  const handleDelete = useCallback(() => {
    if (deleteConfirmName === org?.name) deleteMutation.mutate()
  }, [deleteConfirmName, org?.name, deleteMutation])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5"><div className="skeleton-group space-y-3">
            <div className="skeleton h-4 w-24 rounded" /><div className="skeleton h-10 w-full rounded" />
          </div></div>
        ))}
      </div>
    )
  }

  const labelCls = "mb-2 block text-xs font-semibold uppercase tracking-wider"
  const labelStyle = { color: 'var(--text-tertiary)' }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="card overflow-hidden">
        <div className="flex items-center gap-3.5 border-b px-6 py-5" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}>
            <Settings className="h-5 w-5" />
          </div>
          <h2 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {t('organizations.orgSettings')}
          </h2>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <label htmlFor="org-s-name" className={labelCls} style={labelStyle}>{t('organizations.orgName')}</label>
            <input id="org-s-name" type="text" required maxLength={200} value={name}
              onChange={(e) => setName(e.target.value)} className="input w-full text-sm font-medium"
              placeholder={t('organizations.orgNamePlaceholder')} dir="auto" />
          </div>
          <div>
            <label htmlFor="org-s-currency" className={labelCls} style={labelStyle}>{t('settings.currency')}</label>
            <CurrencySelector id="org-s-currency" value={currency} onChange={setCurrency} className="w-full" />
          </div>
          <div>
            <label htmlFor="org-s-threshold" className={labelCls} style={labelStyle}>{t('organizations.approvalThreshold')}</label>
            <input id="org-s-threshold" type="number" min={0} step="0.01" value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(e.target.value)} className="input w-full text-sm font-medium" dir="ltr" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={updateMutation.isPending}
              className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-60">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </form>

      {isOwner && (
        <div className="card overflow-hidden border" style={{ borderColor: 'var(--border-danger)' }}>
          <div className="px-6 py-5">
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>
              {t('organizations.deleteConfirmTitle')}
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('organizations.deleteConfirmMessage', { name: org?.name ?? '' })}
            </p>
            <div className="mt-4 flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="org-s-delete" className="mb-1.5 block text-xs font-semibold" style={labelStyle}>
                  {t('organizations.orgName')}
                </label>
                <input id="org-s-delete" type="text" value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)} className="input w-full text-sm"
                  placeholder={org?.name ?? ''} dir="auto" />
              </div>
              <button type="button" onClick={handleDelete}
                disabled={deleteMutation.isPending || deleteConfirmName !== org?.name}
                className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-danger)' }}>
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
