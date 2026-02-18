import { useState, useCallback, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModalA11y } from '@/hooks/useModalA11y'
import {
  Building2,
  Plus,
  Trash2,
  X,
  Loader2,
  Crown,
  Shield,
  Eye,
  UserPlus,
  Users,
  AlertTriangle,
  ChevronLeft,
  Mail,
  UserMinus,
} from 'lucide-react'
import type { Organization, OrgMember, OrgRole } from '@/types'
import { organizationsApi } from '@/api/organizations'
import type { AddMemberRequest, ChangeMemberRoleRequest } from '@/api/organizations'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<OrgRole, { bg: string; color: string; border: string }> = {
  owner: {
    bg: 'rgba(134, 140, 255, 0.1)',
    color: 'rgb(139, 92, 246)',
    border: 'rgba(134, 140, 255, 0.3)',
  },
  admin: {
    bg: 'var(--bg-info)',
    color: 'var(--color-info)',
    border: 'var(--border-info)',
  },
  member: {
    bg: 'var(--bg-success)',
    color: 'var(--color-success)',
    border: 'var(--border-success)',
  },
  viewer: {
    bg: 'var(--bg-hover)',
    color: 'var(--text-tertiary)',
    border: 'var(--border-primary)',
  },
}

const ROLE_ICONS: Record<OrgRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
}

