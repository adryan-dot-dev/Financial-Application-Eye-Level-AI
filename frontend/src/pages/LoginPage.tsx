import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sun, Moon, Monitor, Globe, Loader2, User, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { getApiErrorMessage } from '@/api/client'
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
      setError(getApiErrorMessage(err))
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
          className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium tracking-wide backdrop-blur-md transition-all duration-200 hover:scale-105 hover:shadow-sm"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)',
            borderColor: 'var(--border-primary)',
          }}
          title={t('settings.language')}
        >
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === 'he' ? 'EN' : 'HE'}
        </button>
        <button
          onClick={cycleTheme}
          className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur-md transition-all duration-200 hover:scale-105 hover:shadow-sm"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)',
            borderColor: 'var(--border-primary)',
          }}
          title={themeLabel}
        >
          {themeIcon}
        </button>
      </div>

      {/* Left Side - Brand Panel with animated gradient mesh + floating shapes */}
      <div className={cn(
        'relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex',
        isRtl ? 'order-2' : 'order-1'
      )}>
        {/* Gradient mesh background */}
        <div className="auth-brand-bg absolute inset-0" />


        <div className="relative z-10 flex flex-col items-center px-12">
          {/* Logo with glow */}
          <div
            className="mb-8 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/20"
            style={{
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <img
              src="/logo.webp"
              alt={t('app.company')}
              className="h-32 w-32 object-cover"
            />
          </div>

          {/* App name */}
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
            {t('app.name')}
          </h1>

          {/* Company name */}
          <p className="text-base font-semibold tracking-widest text-white/70 uppercase">
            {t('app.company')}
          </p>

          {/* Divider */}
          <div
            className="my-8 h-px w-32"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          />

          {/* Subtitle */}
          <p className="max-w-[300px] text-center text-base leading-relaxed text-white/60">
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
            <div
              className="mb-5 overflow-hidden rounded-2xl"
              style={{
                border: '1px solid var(--border-primary)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <img
                src="/logo.webp"
                alt={t('app.company')}
                className="h-24 w-24 object-cover"
              />
            </div>
            <h2 className="auth-gradient-text text-2xl font-extrabold tracking-tight">
              {t('app.name')}
            </h2>
            <p
              className="mt-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('app.company')}
            </p>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <h2
              className="text-[34px] font-extrabold tracking-tight leading-tight"
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
                backgroundColor: 'rgba(238, 93, 80, 0.06)',
                borderColor: 'rgba(238, 93, 80, 0.15)',
                color: 'var(--color-danger)',
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
                className="mb-2.5 block text-sm font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.username')}
              </label>
              <div className="group relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    'start-4'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <User className="h-5 w-5 transition-colors duration-200 group-focus-within:text-[var(--border-focus)]" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className={cn(
                    'h-12 w-full rounded-xl border text-[15px] outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-3 focus-visible:ring-[var(--border-focus)]/15',
                    'ps-12 pe-4'
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
                className="mb-2.5 block text-sm font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.password')}
              </label>
              <div className="group relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    'start-4'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Lock className="h-5 w-5 transition-colors duration-200 group-focus-within:text-[var(--border-focus)]" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={cn(
                    'h-12 w-full rounded-xl border text-[15px] outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-3 focus-visible:ring-[var(--border-focus)]/15',
                    'ps-12 pe-12'
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
                    'absolute top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-all duration-200 hover:bg-[var(--bg-hover)]',
                    'end-3'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword
                    ? <EyeOff className="h-5 w-5" />
                    : <Eye className="h-5 w-5" />
                  }
                </button>
              </div>
            </div>

            {/* Submit Button – gradient with glow + scale hover */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex h-12 w-full items-center justify-center gap-2.5 text-[15px] font-bold transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
              style={{
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
            >
              {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
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
