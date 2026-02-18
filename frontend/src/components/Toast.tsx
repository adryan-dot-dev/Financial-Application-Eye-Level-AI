import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import type { Toast, ToastType } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Config per toast type
// ---------------------------------------------------------------------------

const TOAST_CONFIG: Record<
  ToastType,
  {
    icon: React.ReactNode
    bg: string
    border: string
    accent: string
    progressColor: string
  }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    bg: 'var(--bg-success)',
    border: 'var(--border-success)',
    accent: 'var(--color-success)',
    progressColor: 'var(--color-success)',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    bg: 'var(--bg-danger)',
    border: 'var(--border-danger)',
    accent: 'var(--color-danger)',
    progressColor: 'var(--color-danger)',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    bg: 'var(--bg-warning)',
    border: 'var(--border-warning)',
    accent: 'var(--color-warning)',
    progressColor: 'var(--color-warning)',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    bg: 'var(--bg-info)',
    border: 'var(--border-info)',
    accent: 'var(--color-brand-500)',
    progressColor: 'var(--color-brand-500)',
  },
}

// ---------------------------------------------------------------------------
// Individual Toast Item
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: (id: string) => void
}) {
  const config = TOAST_CONFIG[toast.type]
  const [isExiting, setIsExiting] = useState(false)
  const duration = toast.duration ?? 4000

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 200)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto relative w-80 overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm',
        isExiting ? 'toast-spring-exit' : 'toast-spring-enter',
      )}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: config.border,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: config.bg, color: config.accent }}
        >
          {config.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {toast.title}
          </p>
          {toast.message && (
            <p
              className="mt-0.5 text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {toast.message}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Countdown progress bar */}
      <div
        className="toast-countdown absolute bottom-0 h-0.5 rounded-b-xl"
        style={{
          '--toast-duration': `${duration}ms`,
          backgroundColor: config.progressColor,
          insetInlineStart: 0,
        } as React.CSSProperties}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast Container
// ---------------------------------------------------------------------------

export function ToastContainer() {
  const { toasts, removeToast } = useToast()
  const { i18n } = useTranslation()
  const isRtl = i18n.language === 'he'

  if (toasts.length === 0) return null

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 z-[9999] flex flex-col gap-3 pointer-events-none',
          isRtl ? 'left-6' : 'right-6',
        )}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </>
  )
}
