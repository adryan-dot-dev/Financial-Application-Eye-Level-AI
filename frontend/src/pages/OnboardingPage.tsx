import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Globe,
  Sun,
  Moon,
  Monitor,
  Palette,
  Coins,
  Tags,
  CalendarClock,
  PartyPopper,
  Loader2,
  X,
  ToggleLeft,
  ToggleRight,
  Plus,
  User as UserIcon,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { settingsApi } from '@/api/settings'
import { balanceApi } from '@/api/balance'
import { categoriesApi } from '@/api/categories'
import { fixedApi } from '@/api/fixed'
import { authApi } from '@/api/auth'
import type { Category } from '@/types'
import type { CreateFixedData } from '@/api/fixed'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'onboarding_progress'
const TOTAL_STEPS = 7

interface FixedItem {
  key: string
  nameKey: string
  type: 'income' | 'expense'
  amount: string
  dayOfMonth: number
  enabled: boolean
  categoryId?: string
}

interface OnboardingState {
  currentStep: number
  fullName: string
  phoneNumber: string
  currency: string
  balanceAmount: string
  balanceDate: string
  balanceNotes: string
  archivedCategories: string[]
  fixedItems: FixedItem[]
  fixedItemsCreated: number
}

function getDefaultState(): OnboardingState {
  const today = new Date().toISOString().split('T')[0]
  return {
    currentStep: 0,
    fullName: '',
    phoneNumber: '',
    currency: 'ILS',
    balanceAmount: '',
    balanceDate: today,
    balanceNotes: '',
    archivedCategories: [],
    fixedItems: [
      { key: 'salary', nameKey: 'fixedSalary', type: 'income', amount: '', dayOfMonth: 10, enabled: false },
      { key: 'rent', nameKey: 'fixedRent', type: 'expense', amount: '', dayOfMonth: 1, enabled: false },
      { key: 'electricity', nameKey: 'fixedElectricity', type: 'expense', amount: '', dayOfMonth: 15, enabled: false },
      { key: 'internet', nameKey: 'fixedInternet', type: 'expense', amount: '', dayOfMonth: 5, enabled: false },
      { key: 'insurance', nameKey: 'fixedInsurance', type: 'expense', amount: '', dayOfMonth: 1, enabled: false },
    ],
    fixedItemsCreated: 0,
  }
}

function loadState(): OnboardingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<OnboardingState>
      return { ...getDefaultState(), ...parsed }
    }
  } catch {
    // ignore parse errors
  }
  return getDefaultState()
}

function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}

const CURRENCY_OPTIONS = [
  { code: 'ILS', symbol: '\u20AA', flag: '\uD83C\uDDEE\uD83C\uDDF1', nameKey: 'currencyILS' },
  { code: 'USD', symbol: '$', flag: '\uD83C\uDDFA\uD83C\uDDF8', nameKey: 'currencyUSD' },
  { code: 'EUR', symbol: '\u20AC', flag: '\uD83C\uDDEA\uD83C\uDDFA', nameKey: 'currencyEUR' },
]

