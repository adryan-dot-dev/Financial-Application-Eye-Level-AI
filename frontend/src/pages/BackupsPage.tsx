import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Database,
  Shield,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Plus,
  AlertTriangle,
  HardDrive,
  Calendar,
  FileArchive,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import type { BackupResponse } from '@/api/backups'
import { backupsApi } from '@/api/backups'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { cn, formatDate } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '--'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const config = useMemo(() => {
    switch (status) {
      case 'completed':
        return {
          bg: 'var(--bg-success)',
          color: 'var(--color-success)',
          icon: <CheckCircle className="h-3.5 w-3.5" />,
        }
      case 'failed':
        return {
          bg: 'var(--bg-danger)',
          color: 'var(--color-danger)',
          icon: <XCircle className="h-3.5 w-3.5" />,
        }
      case 'in_progress':
        return {
          bg: 'var(--bg-warning)',
          color: 'var(--color-warning)',
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        }
      default:
        return {
          bg: 'var(--bg-hover)',
          color: 'var(--text-tertiary)',
          icon: <Clock className="h-3.5 w-3.5" />,
        }
    }
  }, [status])

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.icon}
      {t(`backups.status_${status}`, status)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-danger)' }}
      >
        <Shield className="h-8 w-8" style={{ color: 'var(--color-danger)' }} />
      </div>
      <h2
        className="text-lg font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {message}
      </h2>
      <p
        className="mt-2 max-w-sm text-center text-sm leading-relaxed"
        style={{ color: 'var(--text-tertiary)' }}
      >
        This area requires administrator privileges.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BackupsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-fade-in-up card overflow-hidden p-5',
            `stagger-${Math.min(i + 2, 8)}`,
          )}
        >
          <div className="flex items-center gap-4">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-48 rounded-md" />
              <div className="skeleton h-3 w-32 rounded-md" />
            </div>
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="flex gap-2">
              <div className="skeleton h-8 w-20 rounded-lg" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="animate-fade-in-up stagger-3 flex flex-col items-center justify-center py-20">
      <div
        className="empty-float mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        <Database className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <p
        className="text-sm font-medium"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {message}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Backup card
// ---------------------------------------------------------------------------

