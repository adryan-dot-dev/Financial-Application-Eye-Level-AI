import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Sun, Moon, Monitor, Globe, Loader2, User, Mail, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface FieldErrors {
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { register } = useAuth()
  const { theme, setTheme } = useTheme()

  const isRtl = i18n.language === 'he'

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

  const validate = (): boolean => {
    const errors: FieldErrors = {}

    if (username.trim().length < 4) {
      errors.username = isRtl
        ? 'שם משתמש חייב להיות לפחות 4 תווים'
        : 'Username must be at least 4 characters'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      errors.email = isRtl
        ? 'כתובת אימייל לא תקינה'
        : 'Invalid email address'
    }

    if (password.length < 4) {
      errors.password = isRtl
        ? 'סיסמה חייבת להיות לפחות 4 תווים'
        : 'Password must be at least 4 characters'
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = isRtl
        ? 'הסיסמאות אינן תואמות'
        : 'Passwords do not match'
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
      className="flex min-h-screen"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Top controls */}
      <div className={cn(
        'fixed top-4 z-10 flex items-center gap-2',
        isRtl ? 'left-4' : 'right-4'
      )}>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
          title={t('settings.language')}
        >
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === 'he' ? 'EN' : 'HE'}
        </button>
        <button
          onClick={cycleTheme}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
          title={themeLabel}
        >
          {themeIcon}
        </button>
      </div>

      {/* Brand / decorative side */}
      <div className={cn(
        'brand-gradient relative hidden w-1/2 items-center justify-center lg:flex',
        isRtl ? 'order-2' : 'order-1'
      )}>
        {/* Decorative overlay blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute left-1/3 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center px-10 text-center text-white">
          <div className="mb-8 overflow-hidden rounded-2xl shadow-2xl ring-4 ring-white/20">
            <img
              src="/logo.jpeg"
              alt={t('app.company')}
              className="h-32 w-32 object-cover"
            />
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight">
            {t('app.name')}
          </h1>
          <p className="text-lg font-medium opacity-90">
            {t('app.company')}
          </p>
          <div className="mt-8 h-px w-24 bg-white/30" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed opacity-75">
            {t('auth.registerSubtitle')}
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className={cn(
        'flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2',
        isRtl ? 'order-1' : 'order-2'
      )}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-4 overflow-hidden rounded-xl shadow-lg">
              <img
                src="/logo.jpeg"
                alt={t('app.company')}
                className="h-20 w-20 object-cover"
              />
            </div>
            <h2 className="brand-gradient-text text-xl font-bold">
              {t('app.name')}
            </h2>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('auth.createAccount')}
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('auth.registerSubtitle')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label
                htmlFor="register-username"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.username')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    isRtl ? 'right-3' : 'left-3'
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
                    'w-full rounded-lg border py-2.5 text-sm outline-none transition-colors',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    fieldErrors.username ? 'border-red-400' : '',
                    isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'
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
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.username}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="register-email"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.email')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    isRtl ? 'right-3' : 'left-3'
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
                    'w-full rounded-lg border py-2.5 text-sm outline-none transition-colors',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    fieldErrors.email ? 'border-red-400' : '',
                    isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'
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
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="register-password"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.password')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    isRtl ? 'right-3' : 'left-3'
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
                    'w-full rounded-lg border py-2.5 text-sm outline-none transition-colors',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    fieldErrors.password ? 'border-red-400' : '',
                    isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'
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
                    'absolute top-1/2 -translate-y-1/2 transition-colors hover:opacity-70',
                    isRtl ? 'left-3' : 'right-3'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff className="h-[18px] w-[18px]" />
                    : <Eye className="h-[18px] w-[18px]" />
                  }
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="register-confirm-password"
                className="mb-1.5 block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.confirmPassword')}
              </label>
              <div className="relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    isRtl ? 'right-3' : 'left-3'
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
                    'w-full rounded-lg border py-2.5 text-sm outline-none transition-colors',
                    'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
                    fieldErrors.confirmPassword ? 'border-red-400' : '',
                    isRtl ? 'pr-10 pl-10' : 'pl-10 pr-10'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.confirmPassword ? undefined : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 transition-colors hover:opacity-70',
                    isRtl ? 'left-3' : 'right-3'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword
                    ? <EyeOff className="h-[18px] w-[18px]" />
                    : <Eye className="h-[18px] w-[18px]" />
                  }
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-500">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="brand-gradient flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('auth.registerButton')}
            </button>
          </form>

          {/* Login link */}
          <p
            className="mt-8 text-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: 'var(--border-focus)' }}
            >
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