function RoleBadge({ role }: { role: OrgRole }) {
  const { t } = useTranslation()
  const colors = ROLE_COLORS[role]
  const Icon = ROLE_ICONS[role]

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      <Icon className="h-3 w-3" />
      {t(`organizations.role_${role}`)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn('animate-fade-in-up flex items-center gap-4 rounded-2xl px-5 py-4', `stagger-${Math.min(i + 1, 8)}`)}
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="skeleton h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-36 rounded-lg" />
            <div className="skeleton h-3 w-20 rounded-lg" />
          </div>
          <div className="skeleton h-7 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Org Card (for list view)
// ---------------------------------------------------------------------------

function OrgCard({
  org,
  memberCount,
  userRole,
  index,
  onClick,
}: {
  org: Organization
  memberCount?: number
  userRole?: OrgRole
  index: number
  onClick: () => void
}) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className={cn(
        'row-enter group relative flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-start transition-all duration-300 hover:shadow-sm',
      )}
      style={{
        '--row-index': Math.min(index, 15),
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-card)',
      } as React.CSSProperties}
    >
      {/* Org avatar */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold"
        style={{
          backgroundColor: 'rgba(134, 140, 255, 0.1)',
          color: 'rgb(139, 92, 246)',
        }}
      >
        {org.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {org.name}
        </p>
        <p
          className="mt-0.5 text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {memberCount !== undefined
            ? t('organizations.memberCount', { count: memberCount })
            : org.slug}
        </p>
      </div>

      {/* Role badge */}
      {userRole && <RoleBadge role={userRole} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Member Row
// ---------------------------------------------------------------------------

function MemberRow({
  member,
  isSelf,
  canChangeRole,
  canRemove,
  onChangeRole,
  onRemove,
  isChangingRole,
  isRemoving,
}: {
  member: OrgMember
  isSelf: boolean
  canChangeRole: boolean
  canRemove: boolean
  onChangeRole: (userId: string, role: OrgRole) => void
  onRemove: (userId: string) => void
  isChangingRole: boolean
  isRemoving: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-200',
      )}
      style={{
        borderColor: isSelf ? 'var(--border-info)' : 'var(--border-primary)',
        backgroundColor: isSelf ? 'var(--bg-info)' : 'var(--bg-card)',
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
        style={{
          backgroundColor: ROLE_COLORS[member.role].bg,
          color: ROLE_COLORS[member.role].color,
        }}
      >
        {(member.username ?? member.email ?? '?').charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {member.username ?? t('organizations.unknownUser')}
          </p>
          {isSelf && (
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: 'var(--bg-info)',
                color: 'var(--color-info)',
                border: '1px solid var(--border-info)',
              }}
            >
              {t('users.you')}
            </span>
          )}
        </div>
        {member.email && (
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: 'var(--text-tertiary)' }}
            dir="ltr"
          >
            {member.email}
          </p>
        )}
      </div>

      {/* Role badge or selector */}
      {canChangeRole && member.role !== 'owner' ? (
        <select
          value={member.role}
          onChange={(e) => onChangeRole(member.user_id, e.target.value as OrgRole)}
          disabled={isChangingRole}
          className="rounded-lg border px-2 py-1.5 text-[11px] font-semibold outline-none transition-all"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="admin">{t('organizations.role_admin')}</option>
          <option value="member">{t('organizations.role_member')}</option>
          <option value="viewer">{t('organizations.role_viewer')}</option>
        </select>
      ) : (
        <RoleBadge role={member.role} />
      )}

      {/* Remove button */}
      {canRemove && member.role !== 'owner' && (
        <button
          onClick={() => onRemove(member.user_id)}
          disabled={isRemoving}
          title={t('organizations.removeMember')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-danger)]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {isRemoving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserMinus className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OrganizationPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const { orgs, isLoading: orgsLoading } = useOrganization()
  const toast = useToast()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.organizations')
  }, [t])

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<OrgRole>('member')
  const [addMemberError, setAddMemberError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Close handlers
  // ---------------------------------------------------------------------------
  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false)
    setCreateName('')
    setCreateError(null)
  }, [])

  const closeAddMemberModal = useCallback(() => {
    setShowAddMemberModal(false)
    setAddMemberEmail('')
    setAddMemberRole('member')
    setAddMemberError(null)
  }, [])

  // Modal A11y
  const { panelRef: createPanelRef } = useModalA11y(showCreateModal, closeCreateModal)
  const {
    panelRef: deletePanelRef,
    closing: deleteClosing,
    requestClose: requestDeleteClose,
  } = useModalA11y(showDeleteConfirm, () => setShowDeleteConfirm(false))
  const { panelRef: addMemberPanelRef } = useModalA11y(showAddMemberModal, closeAddMemberModal)

  // ---------------------------------------------------------------------------
  // Selected org detail query
  // ---------------------------------------------------------------------------
  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null

  const membersQuery = useQuery<OrgMember[]>({
    queryKey: queryKeys.organizations.members(selectedOrgId ?? ''),
    queryFn: () => organizationsApi.listMembers(selectedOrgId!),
    enabled: !!selectedOrgId,
  })

  const members = membersQuery.data ?? []
  const currentUserMember = members.find((m) => m.user_id === currentUser?.id)
  const currentUserRole = currentUserMember?.role as OrgRole | undefined
  const isOwner = currentUserRole === 'owner'
  const isAdminOrOwner = currentUserRole === 'owner' || currentUserRole === 'admin'

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (name: string) => organizationsApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      closeCreateModal()
      toast.success(t('toast.createSuccess'))
    },
    onError: (err: unknown) => {
      setCreateError(getApiErrorMessage(err))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      setShowDeleteConfirm(false)
      setSelectedOrgId(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (err: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(err))
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: (data: AddMemberRequest) =>
      organizationsApi.addMember(selectedOrgId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(selectedOrgId!),
      })
      closeAddMemberModal()
      toast.success(t('toast.createSuccess'))
    },
    onError: (err: unknown) => {
      setAddMemberError(getApiErrorMessage(err))
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: ChangeMemberRoleRequest }) =>
      organizationsApi.changeMemberRole(selectedOrgId!, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(selectedOrgId!),
      })
      toast.success(t('toast.updateSuccess'))
    },
    onError: (err: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(err))
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      organizationsApi.removeMember(selectedOrgId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.members(selectedOrgId!),
      })
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (err: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(err))
    },
  })

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCreate = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setCreateError(null)
      const trimmed = createName.trim()
      if (!trimmed) return
      createMutation.mutate(trimmed)
    },
    [createName, createMutation],
  )

  const handleAddMember = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setAddMemberError(null)
      const email = addMemberEmail.trim()
      if (!email) return
      addMemberMutation.mutate({ email, role: addMemberRole })
    },
    [addMemberEmail, addMemberRole, addMemberMutation],
  )

  const handleDelete = useCallback(() => {
    if (selectedOrgId) {
      deleteMutation.mutate(selectedOrgId)
    }
  }, [selectedOrgId, deleteMutation])

  // ---------------------------------------------------------------------------
  // Render: Detail View
  // ---------------------------------------------------------------------------
  if (selectedOrgId && selectedOrg) {
    return (
      <div className="page-reveal space-y-8">
        {/* Back button + Header */}
        <div className="animate-fade-in-up stagger-1 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedOrgId(null)}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}
              title={t('common.back')}
            >
              <ChevronLeft className={cn('h-5 w-5', isRtl && 'rotate-180')} />
            </button>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold"
              style={{
                backgroundColor: 'rgba(134, 140, 255, 0.1)',
                color: 'rgb(139, 92, 246)',
                boxShadow: '0 4px 16px rgba(134, 140, 255, 0.15)',
              }}
            >
              {selectedOrg.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {selectedOrg.name}
              </h1>
              <p
                className="mt-0.5 text-sm"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('organizations.slug')}: {selectedOrg.slug}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminOrOwner && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
              >
                <UserPlus className="h-4 w-4" />
                {t('organizations.addMember')}
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--bg-danger)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--border-danger)',
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t('organizations.deleteOrg')}
              </button>
            )}
          </div>
        </div>

        {/* Members section */}
        <div className="animate-fade-in-up stagger-2 card overflow-hidden">
          <div
            className="flex items-center gap-3.5 border-b px-6 py-5"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}
            >
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2
                className="text-[15px] font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('organizations.members')}
              </h2>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                {t('organizations.memberCount', { count: members.length })}
              </p>
            </div>
          </div>

          {membersQuery.isLoading ? (
            <PageSkeleton />
          ) : membersQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'var(--bg-danger)' }}
              >
                <AlertTriangle className="h-8 w-8" style={{ color: 'var(--color-danger)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('common.error')}
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <Users className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('organizations.noMembers')}
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-5">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.user_id === currentUser?.id}
                  canChangeRole={isOwner}
                  canRemove={isAdminOrOwner}
                  onChangeRole={(userId, role) =>
                    changeRoleMutation.mutate({ userId, data: { role } })
                  }
                  onRemove={(userId) => removeMemberMutation.mutate(userId)}
                  isChangingRole={changeRoleMutation.isPending}
                  isRemoving={removeMemberMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* Add Member Modal                                                  */}
        {/* ================================================================= */}
        {showAddMemberModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-member-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeAddMemberModal()
            }}
          >
            <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              ref={addMemberPanelRef}
              className="modal-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border p-0"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-primary)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <div className="h-1" style={{ backgroundColor: 'var(--color-brand-500)' }} />
              <div className="p-7">
                {/* Header */}
                <div className="mb-7 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="icon-circle icon-circle-md"
                      style={{ background: 'var(--bg-info)', color: 'var(--color-info)' }}
                    >
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <h2
                      id="add-member-title"
                      className="text-lg font-bold tracking-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('organizations.addMember')}
                    </h2>
                  </div>
                  <button
                    onClick={closeAddMemberModal}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-tertiary)' }}
                    aria-label={t('common.close')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Error */}
                {addMemberError && (
                  <div
                    className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--bg-danger)',
                      color: 'var(--color-danger)',
                      border: '1px solid var(--border-danger)',
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{addMemberError}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleAddMember} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="member-email"
                      className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {t('users.email')}
                    </label>
                    <input
                      id="member-email"
                      type="email"
                      required
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      className="input w-full text-sm font-medium"
                      placeholder={t('organizations.emailPlaceholder')}
                      dir="ltr"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label
                      htmlFor="member-role"
                      className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      {t('organizations.role')}
                    </label>
                    <select
                      id="member-role"
                      value={addMemberRole}
                      onChange={(e) => setAddMemberRole(e.target.value as OrgRole)}
                      className="input w-full text-sm font-medium"
                    >
                      <option value="admin">{t('organizations.role_admin')}</option>
                      <option value="member">{t('organizations.role_member')}</option>
                      <option value="viewer">{t('organizations.role_viewer')}</option>
                    </select>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-end gap-3 border-t pt-6"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    <button
                      type="button"
                      onClick={closeAddMemberModal}
                      className="btn-secondary px-5 py-2.5 text-sm"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {addMemberMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {t('organizations.addMemberButton')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Delete Confirmation Modal                                         */}
        {/* ================================================================= */}
        {showDeleteConfirm && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${deleteClosing ? 'modal-closing' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-org-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) requestDeleteClose()
            }}
          >
            <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <div
              ref={deletePanelRef}
              className="modal-panel relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-primary)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <div className="h-1" style={{ backgroundColor: 'var(--color-danger)' }} />
              <div className="p-7">
                <div className="mb-6 flex flex-col items-center text-center">
                  <div
                    className="warning-pulse mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: 'var(--bg-danger)',
                      border: '1px solid var(--border-danger)',
                    }}
                  >
                    <Trash2 className="h-7 w-7" style={{ color: 'var(--color-danger)' }} />
                  </div>
                  <h3
                    id="delete-org-title"
                    className="text-base font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('organizations.deleteConfirmTitle')}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('organizations.deleteConfirmMessage', { name: selectedOrg.name })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={requestDeleteClose}
                    className="btn-secondary flex-1 py-2.5 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{
                      backgroundColor: 'var(--color-danger)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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

  // ---------------------------------------------------------------------------
  // Render: List View
  // ---------------------------------------------------------------------------
  return (
    <div className="page-reveal space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="icon-circle icon-circle-lg"
            style={{
              backgroundColor: 'rgb(139, 92, 246)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(134, 140, 255, 0.3)',
            }}
          >
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('organizations.title')}
              </h1>
              {!orgsLoading && orgs.length > 0 && (
                <span
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold tabular-nums"
                  style={{
                    background: 'rgba(134, 140, 255, 0.1)',
                    color: 'rgb(139, 92, 246)',
                    border: '1px solid rgba(134, 140, 255, 0.3)',
                  }}
                >
                  {orgs.length}
                </span>
              )}
            </div>
            <p
              className="mt-0.5 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('organizations.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          {t('organizations.create')}
        </button>
      </div>

      {/* Orgs List */}
      <div className="animate-fade-in-up stagger-2 card overflow-hidden">
        {orgsLoading ? (
          <PageSkeleton />
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="empty-float flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <Building2 className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="text-center">
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('organizations.noOrgs')}
              </p>
              <p
                className="mt-1 max-w-sm text-xs leading-relaxed"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('organizations.noOrgsDesc')}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary mt-2 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              {t('organizations.createFirst')}
            </button>
          </div>
        ) : (
          <div className="space-y-2 p-5">
            {orgs.map((org, index) => (
              <OrgCard
                key={org.id}
                org={org}
                index={index}
                onClick={() => setSelectedOrgId(org.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Create Organization Modal                                         */}
      {/* ================================================================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-org-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreateModal()
          }}
        >
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={createPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border p-0"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div className="h-1" style={{ backgroundColor: 'rgb(139, 92, 246)' }} />
            <div className="p-7">
              {/* Header */}
              <div className="mb-7 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="icon-circle icon-circle-md"
                    style={{
                      background: 'rgba(134, 140, 255, 0.1)',
                      color: 'rgb(139, 92, 246)',
                    }}
                  >
                    <Plus className="h-5 w-5" />
                  </div>
                  <h2
                    id="create-org-title"
                    className="text-lg font-bold tracking-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('organizations.createOrg')}
                  </h2>
                </div>
                <button
                  onClick={closeCreateModal}
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Error */}
              {createError && (
                <div
                  className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--bg-danger)',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--border-danger)',
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label
                    htmlFor="org-name"
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {t('organizations.orgName')}
                  </label>
                  <input
                    id="org-name"
                    type="text"
                    required
                    minLength={1}
                    maxLength={200}
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="input w-full text-sm font-medium"
                    placeholder={t('organizations.orgNamePlaceholder')}
                    dir="auto"
                  />
                </div>

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-3 border-t pt-6"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="btn-secondary px-5 py-2.5 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {t('organizations.createButton')}
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