function BackupCard({
  backup,
  isRtl,
  index,
  onVerify,
  onDelete,
  isVerifying,
  isDeleting,
}: {
  backup: BackupResponse
  isRtl: boolean
  index: number
  onVerify: () => void
  onDelete: () => void
  isVerifying: boolean
  isDeleting: boolean
}) {
  const { t } = useTranslation()

  return (
    <article
      className={cn(
        'row-enter hover-lift group overflow-hidden rounded-2xl border transition-all duration-200 card-hover',
      )}
      style={{
        '--row-index': Math.min(index, 15),
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-xs)',
      } as React.CSSProperties}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {/* Icon */}
        <div
          className="icon-circle icon-circle-lg flex shrink-0 items-center justify-center"
          style={{
            backgroundColor: backup.status === 'completed' ? 'var(--bg-success)' : backup.status === 'failed' ? 'var(--bg-danger)' : 'var(--bg-info)',
            color: backup.status === 'completed' ? 'var(--color-success)' : backup.status === 'failed' ? 'var(--color-danger)' : 'var(--color-info)',
          }}
        >
          <FileArchive className="h-5 w-5" />
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
              title={backup.filename}
            >
              {backup.filename}
            </h3>
            <StatusBadge status={backup.status} />
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: backup.backup_type === 'manual' ? 'var(--bg-info)' : 'var(--bg-warning)',
                color: backup.backup_type === 'manual' ? 'var(--color-info)' : 'var(--color-warning)',
              }}
            >
              {t(`backups.type_${backup.backup_type}`, backup.backup_type)}
            </span>
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {/* Size */}
            <span className="inline-flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatFileSize(backup.file_size)}
            </span>

            {/* Duration */}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(backup.duration_seconds)}
            </span>

            {/* Date */}
            <span className="inline-flex items-center gap-1 ltr-nums">
              <Calendar className="h-3 w-3" />
              {backup.created_at ? formatDate(backup.created_at, isRtl ? 'he-IL' : 'en-US') : '--'}
            </span>

            {/* Verification */}
            <span className="inline-flex items-center gap-1">
              {backup.is_verified ? (
                <>
                  <ShieldCheck className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--color-success)' }}>{t('backups.verified')}</span>
                </>
              ) : (
                <>
                  <ShieldOff className="h-3 w-3" />
                  <span>{t('backups.notVerified')}</span>
                </>
              )}
            </span>
          </div>

          {/* Error message */}
          {backup.error_message && (
            <p
              className="mt-1.5 text-xs"
              style={{ color: 'var(--color-danger)' }}
            >
              {backup.error_message}
            </p>
          )}

          {/* Checksum (if verified) */}
          {backup.verification_checksum && (
            <p
              className="mt-1 truncate font-mono text-[10px]"
              style={{ color: 'var(--text-tertiary)' }}
              title={backup.verification_checksum}
            >
              SHA256: {backup.verification_checksum}
            </p>
          )}
        </div>

        {/* Actions */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-1.5',
            'opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100',
          )}
        >
          {/* Verify */}
          {!backup.is_verified && backup.status === 'completed' && (
            <button
              onClick={onVerify}
              disabled={isVerifying}
              aria-label={t('backups.verify')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                'transition-all duration-150',
                'hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)] focus-visible:ring-offset-1',
                'disabled:opacity-50',
              )}
              style={{
                backgroundColor: 'var(--bg-info)',
                color: 'var(--color-info)',
              }}
            >
              {isVerifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              {t('backups.verify')}
            </button>
          )}

          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={isDeleting}
            aria-label={t('common.delete')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
              'transition-all duration-150',
              'hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-1',
              'disabled:opacity-50',
            )}
            style={{
              backgroundColor: 'var(--bg-danger)',
              color: 'var(--text-danger)',
            }}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {t('common.delete')}
          </button>
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BackupsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const toast = useToast()
  const isRtl = i18n.language === 'he'
  const isAdmin = !!user?.is_admin

  useEffect(() => {
    document.title = t('pageTitle.backups')
  }, [t])

  // -- State --
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<BackupResponse | null>(null)

  // -- Data --
  const {
    data: backupsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.backups.list(),
    queryFn: () => backupsApi.list(),
    enabled: isAdmin,
  })

  const {
    data: scheduleData,
  } = useQuery({
    queryKey: queryKeys.backups.schedule(),
    queryFn: () => backupsApi.schedule(),
    enabled: isAdmin,
  })

  const backups = backupsData?.items ?? []
  const totalCount = backupsData?.count ?? 0

  // -- Mutations --
  const createMutation = useMutation({
    mutationFn: () => backupsApi.create(),
    onSuccess: () => {
      toast.success(t('backups.createSuccess'))
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all })
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => backupsApi.verify(id),
    onMutate: (id) => {
      setVerifyingIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      toast.success(t('backups.verifySuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
    onSettled: (_data, _error, id) => {
      setVerifyingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backupsApi.delete(id),
    onMutate: (id) => {
      setDeletingIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      toast.success(t('toast.deleteSuccess'))
      setDeleteTarget(null)
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
    onSettled: (_data, _error, id) => {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all })
    },
  })

  const handleCreate = useCallback(() => {
    createMutation.mutate()
  }, [createMutation])

  const handleDelete = useCallback((backup: BackupResponse) => {
    setDeleteTarget(backup)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id)
    }
  }, [deleteTarget, deleteMutation])

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null)
  }, [])

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
    <div dir={isRtl ? 'rtl' : 'ltr'} className="page-reveal space-y-6">
      {/* ---- Page header ---- */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
          >
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('backups.title')}
            </h1>
            {!isLoading && (
              <p
                className="mt-0.5 text-[13px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('backups.totalCount', { count: totalCount })}
              </p>
            )}
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {createMutation.isPending ? t('backups.creating') : t('backups.create')}
        </button>
      </div>

      {/* ---- Schedule info card ---- */}
      {scheduleData && (
        <div className="animate-fade-in-up stagger-2 card overflow-hidden">
          <div className="flex flex-wrap items-center gap-8 px-6 py-5">
            {/* Backup directory */}
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle-sm flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-info)', color: 'var(--color-info)' }}
              >
                <HardDrive className="h-3.5 w-3.5" />
              </div>
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('backups.backupDir')}
                </p>
                <p
                  className="mt-0.5 font-mono text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {scheduleData.backup_dir}
                </p>
              </div>
            </div>

            {/* Retention days */}
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle-sm flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-warning)', color: 'var(--color-warning)' }}
              >
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('backups.retentionDays')}
                </p>
                <p
                  className="mt-0.5 text-sm font-semibold ltr-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {scheduleData.retention_days} {t('backups.days')}
                </p>
              </div>
            </div>

            {/* Total backups */}
            <div className="flex items-center gap-3">
              <div
                className="icon-circle icon-circle-sm flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-success)', color: 'var(--color-success)' }}
              >
                <Database className="h-3.5 w-3.5" />
              </div>
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('backups.totalBackups')}
                </p>
                <p
                  className="mt-0.5 text-sm font-semibold ltr-nums"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {scheduleData.total_backups}
                </p>
              </div>
            </div>

            {/* Last backup */}
            {scheduleData.last_backup && (
              <div className="flex items-center gap-3">
                <div
                  className="icon-circle icon-circle-sm flex items-center justify-center"
                  style={{
                    backgroundColor: scheduleData.last_backup.status === 'completed' ? 'var(--bg-success)' : 'var(--bg-danger)',
                    color: scheduleData.last_backup.status === 'completed' ? 'var(--color-success)' : 'var(--color-danger)',
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('backups.lastBackup')}
                  </p>
                  <p
                    className="mt-0.5 text-sm font-medium ltr-nums"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {scheduleData.last_backup.created_at
                      ? formatDate(scheduleData.last_backup.created_at, isRtl ? 'he-IL' : 'en-US')
                      : '--'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Backups list ---- */}
      <div>
        {isLoading ? (
          <BackupsSkeleton />
        ) : isError ? (
          <div className="animate-fade-in-up stagger-3 flex flex-col items-center justify-center py-20" role="alert">
            <div
              className="empty-float mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-7 w-7" style={{ color: 'var(--color-danger)' }} />
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('common.error')}
            </p>
          </div>
        ) : backups.length === 0 ? (
          <EmptyState message={t('backups.noBackups')} />
        ) : (
          <div className="space-y-3" role="list" aria-label={t('backups.listLabel')}>
            {backups.map((backup, index) => (
              <BackupCard
                key={backup.id}
                backup={backup}
                isRtl={isRtl}
                index={index}
                onVerify={() => verifyMutation.mutate(backup.id)}
                onDelete={() => handleDelete(backup)}
                isVerifying={verifyingIds.has(backup.id)}
                isDeleting={deletingIds.has(backup.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Delete confirmation modal ---- */}
      {deleteTarget && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={cancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-backup-dialog-title"
        >
          <div
            className="modal-panel w-full max-w-md border p-7"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning icon */}
            <div className="mb-5 flex justify-center">
              <div className="relative">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: 'var(--bg-danger)' }}
                >
                  <Trash2 className="h-8 w-8" style={{ color: 'var(--color-danger)' }} />
                </div>
              </div>
            </div>

            {/* Title */}
            <h3
              id="delete-backup-dialog-title"
              className="mb-2 text-center text-lg font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('backups.deleteConfirmTitle')}
            </h3>

            {/* Filename badge */}
            <div className="mb-4 flex justify-center">
              <span
                className="max-w-full truncate rounded-lg px-3 py-1.5 font-mono text-sm font-medium"
                style={{
                  backgroundColor: 'var(--bg-danger)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--border-danger)',
                }}
                title={deleteTarget.filename}
              >
                {deleteTarget.filename}
              </span>
            </div>

            {/* Message */}
            <p
              className="mb-6 text-center text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('backups.deleteConfirmMessage')}
            </p>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="btn-secondary flex-1 px-4 py-2.5 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--color-danger)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                }}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
