import { useState, useCallback, useEffect } from 'react'
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
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Users as UsersIcon,
  AlertTriangle,
  Mail,
  Lock,
  User,
  Crown,
  Search,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react'
import type { User as UserType } from '@/types'
import { usersApi } from '@/api/users'
import type { CreateUserRequest, UpdateUserRequest } from '@/api/users'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserFormData {
  username: string
  email: string
  password: string
  is_admin: boolean
}

const EMPTY_FORM: UserFormData = {
  username: '',
  email: '',
  password: '',
  is_admin: false,
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-fade-in-up flex items-center gap-5 rounded-2xl px-5 py-4',
            `stagger-${Math.min(i + 1, 8)}`,
          )}
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="skeleton h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-28 rounded-lg" />
            <div className="skeleton h-3 w-44 rounded-lg" />
          </div>
          <div className="skeleton h-7 w-20 rounded-full" />
          <div className="skeleton h-7 w-20 rounded-full" />
          <div className="flex gap-1.5">
            <div className="skeleton h-8 w-8 rounded-xl" />
            <div className="skeleton h-8 w-8 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access Denied Component
// ---------------------------------------------------------------------------

function AccessDenied({ message }: { message: string }) {
  const { t } = useTranslation()

  return (
    <div className="page-reveal flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      {/* Animated danger icon with decorative ring */}
      <div className="relative">
        <div
          className="warning-pulse flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{ backgroundColor: 'var(--bg-danger)' }}
        >
          <AlertTriangle className="h-12 w-12" style={{ color: 'var(--color-danger)' }} />
        </div>
        <div
          className="absolute -inset-3 rounded-[28px] opacity-30"
          style={{ border: '2px dashed var(--color-danger)' }}
        />
      </div>

      <div className="text-center">
        <h2
          className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {message}
        </h2>
        <p
          className="mt-2 max-w-sm text-sm leading-relaxed"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('users.accessDeniedHint') ?? 'This area requires administrator privileges. Contact your admin for access.'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User Avatar
// ---------------------------------------------------------------------------

function UserAvatar({
  username,
  isAdmin,
  size = 'md',
}: {
  username: string
  isAdmin: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-2xl font-bold tracking-tight',
        sizeClasses[size],
      )}
      style={{
        backgroundColor: isAdmin
          ? 'var(--color-brand-500)'
          : 'var(--bg-hover)',
        color: isAdmin ? 'white' : 'var(--text-secondary)',
        boxShadow: isAdmin ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {username.charAt(0).toUpperCase()}
      {isAdmin && size !== 'sm' && (
        <div
          className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full"
          style={{
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Crown
            className="h-2.5 w-2.5"
            style={{ color: 'var(--color-info)' }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// User Row Component
// ---------------------------------------------------------------------------

function UserRow({
  user,
  isSelf,
  isRtl: _isRtl,
  index,
  onEdit,
  onDelete,
  onToggleActive,
  onResetPassword,
  isTogglingActive,
}: {
  user: UserType
  isSelf: boolean
  isRtl: boolean
  index: number
  onEdit: (user: UserType) => void
  onDelete: (user: UserType) => void
  onToggleActive: (id: string, isActive: boolean) => void
  onResetPassword: (user: UserType) => void
  isTogglingActive: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'row-enter group relative flex items-center gap-5 rounded-2xl border px-5 py-4 transition-all duration-300',
      )}
      style={{
        '--row-index': Math.min(index, 15),
        borderColor: isSelf ? 'var(--border-info)' : 'var(--border-primary)',
        backgroundColor: isSelf ? 'var(--bg-info)' : 'var(--bg-card)',
      } as React.CSSProperties}
    >
      {/* Self indicator bar */}
      {isSelf && (
        <div
          className="absolute inset-inline-start-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ backgroundColor: 'var(--color-brand-500)' }}
        />
      )}

      {/* Avatar */}
      <UserAvatar username={user.username} isAdmin={user.is_admin} />

      {/* User info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <p
            className="truncate text-sm font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {user.username}
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
        <p
          className="mt-1 truncate text-xs"
          style={{ color: 'var(--text-tertiary)' }}
          dir="ltr"
        >
          {user.email}
        </p>
      </div>

      {/* Role badge */}
      {user.is_admin ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide"
          style={{
            background: 'var(--bg-info)',
            color: 'var(--color-info)',
            border: '1px solid var(--border-info)',
          }}
        >
          <Crown className="h-3 w-3" />
          {t('users.admin')}
        </span>
      ) : (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
          style={{
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <ShieldOff className="h-3 w-3" />
          {t('users.user')}
        </span>
      )}

      {user.is_super_admin && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide"
          style={{
            backgroundColor: 'var(--color-brand-500)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Crown className="h-3 w-3" />
          {t('users.superAdmin')}
        </span>
      )}

      {/* Status badge with toggle */}
      <div
        className="tooltip-wrap"
        data-tooltip={
          isSelf
            ? t('users.cannotToggleSelf')
            : user.is_active
              ? t('users.deactivate')
              : t('users.activate')
        }
      >
        <button
          onClick={() => {
            if (!isSelf) {
              onToggleActive(user.id, !user.is_active)
            }
          }}
          disabled={isSelf || isTogglingActive}
          title={
            isSelf
              ? t('users.cannotToggleSelf')
              : user.is_active
                ? t('users.deactivate')
                : t('users.activate')
          }
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200',
            !isSelf && 'cursor-pointer hover:shadow-sm',
            isSelf && 'cursor-default opacity-70',
          )}
          style={
            user.is_active
              ? {
                  backgroundColor: 'var(--bg-success)',
                  color: 'var(--color-success)',
                  border: '1px solid var(--border-success)',
                }
              : {
                  backgroundColor: 'var(--bg-danger)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--border-danger)',
                }
          }
        >
          {user.is_active ? (
            <>
              <UserCheck className="h-3 w-3" />
              {t('users.active')}
            </>
          ) : (
            <>
              <UserX className="h-3 w-3" />
              {t('users.inactive')}
            </>
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
        <button
          onClick={() => onResetPassword(user)}
          title={t('users.resetPassword')}
          className="action-btn rounded-xl p-2"
          style={{ color: 'var(--text-secondary)' }}
          disabled={isSelf}
        >
          <Key className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onEdit(user)}
          title={user.is_super_admin && !isSelf ? t('users.cannotEditSuperAdmin') : t('users.edit')}
          className={cn(
            'action-btn rounded-xl p-2',
            user.is_super_admin && !isSelf && 'cursor-not-allowed opacity-25',
            !(user.is_super_admin && !isSelf) && 'action-btn-edit',
          )}
          style={{ color: user.is_super_admin && !isSelf ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
          disabled={user.is_super_admin && !isSelf}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <div
          className={cn((isSelf || user.is_super_admin) && 'tooltip-wrap')}
          data-tooltip={isSelf ? t('users.cannotDeleteSelf') : user.is_super_admin ? t('users.cannotDeleteSuperAdmin') : undefined}
        >
          <button
            onClick={() => !isSelf && !user.is_super_admin && onDelete(user)}
            disabled={isSelf || user.is_super_admin}
            title={isSelf ? t('users.cannotDeleteSelf') : user.is_super_admin ? t('users.cannotDeleteSuperAdmin') : t('users.delete')}
            className={cn(
              'action-btn rounded-xl p-2',
              (isSelf || user.is_super_admin) && 'cursor-not-allowed opacity-25',
              !(isSelf || user.is_super_admin) && 'action-btn-delete',
            )}
            style={{ color: (isSelf || user.is_super_admin) ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const isRtl = i18n.language === 'he'
  const isAdmin = !!currentUser?.is_admin

  // Search filter
  const [searchQuery, setSearchQuery] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    document.title = t('pageTitle.users')
  }, [t])

  // State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [resetTarget, setResetTarget] = useState<UserType | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)

  // -------------------------------------------------------------------------
  // Handlers (declared before useModalA11y so closeFormModal is available)
  // -------------------------------------------------------------------------

  const closeFormModal = useCallback(() => {
    setModalMode(null)
    setEditingUser(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
    setShowPassword(false)
  }, [])

  // Modal A11y
  const {
    panelRef: formPanelRef,
  } = useModalA11y(modalMode !== null, closeFormModal)

  const {
    panelRef: deletePanelRef,
    closing: deleteClosing,
    requestClose: requestDeleteClose,
  } = useModalA11y(deleteTarget !== null, () => setDeleteTarget(null))

  const {
    panelRef: resetPanelRef,
  } = useModalA11y(resetTarget !== null, () => {
    setResetTarget(null)
    setResetPassword('')
    setResetError(null)
    setShowResetPassword(false)
  })

  // -------------------------------------------------------------------------
  // Queries & Mutations (always called, regardless of admin status)
  // -------------------------------------------------------------------------

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      closeFormModal()
      toast.success(t('toast.createSuccess'))
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      closeFormModal()
      toast.success(t('toast.updateSuccess'))
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err))
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      usersApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      toast.success(t('toast.updateSuccess'))
    },
    onError: (err: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(err))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      setDeleteTarget(null)
      toast.success(t('toast.deleteSuccess'))
    },
    onError: (err: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(err))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      setResetTarget(null)
      setResetPassword('')
      setResetError(null)
      setShowResetPassword(false)
      toast.success(t('users.resetPasswordSuccess'))
    },
    onError: (err: unknown) => {
      setResetError(getApiErrorMessage(err))
    },
  })

  // -------------------------------------------------------------------------
  // More Handlers
  // -------------------------------------------------------------------------

  const openCreateModal = useCallback(() => {
    setFormData(EMPTY_FORM)
    setFormError(null)
    setEditingUser(null)
    setShowPassword(false)
    setModalMode('create')
  }, [])

  const openEditModal = useCallback((user: UserType) => {
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      is_admin: user.is_admin,
    })
    setFormError(null)
    setEditingUser(user)
    setShowPassword(false)
    setModalMode('edit')
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setFormError(null)

      if (modalMode === 'create') {
        createMutation.mutate({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          is_admin: formData.is_admin,
        })
      } else if (modalMode === 'edit' && editingUser) {
        const updates: UpdateUserRequest = {}
        if (formData.username.trim() !== editingUser.username) {
          updates.username = formData.username.trim()
        }
        if (formData.email.trim() !== editingUser.email) {
          updates.email = formData.email.trim()
        }
        if (formData.is_admin !== editingUser.is_admin) {
          updates.is_admin = formData.is_admin
        }
        updateMutation.mutate({ id: editingUser.id, data: updates })
      }
    },
    [modalMode, formData, editingUser, createMutation, updateMutation],
  )

  const handleDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const users = usersQuery.data ?? []
  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const isDeleting = deleteMutation.isPending

  // Filtered users
  const filteredUsers = searchQuery.trim()
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : users

  // Stats
  const adminCount = users.filter((u) => u.is_admin).length
  const activeCount = users.filter((u) => u.is_active).length

  // -------------------------------------------------------------------------
  // Admin check (AFTER all hooks)
  // -------------------------------------------------------------------------

  if (!isAdmin) {
    return <AccessDenied message={t('users.accessDenied')} />
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="page-reveal space-y-8">
      {/* ================================================================= */}
      {/* Header                                                            */}
      {/* ================================================================= */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="icon-circle icon-circle-lg"
            style={{
              backgroundColor: 'var(--color-brand-500)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <UsersIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('users.title')}
              </h1>
              {!usersQuery.isLoading && (
                <span
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-bold tabular-nums"
                  style={{
                    background: 'var(--bg-info)',
                    color: 'var(--color-info)',
                    border: '1px solid var(--border-info)',
                  }}
                >
                  {users.length}
                </span>
              )}
            </div>
            <p
              className="mt-0.5 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('users.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          {t('users.add')}
        </button>
      </div>

      {/* ================================================================= */}
      {/* Search & Stats Bar                                                */}
      {/* ================================================================= */}
      {!usersQuery.isLoading && users.length > 0 && (
        <div className="animate-fade-in-up stagger-2 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute inset-inline-start-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="input w-full ps-9 pe-3 py-2 text-sm"
              dir="auto"
            />
          </div>

          <div className="ms-auto flex items-center gap-2.5">
            {/* Admin stat */}
            <div
              className="flex items-center gap-2 rounded-xl px-3.5 py-2"
              style={{
                backgroundColor: 'var(--bg-info)',
                border: '1px solid var(--border-info)',
              }}
            >
              <Crown className="h-3.5 w-3.5" style={{ color: 'var(--color-info)' }} />
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: 'var(--color-info)' }}
              >
                {adminCount}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('users.admin')}
              </span>
            </div>

            {/* Active stat */}
            <div
              className="flex items-center gap-2 rounded-xl px-3.5 py-2"
              style={{
                backgroundColor: 'var(--bg-success)',
                border: '1px solid var(--border-success)',
              }}
            >
              <UserCheck className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: 'var(--color-success)' }}
              >
                {activeCount}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('users.active')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Users List Card                                                   */}
      {/* ================================================================= */}
      <div className="animate-fade-in-up stagger-3 card overflow-hidden">
        {/* Content */}
        {usersQuery.isLoading ? (
          <TableSkeleton />
        ) : usersQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="warning-pulse flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-8 w-8" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('common.error')}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {getApiErrorMessage(usersQuery.error)}
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="empty-float flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <UsersIcon className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('users.noUsers')}
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="btn-primary mt-2 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              {t('users.add')}
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Search className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {t('common.noResults')}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-5">
            {filteredUsers.map((user, index) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUser?.id}
                isRtl={isRtl}
                index={index}
                onEdit={openEditModal}
                onDelete={setDeleteTarget}
                onToggleActive={(id, isActive) => toggleActiveMutation.mutate({ id, is_active: isActive })}
                onResetPassword={setResetTarget}
                isTogglingActive={toggleActiveMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Create / Edit Modal                                                */}
      {/* ================================================================= */}
      {modalMode !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeFormModal()
          }}
        >
          {/* Backdrop */}
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            ref={formPanelRef}
            className="modal-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border p-0"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Accent gradient bar */}
            <div
              className="h-1"
              style={{ backgroundColor: 'var(--color-brand-500)' }}
            />

            <div className="p-7">
              {/* Modal Header */}
              <div className="mb-7 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="icon-circle icon-circle-md"
                    style={{
                      background: 'var(--bg-info)',
                      color: 'var(--color-info)',
                    }}
                  >
                    {modalMode === 'create' ? (
                      <Plus className="h-5 w-5" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h2
                      id="user-modal-title"
                      className="text-lg font-bold tracking-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {modalMode === 'create' ? t('users.addUser') : t('users.editUser')}
                    </h2>
                    {modalMode === 'edit' && editingUser && (
                      <p
                        className="mt-0.5 max-w-[280px] truncate text-xs"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {editingUser.username}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeFormModal}
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Error banner */}
              {formError && (
                <div
                  className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--bg-danger)',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--border-danger)',
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username */}
                <div>
                  <label
                    htmlFor="user-username"
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <User className="h-3.5 w-3.5" />
                    {t('users.username')}
                  </label>
                  <input
                    id="user-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, username: e.target.value }))
                    }
                    className="input w-full text-sm font-medium"
                    placeholder={t('users.usernamePlaceholder')}
                    dir="auto"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="user-email"
                    className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {t('users.email')}
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="input w-full text-sm font-medium"
                    placeholder={t('users.emailPlaceholder')}
                    dir="ltr"
                  />
                </div>

                {/* Password (only for create) */}
                {modalMode === 'create' && (
                  <div>
                    <label
                      htmlFor="user-password"
                      className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {t('users.password')}
                    </label>
                    <div className="relative">
                      <input
                        id="user-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        maxLength={128}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        className="input w-full pe-10 text-sm font-medium"
                        placeholder={t('users.passwordPlaceholder')}
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-inline-end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-tertiary)' }}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin toggle */}
                <div
                  className="flex items-center justify-between rounded-2xl border px-5 py-4 transition-all duration-300"
                  style={{
                    borderColor: formData.is_admin ? 'var(--border-info)' : 'var(--border-primary)',
                    backgroundColor: formData.is_admin ? 'var(--bg-info)' : 'var(--bg-primary)',
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="icon-circle icon-circle-sm transition-all duration-300"
                      style={{
                        backgroundColor: formData.is_admin ? 'var(--bg-info)' : 'var(--bg-hover)',
                        color: formData.is_admin ? 'var(--color-info)' : 'var(--text-tertiary)',
                        border: formData.is_admin ? '1px solid var(--border-info)' : '1px solid transparent',
                      }}
                    >
                      {formData.is_admin ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                    </div>
                    <label
                      htmlFor="user-is-admin"
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('users.adminRole')}
                    </label>
                  </div>
                  <button
                    id="user-is-admin"
                    type="button"
                    role="switch"
                    aria-checked={formData.is_admin}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        is_admin: !prev.is_admin,
                      }))
                    }
                    className="relative h-7 w-12 shrink-0 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: formData.is_admin ? 'var(--color-info)' : 'var(--bg-hover)',
                      boxShadow: formData.is_admin
                        ? '0 2px 8px rgba(0,0,0,0.15)'
                        : 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300',
                        formData.is_admin
                          ? isRtl ? 'right-[22px]' : 'left-[22px]'
                          : isRtl ? 'right-0.5' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center justify-end gap-3 border-t pt-6"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <button
                    type="button"
                    onClick={closeFormModal}
                    className="btn-secondary px-5 py-2.5 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {modalMode === 'create' ? t('users.createButton') : t('common.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Delete Confirmation Modal                                          */}
      {/* ================================================================= */}
      {deleteTarget !== null && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${deleteClosing ? 'modal-closing' : ''}`}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestDeleteClose()
          }}
        >
          {/* Backdrop */}
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
            {/* Red accent gradient bar */}
            <div
              className="h-1"
              style={{
                backgroundColor: 'var(--color-danger)',
              }}
            />

            <div className="p-7">
              {/* Icon & Title */}
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
                  id="delete-dialog-title"
                  className="text-base font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('users.deleteConfirmTitle')}
                </h3>

                <p
                  id="delete-dialog-desc"
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('users.deleteConfirmMessage', {
                    username: deleteTarget.username,
                  })}
                </p>

                {/* Username highlight */}
                <div
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2"
                  style={{
                    backgroundColor: 'var(--bg-danger)',
                    border: '1px solid var(--border-danger)',
                  }}
                >
                  <UserAvatar
                    username={deleteTarget.username}
                    isAdmin={deleteTarget.is_admin}
                    size="sm"
                  />
                  <span
                    className="max-w-[180px] truncate text-sm font-semibold"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    {deleteTarget.username}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={requestDeleteClose}
                  className="btn-secondary flex-1 py-2.5 text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--color-danger)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Reset Password Modal                                              */}
      {/* ================================================================= */}
      {resetTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pw-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setResetTarget(null)
              setResetPassword('')
              setResetError(null)
              setShowResetPassword(false)
            }
          }}
        >
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            ref={resetPanelRef}
            className="modal-panel relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div
              className="h-1"
              style={{ backgroundColor: 'var(--color-brand-500)' }}
            />

            <div className="p-7">
              <div className="mb-6 flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: 'var(--bg-info)',
                    border: '1px solid var(--border-info)',
                  }}
                >
                  <Key className="h-7 w-7" style={{ color: 'var(--color-info)' }} />
                </div>

                <h3
                  id="reset-pw-title"
                  className="text-base font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('users.resetPasswordTitle')}
                </h3>

                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('users.newPasswordForUser', { username: resetTarget.username })}
                </p>
              </div>

              {resetError && (
                <div
                  className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--bg-danger)',
                    color: 'var(--color-danger)',
                    border: '1px solid var(--border-danger)',
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="mb-6">
                <label
                  htmlFor="reset-pw-input"
                  className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {t('settings.newPassword')}
                </label>
                <div className="relative">
                  <input
                    id="reset-pw-input"
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={128}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="input w-full pe-10 text-sm font-medium"
                    placeholder={t('users.passwordPlaceholder')}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    className="absolute inset-inline-end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-tertiary)' }}
                    tabIndex={-1}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setResetTarget(null)
                    setResetPassword('')
                    setResetError(null)
                    setShowResetPassword(false)
                  }}
                  className="btn-secondary flex-1 py-2.5 text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => {
                    if (resetTarget && resetPassword.length >= 6) {
                      resetPasswordMutation.mutate({ id: resetTarget.id, password: resetPassword })
                    }
                  }}
                  disabled={resetPasswordMutation.isPending || resetPassword.length < 6}
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('users.resetPassword')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
