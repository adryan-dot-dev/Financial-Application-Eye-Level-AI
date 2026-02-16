import { useState, useMemo, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Globe,
  Loader2,
  User,
  Mail,
  Lock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface FieldErrors {
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
}

function getPasswordStrength(password: string): {
  score: number
  labelKey: string
  color: string
  bgColor: string
} {
  let score = 0
  if (password.length >= 4) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, labelKey: 'validation.strengthWeak', color: 'text-red-500', bgColor: 'bg-red-500' }
  if (score <= 2) return { score, labelKey: 'validation.strengthFair', color: 'text-orange-500', bgColor: 'bg-orange-500' }
  if (score <= 3) return { score, labelKey: 'validation.strengthGood', color: 'text-yellow-500', bgColor: 'bg-yellow-500' }
  if (score <= 4) return { score, labelKey: 'validation.strengthStrong', color: 'text-emerald-500', bgColor: 'bg-emerald-500' }
  return { score, labelKey: 'validation.strengthExcellent', color: 'text-cyan-500', bgColor: 'bg-cyan-500' }
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { register } = useAuth()
  const { theme, setTheme } = useTheme()

  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.register')
  }, [t])

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
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

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const validate = (): boolean => {
    const errors: FieldErrors = {}

    if (username.trim().length < 4) {
      errors.username = t('validation.usernameMinLength')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      errors.email = t('validation.invalidEmail')
    }

    if (password.length < 4) {
      errors.password = t('validation.passwordMinLength')
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = t('validation.passwordsMismatch')
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setIsSubmitting(true)

    try {
      await register({ username: username.trim(), email: email.trim(), password })
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
      {/* Top controls */}
      <div className={cn(
        'fixed top-5 z-50 flex items-center gap-2',
        'end-5'
      )}>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium tracking-wide backdrop-blur-sm transition-all duration-200 hover:bg-[var(--bg-hover)]"
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
          className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:bg-[var(--bg-hover)]"
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

      {/* Left side - Brand panel */}
      <div className={cn(
        'relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex',
        isRtl ? 'order-2' : 'order-1'
      )}>
        {/* Solid brand background */}
        <div className="auth-brand-bg absolute inset-0" />

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          {/* Logo */}
          <div className="mb-8 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20">
            <img
              src="/logo.jpeg"
              alt={t('app.company')}
              className="h-24 w-24 object-cover"
            />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
            {t('app.name')}
          </h1>
          <p className="text-base font-medium text-white/80">
            {t('app.company')}
          </p>

          {/* Divider */}
          <div className="my-7 h-px w-20 bg-white/25" />

          {/* Subtitle */}
          <p className="max-w-[280px] text-sm leading-relaxed text-white/65">
            {t('auth.registerSubtitle')}
          </p>
        </div>
      </div>

      {/* Right side - Registration form */}
      <div className={cn(
        'relative flex w-full flex-col items-center justify-center px-6 py-10 lg:w-1/2',
        isRtl ? 'order-1' : 'order-2'
      )}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="auth-stagger w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-4 overflow-hidden rounded-xl shadow-md"
              style={{ border: '1px solid var(--border-primary)' }}
            >
              <img
                src="/logo.jpeg"
                alt={t('app.company')}
                className="h-20 w-20 object-cover"
              />
            </div>
            <h2 className="auth-gradient-text text-xl font-bold">
              {t('app.name')}
            </h2>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('auth.createAccount')}
            </h2>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('auth.registerSubtitle')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="auth-error-animate mb-6 flex items-center gap-2.5 rounded-xl border px-4 py-3.5 text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                borderColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
              }}
              role="alert"
            >
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username field */}
            <div>
              <label
                htmlFor="register-username"
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
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (fieldErrors.username) {
                      setFieldErrors((prev) => ({ ...prev, username: undefined }))
                    }
                  }}
                  required
                  autoComplete="username"
                  className={cn(
                    'w-full rounded-lg border py-3.5 text-sm outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    fieldErrors.username ? 'border-red-400' : '',
                    'ps-11 pe-4'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.username ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.username')}
                />
              </div>
              {fieldErrors.username && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs text-red-500">
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.username}
                </p>
              )}
            </div>

            {/* Email field */}
            <div>
              <label
                htmlFor="register-email"
                className="mb-2 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.email')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    'start-4'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Mail className="h-[18px] w-[18px]" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }))
                    }
                  }}
                  required
                  autoComplete="email"
                  className={cn(
                    'w-full rounded-lg border py-3.5 text-sm outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    fieldErrors.email ? 'border-red-400' : '',
                    'ps-11 pe-4'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.email ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.email')}
                />
              </div>
              {fieldErrors.email && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs text-red-500">
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="register-password"
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
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                  required
                  autoComplete="new-password"
                  className={cn(
                    'w-full rounded-lg border py-3.5 text-sm outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    fieldErrors.password ? 'border-red-400' : '',
                    'ps-11 pe-11'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.password ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 rounded-lg p-1 transition-all hover:opacity-70',
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
              {fieldErrors.password && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs text-red-500">
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.password}
                </p>
              )}

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('validation.passwordStrength')}
                    </span>
                    <span className={cn('text-[11px] font-semibold', passwordStrength.color)}>
                      {t(passwordStrength.labelKey)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          passwordStrength.score >= level
                            ? passwordStrength.bgColor
                            : 'bg-gray-200 dark:bg-gray-700'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password field */}
            <div>
              <label
                htmlFor="register-confirm-password"
                className="mb-2 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.confirmPassword')}
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
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                    }
                  }}
                  required
                  autoComplete="new-password"
                  className={cn(
                    'w-full rounded-lg border py-3.5 text-sm outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    fieldErrors.confirmPassword
                      ? 'border-red-400'
                      : passwordsMatch
                        ? 'border-emerald-400'
                        : '',
                    'ps-11 pe-11'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.confirmPassword
                      ? undefined
                      : passwordsMatch
                        ? undefined
                        : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 rounded-lg p-1 transition-all hover:opacity-70',
                    'end-3'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showConfirmPassword
                    ? <EyeOff className="h-[18px] w-[18px]" />
                    : <Eye className="h-[18px] w-[18px]" />
                  }
                </button>
              </div>

              {/* Password match indicator */}
              {passwordsMatch && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-500">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('validation.passwordsMatch')}
                </p>
              )}
              {passwordsMismatch && !fieldErrors.confirmPassword && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-500">
                  <XCircle className="h-3 w-3" />
                  {t('validation.passwordsMismatch')}
                </p>
              )}
              {fieldErrors.confirmPassword && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs text-red-500">
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3.5',
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
              {t('auth.registerButton')}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-primary)' }} />
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('auth.or')}
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-primary)' }} />
          </div>

          {/* Login link */}
          <p
            className="text-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="auth-gradient-text font-semibold transition-opacity duration-200 hover:opacity-75"
            >
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
