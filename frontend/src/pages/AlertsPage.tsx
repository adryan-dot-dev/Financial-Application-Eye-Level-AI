import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
  Eye,
  EyeOff,
  Clock,
  Calendar,
  Volume2,
  VolumeX,
  ChevronDown,
} from 'lucide-react'
import type { Alert } from '@/types'
import { alertsApi } from '@/api/alerts'
import { settingsApi } from '@/api/settings'
import { cn, formatDate } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReadFilterTab = 'all' | 'unread' | 'read'
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  const isHe = locale === 'he'

  if (diffMinutes < 1) {
    return isHe ? '\u05E2\u05DB\u05E9\u05D9\u05D5' : 'Just now'
  }
  if (diffMinutes < 60) {
    return isHe
      ? `\u05DC\u05E4\u05E0\u05D9 ${diffMinutes} \u05D3\u05E7\u05D5\u05EA`
      : `${diffMinutes}m ago`
  }
  if (diffHours < 24) {
    return isHe
      ? `\u05DC\u05E4\u05E0\u05D9 ${diffHours} \u05E9\u05E2\u05D5\u05EA`
      : `${diffHours}h ago`
  }
  if (diffDays === 1) {
    return isHe ? '\u05D0\u05EA\u05DE\u05D5\u05DC' : 'Yesterday'
  }
  if (diffDays < 7) {
    return isHe
      ? `\u05DC\u05E4\u05E0\u05D9 ${diffDays} \u05D9\u05DE\u05D9\u05DD`
      : `${diffDays}d ago`
  }
  // Fallback to formatted date
  return formatDate(dateStr, isHe ? 'he-IL' : 'en-US')
}

// ---------------------------------------------------------------------------
// Notification sound hook
// ---------------------------------------------------------------------------

function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null)

  const playSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.15)
    } catch {
      // Web Audio API not available - silently fail
    }
  }, [])

  return playSound
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityConfig(severity: Alert['severity']) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'var(--bg-danger)',
        border: '#EF4444',
        accent: 'var(--color-danger)',
        icon: <AlertTriangle className="h-6 w-6" />,
        gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.03))',
        badgeBg: 'linear-gradient(135deg, #EF4444, #DC2626)',
        glowColor: 'rgba(239, 68, 68, 0.15)',
      }
    case 'warning':
      return {
        bg: 'var(--bg-warning)',
        border: '#F59E0B',
        accent: 'var(--color-warning)',
        icon: <AlertCircle className="h-6 w-6" />,
        gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.03))',
        badgeBg: 'linear-gradient(135deg, #F59E0B, #D97706)',
        glowColor: 'rgba(245, 158, 11, 0.15)',
      }
    case 'info':
    default:
      return {
        bg: 'var(--bg-info)',
        border: '#3B82F6',
        accent: 'var(--color-info)',
        icon: <Info className="h-6 w-6" />,
        gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(37, 99, 235, 0.03))',
        badgeBg: 'linear-gradient(135deg, #3B82F6, #2563EB)',
        glowColor: 'rgba(59, 130, 246, 0.15)',
      }
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AlertsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading alerts">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn('animate-fade-in-up card p-5', `stagger-${Math.min(i + 1, 8)}`)}
        >
          <div className="flex items-start gap-4">
            <div className="skeleton h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="skeleton h-4 w-48 rounded" />
                <div className="skeleton h-5 w-16 rounded-full" />
              </div>
              <div className="skeleton h-3 w-72 rounded" />
              <div className="flex items-center justify-between">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="flex gap-2">
                  <div className="skeleton h-7 w-20 rounded-lg" />
                  <div className="skeleton h-7 w-16 rounded-lg" />
                </div>
              </div>
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
    <div className="animate-fade-in-up stagger-3 flex flex-col items-center justify-center py-16">
      <div
        className="empty-float mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        <BellOff className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
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
// Snooze dropdown
// ---------------------------------------------------------------------------

