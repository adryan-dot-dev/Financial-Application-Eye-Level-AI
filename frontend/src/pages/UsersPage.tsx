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
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('animate-fade-in-up flex items-center gap-4 rounded-xl p-4', `stagger-${Math.min(i + 1, 8)}`)}
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-3 w-48 rounded" />
          </div>
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access Denied Component
// ---------------------------------------------------------------------------

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="page-reveal flex flex-col items-center justify-center gap-4 py-20">
      <div
        className="empty-float flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-danger)' }}
      >
        <AlertTriangle className="h-10 w-10" style={{ color: 'var(--color-danger)' }} />
      </div>
      <p
        className="text-lg font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {message}
      </p>
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
  isTogglingActive,
}: {
  user: UserType
  isSelf: boolean
  isRtl: boolean
  index: number
  onEdit: (user: UserType) => void
  onDelete: (user: UserType) => void
  onToggleActive: (id: string, isActive: boolean) => void
  isTogglingActive: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'animate-fade-in-up group flex items-center gap-4 rounded-xl border px-5 py-4 transition-all hover:shadow-sm',
        `stagger-${Math.min(index + 1, 8)}`,
      )}
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: isSelf
          ? 'rgba(59, 130, 246, 0.03)'
          : 'var(--bg-card)',
        background: isSelf
          ? 'rgba(59, 130, 246, 0.03)'
          : undefined,
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
        style={{
          background: user.is_admin
            ? 'rgba(59, 130, 246, 0.15)'
            : 'var(--bg-hover)',
          color: user.is_admin ? '#3B82F6' : 'var(--text-secondary)',
        }}
      >
        {user.username.charAt(0).toUpperCase()}
      </div>

      {/* User info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {user.username}
          </p>
          {isSelf && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--border-focus)',
              }}
            >
              {t('users.you')}
            </span>
          )}
        </div>
        <p
          className="mt-0.5 truncate text-xs"
          style={{ color: 'var(--text-tertiary)' }}
          dir="ltr"
        >
          {user.email}
        </p>
      </div>

      {/* Role badge */}
      {user.is_admin ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            color: '#3B82F6',
          }}
        >
          <Crown className="h-3 w-3" />
          {t('users.admin')}
        </span>
      ) : (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldOff className="h-3 w-3" />
          {t('users.user')}
        </span>
      )}

      {/* Status badge with toggle */}
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
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
          !isSelf && 'cursor-pointer hover:shadow-sm',
          isSelf && 'cursor-default',
        )}
        style={
          user.is_active
            ? {
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.15)',
              }
            : {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.15)',
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

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={() => onEdit(user)}
          title={t('users.edit')}
          className="action-btn action-btn-edit rounded-lg p-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => !isSelf && onDelete(user)}
          disabled={isSelf}
          title={isSelf ? t('users.cannotDeleteSelf') : t('users.delete')}
          className={cn(
            'action-btn rounded-lg p-2',
            isSelf && 'cursor-not-allowed opacity-30',
            !isSelf && 'action-btn-delete',
          )}
          style={{ color: isSelf ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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

  useEffect(() => {
    document.title = t('pageTitle.users')
  }, [t])

  // State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Handlers (declared before useModalA11y so closeFormModal is available)
  // -------------------------------------------------------------------------

  const closeFormModal = useCallback(() => {
    setModalMode(null)
    setEditingUser(null)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }, [])

  // Modal A11y
  const {
    panelRef: formPanelRef,
  } = useModalA11y(modalMode !== null, closeFormModal)

  const {
    panelRef: deletePanelRef,
  } = useModalA11y(deleteTarget !== null, () => setDeleteTarget(null))

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

  // -------------------------------------------------------------------------
  // More Handlers
  // -------------------------------------------------------------------------

  const openCreateModal = useCallback(() => {
    setFormData(EMPTY_FORM)
    setFormError(null)
    setEditingUser(null)
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
    <div className="page-reveal space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('users.title')}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('users.subtitle')}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          {t('users.add')}
        </button>
      </div>

      {/* Users List Card */}
      <div className="animate-fade-in-up stagger-2 card overflow-hidden">
        {/* Summary header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--border-focus)',
              }}
            >
              <UsersIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('users.title')}
              </h2>
              {!usersQuery.isLoading && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {users.length} {t('users.title').toLowerCase()}
                </p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {!usersQuery.isLoading && users.length > 0 && (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                }}
              >
                <Crown className="h-3 w-3" />
                {users.filter((u) => u.is_admin).length}
              </div>
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10B981',
                }}
              >
                <UserCheck className="h-3 w-3" />
                {users.filter((u) => u.is_active).length}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {usersQuery.isLoading ? (
          <TableSkeleton />
        ) : usersQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div
              className="empty-float flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-7 w-7" style={{ color: 'var(--color-danger)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('common.error')}
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div
              className="empty-float flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <UsersIcon className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {t('users.noUsers')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {users.map((user, index) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUser?.id}
                isRtl={isRtl}
                index={index}
                onEdit={openEditModal}
                onDelete={setDeleteTarget}
                onToggleActive={(id, isActive) => toggleActiveMutation.mutate({ id, is_active: isActive })}
                isTogglingActive={toggleActiveMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Create / Edit Modal                                                */}
      {/* ----------------------------------------------------------------- */}
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
            {/* Accent bar */}
            <div
              className="h-1"
              style={{
                background: '#3B82F6',
              }}
            />

            <div className="p-6">
              {/* Modal Header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--border-focus)',
                    }}
                  >
                    <User className="h-5 w-5" />
                  </div>
                  <h2
                    id="user-modal-title"
                    className="text-lg font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {modalMode === 'create' ? t('users.addUser') : t('users.editUser')}
                  </h2>
                </div>
                <button
                  onClick={closeFormModal}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={t('common.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Error banner */}
              {formError && (
                <div
                  className="mb-4 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#EF4444',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                  }}
                >
                  {formError}
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
                    className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
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
                    className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
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
                    <input
                      id="user-password"
                      type="password"
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
                      className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder={t('users.passwordPlaceholder')}
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Admin toggle */}
                <div
                  className="flex items-center justify-between rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: formData.is_admin ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-primary)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg transition-all"
                      style={{
                        backgroundColor: formData.is_admin ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-hover)',
                        color: formData.is_admin ? '#3B82F6' : 'var(--text-tertiary)',
                      }}
                    >
                      {formData.is_admin ? <ShieldCheck className="h-4.5 w-4.5" /> : <ShieldOff className="h-4.5 w-4.5" />}
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
                      backgroundColor: formData.is_admin ? '#3B82F6' : 'var(--bg-hover)',
                      boxShadow: formData.is_admin ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
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
                <div className="flex items-center justify-end gap-3 border-t pt-5" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    type="button"
                    onClick={closeFormModal}
                    className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
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

      {/* ----------------------------------------------------------------- */}
      {/* Delete Confirmation Modal                                          */}
      {/* ----------------------------------------------------------------- */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null)
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
            {/* Red accent bar */}
            <div
              className="h-1"
              style={{ background: 'linear-gradient(90deg, #F87171, #EF4444, #DC2626)' }}
            />

            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="warning-pulse flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                >
                  <Trash2 className="h-6 w-6" style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <h3
                    id="delete-dialog-title"
                    className="text-base font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('users.deleteConfirmTitle')}
                  </h3>
                  <p
                    id="delete-dialog-desc"
                    className="mt-0.5 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('users.deleteConfirmMessage', {
                      username: deleteTarget.username,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{
                    backgroundColor: '#EF4444',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
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
    </div>
  )
}
