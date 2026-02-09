import { useState, useCallback } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
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
  LogOut,
  Sun,
  Moon,
  Monitor,
  Globe,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface NavItem {
  key: string
  icon: LucideIcon
  path: string
}

const navItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'transactions', icon: ArrowRightLeft, path: '/transactions' },
  { key: 'fixed', icon: CalendarRange, path: '/fixed' },
  { key: 'installments', icon: CreditCard, path: '/installments' },
  { key: 'loans', icon: Landmark, path: '/loans' },
  { key: 'balance', icon: Wallet, path: '/balance' },
  { key: 'categories', icon: Tags, path: '/categories' },
  { key: 'forecast', icon: TrendingUp, path: '/forecast' },
  { key: 'alerts', icon: Bell, path: '/alerts' },
  { key: 'settings', icon: Settings, path: '/settings' },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const isRtl = i18n.language === 'he'

  const isActive = useCallback(
    (path: string) => {
      if (path === '/') return location.pathname === '/'
      return location.pathname.startsWith(path)
    },
    [location.pathname],
  )

  const toggleLanguage = useCallback(() => {
    const newLang = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(newLang)
  }, [i18n])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  const CollapseIcon = isRtl ? ChevronLeft : ChevronRight
  const ExpandIcon = isRtl ? ChevronRight : ChevronLeft

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 z-50 flex h-full flex-col transition-all duration-300',
          // Position: right in RTL, left in LTR
          isRtl ? 'right-0' : 'left-0',
          // Mobile: slide in/out
          'max-md:-translate-x-full max-md:data-[open=true]:translate-x-0',
          isRtl && 'max-md:translate-x-full max-md:data-[open=true]:translate-x-0',
          // Desktop width
          collapsed ? 'md:w-[var(--sidebar-collapsed-width)]' : 'md:w-[var(--sidebar-width)]',
          // Mobile always full sidebar width
          'w-[var(--sidebar-width)]',
        )}
        style={{ backgroundColor: 'var(--bg-sidebar)' }}
        data-open={mobileOpen}
      >
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="absolute top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md md:hidden"
          style={{
            color: 'var(--text-sidebar)',
            [isRtl ? 'left' : 'right']: '12px',
          }}
        >
          <X size={20} />
        </button>

        {/* Logo area */}
        <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-6">
          <img
            src="/logo.jpeg"
            alt="Eye Level AI"
            className="h-[50px] w-auto rounded-lg"
          />
          {!collapsed && (
            <div className="text-center">
              <h1
                className="brand-gradient-text text-sm font-semibold leading-tight"
              >
                {t('app.name')}
              </h1>
              <p
                className="mt-0.5 text-xs"
                style={{ color: 'var(--text-sidebar)' }}
              >
                {t('app.company')}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute top-6 hidden h-6 w-6 items-center justify-center rounded-full md:flex"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)',
            [isRtl ? 'left' : 'right']: '-12px',
          }}
        >
          {collapsed ? <ExpandIcon size={14} /> : <CollapseIcon size={14} />}
        </button>

        {/* Divider */}
        <div className="mx-4 border-t border-white/10" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <li key={item.key}>
                  <Link
                    to={item.path}
                    onClick={onMobileClose}
                    title={collapsed ? t(`nav.${item.key}`) : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-white/10'
                        : 'hover:bg-white/5',
                    )}
                    style={{
                      color: active
                        ? 'var(--text-sidebar-active)'
                        : 'var(--text-sidebar)',
                    }}
                  >
                    <Icon size={20} className="shrink-0" />
                    {!collapsed && <span>{t(`nav.${item.key}`)}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom controls */}
        <div className="flex flex-col gap-3 border-t border-white/10 px-3 py-4">
          {/* Theme toggle */}
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            {([
              { value: 'light' as const, Icon: Sun },
              { value: 'dark' as const, Icon: Moon },
              { value: 'system' as const, Icon: Monitor },
            ]).map(({ value, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={t(`settings.${value}`)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  theme === value
                    ? 'bg-white/15'
                    : 'hover:bg-white/5',
                )}
                style={{
                  color: theme === value
                    ? 'var(--text-sidebar-active)'
                    : 'var(--text-sidebar)',
                }}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>

          {/* Language toggle + Logout row */}
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
            <button
              onClick={toggleLanguage}
              title={t('settings.language')}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-sidebar)' }}
            >
              <Globe size={16} className="shrink-0" />
              {!collapsed && (
                <span className="text-xs font-medium">
                  {i18n.language === 'he' ? 'EN' : '\u05E2\u05D1'}
                </span>
              )}
            </button>

            <button
              onClick={handleLogout}
              title={t('auth.logout')}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-white/5',
                !collapsed && (isRtl ? 'mr-auto' : 'ml-auto'),
              )}
              style={{ color: 'var(--text-sidebar)' }}
            >
              <LogOut size={16} className="shrink-0" />
              {!collapsed && (
                <span className="text-xs font-medium">{t('auth.logout')}</span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
