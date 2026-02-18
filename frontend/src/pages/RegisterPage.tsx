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
import { getApiErrorMessage } from '@/api/client'
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

  if (score <= 2) return { score, labelKey: 'validation.strengthWeak', color: 'var(--color-danger)', bgColor: 'var(--color-danger)' }
  if (score <= 3) return { score, labelKey: 'validation.strengthFair', color: 'var(--text-tertiary)', bgColor: 'var(--text-tertiary)' }
  if (score <= 4) return { score, labelKey: 'validation.strengthGood', color: 'var(--color-success)', bgColor: 'var(--color-success)' }
  return { score, labelKey: 'validation.strengthExcellent', color: 'var(--color-success)', bgColor: 'var(--color-success)' }
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

    if (password.length < 8) {
      errors.password = t('validation.passwordMinLength')
    } else if (!/[A-Z]/.test(password)) {
      errors.password = t('validation.passwordNeedsUppercase')
    } else if (!/[a-z]/.test(password)) {
      errors.password = t('validation.passwordNeedsLowercase')
    } else if (!/\d/.test(password)) {
      errors.password = t('validation.passwordNeedsDigit')
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
      navigate('/onboarding')
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
      {/* Top controls */}
      <div className={cn(
        'fixed top-5 z-50 flex items-center gap-2',
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

      {/* Left side - Brand panel with animated gradient mesh + floating shapes */}
      <div className={cn(
        'relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex',
        isRtl ? 'order-2' : 'order-1'
      )}>
        {/* Gradient mesh background */}
        <div className="auth-brand-bg absolute inset-0" />


        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          {/* Logo with glow */}
          <div
            className="mb-8 overflow-hidden rounded-3xl ring-1 ring-white/20"
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

          {/* Title */}
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
            {t('app.name')}
          </h1>
          <p className="text-base font-semibold tracking-widest text-white/70 uppercase">
            {t('app.company')}
          </p>

          {/* Divider */}
          <div
            className="my-8 h-px w-32"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          />

          {/* Subtitle */}
          <p className="max-w-[300px] text-base leading-relaxed text-white/60">
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
            <div
              className="mb-4 overflow-hidden rounded-2xl"
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
            <h2 className="auth-gradient-text text-xl font-extrabold tracking-tight">
              {t('app.name')}
            </h2>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-[34px] font-extrabold tracking-tight leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('auth.createAccount')}
            </h2>
            <p
              className="mt-3 text-base leading-relaxed"
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
                backgroundColor: 'rgba(238, 93, 80, 0.06)',
                borderColor: 'rgba(238, 93, 80, 0.15)',
                color: 'var(--color-danger)',
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
                    'h-12 w-full rounded-xl border text-[15px] outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-3 focus-visible:ring-[var(--border-focus)]/15',
                    'ps-12 pe-4'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.username ? 'var(--border-danger)' : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.username')}
                />
              </div>
              {fieldErrors.username && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.username}
                </p>
              )}
            </div>

            {/* Email field */}
            <div>
              <label
                htmlFor="register-email"
                className="mb-2.5 block text-sm font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.email')}
              </label>
              <div className="group relative">
                <div
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2',
                    'start-4'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <Mail className="h-5 w-5 transition-colors duration-200 group-focus-within:text-[var(--border-focus)]" />
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
                    'h-12 w-full rounded-xl border text-[15px] outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-3 focus-visible:ring-[var(--border-focus)]/15',
                    'ps-12 pe-4'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.email ? 'var(--border-danger)' : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.email')}
                />
              </div>
              {fieldErrors.email && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="register-password"
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
                    'h-12 w-full rounded-xl border text-[15px] outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-3 focus-visible:ring-[var(--border-focus)]/15',
                    'ps-12 pe-12'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.password ? 'var(--border-danger)' : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-all hover:bg-[var(--bg-hover)]',
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
              {fieldErrors.password && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--color-danger)' }}>
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
                    <span className="text-[11px] font-semibold" style={{ color: passwordStrength.color }}>
                      {t(passwordStrength.labelKey)}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={passwordStrength.score >= level ? { backgroundColor: passwordStrength.bgColor } : { backgroundColor: 'var(--bg-tertiary)' }}
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
                className="mb-2.5 block text-sm font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('auth.confirmPassword')}
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
                    'h-12 w-full rounded-xl border text-[15px] outline-none transition-all duration-200',
                    'focus-visible:border-[var(--border-focus)] focus-visible:ring-3 focus-visible:ring-[var(--border-focus)]/15',
                    'ps-12 pe-12'
                  )}
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: fieldErrors.confirmPassword
                      ? 'var(--border-danger)'
                      : passwordsMatch
                        ? 'var(--border-success)'
                        : 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder={t('auth.confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-all hover:bg-[var(--bg-hover)]',
                    'end-3'
                  )}
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showConfirmPassword
                    ? <EyeOff className="h-5 w-5" />
                    : <Eye className="h-5 w-5" />
                  }
                </button>
              </div>

              {/* Password match indicator */}
              {passwordsMatch && (
                <p className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
                  <CheckCircle2 className="h-3 w-3" />
                  {t('validation.passwordsMatch')}
                </p>
              )}
              {passwordsMismatch && !fieldErrors.confirmPassword && (
                <p className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--color-warning)' }}>
                  <XCircle className="h-3 w-3" />
                  {t('validation.passwordsMismatch')}
                </p>
              )}
              {fieldErrors.confirmPassword && (
                <p className="auth-error-animate mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  <XCircle className="h-3 w-3" />
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit button – gradient with glow + scale hover */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex h-12 w-full items-center justify-center gap-2.5 text-[15px] font-bold transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
              style={{
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
            >
              {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
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
