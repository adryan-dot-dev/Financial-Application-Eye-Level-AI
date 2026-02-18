import { useState, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  ArrowRightLeft,
  CalendarRange,
  TrendingUp,
  MoreHorizontal,
  CreditCard,
  Landmark,
  Tags,
  Bell,
  Settings,
  Wallet,
  Users,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_NAV_HIDDEN_KEY = 'bottomNavHidden'

interface BottomNavItem {
  key: string
  icon: LucideIcon
  path: string
  labelKey: string
}

const primaryTabs: BottomNavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'transactions', icon: ArrowRightLeft, path: '/transactions', labelKey: 'nav.transactions' },
  { key: 'fixed', icon: CalendarRange, path: '/fixed', labelKey: 'nav.fixed' },
  { key: 'forecast', icon: TrendingUp, path: '/forecast', labelKey: 'nav.forecast' },
]

interface MoreNavItem {
  key: string
  icon: LucideIcon
  path: string
  labelKey: string
}

const moreItems: MoreNavItem[] = [
  { key: 'balance', icon: Wallet, path: '/balance', labelKey: 'nav.balance' },
  { key: 'installments', icon: CreditCard, path: '/installments', labelKey: 'nav.installments' },
  { key: 'loans', icon: Landmark, path: '/loans', labelKey: 'nav.loans' },
  { key: 'categories', icon: Tags, path: '/categories', labelKey: 'nav.categories' },
  { key: 'alerts', icon: Bell, path: '/alerts', labelKey: 'nav.alerts' },
  { key: 'settings', icon: Settings, path: '/settings', labelKey: 'nav.settings' },
  { key: 'users', icon: Users, path: '/users', labelKey: 'nav.users' },
]

interface MobileBottomNavProps {
  onVisibilityChange?: (hidden: boolean) => void
}

export default function MobileBottomNav({ onVisibilityChange }: MobileBottomNavProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(BOTTOM_NAV_HIDDEN_KEY) === 'true'
    } catch {
      return false
    }
  })

  const isActive = useCallback(
    (path: string) => location.pathname.startsWith(path),
    [location.pathname],
  )

  // Check if any "more" item is currently active
  const isMoreActive = moreItems.some((item) => isActive(item.path))

  // Close "More" sheet on route change
  useEffect(() => {
    setMoreOpen(false)
    setClosing(false)
  }, [location.pathname])

  // Notify parent of visibility changes
  useEffect(() => {
    onVisibilityChange?.(hidden)
  }, [hidden, onVisibilityChange])

  const handleCloseMore = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setMoreOpen(false)
      setClosing(false)
    }, 150)
  }, [])

  const handleToggleMore = useCallback(() => {
    if (moreOpen) {
      handleCloseMore()
    } else {
      setMoreOpen(true)
    }
  }, [moreOpen, handleCloseMore])

  const handleToggleHidden = useCallback(() => {
    setHidden((prev) => {
      const next = !prev
      try {
        localStorage.setItem(BOTTOM_NAV_HIDDEN_KEY, String(next))
      } catch {
        // localStorage unavailable
      }
      return next
    })
    // Close "more" sheet if open
    if (moreOpen) {
      setMoreOpen(false)
      setClosing(false)
    }
  }, [moreOpen])

  return (
    <>
      {/* Overlay for more sheet */}
      {moreOpen && !hidden && (
        <div
          className="fixed inset-0 z-[38] bg-black/30 backdrop-blur-sm md:hidden"
          onClick={handleCloseMore}
        />
      )}

      {/* More sheet */}
      {moreOpen && !hidden && (
        <div
          className={cn(
            'mobile-more-sheet md:hidden',
            closing && 'mobile-more-sheet-closing',
          )}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('nav.menu')}
            </span>
            <button
              onClick={handleCloseMore}
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ color: 'var(--text-tertiary)' }}
              aria-label={t('common.close')}
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4">
            {moreItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl px-3 py-4 transition-colors',
                    active ? 'font-semibold' : '',
                  )}
                  style={{
                    backgroundColor: active ? 'rgba(67, 24, 255, 0.08)' : 'var(--bg-hover)',
                    color: active ? 'var(--color-brand-500)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={20} />
                  <span className="text-[11px] font-medium text-center leading-tight">
                    {t(item.labelKey)}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapse/Expand toggle pill — always visible on mobile */}
      <button
        onClick={handleToggleHidden}
        className={cn(
          'mobile-bottom-nav-toggle md:hidden',
          hidden && 'mobile-bottom-nav-toggle-bottom',
        )}
        aria-label={hidden ? t('nav.showBottomNav') : t('nav.hideBottomNav')}
      >
        {hidden ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Bottom tab bar */}
      <nav
        className={cn(
          'mobile-bottom-nav md:hidden',
          hidden && 'mobile-bottom-nav-hidden',
        )}
        aria-label={t('nav.mainNavigation')}
        aria-hidden={hidden}
      >
        {primaryTabs.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.key}
              to={item.path}
              className={cn(
                'mobile-bottom-nav-item',
                active && 'mobile-bottom-nav-item-active',
              )}
              aria-current={active ? 'page' : undefined}
              tabIndex={hidden ? -1 : undefined}
            >
              <Icon size={20} />
              <span>{t(item.labelKey)}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={handleToggleMore}
          className={cn(
            'mobile-bottom-nav-item',
            (isMoreActive || moreOpen) && 'mobile-bottom-nav-item-active',
          )}
          aria-expanded={moreOpen}
          aria-label={t('nav.menu')}
          tabIndex={hidden ? -1 : undefined}
        >
          <MoreHorizontal size={20} />
          <span>{t('nav.menu')}</span>
        </button>
      </nav>
    </>
  )
}
