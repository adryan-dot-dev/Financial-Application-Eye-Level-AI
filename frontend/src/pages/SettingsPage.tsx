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
  ChevronRight,
  Eye,
  EyeOff,
  ArrowRightLeft,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import type { Settings } from '@/types'
import { settingsApi } from '@/api/settings'
import { currencyApi } from '@/api/currency'
import type { ExchangeRate } from '@/api/currency'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { useToast } from '@/contexts/ToastContext'
import { getApiErrorMessage } from '@/api/client'
import { cn, getCurrencySymbol, getCurrencyFlag, formatCurrency } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeOption = 'light' | 'dark' | 'system'

// ---------------------------------------------------------------------------
// Theme Card — Premium with mini live-preview of actual UI
// ---------------------------------------------------------------------------

function ThemeCard({
  label,
  themeValue,
  icon,
  isSelected,
  onSelect,
}: {
  label: string
  themeValue: ThemeOption
  icon: React.ReactNode
  isSelected: boolean
  onSelect: () => void
}) {
  // Mini preview palette per theme
  const previewConfig = {
    light: {
      bg: '#F4F7FE',
      cardBg: '#FFFFFF',
      sidebarBg: '#1A1F37',
      headerLine: '#E2E8F0',
      textLine1: '#CBD5E1',
      textLine2: '#E2E8F0',
      accentDot: 'var(--color-brand-500)',
    },
    dark: {
      bg: '#111C44',
      cardBg: '#1B254B',
      sidebarBg: '#111C44',
      headerLine: 'rgba(255,255,255,0.1)',
      textLine1: 'rgba(255,255,255,0.15)',
      textLine2: 'rgba(255,255,255,0.08)',
      accentDot: 'var(--color-brand-400)',
    },
    system: {
      bg: '',
      cardBg: '',
      sidebarBg: '',
      headerLine: '',
      textLine1: '',
      textLine2: '',
      accentDot: 'var(--color-brand-500)',
    },
  }

  const preview = previewConfig[themeValue]

  return (
    <button
      onClick={onSelect}
      className={cn(
        'btn-press group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 p-5 transition-all duration-300',
      )}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: isSelected ? 'var(--border-focus)' : 'var(--border-primary)',
        boxShadow: isSelected
          ? '0 0 0 4px var(--bg-info), 0 8px 32px rgba(67, 24, 255, 0.12)'
          : 'var(--shadow-xs)',
      }}
    >
      {/* Mini preview window */}
      <div
        className="w-full overflow-hidden rounded-xl border transition-all duration-300"
        style={{
          borderColor: isSelected ? 'var(--border-info)' : 'var(--border-primary)',
          height: '72px',
        }}
      >
        {themeValue === 'system' ? (
          /* Split preview for system */
          <div className="flex h-full w-full">
            <div className="flex flex-1 flex-col p-2" style={{ backgroundColor: '#F4F7FE' }}>
              <div className="mb-1.5 h-1.5 w-8 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
              <div className="mb-1 h-1 w-12 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
              <div className="h-1 w-6 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
              <div className="mt-auto flex gap-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} />
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-brand-500)' }} />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-2" style={{ backgroundColor: '#111C44' }}>
              <div className="mb-1.5 h-1.5 w-8 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div className="mb-1 h-1 w-12 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <div className="h-1 w-6 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <div className="mt-auto flex gap-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-success-light)' }} />
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-brand-400)' }} />
              </div>
            </div>
          </div>
        ) : (
          /* Full preview for light/dark */
          <div className="flex h-full w-full" style={{ backgroundColor: preview.bg }}>
            {/* Mini sidebar */}
            <div
              className="flex w-5 shrink-0 flex-col items-center gap-1.5 p-1.5"
              style={{ backgroundColor: preview.sidebarBg }}
            >
              <div className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: preview.accentDot }} />
              <div className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: preview.textLine1, opacity: 0.5 }} />
              <div className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: preview.textLine1, opacity: 0.3 }} />
            </div>
            {/* Mini content area */}
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {/* Header bar */}
              <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: preview.headerLine }} />
              {/* Cards row */}
              <div className="flex gap-1">
                <div className="flex-1 rounded" style={{ backgroundColor: preview.cardBg, border: `1px solid ${preview.headerLine}`, height: '14px' }}>
                  <div className="ms-1 mt-1 h-1 w-4 rounded-full" style={{ backgroundColor: preview.textLine1 }} />
                </div>
                <div className="flex-1 rounded" style={{ backgroundColor: preview.cardBg, border: `1px solid ${preview.headerLine}`, height: '14px' }}>
                  <div className="ms-1 mt-1 h-1 w-5 rounded-full" style={{ backgroundColor: preview.textLine2 }} />
                </div>
              </div>
              {/* Bottom chart area */}
              <div
                className="flex-1 rounded"
                style={{ backgroundColor: preview.cardBg, border: `1px solid ${preview.headerLine}` }}
              >
                <div className="flex h-full items-end gap-0.5 p-1">
                  {[40, 65, 50, 80, 60, 70, 45].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${h}%`,
                        backgroundColor: preview.accentDot,
                        opacity: 0.3 + (i * 0.1),
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Label row */}
      <div className="flex items-center gap-2">
        <span
          className="transition-colors duration-300"
          style={{
            color: isSelected ? 'var(--border-focus)' : 'var(--text-tertiary)',
          }}
        >
          {icon}
        </span>
        <span
          className="text-sm font-semibold transition-colors duration-300"
          style={{
            color: isSelected ? 'var(--border-focus)' : 'var(--text-secondary)',
          }}
        >
          {label}
        </span>
      </div>

      {/* Checkmark indicator */}
      {isSelected && (
        <div
          className="absolute end-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
          style={{
            backgroundColor: 'var(--color-brand-500)',
          }}
        >
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Hover glow */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300',
          isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
        )}
        style={{
          boxShadow: 'inset 0 0 0 1px var(--border-focus)',
        }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Language Card — Premium with flag + direction subtitle
// ---------------------------------------------------------------------------

function LanguageCard({
  label,
  flag,
  subtitle,
  isSelected,
  onSelect,
}: {
  label: string
  flag: string
  subtitle: string
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'btn-press group relative flex items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-all duration-300',
      )}
      style={{
        backgroundColor: isSelected ? 'var(--bg-info)' : 'var(--bg-card)',
        borderColor: isSelected ? 'var(--border-focus)' : 'var(--border-primary)',
        boxShadow: isSelected
          ? '0 0 0 4px var(--bg-info), 0 4px 16px rgba(67, 24, 255, 0.1)'
          : 'var(--shadow-xs)',
      }}
    >
      <span className="text-3xl transition-transform duration-300 group-hover:scale-110">{flag}</span>
      <div className="flex flex-col items-start gap-0.5">
        <span
          className="text-sm font-bold transition-colors duration-300"
          style={{
            color: isSelected ? 'var(--border-focus)' : 'var(--text-primary)',
          }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-medium"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {subtitle}
        </span>
      </div>
      {isSelected && (
        <div
          className="ms-auto flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
          style={{
            backgroundColor: 'var(--color-brand-500)',
          }}
        >
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Toggle Switch — Apple-style with spring physics
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
        backgroundColor: checked ? 'var(--color-brand-500)' : 'var(--bg-hover)',
        boxShadow: checked
          ? '0 2px 10px rgba(67, 24, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
          : 'inset 0 1px 3px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(0,0,0,0.06)',
      }}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span
        className={cn(
          'absolute top-0.5 block h-6 w-6 rounded-full bg-white transition-all duration-300',
          checked
            ? 'ltr:left-[22px] rtl:right-[22px]'
            : 'ltr:left-0.5 rtl:right-0.5',
        )}
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06)',
        }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper — Premium card with icon header
// ---------------------------------------------------------------------------

function SettingsSection({
  title,
  icon,
  description,
  children,
  staggerClass,
  iconBg,
  iconColor,
}: {
  title: string
  icon: React.ReactNode
  description?: string
  children: React.ReactNode
  staggerClass: string
  iconBg?: string
  iconColor?: string
}) {
  return (
    <div className={cn('animate-fade-in-up card overflow-hidden', staggerClass)}>
      {/* Section header */}
      <div
        className="flex items-center gap-3.5 border-b px-6 py-5"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
          style={{
            background: iconBg || 'var(--bg-info)',
            color: iconColor || 'var(--color-info)',
          }}
        >
          {icon}
        </div>
        <div>
          <h2
            className="text-[15px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-7 px-6 py-6">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Premium Select Component
// ---------------------------------------------------------------------------

function PremiumSelect({
  value,
  onChange,
  options,
  icon,
  label,
}: {
  value: string | number
  onChange: (value: string) => void
  options: { value: string | number; label: string }[]
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="group">
      <label
        className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {icon}
        </span>
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border px-4 py-3 pe-10 text-sm font-medium outline-none transition-all duration-200 focus:ring-2"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronRight
          className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90"
          style={{ color: 'var(--text-tertiary)' }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preference Row — inline toggle item with status-aware styling
// ---------------------------------------------------------------------------

function PreferenceRow({
  icon,
  title,
  description,
  iconBgActive,
  iconColorActive,
  iconBgInactive,
  iconColorInactive,
  isActive,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  iconBgActive: string
  iconColorActive: string
  iconBgInactive: string
  iconColorInactive: string
  isActive: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border px-5 py-4 transition-all duration-300"
      style={{
        borderColor: isActive ? 'var(--border-success)' : 'var(--border-primary)',
        backgroundColor: isActive ? 'var(--bg-success-subtle)' : 'var(--bg-card)',
      }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
          style={{
            backgroundColor: isActive ? iconBgActive : iconBgInactive,
            color: isActive ? iconColorActive : iconColorInactive,
          }}
        >
          {icon}
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </p>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account Info Card
// ---------------------------------------------------------------------------

function AccountInfoCard({
  icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  iconBg: string
  iconColor: string
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border px-5 py-4 transition-all duration-300 hover:shadow-sm"
      style={{
        borderColor: 'var(--border-primary)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          background: iconBg,
          color: iconColor,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 truncate text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton — Premium shimmer loading state
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn('animate-fade-in-up card overflow-hidden', `stagger-${i + 1}`)}
        >
          {/* Section header skeleton */}
          <div
            className="flex items-center gap-3.5 border-b px-6 py-5"
            style={{ borderColor: 'var(--border-primary)' }}
          >
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-32 rounded-md" />
              <div className="skeleton h-3 w-48 rounded-md" />
            </div>
          </div>
          {/* Content skeleton */}
          <div className="space-y-5 px-6 py-6">
            {i === 1 ? (
              /* Theme cards skeleton */
              <>
                <div className="skeleton h-3 w-16 rounded" />
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="skeleton h-32 rounded-2xl" />
                  ))}
                </div>
                <div className="skeleton h-3 w-20 rounded" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="skeleton h-16 rounded-2xl" />
                  <div className="skeleton h-16 rounded-2xl" />
                </div>
              </>
            ) : i === 2 ? (
              /* Preferences skeleton */
              <>
                <div className="grid grid-cols-3 gap-5">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="space-y-2">
                      <div className="skeleton h-3 w-20 rounded" />
                      <div className="skeleton h-12 rounded-xl" />
                    </div>
                  ))}
                </div>
                <div className="skeleton h-18 rounded-xl" />
              </>
            ) : (
              /* Account skeleton */
              <>
                <div className="space-y-3 rounded-xl p-4" style={{ background: 'var(--bg-info)' }}>
                  <div className="skeleton h-16 rounded-xl" />
                  <div className="skeleton h-16 rounded-xl" />
                </div>
                <div className="flex gap-3">
                  <div className="skeleton h-11 w-40 rounded-xl" />
                  <div className="skeleton h-11 w-28 rounded-xl" />
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exchange Rate Widget
// ---------------------------------------------------------------------------

function ExchangeRateWidget() {
  const { t } = useTranslation()
  const [convertFrom, setConvertFrom] = useState('ILS')
  const [convertTo, setConvertTo] = useState('USD')
  const [convertAmount, setConvertAmount] = useState('1000')

  // Fetch exchange rates
  const { data: ratesData, isLoading: ratesLoading, isError: ratesError, refetch } = useQuery<ExchangeRate>({
    queryKey: queryKeys.currency.rates('ILS'),
    queryFn: () => currencyApi.rates('ILS'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Compute converted amount locally from rates data
  const convertedResult = (() => {
    if (!ratesData?.rates) return null
    const amt = parseFloat(convertAmount)
    if (isNaN(amt) || amt <= 0) return null

    // ratesData.base is 'ILS', ratesData.rates has { USD: x, EUR: y, ... }
    // To convert from A to B: amount * (rate_B / rate_A)
    // If base=ILS: rate for ILS=1.0 (implicit), USD=ratesData.rates.USD, etc.
    const rateFrom = convertFrom === ratesData.base ? 1 : ratesData.rates[convertFrom]
    const rateTo = convertTo === ratesData.base ? 1 : ratesData.rates[convertTo]
    if (!rateFrom || !rateTo) return null

    const result = amt * (rateTo / rateFrom)
    return {
      result: result.toFixed(2),
      rate: (rateTo / rateFrom).toFixed(6),
    }
  })()

  const currencies = ['ILS', 'USD', 'EUR']

  return (
    <div className="animate-fade-in-up stagger-4 space-y-5">
      {/* Section header */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center gap-4 border-b px-6 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--bg-info)' }}
          >
            <ArrowRightLeft className="h-5 w-5" style={{ color: 'var(--color-brand-500)' }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('currency.exchangeRates')}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('currency.exchangeRatesDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-press rounded-lg p-2 transition-all hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-tertiary)' }}
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
          >
            <RefreshCw className={cn('h-4 w-4', ratesLoading && 'animate-spin')} />
          </button>
        </div>

        <div className="p-6">
          {ratesLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('currency.loading')}
              </span>
            </div>
          ) : ratesError ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="mb-2 h-6 w-6" style={{ color: 'var(--color-warning)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('currency.noRates')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Rate cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(ratesData?.rates ?? {})
                  .filter(([code]) => code !== 'ILS')
                  .map(([code, rate]) => (
                    <div
                      key={code}
                      className="flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-sm"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-secondary)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getCurrencyFlag(code)}</span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {getCurrencySymbol('ILS')} 1 ILS
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {t(`currency.${code}`)}
                          </p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                          {getCurrencySymbol(code)} {rate.toFixed(4)}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {t('currency.rate')}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Last updated */}
              {ratesData?.date && (
                <p className="text-center text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {t('currency.lastUpdated')}: {ratesData.date}
                </p>
              )}

              {/* Converter */}
              <div
                className="rounded-xl border p-5"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-brand-500)' }} />
                  <h4
                    className="text-sm font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('currency.converter')}
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Amount */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                      {t('currency.amount')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={convertAmount}
                      onChange={(e) => setConvertAmount(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm ltr-nums outline-none transition-all focus-visible:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="1000"
                    />
                  </div>

                  {/* From */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                      {t('currency.from')}
                    </label>
                    <select
                      value={convertFrom}
                      onChange={(e) => setConvertFrom(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus-visible:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>
                          {getCurrencyFlag(c)} {getCurrencySymbol(c)} {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* To */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                      {t('currency.to')}
                    </label>
                    <select
                      value={convertTo}
                      onChange={(e) => setConvertTo(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all focus-visible:border-cyan-500 focus-visible:ring-1 focus-visible:ring-cyan-500"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>
                          {getCurrencyFlag(c)} {getCurrencySymbol(c)} {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Result */}
                {convertedResult && (
                  <div
                    className="mt-4 rounded-lg border p-3 text-center"
                    style={{
                      borderColor: 'var(--border-info)',
                      backgroundColor: 'var(--bg-info)',
                    }}
                  >
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {t('currency.result')}
                    </p>
                    <p className="mt-1 text-lg font-bold ltr-nums" style={{ color: 'var(--text-primary)' }}>
                      {formatCurrency(convertedResult.result, convertTo)}
                    </p>
                    <p className="mt-0.5 text-[10px] ltr-nums" style={{ color: 'var(--text-tertiary)' }}>
                      1 {convertFrom} = {convertedResult.rate} {convertTo}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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
  const toast = useToast()
  const isRtl = i18n.language === 'he'

  useEffect(() => {
    document.title = t('pageTitle.settings')
  }, [t])

  // ---- Data ----
  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery<Settings>({
    queryKey: queryKeys.settings.all,
    queryFn: () => settingsApi.get(),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => settingsApi.update(data),
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.all })
      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<Settings>(queryKeys.settings.all)
      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData(queryKeys.settings.all, {
          ...previousSettings,
          ...newData,
        })
      }
      return { previousSettings }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings.all, updated)
      toast.success(t('toast.savedSuccess'))
    },
    onError: (error: unknown, _variables, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.settings.all, context.previousSettings)
      }
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

  // ---- Password modal state ----
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // ---- Currency change warning dialog state ----
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null)

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      if (currency === (settings?.currency ?? 'ILS')) return
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

  // ---- Password change ----
  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword(passwordForm.current, passwordForm.new),
    onSuccess: () => {
      setShowPasswordModal(false)
      setPasswordForm({ current: '', new: '', confirm: '' })
      setPasswordError(null)
      toast.success(t('settings.passwordChangeSuccess'))
    },
    onError: (err: unknown) => {
      setPasswordError(getApiErrorMessage(err))
    },
  })

  const handlePasswordSubmit = useCallback(() => {
    setPasswordError(null)
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError(t('settings.passwordsDoNotMatch'))
      return
    }
    if (passwordForm.new.length < 8) {
      setPasswordError(t('validation.passwordMinLength'))
      return
    }
    changePasswordMutation.mutate()
  }, [passwordForm, t, changePasswordMutation])

  // ---- Currency display helper ----
  const currencySymbol = (code: string) => {
    switch (code) {
      case 'ILS': return '\u20AA'
      case 'USD': return '$'
      case 'EUR': return '\u20AC'
      default: return code
    }
  }

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="page-reveal space-y-6">
        {/* Page header */}
        <div className="animate-fade-in-up stagger-1">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--color-brand-500)' }}
            >
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1
                className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
              >
                {t('settings.title')}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('settings.subtitle') || t('settings.title')}
              </p>
            </div>
          </div>
        </div>
        <SettingsSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page-reveal space-y-6">
        <div className="animate-fade-in-up stagger-1">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--color-brand-500)' }}
            >
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1
                className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
              >
                {t('settings.title')}
              </h1>
            </div>
          </div>
        </div>
        <div className="animate-fade-in-up stagger-2 card flex flex-col items-center justify-center px-6 py-20">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--bg-danger)' }}
          >
            <AlertTriangle className="h-7 w-7" style={{ color: 'var(--color-danger)' }} />
          </div>
          <h3
            className="mb-2 text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('common.loadError')}
          </h3>
          <p
            className="mb-6 max-w-sm text-center text-sm leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('common.loadErrorDesc')}
          </p>
          <button
            onClick={() => refetch()}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            {t('error.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="page-reveal space-y-6">
      {/* ================================================================
          Page Header — Premium with gradient icon
          ================================================================ */}
      <div className="animate-fade-in-up stagger-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: 'var(--color-brand-500)' }}
          >
            <Settings2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1
              className="gradient-heading text-[1.75rem] font-extrabold tracking-tight"
            >
              {t('settings.title')}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('settings.subtitle') || t('settings.title')}
            </p>
          </div>
        </div>
        {/* Saving indicator */}
        {updateMutation.isPending && (
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2 shadow-sm"
            style={{
              backgroundColor: 'var(--bg-info)',
              border: '1px solid var(--border-info)',
            }}
          >
            <Loader2
              className="h-4 w-4 animate-spin"
              style={{ color: 'var(--color-info)' }}
            />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-info)' }}>
              {t('common.saving')}
            </span>
          </div>
        )}
      </div>

      {/* ================================================================
          Appearance Section
          ================================================================ */}
      <SettingsSection
        title={t('settings.appearance')}
        icon={<Palette className="h-5 w-5" />}
        staggerClass="stagger-2"
        iconBg="var(--bg-info)"
        iconColor="var(--color-brand-500)"
      >
        {/* Theme Picker */}
        <div>
          <label
            className="mb-3.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Palette className="h-3.5 w-3.5" />
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ThemeCard
              label={t('settings.light')}
              themeValue="light"
              icon={<Sun className="h-4 w-4" />}
              isSelected={theme === 'light'}
              onSelect={() => handleThemeChange('light')}
            />
            <ThemeCard
              label={t('settings.dark')}
              themeValue="dark"
              icon={<Moon className="h-4 w-4" />}
              isSelected={theme === 'dark'}
              onSelect={() => handleThemeChange('dark')}
            />
            <ThemeCard
              label={t('settings.system')}
              themeValue="system"
              icon={<Monitor className="h-4 w-4" />}
              isSelected={theme === 'system'}
              onSelect={() => handleThemeChange('system')}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: 'var(--border-primary)' }} />

        {/* Language Picker */}
        <div>
          <label
            className="mb-3.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Globe className="h-3.5 w-3.5" />
            {t('settings.language')}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LanguageCard
              label={t('settings.hebrew')}
              flag="🇮🇱"
              subtitle="RTL · עברית"
              isSelected={i18n.language === 'he'}
              onSelect={() => handleLanguageChange('he')}
            />
            <LanguageCard
              label={t('settings.english')}
              flag="🇺🇸"
              subtitle="LTR · English"
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
        icon={<Settings2 className="h-5 w-5" />}
        staggerClass="stagger-3"
        iconBg="var(--bg-info)"
        iconColor="var(--color-brand-500)"
      >
        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* Currency */}
          <PremiumSelect
            value={settings?.currency ?? 'ILS'}
            onChange={(val) => handleCurrencyChange(val)}
            icon={<Coins className="h-3.5 w-3.5" />}
            label={t('settings.currency')}
            options={[
              { value: 'ILS', label: `${currencySymbol('ILS')} ILS - ${t('settings.currencyILS')}` },
              { value: 'USD', label: `${currencySymbol('USD')} USD - ${t('settings.currencyUSD')}` },
              { value: 'EUR', label: `${currencySymbol('EUR')} EUR - ${t('settings.currencyEUR')}` },
            ]}
          />

          {/* Forecast Months */}
          <PremiumSelect
            value={settings?.forecast_months_default ?? 6}
            onChange={(val) => handleForecastMonthsChange(Number(val))}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label={t('settings.forecastDefault')}
            options={[
              { value: 3, label: `3 ${t('forecast.months')}` },
              { value: 6, label: `6 ${t('forecast.months')}` },
              { value: 12, label: `12 ${t('forecast.months')}` },
            ]}
          />

          {/* Week Start Day */}
          <PremiumSelect
            value={settings?.week_start_day ?? 0}
            onChange={(val) => handleWeekStartDayChange(Number(val))}
            icon={<Calendar className="h-3.5 w-3.5" />}
            label={t('settings.weekStartDay')}
            options={[
              { value: 0, label: t('settings.sunday') },
              { value: 1, label: t('settings.monday') },
            ]}
          />
        </div>

        {/* Notifications Toggle */}
        <PreferenceRow
          icon={
            settings?.notifications_enabled ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5" />
            )
          }
          title={t('settings.notifications')}
          description={t('settings.notificationsDesc')}
          iconBgActive="var(--bg-success)"
          iconColorActive="var(--color-success)"
          iconBgInactive="var(--bg-hover)"
          iconColorInactive="var(--text-tertiary)"
          isActive={settings?.notifications_enabled ?? false}
        >
          <ToggleSwitch
            checked={settings?.notifications_enabled ?? false}
            onChange={handleNotificationsToggle}
            label={t('settings.notifications')}
          />
        </PreferenceRow>
      </SettingsSection>

      {/* ================================================================
          Exchange Rates Section
          ================================================================ */}
      <ExchangeRateWidget />

      {/* ================================================================
          Account Section
          ================================================================ */}
      <SettingsSection
        title={t('settings.account')}
        icon={<Shield className="h-5 w-5" />}
        staggerClass="stagger-4"
        iconBg="var(--bg-info)"
        iconColor="var(--color-brand-500)"
      >
        {/* User info cards */}
        <div
          className="space-y-3 rounded-xl p-4"
          style={{
            background: 'var(--gradient-brand-subtle)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <AccountInfoCard
            icon={<User className="h-5 w-5" />}
            label={t('auth.username')}
            value={user?.username ?? '--'}
            iconBg="var(--bg-info)"
            iconColor="var(--color-info)"
          />
          <AccountInfoCard
            icon={<Mail className="h-5 w-5" />}
            label={t('auth.email')}
            value={user?.email ?? '--'}
            iconBg="var(--bg-info)"
            iconColor="var(--color-info)"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => {
              setShowPasswordModal(true)
              setPasswordForm({ current: '', new: '', confirm: '' })
              setPasswordError(null)
              setShowCurrentPassword(false)
              setShowNewPassword(false)
            }}
            className="btn-press btn-secondary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Lock className="h-4 w-4" />
            {t('settings.changePassword')}
          </button>
          <button
            onClick={logout}
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--color-danger)',
              boxShadow: 'var(--shadow-xs)',
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
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={cancelCurrencyChange}
          role="dialog"
          aria-modal="true"
          aria-labelledby="currency-dialog-title"
        >
          <div
            className="modal-panel w-full max-w-md border p-7"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning icon with pulse ring */}
            <div className="mb-5 flex justify-center">
              <div className="relative">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: 'var(--bg-warning)' }}
                >
                  <AlertTriangle className="h-8 w-8" style={{ color: 'var(--color-warning)' }} />
                </div>
                {/* Pulse ring — removed animate-ping */}
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

            {/* Currency change badge */}
            <div className="mb-4 flex items-center justify-center gap-2">
              <span
                className="rounded-lg px-3 py-1.5 text-sm font-bold"
                style={{
                  backgroundColor: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                }}
              >
                {currencySymbol(settings?.currency ?? 'ILS')} {settings?.currency ?? 'ILS'}
              </span>
              <ChevronRight
                className={cn('h-4 w-4', isRtl && 'rotate-180')}
                style={{ color: 'var(--text-tertiary)' }}
              />
              <span
                className="rounded-lg px-3 py-1.5 text-sm font-bold"
                style={{
                  backgroundColor: 'var(--bg-warning)',
                  color: 'var(--color-warning)',
                }}
              >
                {currencySymbol(pendingCurrency)} {pendingCurrency}
              </span>
            </div>

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
                className="btn-press btn-secondary flex-1 px-4 py-2.5 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmCurrencyChange}
                className="btn-press flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--color-warning)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                {t('settings.currencyChangeConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          Password Change Modal
          ================================================================ */}
      {showPasswordModal && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onClick={() => setShowPasswordModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-dialog-title"
        >
          <div
            className="modal-panel w-full max-w-md border p-7"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lock icon */}
            <div className="mb-5 flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'var(--bg-info)' }}
              >
                <Lock className="h-8 w-8" style={{ color: 'var(--color-info)' }} />
              </div>
            </div>

            {/* Title */}
            <h3
              id="password-dialog-title"
              className="mb-2 text-center text-lg font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('settings.changePassword')}
            </h3>
            <p
              className="mb-6 text-center text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('settings.changePasswordDesc')}
            </p>

            {/* Error banner */}
            {passwordError && (
              <div
                className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
                style={{
                  backgroundColor: 'var(--bg-danger)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--border-danger)',
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Current password */}
            <div className="mb-4">
              <label
                htmlFor="current-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('settings.currentPassword')}
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                  className="input w-full pe-10 text-sm"
                  dir="ltr"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute inset-inline-end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="mb-4">
              <label
                htmlFor="new-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('settings.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, new: e.target.value }))}
                  className="input w-full pe-10 text-sm"
                  dir="ltr"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute inset-inline-end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-tertiary)' }}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="mb-6">
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('settings.confirmNewPassword')}
              </label>
              <input
                id="confirm-password"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                className="input w-full text-sm"
                dir="ltr"
                autoComplete="new-password"
              />
              {passwordForm.confirm && passwordForm.new && (
                <p
                  className="mt-1.5 text-xs font-medium"
                  style={{
                    color: passwordForm.new === passwordForm.confirm
                      ? 'var(--color-success)'
                      : 'var(--color-danger)',
                  }}
                >
                  {passwordForm.new === passwordForm.confirm
                    ? t('validation.passwordsMatch')
                    : t('validation.passwordsMismatch')}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btn-press btn-secondary flex-1 py-2.5 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={changePasswordMutation.isPending || !passwordForm.current || !passwordForm.new || !passwordForm.confirm}
                className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {changePasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('settings.changePassword')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
