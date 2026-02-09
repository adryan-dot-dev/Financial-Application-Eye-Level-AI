import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  BellOff,
  CheckCheck,
  X,
  Loader2,
} from 'lucide-react'
import type { Alert } from '@/types'
import { alertsApi } from '@/api/alerts'
import { cn, formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'unread' | 'critical' | 'warning' | 'info'

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityConfig(severity: Alert['severity']) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.25)',
        accent: '#EF4444',
        icon: <AlertTriangle className="h-5 w-5" />,
      }
    case 'warning':
      return {
        bg: 'rgba(245, 158, 11, 0.08)',
        border: 'rgba(245, 158, 11, 0.25)',
        accent: '#F59E0B',
        icon: <AlertCircle className="h-5 w-5" />,
      }
    case 'info':
    default:
      return {
        bg: 'rgba(59, 130, 246, 0.08)',
        border: 'rgba(59, 130, 246, 0.25)',
        accent: '#3B82F6',
        icon: <Info className="h-5 w-5" />,
      }
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-4 w-48 animate-pulse rounded"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              />
              <div
                className="h-3 w-72 animate-pulse rounded"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              />
              <div
                className="h-3 w-24 animate-pulse rounded"
                style={{ backgroundColor: 'var(--bg-hover)' }}
              />
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
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        <BellOff className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
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
// Alert card
// ---------------------------------------------------------------------------

