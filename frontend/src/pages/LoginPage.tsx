import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sun, Moon, Monitor, Globe, Loader2, User, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()

  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.login')
  }, [t])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleLanguage = () => {
    const newLang = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(newLang)
    document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = newLang
  }

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = order.indexOf(theme)
    const nextIndex = (currentIndex + 1) % order.length
    setTheme(order[nextIndex])
  }

  const themeIcon = theme === 'light'
    ? <Sun className="h-4 w-4" />
    : theme === 'dark'
      ? <Moon className="h-4 w-4" />
      : <Monitor className="h-4 w-4" />

  const themeLabel = theme === 'light'
    ? t('settings.light')
    : theme === 'dark'
      ? t('settings.dark')
      : t('settings.system')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login({ username, password })
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const message = axiosError?.response?.data?.detail || t('common.error')
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="page-reveal flex min-h-screen"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Top Controls */}
      <div className={cn(
        'fixed top-5 z-50 flex items-center gap-2.5',
        'end-5'
      )}>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium tracking-wide backdrop-blur-sm transition-all duration-200 hover:bg-[var(--bg-hover)]"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)',
          }}
          title={t('settings.language')}
        >
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === 'he' ? 'EN' : 'HE'}
        </button>
        <button
          onClick={cycleTheme}
          className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:bg-[var(--bg-hover)]"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)',
          }}
          title={themeLabel}
        >
          {themeIcon}
        </button>
      </div>

      {/* Left Side - Brand Panel */}
      <div className={cn(
        'relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex',
        isRtl ? 'order-2' : 'order-1'
      )}>
        {/* Solid brand background */}
        <div className="auth-brand-bg absolute inset-0" />

        <div className="relative z-10 flex flex-col items-center px-12">
          {/* Logo */}
          <div className="mb-8 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20">
            <img
              src="/logo.jpeg"
              alt={t('app.company')}
              className="h-24 w-24 object-cover"
            />
          </div>

          {/* App name */}
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
            {t('app.name')}
          </h1>

          {/* Company name */}
          <p className="text-base font-medium text-white/80">
            {t('app.company')}
          </p>

          {/* Divider */}
          <div className="my-7 h-px w-20 bg-white/25" />

          {/* Subtitle */}
          <p className="max-w-[260px] text-center text-sm leading-relaxed text-white/65">
            {t('auth.loginSubtitle')}
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className={cn(
        'relative flex w-full flex-col items-center justify-center px-6 py-16 lg:w-1/2',
        isRtl ? 'order-1' : 'order-2'
      )}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="auth-stagger w-full max-w-[420px]">

          {/* Mobile Logo (visible below lg) */}
          <div className="mb-10 flex flex-col items-center lg:hidden">
            <div className="mb-5 overflow-hidden rounded-xl shadow-md"
              style={{ border: '1px solid var(--border-primary)' }}
            >
              <img
                src="/logo.jpeg"
                alt={t('app.company')}
                className="h-20 w-20 object-cover"
              />
            </div>
            <h2 className="auth-gradient-text text-2xl font-bold tracking-tight">
              {t('app.name')}
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('app.company')}
            </p>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('auth.welcomeBack')}
            </h2>
            <p
              className="mt-3 text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="auth-error-animate mb-7 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                borderColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
              }}
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Username */}
            <div>
              <label
                htmlFor="login-username"
                className="mb-2 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.username')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    'start-4'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <User className="h-[18px] w-[18px]" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className={cn(
                    'w-full rounded-lg border py-3.5 text-sm outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20 focus-visible:shadow-sm',
                    'ps-11 pe-4'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.username')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.password')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    'start-4'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Lock className="h-[18px] w-[18px]" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={cn(
                    'w-full rounded-lg border py-3.5 text-sm outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20 focus-visible:shadow-sm',
                    'ps-11 pe-11'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 rounded-lg p-1 transition-all duration-200 hover:opacity-70',
                    'end-3'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword
                    ? <EyeOff className="h-[18px] w-[18px]" />
                    : <Eye className="h-[18px] w-[18px]" />
                  }
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5',
                'text-sm font-semibold text-white',
                'transition-all duration-200',
                'hover:opacity-90',
                'active:scale-[0.98]',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
              style={{
                background: 'var(--color-brand-600)',
              }}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('auth.loginButton')}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-primary)' }} />
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('auth.or')}
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-primary)' }} />
          </div>

          {/* Register Link */}
          <p
            className="text-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('auth.noAccount')}{' '}
            <Link
              to="/register"
              className="auth-gradient-text font-semibold transition-opacity duration-200 hover:opacity-75"
            >
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
