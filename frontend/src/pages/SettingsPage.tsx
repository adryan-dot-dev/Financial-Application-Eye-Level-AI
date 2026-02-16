import { useCallback, useEffect, useState } from 'react'
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
  Settings2,
  Globe,
  Palette,
  Shield,
  Coins,
  Calendar,
  BarChart3,
  AlertTriangle,
} from 'lucide-react'
import type { Settings } from '@/types'
import { settingsApi } from '@/api/settings'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeOption = 'light' | 'dark' | 'system'

// ---------------------------------------------------------------------------
// Theme Card (Apple-level)
// ---------------------------------------------------------------------------

function ThemeCard({
  label,
  icon,
  isSelected,
  onSelect,
  previewBg,
  previewFg,
}: {
  label: string
  icon: React.ReactNode
  isSelected: boolean
  onSelect: () => void
  previewBg: string
  previewFg: string
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 px-6 py-6 transition-all duration-300',
      )}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: isSelected ? 'var(--border-focus)' : 'var(--border-primary)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(59, 130, 246, 0.12), 0 8px 24px rgba(59, 130, 246, 0.1)'
          : 'var(--shadow-sm)',
      }}
    >
      {/* Mini preview */}
      <div
        className="flex h-14 w-full items-center justify-center rounded-xl transition-all duration-300"
        style={{ backgroundColor: previewBg }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ color: previewFg }}
        >
          {icon}
        </div>
      </div>

      <span
        className="text-sm font-semibold"
        style={{
          color: isSelected ? 'var(--border-focus)' : 'var(--text-secondary)',
        }}
      >
        {label}
      </span>

      {/* Checkmark */}
      {isSelected && (
        <div
          className="absolute end-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: 'var(--border-focus)',
          }}
        >
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Language Card
// ---------------------------------------------------------------------------

