import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Home, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

interface ErrorPageProps {
  statusCode?: number
  title?: string
  message?: string
  error?: Error | null
  componentStack?: string | null
  onRetry?: () => void
}

const ERROR_DEFAULTS: Record<number, { titleKey: string; messageKey: string }> = {
  404: { titleKey: 'error.notFoundTitle', messageKey: 'error.notFoundMessage' },
  500: { titleKey: 'error.serverErrorTitle', messageKey: 'error.serverErrorMessage' },
  403: { titleKey: 'error.forbiddenTitle', messageKey: 'error.forbiddenMessage' },
}

export default function ErrorPage({
  statusCode = 500,
  title,
  message,
  error,
  componentStack,
  onRetry,
}: ErrorPageProps) {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = t('pageTitle.error')
  }, [t])

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const defaults = ERROR_DEFAULTS[statusCode] ?? {
    titleKey: 'error.genericTitle',
    messageKey: 'error.genericMessage',
  }

  const displayTitle = title ?? t(defaults.titleKey)
  const displayMessage = message ?? t(defaults.messageKey)

  const isDev = import.meta.env.DEV

  const debugInfo = [
    `Error: ${error?.message ?? 'Unknown'}`,
    `Status: ${statusCode}`,
    `URL: ${window.location.href}`,
    `Timestamp: ${new Date().toISOString()}`,
    `User Agent: ${navigator.userAgent}`,
    '',
    error?.stack ? `Stack Trace:\n${error.stack}` : '',
    componentStack ? `Component Stack:\n${componentStack}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  function handleCopy() {
    navigator.clipboard.writeText(debugInfo).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleGoHome() {
    window.location.href = '/'
  }

  function handleRetry() {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
    >
      <div className="w-full max-w-lg text-center">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/logo.jpeg"
            alt="Eye Level AI"
            className="h-14 w-14 mx-auto rounded-xl object-cover"
            style={{ boxShadow: 'var(--shadow-md)' }}
          />
        </div>

        {/* Error code with gradient */}
        <h1
          className="text-8xl font-extrabold tracking-tight mb-2 leading-none select-none"
          style={{
            background: '#3B82F6',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {statusCode}
        </h1>

        {/* Title */}
        <h2
          className="text-2xl font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          {displayTitle}
        </h2>

        {/* Description */}
        <p
          className="text-base mb-8 max-w-sm mx-auto leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {displayMessage}
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer"
            style={{
              background: '#3B82F6',
              border: 'none',
            }}
          >
            <Home className="h-4 w-4" />
            {t('error.goHome')}
          </button>

          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {t('error.tryAgain')}
          </button>
        </div>

        {/* Dev-only debug details */}
        {isDev && error && (
          <div
            className="text-start rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <button
              onClick={() => setDetailsOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
              }}
            >
              <span>{t('error.debugDetails')}</span>
              {detailsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {detailsOpen && (
              <div
                className="px-4 pb-4"
                style={{ borderTop: '1px solid var(--border-primary)' }}
              >
                <div className="flex justify-end pt-3 pb-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-hover)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-primary)',
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        {t('error.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        {t('error.copyDebug')}
                      </>
                    )}
                  </button>
                </div>

                <pre
                  className="text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words rounded-lg p-4"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    maxHeight: '320px',
                    overflowY: 'auto',
                  }}
                >
                  {debugInfo}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
