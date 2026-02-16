import { useEffect, useState } from 'react'
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
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    accent: '#10B981',
    progressColor: '#10B981',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.25)',
    accent: '#EF4444',
    progressColor: '#EF4444',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
    accent: '#F59E0B',
    progressColor: '#F59E0B',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.25)',
    accent: '#3B82F6',
    progressColor: '#3B82F6',
  },
}

// ---------------------------------------------------------------------------
// Individual Toast Item
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onRemove,
  isRtl,
}: {
  toast: Toast
  onRemove: (id: string) => void
  isRtl: boolean
}) {
  const config = TOAST_CONFIG[toast.type]
  const [isExiting, setIsExiting] = useState(false)
  const [isEntered, setIsEntered] = useState(false)
  const duration = toast.duration ?? 4000

  // Enter animation
  useEffect(() => {
    const timer = setTimeout(() => setIsEntered(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 200)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto relative w-80 overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300 ease-out',
        !isEntered && !isExiting && (isRtl ? '-translate-x-full opacity-0' : 'translate-x-full opacity-0'),
        isEntered && !isExiting && 'translate-x-0 opacity-100',
        isExiting && (isRtl ? '-translate-x-full opacity-0' : 'translate-x-full opacity-0'),
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

      {/* Progress bar */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: config.progressColor,
            animation: `toastProgress ${duration}ms linear forwards`,
          }}
        />
      </div>
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
      {/* Keyframes for progress bar */}
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

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
            isRtl={isRtl}
          />
        ))}
      </div>
    </>
  )
}
