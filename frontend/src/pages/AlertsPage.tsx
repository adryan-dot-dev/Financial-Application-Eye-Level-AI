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
  ShieldAlert,
  Shield,
  RefreshCw,
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

type FilterTab = 'all' | 'unread' | 'critical' | 'warning' | 'info'

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
        border: 'var(--color-danger)',
        accent: 'var(--color-danger)',
        textAccent: 'var(--text-danger)',
        icon: <ShieldAlert className="h-5 w-5" />,
        gradient: 'rgba(238, 93, 80, 0.04)',
        glowColor: 'rgba(238, 93, 80, 0.12)',
      }
    case 'warning':
      return {
        bg: 'var(--bg-warning)',
        border: 'var(--color-warning)',
        accent: 'var(--color-warning)',
        textAccent: 'var(--text-warning)',
        icon: <AlertTriangle className="h-5 w-5" />,
        gradient: 'rgba(245, 158, 11, 0.04)',
        glowColor: 'rgba(245, 158, 11, 0.12)',
      }
    case 'info':
    default:
      return {
        bg: 'var(--bg-info)',
        border: 'var(--color-info)',
        accent: 'var(--color-info)',
        textAccent: 'var(--text-info)',
        icon: <Info className="h-5 w-5" />,
        gradient: 'rgba(67, 24, 255, 0.04)',
        glowColor: 'rgba(67, 24, 255, 0.12)',
      }
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AlertsSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading alerts">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn('animate-fade-in-up card overflow-hidden p-0', `stagger-${Math.min(i + 1, 8)}`)}
        >
          <div className="flex items-start gap-4 p-5">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="skeleton h-4 w-52 rounded-md" />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
              <div className="skeleton h-3 w-80 rounded-md" />
              <div className="flex items-center justify-between">
                <div className="skeleton h-3 w-20 rounded-md" />
                <div className="flex gap-2">
                  <div className="skeleton h-7 w-20 rounded-lg" />
                  <div className="skeleton h-7 w-16 rounded-lg" />
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

