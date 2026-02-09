import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  User,
  Mail,
  Lock,
  LogOut,
  Loader2,
  Check,
} from 'lucide-react'
import type { Settings } from '@/types'
import { settingsApi } from '@/api/settings'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeOption = 'light' | 'dark' | 'system'

interface ThemeCardProps {
  value: ThemeOption
  label: string
  icon: React.ReactNode
  isSelected: boolean
  onSelect: () => void
}

interface LanguageCardProps {
  code: string
  label: string
  flag: string
  isSelected: boolean
  onSelect: () => void
}

// ---------------------------------------------------------------------------
// Toast notification (ephemeral)
// ---------------------------------------------------------------------------

function SaveToast({ show, message }: { show: boolean; message: string }) {
  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300',
        show
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <div
        className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        style={{ backgroundColor: '#10B981' }}
      >
        <Check className="h-4 w-4" />
        {message}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Theme Card
// ---------------------------------------------------------------------------

function ThemeCard({ value: _value, label, icon, isSelected, onSelect }: ThemeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border-2 px-6 py-5 transition-all hover:scale-[1.02]',
      )}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: isSelected ? 'var(--border-focus)' : 'var(--border-primary)',
        boxShadow: isSelected ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'var(--shadow-sm)',
      }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-lg"
        style={{
          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-hover)',
          color: isSelected ? 'var(--border-focus)' : 'var(--text-secondary)',
        }}
      >
        {icon}
      </div>
      <span
        className="text-sm font-medium"
        style={{
          color: isSelected ? 'var(--border-focus)' : 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      {isSelected && (
        <div
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Language Card
// ---------------------------------------------------------------------------

function LanguageCard({ code: _code, label, flag, isSelected, onSelect }: LanguageCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 px-5 py-4 transition-all hover:scale-[1.02]',
      )}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: isSelected ? 'var(--border-focus)' : 'var(--border-primary)',
        boxShadow: isSelected ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'var(--shadow-sm)',
      }}
    >
      <span className="text-2xl">{flag}</span>
      <span
        className="text-sm font-medium"
        style={{
          color: isSelected ? 'var(--border-focus)' : 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      {isSelected && (
        <div
          className="ms-auto flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--border-focus)' }}
        >
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-primary)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="border-b px-6 py-4"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-6 px-6 py-6">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton for loading state
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            className="border-b px-6 py-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div
              className="h-5 w-32 animate-pulse rounded"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            />
          </div>
          <div className="space-y-4 px-6 py-6">
            <div
              className="h-4 w-24 animate-pulse rounded"
              style={{ backgroundColor: 'var(--bg-hover)' }}
            />
            <div className="flex gap-4">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-28 w-28 animate-pulse rounded-xl"
                  style={{ backgroundColor: 'var(--bg-hover)' }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const isRtl = i18n.language === 'he'

  // Toast state
  const [showToast, setShowToast] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const flashToast = useCallback(() => {
    setShowToast(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2000)
  }, [])

  // ---- Data ----
  const {
    data: settings,
    isLoading,
  } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => settingsApi.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated)
      flashToast()
    },
  })

  // ---- Handlers ----
  const handleThemeChange = useCallback(
    (newTheme: ThemeOption) => {
      setTheme(newTheme)
      updateMutation.mutate({ theme: newTheme })
    },
    [setTheme, updateMutation],
  )

  const handleLanguageChange = useCallback(
    (lang: string) => {
      i18n.changeLanguage(lang)
      document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
      updateMutation.mutate({ language: lang })
    },
    [i18n, updateMutation],
  )

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      updateMutation.mutate({ currency })
    },
    [updateMutation],
  )

  const handleForecastMonthsChange = useCallback(
    (months: number) => {
      updateMutation.mutate({ forecast_months_default: months })
    },
    [updateMutation],
  )

  const handleWeekStartDayChange = useCallback(
    (day: number) => {
      updateMutation.mutate({ week_start_day: day })
    },
    [updateMutation],
  )

  const handleNotificationsToggle = useCallback(() => {
    if (!settings) return
    updateMutation.mutate({
      notifications_enabled: !settings.notifications_enabled,
    })
  }, [settings, updateMutation])

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('settings.title')}
        </h1>
        <SettingsSkeleton />
      </div>
    )
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('settings.title')}
        </h1>
        {updateMutation.isPending && (
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: 'var(--text-tertiary)' }}
          />
        )}
      </div>

      {/* ================================================================
          Appearance Section
          ================================================================ */}
      <SettingsSection title={t('settings.appearance')}>
        {/* Theme */}
        <div>
          <label
            className="mb-3 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-3 gap-4">
            <ThemeCard
              value="light"
              label={t('settings.light')}
              icon={<Sun className="h-5 w-5" />}
              isSelected={theme === 'light'}
              onSelect={() => handleThemeChange('light')}
            />
            <ThemeCard
              value="dark"
              label={t('settings.dark')}
              icon={<Moon className="h-5 w-5" />}
              isSelected={theme === 'dark'}
              onSelect={() => handleThemeChange('dark')}
            />
            <ThemeCard
              value="system"
              label={t('settings.system')}
              icon={<Monitor className="h-5 w-5" />}
              isSelected={theme === 'system'}
              onSelect={() => handleThemeChange('system')}
            />
          </div>
        </div>

        {/* Language */}
        <div>
          <label
            className="mb-3 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('settings.language')}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <LanguageCard
              code="he"
              label={t('settings.hebrew')}
              flag={'\uD83C\uDDEE\uD83C\uDDF1'}
              isSelected={i18n.language === 'he'}
              onSelect={() => handleLanguageChange('he')}
            />
            <LanguageCard
              code="en"
              label={t('settings.english')}
              flag={'\uD83C\uDDFA\uD83C\uDDF8'}
              isSelected={i18n.language === 'en'}
              onSelect={() => handleLanguageChange('en')}
            />
          </div>
        </div>
      </SettingsSection>

      {/* ================================================================
          Preferences Section
          ================================================================ */}
      <SettingsSection title={t('settings.preferences')}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Currency */}
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('settings.currency')}
            </label>
            <select
              value={settings?.currency ?? 'ILS'}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className={cn(
                'w-full rounded-lg border px-3 py-2.5 text-sm outline-none',
                'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="ILS">{'\u20AA'} ILS - Israeli Shekel</option>
              <option value="USD">$ USD - US Dollar</option>
              <option value="EUR">{'\u20AC'} EUR - Euro</option>
            </select>
          </div>

          {/* Default Forecast Months */}
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('settings.forecastDefault')}
            </label>
            <select
              value={settings?.forecast_months_default ?? 6}
              onChange={(e) => handleForecastMonthsChange(Number(e.target.value))}
              className={cn(
                'w-full rounded-lg border px-3 py-2.5 text-sm outline-none',
                'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value={3}>3 {t('forecast.months')}</option>
              <option value={6}>6 {t('forecast.months')}</option>
              <option value={12}>12 {t('forecast.months')}</option>
            </select>
          </div>

          {/* Week Start Day */}
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('settings.weekStartDay')}
            </label>
            <select
              value={settings?.week_start_day ?? 0}
              onChange={(e) => handleWeekStartDayChange(Number(e.target.value))}
              className={cn(
                'w-full rounded-lg border px-3 py-2.5 text-sm outline-none',
                'focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20',
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value={0}>{t('settings.sunday')}</option>
              <option value={1}>{t('settings.monday')}</option>
            </select>
          </div>
        </div>

        {/* Notifications toggle */}
        <div
          className="flex items-center justify-between rounded-lg border px-4 py-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                backgroundColor: settings?.notifications_enabled
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'var(--bg-hover)',
                color: settings?.notifications_enabled
                  ? '#10B981'
                  : 'var(--text-tertiary)',
              }}
            >
              {settings?.notifications_enabled ? (
                <Bell className="h-5 w-5" />
              ) : (
                <BellOff className="h-5 w-5" />
              )}
            </div>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('settings.notifications')}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('settings.notificationsDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleNotificationsToggle}
            className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            style={{
              backgroundColor: settings?.notifications_enabled
                ? 'var(--border-focus)'
                : 'var(--bg-hover)',
            }}
            role="switch"
            aria-checked={settings?.notifications_enabled ?? false}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
                settings?.notifications_enabled
                  ? 'ltr:left-[22px] rtl:right-[22px]'
                  : 'ltr:left-0.5 rtl:right-0.5',
              )}
            />
          </button>
        </div>
      </SettingsSection>

      {/* ================================================================
          Account Section
          ================================================================ */}
      <SettingsSection title={t('settings.account')}>
        {/* User info */}
        <div className="space-y-4">
          <div
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('auth.username')}
              </p>
              <p
                className="truncate text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {user?.username ?? '--'}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('auth.email')}
              </p>
              <p
                className="truncate text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {user?.email ?? '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-input)',
            }}
          >
            <Lock className="h-4 w-4" />
            {t('settings.changePassword')}
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#EF4444' }}
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>
        </div>
      </SettingsSection>

      {/* Toast */}
      <SaveToast show={showToast} message={t('settings.saved')} />
    </div>
  )
}
