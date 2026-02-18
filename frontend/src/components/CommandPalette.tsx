import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Command } from 'cmdk'
import {
  Search,
  LayoutDashboard,
  ArrowRightLeft,
  CalendarRange,
  CreditCard,
  Landmark,
  Tags,
  TrendingUp,
  Bell,
  Settings,
  Wallet,
  Users,
  Database,
  RefreshCw,
  Building2,
  Plus,
  Sun,
  Moon,
  Globe,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NavItem {
  key: string
  icon: LucideIcon
  path: string
  group: 'main' | 'finance' | 'system'
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard', group: 'main' },
  { key: 'transactions', icon: ArrowRightLeft, path: '/transactions', group: 'main' },
  { key: 'balance', icon: Wallet, path: '/balance', group: 'main' },
  { key: 'fixed', icon: CalendarRange, path: '/fixed', group: 'finance' },
  { key: 'installments', icon: CreditCard, path: '/installments', group: 'finance' },
  { key: 'loans', icon: Landmark, path: '/loans', group: 'finance' },
  { key: 'creditCards', icon: CreditCard, path: '/credit-cards', group: 'finance' },
  { key: 'bankAccounts', icon: Landmark, path: '/bank-accounts', group: 'finance' },
  { key: 'subscriptions', icon: RefreshCw, path: '/subscriptions', group: 'finance' },
  { key: 'forecast', icon: TrendingUp, path: '/forecast', group: 'finance' },
  { key: 'categories', icon: Tags, path: '/categories', group: 'system' },
  { key: 'organizations', icon: Building2, path: '/organizations', group: 'system' },
  { key: 'alerts', icon: Bell, path: '/alerts', group: 'system' },
  { key: 'settings', icon: Settings, path: '/settings', group: 'system' },
  { key: 'users', icon: Users, path: '/users', group: 'system', adminOnly: true },
  { key: 'backups', icon: Database, path: '/backups', group: 'system', adminOnly: true },
]

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { user } = useAuth()

  const isAdmin = !!user?.is_admin

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path)
      onOpenChange(false)
    },
    [navigate, onOpenChange],
  )

  const handleToggleTheme = useCallback(() => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    } else {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
    }
    onOpenChange(false)
  }, [theme, resolvedTheme, setTheme, onOpenChange])

  const handleChangeLanguage = useCallback(() => {
    const newLang = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(newLang)
    document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = newLang
    onOpenChange(false)
  }, [i18n, onOpenChange])

  const mainItems = visibleItems.filter((i) => i.group === 'main')
  const financeItems = visibleItems.filter((i) => i.group === 'finance')
  const systemItems = visibleItems.filter((i) => i.group === 'system')

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    return (
      <Command.Item
        key={item.key}
        value={`${item.key} ${t(`nav.${item.key}`)}`}
        onSelect={() => handleNavigate(item.path)}
        className="cmdk-item"
      >
        <span className="cmdk-item-icon">
          <Icon size={18} />
        </span>
        <span>{t(`nav.${item.key}`)}</span>
      </Command.Item>
    )
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('commandPalette.placeholder')}
      loop
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-dialog"
    >
      {/* Search input */}
      <div className="cmdk-input-wrapper">
        <Search size={20} className="cmdk-search-icon" />
        <Command.Input
          placeholder={t('commandPalette.placeholder')}
          className="cmdk-input"
        />
        <kbd className="cmdk-kbd">ESC</kbd>
      </div>

      {/* Separator */}
      <div className="cmdk-separator" />

      {/* Results list */}
      <Command.List className="cmdk-list">
        <Command.Empty className="cmdk-empty">
          {t('commandPalette.noResults')}
        </Command.Empty>

        {/* Navigation - Main */}
        <Command.Group heading={t('nav.main')} className="cmdk-group">
          {mainItems.map(renderNavItem)}
        </Command.Group>

        {/* Navigation - Finance */}
        <Command.Group heading={t('nav.finance')} className="cmdk-group">
          {financeItems.map(renderNavItem)}
        </Command.Group>

        {/* Navigation - System */}
        <Command.Group heading={t('nav.system')} className="cmdk-group">
          {systemItems.map(renderNavItem)}
        </Command.Group>

        {/* Quick Actions */}
        <Command.Group heading={t('commandPalette.quickActions')} className="cmdk-group">
          <Command.Item
            value={`add-transaction ${t('commandPalette.addTransaction')}`}
            onSelect={() => handleNavigate('/transactions?action=add')}
            className="cmdk-item"
          >
            <span className="cmdk-item-icon cmdk-item-icon-accent">
              <Plus size={18} />
            </span>
            <span>{t('commandPalette.addTransaction')}</span>
          </Command.Item>

          <Command.Item
            value={`toggle-theme ${t('commandPalette.toggleTheme')}`}
            onSelect={handleToggleTheme}
            className="cmdk-item"
          >
            <span className="cmdk-item-icon">
              {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            <span>{t('commandPalette.toggleTheme')}</span>
            <span className="cmdk-item-shortcut">
              {resolvedTheme === 'dark' ? t('settings.light') : t('settings.dark')}
            </span>
          </Command.Item>

          <Command.Item
            value={`change-language ${t('commandPalette.changeLanguage')}`}
            onSelect={handleChangeLanguage}
            className="cmdk-item"
          >
            <span className="cmdk-item-icon">
              <Globe size={18} />
            </span>
            <span>{t('commandPalette.changeLanguage')}</span>
            <span className="cmdk-item-shortcut">
              {i18n.language === 'he' ? 'EN' : '\u05E2\u05D1'}
            </span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