function EmptyState({ message, severity }: { message: string; severity?: string }) {
  const emptyIcon = useMemo(() => {
    switch (severity) {
      case 'critical':
        return <Shield className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
      case 'warning':
        return <AlertCircle className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
      case 'info':
        return <Bell className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
      default:
        return <BellOff className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
    }
  }, [severity])

  return (
    <div className="animate-fade-in-up stagger-3 flex flex-col items-center justify-center py-20">
      <div
        className="empty-float mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--bg-hover)' }}
      >
        {emptyIcon}
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
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        disabled={isSnoozePending}
        aria-label={t('alerts.snooze')}
        aria-expanded={isOpen}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
          'transition-all duration-150',
          'hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)] focus-visible:ring-offset-1',
          'disabled:opacity-50',
        )}
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
        }}
      >
        {isSnoozePending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Clock className="h-3.5 w-3.5" />
        )}
        {t('alerts.snooze')}
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className="animate-fade-in-scale absolute top-full z-50 mt-1.5 min-w-52 overflow-hidden rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            insetInlineEnd: 0,
          }}
        >
          <div className="p-1">
            {snoozeOptions.map((option, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation()
                  onSnooze(option.getDate())
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium',
                  'transition-colors hover:bg-[var(--bg-hover)]',
                )}
                style={{ color: 'var(--text-primary)' }}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                {option.label}
              </button>
            ))}
          </div>
          <div
            className="border-t"
            style={{ borderColor: 'var(--border-primary)' }}
          />
          <div className="p-1">
            {!showDatePicker ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDatePicker(true)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium',
                  'transition-colors hover:bg-[var(--bg-hover)]',
                )}
                style={{ color: 'var(--text-primary)' }}
              >
                <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                {t('alerts.snoozeChooseDate')}
              </button>
            ) : (
              <div className="px-2 py-2">
                <input
                  type="datetime-local"
                  className="input w-full text-xs"
                  min={new Date().toISOString().slice(0, 16)}
                  onClick={(e) => e.stopPropagation()}
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

  // Strip emojis from title and message for clean display
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu
  const cleanTitle = alert.title.replace(emojiRegex, '').trim()
  const cleanMessage = alert.message.replace(emojiRegex, '').trim()

  return (
    <article
      role="article"
      aria-label={`${t(`alerts.${alert.severity}`)} ${t('alerts.alertLabel')}: ${cleanTitle}${isUnread ? ` (${t('alerts.unread')})` : ''}`}
      className={cn(
        'row-enter hover-lift group rounded-2xl border transition-all duration-200',
        isUnread ? 'card-hover' : '',
      )}
      style={{
        '--row-index': Math.min(index, 15),
        borderInlineStartWidth: '3px',
        borderInlineStartColor: sev.border,
        borderColor: isUnread ? undefined : 'var(--border-primary)',
        background: isUnread ? sev.gradient : 'var(--bg-card)',
        opacity: alert.is_read ? 0.8 : 1,
        boxShadow: isUnread ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
      } as React.CSSProperties}
    >
      <div className="flex items-start gap-3.5 p-5">
        {/* Severity icon / Emoji */}
        <div
          className="icon-circle icon-circle-lg relative flex shrink-0 items-center justify-center"
          style={{
            backgroundColor: sev.bg,
            color: sev.accent,
            opacity: alert.is_read ? 0.5 : 1,
          }}
          aria-hidden="true"
        >
          {sev.icon}
          {/* Unread pulse indicator on critical */}
          {isUnread && alert.severity === 'critical' && (
            <span
              className="live-dot absolute -top-0.5 -end-0.5"
              style={{
                backgroundColor: sev.accent,
              }}
            />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  'text-[0.9375rem] leading-snug',
                  isUnread ? 'font-semibold' : 'font-normal',
                )}
                style={{
                  color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {cleanTitle}
              </h3>
            </div>

            {/* Severity badge + unread dot */}
            <div className="flex shrink-0 items-center gap-2">
              {isUnread && (
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  aria-hidden="true"
                  style={{
                    backgroundColor: sev.accent,
                  }}
                />
              )}
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  alert.severity === 'critical' && 'badge-pulse',
                )}
                style={{
                  backgroundColor: sev.bg,
                  color: sev.textAccent,
                }}
              >
                {t(`alerts.${alert.severity}`)}
              </span>
            </div>
          </div>

          {/* Message */}
          <p
            className="mt-1.5 whitespace-pre-line text-[0.8125rem] leading-relaxed"
            style={{
              color: isUnread ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              maxWidth: '640px',
            }}
          >
            {cleanMessage}
          </p>

          {/* Footer: timestamp + actions */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            {/* Timestamp - relative format */}
            <span
              className="ltr-nums text-xs"
              style={{ color: 'var(--text-tertiary)' }}
              title={formatDate(alert.created_at, isRtl ? 'he-IL' : 'en-US')}
            >
              <Clock
                className="me-1 inline-block h-3 w-3 align-[-2px]"
                style={{ color: 'var(--text-tertiary)' }}
              />
              {formatRelativeTime(alert.created_at, locale)}
            </span>

            {/* Actions */}
            <div
              className={cn(
                'flex flex-wrap items-center gap-1.5',
                'opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100',
              )}
              role="group"
              aria-label={t('alerts.actionsLabel')}
            >
              {/* Mark as Read button (for unread alerts) */}
              {isUnread && (
                <button
                  onClick={onMarkRead}
                  disabled={isMarkingRead}
                  aria-label={`${t('alerts.markRead')}: ${cleanTitle}`}
                  className={cn(
                    'btn-press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                    'transition-all duration-150',
                    'hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)] focus-visible:ring-offset-1',
                    'disabled:opacity-50',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {isMarkingRead ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {t('alerts.markRead')}
                </button>
              )}

              {/* Mark as Unread button (for read alerts) */}
              {alert.is_read && (
                <button
                  onClick={onMarkUnread}
                  disabled={isMarkingUnread}
                  aria-label={`${t('alerts.markUnread')}: ${cleanTitle}`}
                  className={cn(
                    'btn-press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                    'transition-all duration-150',
                    'hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)] focus-visible:ring-offset-1',
                    'disabled:opacity-50',
                  )}
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {isMarkingUnread ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
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
                aria-label={`${t('alerts.dismiss')}: ${cleanTitle}`}
                className={cn(
                  'btn-press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                  'transition-all duration-150',
                  'hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-1',
                  'disabled:opacity-50',
                )}
                style={{
                  backgroundColor: 'var(--bg-danger)',
                  color: 'var(--text-danger)',
                }}
              >
                {isDismissing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {t('alerts.dismiss')}
              </button>
            </div>
          </div>
        </div>
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
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
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
    refetch,
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

  // -- Computed counts --
  const nonDismissedAlerts = useMemo(
    () => alerts.filter((a) => !a.is_dismissed),
    [alerts],
  )

  const severityCounts = useMemo(() => ({
    critical: nonDismissedAlerts.filter((a) => a.severity === 'critical').length,
    warning: nonDismissedAlerts.filter((a) => a.severity === 'warning').length,
    info: nonDismissedAlerts.filter((a) => a.severity === 'info').length,
  }), [nonDismissedAlerts])

  // -- Filtering --
  const filteredAlerts = useMemo(() => {
    // Sort by date, newest first
    const sorted = [...nonDismissedAlerts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    switch (activeTab) {
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
  }, [nonDismissedAlerts, activeTab])

  // -- Tab config --
  const filterTabs: { key: FilterTab; label: string; count: number; severityColor?: string }[] = [
    { key: 'all', label: t('alerts.all'), count: nonDismissedAlerts.length },
    { key: 'unread', label: t('alerts.unread'), count: unreadCount },
    { key: 'critical', label: t('alerts.critical'), count: severityCounts.critical, severityColor: 'var(--color-danger)' },
    { key: 'warning', label: t('alerts.warning'), count: severityCounts.warning, severityColor: 'var(--color-warning)' },
    { key: 'info', label: t('alerts.info'), count: severityCounts.info, severityColor: 'var(--color-info)' },
  ]

  // -- Empty state messages --
  const getEmptyMessage = (): string => {
    switch (activeTab) {
      case 'unread': return t('alerts.noUnread')
      case 'critical': return t('alerts.noCritical')
      case 'warning': return t('alerts.noWarning')
      case 'info': return t('alerts.noInfo')
      default: return t('alerts.noAlertsDesc')
    }
  }

  const getEmptySeverity = (): string | undefined => {
    switch (activeTab) {
      case 'critical': return 'critical'
      case 'warning': return 'warning'
      case 'info': return 'info'
      default: return undefined
    }
  }

  // ---- Render ----

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="page-reveal space-y-6">
      {/* ---- Page header ---- */}
      <div className="animate-fade-in-up stagger-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--color-brand-500)',
              }}
            >
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1
                  className="gradient-heading text-2xl font-bold tracking-tight"
                >
                  {t('alerts.title')}
                </h1>
                {unreadCount > 0 && (
                  <span
                    className="badge-pulse flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                    aria-label={t('alerts.unreadCountLabel', { count: unreadCount })}
                    style={{
                      backgroundColor: 'var(--color-danger)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              {!isLoading && (
                <p
                  className="mt-0.5 text-[13px]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {nonDismissedAlerts.length} {t('alerts.title').toLowerCase()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? t('alerts.soundOff') : t('alerts.soundOn')}
            className={cn(
              'btn-press inline-flex h-9 w-9 items-center justify-center rounded-xl',
              'transition-all duration-150',
              'hover:bg-[var(--bg-hover)]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]',
            )}
            style={{ color: soundEnabled ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
            title={soundEnabled ? t('alerts.soundOff') : t('alerts.soundOn')}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              aria-label={t('alerts.markAllReadAriaLabel', { count: unreadCount })}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold"
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
      </div>

      {/* ---- Filter tabs (segment control style) ---- */}
      <nav className="animate-fade-in-up stagger-2" aria-label={t('alerts.filterLabel')}>
        <div className="segment-control overflow-x-auto" role="tablist">
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                aria-controls="alerts-list"
                data-active={isActive}
                onClick={() => setActiveTab(tab.key)}
                className="segment-control-btn"
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                    style={{
                      backgroundColor: isActive
                        ? (tab.severityColor
                          ? undefined
                          : 'rgba(0, 0, 0, 0.08)')
                        : 'var(--bg-hover)',
                      background: isActive && tab.severityColor
                        ? `color-mix(in srgb, ${tab.severityColor} 15%, transparent)`
                        : undefined,
                      color: isActive
                        ? (tab.severityColor ?? 'var(--text-primary)')
                        : 'var(--text-tertiary)',
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

      {/* ---- Content ---- */}
      <div id="alerts-list" role="tabpanel" aria-live="polite">
        {isLoading ? (
          <AlertsSkeleton />
        ) : isError ? (
          <div className="animate-fade-in-up stagger-3 flex flex-col items-center justify-center py-20" role="alert">
            <div
              className="empty-float mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-danger)' }}
            >
              <AlertTriangle className="h-7 w-7" style={{ color: 'var(--color-danger)' }} />
            </div>
            <h3
              className="mb-2 text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('common.loadError')}
            </h3>
            <p
              className="mb-6 max-w-sm text-center text-sm leading-relaxed"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('common.loadErrorDesc')}
            </p>
            <button
              onClick={() => refetch()}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              {t('errors.tryAgain')}
            </button>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState message={getEmptyMessage()} severity={getEmptySeverity()} />
        ) : (
          <div className="space-y-3" role="list" aria-label={t('alerts.listLabel')}>
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

      {/* ---- Summary footer ---- */}
      {!isLoading && !isError && nonDismissedAlerts.length > 0 && (
        <div
          className="animate-fade-in-up stagger-4 card overflow-hidden"
          aria-label={t('alerts.summaryLabel')}
        >
          <div className="flex items-center justify-center gap-10 px-6 py-5">
            {(['critical', 'warning', 'info'] as const).map((severity) => {
              const sev = severityConfig(severity)
              const count = severityCounts[severity]
              return (
                <button
                  key={severity}
                  onClick={() => setActiveTab(severity)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-200',
                    'hover:bg-[var(--bg-hover)]',
                    activeTab === severity && 'ring-1',
                  )}
                  style={{
                    backgroundColor: activeTab === severity ? sev.bg : undefined,
                    // @ts-expect-error -- CSS custom property for ring color
                    '--tw-ring-color': activeTab === severity ? sev.border : undefined,
                  }}
                >
                  <div
                    className="icon-circle icon-circle-sm flex items-center justify-center"
                    style={{ backgroundColor: sev.bg, color: sev.accent }}
                    aria-hidden="true"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-start">
                    <p
                      className="ltr-nums text-lg font-bold leading-none"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {count}
                    </p>
                    <p
                      className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t(`alerts.${severity}`)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
