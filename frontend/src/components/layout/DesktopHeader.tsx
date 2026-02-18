import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronRight, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { alertsApi } from '@/api/alerts'

/** Map route paths to i18n translation keys */
const routeLabels: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/transactions': 'nav.transactions',
  '/balance': 'nav.balance',
  '/fixed': 'nav.fixed',
  '/installments': 'nav.installments',
  '/loans': 'nav.loans',
  '/subscriptions': 'nav.subscriptions',
  '/forecast': 'nav.forecast',
  '/categories': 'nav.categories',
  '/organizations': 'nav.organizations',
  '/alerts': 'nav.alerts',
  '/settings': 'nav.settings',
  '/users': 'nav.users',
  '/backups': 'nav.backups',
}

/** Extract initials from full name or username */
function getInitials(name: string | null, username: string): string {
  if (name) {
    const parts = name.split(' ')
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].substring(0, 2).toUpperCase()
  }
  return username.substring(0, 2).toUpperCase()
}

export default function DesktopHeader() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch unread alerts count
  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'unread-count'],
    queryFn: () => alertsApi.unread(),
    refetchInterval: 30000,
  })
  const unreadCount = alertsData?.count ?? 0

  // Glass effect on scroll
  useEffect(() => {
    const mainContent = document.getElementById('main-content')
    if (!mainContent) return

    const handleScroll = () => {
      setScrolled(mainContent.scrollTop > 8)
    }

    mainContent.addEventListener('scroll', handleScroll, { passive: true })
    return () => mainContent.removeEventListener('scroll', handleScroll)
  }, [])

  // Also listen on window scroll as a fallback
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Close dropdown on Escape
  useEffect(() => {
    if (!dropdownOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dropdownOpen])

  const handleLogout = useCallback(() => {
    setDropdownOpen(false)
    logout()
  }, [logout])

  const handleSettingsClick = useCallback(() => {
    setDropdownOpen(false)
    navigate('/settings')
  }, [navigate])

  // Determine current route label
  const currentPath = '/' + location.pathname.split('/').filter(Boolean)[0]
  const currentLabelKey = routeLabels[currentPath]
  const currentLabel = currentLabelKey ? t(currentLabelKey) : ''

  const initials = user ? getInitials(user.full_name, user.username) : ''

  return (
    <header
      className="sticky top-0 z-20 hidden h-16 items-center justify-between px-6 transition-all duration-300 md:flex"
      style={{
        backgroundColor: scrolled
          ? 'color-mix(in srgb, var(--bg-card) 80%, transparent)'
          : 'var(--bg-card)',
        borderBottom: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-xs)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}
    >
      {/* LEFT: Breadcrumbs */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('header.pages')}
        </span>
        {currentLabel && (
          <>
            <ChevronRight
              size={14}
              className="rtl:-scale-x-100"
              style={{ color: 'var(--text-secondary)' }}
            />
            <span
              className="text-xs font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {currentLabel}
            </span>
          </>
        )}
      </nav>

      {/* RIGHT: Notifications + User */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <Link
          to="/alerts"
          className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
          aria-label={t('header.notifications')}
          title={t('header.unreadAlerts')}
        >
          <Bell size={18} style={{ color: 'var(--text-secondary)' }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{
                backgroundColor: 'var(--color-danger)',
                insetInlineEnd: '-2px',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User Avatar + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
              boxShadow: '0 2px 8px rgba(67, 24, 255, 0.3)',
            }}
            aria-label={t('header.userMenu')}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {initials}
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="absolute top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border py-1"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-card) 90%, transparent)',
                borderColor: 'var(--border-primary)',
                boxShadow: 'var(--shadow-lg)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                insetInlineEnd: '0',
              }}
              role="menu"
              aria-label={t('header.userMenu')}
            >
              {/* User info */}
              <div
                className="border-b px-4 py-2.5"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {user?.full_name || user?.username}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {user?.email}
                </p>
              </div>

              {/* Settings */}
              <button
                onClick={handleSettingsClick}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                role="menuitem"
              >
                <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
                {t('header.profile')}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-sm transition-colors"
                style={{ color: 'var(--color-danger)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-danger)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                role="menuitem"
              >
                <LogOut size={16} />
                {t('header.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
