import { useState, useCallback, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2 } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import DesktopHeader from '@/components/layout/DesktopHeader'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import AnimatedPage from '@/components/AnimatedPage'
import CommandPalette from '@/components/CommandPalette'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function AppLayout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { currentOrg, isOrgView } = useOrganization()
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bottomNavHidden, setBottomNavHidden] = useState(() => {
    try {
      return localStorage.getItem('bottomNavHidden') === 'true'
    } catch {
      return false
    }
  })

  const isRtl = i18n.language === 'he'

  const handleMobileOpen = useCallback(() => {
    setMobileOpen(true)
  }, [])

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false)
  }, [])

  const handleBottomNavVisibilityChange = useCallback((hidden: boolean) => {
    setBottomNavHidden(hidden)
  }, [])

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-primary)' }}
      data-bottom-nav-hidden={bottomNavHidden || undefined}
    >
      {/* Floating gradient orbs */}
      <div className="orbs-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Skip-to-content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:z-[60] focus:rounded-xl focus:border focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:shadow-lg"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--border-focus)',
          borderColor: 'var(--border-focus)',
          boxShadow: 'var(--shadow-xl)',
          insetInlineStart: '16px',
        }}
      >
        {t('common.skipToContent')}
      </a>

      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleMobileClose} />
      <Header onMenuClick={handleMobileOpen} />

      {/*
        Main content area.
        On mobile: no sidebar margin (sidebar is overlay).
        On md+: offset by sidebar width via CSS custom property.
        We use margin-inline-start which is RTL-aware: it maps to
        margin-right in RTL and margin-left in LTR when dir is set.
      */}
      <div className="transition-[margin] duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] md:ms-[var(--sidebar-width)]">
        {/* Desktop Header Bar — visible only on md+ */}
        <DesktopHeader />

        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-[1] min-h-[calc(100vh-3.5rem)] p-4 md:min-h-[calc(100vh-4rem)] md:p-8 md:pt-6 outline-none"
        >
        <AnimatedPage key={location.pathname}>
          <div className="mx-auto max-w-7xl">
            {/* Organization view banner */}
            {isOrgView && currentOrg && (
              <div
                className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-2.5"
                style={{
                  backgroundColor: 'var(--bg-info)',
                  border: '1px solid var(--border-info)',
                }}
              >
                <Building2
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--color-info)' }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: 'var(--color-info)' }}
                >
                  {t('organizations.orgView')}: {currentOrg.name}
                </span>
              </div>
            )}
            <Outlet />
          </div>
        </AnimatedPage>
      </main>
      </div>

      {/* Mobile bottom navigation bar */}
      <MobileBottomNav onVisibilityChange={handleBottomNavVisibilityChange} />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}