export default function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const isRtl = i18n.language === 'he'

  const [state, setState] = useState<OnboardingState>(loadState)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [isAnimating, setIsAnimating] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [balanceError, setBalanceError] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; delay: number; color: string; size: number }>>([])
  const stepRef = useRef<HTMLDivElement>(null)

  // User data from auth API
  const [userData, setUserData] = useState<{ email?: string; full_name?: string; phone_number?: string }>({})

  // Category creation inline forms
  const [showCreateIncome, setShowCreateIncome] = useState(false)
  const [showCreateExpense, setShowCreateExpense] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatNameHe, setNewCatNameHe] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  const currentStep = state.currentStep

  useEffect(() => {
    document.title = t('pageTitle.onboarding')
  }, [t])

  // Fetch user data on mount
  useEffect(() => {
    authApi.getMe().then((user) => {
      setUserData({
        email: user.email,
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
      })
      // Pre-fill state if we have data and state is still empty
      setState((prev) => ({
        ...prev,
        fullName: prev.fullName || user.full_name || '',
        phoneNumber: prev.phoneNumber || user.phone_number || '',
      }))
    }).catch(() => {})
  }, [])

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    saveState(state)
  }, [state])

  // Load categories when we reach step 4
  useEffect(() => {
    if (currentStep === 4 && categories.length === 0) {
      setIsLoadingCategories(true)
      categoriesApi.list()
        .then((cats) => {
          setCategories(cats)
        })
        .catch(() => {
          // Categories may not be loaded yet
        })
        .finally(() => {
          setIsLoadingCategories(false)
        })
    }
  }, [currentStep, categories.length])

  // Generate confetti on final step
  useEffect(() => {
    if (currentStep === 6) {
      const colors = ['#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B']
      const pieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      }))
      setConfettiPieces(pieces)
    }
  }, [currentStep])

  const updateState = useCallback((partial: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const goToStep = useCallback((step: number, dir: 'next' | 'prev') => {
    if (isAnimating) return
    setDirection(dir)
    setIsAnimating(true)
    setError('')
    setBalanceError(false)

    setTimeout(() => {
      setState((prev) => ({ ...prev, currentStep: step }))
      setIsAnimating(false)
      // Scroll to top of step
      if (stepRef.current) {
        stepRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 300)
  }, [isAnimating])

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      goToStep(currentStep + 1, 'next')
    }
  }, [currentStep, goToStep])

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1, 'prev')
    }
  }, [currentStep, goToStep])

  // Step 2 handlers
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
  }

  // Step 3 handler
  const handleCurrencyChange = (currency: string) => {
    updateState({ currency })
  }

  // Step 1 - Save personal info
  const handleSavePersonalInfo = async () => {
    if (!state.fullName && !state.phoneNumber) {
      // Nothing to save, just proceed
      goNext()
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await authApi.updateMe({
        full_name: state.fullName,
        phone_number: state.phoneNumber,
      })
      goNext()
    } catch {
      // If the update fails, still let them proceed
      goNext()
    } finally {
      setIsSaving(false)
    }
  }

  // Step 3 - Save currency + balance (merged step)
  const handleSaveCurrencyBalance = async () => {
    if (!state.balanceAmount || isNaN(Number(state.balanceAmount))) {
      setBalanceError(true)
      return
    }

    setBalanceError(false)
    setIsSaving(true)
    setError('')
    try {
      await balanceApi.create({
        balance: Number(state.balanceAmount),
        effective_date: state.balanceDate,
        notes: state.balanceNotes || undefined,
      })
      goNext()
    } catch {
      setError(t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  // Step 4 - Toggle category
  const toggleCategory = async (categoryId: string, currentlyArchived: boolean) => {
    try {
      await categoriesApi.update(categoryId, { is_archived: !currentlyArchived } as { name?: string; name_he?: string; type?: string; icon?: string; color?: string })
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, is_archived: !currentlyArchived } : c))
      )
    } catch {
      // silent failure
    }
  }

  // Step 4 - Create custom category
  const handleCreateCategory = async (type: 'income' | 'expense') => {
    if (!newCatName.trim() || !newCatNameHe.trim()) return

    setIsCreatingCategory(true)
    try {
      const created = await categoriesApi.create({
        name: newCatName.trim(),
        name_he: newCatNameHe.trim(),
        type,
      })
      setCategories((prev) => [...prev, created])
      setNewCatName('')
      setNewCatNameHe('')
      if (type === 'income') setShowCreateIncome(false)
      else setShowCreateExpense(false)
    } catch {
      // silent failure
    } finally {
      setIsCreatingCategory(false)
    }
  }

  // Step 5 - Toggle fixed item
  const toggleFixedItem = (key: string) => {
    updateState({
      fixedItems: state.fixedItems.map((item) =>
        item.key === key ? { ...item, enabled: !item.enabled } : item
      ),
    })
  }

  const updateFixedItem = (key: string, field: 'amount' | 'dayOfMonth', value: string | number) => {
    updateState({
      fixedItems: state.fixedItems.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      ),
    })
  }

  // Step 5 - Save fixed items
  const handleSaveFixed = async () => {
    const enabledItems = state.fixedItems.filter(
      (item) => item.enabled && item.amount && Number(item.amount) > 0
    )

    if (enabledItems.length === 0) {
      goNext()
      return
    }

    setIsSaving(true)
    setError('')
    let created = 0

    try {
      const today = new Date().toISOString().split('T')[0]
      for (const item of enabledItems) {
        const data: CreateFixedData = {
          name: t(`onboarding.${item.nameKey}`),
          amount: Number(item.amount),
          type: item.type,
          day_of_month: item.dayOfMonth,
          start_date: today,
        }

        // Try to find a matching category
        if (item.categoryId) {
          data.category_id = item.categoryId
        }

        await fixedApi.create(data)
        created++
      }
      updateState({ fixedItemsCreated: created })
      goNext()
    } catch {
      setError(t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  // Complete onboarding
  const handleComplete = async () => {
    setIsSaving(true)
    setError('')
    try {
      await settingsApi.update({
        currency: state.currency,
        language: i18n.language,
        theme: theme,
        onboarding_completed: true,
      })
      clearState()
      // Set flag so ProtectedRoute doesn't re-check and redirect back
      sessionStorage.setItem('onboarding_completed', 'true')
      navigate('/dashboard', { replace: true })
    } catch {
      setError(t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  // Currency symbol helper
  const currencySymbol = CURRENCY_OPTIONS.find((c) => c.code === state.currency)?.symbol || '\u20AA'

  // Step labels for progress
  const stepIcons = [
    <PartyPopper key="s0" className="h-4 w-4" />,
    <UserIcon key="s1" className="h-4 w-4" />,
    <Palette key="s2" className="h-4 w-4" />,
    <Coins key="s3" className="h-4 w-4" />,
    <Tags key="s4" className="h-4 w-4" />,
    <CalendarClock key="s5" className="h-4 w-4" />,
    <Check key="s6" className="h-4 w-4" />,
  ]

  // ========== RENDER HELPERS ==========

  // Step 0: Welcome
  const renderWelcome = () => (
    <div className="flex flex-col items-center text-center">
      {/* Logo */}
      <div className="onboarding-logo-pulse mb-6 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/20">
        <img
          src="/logo.jpeg"
          alt={t('app.company')}
          className="h-28 w-28 object-cover"
        />
      </div>

      <h1
        className="mb-3 text-4xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('onboarding.welcome')}
      </h1>

      <p className="auth-gradient-text mb-2 text-xl font-semibold">
        {t('onboarding.welcomeDesc')}
      </p>

      <p
        className="mb-10 max-w-md text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('onboarding.welcomeSubDesc')}
      </p>

      <button
        onClick={goNext}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-8 py-4',
          'text-base font-semibold text-white',
          'onboarding-btn-gradient',
          'transition-all duration-300',
          'hover:scale-105 hover:shadow-lg',
          'active:scale-[0.98]',
        )}
      >
        {t('onboarding.letsStart')}
        <ChevronRight className={cn(
          'h-5 w-5 transition-transform duration-300 group-hover:translate-x-1',
          isRtl && 'rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0'
        )} />
      </button>
    </div>
  )

  // Step 1: Personal Info (NEW)
  const renderPersonalInfo = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2
          className="mb-2 text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('onboarding.stepPersonalInfo')}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
          {t('onboarding.stepPersonalInfoDesc')}
        </p>
      </div>

      <div className="mx-auto max-w-sm space-y-5">
        {/* Full Name */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.fullName')}
          </label>
          <input
            type="text"
            value={state.fullName}
            onChange={(e) => updateState({ fullName: e.target.value })}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200',
              'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder={t('onboarding.fullNamePlaceholder')}
          />
        </div>

        {/* Phone Number */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.phoneNumber')}
          </label>
          <input
            type="tel"
            value={state.phoneNumber}
            onChange={(e) => updateState({ phoneNumber: e.target.value })}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200',
              'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder={t('onboarding.phoneNumberPlaceholder')}
            dir="ltr"
          />
        </div>

        {/* Email (readonly) */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.emailLabel')}
          </label>
          <input
            type="email"
            value={userData.email || ''}
            readOnly
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm outline-none cursor-not-allowed opacity-60',
            )}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
            dir="ltr"
          />
          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('onboarding.emailReadonly')}
          </p>
        </div>
      </div>

      {/* Skip link */}
      <div className="text-center">
        <button
          onClick={goNext}
          className="text-sm font-medium transition-colors hover:underline underline-offset-4"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('onboarding.personalInfoSkip')}
        </button>
      </div>
    </div>
  )

  // Step 2: Language & Theme
  const renderLanguageTheme = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2
          className="mb-2 text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('onboarding.stepLanguageTheme')}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
          {t('onboarding.stepLanguageThemeDesc')}
        </p>
      </div>

      {/* Language Selection */}
      <div>
        <label
          className="mb-3 block text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          <Globe className="mb-0.5 inline-block h-4 w-4" />{' '}
          {t('onboarding.selectLanguage')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { code: 'he', label: '\u05E2\u05D1\u05E8\u05D9\u05EA', flag: '\uD83C\uDDEE\uD83C\uDDF1' },
            { code: 'en', label: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={cn(
                'flex items-center justify-center gap-3 rounded-xl border-2 px-5 py-4 text-sm font-medium transition-all duration-200',
                i18n.language === lang.code
                  ? 'onboarding-card-selected'
                  : 'onboarding-card-unselected hover:border-[var(--border-focus)]'
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Theme Selection */}
      <div>
        <label
          className="mb-3 block text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          <Palette className="mb-0.5 inline-block h-4 w-4" />{' '}
          {t('onboarding.selectTheme')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light' as const, icon: <Sun className="h-6 w-6" />, labelKey: 'themeLight', descKey: 'themeLightDesc' },
            { value: 'dark' as const, icon: <Moon className="h-6 w-6" />, labelKey: 'themeDark', descKey: 'themeDarkDesc' },
            { value: 'system' as const, icon: <Monitor className="h-6 w-6" />, labelKey: 'themeSystem', descKey: 'themeSystemDesc' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleThemeChange(opt.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all duration-200',
                theme === opt.value
                  ? 'onboarding-card-selected'
                  : 'onboarding-card-unselected hover:border-[var(--border-focus)]'
              )}
            >
              <div style={{ color: theme === opt.value ? 'var(--color-brand-600)' : 'var(--text-tertiary)' }}>
                {opt.icon}
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t(`onboarding.${opt.labelKey}`)}
              </span>
              <span
                className="text-[11px] leading-tight"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t(`onboarding.${opt.descKey}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Step 3: Currency + Balance (MERGED)
  const renderCurrencyBalance = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2
          className="mb-2 text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('onboarding.stepCurrencyBalance')}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
          {t('onboarding.stepCurrencyBalanceDesc')}
        </p>
      </div>

      {/* Currency Selection */}
      <div className="grid grid-cols-3 gap-3">
        {CURRENCY_OPTIONS.map((cur) => (
          <button
            key={cur.code}
            onClick={() => handleCurrencyChange(cur.code)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition-all duration-200',
              state.currency === cur.code
                ? 'onboarding-card-selected'
                : 'onboarding-card-unselected hover:border-[var(--border-focus)]'
            )}
          >
            <span className="text-2xl">{cur.flag}</span>
            <div className="text-center">
              <p
                className="text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {cur.symbol}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(`onboarding.${cur.nameKey}`)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Balance Input */}
      <div className="mx-auto max-w-sm space-y-5">
        {/* Amount - REQUIRED */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.balanceAmount')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span
              className={cn(
                'pointer-events-none absolute top-1/2 -translate-y-1/2 text-lg font-semibold',
                'start-4'
              )}
              style={{ color: 'var(--text-tertiary)' }}
            >
              {currencySymbol}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={state.balanceAmount}
              onChange={(e) => {
                updateState({ balanceAmount: e.target.value })
                if (balanceError) setBalanceError(false)
              }}
              className={cn(
                'amount-input w-full rounded-xl border py-4 text-center outline-none transition-all duration-200',
                'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                'ps-12 pe-4',
                balanceError && 'border-red-500 ring-2 ring-red-500/20'
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: balanceError ? undefined : 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              placeholder={t('onboarding.balancePlaceholder')}
            />
          </div>
          {balanceError && (
            <p className="mt-2 text-sm text-red-500">
              {t('onboarding.balanceRequired')}
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.balanceDate')}
          </label>
          <input
            type="date"
            value={state.balanceDate}
            onChange={(e) => updateState({ balanceDate: e.target.value })}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200',
              'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Notes */}
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('onboarding.balanceNotes')}
          </label>
          <input
            type="text"
            value={state.balanceNotes}
            onChange={(e) => updateState({ balanceNotes: e.target.value })}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-200',
              'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder={t('onboarding.balanceNotesPlaceholder')}
          />
        </div>
      </div>
    </div>
  )

  // Step 4: Categories
  const renderCategories = () => {
    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    const renderInlineCreateForm = (type: 'income' | 'expense') => {
      const isShowing = type === 'income' ? showCreateIncome : showCreateExpense
      const setShowing = type === 'income' ? setShowCreateIncome : setShowCreateExpense

      if (!isShowing) {
        return (
          <button
            onClick={() => {
              setNewCatName('')
              setNewCatNameHe('')
              setShowing(true)
            }}
            className={cn(
              'mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-all duration-200 hover:border-[var(--border-focus)]'
            )}
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-tertiary)',
            }}
          >
            <Plus className="h-4 w-4" />
            {t('onboarding.addCustomCategory')}
          </button>
        )
      }

      return (
        <div
          className="mt-2 space-y-2 rounded-lg border p-3"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all duration-200',
              'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder={t('onboarding.newCategoryName')}
            dir="ltr"
          />
          <input
            type="text"
            value={newCatNameHe}
            onChange={(e) => setNewCatNameHe(e.target.value)}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all duration-200',
              'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder={t('onboarding.newCategoryNameHe')}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCreateCategory(type)}
              disabled={isCreatingCategory || !newCatName.trim() || !newCatNameHe.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200',
                'onboarding-btn-gradient',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isCreatingCategory && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('onboarding.createCategory')}
            </button>
            <button
              onClick={() => {
                setShowing(false)
                setNewCatName('')
                setNewCatNameHe('')
              }}
              className="text-xs font-medium transition-colors hover:underline underline-offset-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('onboarding.cancelCreate')}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2
            className="mb-2 text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('onboarding.stepCategories')}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            {t('onboarding.stepCategoriesDesc')}
          </p>
        </div>

        {isLoadingCategories ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-brand-600)' }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Income Categories */}
            <div>
              <h3
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--color-income)' }}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} />
                {t('onboarding.incomeCategories')} ({incomeCategories.filter((c) => !c.is_archived).length})
              </h3>
              <div className="space-y-2">
                {incomeCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id, cat.is_archived)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-all duration-200',
                      cat.is_archived
                        ? 'opacity-50'
                        : ''
                    )}
                    style={{
                      backgroundColor: cat.is_archived ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                      borderColor: cat.is_archived ? 'var(--border-primary)' : 'rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span
                      className={cn('flex-1 text-sm', cat.is_archived ? 'line-through' : 'font-medium')}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {i18n.language === 'he' ? cat.name_he : cat.name}
                    </span>
                    {cat.is_archived ? (
                      <ToggleLeft className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                    ) : (
                      <ToggleRight className="h-5 w-5" style={{ color: 'var(--color-income)' }} />
                    )}
                  </button>
                ))}
              </div>
              {renderInlineCreateForm('income')}
            </div>

            {/* Expense Categories */}
            <div>
              <h3
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--color-expense)' }}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-expense)' }} />
                {t('onboarding.expenseCategories')} ({expenseCategories.filter((c) => !c.is_archived).length})
              </h3>
              <div className="space-y-2">
                {expenseCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id, cat.is_archived)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-all duration-200',
                      cat.is_archived
                        ? 'opacity-50'
                        : ''
                    )}
                    style={{
                      backgroundColor: cat.is_archived ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                      borderColor: cat.is_archived ? 'var(--border-primary)' : 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span
                      className={cn('flex-1 text-sm', cat.is_archived ? 'line-through' : 'font-medium')}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {i18n.language === 'he' ? cat.name_he : cat.name}
                    </span>
                    {cat.is_archived ? (
                      <ToggleLeft className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                    ) : (
                      <ToggleRight className="h-5 w-5" style={{ color: 'var(--color-expense)' }} />
                    )}
                  </button>
                ))}
              </div>
              {renderInlineCreateForm('expense')}
            </div>
          </div>
        )}

        {/* Reassurance message */}
        <p className="mx-auto max-w-md text-center text-xs leading-relaxed rounded-lg px-4 py-3"
           style={{
             backgroundColor: 'rgba(59, 130, 246, 0.06)',
             color: 'var(--text-secondary)',
             border: '1px solid rgba(59, 130, 246, 0.1)'
           }}>
          {t('onboarding.canChangeLater')}
        </p>
      </div>
    )
  }

  // Step 5: Fixed Income/Expenses
  const renderFixed = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2
          className="mb-2 text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('onboarding.stepFixed')}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
          {t('onboarding.stepFixedDesc')}
        </p>
      </div>

      <div className="mx-auto max-w-lg space-y-3">
        {state.fixedItems.map((item) => (
          <div
            key={item.key}
            className={cn(
              'rounded-xl border p-4 transition-all duration-200',
              item.enabled
                ? 'onboarding-fixed-enabled'
                : ''
            )}
            style={{
              backgroundColor: item.enabled ? 'var(--bg-card)' : 'var(--bg-tertiary)',
              borderColor: item.enabled
                ? item.type === 'income'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)'
                : 'var(--border-primary)',
            }}
          >
            {/* Header row */}
            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={() => toggleFixedItem(item.key)}
                className="shrink-0"
              >
                {item.enabled ? (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: item.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
                    }}
                  >
                    <Check className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <div
                    className="h-6 w-6 rounded-md border-2"
                    style={{ borderColor: 'var(--border-primary)' }}
                  />
                )}
              </button>

              <span
                className={cn('flex-1 text-sm font-semibold', !item.enabled && 'opacity-50')}
                style={{ color: 'var(--text-primary)' }}
              >
                {t(`onboarding.${item.nameKey}`)}
              </span>

              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  item.type === 'income'
                    ? 'badge-income'
                    : 'badge-expense'
                )}
              >
                {t(`onboarding.${item.type}`)}
              </span>
            </div>

            {/* Input fields - visible when enabled */}
            {item.enabled && (
              <div className="mt-3 flex items-end gap-3">
                <div className="flex-1">
                  <label
                    className="mb-1 block text-[11px] font-medium"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('onboarding.fixedAmount')}
                  </label>
                  <div className="relative">
                    <span
                      className={cn(
                        'pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold',
                        'start-3'
                      )}
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(e) => updateFixedItem(item.key, 'amount', e.target.value)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-200',
                        'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                        'ps-9'
                      )}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder={t('onboarding.fixedAmountPlaceholder')}
                    />
                  </div>
                </div>

                <div className="w-24">
                  <label
                    className="mb-1 block text-[11px] font-medium"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('onboarding.fixedDayOfMonth')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={item.dayOfMonth}
                    onChange={(e) => updateFixedItem(item.key, 'dayOfMonth', Number(e.target.value))}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 text-center text-sm outline-none transition-all duration-200',
                      'focus-visible:border-[var(--border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]/20',
                    )}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reassurance message */}
      <p className="mx-auto max-w-md text-center text-xs leading-relaxed rounded-lg px-4 py-3"
         style={{
           backgroundColor: 'rgba(59, 130, 246, 0.06)',
           color: 'var(--text-secondary)',
           border: '1px solid rgba(59, 130, 246, 0.1)'
         }}>
        {t('onboarding.canChangeFixedLater')}
      </p>

      {/* Skip button - GHOST STYLE, NOT gradient */}
      <div className="text-center">
        <button
          onClick={goNext}
          className="text-sm font-medium transition-colors hover:underline underline-offset-4"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t('onboarding.fixedSkip')}
        </button>
      </div>
    </div>
  )

  // Step 6: Done
  const renderDone = () => {
    const activeCategories = categories.filter((c) => !c.is_archived).length
    const enabledFixed = state.fixedItems.filter((item) => item.enabled && Number(item.amount) > 0).length
    const themeLabel = theme === 'light'
      ? t('onboarding.themeLight')
      : theme === 'dark'
        ? t('onboarding.themeDark')
        : t('onboarding.themeSystem')

    return (
      <div className="relative flex flex-col items-center text-center">
        {/* Confetti */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className="onboarding-confetti"
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                backgroundColor: piece.color,
                width: `${piece.size}px`,
                height: `${piece.size}px`,
              }}
            />
          ))}
        </div>

        <div className="onboarding-done-icon mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <Check className="h-10 w-10 text-white" />
        </div>

        <h2
          className="mb-2 text-3xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('onboarding.stepDoneTitle')}
        </h2>
        <p
          className="mb-8 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('onboarding.stepDoneDesc')}
        </p>

        {/* Summary card */}
        <div
          className="mb-8 w-full max-w-sm rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <h3
            className="mb-4 text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('onboarding.setupSummary')}
          </h3>
          <div className="space-y-3">
            {state.fullName && (
              <SummaryRow
                label={t('onboarding.summaryName')}
                value={state.fullName}
              />
            )}
            {state.phoneNumber && (
              <SummaryRow
                label={t('onboarding.summaryPhone')}
                value={state.phoneNumber}
              />
            )}
            <SummaryRow
              label={t('onboarding.summaryLanguage')}
              value={i18n.language === 'he' ? '\u05E2\u05D1\u05E8\u05D9\u05EA' : 'English'}
            />
            <SummaryRow
              label={t('onboarding.summaryTheme')}
              value={themeLabel}
            />
            <SummaryRow
              label={t('onboarding.summaryCurrency')}
              value={`${currencySymbol} (${state.currency})`}
            />
            {state.balanceAmount && (
              <SummaryRow
                label={t('onboarding.summaryBalance')}
                value={`${currencySymbol}${Number(state.balanceAmount).toLocaleString()}`}
              />
            )}
            {activeCategories > 0 && (
              <SummaryRow
                label={t('onboarding.summaryCategories')}
                value={String(activeCategories)}
              />
            )}
            {(enabledFixed > 0 || state.fixedItemsCreated > 0) && (
              <SummaryRow
                label={t('onboarding.summaryFixed')}
                value={String(state.fixedItemsCreated || enabledFixed)}
              />
            )}
          </div>
        </div>

        <button
          onClick={handleComplete}
          disabled={isSaving}
          className={cn(
            'group flex items-center gap-3 rounded-xl px-8 py-4',
            'text-base font-semibold text-white',
            'onboarding-btn-gradient',
            'transition-all duration-300',
            'hover:scale-105 hover:shadow-lg',
            'active:scale-[0.98]',
            'disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
          {t('onboarding.goToDashboard')}
          <ChevronRight className={cn(
            'h-5 w-5 transition-transform duration-300 group-hover:translate-x-1',
            isRtl && 'rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0'
          )} />
        </button>
      </div>
    )
  }

  const steps = [
    renderWelcome,        // 0
    renderPersonalInfo,   // 1 (NEW)
    renderLanguageTheme,  // 2
    renderCurrencyBalance,// 3 (MERGED)
    renderCategories,     // 4
    renderFixed,          // 5
    renderDone,           // 6
  ]

  // Handle "Next" button for steps that require saving
  const handleNext = async () => {
    if (currentStep === 1) {
      // Personal info step - save personal info
      await handleSavePersonalInfo()
    } else if (currentStep === 3) {
      // Currency + Balance step - save balance (REQUIRED)
      await handleSaveCurrencyBalance()
    } else if (currentStep === 5) {
      // Fixed items step - save fixed items
      await handleSaveFixed()
    } else {
      goNext()
    }
  }

  const showNavigation = currentStep > 0 && currentStep < TOTAL_STEPS - 1
  const showBackButton = currentStep > 0 && currentStep < TOTAL_STEPS - 1
  const showNextButton = currentStep > 0 && currentStep < TOTAL_STEPS - 1

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="onboarding-page flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Background decoration */}
      <div className="onboarding-bg-decoration" />

      {/* Progress bar */}
      {currentStep > 0 && currentStep < TOTAL_STEPS - 1 && (
        <div className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'rgba(var(--bg-primary-rgb, 255, 255, 255), 0.85)' }}>
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
            {/* Step indicator text */}
            <span
              className="shrink-0 text-xs font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('onboarding.stepOf', { current: currentStep, total: TOTAL_STEPS - 2 })}
            </span>

            {/* Progress dots */}
            <div className="flex flex-1 items-center justify-center gap-2">
              {Array.from({ length: TOTAL_STEPS - 2 }, (_, i) => i + 1).map((step) => (
                <button
                  key={step}
                  onClick={() => {
                    if (step < currentStep) goToStep(step, 'prev')
                  }}
                  disabled={step > currentStep}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300',
                    step === currentStep
                      ? 'onboarding-dot-active scale-110'
                      : step < currentStep
                        ? 'onboarding-dot-completed cursor-pointer hover:scale-105'
                        : 'onboarding-dot-pending'
                  )}
                >
                  {step < currentStep ? (
                    <Check className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <span className="text-[11px] font-semibold">
                      {stepIcons[step]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Spacer for balance */}
            <span className="w-16 shrink-0" />
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        ref={stepRef}
        className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12"
      >
        <div
          className={cn(
            'w-full max-w-2xl transition-all duration-300',
            isAnimating && direction === 'next' && 'onboarding-slide-out-left',
            isAnimating && direction === 'prev' && 'onboarding-slide-out-right',
            !isAnimating && 'onboarding-slide-in',
          )}
        >
          {/* Glassmorphism card */}
          <div
            className="onboarding-glass-card rounded-2xl p-8 sm:p-10"
          >
            {/* Error message */}
            {error && (
              <div
                className="auth-error-animate mb-6 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  borderColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                }}
              >
                <X className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step content */}
            {steps[currentStep]()}
          </div>

          {/* Navigation buttons */}
          {showNavigation && (
            <div className="mt-6 flex items-center justify-between px-2">
              {showBackButton ? (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {isRtl ? (
                    <ArrowRight className="h-4 w-4" />
                  ) : (
                    <ArrowLeft className="h-4 w-4" />
                  )}
                  {t('common.back')}
                </button>
              ) : (
                <div />
              )}

              {showNextButton && (
                <button
                  onClick={handleNext}
                  disabled={isSaving}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-6 py-2.5',
                    'text-sm font-semibold text-white',
                    'onboarding-btn-gradient',
                    'transition-all duration-200',
                    'hover:opacity-90',
                    'active:scale-[0.98]',
                    'disabled:cursor-not-allowed disabled:opacity-60'
                  )}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.next')}
                  {isRtl ? (
                    <ArrowLeft className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}