function LanguageCard({
  label,
  flag,
  isSelected,
  onSelect,
}: {
  label: string
  flag: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-all duration-300',
      )}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: isSelected ? 'var(--border-focus)' : 'var(--border-primary)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(59, 130, 246, 0.12), 0 4px 16px rgba(59, 130, 246, 0.08)'
          : 'var(--shadow-sm)',
      }}
    >
      <span className="text-2xl transition-all duration-300">{flag}</span>
      <span
        className="text-sm font-semibold"
        style={{
          color: isSelected ? 'var(--border-focus)' : 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      {isSelected && (
        <div
          className="ms-auto flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: 'var(--border-focus)',
          }}
        >
          <Check className="h-3.5 w-3.5 text-white" />
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
  icon,
  description,
  children,
  staggerClass,
}: {
  title: string
  icon: React.ReactNode
  description?: string
  children: React.ReactNode
  staggerClass: string
}) {
  return (
    <div className={cn('animate-fade-in-up card overflow-hidden', staggerClass)}>
      <div
        className="flex items-center gap-3 border-b px-6 py-4"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--border-focus)',
          }}
        >
          {icon}
        </div>
        <div>
          <h2
            className="text-sm font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {description}
            </p>
          )}
        </div>
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
          className={cn('animate-fade-in-up card', `stagger-${i + 1}`)}
        >
          <div
            className="flex items-center gap-3 border-b px-6 py-4"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div className="skeleton h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-3 w-40 rounded" />
            </div>
          </div>
          <div className="space-y-4 px-6 py-6">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="flex gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="skeleton h-28 flex-1 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      onClick={onChange}
      className="relative h-7 w-12 shrink-0 rounded-full transition-all duration-300"
      style={{
        backgroundColor: checked ? 'var(--border-focus)' : 'var(--bg-hover)',
        boxShadow: checked ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span
        className={cn(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300',
          checked
            ? 'ltr:left-[22px] rtl:right-[22px]'
            : 'ltr:left-0.5 rtl:right-0.5',
        )}
      />
    </button>
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
  const toast = useToast()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.settings')
  }, [t])

  // ---- Data ----
  const {
    data: settings,
    isLoading,
  } = useQuery<Settings>({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsApi.get(),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => settingsApi.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings.all, updated)
      toast.success(t('toast.savedSuccess'))
    },
    onError: (error: unknown) => {
      toast.error(t('toast.error'), getApiErrorMessage(error))
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
      document.documentElement.lang = lang
      updateMutation.mutate({ language: lang })
    },
    [i18n, updateMutation],
  )

  // ---- Currency change warning dialog state ----
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null)

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      // If already the current currency, no-op
      if (currency === (settings?.currency ?? 'ILS')) return
      // Show confirmation dialog
      setPendingCurrency(currency)
    },
    [settings?.currency],
  )

  const confirmCurrencyChange = useCallback(() => {
    if (pendingCurrency) {
      updateMutation.mutate({ currency: pendingCurrency })
      setPendingCurrency(null)
    }
  }, [pendingCurrency, updateMutation])

  const cancelCurrencyChange = useCallback(() => {
    setPendingCurrency(null)
  }, [])

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
      <div className="page-reveal space-y-6">
        <div className="animate-fade-in-up stagger-1">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('settings.title')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('settings.subtitle') || t('settings.title')}
          </p>
        </div>
        <SettingsSkeleton />
      </div>
    )
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="page-reveal space-y-6">
      {/* Page title */}
      <div className="animate-fade-in-up stagger-1 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('settings.title')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('settings.subtitle') || t('settings.title')}
          </p>
        </div>
        {updateMutation.isPending && (
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: 'var(--border-focus)' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('common.saving') || '...'}
            </span>
          </div>
        )}
      </div>

      {/* ================================================================
          Appearance Section
          ================================================================ */}
      <SettingsSection
        title={t('settings.appearance')}
        icon={<Palette className="h-4.5 w-4.5" />}
        staggerClass="stagger-2"
      >
        {/* Theme */}
        <div>
          <label
            className="mb-3 block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ThemeCard
              label={t('settings.light')}
              icon={<Sun className="h-5 w-5" />}
              isSelected={theme === 'light'}
              onSelect={() => handleThemeChange('light')}
              previewBg="#F8FAFC"
              previewFg="#F59E0B"
            />
            <ThemeCard
              label={t('settings.dark')}
              icon={<Moon className="h-5 w-5" />}
              isSelected={theme === 'dark'}
              onSelect={() => handleThemeChange('dark')}
              previewBg="#1E1B2E"
              previewFg="#818CF8"
            />
            <ThemeCard
              label={t('settings.system')}
              icon={<Monitor className="h-5 w-5" />}
              isSelected={theme === 'system'}
              onSelect={() => handleThemeChange('system')}
              previewBg="linear-gradient(135deg, #F8FAFC 50%, #1E1B2E 50%)"
              previewFg="#3B82F6"
            />
          </div>
        </div>

        {/* Language */}
        <div>
          <label
            className="mb-3 block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {t('settings.language')}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <LanguageCard
              label={t('settings.hebrew')}
              flag={'\uD83C\uDDEE\uD83C\uDDF1'}
              isSelected={i18n.language === 'he'}
              onSelect={() => handleLanguageChange('he')}
            />
            <LanguageCard
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
      <SettingsSection
        title={t('settings.preferences')}
        icon={<Settings2 className="h-4.5 w-4.5" />}
        staggerClass="stagger-3"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* Currency */}
          <div>
            <label
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <Coins className="h-3.5 w-3.5" />
              {t('settings.currency')}
            </label>
            <select
              value={settings?.currency ?? 'ILS'}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="ILS">{'\u20AA'} ILS - {t('settings.currencyILS')}</option>
              <option value="USD">$ USD - {t('settings.currencyUSD')}</option>
              <option value="EUR">{'\u20AC'} EUR - {t('settings.currencyEUR')}</option>
            </select>
          </div>

          {/* Default Forecast Months */}
          <div>
            <label
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {t('settings.forecastDefault')}
            </label>
            <select
              value={settings?.forecast_months_default ?? 6}
              onChange={(e) => handleForecastMonthsChange(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none"
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
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <Calendar className="h-3.5 w-3.5" />
              {t('settings.weekStartDay')}
            </label>
            <select
              value={settings?.week_start_day ?? 0}
              onChange={(e) => handleWeekStartDayChange(Number(e.target.value))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none"
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
          className="flex items-center justify-between rounded-xl border px-5 py-4"
          style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
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
                className="text-sm font-semibold"
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
          <ToggleSwitch
            checked={settings?.notifications_enabled ?? false}
            onChange={handleNotificationsToggle}
            label={t('settings.notifications')}
          />
        </div>
      </SettingsSection>

      {/* ================================================================
          Account Section
          ================================================================ */}
      <SettingsSection
        title={t('settings.account')}
        icon={<Shield className="h-4.5 w-4.5" />}
        staggerClass="stagger-4"
      >
        {/* User info cards */}
        <div
          className="space-y-3 rounded-xl p-4"
          style={{
            background: 'rgba(59, 130, 246, 0.04)',
          }}
        >
          <div
            className="flex items-center gap-4 rounded-xl border px-5 py-4 transition-all hover:shadow-sm"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--border-focus)',
              }}
            >
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('auth.username')}
              </p>
              <p
                className="mt-0.5 truncate text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
                title={user?.username ?? '--'}
              >
                {user?.username ?? '--'}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-4 rounded-xl border px-5 py-4 transition-all hover:shadow-sm"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: 'var(--border-focus)',
              }}
            >
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('auth.email')}
              </p>
              <p
                className="mt-0.5 truncate text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
                title={user?.email ?? '--'}
              >
                {user?.email ?? '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
          >
            <Lock className="h-4 w-4" />
            {t('settings.changePassword')}
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{
              backgroundColor: '#EF4444',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>
        </div>
      </SettingsSection>

      {/* ================================================================
          Currency Change Warning Dialog
          ================================================================ */}
      {pendingCurrency && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={cancelCurrencyChange}
          role="dialog"
          aria-modal="true"
          aria-labelledby="currency-dialog-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-xl animate-fade-in-up"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning icon */}
            <div className="mb-4 flex justify-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
              >
                <AlertTriangle className="h-7 w-7" style={{ color: '#F59E0B' }} />
              </div>
            </div>

            {/* Title */}
            <h3
              id="currency-dialog-title"
              className="mb-2 text-center text-lg font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('settings.currencyChangeTitle')}
            </h3>

            {/* Message */}
            <p
              className="mb-6 text-center text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('settings.currencyChangeMessage')}
            </p>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={cancelCurrencyChange}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:bg-[var(--bg-hover)]"
                style={{
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmCurrencyChange}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{
                  backgroundColor: '#F59E0B',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                }}
              >
                {t('settings.currencyChangeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