function SnoozeDropdown({
  onSnooze,
  isSnoozePending,
}: {
  onSnooze: (snoozedUntil: string) => void
  isSnoozePending: boolean
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowDatePicker(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const snoozeOptions = [
    {
      label: t('alerts.snoozeOneHour'),
      getDate: () => {
        const d = new Date()
        d.setHours(d.getHours() + 1)
        return d.toISOString()
      },
    },
    {
      label: t('alerts.snoozeTomorrow'),
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(9, 0, 0, 0)
        return d.toISOString()
      },
    },
    {
      label: t('alerts.snoozeOneWeek'),
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        return d.toISOString()
      },
    },
  ]

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSnoozePending}
        aria-label={t('alerts.snooze')}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:opacity-50"
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
        }}
      >
        {isSnoozePending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {t('alerts.snooze')}
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full z-50 mt-1 min-w-48 overflow-hidden rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
            insetInlineEnd: 0,
          }}
        >
          {snoozeOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSnooze(option.getDate())
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              {option.label}
            </button>
          ))}
          <div
            className="border-t"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          {!showDatePicker ? (
            <button
              onClick={() => setShowDatePicker(true)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-primary)' }}
            >
              <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
              {t('alerts.snoozeChooseDate')}
            </button>
          ) : (
            <div className="p-3">
              <input
                type="datetime-local"
                className="w-full rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => {
                  if (e.target.value) {
                    onSnooze(new Date(e.target.value).toISOString())
                    setIsOpen(false)
                    setShowDatePicker(false)
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
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
  onMarkUnread,
  onDismiss,
  onSnooze,
  isMarkingRead,
  isMarkingUnread,
  isDismissing,
  isSnoozePending,
  index,
}: {
  alert: Alert
  isRtl: boolean
  onMarkRead: () => void
  onMarkUnread: () => void
  onDismiss: () => void
  onSnooze: (snoozedUntil: string) => void
  isMarkingRead: boolean
  isMarkingUnread: boolean
  isDismissing: boolean
  isSnoozePending: boolean
  index: number
}) {
  const { t } = useTranslation()
  const sev = severityConfig(alert.severity)
  const isUnread = !alert.is_read
  const locale = isRtl ? 'he' : 'en'

  // Extract emoji from title/message if present
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u
  const titleEmoji = alert.title.match(emojiRegex)?.[0] ?? null
  const messageEmoji = !titleEmoji ? (alert.message.match(emojiRegex)?.[0] ?? null) : null
  const displayEmoji = titleEmoji ?? messageEmoji

  return (
    <article
      role="article"
      aria-label={`${t(`alerts.${alert.severity}`)} ${t('alerts.alertLabel')}: ${alert.title}${isUnread ? ` (${t('alerts.unread')})` : ''}`}
      className={cn(
        'animate-fade-in-up card overflow-hidden transition-all',
        `stagger-${Math.min(index + 1, 8)}`,
      )}
      style={{
        borderInlineStartWidth: '4px',
        borderInlineStartColor: sev.border,
        background: isUnread ? sev.gradient : undefined,
        opacity: alert.is_read ? 0.85 : 1,
        boxShadow: isUnread ? `0 0 20px ${sev.glowColor}` : undefined,
      }}
    >
      <div className="flex items-start gap-4 p-5">
        {/* Severity icon / Emoji */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: sev.bg,
            color: sev.accent,
            opacity: alert.is_read ? 0.6 : 1,
          }}
          aria-hidden="true"
        >
          {displayEmoji ? (
            <span className="text-xl leading-none">{displayEmoji}</span>
          ) : (
            sev.icon
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cn(
                'text-base leading-relaxed',
                isUnread ? 'font-bold' : 'font-normal',
              )}
              style={{
                color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.95rem',
              }}
            >
              {alert.title}
            </h3>
            {/* Severity badge */}
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ background: sev.badgeBg }}
            >
              {t(`alerts.${alert.severity}`)}
            </span>
          </div>

          <p
            className="mt-2 whitespace-pre-line text-sm leading-relaxed"
            style={{ color: isUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
          >
            {alert.message}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {/* Timestamp - relative format */}
            <span
              className="text-xs ltr-nums"
              style={{ color: 'var(--text-tertiary)' }}
              title={formatDate(alert.created_at, isRtl ? 'he-IL' : 'en-US')}
            >
              {formatRelativeTime(alert.created_at, locale)}
            </span>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('alerts.actionsLabel')}>
              {/* Mark as Read button (for unread alerts) */}
              {isUnread && (
                <button
                  onClick={onMarkRead}
                  disabled={isMarkingRead}
                  aria-label={`${t('alerts.markRead')}: ${alert.title}`}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {isMarkingRead ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {t('alerts.markRead')}
                </button>
              )}

              {/* Mark as Unread button (for read alerts) */}
              {alert.is_read && (
                <button
                  onClick={onMarkUnread}
                  disabled={isMarkingUnread}
                  aria-label={`${t('alerts.markUnread')}: ${alert.title}`}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {isMarkingUnread ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                  {t('alerts.markUnread')}
                </button>
              )}

              {/* Snooze */}
              <SnoozeDropdown
                onSnooze={onSnooze}
                isSnoozePending={isSnoozePending}
              />

              {/* Dismiss */}
              <button
                onClick={onDismiss}
                disabled={isDismissing}
                aria-label={`${t('alerts.dismiss')}: ${alert.title}`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-1 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-danger)',
                  color: 'var(--color-danger)',
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
        {isUnread && (
          <div
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            aria-hidden="true"
            style={{
              backgroundColor: sev.accent,
              boxShadow: `0 0 6px ${sev.accent}`,
            }}
          />
        )}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const isRtl = i18n.language === 'he'
  const playSound = useNotificationSound()

  useEffect(() => {
    document.title = t('pageTitle.alerts')
  }, [t])

  // -- State --
  const [readFilter, setReadFilter] = useState<ReadFilterTab>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(new Set())
  const [markingUnreadIds, setMarkingUnreadIds] = useState<Set<string>>(new Set())
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())
  const [snoozingIds, setSnoozingIds] = useState<Set<string>>(new Set())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevUnreadCountRef = useRef<number | null>(null)

  // -- Data --
  const {
    data: alertsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.alerts.list(),
    queryFn: () => alertsApi.list(),
  })

  // Load user settings to respect notifications_enabled
  const { data: settingsData } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsApi.get(),
  })

  const alerts = alertsData?.items ?? []
  const unreadCount = alertsData?.unread_count ?? 0

  // -- Alert sound logic --
  useEffect(() => {
    if (prevUnreadCountRef.current !== null) {
      if (unreadCount > prevUnreadCountRef.current && soundEnabled && settingsData?.notifications_enabled !== false) {
        playSound()
      }
    }
    prevUnreadCountRef.current = unreadCount
  }, [unreadCount, soundEnabled, settingsData?.notifications_enabled, playSound])

  // -- Mutations --
  const markReadMutation = useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id),
    onMutate: (id) => {
      setMarkingReadIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      toast.success(t('toast.markReadSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
    onSettled: (_data, _error, id) => {
      setMarkingReadIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all })
    },
  })

  const markUnreadMutation = useMutation({
    mutationFn: (id: string) => alertsApi.markUnread(id),
    onMutate: (id) => {
      setMarkingUnreadIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      toast.success(t('toast.markUnreadSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
    onSettled: (_data, _error, id) => {
      setMarkingUnreadIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: (id: string) => alertsApi.dismiss(id),
    onMutate: (id) => {
      setDismissingIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      toast.success(t('toast.dismissSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
    onSettled: (_data, _error, id) => {
      setDismissingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all })
    },
  })

  const snoozeMutation = useMutation({
    mutationFn: ({ id, snoozedUntil }: { id: string; snoozedUntil: string }) =>
      alertsApi.snooze(id, snoozedUntil),
    onMutate: ({ id }) => {
      setSnoozingIds((prev) => new Set(prev).add(id))
    },
    onSuccess: () => {
      toast.success(t('toast.snoozeSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
    onSettled: (_data, _error, variables) => {
      setSnoozingIds((prev) => {
        const next = new Set(prev)
        next.delete(variables?.id ?? '')
        return next
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all })
    },
  })

  // Mark all read
  const markAllReadMutation = useMutation({
    mutationFn: () => alertsApi.markAllRead(),
    onSuccess: (data) => {
      toast.success(t('toast.markAllReadSuccess', { count: data.marked_count }))
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.all })
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
    },
  })

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return
    markAllReadMutation.mutate()
  }

  // -- Filtering --
  const filteredAlerts = useMemo(() => {
    // Exclude dismissed alerts from display
    const nonDismissed = alerts.filter((a) => !a.is_dismissed)

    // Sort by date, newest first
    const sorted = [...nonDismissed].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    // Apply read filter
    let filtered = sorted
    switch (readFilter) {
      case 'unread':
        filtered = filtered.filter((a) => !a.is_read)
        break
      case 'read':
        filtered = filtered.filter((a) => a.is_read)
        break
      default:
        break
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter((a) => a.severity === severityFilter)
    }

    return filtered
  }, [alerts, readFilter, severityFilter])

  // -- Read filter tabs --
  const readCount = useMemo(
    () => alerts.filter((a) => !a.is_dismissed && a.is_read).length,
    [alerts],
  )

  const readFilterTabs: { key: ReadFilterTab; label: string; count?: number }[] = [
    { key: 'all', label: t('alerts.all') },
    { key: 'unread', label: t('alerts.unread'), count: unreadCount },
    { key: 'read', label: t('alerts.read'), count: readCount },
  ]

  // -- Severity filter options --
  const severityOptions: { key: SeverityFilter; label: string }[] = [
    { key: 'all', label: t('alerts.allSeverities') },
    { key: 'critical', label: t('alerts.critical') },
    { key: 'warning', label: t('alerts.warning') },
    { key: 'info', label: t('alerts.info') },
  ]

  // -- Empty state messages --
  const getEmptyMessage = (): string => {
    if (readFilter === 'unread') return t('alerts.noUnread')
    if (readFilter === 'read') return t('alerts.noRead')
    if (severityFilter === 'critical') return t('alerts.noCritical')
    if (severityFilter === 'warning') return t('alerts.noWarning')
    if (severityFilter === 'info') return t('alerts.noInfo')
    return t('alerts.noAlertsDesc')
  }

  // Severity counts for footer
  const severityCounts = useMemo(() => {
    const nonDismissed = alerts.filter((a) => !a.is_dismissed)
    return {
      critical: nonDismissed.filter((a) => a.severity === 'critical').length,
      warning: nonDismissed.filter((a) => a.severity === 'warning').length,
      info: nonDismissed.filter((a) => a.severity === 'info').length,
    }
  }, [alerts])

  // ---- Render ----

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="page-reveal space-y-6">
      {/* ---- Page header ---- */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-[1.75rem] font-extrabold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('alerts.title')}
            </h1>
            {unreadCount > 0 && (
              <span
                className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold text-white"
                aria-label={t('alerts.unreadCountLabel', { count: unreadCount })}
                style={{
                  backgroundColor: 'var(--color-danger)',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}
              >
                {unreadCount}
              </span>
            )}
            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? t('alerts.soundOff') : t('alerts.soundOn')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              style={{ color: 'var(--text-tertiary)' }}
              title={soundEnabled ? t('alerts.soundOff') : t('alerts.soundOn')}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
          </div>
          {!isLoading && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {alerts.filter((a) => !a.is_dismissed).length} {t('alerts.title').toLowerCase()}
            </p>
          )}
        </div>

        {/* Bulk action: Mark all read - improved with count */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            aria-label={t('alerts.markAllReadAriaLabel', { count: unreadCount })}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover, var(--color-primary)))',
            }}
          >
            {markAllReadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            {t('alerts.markAllReadCount', { count: unreadCount })}
          </button>
        )}
      </div>

      {/* ---- Primary filter: Read/Unread/All ---- */}
      <nav className="animate-fade-in-up stagger-2" aria-label={t('alerts.filterLabel')}>
        <div className="segment-control overflow-x-auto" role="tablist">
          {readFilterTabs.map((tab) => {
            const isActive = readFilter === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                aria-controls="alerts-list"
                data-active={isActive}
                onClick={() => setReadFilter(tab.key)}
                className="segment-control-btn"
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: isActive ? 'rgba(0, 0, 0, 0.08)' : 'var(--bg-hover)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ---- Secondary filter: Severity dropdown ---- */}
      <div className="animate-fade-in-up stagger-2 flex items-center gap-3">
        <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {t('alerts.severityFilterLabel')}:
        </span>
        <div className="flex gap-1.5">
          {severityOptions.map((option) => {
            const isActive = severityFilter === option.key
            return (
              <button
                key={option.key}
                onClick={() => setSeverityFilter(option.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                )}
                style={{
                  backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- Content ---- */}
      <div id="alerts-list" role="tabpanel" aria-live="polite">
        {isLoading ? (
          <AlertsSkeleton />
        ) : isError ? (
          <div className="animate-fade-in-up stagger-3 flex flex-col items-center justify-center py-16" role="alert">
            <div
              className="empty-float mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
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
        ) : filteredAlerts.length === 0 ? (
          <EmptyState message={getEmptyMessage()} />
        ) : (
          <div className="space-y-4" role="list" aria-label={t('alerts.listLabel')}>
            {filteredAlerts.map((alert, index) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isRtl={isRtl}
                index={index}
                onMarkRead={() => markReadMutation.mutate(alert.id)}
                onMarkUnread={() => markUnreadMutation.mutate(alert.id)}
                onDismiss={() => dismissMutation.mutate(alert.id)}
                onSnooze={(snoozedUntil) =>
                  snoozeMutation.mutate({ id: alert.id, snoozedUntil })
                }
                isMarkingRead={markingReadIds.has(alert.id)}
                isMarkingUnread={markingUnreadIds.has(alert.id)}
                isDismissing={dismissingIds.has(alert.id)}
                isSnoozePending={snoozingIds.has(alert.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {!isLoading && !isError && alerts.filter((a) => !a.is_dismissed).length > 0 && (
        <div className="animate-fade-in-up stagger-4 card overflow-hidden" aria-label={t('alerts.summaryLabel')}>
          <div className="flex items-center justify-center gap-8 px-5 py-4">
            {(['critical', 'warning', 'info'] as const).map((severity) => {
              const sev = severityConfig(severity)
              const count = severityCounts[severity]
              return (
                <div key={severity} className="flex items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: sev.bg, color: sev.accent }}
                    aria-hidden="true"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p
                      className="text-lg font-bold ltr-nums leading-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {count}
                    </p>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t(`alerts.${severity}`)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