function AlertCard({
  alert,
  isRtl,
  onMarkRead,
  onDismiss,
  isMarkingRead,
  isDismissing,
  index,
}: {
  alert: Alert
  isRtl: boolean
  onMarkRead: () => void
  onDismiss: () => void
  isMarkingRead: boolean
  isDismissing: boolean
  index: number
}) {
  const { t } = useTranslation()
  const sev = severityConfig(alert.severity)

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
        borderLeftWidth: !isRtl && !alert.is_read ? '4px' : undefined,
        borderLeftColor: !isRtl && !alert.is_read ? sev.accent : undefined,
        borderRightWidth: isRtl && !alert.is_read ? '4px' : undefined,
        borderRightColor: isRtl && !alert.is_read ? sev.accent : undefined,
        animation: `alertFadeIn 0.3s ease-out ${index * 0.05}s both`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Severity icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: sev.bg, color: sev.accent }}
        >
          {sev.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn('text-sm leading-snug', alert.is_read ? 'font-medium' : 'font-bold')}
              style={{ color: 'var(--text-primary)' }}
            >
              {alert.title}
            </h3>
            {/* Severity badge */}
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: sev.bg, color: sev.accent }}
            >
              {t(`alerts.${alert.severity}`)}
            </span>
          </div>

          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {alert.message}
          </p>

          <div className="mt-3 flex items-center justify-between">
            {/* Timestamp */}
            <span
              className="text-xs ltr-nums"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {formatDate(alert.created_at, isRtl ? 'he-IL' : 'en-US')}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!alert.is_read && (
                <button
                  onClick={onMarkRead}
                  disabled={isMarkingRead}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {isMarkingRead ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3" />
                  )}
                  {t('alerts.markRead')}
                </button>
              )}
              <button
                onClick={onDismiss}
                disabled={isDismissing}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#EF4444',
                }}
              >
                {isDismissing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {t('alerts.dismiss')}
              </button>
            </div>
          </div>
        </div>

        {/* Unread dot */}
        {!alert.is_read && (
          <div
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: sev.accent }}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isRtl = i18n.language === 'he'

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(new Set())
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  // ---- Data ----
  const {
    data: alertsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['alerts', 'list'],
    queryFn: () => alertsApi.list(),
  })

  const alerts = alertsData?.items ?? []
  const unreadCount = alertsData?.unread_count ?? 0

  // ---- Mutations ----
  const markReadMutation = useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id),
    onMutate: (id) => {
      setMarkingReadIds((prev) => new Set(prev).add(id))
    },
    onSettled: (_data, _error, id) => {
      setMarkingReadIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => alertsApi.dismiss(id),
    onMutate: (id) => {
      setDismissingIds((prev) => new Set(prev).add(id))
    },
    onSettled: (_data, _error, id) => {
      setDismissingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  // Mark all read: sequentially mark each unread alert
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)

  const handleMarkAllRead = async () => {
    const unreadAlerts = alerts.filter((a) => !a.is_read && !a.is_dismissed)
    if (unreadAlerts.length === 0) return
    setIsMarkingAllRead(true)
    try {
      for (const alert of unreadAlerts) {
        await alertsApi.markRead(alert.id)
      }
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    } finally {
      setIsMarkingAllRead(false)
    }
  }

  // ---- Filtering ----
  const filteredAlerts = useMemo(() => {
    // Exclude dismissed alerts from display
    const nonDismissed = alerts.filter((a) => !a.is_dismissed)

    // Sort by date, newest first
    const sorted = [...nonDismissed].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    switch (activeFilter) {
      case 'unread':
        return sorted.filter((a) => !a.is_read)
      case 'critical':
        return sorted.filter((a) => a.severity === 'critical')
      case 'warning':
        return sorted.filter((a) => a.severity === 'warning')
      case 'info':
        return sorted.filter((a) => a.severity === 'info')
      default:
        return sorted
    }
  }, [alerts, activeFilter])

  // ---- Filter tabs config ----
  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: t('alerts.all') },
    { key: 'unread', label: t('alerts.unread'), count: unreadCount },
    { key: 'critical', label: t('alerts.critical') },
    { key: 'warning', label: t('alerts.warning') },
    { key: 'info', label: t('alerts.info') },
  ]

  // ---- Empty state messages ----
  const emptyMessages: Record<FilterTab, string> = {
    all: t('alerts.noAlertsDesc'),
    unread: t('alerts.noUnread'),
    critical: t('alerts.noCritical'),
    warning: t('alerts.noWarning'),
    info: t('alerts.noInfo'),
  }

  // ---- Render ----

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6">
      {/* Inline animation keyframes */}
      <style>{`
        @keyframes alertFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* ---- Page header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('alerts.title')}
          </h1>
          {unreadCount > 0 && (
            <span
              className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold text-white"
              style={{ backgroundColor: '#EF4444' }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {/* Bulk action: Mark all read */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
            }}
          >
            {isMarkingAllRead ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            {t('alerts.markAllRead')}
          </button>
        )}
      </div>

      {/* ---- Filter tabs ---- */}
      <div
        className="flex gap-1 overflow-x-auto rounded-xl border p-1"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
              )}
              style={{
                backgroundColor: isActive ? 'var(--border-focus)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                  )}
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-hover)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ---- Content ---- */}
      {isLoading ? (
        <AlertsSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <AlertTriangle className="h-8 w-8" style={{ color: '#EF4444' }} />
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('common.error')}
          </p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <EmptyState message={emptyMessages[activeFilter]} />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isRtl={isRtl}
              index={index}
              onMarkRead={() => markReadMutation.mutate(alert.id)}
              onDismiss={() => dismissMutation.mutate(alert.id)}
              isMarkingRead={markingReadIds.has(alert.id)}
              isDismissing={dismissingIds.has(alert.id)}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {!isLoading && !isError && alerts.filter((a) => !a.is_dismissed).length > 0 && (
        <div
          className="flex items-center justify-center gap-6 rounded-xl border px-4 py-3"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {(['critical', 'warning', 'info'] as const).map((severity) => {
            const sev = severityConfig(severity)
            const count = alerts.filter(
              (a) => a.severity === severity && !a.is_dismissed,
            ).length
            return (
              <div key={severity} className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded"
                  style={{ backgroundColor: sev.bg, color: sev.accent }}
                >
                  <Bell className="h-3 w-3" />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {count} {t(`alerts.${severity}`)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
