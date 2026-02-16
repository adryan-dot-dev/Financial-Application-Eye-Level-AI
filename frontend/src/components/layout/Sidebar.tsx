import { useState, useCallback, useRef } from 'react'
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
  Users,
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
  group: 'main' | 'finance' | 'system'
  badge?: boolean
}

const navItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard', group: 'main' },
  { key: 'transactions', icon: ArrowRightLeft, path: '/transactions', group: 'main' },
  { key: 'balance', icon: Wallet, path: '/balance', group: 'main' },
  { key: 'fixed', icon: CalendarRange, path: '/fixed', group: 'finance' },
  { key: 'installments', icon: CreditCard, path: '/installments', group: 'finance' },
  { key: 'loans', icon: Landmark, path: '/loans', group: 'finance' },
  { key: 'forecast', icon: TrendingUp, path: '/forecast', group: 'finance' },
  { key: 'categories', icon: Tags, path: '/categories', group: 'system' },
  { key: 'alerts', icon: Bell, path: '/alerts', group: 'system', badge: true },
  { key: 'settings', icon: Settings, path: '/settings', group: 'system' },
  { key: 'users', icon: Users, path: '/users', group: 'system' },
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = newLang
  }, [i18n])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  const handleItemHover = useCallback((key: string | null) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    if (key) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setHoveredItem(key)
      }, 200)
    } else {
      setHoveredItem(null)
    }
  }, [])

  const CollapseIcon = isRtl ? ChevronLeft : ChevronRight
  const ExpandIcon = isRtl ? ChevronRight : ChevronLeft

  const renderNavGroup = (group: string, items: NavItem[], label?: string) => (
    <div key={group} className="mb-1.5">
      {/* Section label (visible when expanded) */}
      {label && !collapsed && (
        <div className="mb-1 px-3 pt-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-sidebar)', opacity: 0.35 }}
          >
            {label}
          </span>
        </div>
      )}
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item.path)
        return (
          <div key={item.key} className="relative">
            <Link
              to={item.path}
              onClick={onMobileClose}
              onMouseEnter={() => collapsed && handleItemHover(item.key)}
              onMouseLeave={() => handleItemHover(null)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'sidebar-nav-item group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium my-0.5',
                collapsed && 'justify-center px-2',
                active
                  ? 'sidebar-nav-item-active text-[var(--text-sidebar-active)]'
                  : 'text-[var(--text-sidebar)] hover:text-[var(--text-sidebar-active)]',
              )}
            >
              {/* Active indicator bar */}
              {active && (
                <div
                  className={cn(
                    'sidebar-active-indicator absolute top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full',
                    '-end-0.5',
                  )}
                  style={{
                    background: 'linear-gradient(180deg, #06B6D4, #3B82F6)',
                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
                  }}
                />
              )}
              <span className="relative shrink-0">
                <Icon
                  size={18}
                  className={cn(
                    'shrink-0 transition-colors',
                    active
                      ? 'nav-icon-active text-[var(--text-sidebar-active)]'
                      : 'text-[var(--text-sidebar)] group-hover:text-[var(--text-sidebar-active)]',
                  )}
                />
                {/* Alert badge */}
                {item.badge && (
                  <span className="alert-badge absolute -top-1 -end-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </span>
              {!collapsed && (
                <span className="relative z-10">{t(`nav.${item.key}`)}</span>
              )}
            </Link>
            {/* Tooltip for collapsed state */}
            {collapsed && hoveredItem === item.key && (
              <div
                className={cn(
                  'sidebar-tooltip sidebar-tooltip-visible',
                  isRtl ? 'end-full me-3' : 'start-full ms-3',
                )}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              >
                {t(`nav.${item.key}`)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const mainItems = navItems.filter((i) => i.group === 'main')
  const financeItems = navItems.filter((i) => i.group === 'finance')
  const systemItems = navItems.filter((i) => i.group === 'system')

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label={t('nav.sidebar')}
        className={cn(
          'fixed top-0 z-50 flex h-full flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
          'start-0',
          'max-md:-translate-x-full max-md:data-[open=true]:translate-x-0',
          isRtl && 'max-md:translate-x-full max-md:data-[open=true]:translate-x-0',
          collapsed ? 'md:w-[var(--sidebar-collapsed-width)]' : 'md:w-[var(--sidebar-width)]',
          'w-[var(--sidebar-width)]',
        )}
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderInlineEnd: '1px solid var(--border-primary)',
        }}
        data-open={mobileOpen}
      >
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="absolute top-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/5 md:hidden"
          style={{
            color: 'var(--text-sidebar)',
            insetInlineEnd: '12px',
          }}
          aria-label={t('common.cancel')}
        >
          <X size={16} />
        </button>

        {/* Logo area */}
        <div className="flex flex-col items-center gap-3 px-4 pb-5 pt-6">
          <div
            className="overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-lg shadow-black/20"
          >
            <img
              src="/logo.jpeg"
              alt={t('app.company')}
              className={cn(
                'w-auto transition-all duration-300',
                collapsed ? 'h-[36px]' : 'h-[48px]',
              )}
            />
          </div>
          {!collapsed && (
            <div className="text-center">
              <h1 className="text-white font-bold text-sm leading-tight tracking-tight">
                {t('app.name')}
              </h1>
              <p className="mt-1 text-[10px] font-medium tracking-widest uppercase"
                style={{ color: 'var(--text-sidebar)', opacity: 0.4 }}
              >
                {t('app.company')}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute top-7 hidden h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 hover:opacity-80 md:flex"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-md)',
            insetInlineEnd: '-10px',
          }}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
        >
          {collapsed ? <ExpandIcon size={10} /> : <CollapseIcon size={10} />}
        </button>

        {/* Logo separator - gradient fade */}
        <div className="mx-4 mb-3 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08) 50%, transparent)' }} />

        {/* Navigation */}
        <nav aria-label={t('nav.mainNavigation')} className="flex-1 overflow-y-auto px-3 pb-3">
          {renderNavGroup('main', mainItems)}

          <div className="mx-2 my-2 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 50%, transparent)' }} />

          {renderNavGroup('finance', financeItems)}

          <div className="mx-2 my-2 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 50%, transparent)' }} />

          {renderNavGroup('system', systemItems)}
        </nav>

        {/* Bottom controls */}
        <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Theme toggle */}
          <div className={cn(
            'mb-2.5 flex items-center rounded-xl p-0.5',
            collapsed ? 'flex-col gap-1' : 'gap-0.5',
            !collapsed && 'bg-white/[0.04]',
          )}>
            {([
              { value: 'light' as const, Icon: Sun },
              { value: 'dark' as const, Icon: Moon },
              { value: 'system' as const, Icon: Monitor },
            ]).map(({ value, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={t(`settings.${value}`)}
                aria-label={t(`settings.${value}`)}
                className={cn(
                  'flex h-7 items-center justify-center rounded-lg transition-all duration-200',
                  collapsed ? 'w-7' : 'flex-1',
                  theme === value
                    ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/5'
                    : 'text-[var(--text-sidebar)] hover:text-white hover:bg-white/[0.04]',
                )}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          {/* Language + Logout */}
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <button
              onClick={toggleLanguage}
              title={t('settings.language')}
              aria-label={t('settings.language')}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all duration-200 hover:bg-white/5"
              style={{ color: 'var(--text-sidebar)' }}
            >
              <Globe size={13} className="shrink-0" />
              {!collapsed && (
                <span>{i18n.language === 'he' ? 'EN' : '\u05E2\u05D1'}</span>
              )}
            </button>

            <button
              onClick={handleLogout}
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all duration-200 hover:bg-red-500/10 hover:text-red-400',
                !collapsed && 'ms-auto',
              )}
              style={{ color: 'var(--text-sidebar)' }}
            >
              <LogOut size={13} className="shrink-0" />
              {!collapsed && (
                <span>{t('auth.logout')}</span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
